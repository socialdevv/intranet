import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MatrixDecision } from "@/lib/types/domain";
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
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type MatrixModuleState = {
  source: "api";
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
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const matrix = useMemo<MatrixDecision[]>(() => apiMatrix ?? [], [apiMatrix]);

  const matrixCategoryOrder = useMemo(() => {
    const persisted = projectConfiguration.rules?.matrixCategoryOrder ?? [];
    const allCats = [...new Set(matrix.map((m) => m.category))];
    const extra = allCats.filter((c) => !persisted.includes(c));
    return [...persisted.filter((c) => allCats.includes(c)), ...extra];
  }, [matrix, projectConfiguration]);

  const addMatrixEntry = useCallback(
    (_entry: Omit<MatrixDecision, "id"> & { id?: string }): MatrixDecision => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const updateMatrixEntry = useCallback((_updated: MatrixDecision): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteMatrixEntry = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderMatrixCategories = useCallback((_orderedCategoryNames: string[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderMatrixInCategory = useCallback(
    (_categoryName: string, _orderedItems: MatrixDecision[]): void => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const createManagedMatrixEntry = useCallback(
    async (input: CreateProjectMatrixInput): Promise<void> => {
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
    [apiMatrix, deps.activeProjectSlug]
  );

  const editManagedMatrixEntry = useCallback(
    async (id: string, input: UpdateProjectMatrixInput): Promise<void> => {
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
    [apiMatrix, deps.activeProjectSlug]
  );

  const removeManagedMatrixEntry = useCallback(
    async (id: string): Promise<void> => {
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
    [apiMatrix, deps.activeProjectSlug]
  );

  const reorderManagedMatrixCategories = useCallback(
    (orderedCategoryNames: string[]): void => {
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
          : (projectConfiguration.rules?.matrixCategoryOrder ?? []);

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
      projectBootstrapState,
      projectConfiguration.rules?.matrixCategoryOrder,
      syncProjectBootstrapMatrixCategoryOrder,
    ]
  );

  const reorderManagedMatrixInCategory = useCallback(
    (categoryName: string, orderedItems: MatrixDecision[]): void => {
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
    [activeProjectSlug, apiMatrix]
  );

  const matrixModule = useMemo<MatrixModuleState>(
    () => ({
      source: "api",
      isLoading: isMatrixLoading,
      isMutating: isMatrixMutating,
      error: matrixError,
      canWrite: apiMatrix !== null,
      canReorder: apiMatrix !== null && bootstrapProjectConfiguration !== null,
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
