import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PhraseEntry } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
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
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type PhrasesModuleState = {
  source: ModuleDataSource;
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
    if (!deps.apiMode) {
      setApiPhrases(null);
      setIsPhrasesLoading(false);
      setIsPhrasesMutating(false);
      setPhrasesError(null);
      return;
    }

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
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedPhrases = useMemo<PhraseEntry[]>(
    () =>
      deps.apiMode
        ? apiPhrases ?? ((deps.legacyData.phrases ?? []) as PhraseEntry[])
        : ((deps.legacyData.phrases ?? []) as PhraseEntry[]),
    [apiPhrases, deps.apiMode, deps.legacyData.phrases]
  );

  const addPhrase = useCallback(
    (p: Omit<PhraseEntry, "id"> & { id?: string }): PhraseEntry => {
      const phrases = deps.legacyData.phrases ?? [];
      const maxOrder = phrases.reduce((mx: number, x: PhraseEntry) => Math.max(mx, x.sortOrder), -1);
      const full: PhraseEntry = { ...p, id: p.id ?? generateId("phrase"), sortOrder: maxOrder + 1 };
      deps.setLegacyData({ ...deps.legacyData, phrases: [...phrases, full] });
      return full;
    },
    [deps]
  );

  const updatePhrase = useCallback(
    (updated: PhraseEntry): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        phrases: (deps.legacyData.phrases ?? []).map((phrase: PhraseEntry) =>
          phrase.id === updated.id ? updated : phrase
        ),
      });
    },
    [deps]
  );

  const deletePhrase = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        phrases: (deps.legacyData.phrases ?? []).filter((phrase: PhraseEntry) => phrase.id !== id),
      });
    },
    [deps]
  );

  const reorderPhrases = useCallback(
    (orderedItems: PhraseEntry[]): void => {
      const updated = (deps.legacyData.phrases ?? []).map((phrase: PhraseEntry) => {
        const idx = orderedItems.findIndex((item) => item.id === phrase.id);
        return idx === -1 ? phrase : { ...phrase, sortOrder: idx };
      });
      deps.setLegacyData({ ...deps.legacyData, phrases: updated });
    },
    [deps]
  );

  const createManagedPhrase = useCallback(
    async (input: CreateProjectPhraseInput): Promise<void> => {
      if (!deps.apiMode) {
        addPhrase({
          title: input.title,
          content: input.content,
          requiresConfirmation: input.requiresConfirmation,
          sortOrder: 0,
        });
        return;
      }

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
    [addPhrase, apiPhrases, deps.activeProjectSlug, deps.apiMode]
  );

  const editManagedPhrase = useCallback(
    async (id: string, input: UpdateProjectPhraseInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedPhrases.find((phrase) => phrase.id === id);

        if (!existing) {
          throw new Error("Gotowy zwrot nie został znaleziony.");
        }

        updatePhrase({
          ...existing,
          title: input.title ?? existing.title,
          content: input.content ?? existing.content,
          requiresConfirmation: input.requiresConfirmation ?? existing.requiresConfirmation,
          sortOrder: input.sortOrder ?? existing.sortOrder,
        });
        return;
      }

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
    [apiPhrases, deps.activeProjectSlug, deps.apiMode, resolvedPhrases, updatePhrase]
  );

  const removeManagedPhrase = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deletePhrase(id);
        return;
      }

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
    [apiPhrases, deletePhrase, deps.activeProjectSlug, deps.apiMode]
  );

  const reorderManagedPhrases = useCallback(
    (orderedItems: PhraseEntry[]): void => {
      if (!deps.apiMode) {
        reorderPhrases(orderedItems);
        return;
      }

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
    [apiPhrases, deps.activeProjectSlug, deps.apiMode, reorderPhrases]
  );

  const phrasesModule = useMemo<PhrasesModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isPhrasesLoading,
      isMutating: isPhrasesMutating,
      error: phrasesError,
      canWrite: !deps.apiMode || apiPhrases !== null,
      canReorder: !deps.apiMode || apiPhrases !== null,
      createPhrase: createManagedPhrase,
      editPhrase: editManagedPhrase,
      removePhrase: removeManagedPhrase,
      reorderPhrases: reorderManagedPhrases,
    }),
    [
      apiPhrases,
      createManagedPhrase,
      deps.apiMode,
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
