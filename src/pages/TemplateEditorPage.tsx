import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import PersistenceStateBanner from "@/components/admin/persistence-state-banner";
import RichEditor from "@/components/editor/rich-editor";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { coerceTipTapDoc, type TipTapDoc } from "@/lib/knowledge/content-doc";
import {
  buildEditorCategoryOptions,
  buildEditorPageOptions,
} from "@/lib/knowledge/editor-link-options";
import { ROUTES } from "@/lib/routes";
import type { TemplateChannel } from "@/lib/types/domain";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isBlank } from "@/lib/utils";

// ── Field style constants ─────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20";

const labelCls = "mb-1.5 block text-xs font-semibold text-[#374151]";

const CHANNEL_OPTIONS: Array<{ value: TemplateChannel; label: string }> = [
  { value: "email", label: "E-mail" },
  { value: "zgloszenie", label: "Zgłoszenie" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { templates, matrix, pages, categories, templatesModule } = useData();
  const { push: pushToast } = useToast();

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  const isNew = templateId === "nowy";
  const existing = isNew ? null : templates.find((t) => t.id === templateId);

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.szablony} replace />;
  }

  // ─ Form state ─
  const [title, setTitle] = useState(existing?.title ?? "");
  const [channel, setChannel] = useState<TemplateChannel>(existing?.channel ?? "email");
  const [body, setBody] = useState<TipTapDoc>(coerceTipTapDoc(existing?.body));
  const [example, setExample] = useState<TipTapDoc>(coerceTipTapDoc(existing?.example));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        channel: existing?.channel ?? "email",
        body: coerceTipTapDoc(existing?.body),
        example: coerceTipTapDoc(existing?.example),
      }),
    [existing?.id],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        channel,
        body,
        example,
      }),
    [title, channel, body, example],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving,
  });

  // Re-initialise when navigating from one template to another without unmount
  useEffect(() => {
    setTitle(existing?.title ?? "");
    setChannel(existing?.channel ?? "email");
    setBody(coerceTipTapDoc(existing?.body));
    setExample(coerceTipTapDoc(existing?.example));
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (!templatesModule.canWrite) {
      setError("Moduł szablonów nie jest jeszcze gotowy do zapisu.");
      return;
    }

    if (isBlank(title)) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }

    setSaving(true);

    try {
      if (isNew) {
        await templatesModule.createTemplate({
          title: title.trim(),
          channel,
          body,
          example,
        });
        pushToast("success", "Szablon został dodany.");
      } else if (existing) {
        await templatesModule.editTemplate(existing.id, {
          title: title.trim(),
          channel,
          body,
          example,
        });
        pushToast("success", "Szablon został zaktualizowany.");
      }
      allowNextNavigation();
      navigate(ROUTES.szablony);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać szablonu.");
    } finally {
      setSaving(false);
    }
  };

  const editorPages = buildEditorPageOptions(pages, categories);
  const editorCategories = buildEditorCategoryOptions(categories);
  const pageTitle = isNew ? "Nowy szablon" : "Edytuj szablon";

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-240 pb-12">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.szablony)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
            >
              <ArrowLeft size={16} />
              Szablony
            </button>
            <span className="text-[#d1d5db]">/</span>
            <span className="text-sm font-medium text-[#0f172a]">{pageTitle}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Uzupełnij metadane oraz treść szablonu. Przykład wypełnienia pomaga zachować spójny styl odpowiedzi.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title + channel */}
          <section className="ui-panel p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0f172a]">Parametry szablonu</h2>
              <p className="mt-1 text-xs text-[#64748b]">Tytuł i kanał ułatwiają późniejsze wyszukiwanie i filtrowanie.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <div>
                <label className={labelCls}>
                  Tytuł <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Potwierdzenie przyjęcia zgłoszenia"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Kanał</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as TemplateChannel)}
                  className={`${fieldCls} min-w-40`}
                >
                  {CHANNEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Szablon — main body */}
          <div>
            <label className={`${labelCls} text-[#1d4f91]`}>Szablon</label>
            <p className="mb-2 text-[11px] text-[#9ca3af]">
              Główna treść do skopiowania — może zawierać puste miejsca do uzupełnienia, np. [IMIĘ KLIENTA].
            </p>
            <div className="overflow-clip rounded-xl border border-[#d9e2ec] bg-white shadow-sm">
              <RichEditor
                content={body}
                onChange={setBody}
                placeholder="Wpisz treść szablonu…"
                minHeight="260px"
                matrixEntries={matrix}
                pages={editorPages}
                categories={editorCategories}
                inlineNoCopy
              />
            </div>
          </div>

          {/* Przykład poprawnego wypełnienia */}
          <div>
            <label className={`${labelCls} text-[#92400e]`}>
              Przykład poprawnego wypełnienia
            </label>
            <p className="mb-2 text-[11px] text-[#9ca3af]">
              Gotowy przykład z uzupełnionymi danymi — pokazuje jak szablon powinien wyglądać po wypełnieniu.
            </p>
            <div className="overflow-clip rounded-xl border border-[#fde68a] bg-white shadow-sm">
              <RichEditor
                content={example}
                onChange={setExample}
                placeholder="Wpisz wypełniony przykład…"
                minHeight="220px"
                matrixEntries={matrix}
                pages={editorPages}
                categories={editorCategories}
                inlineNoCopy
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-2.5 text-sm font-medium text-[#dc2626]">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
            <p className="text-xs text-[#94a3b8]">Zmiany zostaną zapisane po użyciu przycisku „Zapisz zmiany”.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.szablony)}
                className="rounded-xl border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving || templatesModule.isMutating || !templatesModule.canWrite}
                className="rounded-xl bg-[#1d4f91] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:opacity-50"
              >
                {saving ? "Zapisywanie…" : isNew ? "Dodaj szablon" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </AppShell>
  );
}

