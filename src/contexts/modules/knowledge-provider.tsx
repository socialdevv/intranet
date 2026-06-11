import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CategoryNode, KnowledgeCategoryEntry, KnowledgePage } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
import {
  adaptProjectKnowledgeArticle,
  adaptProjectKnowledgeArticles,
  adaptProjectKnowledgeCategory,
  adaptProjectKnowledgeCategories,
  createProjectKnowledgeArticle,
  createProjectKnowledgeCategory,
  deleteProjectKnowledgeArticle,
  deleteProjectKnowledgeCategory,
  fetchProjectKnowledgeArticles,
  fetchProjectKnowledgeCategories,
  reorderProjectKnowledgeArticles,
  reorderProjectKnowledgeCategories,
  updateProjectKnowledgeArticle,
  updateProjectKnowledgeCategory,
  type CreateProjectKnowledgeArticleInput,
} from "@/lib/api/project-knowledge";
import { useToast } from "@/contexts/toast-context";
import type { ProjectModuleDeps } from "./shared-module-types";

const EMPTY_KNOWLEDGE_JSON_DOC: Record<string, unknown> = {
  type: "doc",
  content: [],
};

function toProjectKnowledgeSections(
  sections: KnowledgePage["sections"]
): CreateProjectKnowledgeArticleInput["sections"] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    collapsible: section.collapsible ?? false,
    showSeparator: section.showSeparator !== false,
    tags: section.tags ?? [],
    jsonContent:
      section.jsonContent &&
      typeof section.jsonContent === "object" &&
      !Array.isArray(section.jsonContent)
        ? (section.jsonContent as Record<string, unknown>)
        : EMPTY_KNOWLEDGE_JSON_DOC,
  }));
}

function syncPagesWithUpdatedCategory(
  pages: KnowledgePage[],
  category: KnowledgeCategoryEntry
): KnowledgePage[] {
  return pages.map((page) =>
    page.categoryId === category.id
      ? {
          ...page,
          category: category.slug,
          categoryDisplayName: category.name,
        }
      : page
  );
}

function buildCategoryTree(
  categories: KnowledgeCategoryEntry[],
  pages: KnowledgePage[]
): CategoryNode[] {
  function buildNode(cat: KnowledgeCategoryEntry): CategoryNode {
    const children = categories
      .filter((c) => c.parentId === cat.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(buildNode);

    const articles = pages
      .filter((p) => p.categoryId === cat.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        categorySlug: cat.slug,
      }));

    return {
      id: cat.id,
      slug: cat.slug,
      name: cat.name,
      parentId: cat.parentId,
      childOrder: cat.childOrder,
      articles,
      children,
    };
  }

  return categories
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(buildNode);
}

export type KnowledgeContextValue = {
  categories: KnowledgeCategoryEntry[];
  pages: KnowledgePage[];
  categoryTree: CategoryNode[];
  isKnowledgeLoading: boolean;
  knowledgeError: string | null;
  contributesToAppLoading: boolean;
  addCategory: (
    cat: Omit<KnowledgeCategoryEntry, "id"> & { id?: string }
  ) => Promise<KnowledgeCategoryEntry>;
  updateCategory: (updated: KnowledgeCategoryEntry) => Promise<void>;
  deleteCategory: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  addPage: (page: Omit<KnowledgePage, "id"> & { id?: string }) => Promise<KnowledgePage>;
  updatePage: (updated: KnowledgePage) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  reorderCategories: (
    parentId: string | null,
    orderedItems: KnowledgeCategoryEntry[]
  ) => void | Promise<void>;
  reorderPages: (categoryId: string, orderedItems: KnowledgePage[]) => void | Promise<void>;
  reorderCategoryChildren: (categoryId: string, orderedIds: string[]) => void | Promise<void>;
};

const KnowledgeModuleContext = createContext<KnowledgeContextValue | null>(null);

