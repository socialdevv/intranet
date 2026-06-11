import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LinkItem } from "@/lib/types/domain";
import {
  adaptProjectLinkToLinkItem,
  adaptProjectLinksToLinkItems,
  createProjectLink,
  deleteProjectLink,
  fetchProjectLinks,
  reorderProjectLinks,
  updateProjectLink,
  type CreateProjectLinkInput,
  type UpdateProjectLinkInput,
} from "@/lib/api/project-links";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type LinksModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  createLink: (input: CreateProjectLinkInput) => Promise<void>;
  editLink: (id: string, input: UpdateProjectLinkInput) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  reorderLinks: (orderedItems: LinkItem[]) => void;
};

type LinksContextValue = {
  links: LinkItem[];
  addLink: (link: Omit<LinkItem, "id"> & { id?: string }) => LinkItem;
  updateLink: (updated: LinkItem) => void;
  deleteLink: (id: string) => void;
  reorderLinks: (orderedItems: LinkItem[]) => void;
  linksModule: LinksModuleState;
};

const LinksModuleContext = createContext<LinksContextValue | null>(null);

function sortLinks(items: LinkItem[]): LinkItem[] {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title));
}

export function LinksProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiLinks, setApiLinks] = useState<LinkItem[] | null>(null);
  const [isLinksLoading, setIsLinksLoading] = useState(false);
  const [isLinksMutating, setIsLinksMutating] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsLinksLoading(true);
    setLinksError(null);

    void (async () => {
      try {
        const payload = await fetchProjectLinks(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiLinks(sortLinks(adaptProjectLinksToLinkItems(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiLinks(null);
        setLinksError(caught instanceof Error ? caught.message : "Nie udało się załadować linków z backendu.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLinksLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedLinks = useMemo<LinkItem[]>(() => apiLinks ?? [], [apiLinks]);

  const addLink = useCallback((_link: Omit<LinkItem, "id"> & { id?: string }): LinkItem => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const updateLink = useCallback((_updated: LinkItem): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteLink = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderLinks = useCallback((_orderedItems: LinkItem[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedLink = useCallback(
    async (input: CreateProjectLinkInput): Promise<void> => {
      if (apiLinks === null) {
        throw new Error("Backend links are not ready yet.");
      }

      setIsLinksMutating(true);
      setLinksError(null);

      try {
        const payload = await createProjectLink(deps.activeProjectSlug, input);
        setApiLinks(sortLinks([...apiLinks, adaptProjectLinkToLinkItem(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać linku.";
        setLinksError(message);
        throw new Error(message);
      } finally {
        setIsLinksMutating(false);
      }
    },
    [apiLinks, deps.activeProjectSlug]
  );

  const editManagedLink = useCallback(
    async (id: string, input: UpdateProjectLinkInput): Promise<void> => {
      if (apiLinks === null) {
        throw new Error("Backend links are not ready yet.");
      }

      setIsLinksMutating(true);
      setLinksError(null);

      try {
        const payload = await updateProjectLink(deps.activeProjectSlug, id, input);
        setApiLinks(
          sortLinks(apiLinks.map((link: LinkItem) => (link.id === id ? adaptProjectLinkToLinkItem(payload.data.item) : link)))
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować linku.";
        setLinksError(message);
        throw new Error(message);
      } finally {
        setIsLinksMutating(false);
      }
    },
    [apiLinks, deps.activeProjectSlug]
  );

  const removeManagedLink = useCallback(
    async (id: string): Promise<void> => {
      if (apiLinks === null) {
        throw new Error("Backend links are not ready yet.");
      }

      setIsLinksMutating(true);
      setLinksError(null);

      try {
        await deleteProjectLink(deps.activeProjectSlug, id);
        setApiLinks(apiLinks.filter((link) => link.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć linku.";
        setLinksError(message);
        throw new Error(message);
      } finally {
        setIsLinksMutating(false);
      }
    },
    [apiLinks, deps.activeProjectSlug]
  );

  const reorderManagedLinks = useCallback(
    (orderedItems: LinkItem[]): void => {
      if (apiLinks === null) {
        setLinksError("Backend links are not ready yet.");
        return;
      }

      const previousItems = apiLinks;
      const nextItems = sortLinks(orderedItems.map((item, index) => ({ ...item, sortOrder: index })));

      setIsLinksMutating(true);
      setLinksError(null);
      setApiLinks(nextItems);

      void (async () => {
        try {
          const payload = await reorderProjectLinks(
            deps.activeProjectSlug,
            orderedItems.map((item) => item.id)
          );
          setApiLinks(sortLinks(adaptProjectLinksToLinkItems(payload)));
        } catch (caught) {
          const message = caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności linków.";
          setApiLinks(previousItems);
          setLinksError(message);
        } finally {
          setIsLinksMutating(false);
        }
      })();
    },
    [apiLinks, deps.activeProjectSlug]
  );

  const linksModule = useMemo<LinksModuleState>(
    () => ({
      source: "api",
      isLoading: isLinksLoading,
      isMutating: isLinksMutating,
      error: linksError,
      canWrite: apiLinks !== null,
      canReorder: apiLinks !== null,
      createLink: createManagedLink,
      editLink: editManagedLink,
      removeLink: removeManagedLink,
      reorderLinks: reorderManagedLinks,
    }),
    [
      apiLinks,
      createManagedLink,
      editManagedLink,
      isLinksLoading,
      isLinksMutating,
      linksError,
      removeManagedLink,
      reorderManagedLinks,
    ]
  );

  const value = useMemo<LinksContextValue>(
    () => ({
      links: resolvedLinks,
      addLink,
      updateLink,
      deleteLink,
      reorderLinks,
      linksModule,
    }),
    [addLink, deleteLink, linksModule, reorderLinks, resolvedLinks, updateLink]
  );

  return <LinksModuleContext.Provider value={value}>{children}</LinksModuleContext.Provider>;
}

export function useLinksModule(): LinksContextValue {
  const context = useContext(LinksModuleContext);

  if (!context) {
    throw new Error("useLinksModule must be used inside LinksProvider");
  }

  return context;
}
