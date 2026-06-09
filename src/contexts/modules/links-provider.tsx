import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LinkItem } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
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
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type LinksModuleState = {
  source: ModuleDataSource;
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
    if (!deps.apiMode) {
      setApiLinks(null);
      setIsLinksLoading(false);
      setIsLinksMutating(false);
      setLinksError(null);
      return;
    }

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
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedLinks = useMemo<LinkItem[]>(
    () =>
      deps.apiMode
        ? apiLinks ?? ((deps.legacyData.links ?? []) as LinkItem[])
        : ((deps.legacyData.links ?? []) as LinkItem[]),
    [apiLinks, deps.apiMode, deps.legacyData.links]
  );

  const addLink = useCallback(
    (link: Omit<LinkItem, "id"> & { id?: string }): LinkItem => {
      const links = deps.legacyData.links ?? [];
      const maxOrder = links.reduce((mx: number, l: LinkItem) => Math.max(mx, l.sortOrder), -1);
      const full: LinkItem = {
        ...link,
        id: link.id ?? generateId("link"),
        sortOrder: link.sortOrder ?? maxOrder + 1,
      };
      deps.setLegacyData({ ...deps.legacyData, links: [...links, full] });
      return full;
    },
    [deps]
  );

  const updateLink = useCallback(
    (updated: LinkItem): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        links: (deps.legacyData.links ?? []).map((l: LinkItem) => (l.id === updated.id ? updated : l)),
      });
    },
    [deps]
  );

  const deleteLink = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        links: (deps.legacyData.links ?? []).filter((l: LinkItem) => l.id !== id),
      });
    },
    [deps]
  );

  const reorderLinks = useCallback(
    (orderedItems: LinkItem[]): void => {
      const updated = (deps.legacyData.links ?? []).map((l: LinkItem) => {
        const idx = orderedItems.findIndex((o) => o.id === l.id);
        return idx === -1 ? l : { ...l, sortOrder: idx };
      });
      deps.setLegacyData({ ...deps.legacyData, links: updated });
    },
    [deps]
  );

  const createManagedLink = useCallback(
    async (input: CreateProjectLinkInput): Promise<void> => {
      if (!deps.apiMode) {
        addLink({
          title: input.title,
          url: input.url,
          description: input.description,
          icon: input.icon,
          sortOrder: resolvedLinks.length,
          openInNewTab: input.isInternal ? false : input.openInNewTab,
          isInternal: input.isInternal,
        });
        return;
      }

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
    [addLink, apiLinks, deps.activeProjectSlug, deps.apiMode, resolvedLinks.length]
  );

  const editManagedLink = useCallback(
    async (id: string, input: UpdateProjectLinkInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedLinks.find((link) => link.id === id);

        if (!existing) {
          throw new Error("Link nie został znaleziony.");
        }

        const nextIsInternal = input.isInternal ?? existing.isInternal;

        updateLink({
          ...existing,
          title: input.title ?? existing.title,
          url: input.url ?? existing.url,
          description: input.description ?? existing.description,
          icon: input.icon ?? existing.icon,
          openInNewTab: nextIsInternal ? false : (input.openInNewTab ?? existing.openInNewTab),
          isInternal: nextIsInternal,
        });
        return;
      }

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
    [apiLinks, deps.activeProjectSlug, deps.apiMode, resolvedLinks, updateLink]
  );

  const removeManagedLink = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteLink(id);
        return;
      }

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
    [apiLinks, deleteLink, deps.activeProjectSlug, deps.apiMode]
  );

  const reorderManagedLinks = useCallback(
    (orderedItems: LinkItem[]): void => {
      if (!deps.apiMode) {
        reorderLinks(orderedItems);
        return;
      }

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
    [apiLinks, deps.activeProjectSlug, deps.apiMode, reorderLinks]
  );

  const linksModule = useMemo<LinksModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isLinksLoading,
      isMutating: isLinksMutating,
      error: linksError,
      canWrite: !deps.apiMode || apiLinks !== null,
      canReorder: !deps.apiMode || apiLinks !== null,
      createLink: createManagedLink,
      editLink: editManagedLink,
      removeLink: removeManagedLink,
      reorderLinks: reorderManagedLinks,
    }),
    [
      apiLinks,
      createManagedLink,
      deps.apiMode,
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