export function KnowledgeProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const { push: toast } = useToast();
  const [apiKnowledgeCategories, setApiKnowledgeCategories] = useState<KnowledgeCategoryEntry[] | null>(
    null
  );
  const [apiKnowledgePages, setApiKnowledgePages] = useState<KnowledgePage[] | null>(null);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsKnowledgeLoading(true);
    setKnowledgeError(null);

    void (async () => {
      try {
        const [categoriesPayload, pagesPayload] = await Promise.all([
          fetchProjectKnowledgeCategories(deps.activeProjectSlug, controller.signal),
          fetchProjectKnowledgeArticles(deps.activeProjectSlug, controller.signal),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setApiKnowledgeCategories(adaptProjectKnowledgeCategories(categoriesPayload));
        setApiKnowledgePages(adaptProjectKnowledgeArticles(pagesPayload));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiKnowledgeCategories(null);
        setApiKnowledgePages(null);
        setKnowledgeError(
          caught instanceof Error
            ? caught.message
            : "Nie udało się załadować bazy wiedzy z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsKnowledgeLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const categories = useMemo<KnowledgeCategoryEntry[]>(
    () => apiKnowledgeCategories ?? [],
    [apiKnowledgeCategories]
  );

  const pages = useMemo<KnowledgePage[]>(() => apiKnowledgePages ?? [], [apiKnowledgePages]);

  const categoryTree = useMemo(
    () => buildCategoryTree(categories, pages),
    [categories, pages]
  );

  const contributesToAppLoading = useMemo(
    () =>
      isKnowledgeLoading &&
      (apiKnowledgeCategories === null || apiKnowledgePages === null),
    [apiKnowledgeCategories, apiKnowledgePages, isKnowledgeLoading]
  );

  const addCategory = useCallback(
    async (cat: Omit<KnowledgeCategoryEntry, "id"> & { id?: string }): Promise<KnowledgeCategoryEntry> => {
      if (apiKnowledgeCategories === null) {
        throw new Error("Backend categories are not ready yet.");
      }

      setKnowledgeError(null);

      try {
        const payload = await createProjectKnowledgeCategory(deps.activeProjectSlug, {
          ...cat,
          id: cat.id ?? generateId("cat"),
        });
        const created = adaptProjectKnowledgeCategory(payload.data.item);
        setApiKnowledgeCategories([...apiKnowledgeCategories, created]);
        return created;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się dodać kategorii bazy wiedzy.";
        setKnowledgeError(message);
        throw new Error(message);
      }
    },
    [apiKnowledgeCategories, deps.activeProjectSlug]
  );

  const updateCategory = useCallback(
    async (updated: KnowledgeCategoryEntry): Promise<void> => {
      if (apiKnowledgeCategories === null || apiKnowledgePages === null) {
        throw new Error("Backend knowledge base is not ready yet.");
      }

      setKnowledgeError(null);

      try {
        const payload = await updateProjectKnowledgeCategory(deps.activeProjectSlug, updated.id, {
          name: updated.name,
          slug: updated.slug,
          description: updated.description,
          parentId: updated.parentId ?? null,
          sortOrder: updated.sortOrder,
          childOrder: updated.childOrder ?? [],
        });
        const nextCategory = adaptProjectKnowledgeCategory(payload.data.item);
        setApiKnowledgeCategories(
          apiKnowledgeCategories.map((category) =>
            category.id === nextCategory.id ? nextCategory : category
          )
        );
        setApiKnowledgePages(syncPagesWithUpdatedCategory(apiKnowledgePages, nextCategory));
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zaktualizować kategorii bazy wiedzy.";
        setKnowledgeError(message);
        throw new Error(message);
      }
    },
    [apiKnowledgeCategories, apiKnowledgePages, deps.activeProjectSlug]
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      if (apiKnowledgeCategories === null) {
        return {
          ok: false,
          error: "Backend categories are not ready yet.",
        };
      }

      setKnowledgeError(null);

      try {
        await deleteProjectKnowledgeCategory(deps.activeProjectSlug, id);
        setApiKnowledgeCategories(apiKnowledgeCategories.filter((category) => category.id !== id));
        return { ok: true };
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się usunąć kategorii bazy wiedzy.";
        setKnowledgeError(message);
        return {
          ok: false,
          error: message,
        };
      }
    },
    [apiKnowledgeCategories, deps.activeProjectSlug]
  );

  const addPage = useCallback(
    async (page: Omit<KnowledgePage, "id"> & { id?: string }): Promise<KnowledgePage> => {
      if (apiKnowledgePages === null) {
        throw new Error("Backend knowledge articles are not ready yet.");
      }

      setKnowledgeError(null);

      try {
        const payload = await createProjectKnowledgeArticle(deps.activeProjectSlug, {
          id: page.id ?? generateId("page"),
          categoryId: page.categoryId,
          slug: page.slug,
          title: page.title,
          summary: page.summary,
          author: page.author,
          tags: page.tags,
          hiddenTags: page.hiddenTags ?? [],
          matrixLinkId: page.matrixLinkId ?? null,
          globalMatrixLinkIds: page.globalMatrixLinkIds ?? [],
          quickActions: page.quickActions ?? [],
          sections: toProjectKnowledgeSections(page.sections),
          externalSourceUrl: page.externalSourceUrl,
          sectionSearch: page.sectionSearch ?? false,
        });
        const created = adaptProjectKnowledgeArticle(payload.data.item);
        setApiKnowledgePages([...apiKnowledgePages, created]);
        return created;
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się dodać artykułu bazy wiedzy.";
        setKnowledgeError(message);
        throw new Error(message);
      }
    },
    [apiKnowledgePages, deps.activeProjectSlug]
  );

  const updatePage = useCallback(
    async (updated: KnowledgePage): Promise<void> => {
      if (apiKnowledgePages === null) {
        throw new Error("Backend knowledge articles are not ready yet.");
      }

      setKnowledgeError(null);

      try {
        const payload = await updateProjectKnowledgeArticle(deps.activeProjectSlug, updated.id, {
          categoryId: updated.categoryId,
          slug: updated.slug,
          title: updated.title,
          summary: updated.summary,
          author: updated.author,
          tags: updated.tags,
          hiddenTags: updated.hiddenTags ?? [],
          matrixLinkId: updated.matrixLinkId ?? null,
          globalMatrixLinkIds: updated.globalMatrixLinkIds ?? [],
          quickActions: updated.quickActions ?? [],
          sections: toProjectKnowledgeSections(updated.sections),
          externalSourceUrl: updated.externalSourceUrl,
          sectionSearch: updated.sectionSearch ?? false,
        });
        const nextPage = adaptProjectKnowledgeArticle(payload.data.item);
        setApiKnowledgePages(
          apiKnowledgePages.map((page) => (page.id === nextPage.id ? nextPage : page))
        );
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zaktualizować artykułu bazy wiedzy.";
        setKnowledgeError(message);
        throw new Error(message);
      }
    },
    [apiKnowledgePages, deps.activeProjectSlug]
  );

  const deletePage = useCallback(
    async (id: string): Promise<void> => {
      if (apiKnowledgePages === null) {
        throw new Error("Backend knowledge articles are not ready yet.");
      }

      setKnowledgeError(null);

      try {
        await deleteProjectKnowledgeArticle(deps.activeProjectSlug, id);
        setApiKnowledgePages(apiKnowledgePages.filter((page) => page.id !== id));
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się usunąć artykułu bazy wiedzy.";
        setKnowledgeError(message);
        throw new Error(message);
      }
    },
    [apiKnowledgePages, deps.activeProjectSlug]
  );

  const reorderCategories = useCallback(
    async (parentId: string | null, orderedItems: KnowledgeCategoryEntry[]): Promise<void> => {
      if (apiKnowledgeCategories === null) {
        return;
      }

      setKnowledgeError(null);

      try {
        const payload = await reorderProjectKnowledgeCategories(deps.activeProjectSlug, {
          mode: "siblings",
          parentId,
          orderedIds: orderedItems.map((item) => item.id),
        });
        setApiKnowledgeCategories(adaptProjectKnowledgeCategories(payload));
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zmienić kolejności kategorii bazy wiedzy.";
        setKnowledgeError(message);
        toast("error", message);
      }
    },
    [apiKnowledgeCategories, deps.activeProjectSlug, toast]
  );

  const reorderPages = useCallback(
    async (categoryId: string, orderedItems: KnowledgePage[]): Promise<void> => {
      if (apiKnowledgePages === null) {
        return;
      }

      setKnowledgeError(null);

      try {
        const payload = await reorderProjectKnowledgeArticles(deps.activeProjectSlug, {
          categoryId,
          orderedIds: orderedItems.map((item) => item.id),
        });
        setApiKnowledgePages(adaptProjectKnowledgeArticles(payload));
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zmienić kolejności artykułów bazy wiedzy.";
        setKnowledgeError(message);
        toast("error", message);
      }
    },
    [apiKnowledgePages, deps.activeProjectSlug, toast]
  );

  const reorderCategoryChildren = useCallback(
    async (categoryId: string, orderedIds: string[]): Promise<void> => {
      if (apiKnowledgeCategories === null) {
        return;
      }

      setKnowledgeError(null);

      try {
        const payload = await reorderProjectKnowledgeCategories(deps.activeProjectSlug, {
          mode: "childOrder",
          categoryId,
          orderedIds,
        });
        setApiKnowledgeCategories(adaptProjectKnowledgeCategories(payload));
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zaktualizować kolejności nawigacji kategorii.";
        setKnowledgeError(message);
        toast("error", message);
      }
    },
    [apiKnowledgeCategories, deps.activeProjectSlug, toast]
  );

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      categories,
      pages,
      categoryTree,
      isKnowledgeLoading,
      knowledgeError,
      contributesToAppLoading,
      addCategory,
      updateCategory,
      deleteCategory,
      addPage,
      updatePage,
      deletePage,
      reorderCategories,
      reorderPages,
      reorderCategoryChildren,
    }),
    [
      categories,
      pages,
      categoryTree,
      isKnowledgeLoading,
      knowledgeError,
      contributesToAppLoading,
      addCategory,
      updateCategory,
      deleteCategory,
      addPage,
      updatePage,
      deletePage,
      reorderCategories,
      reorderPages,
      reorderCategoryChildren,
    ]
  );

  return <KnowledgeModuleContext.Provider value={value}>{children}</KnowledgeModuleContext.Provider>;
}

export function useKnowledgeModule(): KnowledgeContextValue {
  const context = useContext(KnowledgeModuleContext);
  if (!context) {
    throw new Error("useKnowledgeModule must be used inside KnowledgeProvider");
  }
  return context;
}
