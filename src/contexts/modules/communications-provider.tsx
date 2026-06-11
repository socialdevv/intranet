import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CommunicationMessage } from "@/lib/types/domain";
import {
  adaptProjectCommunication,
  adaptProjectCommunications,
  createProjectCommunication,
  deleteProjectCommunication,
  fetchProjectCommunications,
  updateProjectCommunication,
  type CreateProjectCommunicationInput,
  type UpdateProjectCommunicationInput,
} from "@/lib/api/project-communications";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type CommunicationsModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  createCommunication: (input: CreateProjectCommunicationInput) => Promise<void>;
  editCommunication: (id: string, input: UpdateProjectCommunicationInput) => Promise<void>;
  removeCommunication: (id: string) => Promise<void>;
};

type CommunicationsContextValue = {
  communications: CommunicationMessage[];
  addCommunication: (c: Omit<CommunicationMessage, "id"> & { id?: string }) => CommunicationMessage;
  updateCommunication: (updated: CommunicationMessage) => void;
  deleteCommunication: (id: string) => void;
  communicationsModule: CommunicationsModuleState;
};

const CommunicationsModuleContext = createContext<CommunicationsContextValue | null>(null);

function toCommunicationSortTimestamp(value: string): number {
  const isoValue = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(isoValue).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function sortCommunications(items: CommunicationMessage[]): CommunicationMessage[] {
  return [...items].sort((left, right) => {
    const leftTimestamp = toCommunicationSortTimestamp(left.communicationDate ?? left.updatedAt);
    const rightTimestamp = toCommunicationSortTimestamp(right.communicationDate ?? right.updatedAt);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return left.title.localeCompare(right.title, "pl");
  });
}

export function CommunicationsProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiCommunications, setApiCommunications] = useState<CommunicationMessage[] | null>(null);
  const [isCommunicationsLoading, setIsCommunicationsLoading] = useState(false);
  const [isCommunicationsMutating, setIsCommunicationsMutating] = useState(false);
  const [communicationsError, setCommunicationsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsCommunicationsLoading(true);
    setCommunicationsError(null);

    void (async () => {
      try {
        const payload = await fetchProjectCommunications(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiCommunications(sortCommunications(adaptProjectCommunications(payload)));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiCommunications(null);
        setCommunicationsError(
          caught instanceof Error ? caught.message : "Nie udało się załadować komunikatów z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsCommunicationsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedCommunications = useMemo<CommunicationMessage[]>(
    () => sortCommunications(apiCommunications ?? []),
    [apiCommunications]
  );

  const addCommunication = useCallback(
    (_c: Omit<CommunicationMessage, "id"> & { id?: string }): CommunicationMessage => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const updateCommunication = useCallback((_updated: CommunicationMessage): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteCommunication = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedCommunication = useCallback(
    async (input: CreateProjectCommunicationInput): Promise<void> => {
      if (apiCommunications === null) {
        throw new Error("Backend communications are not ready yet.");
      }

      setIsCommunicationsMutating(true);
      setCommunicationsError(null);

      try {
        const payload = await createProjectCommunication(deps.activeProjectSlug, input);
        setApiCommunications(
          sortCommunications([...apiCommunications, adaptProjectCommunication(payload.data.item)])
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać komunikatu.";
        setCommunicationsError(message);
        throw new Error(message);
      } finally {
        setIsCommunicationsMutating(false);
      }
    },
    [apiCommunications, deps.activeProjectSlug]
  );

  const editManagedCommunication = useCallback(
    async (id: string, input: UpdateProjectCommunicationInput): Promise<void> => {
      if (apiCommunications === null) {
        throw new Error("Backend communications are not ready yet.");
      }

      setIsCommunicationsMutating(true);
      setCommunicationsError(null);

      try {
        const payload = await updateProjectCommunication(deps.activeProjectSlug, id, input);
        setApiCommunications(
          sortCommunications(
            apiCommunications.map((communication: CommunicationMessage) =>
              communication.id === id ? adaptProjectCommunication(payload.data.item) : communication
            )
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować komunikatu.";
        setCommunicationsError(message);
        throw new Error(message);
      } finally {
        setIsCommunicationsMutating(false);
      }
    },
    [apiCommunications, deps.activeProjectSlug]
  );

  const removeManagedCommunication = useCallback(
    async (id: string): Promise<void> => {
      if (apiCommunications === null) {
        throw new Error("Backend communications are not ready yet.");
      }

      setIsCommunicationsMutating(true);
      setCommunicationsError(null);

      try {
        await deleteProjectCommunication(deps.activeProjectSlug, id);
        setApiCommunications(apiCommunications.filter((communication) => communication.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć komunikatu.";
        setCommunicationsError(message);
        throw new Error(message);
      } finally {
        setIsCommunicationsMutating(false);
      }
    },
    [apiCommunications, deps.activeProjectSlug]
  );

  const communicationsModule = useMemo<CommunicationsModuleState>(
    () => ({
      source: "api",
      isLoading: isCommunicationsLoading,
      isMutating: isCommunicationsMutating,
      error: communicationsError,
      canWrite: apiCommunications !== null,
      createCommunication: createManagedCommunication,
      editCommunication: editManagedCommunication,
      removeCommunication: removeManagedCommunication,
    }),
    [
      apiCommunications,
      communicationsError,
      createManagedCommunication,
      editManagedCommunication,
      isCommunicationsLoading,
      isCommunicationsMutating,
      removeManagedCommunication,
    ]
  );

  const value = useMemo<CommunicationsContextValue>(
    () => ({
      communications: resolvedCommunications,
      addCommunication,
      updateCommunication,
      deleteCommunication,
      communicationsModule,
    }),
    [addCommunication, communicationsModule, deleteCommunication, resolvedCommunications, updateCommunication]
  );

  return (
    <CommunicationsModuleContext.Provider value={value}>{children}</CommunicationsModuleContext.Provider>
  );
}

export function useCommunicationsModule(): CommunicationsContextValue {
  const context = useContext(CommunicationsModuleContext);

  if (!context) {
    throw new Error("useCommunicationsModule must be used inside CommunicationsProvider");
  }

  return context;
}
