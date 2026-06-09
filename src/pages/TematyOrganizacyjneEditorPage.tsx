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
import type { OrgEntryStatus } from "@/lib/types/domain";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isBlank } from "@/lib/utils";

// ── Field style constants ─────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#3730a3] focus:outline-none focus:ring-2 focus:ring-[#3730a3]/20";

const labelCls = "mb-1.5 block text-xs font-semibold text-[#374151]";

const STATUS_OPTIONS: Array<{ value: OrgEntryStatus; label: string }> = [
  { value: "active", label: "Aktywny" },
  { value: "archived", label: "Archiwum" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TematyOrganizacyjneEditorPage() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orgEntries, matrix, importantTopicsModule, pages, categories, communications } = useData();
  const { push: pushToast } = useToast();

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  const isNew = topicId === "nowy";
  const existing = isNew ? null : orgEntries.find((e) => e.id === topicId);

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.tematOrg} replace />;
  }

  // ─ Form state ─
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<OrgEntryStatus>(existing?.status ?? "active");
  const todayIso = new Date().toISOString().slice(0, 10);
  const [entryDate, setEntryDate] = useState(existing?.entryDate ?? todayIso);
  const [body, setBody] = useState<TipTapDoc>(coerceTipTapDoc(existing?.body));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        status: existing?.status ?? "active",
        entryDate: existing?.entryDate ?? todayIso,
        body: coerceTipTapDoc(existing?.body),
      }),
    [existing?.id, todayIso],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        status,
        entryDate,
        body,
      }),
    [title, status, entryDate, body],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving,
  });

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setStatus(existing?.status ?? "active");
    setEntryDate(existing?.entryDate ?? todayIso);
    setBody(coerceTipTapDoc(existing?.body));
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (isBlank(title)) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }

    if (!importantTopicsModule.canWrite) {
      setError("Backend tematów organizacyjnych nie jest jeszcze gotowy do zapisu.");
      return;
    }

    setSaving(true);

    try {
      if (isNew) {
        await importantTopicsModule.createTopic({
          title: title.trim(),
          status,
          entryDate: entryDate || todayIso,
          body,
        });
        pushToast("success", "Temat organizacyjny został dodany.");
      } else if (existing) {
        await importantTopicsModule.editTopic(existing.id, {
          title: title.trim(),
          status,
          entryDate: entryDate || todayIso,
          body,
        });
        pushToast("success", "Temat organizacyjny został zaktualizowany.");
      }
      allowNextNavigation();
      navigate(ROUTES.tematOrg);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać tematu.");
    } finally {
      setSaving(false);
    }
  };

  const editorPages = buildEditorPageOptions(pages, categories);
  const editorCategories = buildEditorCategoryOptions(categories);
  const pageTitle = isNew ? "Nowy temat" : "Edytuj temat";

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-240 pb-12">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.tematOrg)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#3730a3]"
            >
              <ArrowLeft size={16} />
              Tematy organizacyjne
            </button>
            <span className="text-[#d1d5db]">/</span>
            <span className="text-sm font-medium text-[#0f172a]">{pageTitle}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Uporządkuj informacje organizacyjne tak, aby łatwo było je odnaleźć i utrzymać aktualne.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title + date + status */}
          <section className="ui-panel p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0f172a]">Parametry tematu</h2>
              <p className="mt-1 text-xs text-[#64748b]">Data i status pomagają utrzymać porządek między aktualnymi i archiwalnymi wpisami.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div>
                <label className={labelCls}>
                  Tytuł <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Zmiana podziału obowiązków w zespole"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data tematu</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className={`${fieldCls} min-w-40`}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as OrgEntryStatus)}
                  className={`${fieldCls} min-w-35`}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Body */}
          <div>
            <label className={`${labelCls} text-[#3730a3]`}>Treść tematu organizacyjnego</label>
            <p className="mb-2 text-[11px] text-[#9ca3af]">
              Szczegółowy opis tematu widoczny po kliknięciu na liście.
            </p>
            <div className="overflow-clip rounded-xl border border-[#d9e2ec] bg-white shadow-sm">
              <RichEditor
                content={body}
                onChange={setBody}
                placeholder="Wpisz treść tematu organizacyjnego…"
                minHeight="320px"
                matrixEntries={matrix}
                sectionLinks
                pages={editorPages}
                categories={editorCategories}
                communications={communications.map((k) => ({ id: k.id, title: k.title }))}
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
            <p className="text-xs text-[#94a3b8]">Wpis będzie widoczny na liście po zapisaniu zmian.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.tematOrg)}
                className="rounded-xl border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving || !importantTopicsModule.canWrite || importantTopicsModule.isMutating}
                className="rounded-xl bg-[#3730a3] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2e2789] disabled:opacity-50"
              >
                {saving ? "Zapisywanie…" : isNew ? "Dodaj temat" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
