import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Announcement } from "@/lib/types/domain";
import { generateId } from "@/lib/utils";
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
import type { ModuleDataSource, ProjectModuleDeps } from "./shared-module-types";

export type AnnouncementsModuleState = {
  source: ModuleDataSource;
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
    if (!deps.apiMode) {
      setApiAnnouncements(null);
      setIsAnnouncementsLoading(false);
      setIsAnnouncementsMutating(false);
      setAnnouncementsError(null);
      return;
    }

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
  }, [deps.activeProjectSlug, deps.apiMode, deps.apiRuntimeRefreshKey]);

  const resolvedAnnouncements = useMemo<Announcement[]>(
    () =>
      deps.apiMode
        ? apiAnnouncements ?? ((deps.legacyData.announcements ?? []) as Announcement[])
        : ((deps.legacyData.announcements ?? []) as Announcement[]),
    [apiAnnouncements, deps.apiMode, deps.legacyData.announcements]
  );

  const addAnnouncement = useCallback(
    (a: Omit<Announcement, "id"> & { id?: string }): Announcement => {
      const full: Announcement = { ...a, id: a.id ?? generateId("ann") };
      deps.setLegacyData({
        ...deps.legacyData,
        announcements: [...(deps.legacyData.announcements ?? []), full],
      });
      return full;
    },
    [deps]
  );

  const updateAnnouncement = useCallback(
    (updated: Announcement): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        announcements: (deps.legacyData.announcements ?? []).map((announcement: Announcement) =>
          announcement.id === updated.id ? updated : announcement
        ),
      });
    },
    [deps]
  );

  const deleteAnnouncement = useCallback(
    (id: string): void => {
      deps.setLegacyData({
        ...deps.legacyData,
        announcements: (deps.legacyData.announcements ?? []).filter(
          (announcement: Announcement) => announcement.id !== id
        ),
      });
    },
    [deps]
  );

  const createManagedAnnouncement = useCallback(
    async (input: CreateProjectAnnouncementInput): Promise<void> => {
      if (!deps.apiMode) {
        const nowIso = new Date().toISOString();

        addAnnouncement({
          title: input.title,
          body: input.body,
          description: input.description,
          color: input.color,
          active: input.active,
          visibleFrom: input.visibleFrom ?? undefined,
          visibleUntil: input.visibleUntil ?? undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
        return;
      }

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
    [addAnnouncement, apiAnnouncements, deps.activeProjectSlug, deps.apiMode]
  );

  const editManagedAnnouncement = useCallback(
    async (id: string, input: UpdateProjectAnnouncementInput): Promise<void> => {
      if (!deps.apiMode) {
        const existing = resolvedAnnouncements.find((announcement) => announcement.id === id);

        if (!existing) {
          throw new Error("Ogłoszenie nie zostało znalezione.");
        }

        updateAnnouncement({
          ...existing,
          title: input.title ?? existing.title,
          body: input.body ?? existing.body,
          description: input.description ?? existing.description,
          color: input.color ?? existing.color,
          active: input.active ?? existing.active,
          visibleFrom: Object.prototype.hasOwnProperty.call(input, "visibleFrom")
            ? (input.visibleFrom ?? undefined)
            : existing.visibleFrom,
          visibleUntil: Object.prototype.hasOwnProperty.call(input, "visibleUntil")
            ? (input.visibleUntil ?? undefined)
            : existing.visibleUntil,
          updatedAt: new Date().toISOString(),
        });
        return;
      }

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
    [apiAnnouncements, deps.activeProjectSlug, deps.apiMode, resolvedAnnouncements, updateAnnouncement]
  );

  const removeManagedAnnouncement = useCallback(
    async (id: string): Promise<void> => {
      if (!deps.apiMode) {
        deleteAnnouncement(id);
        return;
      }

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
    [apiAnnouncements, deleteAnnouncement, deps.activeProjectSlug, deps.apiMode]
  );

  const announcementsModule = useMemo<AnnouncementsModuleState>(
    () => ({
      source: deps.apiMode ? "api" : "legacy",
      isLoading: isAnnouncementsLoading,
      isMutating: isAnnouncementsMutating,
      error: announcementsError,
      canWrite: !deps.apiMode || apiAnnouncements !== null,
      createAnnouncement: createManagedAnnouncement,
      editAnnouncement: editManagedAnnouncement,
      removeAnnouncement: removeManagedAnnouncement,
    }),
    [
      announcementsError,
      apiAnnouncements,
      createManagedAnnouncement,
      deps.apiMode,
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
    [
      addAnnouncement,
      announcementsModule,
      deleteAnnouncement,
      resolvedAnnouncements,
      updateAnnouncement,
    ]
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
