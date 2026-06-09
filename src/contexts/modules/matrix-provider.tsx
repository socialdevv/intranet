import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MatrixDecision } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
import {
  adaptProjectMatrix,
  adaptProjectMatrixItems,
  createProjectMatrix,
  deleteProjectMatrix,
  fetchProjectMatrix,
  reorderProjectMatrixCategories,
  reorderProjectMatrixEntries,
  updateProjectMatrix,
  type CreateProjectMatrixInput,
  type UpdateProjectMatrixInput,
} from "@/lib/api/project-matrix";
import { useProjectScope } from "@/contexts/project-scope-provider";
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type MatrixModuleState = {
  source: ModuleDataSource;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  createEntry: (input: CreateProjectMatrixInput) => Promise<void>;
  editEntry: (id: string, input: UpdateProjectMatrixInput) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  reorderCategories: (orderedCategoryNames: string[]) => void;
  reorderEntriesInCategory: (categoryName: string, orderedItems: MatrixDecision[]) => void;
};

export type MatrixContextValue = {
  matrix: MatrixDecision[];
  matrixCategoryOrder: string[];
  addMatrixEntry: (entry: Omit<MatrixDecision, "id"> & { id?: string }) => MatrixDecision;
  updateMatrixEntry: (updated: MatrixDecision) => void;
  deleteMatrixEntry: (id: string) => void;
  reorderMatrixCategories: (orderedCategoryNames: string[]) => void;
  reorderMatrixInCategory: (categoryName: string, orderedItems: MatrixDecision[]) => void;
  matrixModule: MatrixModuleState;
};

const MatrixModuleContext = createContext<MatrixContextValue | null>(null);

function sortMatrixEntries(items: MatrixDecision[]): MatrixDecision[] {
  return [...items].sort((left, right) => {
    const categoryDiff = left.category.localeCompare(right.category, "pl");

    if (categoryDiff !== 0) {
      return categoryDiff;
    }

    const orderDiff = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);

    if (orderDiff !== 0) {
      return orderDiff;
    }

    return left.subcategory.localeCompare(right.subcategory, "pl");
  });
}

