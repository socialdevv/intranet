import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import PersistenceStateBanner from "@/components/admin/persistence-state-banner";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";
import { PRESET_ICONS, resolveIcon } from "@/lib/utils/link-icons";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { isBlank, isValidHttpUrl, isValidInternalPath } from "@/lib/utils";

// ── Field style constants ─────────────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]";

const labelCls = "mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LinkEditorPage() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { links, linksModule } = useData();
  const { push: pushToast } = useToast();
  const {
    source,
    isLoading: isLinksLoading,
    isMutating,
    error: moduleError,
    canWrite,
    createLink,
    editLink,
    removeLink,
  } = linksModule;
  const apiMode = source === "api";

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  const isNew = linkId === "nowy";
  const existing = isNew ? null : links.find((l) => l.id === linkId);

  if (!isNew && apiMode && isLinksLoading && !existing) {
    return (
      <AppShell currentUser={user}>
        <section className="mx-auto w-full max-w-208 pb-12">
          <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.linki)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
              >
                <ArrowLeft className="size-4" />
                Linki
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86] dark:border-[#334155] dark:bg-[#1a2535] dark:text-[#9fb3cc]">
            Ładowanie linku z backendu…
          </div>
        </section>
      </AppShell>
    );
  }

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.linki} replace />;
  }

  // ─ Form state ─
  const [title, setTitle] = useState(existing?.title ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "link");
  const [customIcon, setCustomIcon] = useState(
    existing?.icon && !PRESET_ICONS.find((p) => p.value === existing.icon)
      ? existing.icon
      : ""
  );
  const [useCustomIcon, setUseCustomIcon] = useState(
    !!(existing?.icon && !PRESET_ICONS.find((p) => p.value === existing.icon))
  );
  const [openInNewTab, setOpenInNewTab] = useState(existing?.openInNewTab ?? true);
  const [isInternal, setIsInternal] = useState(existing?.isInternal ?? false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  const effectiveIcon = useCustomIcon ? (customIcon || "link") : icon;
  const pageTitle = isNew ? "Nowy link" : "Edytuj link";

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        url: existing?.url ?? "",
        description: existing?.description ?? "",
        icon: existing?.icon ?? "link",
        openInNewTab: existing?.openInNewTab ?? true,
        isInternal: existing?.isInternal ?? false,
      }),
    [existing?.id],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        url,
        description,
        icon: effectiveIcon,
        openInNewTab,
        isInternal,
      }),
    [title, url, description, effectiveIcon, openInNewTab, isInternal],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving || deleting || isMutating,
  });

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setUrl(existing?.url ?? "");
    setDescription(existing?.description ?? "");
    const hasCustom = !!(existing?.icon && !PRESET_ICONS.find((p) => p.value === existing.icon));
    setUseCustomIcon(hasCustom);
    setIcon(hasCustom ? "link" : (existing?.icon ?? "link"));
    setCustomIcon(hasCustom ? (existing?.icon ?? "") : "");
    setOpenInNewTab(existing?.openInNewTab ?? true);
    setIsInternal(existing?.isInternal ?? false);
    setError("");
    setConfirmDelete(false);
  }, [linkId, existing?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || deleting || isMutating) return;
    setError("");

    if (apiMode && !canWrite) {
      setError(moduleError ?? "Backend link module is not ready for write actions yet.");
      return;
    }

    const normalizedTitle = title.trim();
    const normalizedUrl = url.trim();
    const normalizedDescription = description.trim();

    if (isBlank(normalizedTitle)) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }
    if (isBlank(normalizedUrl)) {
      setError("Pole „URL” jest wymagane.");
      return;
    }
    if (isInternal) {
      if (!isValidInternalPath(normalizedUrl)) {
        setError("Link wewnętrzny musi zaczynać się od „/” i nie może zawierać spacji.");
        return;
      }
    } else if (!isValidHttpUrl(normalizedUrl)) {
      setError("Dla linku zewnętrznego podaj pełny adres URL zaczynający się od http:// lub https://.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: normalizedTitle,
        url: normalizedUrl,
        description: normalizedDescription,
        icon: effectiveIcon,
        openInNewTab,
        isInternal,
      };
      if (isNew) {
        await createLink(payload);
        pushToast("success", source === "api" ? "Link został zapisany w backendzie." : "Link został dodany.");
      } else if (existing) {
        await editLink(existing.id, payload);
        pushToast("success", source === "api" ? "Link został zaktualizowany w backendzie." : "Link został zaktualizowany.");
      }
      allowNextNavigation();
      navigate(ROUTES.linki);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać linku.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }

    if (apiMode && !canWrite) {
      setError(moduleError ?? "Backend link module is not ready for write actions yet.");
      return;
    }

    setDeleting(true);
    try {
      await removeLink(linkId!);
      pushToast("success", source === "api" ? "Link został usunięty z backendu." : "Link został usunięty.");
      allowNextNavigation();
      navigate(ROUTES.linki);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się usunąć linku.");
    } finally {
      setDeleting(false);
    }
  };

  const actionsDisabled = saving || deleting || isMutating || (apiMode && !canWrite);

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-208 pb-12">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.linki)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
            >
              <ArrowLeft className="size-4" />
              Linki
            </button>
            <span className="text-[#d1d5db]">/</span>
            <span className="text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">{pageTitle}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Skonfiguruj docelowy adres i sposób otwierania linku, aby użytkownicy trafiali we właściwe miejsce.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        {apiMode && (
          <div className="mb-5 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[#1d4f91] dark:border-[#1e3a8a] dark:bg-[#0f1b3a] dark:text-[#bfdbfe]">
            {canWrite
              ? "Tryb development API jest aktywny. Ten formularz zapisuje link bezpośrednio w backendzie projektu."
              : moduleError ?? "Tryb development API jest aktywny, ale backend linków nie jest jeszcze gotowy do zapisu."}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <section className="ui-panel p-5">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Podstawowe informacje</h2>
              <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                Te pola określają nazwę, docelowy adres i opis linku na liście.
              </p>
            </div>

            {/* Title */}
            <div>
              <label className={labelCls}>Tytuł *</label>
              <input
                className={fieldCls}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="np. Portal wewnętrzny, Intranet, Helpdesk…"
              />
            </div>

            {/* URL */}
            <div className="mt-4">
              <label className={labelCls}>URL *</label>
              <input
                className={fieldCls}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={isInternal ? "np. /baza-wiedzy" : "https://…"}
              />
              <p className="mt-1 text-xs text-[#94a3b8]">
                {isInternal
                  ? "Wpisz ścieżkę wewnętrzną, np. /baza-wiedzy lub /macierz."
                  : "Wpisz pełny adres URL z protokołem (https://)."}
              </p>
            </div>

            {/* Description */}
            <div className="mt-4">
              <label className={labelCls}>Opis (opcjonalny)</label>
              <input
                className={fieldCls}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Krótki opis widoczny na liście linków…"
                maxLength={160}
              />
            </div>
          </section>

          {/* Icon */}
          <div>
            <label className={labelCls}>Ikona</label>
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUseCustomIcon(false)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    !useCustomIcon
                      ? "border-[#1d4f91] bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f]"
                      : "border-[#d9e2ec] bg-white text-[#64748b] hover:border-[#94a3b8] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8]",
                  ].join(" ")}
                >
                  Predefiniowana
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomIcon(true)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                    useCustomIcon
                      ? "border-[#1d4f91] bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f]"
                      : "border-[#d9e2ec] bg-white text-[#64748b] hover:border-[#94a3b8] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8]",
                  ].join(" ")}
                >
                  Własna (emoji / tekst)
                </button>
              </div>

              {!useCustomIcon ? (
                /* Visual icon grid */
                <div className="rounded-xl border border-[#d9e2ec] bg-white p-3 dark:border-[#334155] dark:bg-[#1e293b]">
                  <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                    {PRESET_ICONS.map((p) => {
                      const selected = icon === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          title={p.label}
                          onClick={() => setIcon(p.value)}
                          className={[
                            "group flex flex-col items-center gap-1 rounded-lg p-2 transition",
                            selected
                              ? "bg-[#edf3fa] ring-2 ring-[#1d4f91] dark:bg-[#1e3a5f] dark:ring-[#3b82f6]"
                              : "hover:bg-[#f1f5f9] dark:hover:bg-[#263347]",
                          ].join(" ")}
                        >
                          <span className={[
                            "flex h-7 w-7 items-center justify-center",
                            selected
                              ? "text-[#1d4f91] dark:text-[#93c5fd]"
                              : "text-[#64748b] group-hover:text-[#1d4f91] dark:text-[#94a3b8] dark:group-hover:text-[#93c5fd]",
                          ].join(" ")}>
                            {resolveIcon(p.value)}
                          </span>
                          <span className={[
                            "w-full truncate text-center text-[9px] leading-tight",
                            selected ? "font-semibold text-[#1d4f91] dark:text-[#93c5fd]" : "text-[#94a3b8]",
                          ].join(" ")}>
                            {p.label.split(" ")[0]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {/* Selected preview label */}
                  <div className="mt-2.5 flex items-center gap-2 border-t border-[#edf1f5] pt-2.5 dark:border-[#334155]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
                      {resolveIcon(icon)}
                    </div>
                    <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                      Wybrana: <strong className="text-[#374151] dark:text-[#cbd5e1]">{PRESET_ICONS.find(p => p.value === icon)?.label ?? icon}</strong>
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
                    {resolveIcon(effectiveIcon)}
                  </div>
                  <input
                    className={fieldCls}
                    value={customIcon}
                    onChange={(e) => setCustomIcon(e.target.value)}
                    placeholder="np. 🔗 lub ⭐ lub 2–4 znaki"
                    maxLength={8}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Link behaviour */}
          <div className="rounded-xl border border-[#e5edf5] bg-[#f8fafc] p-4 dark:border-[#334155] dark:bg-[#1a2535]">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#64748b]">
              Zachowanie linku
            </p>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => {
                  setIsInternal(e.target.checked);
                  if (e.target.checked) setOpenInNewTab(false);
                  else setOpenInNewTab(true);
                }}
                className="h-4 w-4 rounded border-[#d1d5db] text-[#1d4f91] focus:ring-[#1d4f91]/30"
              />
              <span className="text-sm text-[#374151] dark:text-[#cbd5e1]">
                Link wewnętrzny (ścieżka w aplikacji)
              </span>
            </label>
            {!isInternal && (
              <label className="mt-2 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={openInNewTab}
                  onChange={(e) => setOpenInNewTab(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d1d5db] text-[#1d4f91] focus:ring-[#1d4f91]/30"
                />
                <span className="text-sm text-[#374151] dark:text-[#cbd5e1]">
                  Otwieraj w nowej karcie (domyślnie włączone)
                </span>
              </label>
            )}
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-lg bg-[#fef2f2] px-3 py-2 text-sm text-[#ef4444]">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-[#e5e7eb] pt-4">
            <div>
              {!isNew && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || isMutating || (apiMode && !canWrite)}
                  className={[
                    "rounded-lg px-4 py-2.5 text-sm font-medium transition",
                    confirmDelete
                      ? "bg-[#ef4444] text-white hover:bg-[#dc2626]"
                      : "border border-[#fca5a5] text-[#ef4444] hover:bg-[#fef2f2]",
                  ].join(" ")}
                >
                  {deleting ? "Usuwanie…" : confirmDelete ? "Potwierdź usunięcie" : "Usuń link"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(ROUTES.linki)}
                className="rounded-lg border border-[#d9e2ec] px-4 py-2.5 text-sm font-medium text-[#64748b] transition hover:border-[#94a3b8] dark:border-[#334155] dark:text-[#94a3b8]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={actionsDisabled}
                className="rounded-lg bg-[#1d4f91] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#1a4580] disabled:opacity-60"
              >
                {saving || isMutating ? "Zapisywanie…" : isNew ? "Dodaj link" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
