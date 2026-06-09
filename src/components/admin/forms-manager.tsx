import { useEffect, useMemo, useState } from "react";
import {
  adaptProjectFormSubmissions,
  adaptProjectForms,
  createProjectForm,
  deleteProjectForm,
  fetchProjectFormSubmissions,
  fetchProjectForms,
  updateProjectForm,
} from "@/lib/api/project-forms";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import type {
  ProjectFormDefinition,
  ProjectFormField,
  ProjectFormSubmission,
} from "@/lib/types/domain";

type EditorField = ProjectFormField & {
  _localId: string;
  /** Raw textarea content for select options; parsed only on save. */
  optionsText?: string;
};

type EditorState = {
  id: string | null;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  fields: EditorField[];
};

let editorFieldCounter = 0;

function createEditorFieldLocalId(): string {
  editorFieldCounter += 1;
  return `field_${editorFieldCounter}`;
}

function buildEmptyEditor(): EditorState {
  return {
    id: null,
    slug: "",
    title: "",
    description: "",
    isActive: true,
    fields: [
      {
        _localId: createEditorFieldLocalId(),
        id: "pole_1",
        label: "Pole tekstowe",
        type: "text",
        required: false,
      },
    ],
  };
}

function toEditorFields(fields: ProjectFormField[]): EditorField[] {
  return fields.map((field) => ({
    ...field,
    _localId: createEditorFieldLocalId(),
    ...(field.type === "select"
      ? { optionsText: optionsToText(field.options) }
      : {}),
  }));
}

function optionValueFromLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return slug.length > 0 ? slug : "opcja";
}

function optionsToText(options: ProjectFormField["options"]): string {
  return (options ?? [])
    .map((option) => {
      const autoValue = optionValueFromLabel(option.label);
      if (option.value === autoValue) {
        return option.label;
      }
      return `${option.value}|${option.label}`;
    })
    .join("\n");
}

function getSelectOptionsText(field: EditorField): string {
  if (field.optionsText !== undefined) {
    return field.optionsText;
  }
  return optionsToText(field.options);
}

/** Parse one-option-per-line text into structured options (save-time only). */
function parseOptionsText(input: string): Array<{ value: string; label: string }> {
  const seenValues = new Set<string>();
  const parsed: Array<{ value: string; label: string }> = [];

  for (const rawLine of input.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const pipeIndex = line.indexOf("|");
    let value: string;
    let label: string;

    if (pipeIndex >= 0) {
      value = line.slice(0, pipeIndex).trim();
      label = line.slice(pipeIndex + 1).trim();
      if (!label && value) {
        label = value;
      }
    } else {
      label = line;
      value = "";
    }

    if (!label) {
      continue;
    }

    let resolvedValue = value || optionValueFromLabel(label);
    let uniqueValue = resolvedValue;
    let suffix = 2;
    while (seenValues.has(uniqueValue)) {
      uniqueValue = `${resolvedValue}_${suffix}`;
      suffix += 1;
    }
    seenValues.add(uniqueValue);

    parsed.push({ value: uniqueValue, label });
  }

  return parsed;
}

function createSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeFieldIdInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeFieldDraft(field: EditorField): EditorField {
  const normalizedOptions =
    field.type === "select"
      ? parseOptionsText(getSelectOptionsText(field))
      : undefined;

  return {
    ...field,
    id: normalizeFieldIdInput(field.id),
    label: field.label.trim(),
    placeholder: field.placeholder?.trim() || undefined,
    options: normalizedOptions,
    optionsText: field.type === "select" ? getSelectOptionsText(field) : undefined,
  };
}

function validateEditorInput(input: {
  slug: string;
  title: string;
  fields: ProjectFormField[];
}): string | null {
  if (!input.title.trim()) {
    return "Tytuł formularza jest wymagany.";
  }

  if (!input.slug.trim()) {
    return "Slug formularza jest wymagany.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return "Slug może zawierać tylko małe litery, cyfry i pojedyncze myślniki.";
  }

  if (input.fields.length === 0) {
    return "Formularz musi zawierać co najmniej jedno pole.";
  }

  const seenIds = new Set<string>();

  for (const field of input.fields) {
    if (!field.id) {
      return "Każde pole musi mieć ID.";
    }
    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(field.id)) {
      return `ID pola "${field.id}" jest niepoprawne. Użyj małych liter, cyfr i podkreślenia.`;
    }
    if (seenIds.has(field.id)) {
      return `ID pola "${field.id}" występuje więcej niż raz.`;
    }
    seenIds.add(field.id);

    if (!field.label.trim()) {
      return `Pole "${field.id}" musi mieć etykietę.`;
    }

    if (field.type === "select") {
      if (!field.options || field.options.length === 0) {
        return `Pole "${field.label}" typu select musi mieć co najmniej jedną opcję.`;
      }
    }
  }

  return null;
}