export function MatrixProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const {
    activeProjectSlug,
    bootstrapProjectConfiguration,
    projectBootstrapState,
    projectConfiguration,
    syncProjectBootstrapMatrixCategoryOrder,
  } = useProjectScope();

  const [apiMatrix, setApiMatrix] = useState<MatrixDecision[] | null>(null);
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [isMatrixMutating, setIsMatrixMutating] = useState(false);
  const [matrixError, setMatrixError] = useState<string | null>(null);

  useEffect(() => {
    if (!deps.apiMode) {
      setApiMatrix(null);
      setIsMatrixLoading(false);
      setIsMatrixMutating(false);
      setMatrixError(null);
      return;
    }

    const controller = new AbortController();

    setIsMatrixLoading(true);
    setMatrixError(null);

    void (async () => {
      try {
        const payload = await fetchProjectMatrix(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiMatrix(sortMatrixEntries(adaptProjectMatrixItems(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiMatrix(null);
        setMatrixError(
          caught instanceof Error ? caught.message : "Nie udało się załadować macierzy z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsMatrixLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const matrix = useMemo<MatrixDecision[]>(
    () =>
      deps.apiMode
        ? apiMatrix ?? (deps.legacyData.matrix ?? [])
        : (deps.legacyData.matrix ?? []),
    [apiMatrix, deps.apiMode, deps.legacyData.matrix]
  );

  const matrixCategoryOrder = useMemo(() => {
    const persisted =
      projectConfiguration.rules?.matrixCategoryOrder ?? deps.legacyData.matrixCategoryOrder ?? [];
    const allCats = [...new Set(matrix.map((m) => m.category))];
    const extra = allCats.filter((c) => !persisted.includes(c));
    return [...persisted.filter((c) => allCats.includes(c)), ...extra];
  }, [deps.legacyData.matrixCategoryOrder, matrix, projectConfiguration]);

  const addMatrixEntry = useCallback(
    (entry: Omit<MatrixDecision, "id"> & { id?: string }): MatrixDecision => {
      const legacyMatrix = deps.legacyData.matrix ?? [];
      const maxOrder = legacyMatrix
        .filter((matrixEntry) => matrixEntry.category === entry.category)
        .reduce((mx, matrixEntry) => Math.max(mx, matrixEntry.sortOrder ?? 0), -1);
      const full: MatrixDecision = {
        ...entry,
        id: entry.id ?? generateId("matrix"),
        sortOrder: maxOrder + 1,
      };
      deps.setLegacyData({ ...deps.legacyData, matrix: [...legacyMatrix, full] });
      return full;
    },
    [deps]
  );

  const updateMatrixEntry = useCallback(
    (updated: MatrixDecision): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        matrix: (deps.legacyData.matrix ?? []).map((m) => (m.id === updated.id ? updated : m)),
      });
    },
    [deps]
  );

  const deleteMatrixEntry = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        matrix: (deps.legacyData.matrix ?? []).filter((m) => m.id !== id),
      });
    },
    [deps]
  );

  const reorderMatrixCategories = useCallback(
    (orderedCategoryNames: string[]): void => {
      if (deps.apiMode) {
        return;
      }

      deps.setLegacyData({
        ...deps.legacyData,
        matrixCategoryOrder: orderedCategoryNames,
        configuration: {
          ...deps.legacyData.configuration,
          rules: {
            ...deps.legacyData.configuration?.rules,
            matrixCategoryOrder: orderedCategoryNames,
          },
        },
      });
    },
    [deps]
  );

  const reorderMatrixInCategory = useCallback(
    (categoryName: string, orderedItems: MatrixDecision[]): void => {
      if (deps.apiMode) {
        return;
      }

      const updated = (deps.legacyData.matrix ?? []).map((m) => {
        if (m.category !== categoryName) return m;
        const idx = orderedItems.findIndex((o) => o.id === m.id);
        return idx === -1 ? m : { ...m, sortOrder: idx };
      });
      deps.setLegacyData({ ...deps.legacyData, matrix: updated });
    },
    [deps]
  );

  const createManagedMatrixEntry = useCallback(
    async (input: CreateProjectMatrixInput): Promise<void> => {
      if (!deps.apiMode) {
        addMatrixEntry(input);
        return;
      }

      if (apiMatrix === null) {
        throw new Error("Backend matrix is not ready yet.");
      }

      setIsMatrixMutating(true);
      setMatrixError(null);

      try {
        const payload = await createProjectMatrix(deps.activeProjectSlug, input);
        setApiMatrix(sortMatrixEntries([...apiMatrix, adaptProjectMatrix(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać wpisu macierzy.";
        setMatrixError(message);
        throw new Error(message);
      } finally {
        setIsMatrixMutating(false);
      }
    },
    [addMatrixEntry, apiMatrix, deps.activeProjectSlug, deps.apiMode]
  );

  const editManagedMatrixEntry = useCallback(
    async (id: string, input: UpdateProjectMatrixInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = (deps.legacyData.matrix ?? []).find((entry) => entry.id === id);

        if (!existing) {
          throw new Error("Wpis macierzy nie został znaleziony.");
        }

        const nextCategory = input.category ?? existing.category;
        const nextSortOrder =
          nextCategory === existing.category
            ? existing.sortOrder
            : (deps.legacyData.matrix ?? [])
                .filter((entry) => entry.id !== id && entry.category === nextCategory)
                .reduce((maxOrder, entry) => Math.max(maxOrder, entry.sortOrder ?? 0), -1) + 1;

        updateMatrixEntry({
          ...existing,
          category: nextCategory,
          subcategory: input.subcategory ?? existing.subcategory,
          keywords: input.keywords ?? existing.keywords,
          description: input.description ?? existing.description,
          slaDays: input.slaDays ?? existing.slaDays,
          instructions: input.instructions ?? existing.instructions,
          additionalNotes: input.additionalNotes ?? existing.additionalNotes,
          defaultDepartment: input.defaultDepartment ?? existing.defaultDepartment,
          conditions: input.conditions ?? existing.conditions,
          linkedTemplateIds: input.linkedTemplateIds ?? existing.linkedTemplateIds,
          sortOrder: nextSortOrder,
        });
        return;
      }

      if (apiMatrix === null) {
        throw new Error("Backend matrix is not ready yet.");
      }

      setIsMatrixMutating(true);
      setMatrixError(null);

      try {
        const payload = await updateProjectMatrix(deps.activeProjectSlug, id, input);
        setApiMatrix(
          sortMatrixEntries(
            apiMatrix.map((entry) =>
              entry.id === id ? adaptProjectMatrix(payload.data.item) : entry
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować wpisu macierzy.";
        setMatrixError(message);
        throw new Error(message);
      } finally {
        setIsMatrixMutating(false);
      }
    },
    [apiMatrix, deps, updateMatrixEntry]
  );

  const removeManagedMatrixEntry = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteMatrixEntry(id);
        return;
      }

      if (apiMatrix === null) {
        throw new Error("Backend matrix is not ready yet.");
      }

      setIsMatrixMutating(true);
      setMatrixError(null);

      try {
        await deleteProjectMatrix(deps.activeProjectSlug, id);
        setApiMatrix(apiMatrix.filter((entry) => entry.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć wpisu macierzy.";
        setMatrixError(message);
        throw new Error(message);
      } finally {
        setIsMatrixMutating(false);
      }
    },
    [apiMatrix, deleteMatrixEntry, deps.activeProjectSlug, deps.apiMode]
  );

  const reorderManagedMatrixCategories = useCallback(
    (orderedCategoryNames: string[]): void => {
      if (!deps.apiMode) {
        reorderMatrixCategories(orderedCategoryNames);
        return;
      }

      if (apiMatrix === null) {
        setMatrixError("Backend matrix is not ready yet.");
        return;
      }

      const previousOrder =
        projectBootstrapState.mode === "api" &&
        projectBootstrapState.status === "ready" &&
        !projectBootstrapState.preview.access.isLocked &&
        projectBootstrapState.routeContext.projectSlug === activeProjectSlug
          ? projectBootstrapState.preview.configuration.rules.matrixCategoryOrder
          : deps.legacyData.matrixCategoryOrder ?? [];

      setIsMatrixMutating(true);
      setMatrixError(null);
      syncProjectBootstrapMatrixCategoryOrder(orderedCategoryNames);

      void (async () => {
        try {
          const payload = await reorderProjectMatrixCategories(activeProjectSlug, orderedCategoryNames);
          syncProjectBootstrapMatrixCategoryOrder(payload.data.orderedCategoryNames);
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności kategorii macierzy.";
          syncProjectBootstrapMatrixCategoryOrder(previousOrder);
          setMatrixError(message);
        } finally {
          setIsMatrixMutating(false);
        }
      })();
    },
    [
      activeProjectSlug,
      apiMatrix,
      deps.apiMode,
      deps.legacyData.matrixCategoryOrder,
      projectBootstrapState,
      reorderMatrixCategories,
      syncProjectBootstrapMatrixCategoryOrder,
    ]
  );

  const reorderManagedMatrixInCategory = useCallback(
    (categoryName: string, orderedItems: MatrixDecision[]): void => {
      if (!deps.apiMode) {
        reorderMatrixInCategory(categoryName, orderedItems);
        return;
      }

      if (apiMatrix === null) {
        setMatrixError("Backend matrix is not ready yet.");
        return;
      }

      const previousItems = apiMatrix;
      const nextItems = apiMatrix.map((entry) => {
        if (entry.category !== categoryName) {
          return entry;
        }

        const nextIndex = orderedItems.findIndex((item) => item.id === entry.id);
        return nextIndex === -1 ? entry : { ...entry, sortOrder: nextIndex };
      });

      setIsMatrixMutating(true);
      setMatrixError(null);
      setApiMatrix(sortMatrixEntries(nextItems));

      void (async () => {
        try {
          const payload = await reorderProjectMatrixEntries(
            activeProjectSlug,
            categoryName,
            orderedItems.map((item) => item.id)
          );
          setApiMatrix(sortMatrixEntries(adaptProjectMatrixItems(payload)));
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności wpisów macierzy.";
          setApiMatrix(previousItems);
          setMatrixError(message);
        } finally {
          setIsMatrixMutating(false);
        }
      })();
    },
    [activeProjectSlug, apiMatrix, deps.apiMode, reorderMatrixInCategory]
  );

  const matrixModule = useMemo<MatrixModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isMatrixLoading,
      isMutating: isMatrixMutating,
      error: matrixError,
      canWrite: !deps.apiMode || apiMatrix !== null,
      canReorder: !deps.apiMode || (apiMatrix !== null && bootstrapProjectConfiguration !== null),
      createEntry: createManagedMatrixEntry,
      editEntry: editManagedMatrixEntry,
      removeEntry: removeManagedMatrixEntry,
      reorderCategories: reorderManagedMatrixCategories,
      reorderEntriesInCategory: reorderManagedMatrixInCategory,
    }),
    [
      apiMatrix,
      bootstrapProjectConfiguration,
      createManagedMatrixEntry,
      deps.apiMode,
      editManagedMatrixEntry,
      isMatrixLoading,
      isMatrixMutating,
      matrixError,
      removeManagedMatrixEntry,
      reorderManagedMatrixCategories,
      reorderManagedMatrixInCategory,
    ]
  );

  const value = useMemo<MatrixContextValue>(
    () => ({
      matrix,
      matrixCategoryOrder,
      addMatrixEntry,
      updateMatrixEntry,
      deleteMatrixEntry,
      reorderMatrixCategories,
      reorderMatrixInCategory,
      matrixModule,
    }),
    [
      matrix,
      matrixCategoryOrder,
      addMatrixEntry,
      updateMatrixEntry,
      deleteMatrixEntry,
      reorderMatrixCategories,
      reorderMatrixInCategory,
      matrixModule,
    ]
  );

  return <MatrixModuleContext.Provider value={value}>{children}</MatrixModuleContext.Provider>;
}

export function useMatrixModule(): MatrixContextValue {
  const context = useContext(MatrixModuleContext);
  if (!context) {
    throw new Error("useMatrixModule must be used inside MatrixProvider");
  }
  return context;
}
