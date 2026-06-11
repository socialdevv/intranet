import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PhraseEntry } from "@/lib/types/domain";
import {
  adaptProjectPhrase,
  adaptProjectPhrases,
  createProjectPhrase,
  deleteProjectPhrase,
  fetchProjectPhrases,
  reorderProjectPhrases,
  updateProjectPhrase,
  type CreateProjectPhraseInput,
  type UpdateProjectPhraseInput,
} from "@/lib/api/project-phrases";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type PhrasesModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  canReorder: boolean;
  createPhrase: (input: CreateProjectPhraseInput) => Promise<void>;
  editPhrase: (id: string, input: UpdateProjectPhraseInput) => Promise<void>;
  removePhrase: (id: string) => Promise<void>;
  reorderPhrases: (orderedItems: PhraseEntry[]) => void;
};

type PhrasesContextValue = {
  phrases: PhraseEntry[];
  addPhrase: (p: Omit<PhraseEntry, "id"> & { id?: string }) => PhraseEntry;
  updatePhrase: (updated: PhraseEntry) => void;
  deletePhrase: (id: string) => void;
  reorderPhrases: (orderedItems: PhraseEntry[]) => void;
  phrasesModule: PhrasesModuleState;
};

const PhrasesModuleContext = createContext<PhrasesContextValue | null>(null);

function sortPhrases(items: PhraseEntry[]): PhraseEntry[] {
  return [...items].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title, "pl")
  );
}

export function PhrasesProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiPhrases, setApiPhrases] = useState<PhraseEntry[] | null>(null);
  const [isPhrasesLoading, setIsPhrasesLoading] = useState(false);
  const [isPhrasesMutating, setIsPhrasesMutating] = useState(false);
  const [phrasesError, setPhrasesError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsPhrasesLoading(true);
    setPhrasesError(null);

    void (async () => {
      try {
        const payload = await fetchProjectPhrases(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiPhrases(sortPhrases(adaptProjectPhrases(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiPhrases(null);
        setPhrasesError(
          caught instanceof Error ? caught.message : "Nie udało się załadować gotowych zwrotów z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsPhrasesLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedPhrases = useMemo<PhraseEntry[]>(() => apiPhrases ?? [], [apiPhrases]);

  const addPhrase = useCallback((_p: Omit<PhraseEntry, "id"> & { id?: string }): PhraseEntry => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const updatePhrase = useCallback((_updated: PhraseEntry): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deletePhrase = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const reorderPhrases = useCallback((_orderedItems: PhraseEntry[]): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedPhrase = useCallback(
    async (input: CreateProjectPhraseInput): Promise<void> => {
      if (apiPhrases === null) {
        throw new Error("Backend approved responses are not ready yet.");
      }

      setIsPhrasesMutating(true);
      setPhrasesError(null);

      try {
        const payload = await createProjectPhrase(deps.activeProjectSlug, input);
        setApiPhrases(sortPhrases([...apiPhrases, adaptProjectPhrase(payload.data.item)]));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać gotowego zwrotu.";
        setPhrasesError(message);
        throw new Error(message);
      } finally {
        setIsPhrasesMutating(false);
      }
    },
    [apiPhrases, deps.activeProjectSlug]
  );

  const editManagedPhrase = useCallback(
    async (id: string, input: UpdateProjectPhraseInput): Promise<void> => {
      if (apiPhrases === null) {
        throw new Error("Backend approved responses are not ready yet.");
      }

      setIsPhrasesMutating(true);
      setPhrasesError(null);

      try {
        const payload = await updateProjectPhrase(deps.activeProjectSlug, id, input);
        setApiPhrases(
          sortPhrases(
            apiPhrases.map((phrase: PhraseEntry) =>
              phrase.id === id ? adaptProjectPhrase(payload.data.item) : phrase
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować gotowego zwrotu.";
        setPhrasesError(message);
        throw new Error(message);
      } finally {
        setIsPhrasesMutating(false);
      }
    },
    [apiPhrases, deps.activeProjectSlug]
  );

  const removeManagedPhrase = useCallback(
    async (id: string): Promise<void> => {
      if (apiPhrases === null) {
        throw new Error("Backend approved responses are not ready yet.");
      }

      setIsPhrasesMutating(true);
      setPhrasesError(null);

      try {
        await deleteProjectPhrase(deps.activeProjectSlug, id);
        setApiPhrases(apiPhrases.filter((phrase) => phrase.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć gotowego zwrotu.";
        setPhrasesError(message);
        throw new Error(message);
      } finally {
        setIsPhrasesMutating(false);
      }
    },
    [apiPhrases, deps.activeProjectSlug]
  );

  const reorderManagedPhrases = useCallback(
    (orderedItems: PhraseEntry[]): void => {
      if (apiPhrases === null) {
        setPhrasesError("Backend approved responses are not ready yet.");
        return;
      }

      const previousItems = apiPhrases;
      const nextItems = sortPhrases(orderedItems.map((item, index) => ({ ...item, sortOrder: index })));

      setIsPhrasesMutating(true);
      setPhrasesError(null);
      setApiPhrases(nextItems);

      void (async () => {
        try {
          const payload = await reorderProjectPhrases(
            deps.activeProjectSlug,
            orderedItems.map((item) => item.id)
          );
          setApiPhrases(sortPhrases(adaptProjectPhrases(payload)));
        } catch (caught) {
          const message =
            caught instanceof Error ? caught.message : "Nie udało się zmienić kolejności gotowych zwrotów.";
          setApiPhrases(previousItems);
          setPhrasesError(message);
        } finally {
          setIsPhrasesMutating(false);
        }
      })();
    },
    [apiPhrases, deps.activeProjectSlug]
  );

  const phrasesModule = useMemo<PhrasesModuleState>(
    () => ({
      source: "api",
      isLoading: isPhrasesLoading,
      isMutating: isPhrasesMutating,
      error: phrasesError,
      canWrite: apiPhrases !== null,
      canReorder: apiPhrases !== null,
      createPhrase: createManagedPhrase,
      editPhrase: editManagedPhrase,
      removePhrase: removeManagedPhrase,
      reorderPhrases: reorderManagedPhrases,
    }),
    [
      apiPhrases,
      createManagedPhrase,
      editManagedPhrase,
      isPhrasesLoading,
      isPhrasesMutating,
      phrasesError,
      removeManagedPhrase,
      reorderManagedPhrases,
    ]
  );

  const value = useMemo<PhrasesContextValue>(
    () => ({
      phrases: resolvedPhrases,
      addPhrase,
      updatePhrase,
      deletePhrase,
      reorderPhrases,
      phrasesModule,
    }),
    [addPhrase, deletePhrase, phrasesModule, reorderPhrases, resolvedPhrases, updatePhrase]
  );

  return <PhrasesModuleContext.Provider value={value}>{children}</PhrasesModuleContext.Provider>;
}

export function usePhrasesModule(): PhrasesContextValue {
  const context = useContext(PhrasesModuleContext);

  if (!context) {
    throw new Error("usePhrasesModule must be used inside PhrasesProvider");
  }

  return context;
}
