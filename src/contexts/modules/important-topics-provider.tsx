import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { OrgEntry } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
import {
  adaptProjectImportantTopic,
  adaptProjectImportantTopics,
  createProjectImportantTopic,
  deleteProjectImportantTopic,
  fetchProjectImportantTopics,
  updateProjectImportantTopic,
  type CreateProjectImportantTopicInput,
  type UpdateProjectImportantTopicInput,
} from "@/lib/api/project-important-topics";
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type ImportantTopicsModuleState = {
  source: ModuleDataSource;
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  createTopic: (input: CreateProjectImportantTopicInput) => Promise<void>;
  editTopic: (id: string, input: UpdateProjectImportantTopicInput) => Promise<void>;
  removeTopic: (id: string) => Promise<void>;
};

type ImportantTopicsContextValue = {
  orgEntries: OrgEntry[];
  addOrgEntry: (e: Omit<OrgEntry, "id"> & { id?: string }) => OrgEntry;
  updateOrgEntry: (updated: OrgEntry) => void;
  deleteOrgEntry: (id: string) => void;
  importantTopicsModule: ImportantTopicsModuleState;
};

const ImportantTopicsModuleContext = createContext<ImportantTopicsContextValue | null>(null);

function toOrgEntrySortTimestamp(value: string): number {
  const isoValue = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(isoValue).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function sortOrgEntries(items: OrgEntry[]): OrgEntry[] {
  return [...items].sort((left, right) => {
    const leftTimestamp = toOrgEntrySortTimestamp(left.entryDate ?? left.updatedAt);
    const rightTimestamp = toOrgEntrySortTimestamp(right.entryDate ?? right.updatedAt);

    return rightTimestamp - leftTimestamp || left.title.localeCompare(right.title);
  });
}

export function ImportantTopicsProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiImportantTopics, setApiImportantTopics] = useState<OrgEntry[] | null>(null);
  const [isImportantTopicsLoading, setIsImportantTopicsLoading] = useState(false);
  const [isImportantTopicsMutating, setIsImportantTopicsMutating] = useState(false);
  const [importantTopicsError, setImportantTopicsError] = useState<string | null>(null);

  useEffect(() => {
    if (!deps.apiMode) {
      setApiImportantTopics(null);
      setIsImportantTopicsLoading(false);
      setIsImportantTopicsMutating(false);
      setImportantTopicsError(null);
      return;
    }

    const controller = new AbortController();

    setIsImportantTopicsLoading(true);
    setImportantTopicsError(null);

    void (async () => {
      try {
        const payload = await fetchProjectImportantTopics(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiImportantTopics(sortOrgEntries(adaptProjectImportantTopics(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiImportantTopics(null);
        setImportantTopicsError(
          caught instanceof Error ? caught.message : "Nie udało się załadować tematów organizacyjnych z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsImportantTopicsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedOrgEntries = useMemo<OrgEntry[]>(
    () =>
      deps.apiMode
        ? apiImportantTopics ?? ((deps.legacyData.orgEntries ?? []) as OrgEntry[])
        : ((deps.legacyData.orgEntries ?? []) as OrgEntry[]),
    [apiImportantTopics, deps.apiMode, deps.legacyData.orgEntries]
  );

  const addOrgEntry = useCallback(
    (e: Omit<OrgEntry, "id"> & { id?: string }): OrgEntry => {
      const full: OrgEntry = { ...e, id: e.id ?? generateId("org") };
      deps.setLegacyData({
        ...deps.legacyData,
        orgEntries: [...(deps.legacyData.orgEntries ?? []), full],
      });
      return full;
    },
    [deps]
  );

  const updateOrgEntry = useCallback(
    (updated: OrgEntry): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        orgEntries: (deps.legacyData.orgEntries ?? []).map((entry: OrgEntry) =>
          entry.id === updated.id ? updated : entry
        ),
      });
    },
    [deps]
  );

  const deleteOrgEntry = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        orgEntries: (deps.legacyData.orgEntries ?? []).filter((entry: OrgEntry) => entry.id !== id),
      });
    },
    [deps]
  );

  const createManagedImportantTopic = useCallback(
    async (input: CreateProjectImportantTopicInput): Promise<void> => {
      if (!deps.apiMode) {
        const nowIso = new Date().toISOString();

        addOrgEntry({
          title: input.title,
          body: input.body,
          status: input.status,
          entryDate: input.entryDate,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }

      if (apiImportantTopics === null) {
        throw new Error("Backend important topics are not ready yet.");
      }

      setIsImportantTopicsMutating(true);
      setImportantTopicsError(null);

      try {
        const payload = await createProjectImportantTopic(deps.activeProjectSlug, input);
        setApiImportantTopics(
          sortOrgEntries([...apiImportantTopics, adaptProjectImportantTopic(payload.data.item)])
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać tematu organizacyjnego.";
        setImportantTopicsError(message);
        throw new Error(message);
      } finally {
        setIsImportantTopicsMutating(false);
      }
    },
    [addOrgEntry, apiImportantTopics, deps.activeProjectSlug, deps.apiMode]
  );

  const editManagedImportantTopic = useCallback(
    async (id: string, input: UpdateProjectImportantTopicInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedOrgEntries.find((entry) => entry.id === id);

        if (!existing) {
          throw new Error("Temat organizacyjny nie został znaleziony.");
        }

        updateOrgEntry({
          ...existing,
          title: input.title ?? existing.title,
          body: input.body ?? existing.body,
          status: input.status ?? existing.status,
          entryDate: input.entryDate ?? existing.entryDate,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (apiImportantTopics === null) {
        throw new Error("Backend important topics are not ready yet.");
      }

      setIsImportantTopicsMutating(true);
      setImportantTopicsError(null);

      try {
        const payload = await updateProjectImportantTopic(deps.activeProjectSlug, id, input);
        setApiImportantTopics(
          sortOrgEntries(
            apiImportantTopics.map((entry: OrgEntry) =>
              entry.id === id ? adaptProjectImportantTopic(payload.data.item) : entry
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować tematu organizacyjnego.";
        setImportantTopicsError(message);
        throw new Error(message);
      } finally {
        setIsImportantTopicsMutating(false);
      }
    },
    [apiImportantTopics, deps.activeProjectSlug, deps.apiMode, resolvedOrgEntries, updateOrgEntry]
  );

  const removeManagedImportantTopic = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteOrgEntry(id);
        return;
      }

      if (apiImportantTopics === null) {
        throw new Error("Backend important topics are not ready yet.");
      }

      setIsImportantTopicsMutating(true);
      setImportantTopicsError(null);

      try {
        await deleteProjectImportantTopic(deps.activeProjectSlug, id);
        setApiImportantTopics(apiImportantTopics.filter((entry) => entry.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć tematu organizacyjnego.";
        setImportantTopicsError(message);
        throw new Error(message);
      } finally {
        setIsImportantTopicsMutating(false);
      }
    },
    [apiImportantTopics, deleteOrgEntry, deps.activeProjectSlug, deps.apiMode]
  );

  const importantTopicsModule = useMemo<ImportantTopicsModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isImportantTopicsLoading,
      isMutating: isImportantTopicsMutating,
      error: importantTopicsError,
      canWrite: !deps.apiMode || apiImportantTopics !== null,
      createTopic: createManagedImportantTopic,
      editTopic: editManagedImportantTopic,
      removeTopic: removeManagedImportantTopic,
    }),
    [
      apiImportantTopics,
      createManagedImportantTopic,
      deps.apiMode,
      editManagedImportantTopic,
      importantTopicsError,
      isImportantTopicsLoading,
      isImportantTopicsMutating,
      removeManagedImportantTopic,
    ]
  );

  const value = useMemo<ImportantTopicsContextValue>(
    () => ({
      orgEntries: resolvedOrgEntries,
      addOrgEntry,
      updateOrgEntry,
      deleteOrgEntry,
      importantTopicsModule,
    }),
    [addOrgEntry, deleteOrgEntry, importantTopicsModule, resolvedOrgEntries, updateOrgEntry]
  );

  return (
    <ImportantTopicsModuleContext.Provider value={value}>{children}</ImportantTopicsModuleContext.Provider>
  );
}

export function useImportantTopicsModule(): ImportantTopicsContextValue {
  const context = useContext(ImportantTopicsModuleContext);

  if (!context) {
    throw new Error("useImportantTopicsModule must be used inside ImportantTopicsProvider");
  }

  return context;
}