export default function FormsManager() {
  const { activeProjectSlug } = useProjectRouting();
  const [forms, setForms] = useState<ProjectFormDefinition[]>([]);
  const [submissions, setSubmissions] = useState<ProjectFormSubmission[]>([]);
  const [selectedFormFilter, setSelectedFormFilter] = useState<string>("");
  const [editor, setEditor] = useState<EditorState>(() => buildEmptyEditor());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const selectedFormName = useMemo(
    () => forms.find((form) => form.id === selectedFormFilter)?.title ?? "Wszystkie formularze",
    [forms, selectedFormFilter]
  );

  async function loadAll() {
    setIsLoading(true);
    setError("");
    try {
      const [formsPayload, submissionsPayload] = await Promise.all([
        fetchProjectForms(activeProjectSlug, { admin: true }),
        fetchProjectFormSubmissions(activeProjectSlug, selectedFormFilter ? { formId: selectedFormFilter } : {}),
      ]);
      const nextForms = adaptProjectForms(formsPayload);
      setForms(nextForms);
      setSubmissions(adaptProjectFormSubmissions(submissionsPayload));

      if (editor.id) {
        const matching = nextForms.find((item) => item.id === editor.id);
        if (!matching) {
          setEditor(buildEmptyEditor());
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać formularzy.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectSlug, selectedFormFilter]);

  function startCreate() {
    setEditor(buildEmptyEditor());
    setSuccess("");
    setError("");
  }

  function startEdit(form: ProjectFormDefinition) {
    setEditor({
      id: form.id,
      slug: form.slug,
      title: form.title,
      description: form.description,
      isActive: form.isActive,
      fields: form.fields.length > 0 ? toEditorFields(form.fields) : buildEmptyEditor().fields,
    });
    setSuccess("");
    setError("");
  }

  function updateField(
    localFieldId: string,
    patch: Partial<EditorField>
  ) {
    setEditor((current) => ({
      ...current,
      fields: current.fields.map((field) =>
        field._localId === localFieldId
          ? {
              ...field,
              ...patch,
            }
          : field
      ),
    }));
  }

  function addField() {
    setEditor((current) => {
      const nextIndex = current.fields.length + 1;
      return {
        ...current,
        fields: [
          ...current.fields,
          {
            _localId: createEditorFieldLocalId(),
            id: `pole_${nextIndex}`,
            label: `Pole ${nextIndex}`,
            type: "text",
            required: false,
          },
        ],
      };
    });
  }

  function removeField(localFieldId: string) {
    setEditor((current) => ({
      ...current,
      fields: current.fields.filter((field) => field._localId !== localFieldId),
    }));
  }

  async function saveForm() {
    setError("");
    setSuccess("");

    const normalizedSlug = normalizeSlugInput(editor.slug);
    const normalizedTitle = editor.title.trim();
    const normalizedDescription = editor.description.trim();
    const normalizedEditorFields = editor.fields.map((field) => normalizeFieldDraft(field));
    const payloadFields = normalizedEditorFields.map(({ _localId, optionsText, ...field }) => field);
    const validationError = validateEditorInput({
      slug: normalizedSlug,
      title: normalizedTitle,
      fields: payloadFields,
    });

    setEditor((current) => ({
      ...current,
      slug: normalizedSlug,
      title: normalizedTitle,
      description: normalizedDescription,
      fields: normalizedEditorFields,
    }));

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        slug: normalizedSlug,
        title: normalizedTitle,
        description: normalizedDescription,
        isActive: editor.isActive,
        fields: payloadFields,
      };

      if (editor.id) {
        await updateProjectForm(activeProjectSlug, editor.id, payload);
        setSuccess("Formularz został zapisany.");
      } else {
        await createProjectForm(activeProjectSlug, payload);
        setSuccess("Formularz został utworzony.");
        setEditor(buildEmptyEditor());
      }

      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać formularza.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(form: ProjectFormDefinition) {
    const confirmed = window.confirm(`Usunąć formularz "${form.title}"?`);
    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    try {
      await deleteProjectForm(activeProjectSlug, form.id);
      if (editor.id === form.id) {
        setEditor(buildEmptyEditor());
      }
      setSuccess("Formularz został usunięty.");
      await loadAll();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się usunąć formularza.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#dbe4f0] bg-[#f8fbff] p-4 dark:border-[#334155] dark:bg-[#0f172a]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Formularze projektowe
            </h3>
            <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              Twórz formularze dla użytkowników projektu i przeglądaj przesłane zgłoszenia.
            </p>
          </div>
          <button type="button" onClick={startCreate} className="ui-btn">
            Nowy formularz
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm text-[#166534] dark:border-[#14532d] dark:bg-[#0f2416] dark:text-[#86efac]">
          {success}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#dde5ee] bg-white p-3 dark:border-[#334155] dark:bg-[#111827]">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
            Formularze ({forms.length})
          </p>

          {isLoading ? (
            <p className="px-2 py-8 text-sm text-[#64748b] dark:text-[#94a3b8]">Ładowanie…</p>
          ) : forms.length === 0 ? (
            <p className="px-2 py-8 text-sm text-[#64748b] dark:text-[#94a3b8]">Brak formularzy.</p>
          ) : (
            <div className="space-y-2">
              {forms.map((form) => {
                const active = editor.id === form.id;
                return (
                  <div
                    key={form.id}
                    className={[
                      "rounded-lg border px-3 py-2",
                      active
                        ? "border-[#1d4f91] bg-[#eff6ff] dark:border-[#1e3a8a] dark:bg-[#0f1b3a]"
                        : "border-[#e2e8f0] bg-white dark:border-[#1e293b] dark:bg-[#0f172a]",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      onClick={() => startEdit(form)}
                      className="w-full text-left"
                    >
                      <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                        {form.title}
                      </p>
                      <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        {form.slug} • {form.isActive ? "Aktywny" : "Nieaktywny"}
                      </p>
                    </button>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(form)}
                        className="rounded-md border border-[#dbe4f0] px-2 py-1 text-xs text-[#475569] hover:bg-[#f8fbff] dark:border-[#334155] dark:text-[#cbd5e1] dark:hover:bg-[#1e293b]"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(form)}
                        className="rounded-md border border-[#fecaca] px-2 py-1 text-xs text-[#b91c1c] hover:bg-[#fff5f5] dark:border-[#7f1d1d] dark:text-[#fca5a5] dark:hover:bg-[#3b1313]"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <section className="space-y-6">
          <div className="rounded-xl border border-[#dde5ee] bg-white p-4 dark:border-[#334155] dark:bg-[#111827]">
            <h4 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              {editor.id ? "Edytuj formularz" : "Nowy formularz"}
            </h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Tytuł</span>
                <input
                  type="text"
                  value={editor.title}
                  onChange={(event) => {
                    const title = event.target.value;
                    setEditor((current) => ({
                      ...current,
                      title,
                      slug: current.id ? current.slug : createSlugFromTitle(title),
                    }));
                  }}
                  className="ui-input"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Slug</span>
                <input
                  type="text"
                  value={editor.slug}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, slug: event.target.value.toLowerCase() }))
                  }
                  onBlur={(event) =>
                    setEditor((current) => ({
                      ...current,
                      slug: normalizeSlugInput(event.target.value),
                    }))
                  }
                  className="ui-input"
                />
              </label>

              <label className="space-y-1 sm:col-span-2">
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Opis</span>
                <textarea
                  value={editor.description}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, description: event.target.value }))
                  }
                  className="ui-input min-h-20 py-2"
                />
              </label>

              <label className="inline-flex items-center gap-2 text-sm text-[#334155] dark:text-[#cbd5e1]">
                <input
                  type="checkbox"
                  checked={editor.isActive}
                  onChange={(event) =>
                    setEditor((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-[#cbd5e1]"
                />
                Formularz aktywny
              </label>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Pola formularza</h5>
                <button
                  type="button"
                  onClick={addField}
                  className="rounded-md border border-[#dbe4f0] px-2 py-1 text-xs text-[#1d4f91] hover:bg-[#f8fbff] dark:border-[#334155] dark:text-[#93c5fd] dark:hover:bg-[#1e293b]"
                >
                  Dodaj pole
                </button>
              </div>

              {editor.fields.map((field, index) => (
                <div
                  key={field._localId}
                  className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] p-3 dark:border-[#1e293b] dark:bg-[#0f172a]"
                >
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">ID pola</span>
                      <input
                        type="text"
                        value={field.id}
                        onChange={(event) => updateField(field._localId, { id: event.target.value })}
                        onBlur={(event) =>
                          updateField(field._localId, { id: normalizeFieldIdInput(event.target.value) })
                        }
                        className="ui-input"
                      />
                      <span className="text-[11px] text-[#94a3b8]">
                        Dozwolone: małe litery, cyfry, znak "_".
                      </span>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Etykieta</span>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(event) => updateField(field._localId, { label: event.target.value })}
                        className="ui-input"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Typ</span>
                      <select
                        value={field.type}
                        onChange={(event) => {
                          const type = event.target.value as ProjectFormField["type"];
                          if (type === "select") {
                            updateField(field._localId, {
                              type,
                              optionsText:
                                field.optionsText ??
                                (field.options && field.options.length > 0
                                  ? optionsToText(field.options)
                                  : "Opcja 1\nOpcja 2"),
                              options: undefined,
                            });
                            return;
                          }
                          updateField(field._localId, {
                            type,
                            optionsText: undefined,
                            options: undefined,
                          });
                        }}
                        className="ui-input"
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Placeholder</span>
                      <input
                        type="text"
                        value={field.placeholder ?? ""}
                        onChange={(event) =>
                          updateField(field._localId, { placeholder: event.target.value })
                        }
                        className="ui-input"
                      />
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-[#334155] dark:text-[#cbd5e1]">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) =>
                          updateField(field._localId, { required: event.target.checked })
                        }
                        className="h-4 w-4 rounded border-[#cbd5e1]"
                      />
                      Wymagane
                    </label>
                    <div>
                      <button
                        type="button"
                        disabled={editor.fields.length <= 1}
                        onClick={() => removeField(field._localId)}
                        className="rounded-md border border-[#fecaca] px-2 py-1 text-xs text-[#b91c1c] hover:bg-[#fff5f5] disabled:opacity-50 dark:border-[#7f1d1d] dark:text-[#fca5a5] dark:hover:bg-[#3b1313]"
                      >
                        Usuń pole
                      </button>
                    </div>
                  </div>

                  {field.type === "select" ? (
                    <label className="mt-2 block space-y-1">
                      <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                        Opcje (jedna na linię)
                      </span>
                      <textarea
                        value={getSelectOptionsText(field)}
                        onChange={(event) =>
                          updateField(field._localId, { optionsText: event.target.value })
                        }
                        className="ui-input min-h-20 py-2 font-mono text-sm"
                        placeholder={"Opcja pierwsza\nOpcja druga\nOpcja z spacjami"}
                      />
                      <span className="text-[11px] text-[#94a3b8]">
                        Każda linia to etykieta widoczna w formularzu. Opcjonalnie:{" "}
                        <code>wartość|etykieta</code> (np. <code>tak|Nie</code>), gdy wartość ma być inna
                        niż automatyczna.
                      </span>
                    </label>
                  ) : null}

                  <p className="mt-2 text-[11px] text-[#94a3b8]">Pole {index + 1}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveForm()}
                className="ui-btn disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Zapisywanie…" : "Zapisz formularz"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[#dde5ee] bg-white p-4 dark:border-[#334155] dark:bg-[#111827]">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                  Zgłoszenia formularzy
                </h4>
                <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                  Widok: {selectedFormName} • {submissions.length} wpisów
                </p>
              </div>
              <label className="space-y-1">
                <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Filtr formularza</span>
                <select
                  value={selectedFormFilter}
                  onChange={(event) => setSelectedFormFilter(event.target.value)}
                  className="ui-input min-w-[15rem]"
                >
                  <option value="">Wszystkie formularze</option>
                  {forms.map((form) => (
                    <option key={form.id} value={form.id}>
                      {form.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 space-y-2">
              {submissions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#dbe4f0] px-3 py-6 text-center text-sm text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
                  Brak zgłoszeń.
                </p>
              ) : (
                submissions.map((entry) => (
                  <details
                    key={entry.id}
                    className="rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 dark:border-[#1e293b] dark:bg-[#0f172a]"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                            {entry.formTitle}
                          </p>
                          <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                            {entry.submitter.displayName ?? entry.submitter.email ?? "Użytkownik"}
                            {" • "}
                            {new Date(entry.createdAt).toLocaleString("pl-PL")}
                          </p>
                        </div>
                        <span className="rounded-md border border-[#dbe4f0] bg-white px-2 py-0.5 text-[11px] text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                          {entry.deliveryStatus}
                        </span>
                      </div>
                    </summary>
                    <div className="mt-2 rounded-md bg-white p-2 text-xs text-[#334155] dark:bg-[#111827] dark:text-[#cbd5e1]">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.payload, null, 2)}
                      </pre>
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
