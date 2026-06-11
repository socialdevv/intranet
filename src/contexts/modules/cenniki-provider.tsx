import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cennik, CennikiPayload } from "@/lib/types/domain";
import {
  adaptProjectPricing,
  adaptProjectPricingItems,
  createProjectPricing,
  deleteProjectPricing,
  fetchProjectPricing,
  updateProjectPricing,
  type CreateProjectPricingInput,
  type UpdateProjectPricingInput,
} from "@/lib/api/project-pricing";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type CennikiModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  createCennik: (input: CreateProjectPricingInput) => Promise<void>;
  editCennik: (id: string, input: UpdateProjectPricingInput) => Promise<void>;
  removeCennik: (id: string) => Promise<void>;
};

type CennikiContextValue = {
  cenniki: CennikiPayload;
  addCennik: (c: Omit<Cennik, "id"> & { id?: string }) => Cennik;
  updateCennik: (updated: Cennik) => void;
  deleteCennik: (id: string) => void;
  cennikiModule: CennikiModuleState;
};

const CennikiModuleContext = createContext<CennikiContextValue | null>(null);

function sortCenniki(items: Cennik[]): Cennik[] {
  return [...items].sort((left, right) => {
    const effectiveDiff = new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime();

    if (effectiveDiff !== 0) {
      return effectiveDiff;
    }

    const updatedDiff = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();

    if (updatedDiff !== 0) {
      return updatedDiff;
    }

    return left.title.localeCompare(right.title, "pl");
  });
}

export function CennikiProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiCenniki, setApiCenniki] = useState<Cennik[] | null>(null);
  const [isCennikiLoading, setIsCennikiLoading] = useState(false);
  const [isCennikiMutating, setIsCennikiMutating] = useState(false);
  const [cennikiError, setCennikiError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsCennikiLoading(true);
    setCennikiError(null);

    void (async () => {
      try {
        const payload = await fetchProjectPricing(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiCenniki(sortCenniki(adaptProjectPricingItems(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiCenniki(null);
        setCennikiError(
          caught instanceof Error ? caught.message : "Nie udało się załadować cenników z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsCennikiLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedDocuments = useMemo<Cennik[]>(() => apiCenniki ?? [], [apiCenniki]);

  const resolvedCenniki = useMemo<CennikiPayload>(
    () => ({ documents: resolvedDocuments }),
    [resolvedDocuments]
  );

  const addCennik = useCallback((_c: Omit<Cennik, "id"> & { id?: string }): Cennik => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const updateCennik = useCallback((_updated: Cennik): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteCennik = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedCennik = useCallback(
    async (input: CreateProjectPricingInput): Promise<void> => {
      if (apiCenniki === null) {
        throw new Error("Backend pricing documents are not ready yet.");
      }

      setIsCennikiMutating(true);
      setCennikiError(null);

      try {
        const payload = await createProjectPricing(deps.activeProjectSlug, input);
        setApiCenniki(sortCenniki([...apiCenniki, adaptProjectPricing(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać cennika.";
        setCennikiError(message);
        throw new Error(message);
      } finally {
        setIsCennikiMutating(false);
      }
    },
    [apiCenniki, deps.activeProjectSlug]
  );

  const editManagedCennik = useCallback(
    async (id: string, input: UpdateProjectPricingInput): Promise<void> => {
      if (apiCenniki === null) {
        throw new Error("Backend pricing documents are not ready yet.");
      }

      setIsCennikiMutating(true);
      setCennikiError(null);

      try {
        const payload = await updateProjectPricing(deps.activeProjectSlug, id, input);
        setApiCenniki(
          sortCenniki(
            apiCenniki.map((document: Cennik) =>
              document.id === id ? adaptProjectPricing(payload.data.item) : document
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować cennika.";
        setCennikiError(message);
        throw new Error(message);
      } finally {
        setIsCennikiMutating(false);
      }
    },
    [apiCenniki, deps.activeProjectSlug]
  );

  const removeManagedCennik = useCallback(
    async (id: string): Promise<void> => {
      if (apiCenniki === null) {
        throw new Error("Backend pricing documents are not ready yet.");
      }

      setIsCennikiMutating(true);
      setCennikiError(null);

      try {
        await deleteProjectPricing(deps.activeProjectSlug, id);
        setApiCenniki(apiCenniki.filter((document) => document.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć cennika.";
        setCennikiError(message);
        throw new Error(message);
      } finally {
        setIsCennikiMutating(false);
      }
    },
    [apiCenniki, deps.activeProjectSlug]
  );

  const cennikiModule = useMemo<CennikiModuleState>(
    () => ({
      source: "api",
      isLoading: isCennikiLoading,
      isMutating: isCennikiMutating,
      error: cennikiError,
      canWrite: apiCenniki !== null,
      createCennik: createManagedCennik,
      editCennik: editManagedCennik,
      removeCennik: removeManagedCennik,
    }),
    [
      apiCenniki,
      cennikiError,
      createManagedCennik,
      editManagedCennik,
      isCennikiLoading,
      isCennikiMutating,
      removeManagedCennik,
    ]
  );

  const value = useMemo<CennikiContextValue>(
    () => ({
      cenniki: resolvedCenniki,
      addCennik,
      updateCennik,
      deleteCennik,
      cennikiModule,
    }),
    [addCennik, cennikiModule, deleteCennik, resolvedCenniki, updateCennik]
  );

  return <CennikiModuleContext.Provider value={value}>{children}</CennikiModuleContext.Provider>;
}

export function useCennikiModule(): CennikiContextValue {
  const context = useContext(CennikiModuleContext);

  if (!context) {
    throw new Error("useCennikiModule must be used inside CennikiProvider");
  }

  return context;
}
