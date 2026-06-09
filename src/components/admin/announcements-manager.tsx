import { useState, useCallback, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Plus, Pencil, Trash2, Check, X, Eye, EyeOff } from "lucide-react";
import RichEditor from "@/components/editor/rich-editor";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import {
  coerceTipTapDoc,
  plainTextToTipTapDoc,
  type TipTapDoc,
} from "@/lib/knowledge/content-doc";
import {
  buildEditorCategoryOptions,
  buildEditorPageOptions,
} from "@/lib/knowledge/editor-link-options";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import {
  getAnnouncementWindowStatus,
  parseLocalDateTimeInputToIso,
  toLocalDateTimeInputValue,
  type AnnouncementWindowStatus,
} from "@/lib/announcements/visibility";
import { extractPlainText } from "@/lib/utils";
import type { Announcement, AnnouncementColor } from "@/lib/types/domain";

// ── Color config ──────────────────────────────────────────────────────────────

const COLOR_OPTIONS: { value: AnnouncementColor; label: string }[] = [
  { value: "red", label: "Czerwony" },
  { value: "orange", label: "Pomarańczowy" },
  { value: "green", label: "Zielony" },
  { value: "blue", label: "Niebieski" },
];

const COLOR_DOT: Record<AnnouncementColor, string> = {
  red: "bg-[#ef4444]",
  orange: "bg-[#f97316]",
  green: "bg-[#22c55e]",
  blue: "bg-[#3b82f6]",
};

const COLOR_BADGE: Record<AnnouncementColor, string> = {
  red: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626] dark:border-[#7f1d1d]/40 dark:bg-[#1a0808] dark:text-[#f87171]",
  orange: "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c] dark:border-[#7c2d12]/40 dark:bg-[#1a0a00] dark:text-[#fb923c]",
  green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340] dark:text-[#60a5fa]",
};

const WINDOW_STATUS_LABEL: Record<AnnouncementWindowStatus, string> = {
  scheduled: "Okno: zaplanowane",
  active: "Okno: aktywne",
  expired: "Okno: wygasłe",
};

const WINDOW_STATUS_BADGE: Record<AnnouncementWindowStatus, string> = {
  scheduled:
    "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca] dark:border-[#312e81]/50 dark:bg-[#111433] dark:text-[#a5b4fc]",
  active:
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  expired:
    "border-[#fecaca] bg-[#fff1f2] text-[#dc2626] dark:border-[#7f1d1d]/40 dark:bg-[#2b0f14] dark:text-[#f87171]",
};

