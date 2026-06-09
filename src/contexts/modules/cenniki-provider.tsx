import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cennik, CennikiPayload } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
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
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type CennikiModuleState = {
  source: ModuleDataSource;
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

function legacyCennikDocuments(deps: ProjectModuleDeps): Cennik[] {
  return deps.legacyData.cenniki?.documents ?? [];
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
    if (!deps.apiMode) {
      setApiCenniki(null);
      setIsCennikiLoading(false);
      setIsCennikiMutating(false);
      setCennikiError(null);
      return;
    }

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
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedDocuments = useMemo<Cennik[]>(
    () =>
      deps.apiMode
        ? apiCenniki ?? legacyCennikDocuments(deps)
        : legacyCennikDocuments(deps),
    [apiCenniki, deps]
  );

  const resolvedCenniki = useMemo<CennikiPayload>(
    () => ({ documents: resolvedDocuments }),
    [resolvedDocuments]
  );

  const addCennik = useCallback(
    (c: Omit<Cennik, "id"> & { id?: string }): Cennik => {
      const documents = legacyCennikDocuments(deps);
      const full: Cennik = { ...c, id: c.id ?? generateId("cennik") };
      deps.setLegacyData({
        ...deps.legacyData,
        cenniki: { ...deps.legacyData.cenniki, documents: [...documents, full] },
      });
      return full;
    },
    [deps]
  );

  const updateCennik = useCallback(
    (updated: Cennik): void => {
      const documents = legacyCennikDocuments(deps);
      deps.setLegacyData({
        ...deps.legacyData,
        cenniki: {
          ...deps.legacyData.cenniki,
          documents: documents.map((document: Cennik) => (document.id === updated.id ? updated : document)),
        },
      });
    },
    [deps]
  );

  const deleteCennik = useCallback(
    (id: string): void => {
      const documents = legacyCennikDocuments(deps);
      deps.setLegacyData({
        ...deps.legacyData,
        cenniki: {
          ...deps.legacyData.cenniki,
          documents: documents.filter((document: Cennik) => document.id !== id),
        },
      });
    },
    [deps]
  );

  const createManagedCennik = useCallback(
    async (input: CreateProjectPricingInput): Promise<void> => {
      if (!deps.apiMode) {
        addCennik({
          title: input.title,
          subtitle: input.subtitle ?? undefined,
          provider: input.provider ?? undefined,
          effectiveFrom: input.effectiveFrom,
          updatedAt: new Date().toISOString(),
          status: input.status,
          footnotes: input.footnotes && input.footnotes.length > 0 ? input.footnotes : undefined,
          sections: input.sections,
        });
        return;
      }

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
    [addCennik, apiCenniki, deps.activeProjectSlug, deps.apiMode]
  );

  const editManagedCennik = useCallback(
    async (id: string, input: UpdateProjectPricingInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = legacyCennikDocuments(deps).find((document) => document.id === id);

        if (!existing) {
          throw new Error("Cennik nie został znaleziony.");
        }

        updateCennik({
          ...existing,
          title: input.title ?? existing.title,
          subtitle: input.subtitle === undefined ? existing.subtitle : (input.subtitle ?? undefined),
          provider: input.provider === undefined ? existing.provider : (input.provider ?? undefined),
          effectiveFrom: input.effectiveFrom ?? existing.effectiveFrom,
          updatedAt: new Date().toISOString(),
          status: input.status ?? existing.status,
          footnotes:
            input.footnotes === undefined
              ? existing.footnotes
              : input.footnotes.length > 0
                ? input.footnotes
                : undefined,
          sections: input.sections ?? existing.sections,
        });
        return;
      }

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
    [apiCenniki, deps.activeProjectSlug, deps.apiMode, updateCennik]
  );

  const removeManagedCennik = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteCennik(id);
        return;
      }

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
    [apiCenniki, deleteCennik, deps.activeProjectSlug, deps.apiMode]
  );

  const cennikiModule = useMemo<CennikiModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isCennikiLoading,
      isMutating: isCennikiMutating,
      error: cennikiError,
      canWrite: !deps.apiMode || apiCenniki !== null,
      createCennik: createManagedCennik,
      editCennik: editManagedCennik,
      removeCennik: removeManagedCennik,
    }),
    [
      apiCenniki,
      cennikiError,
      createManagedCennik,
      deps.apiMode,
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
