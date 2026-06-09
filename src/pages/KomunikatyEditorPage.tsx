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
import type { KomunikatStatus } from "@/lib/types/domain";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isBlank } from "@/lib/utils";

// ── Field style constants ─────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20";

const labelCls = "mb-1.5 block text-xs font-semibold text-[#374151]";

const STATUS_OPTIONS: Array<{ value: KomunikatStatus; label: string }> = [
  { value: "active", label: "Aktywny" },
  { value: "archived", label: "Archiwum" },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KomunikatyEditorPage() {
  const { komunikatId } = useParams<{ komunikatId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    communications,
    templates,
    matrix,
    pages,
    categories,
    communicationsModule,
  } = useData();
  const { push: pushToast } = useToast();

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  const isNew = komunikatId === "nowy";
  const existing = isNew ? null : communications.find((c) => c.id === komunikatId);
  const apiMode = communicationsModule.source === "api";

  if (!isNew && apiMode && communicationsModule.isLoading && !existing) {
    return (
      <AppShell currentUser={user}>
        <section className="mx-auto w-full max-w-240 pb-12">
          <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
            <button
              type="button"
              onClick={() => navigate(ROUTES.komunikaty)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
            >
              <ArrowLeft size={16} />
              Komunikaty
            </button>
          </header>

          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86]">
            Ładowanie komunikatu z backendu…
          </div>
        </section>
      </AppShell>
    );
  }

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.komunikaty} replace />;
  }

  // ─ Form state ─
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<KomunikatStatus>(existing?.status ?? "active");
  // Default communicationDate: existing value → today (YYYY-MM-DD)
  const todayIso = new Date().toISOString().slice(0, 10);
  const [communicationDate, setCommunicationDate] = useState(
    existing?.communicationDate ?? todayIso
  );
  const [body, setBody] = useState<TipTapDoc>(coerceTipTapDoc(existing?.body));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        status: existing?.status ?? "active",
        communicationDate: existing?.communicationDate ?? todayIso,
        body: coerceTipTapDoc(existing?.body),
      }),
    [existing?.id, todayIso],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        status,
        communicationDate,
        body,
      }),
    [title, status, communicationDate, body],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving || communicationsModule.isMutating,
  });

  // Re-initialise when navigating between entries without unmount
  useEffect(() => {
    setTitle(existing?.title ?? "");
    setStatus(existing?.status ?? "active");
    setCommunicationDate(existing?.communicationDate ?? todayIso);
    setBody(coerceTipTapDoc(existing?.body));
    setError("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [komunikatId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError("");

    if (!communicationsModule.canWrite) {
      setError(communicationsModule.error ?? "Moduł komunikatów nie jest jeszcze gotowy do zapisu.");
      return;
    }

    if (isBlank(title)) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }

    setSaving(true);

    try {
      if (isNew) {
        await communicationsModule.createCommunication({
          title: title.trim(),
          status,
          communicationDate: communicationDate || todayIso,
          body,
        });
        pushToast("success", "Komunikat został dodany.");
      } else if (existing) {
        await communicationsModule.editCommunication(existing.id, {
          title: title.trim(),
          status,
          communicationDate: communicationDate || todayIso,
          body,
        });
        pushToast("success", "Komunikat został zaktualizowany.");
      }
      allowNextNavigation();
      navigate(ROUTES.komunikaty);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać komunikatu.");
    } finally {
      setSaving(false);
    }
  };

  const editorPages = buildEditorPageOptions(pages, categories);
  const editorCategories = buildEditorCategoryOptions(categories);
  const pageTitle = isNew ? "Nowy komunikat" : "Edytuj komunikat";

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-240 pb-12">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.komunikaty)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
            >
              <ArrowLeft size={16} />
              Komunikaty
            </button>
            <span className="text-[#d1d5db]">/</span>
            <span className="text-sm font-medium text-[#0f172a]">{pageTitle}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Ustaw podstawowe parametry i przygotuj treść widoczną dla zespołu po otwarciu komunikatu.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title + date + status */}
          <section className="ui-panel p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0f172a]">Parametry komunikatu</h2>
              <p className="mt-1 text-xs text-[#64748b]">Data i status pomagają szybko odróżnić wpisy aktywne od archiwalnych.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div>
                <label className={labelCls}>
                  Tytuł <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Planowana przerwa techniczna"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Data komunikatu</label>
                <input
                  type="date"
                  value={communicationDate}
                  onChange={(e) => setCommunicationDate(e.target.value)}
                  className={`${fieldCls} min-w-40`}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as KomunikatStatus)}
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
            <label className={`${labelCls} text-[#1d4f91]`}>Treść komunikatu</label>
            <p className="mb-2 text-[11px] text-[#9ca3af]">
              Pełna treść komunikatu widoczna po kliknięciu na liście.
            </p>
            <div className="overflow-clip rounded-xl border border-[#d9e2ec] bg-white shadow-sm">
              <RichEditor
                content={body}
                onChange={setBody}
                placeholder="Wpisz treść komunikatu…"
                minHeight="320px"
                matrixEntries={matrix}
                pages={editorPages}
                categories={editorCategories}
                communications={communications.map((k) => ({ id: k.id, title: k.title }))}
                templates={templates.map((t) => ({ id: t.id, title: t.title, channel: t.channel }))}
              />
            </div>
          </div>

          {/* Error */}
          {(error || communicationsModule.error) && (
            <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-2.5 text-sm font-medium text-[#dc2626]">
              {error || communicationsModule.error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
            <p className="text-xs text-[#94a3b8]">Najpierw sprawdź datę i status, a następnie zapisz komunikat.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.komunikaty)}
                className="rounded-xl border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving || communicationsModule.isMutating || !communicationsModule.canWrite}
                className="rounded-xl bg-[#1d4f91] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:opacity-50"
              >
                {saving || communicationsModule.isMutating ? "Zapisywanie…" : isNew ? "Dodaj komunikat" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
