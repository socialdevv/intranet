import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { HomeQuickLink } from "@/lib/types/domain";
import {
  adaptProjectQuickLinksToHomeQuickLinks,
  adaptProjectQuickLinkToHomeQuickLink,
  createProjectQuickLink,
  deleteProjectQuickLink,
  fetchProjectQuickLinks,
  reorderProjectQuickLinks,
  updateProjectQuickLink,
  type CreateProjectQuickLinkInput,
  type UpdateProjectQuickLinkInput,
} from "@/lib/api/project-quick-links";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type QuickLinksModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  addQuickLink: (input: CreateProjectQuickLinkInput) => Promise<void>;
  editQuickLink: (id: string, input: UpdateProjectQuickLinkInput) => Promise<void>;
  removeQuickLink: (id: string) => Promise<void>;
  reorderQuickLinks: (orderedItems: HomeQuickLink[]) => void;
};

type QuickLinksContextValue = {
  homeQuickLinks: HomeQuickLink[];
  setHomeQuickLinks: (items: HomeQuickLink[]) => void;
  quickLinksModule: QuickLinksModuleState;
};

const QuickLinksModuleContext = createContext<QuickLinksContextValue | null>(null);

function sortQuickLinks(items: HomeQuickLink[]): HomeQuickLink[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder);
}

export function QuickLinksProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiHomeQuickLinks, setApiHomeQuickLinks] = useState<HomeQuickLink[] | null>(null);
  const [isHomeQuickLinksLoading, setIsHomeQuickLinksLoading] = useState(false);
  const [isHomeQuickLinksMutating, setIsHomeQuickLinksMutating] = useState(false);
  const [homeQuickLinksError, setHomeQuickLinksError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsHomeQuickLinksLoading(true);
    setHomeQuickLinksError(null);

    void (async () => {
      try {
        const payload = await fetchProjectQuickLinks(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiHomeQuickLinks(sortQuickLinks(adaptProjectQuickLinksToHomeQuickLinks(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiHomeQuickLinks(null);
        setHomeQuickLinksError(
          caught instanceof Error ? caught.message : "Nie udało się załadować szybkich linków z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsHomeQuickLinksLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedHomeQuickLinks = useMemo<HomeQuickLink[]>(() => apiHomeQuickLinks ?? [], [apiHomeQuickLinks]);

  const setHomeQuickLinks = useCallback((_items: HomeQuickLink[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const addQuickLink = useCallback(
    async (input: CreateProjectQuickLinkInput): Promise<void> => {
      if (apiHomeQuickLinks === null) {
        throw new Error("Backend quick links are not ready yet.");
      }

      setIsHomeQuickLinksMutating(true);
      setHomeQuickLinksError(null);

      try {
        const payload = await createProjectQuickLink(deps.activeProjectSlug, input);
        setApiHomeQuickLinks(
          sortQuickLinks([...apiHomeQuickLinks, adaptProjectQuickLinkToHomeQuickLink(payload.data.item)])
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać szybkiego linku.";
        setHomeQuickLinksError(message);
        throw new Error(message);
      } finally {
        setIsHomeQuickLinksMutating(false);
      }
    },
    [apiHomeQuickLinks, deps.activeProjectSlug]
  );

  const editQuickLink = useCallback(
    async (id: string, input: UpdateProjectQuickLinkInput): Promise<void> => {
      if (apiHomeQuickLinks === null) {
        throw new Error("Backend quick links are not ready yet.");
      }

      setIsHomeQuickLinksMutating(true);
      setHomeQuickLinksError(null);

      try {
        const payload = await updateProjectQuickLink(deps.activeProjectSlug, id, input);
        setApiHomeQuickLinks(
          sortQuickLinks(
            apiHomeQuickLinks.map((link) =>
              link.id === id ? adaptProjectQuickLinkToHomeQuickLink(payload.data.item) : link
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować szybkiego linku.";
        setHomeQuickLinksError(message);
        throw new Error(message);
      } finally {
        setIsHomeQuickLinksMutating(false);
      }
    },
    [apiHomeQuickLinks, deps.activeProjectSlug]
  );

  const removeQuickLink = useCallback(
    async (id: string): Promise<void> => {
      if (apiHomeQuickLinks === null) {
        throw new Error("Backend quick links are not ready yet.");
      }

      setIsHomeQuickLinksMutating(true);
      setHomeQuickLinksError(null);

      try {
        await deleteProjectQuickLink(deps.activeProjectSlug, id);
        setApiHomeQuickLinks(apiHomeQuickLinks.filter((link) => link.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć szybkiego linku.";
        setHomeQuickLinksError(message);
        throw new Error(message);
      } finally {
        setIsHomeQuickLinksMutating(false);
      }
    },
    [apiHomeQuickLinks, deps.activeProjectSlug]
  );

  const reorderManagedQuickLinks = useCallback(
    (orderedItems: HomeQuickLink[]): void => {
      if (apiHomeQuickLinks === null) {
        setHomeQuickLinksError("Backend quick links are not ready yet.");
        return;
      }

      const previousItems = apiHomeQuickLinks;
      const nextItems = sortQuickLinks(orderedItems.map((link, index) => ({ ...link, sortOrder: index })));

      setIsHomeQuickLinksMutating(true);
      setHomeQuickLinksError(null);
      setApiHomeQuickLinks(nextItems);

      void (async () => {
        try {
          const payload = await reorderProjectQuickLinks(
            deps.activeProjectSlug,
            orderedItems.map((link) => link.id)
          );
          setApiHomeQuickLinks(sortQuickLinks(adaptProjectQuickLinksToHomeQuickLinks(payload)));
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności szybkich linków.";
          setApiHomeQuickLinks(previousItems);
          setHomeQuickLinksError(message);
        } finally {
          setIsHomeQuickLinksMutating(false);
        }
      })();
    },
    [apiHomeQuickLinks, deps.activeProjectSlug]
  );

  const quickLinksModule = useMemo<QuickLinksModuleState>(
    () => ({
      source: "api",
      isLoading: isHomeQuickLinksLoading,
      isMutating: isHomeQuickLinksMutating,
      error: homeQuickLinksError,
      canWrite: apiHomeQuickLinks !== null,
      canReorder: apiHomeQuickLinks !== null,
      addQuickLink,
      editQuickLink,
      removeQuickLink,
      reorderQuickLinks: reorderManagedQuickLinks,
    }),
    [
      addQuickLink,
      apiHomeQuickLinks,
      editQuickLink,
      homeQuickLinksError,
      isHomeQuickLinksLoading,
      isHomeQuickLinksMutating,
      removeQuickLink,
      reorderManagedQuickLinks,
    ]
  );

  const value = useMemo<QuickLinksContextValue>(
    () => ({
      homeQuickLinks: resolvedHomeQuickLinks,
      setHomeQuickLinks,
      quickLinksModule,
    }),
    [quickLinksModule, resolvedHomeQuickLinks, setHomeQuickLinks]
  );

  return <QuickLinksModuleContext.Provider value={value}>{children}</QuickLinksModuleContext.Provider>;
}

export function useQuickLinksModule(): QuickLinksContextValue {
  const context = useContext(QuickLinksModuleContext);

  if (!context) {
    throw new Error("useQuickLinksModule must be used inside QuickLinksProvider");
  }

  return context;
}
