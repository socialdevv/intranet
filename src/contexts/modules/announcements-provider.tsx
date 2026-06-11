import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Announcement } from "@/lib/types/domain";
import {
  adaptProjectAnnouncement,
  adaptProjectAnnouncements,
  createProjectAnnouncement,
  deleteProjectAnnouncement,
  fetchProjectAnnouncements,
  updateProjectAnnouncement,
  type CreateProjectAnnouncementInput,
  type UpdateProjectAnnouncementInput,
} from "@/lib/api/project-announcements";
import type { ProjectModuleDeps } from "./shared-module-types";

const LEGACY_MUTATION_ERROR = "Legacy mutations are disabled in API mode";

export type AnnouncementsModuleState = {
  source: "api";
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  canWrite: boolean;
  createAnnouncement: (input: CreateProjectAnnouncementInput) => Promise<void>;
  editAnnouncement: (id: string, input: UpdateProjectAnnouncementInput) => Promise<void>;
  removeAnnouncement: (id: string) => Promise<void>;
};

type AnnouncementsContextValue = {
  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, "id"> & { id?: string }) => Announcement;
  updateAnnouncement: (updated: Announcement) => void;
  deleteAnnouncement: (id: string) => void;
  announcementsModule: AnnouncementsModuleState;
};

const AnnouncementsModuleContext = createContext<AnnouncementsContextValue | null>(null);

export function AnnouncementsProvider({
  deps,
  children,
}: {
  deps: ProjectModuleDeps;
  children: React.ReactNode;
}) {
  const [apiAnnouncements, setApiAnnouncements] = useState<Announcement[] | null>(null);
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false);
  const [isAnnouncementsMutating, setIsAnnouncementsMutating] = useState(false);
  const [announcementsError, setAnnouncementsError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsAnnouncementsLoading(true);
    setAnnouncementsError(null);

    void (async () => {
      try {
        const payload = await fetchProjectAnnouncements(deps.activeProjectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setApiAnnouncements(adaptProjectAnnouncements(payload));
      } catch (caught) {
        if (controller.signal.aborted) {
          return;
        }

        setApiAnnouncements(null);
        setAnnouncementsError(
          caught instanceof Error ? caught.message : "Nie udało się załadować ogłoszeń z backendu."
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsAnnouncementsLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [deps.activeProjectSlug, deps.apiRuntimeRefreshKey]);

  const resolvedAnnouncements = useMemo<Announcement[]>(() => apiAnnouncements ?? [], [apiAnnouncements]);

  const addAnnouncement = useCallback(
    (_a: Omit<Announcement, "id"> & { id?: string }): Announcement => {
      throw new Error(LEGACY_MUTATION_ERROR);
    },
    []
  );

  const updateAnnouncement = useCallback((_updated: Announcement): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const deleteAnnouncement = useCallback((_id: string): void => {
    throw new Error(LEGACY_MUTATION_ERROR);
  }, []);

  const createManagedAnnouncement = useCallback(
    async (input: CreateProjectAnnouncementInput): Promise<void> => {
      if (apiAnnouncements === null) {
        throw new Error("Backend announcements are not ready yet.");
      }

      setIsAnnouncementsMutating(true);
      setAnnouncementsError(null);

      try {
        const payload = await createProjectAnnouncement(deps.activeProjectSlug, input);
        setApiAnnouncements([...apiAnnouncements, adaptProjectAnnouncement(payload.data.item)]);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się dodać ogłoszenia.";
        setAnnouncementsError(message);
        throw new Error(message);
      } finally {
        setIsAnnouncementsMutating(false);
      }
    },
    [apiAnnouncements, deps.activeProjectSlug]
  );

  const editManagedAnnouncement = useCallback(
    async (id: string, input: UpdateProjectAnnouncementInput): Promise<void> => {
      if (apiAnnouncements === null) {
        throw new Error("Backend announcements are not ready yet.");
      }

      setIsAnnouncementsMutating(true);
      setAnnouncementsError(null);

      try {
        const payload = await updateProjectAnnouncement(deps.activeProjectSlug, id, input);
        setApiAnnouncements(
          apiAnnouncements.map((announcement: Announcement) =>
            announcement.id === id ? adaptProjectAnnouncement(payload.data.item) : announcement
          )
        );
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się zaktualizować ogłoszenia.";
        setAnnouncementsError(message);
        throw new Error(message);
      } finally {
        setIsAnnouncementsMutating(false);
      }
    },
    [apiAnnouncements, deps.activeProjectSlug]
  );

  const removeManagedAnnouncement = useCallback(
    async (id: string): Promise<void> => {
      if (apiAnnouncements === null) {
        throw new Error("Backend announcements are not ready yet.");
      }

      setIsAnnouncementsMutating(true);
      setAnnouncementsError(null);

      try {
        await deleteProjectAnnouncement(deps.activeProjectSlug, id);
        setApiAnnouncements(apiAnnouncements.filter((announcement) => announcement.id !== id));
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Nie udało się usunąć ogłoszenia.";
        setAnnouncementsError(message);
        throw new Error(message);
      } finally {
        setIsAnnouncementsMutating(false);
      }
    },
    [apiAnnouncements, deps.activeProjectSlug]
  );

  const announcementsModule = useMemo<AnnouncementsModuleState>(
    () => ({
      source: "api",
      isLoading: isAnnouncementsLoading,
      isMutating: isAnnouncementsMutating,
      error: announcementsError,
      canWrite: apiAnnouncements !== null,
      createAnnouncement: createManagedAnnouncement,
      editAnnouncement: editManagedAnnouncement,
      removeAnnouncement: removeManagedAnnouncement,
    }),
    [
      announcementsError,
      apiAnnouncements,
      createManagedAnnouncement,
      editManagedAnnouncement,
      isAnnouncementsLoading,
      isAnnouncementsMutating,
      removeManagedAnnouncement,
    ]
  );

  const value = useMemo<AnnouncementsContextValue>(
    () => ({
      announcements: resolvedAnnouncements,
      addAnnouncement,
      updateAnnouncement,
      deleteAnnouncement,
      announcementsModule,
    }),
    [addAnnouncement, announcementsModule, deleteAnnouncement, resolvedAnnouncements, updateAnnouncement]
  );

  return (
    <AnnouncementsModuleContext.Provider value={value}>{children}</AnnouncementsModuleContext.Provider>
  );
}

export function useAnnouncementsModule(): AnnouncementsContextValue {
  const context = useContext(AnnouncementsModuleContext);

  if (!context) {
    throw new Error("useAnnouncementsModule must be used inside AnnouncementsProvider");
  }

  return context;
}