function formatVisibilityDateTime(value: string | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Predefined templates ──────────────────────────────────────────────────────

const UNIT_PLACEHOLDER = "1S-5S";
const END_BEFORE_START_ERROR = "Data dezaktywacji nie może być wcześniejsza niż data aktywacji.";

type AnnouncementTemplate = {
  id: string;
  label: string;
  color: AnnouncementColor;
  titleFn: (units: string) => string;
  descriptionFn: (units: string) => string;
  hasUnits: boolean;
};

const PREDEFINED: AnnouncementTemplate[] = [
  {
    id: "wstrzymanie",
    label: "Wstrzymanie działań rozliczeniowych",
    color: "orange",
    hasUnits: true,
    titleFn: (u) => `Wstrzymanie działań rozliczeniowych dla jednostek ${u}`,
    descriptionFn: (u) => `Wstrzymanie działań rozliczeniowych dla jednostek ${u}. Prosimy o niewykonywanie żadnych działań rozliczeniowych do odwołania.`,
  },
  {
    id: "zamkniecie",
    label: "Zamknięcie miesiąca",
    color: "red",
    hasUnits: true,
    titleFn: (u) => `ZAMKNIĘCIE MIESIĄCA DLA JEDNOSTEK ${u}`,
    descriptionFn: (u) =>
      `W związku z planowanym procesem zamknięcia miesiąca w SKOK-O dla jednostek od ${u}, prosimy o niewykonywanie żadnych działań rozliczeniowych (wystawanie faktur, korygowanie, działania windykacyjne etc.) po godzinie 17:00 w dniu 2026-04-08.`,
  },
  {
    id: "custom",
    label: "Ogłoszenie niestandardowe",
    color: "blue",
    hasUnits: false,
    titleFn: () => "",
    descriptionFn: () => "",
  },
];

// ── Announcement form ─────────────────────────────────────────────────────────

type FormState = {
  title: string;
  body: TipTapDoc;
  color: AnnouncementColor;
  active: boolean;
  useVisibilityWindow: boolean;
  visibleFromInput: string;
  visibleUntilInput: string;
};

type FormSubmitState = {
  title: string;
  body: TipTapDoc;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom?: string;
  visibleUntil?: string;
};

type VisibilityFieldKey = "visibleFromInput" | "visibleUntilInput";

const EMPTY_FORM: FormState = {
  title: "",
  body: plainTextToTipTapDoc(""),
  color: "blue",
  active: true,
  useVisibilityWindow: false,
  visibleFromInput: "",
  visibleUntilInput: "",
};

function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  busy = false,
  isNew,
  pages,
  categories,
}: {
  initial: FormState;
  onSave: (f: FormSubmitState) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
  isNew: boolean;
  pages: Array<{ id: string; title: string; slug: string; category: string; categoryId?: string; categoryDisplayName?: string }>;
  categories: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
}) {
  const now = useCurrentTime();
  const [form, setForm] = useState<FormState>(initial);
  const [templateId, setTemplateId] = useState<string>("custom");
  const [units, setUnits] = useState(UNIT_PLACEHOLDER);
  const [error, setError] = useState("");

  const fieldCls =
    "h-8 w-full rounded-lg border border-[#d1d5db] bg-white px-2.5 text-sm text-[#111827] outline-none focus:border-[#1d4f91] dark:border-[#334155] dark:bg-[#0f1e33] dark:text-[#f1f5f9] dark:focus:border-[#60a5fa]";
  function applyTemplate(tId: string, u: string) {
    const t = PREDEFINED.find((p) => p.id === tId);
    if (!t || tId === "custom") return;
    setForm((prev) => ({
      ...prev,
      title: t.titleFn(u),
      body: plainTextToTipTapDoc(t.descriptionFn(u)),
      color: t.color,
    }));
  }

  function isEndBeforeStart(startInput: string, endInput: string): boolean {
    const startIso = parseLocalDateTimeInputToIso(startInput);
    const endIso = parseLocalDateTimeInputToIso(endInput);

    if (!startIso || !endIso) return false;
    return new Date(endIso).getTime() < new Date(startIso).getTime();
  }

  function initializeVisibilityInput(field: VisibilityFieldKey): void {
    if (!form.useVisibilityWindow) return;
    setForm((prev) => {
      if (prev[field].trim()) return prev;

      return {
        ...prev,
        [field]: toLocalDateTimeInputValue(new Date().toISOString()),
      };
    });
  }

  function handleVisibilityInputKeyDown(
    field: VisibilityFieldKey,
    event: ReactKeyboardEvent<HTMLInputElement>
  ): void {
    if (!form.useVisibilityWindow) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Tab" || event.key === "Shift" || event.key === "Escape") return;
    initializeVisibilityInput(field);
  }

  function handleSave() {
    setError("");

    if (!form.useVisibilityWindow) {
      void onSave({
        title: form.title,
        body: form.body,
        color: form.color,
        active: form.active,
        visibleFrom: undefined,
        visibleUntil: undefined,
      });
      return;
    }

    const visibleFromRaw = form.visibleFromInput.trim();
    const visibleUntilRaw = form.visibleUntilInput.trim();

    const visibleFrom = visibleFromRaw
      ? parseLocalDateTimeInputToIso(visibleFromRaw)
      : null;
    const visibleUntil = visibleUntilRaw
      ? parseLocalDateTimeInputToIso(visibleUntilRaw)
      : null;

    if (visibleFromRaw && !visibleFrom) {
      setError("Podaj poprawną datę aktywacji.");
      return;
    }

    if (visibleUntilRaw && !visibleUntil) {
      setError("Podaj poprawną datę dezaktywacji.");
      return;
    }

    if (
      visibleFrom &&
      visibleUntil &&
      new Date(visibleUntil).getTime() < new Date(visibleFrom).getTime()
    ) {
      setError(END_BEFORE_START_ERROR);
      return;
    }

    void onSave({
      title: form.title,
      body: form.body,
      color: form.color,
      active: form.active,
      visibleFrom: visibleFrom ?? undefined,
      visibleUntil: visibleUntil ?? undefined,
    });
  }

  const tpl = PREDEFINED.find((p) => p.id === templateId);
  const previewWindowStatus = getAnnouncementWindowStatus({
    visibleFrom: parseLocalDateTimeInputToIso(form.visibleFromInput) ?? undefined,
    visibleUntil: parseLocalDateTimeInputToIso(form.visibleUntilInput) ?? undefined,
  }, now);

  return (
    <div className="space-y-4 rounded-xl border border-[#e5e7eb] bg-white p-4 shadow-sm dark:border-[#1e293b] dark:bg-[#0f1e33]">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
        {isNew ? "Nowe ogłoszenie" : "Edytuj ogłoszenie"}
      </p>

      {/* Predefined template picker (only for new) */}
      {isNew && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
            Szablon startowy
          </label>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setTemplateId(p.id);
                  applyTemplate(p.id, units);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  templateId === p.id
                    ? "border-[#1d4f91] bg-[#1d4f91] text-white"
                    : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#1d4f91] hover:text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f2340] dark:text-[#94a3b8]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {tpl?.hasUnits && (
            <div className="flex items-center gap-2">
              <label className="shrink-0 text-xs text-[#6b7280]">Jednostki:</label>
              <input
                type="text"
                value={units}
                onChange={(e) => {
                  setUnits(e.target.value);
                  applyTemplate(templateId, e.target.value);
                }}
                className={`${fieldCls} max-w-40`}
                placeholder="np. 1S-5S"
              />
            </div>
          )}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
          Tytuł *
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={fieldCls}
          placeholder="Tytuł ogłoszenia…"
        />
      </div>

      {/* Body */}
      <div>
        <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
          Treść ogłoszenia
        </label>
        <div className="overflow-clip rounded-xl border border-[#d1d5db] bg-white">
          <RichEditor
            content={form.body}
            onChange={(doc) => setForm((f) => ({ ...f, body: doc }))}
            placeholder="Szczegółowa treść ogłoszenia…"
            minHeight="220px"
            pages={pages}
            categories={categories}
          />
        </div>
      </div>

      {/* Visibility window */}
      <div className="space-y-2 rounded-xl border border-[#d1d5db] bg-[#f8fafc] p-3 dark:border-[#334155] dark:bg-[#0f2340]">
        <div>
          <p className="text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
            Okno widoczności (opcjonalnie)
          </p>
          <p className="mt-0.5 text-[11px] text-[#6b7280] dark:text-[#94a3b8]">
            Bez dat ogłoszenie działa jak dotychczas. Możesz ustawić sam start, sam koniec albo oba terminy.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
          <input
            type="checkbox"
            checked={form.useVisibilityWindow}
            onChange={(e) => {
              const checked = e.target.checked;
              setError("");
              setForm((prev) => ({
                ...prev,
                useVisibilityWindow: checked,
                visibleFromInput: checked ? prev.visibleFromInput : "",
                visibleUntilInput: checked ? prev.visibleUntilInput : "",
              }));
            }}
            className="h-4 w-4 rounded border-[#cbd5e1] text-[#1d4f91] focus:ring-[#1d4f91]"
          />
          Użyj okna widoczności czasowej
        </label>
        {form.useVisibilityWindow ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
                  Aktywacja od
                </label>
                <input
                  type="datetime-local"
                  value={form.visibleFromInput}
                  onChange={(e) => {
                    const nextVisibleFromInput = e.target.value;
                    setForm((f) => ({ ...f, visibleFromInput: nextVisibleFromInput }));
                    if (isEndBeforeStart(nextVisibleFromInput, form.visibleUntilInput)) {
                      setError(END_BEFORE_START_ERROR);
                      return;
                    }
                    setError("");
                  }}
                  onPointerDown={() => initializeVisibilityInput("visibleFromInput")}
                  onKeyDown={(event) => handleVisibilityInputKeyDown("visibleFromInput", event)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
                  Aktywacja do
                </label>
                <input
                  type="datetime-local"
                  value={form.visibleUntilInput}
                  onChange={(e) => {
                    const nextVisibleUntilInput = e.target.value;
                    if (isEndBeforeStart(form.visibleFromInput, nextVisibleUntilInput)) {
                      setError(END_BEFORE_START_ERROR);
                      return;
                    }
                    setError("");
                    setForm((f) => ({ ...f, visibleUntilInput: nextVisibleUntilInput }));
                  }}
                  onPointerDown={() => initializeVisibilityInput("visibleUntilInput")}
                  onKeyDown={(event) => handleVisibilityInputKeyDown("visibleUntilInput", event)}
                  min={form.visibleFromInput || undefined}
                  className={fieldCls}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              <span>Status wg okna czasu:</span>
              <span className={`rounded-md border px-1.5 py-0.5 font-semibold ${WINDOW_STATUS_BADGE[previewWindowStatus]}`}>
                {WINDOW_STATUS_LABEL[previewWindowStatus]}
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            <span>Tryb widoczności:</span>
            <span className="rounded-md border border-[#d1d5db] bg-white px-1.5 py-0.5 font-semibold text-[#475569] dark:border-[#334155] dark:bg-[#0f1e33] dark:text-[#cbd5e1]">
              Ręczny (bez okna czasu)
            </span>
          </div>
        )}
      </div>

      {/* Color + active row */}
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#94a3b8]">
            Kolor
          </label>
          <div className="flex gap-1.5">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  form.color === c.value ? "border-[#0f172a] dark:border-[#f1f5f9]" : "border-transparent"
                } ${COLOR_DOT[c.value]}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
            className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition ${
              form.active
                ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]"
                : "border-[#d1d5db] bg-white text-[#6b7280] dark:border-[#334155] dark:bg-[#0f2340] dark:text-[#94a3b8]"
            }`}
          >
            {form.active ? <Eye size={12} /> : <EyeOff size={12} />}
            {form.active ? "Ręcznie włączone" : "Ręcznie wyłączone"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !form.title.trim()}
          onClick={handleSave}
          className="flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#163d72] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={12} /> Zapisz
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] px-3 py-2 text-xs font-medium text-[#374151] transition hover:bg-[#f8fafc] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
        >
          <X size={12} /> Anuluj
        </button>
      </div>
      {error && (
        <p className="text-xs font-medium text-[#dc2626]">{error}</p>
      )}
    </div>
  );
}

// ── Main manager ─────────────────────────────────────────────────────────────

export default function AnnouncementsManager() {
  const now = useCurrentTime();
  const { announcements, pages, categories, announcementsModule } = useData();
  const { push: pushToast } = useToast();
  const {
    isLoading,
    isMutating,
    error: moduleError,
    canWrite,
    createAnnouncement,
    editAnnouncement,
    removeAnnouncement,
  } = announcementsModule;
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editorPages = buildEditorPageOptions(pages, categories);
  const editorCategories = buildEditorCategoryOptions(categories);

  const handleCreate = useCallback(
    async (f: FormSubmitState) => {
      try {
        await createAnnouncement({
          ...f,
          description: extractPlainText(f.body).trim(),
          visibleFrom: f.visibleFrom ?? null,
          visibleUntil: f.visibleUntil ?? null,
        });
        setCreating(false);
      } catch (caught) {
        pushToast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się dodać ogłoszenia."
        );
      }
    },
    [createAnnouncement, pushToast]
  );

  const handleUpdate = useCallback(
    async (ann: Announcement, f: FormSubmitState) => {
      try {
        await editAnnouncement(ann.id, {
          ...f,
          description: extractPlainText(f.body).trim(),
          visibleFrom: f.visibleFrom ?? null,
          visibleUntil: f.visibleUntil ?? null,
        });
        setEditingId(null);
      } catch (caught) {
        pushToast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się zaktualizować ogłoszenia."
        );
      }
    },
    [editAnnouncement, pushToast]
  );

  const toggleActive = useCallback(
    async (ann: Announcement) => {
      try {
        await editAnnouncement(ann.id, { active: !ann.active });
      } catch (caught) {
        pushToast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się zmienić widoczności ogłoszenia."
        );
      }
    },
    [editAnnouncement, pushToast]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await removeAnnouncement(id);
        setConfirmDeleteId(null);
      } catch (caught) {
        pushToast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się usunąć ogłoszenia."
        );
      }
    },
    [pushToast, removeAnnouncement]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Ogłoszenia w pasku nawigacji
          </h2>
          <p className="mt-0.5 text-xs text-[#6b7280] dark:text-[#94a3b8]">
            Aktywne ogłoszenia są widoczne dla wszystkich użytkowników w górnym pasku.
          </p>
        </div>
        {!creating && (
          <button
            type="button"
            disabled={!canWrite || isMutating}
            onClick={() => { setCreating(true); setEditingId(null); }}
            className="flex items-center gap-1.5 rounded-xl bg-[#1d4f91] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} />
            Nowe ogłoszenie
          </button>
        )}
      </div>

      {moduleError ? (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-xs text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
          {moduleError}
        </div>
      ) : null}

      {creating && (
        <AnnouncementForm
          isNew
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
          busy={isMutating}
          pages={editorPages}
          categories={editorCategories}
        />
      )}

      {announcements.length === 0 && !creating && !isLoading && (
        <p className="rounded-xl border border-dashed border-[#d1d5db] px-4 py-8 text-center text-sm text-[#9ca3af] dark:border-[#334155]">
          Brak ogłoszeń. Kliknij „Nowe ogłoszenie", aby dodać pierwsze.
        </p>
      )}

      <div className="space-y-2">
        {announcements.map((ann) => {
          if (editingId === ann.id) {
            const visibleFromInput = toLocalDateTimeInputValue(ann.visibleFrom);
            const visibleUntilInput = toLocalDateTimeInputValue(ann.visibleUntil);
            return (
              <AnnouncementForm
                key={ann.id}
                isNew={false}
                initial={{
                  title: ann.title,
                  body: coerceTipTapDoc(ann.body, ann.description),
                  color: ann.color,
                  active: ann.active,
                  useVisibilityWindow: Boolean(visibleFromInput || visibleUntilInput),
                  visibleFromInput,
                  visibleUntilInput,
                }}
                onSave={(f) => handleUpdate(ann, f)}
                onCancel={() => setEditingId(null)}
                busy={isMutating}
                pages={editorPages}
                categories={editorCategories}
              />
            );
          }

          const previewText =
            extractPlainText(ann.body).trim() || ann.description;
          const windowStatus = getAnnouncementWindowStatus(ann, now);
          const visibleFromLabel = formatVisibilityDateTime(ann.visibleFrom);
          const visibleUntilLabel = formatVisibilityDateTime(ann.visibleUntil);
          const scheduleSummary = [
            visibleFromLabel ? `Od: ${visibleFromLabel}` : null,
            visibleUntilLabel ? `Do: ${visibleUntilLabel}` : null,
          ]
            .filter(Boolean)
            .join(" • ");

          return (
            <div
              key={ann.id}
              className="flex items-start gap-3 rounded-xl border border-[#e5e7eb] bg-white px-4 py-3 dark:border-[#1e293b] dark:bg-[#0f1e33]"
            >
              {/* Color dot */}
              <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${COLOR_DOT[ann.color]}`} />

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                    {ann.title}
                  </span>
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${COLOR_BADGE[ann.color]}`}>
                    {COLOR_OPTIONS.find((c) => c.value === ann.color)?.label}
                  </span>
                  {ann.active ? (
                    <span className="rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-1.5 py-0.5 text-[10px] font-semibold text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]">
                      Ręcznie: włączone
                    </span>
                  ) : (
                    <span className="rounded-md border border-[#d1d5db] px-1.5 py-0.5 text-[10px] font-semibold text-[#9ca3af] dark:border-[#334155] dark:text-[#64748b]">
                      Ręcznie: wyłączone
                    </span>
                  )}
                  <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${WINDOW_STATUS_BADGE[windowStatus]}`}>
                    {WINDOW_STATUS_LABEL[windowStatus]}
                  </span>
                </div>
                {scheduleSummary && (
                  <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                    {scheduleSummary}
                  </p>
                )}
                {previewText && (
                  <p className="mt-1 line-clamp-2 text-xs text-[#6b7280] dark:text-[#94a3b8]">
                    {previewText}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={isMutating || !canWrite}
                  onClick={() => { void toggleActive(ann); }}
                  title={ann.active ? "Dezaktywuj" : "Aktywuj"}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d1d5db] text-[#6b7280] transition hover:border-[#1d4f91] hover:text-[#1d4f91] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:hover:border-[#60a5fa] dark:hover:text-[#60a5fa]"
                >
                  {ann.active ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  type="button"
                  disabled={isMutating || !canWrite}
                  onClick={() => { setEditingId(ann.id); setCreating(false); }}
                  title="Edytuj"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d1d5db] text-[#6b7280] transition hover:border-[#1d4f91] hover:text-[#1d4f91] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:hover:border-[#60a5fa] dark:hover:text-[#60a5fa]"
                >
                  <Pencil size={13} />
                </button>
                {confirmDeleteId === ann.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isMutating || !canWrite}
                      onClick={() => { void handleDelete(ann.id); }}
                      className="flex h-7 items-center gap-1 rounded-lg bg-[#dc2626] px-2 text-[11px] font-semibold text-white hover:bg-[#b91c1c]"
                    >
                      Usuń
                    </button>
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => setConfirmDeleteId(null)}
                      className="flex h-7 items-center rounded-lg border border-[#d1d5db] px-2 text-[11px] text-[#374151] hover:bg-[#f8fafc] dark:border-[#334155] dark:text-[#94a3b8]"
                    >
                      Anuluj
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isMutating || !canWrite}
                    onClick={() => setConfirmDeleteId(ann.id)}
                    title="Usuń"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#d1d5db] text-[#6b7280] transition hover:border-[#dc2626] hover:bg-[#fff5f5] hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155]"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
