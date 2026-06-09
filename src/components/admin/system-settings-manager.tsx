import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, LockKeyhole, ServerCog } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { isSuperAdminRole } from "@/lib/access/project-access";
import { replaceProjectRouteSlug } from "@/lib/routes";

type MetadataDraft = {
  slug: string;
  code: string;
  name: string;
};

function buildLegacyDraft(systemSettings: ReturnType<typeof useData>["systemSettings"]): MetadataDraft {
  return {
    slug: "",
    code: systemSettings.deployment?.projectCode ?? "",
    name: systemSettings.deployment?.projectDisplayName ?? "",
  };
}

export default function SystemSettingsManager() {
  const {
    platformBootstrapState,
    projectBootstrapState,
    systemSettings,
    updateProjectMetadata,
  } = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const isApiMode = projectBootstrapState.mode === "api";
  const apiProject = projectBootstrapState.status === "ready" ? projectBootstrapState.preview.project : null;
  const canEditApiMetadata =
    projectBootstrapState.status === "ready" &&
    platformBootstrapState.status === "ready" &&
    isSuperAdminRole(platformBootstrapState.preview.currentUser.globalRole);

  const baseline = useMemo<MetadataDraft>(() => {
    if (apiProject) {
      return {
        slug: apiProject.slug,
        code: apiProject.code,
        name: apiProject.name,
      };
    }

    return buildLegacyDraft(systemSettings);
  }, [apiProject, systemSettings]);

  const [draft, setDraft] = useState<MetadataDraft>(baseline);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(baseline);
    setStatus("idle");
    setError("");
  }, [baseline]);

  const canEdit = isApiMode ? canEditApiMetadata : true;
  const isDirty =
    draft.slug.trim() !== baseline.slug ||
    draft.code.trim() !== baseline.code ||
    draft.name.trim() !== baseline.name;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    setStatus("saving");
    setError("");

    try {
      const updatedProject = await updateProjectMetadata({
        slug: draft.slug,
        code: draft.code,
        name: draft.name,
      });

      if (isApiMode && baseline.slug !== updatedProject.slug) {
        navigate(
          replaceProjectRouteSlug(
            `${location.pathname}${location.search}${location.hash}`,
            updatedProject.slug
          ),
          { replace: true }
        );
      }

      setStatus("saved");
    } catch (caught) {
      setStatus("idle");
      setError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się zapisać metadanych projektu."
      );
    }
  }

  if (isApiMode && projectBootstrapState.status === "loading") {
    return (
      <div className="ui-panel p-5">
        <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          Projekt
        </h2>
        <p className="mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
          Trwa ładowanie danych projektu…
        </p>
      </div>
    );
  }

  if (isApiMode && projectBootstrapState.status === "failed") {
    return (
      <div className="ui-panel p-5">
        <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          Projekt
        </h2>
        <p className="mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
          Nie udało się pobrać danych projektu: {projectBootstrapState.error}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <form onSubmit={handleSubmit} className="ui-panel p-5">
        <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          Identyfikacja projektu
        </h2>
        <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
          Kod i nazwa projektu są widoczne w nawigacji i katalogu projektów.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Slug projektu
            </span>
            <input
              type="text"
              value={isApiMode ? draft.slug : "niedostępny w trybie lokalnym"}
              onChange={(event) => {
                setDraft((current) => ({ ...current, slug: event.target.value }));
                setStatus("idle");
                setError("");
              }}
              readOnly={!isApiMode}
              disabled={!isApiMode || !canEdit || status === "saving"}
              placeholder="np. projekt-alfa"
              className="ui-input disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Kod projektu
            </span>
            <input
              type="text"
              value={draft.code}
              onChange={(event) => {
                setDraft((current) => ({ ...current, code: event.target.value }));
                setStatus("idle");
                setError("");
              }}
              disabled={!canEdit || status === "saving"}
              placeholder="np. ALFA-REG"
              className="ui-input disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-[#64748b] dark:text-[#94a3b8]">
              Nazwa projektu
            </span>
            <input
              type="text"
              value={draft.name}
              onChange={(event) => {
                setDraft((current) => ({ ...current, name: event.target.value }));
                setStatus("idle");
                setError("");
              }}
              disabled={!canEdit || status === "saving"}
              placeholder="np. Projekt Alfa — Dział Obsługi"
              className="ui-input disabled:cursor-not-allowed disabled:opacity-70"
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-3 text-xs leading-relaxed text-[#5f6f86] dark:border-[#223147] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
          {isApiMode ? (
            canEdit ? (
              <p>
                Zmiany zapisują się od razu. Przy zmianie slugu adres projektu zostanie zaktualizowany.
              </p>
            ) : (
              <p>
                Te pola są zarządzane centralnie. W projekcie mogą je edytować wyłącznie użytkownicy z rolą Super Admin.
              </p>
            )
          ) : (
            <p>
              W trybie lokalnym pola są przechowywane w lokalnych metadanych wdrożenia.
            </p>
          )}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1111] dark:text-[#fca5a5]">
            {error}
          </div>
        ) : null}

        {status === "saved" ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-medium text-[#166534] dark:border-[#14532d] dark:bg-[#0f2416] dark:text-[#86efac]">
            <CheckCircle2 size={14} />
            Metadane projektu zostały zapisane.
          </div>
        ) : null}

        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={!canEdit || !isDirty || status === "saving"}
            className="ui-btn disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === "saving" ? "Zapisywanie…" : "Zapisz zmiany"}
          </button>
          {!canEdit && isApiMode ? (
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Tryb tylko do odczytu dla bieżącej roli.
            </span>
          ) : null}
        </div>
      </form>

      <aside className="ui-panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <ServerCog size={15} className="text-[#64748b] dark:text-[#94a3b8]" />
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Zakres zmian
          </h3>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
          <p>
            Slug określa adres URL projektu — edycja wymaga roli Super Admin.
          </p>
          <p>
            Kod i nazwa wpływają na branding projektu oraz identyfikację w katalogu projektów.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-3 text-xs text-[#475569] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
          <div className="flex items-center gap-2 font-medium">
            <LockKeyhole size={13} />
            {isApiMode
              ? canEdit
                ? "Uprawnienia: Super Admin"
                : "Uprawnienia: tylko odczyt"
              : "Źródło: lokalne metadane"}
          </div>
          {apiProject ? (
            <p className="mt-2 text-[11px] leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
              Aktualny projekt: {apiProject.name} ({apiProject.code})
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}