import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import type {
  AppConfiguration,
  AppModuleKey,
  AppModuleSettingsMap,
  HomeSpotlight,
} from "@/lib/types/domain";
import {
  DEFAULT_NAV_ORDER,
  resolveEnabledModules,
  resolveModuleSettings,
  type ResolvedModuleSettingsMap,
} from "@/lib/config/modules";
import {
  getBootstrapPreviewDataSourceMode,
  type BootstrapPreviewDataSourceMode,
} from "@/lib/api/bootstrap-preview-runtime";
import {
  adaptProjectBootstrapConfiguration,
  adaptProjectBootstrapHomeSpotlights,
  adaptProjectBootstrapToPreview,
  fetchProjectBootstrap,
  FRONTEND_TO_BACKEND_MODULE_KEY_MAP,
  resolveProjectBootstrapPreviewRoute,
  withUpdatedProjectBootstrapConfiguration,
  type ProjectBootstrapResponse,
  type ProjectBootstrapPreviewModel,
  type ProjectBootstrapPreviewRouteContext,
} from "@/lib/api/project-bootstrap";
import {
  replaceProjectHomeSpotlights,
  updateProjectMetadata as updateProjectMetadataRequest,
  updateProjectModuleConfiguration,
  updateProjectNavigation,
} from "@/lib/api/project-configuration";
import { useToast } from "@/contexts/toast-context";
import {
  usePlatformScope,
  type PlatformBootstrapState,
} from "@/contexts/platform-scope-provider";

export type ProjectBootstrapState =
  | {
      status: "disabled";
      mode: BootstrapPreviewDataSourceMode;
      routeContext: ProjectBootstrapPreviewRouteContext | null;
    }
  | {
      status: "loading";
      mode: "api";
      routeContext: ProjectBootstrapPreviewRouteContext;
    }
  | {
      status: "ready";
      mode: "api";
      routeContext: ProjectBootstrapPreviewRouteContext;
      preview: ProjectBootstrapPreviewModel;
    }
  | {
      status: "failed";
      mode: "api";
      routeContext: ProjectBootstrapPreviewRouteContext;
      error: string;
    };

export type ShellCurrentUserDisplay = {
  displayName: string;
  initials: string;
  secondaryText: string;
};

export type ShellProjectBranding = {
  projectDisplayName: string;
  projectCode: string;
  accessLabel: string;
  title: string;
};

export type ShellNavigationOverride = {
  preferredNavKeys: string[];
  moduleVisibility: Partial<Record<AppModuleKey, boolean>>;
};

export type ShellCutover = {
  currentUserDisplay: ShellCurrentUserDisplay | null;
  projectBranding: ShellProjectBranding | null;
  navigation: ShellNavigationOverride | null;
};

/** Stable route-key identifiers for all main navigation modules, in default order. */
export const NAV_MODULE_KEYS = [...DEFAULT_NAV_ORDER] as const;

const DEFAULT_API_PROJECT_SLUG = "altcloud";

const BACKEND_TO_FRONTEND_NAV_KEY_MAP: Partial<Record<string, AppModuleKey>> = {
  matrix: "matrix",
  announcements: "announcements",
  communications: "komunikaty",
  templates: "szablony",
  pricing: "cenniki",
  phrases: "zwroty",
  links: "linki",
  forms: "formularze",
  contacts: "kontakty",
  important_topics: "tematOrg",
};

type PreferredNavKey = "home" | AppModuleKey;

export type ProjectScopeValue = {
  activeProjectSlug: string;
  projectRouteContext: ProjectBootstrapPreviewRouteContext | null;
  projectBootstrapState: ProjectBootstrapState;
  projectConfiguration: AppConfiguration;
  bootstrapProjectConfiguration: ProjectBootstrapResponse["configuration"] | null;
  resolvedHomeSpotlights: HomeSpotlight[];
  navOrder: string[];
  enabledModules: Record<AppModuleKey, boolean>;
  moduleSettings: ResolvedModuleSettingsMap;
  shellCutover: ShellCutover;
  setNavOrder: (order: string[]) => Promise<void>;
  setModuleEnabled: (moduleKey: AppModuleKey, enabled: boolean) => Promise<void>;
  setModuleSettings: <K extends AppModuleKey>(
    moduleKey: K,
    settings: NonNullable<AppModuleSettingsMap[K]>
  ) => Promise<void>;
  setHomeSpotlights: (items: HomeSpotlight[]) => Promise<void>;
  updateProjectMetadata: (input: { slug: string; code: string; name: string }) => Promise<{
    slug: string;
    code: string;
    name: string;
  }>;
  syncProjectBootstrapConfiguration: (
    configuration: ProjectBootstrapResponse["configuration"]
  ) => void;
  syncProjectBootstrapMatrixCategoryOrder: (orderedCategoryNames: string[]) => void;
};

const ProjectScopeContext = createContext<ProjectScopeValue | null>(null);

function createInitials(displayName: string): string {
  const words = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "--";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function buildShellCutover(
  platformState: PlatformBootstrapState,
  projectState: ProjectBootstrapState
): ShellCutover {
  const currentUserDisplay =
    platformState.status === "ready"
      ? {
          displayName: platformState.preview.currentUser.displayName,
          initials: createInitials(platformState.preview.currentUser.displayName),
          secondaryText: `${platformState.preview.currentUser.email} • ${platformState.preview.currentUser.globalRole}`,
        }
      : null;

  const projectBranding =
    projectState.status === "ready"
      ? {
          projectDisplayName: projectState.preview.project.name,
          projectCode: projectState.preview.project.code,
          accessLabel: projectState.preview.access.isLocked ? "restricted" : "aktywny",
          title: projectState.preview.access.isLocked
            ? `${projectState.preview.project.name} (${projectState.preview.project.code}) • dostęp ograniczony`
            : `${projectState.preview.project.name} (${projectState.preview.project.code}) • projekt aktywny`,
        }
      : null;

  const preferredNavKeys =
    projectState.status === "ready" && !projectState.preview.access.isLocked
      ? projectState.preview.navigation
          .map((entry) => {
            if (entry.key === "home") {
              return "home";
            }

            return BACKEND_TO_FRONTEND_NAV_KEY_MAP[entry.key] ?? null;
          })
          .filter((entry): entry is PreferredNavKey => entry !== null)
      : [];

  const navigation =
    projectState.status === "ready" && !projectState.preview.access.isLocked
      ? {
          preferredNavKeys,
          moduleVisibility: Object.fromEntries(
            preferredNavKeys.flatMap((navKey) =>
              navKey === "home" ? [] : [[navKey, true] as const]
            )
          ) as Partial<Record<AppModuleKey, boolean>>,
        }
      : null;

  return {
    currentUserDisplay,
    projectBranding,
    navigation,
  };
}

export function ProjectScopeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { push: toast } = useToast();
  const {
    apiMode,
    apiRuntimeRefreshKey,
    data,
    setData,
    setSystemSettings,
    platformBootstrapState,
    syncPlatformBootstrapProject,
  } = usePlatformScope();

  const projectRouteContext = useMemo(
    () => resolveProjectBootstrapPreviewRoute(pathname),
    [pathname]
  );
  const projectRouteSlug = projectRouteContext?.projectSlug ?? null;
  const activeProjectSlug = projectRouteContext?.projectSlug ?? DEFAULT_API_PROJECT_SLUG;

  const [projectBootstrapState, setProjectBootstrapState] = useState<ProjectBootstrapState>(() => {
    const mode = getBootstrapPreviewDataSourceMode();

    if (mode !== "api" || !projectRouteContext) {
      return {
        status: "disabled",
        mode,
        routeContext: projectRouteContext,
      };
    }

    return {
      status: "loading",
      mode: "api",
      routeContext: projectRouteContext,
    };
  });

  const syncProjectBootstrapConfiguration = useCallback(
    (configuration: ProjectBootstrapResponse["configuration"]): void => {
      setProjectBootstrapState((current) => {
        if (current.mode !== "api" || current.status !== "ready") {
          return current;
        }

        if (current.routeContext.projectSlug !== activeProjectSlug) {
          return current;
        }

        return {
          ...current,
          preview: withUpdatedProjectBootstrapConfiguration(current.preview, configuration),
        };
      });
    },
    [activeProjectSlug]
  );

  const patchProjectBootstrapModuleSettings = useCallback(
    (moduleKey: AppModuleKey, settings: unknown): void => {
      const backendModuleKey = FRONTEND_TO_BACKEND_MODULE_KEY_MAP[moduleKey];

      setProjectBootstrapState((current) => {
        if (current.mode !== "api" || current.status !== "ready") {
          return current;
        }

        if (current.routeContext.projectSlug !== activeProjectSlug) {
          return current;
        }

        const existingModule = current.preview.configuration.modules[backendModuleKey];

        if (!existingModule) {
          return current;
        }

        return {
          ...current,
          preview: {
            ...current.preview,
            configuration: {
              ...current.preview.configuration,
              modules: {
                ...current.preview.configuration.modules,
                [backendModuleKey]: {
                  ...existingModule,
                  settings: settings as Record<string, unknown>,
                },
              },
            },
          },
        };
      });
    },
    [activeProjectSlug]
  );

  const syncProjectBootstrapProject = useCallback(
    (
      project: ProjectBootstrapResponse["project"],
      configuration?: ProjectBootstrapResponse["configuration"]
    ): void => {
      setProjectBootstrapState((current) => {
        if (current.mode !== "api" || current.status !== "ready") {
          return current;
        }

        if (current.routeContext.projectSlug !== activeProjectSlug) {
          return current;
        }

        const nextPreview = configuration
          ? withUpdatedProjectBootstrapConfiguration(current.preview, configuration)
          : current.preview;
        const nextRouteContext = {
          ...current.routeContext,
          projectSlug: project.slug,
        };

        return {
          ...current,
          routeContext: nextRouteContext,
          preview: {
            ...nextPreview,
            routeContext: nextRouteContext,
            project,
          },
        };
      });
    },
    [activeProjectSlug]
  );

  const syncProjectBootstrapMatrixCategoryOrder = useCallback(
    (orderedCategoryNames: string[]): void => {
      setProjectBootstrapState((current) => {
        if (current.mode !== "api" || current.status !== "ready") {
          return current;
        }

        if (current.routeContext.projectSlug !== activeProjectSlug || current.preview.access.isLocked) {
          return current;
        }

        return {
          ...current,
          preview: withUpdatedProjectBootstrapConfiguration(current.preview, {
            ...current.preview.configuration,
            rules: {
              ...current.preview.configuration.rules,
              matrixCategoryOrder: orderedCategoryNames,
            },
          }),
        };
      });
    },
    [activeProjectSlug]
  );

  useEffect(() => {
    if (!apiMode || !projectRouteContext) {
      return;
    }

    setProjectBootstrapState((current) => {
      if (current.mode !== "api" || current.status === "disabled") {
        return current;
      }

      if (current.routeContext.projectSlug !== projectRouteContext.projectSlug) {
        return current;
      }

      if (current.status === "ready") {
        return {
          ...current,
          routeContext: projectRouteContext,
          preview: {
            ...current.preview,
            routeContext: projectRouteContext,
          },
        };
      }

      if (current.status === "loading" || current.status === "failed") {
        return {
          ...current,
          routeContext: projectRouteContext,
        };
      }

      return current;
    });
  }, [apiMode, projectRouteContext]);

  useEffect(() => {
    if (!projectRouteContext || !apiMode) {
      setProjectBootstrapState({
        status: "disabled",
        mode: getBootstrapPreviewDataSourceMode(),
        routeContext: projectRouteContext,
      });
      return;
    }

    const controller = new AbortController();

    setProjectBootstrapState((current) => {
      if (
        current.mode === "api" &&
        current.status === "ready" &&
        current.routeContext.projectSlug === projectRouteContext.projectSlug
      ) {
        return current;
      }

      return {
        status: "loading",
        mode: "api",
        routeContext: projectRouteContext,
      };
    });

    void (async () => {
      try {
        const payload = await fetchProjectBootstrap(projectRouteContext.projectSlug, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setProjectBootstrapState({
          status: "ready",
          mode: "api",
          routeContext: projectRouteContext,
          preview: adaptProjectBootstrapToPreview(projectRouteContext, payload),
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setProjectBootstrapState({
          status: "failed",
          mode: "api",
          routeContext: projectRouteContext,
          error: error instanceof Error ? error.message : "Project bootstrap request failed.",
        });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [apiMode, apiRuntimeRefreshKey, projectRouteSlug]);

  const bootstrapProjectConfiguration = useMemo(
    () =>
      apiMode &&
      projectBootstrapState.status === "ready" &&
      !projectBootstrapState.preview.access.isLocked
        ? projectBootstrapState.preview.configuration
        : null,
    [apiMode, projectBootstrapState]
  );

  const resolvedHomeSpotlights = useMemo(() => {
    if (!bootstrapProjectConfiguration) {
      return data.homeSpotlights ?? [];
    }

    const adapted = adaptProjectBootstrapHomeSpotlights(bootstrapProjectConfiguration);
    return adapted.managed ? adapted.items : data.homeSpotlights ?? [];
  }, [bootstrapProjectConfiguration, data.homeSpotlights]);

  const projectConfiguration = useMemo<AppConfiguration>(() => {
    const baseConfiguration = data.configuration ?? {};

    if (
      !apiMode ||
      projectBootstrapState.status !== "ready" ||
      projectBootstrapState.preview.access.isLocked
    ) {
      return baseConfiguration;
    }

    const apiConfiguration = adaptProjectBootstrapConfiguration(
      projectBootstrapState.preview.configuration
    );

    return {
      ...baseConfiguration,
      modules: apiConfiguration.modules,
      navigation: apiConfiguration.navigation,
      rules: {
        ...(baseConfiguration.rules ?? {}),
        ...(apiConfiguration.rules ?? {}),
      },
    };
  }, [apiMode, data.configuration, projectBootstrapState]);

  const enabledModules = useMemo(
    () => resolveEnabledModules(projectConfiguration.modules?.enabled),
    [projectConfiguration]
  );

  const moduleSettings = useMemo(
    () => resolveModuleSettings(projectConfiguration.modules?.settings),
    [projectConfiguration]
  );

  const navOrder = useMemo(() => {
    const persisted =
      projectConfiguration.navigation?.mainNavOrder ?? data.navOrder ?? [];
    const all = [...NAV_MODULE_KEYS];
    const extra = all.filter((k) => !persisted.includes(k));
    return [...persisted.filter((k) => (all as string[]).includes(k)), ...extra];
  }, [data.navOrder, projectConfiguration]);

  const shellCutover = useMemo(
    () => buildShellCutover(platformBootstrapState, projectBootstrapState),
    [platformBootstrapState, projectBootstrapState]
  );

  const setNavOrder = useCallback(
    async (order: string[]): Promise<void> => {
      if (!apiMode) {
        setData({
          ...data,
          navOrder: order,
          configuration: {
            ...data.configuration,
            navigation: {
              ...data.configuration?.navigation,
              mainNavOrder: order,
            },
          },
        });
        return;
      }

      try {
        const payload = await updateProjectNavigation(activeProjectSlug, order);
        syncProjectBootstrapConfiguration(payload.data.configuration);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać kolejności nawigacji projektu.";
        toast("error", message);
        throw new Error(message);
      }
    },
    [activeProjectSlug, apiMode, data, setData, syncProjectBootstrapConfiguration, toast]
  );

  const setModuleEnabled = useCallback(
    async (moduleKey: AppModuleKey, enabled: boolean): Promise<void> => {
      if (!apiMode) {
        setData({
          ...data,
          configuration: {
            ...data.configuration,
            modules: {
              ...data.configuration?.modules,
              enabled: {
                ...resolveEnabledModules(data.configuration?.modules?.enabled),
                [moduleKey]: enabled,
              },
            },
          },
        });
        return;
      }

      try {
        const payload = await updateProjectModuleConfiguration(activeProjectSlug, moduleKey, {
          enabled,
        });
        syncProjectBootstrapConfiguration(payload.data.configuration);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać ustawienia modułu projektu.";
        toast("error", message);
        throw new Error(message);
      }
    },
    [activeProjectSlug, apiMode, data, setData, syncProjectBootstrapConfiguration, toast]
  );

  const setModuleSettings = useCallback(
    <K extends AppModuleKey>(
      moduleKey: K,
      settings: NonNullable<AppModuleSettingsMap[K]>
    ): Promise<void> => {
      if (!apiMode) {
        setData({
          ...data,
          configuration: {
            ...data.configuration,
            modules: {
              ...data.configuration?.modules,
              settings: {
                ...(data.configuration?.modules?.settings ?? {}),
                [moduleKey]: settings,
              },
            },
          },
        });
        return Promise.resolve();
      }

      patchProjectBootstrapModuleSettings(moduleKey, settings);

      return updateProjectModuleConfiguration(activeProjectSlug, moduleKey, { settings })
        .then((payload) => {
          syncProjectBootstrapConfiguration(payload.data.configuration);
        })
        .catch((caught) => {
          const message =
            caught instanceof Error
              ? caught.message
              : "Nie udało się zapisać ustawień modułu projektu.";
          toast("error", message);
          throw new Error(message);
        });
    },
    [
      activeProjectSlug,
      apiMode,
      data,
      patchProjectBootstrapModuleSettings,
      setData,
      syncProjectBootstrapConfiguration,
      toast,
    ]
  );

  const setHomeSpotlights = useCallback(
    async (items: HomeSpotlight[]): Promise<void> => {
      if (!apiMode) {
        setData({ ...data, homeSpotlights: items });
        return;
      }

      try {
        const payload = await replaceProjectHomeSpotlights(activeProjectSlug, items);
        syncProjectBootstrapConfiguration(payload.data.configuration);
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać wyróżnionych tematów strony głównej.";
        toast("error", message);
        throw new Error(message);
      }
    },
    [activeProjectSlug, apiMode, data, setData, syncProjectBootstrapConfiguration, toast]
  );

  const updateProjectMetadata = useCallback(
    async (input: { slug: string; code: string; name: string }): Promise<{
      slug: string;
      code: string;
      name: string;
    }> => {
      const nextSlug = input.slug.trim().toLowerCase();
      const nextCode = input.code.trim();
      const nextName = input.name.trim();

      if (!apiMode) {
        setSystemSettings({
          ...(data.system ?? {}),
          deployment: {
            ...(data.system?.deployment ?? {}),
            projectCode: nextCode,
            projectDisplayName: nextName,
          },
        });
        return {
          slug: nextSlug,
          code: nextCode,
          name: nextName,
        };
      }

      try {
        const payload = await updateProjectMetadataRequest(activeProjectSlug, {
          slug: nextSlug,
          code: nextCode,
          name: nextName,
        });
        syncProjectBootstrapProject(payload.data.project, payload.data.configuration);
        syncPlatformBootstrapProject(payload.data.project);
        return {
          slug: payload.data.project.slug,
          code: payload.data.project.code,
          name: payload.data.project.name,
        };
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : "Nie udało się zapisać metadanych projektu.";
        toast("error", message);
        throw new Error(message);
      }
    },
    [
      activeProjectSlug,
      apiMode,
      data.system,
      setSystemSettings,
      syncPlatformBootstrapProject,
      syncProjectBootstrapProject,
      toast,
    ]
  );

  const value = useMemo<ProjectScopeValue>(
    () => ({
      activeProjectSlug,
      projectRouteContext,
      projectBootstrapState,
      projectConfiguration,
      bootstrapProjectConfiguration,
      resolvedHomeSpotlights,
      navOrder,
      enabledModules,
      moduleSettings,
      shellCutover,
      setNavOrder,
      setModuleEnabled,
      setModuleSettings,
      setHomeSpotlights,
      updateProjectMetadata,
      syncProjectBootstrapConfiguration,
      syncProjectBootstrapMatrixCategoryOrder,
    }),
    [
      activeProjectSlug,
      projectRouteContext,
      projectBootstrapState,
      projectConfiguration,
      bootstrapProjectConfiguration,
      resolvedHomeSpotlights,
      navOrder,
      enabledModules,
      moduleSettings,
      shellCutover,
      setNavOrder,
      setModuleEnabled,
      setModuleSettings,
      setHomeSpotlights,
      updateProjectMetadata,
      syncProjectBootstrapConfiguration,
      syncProjectBootstrapMatrixCategoryOrder,
    ]
  );

  return <ProjectScopeContext.Provider value={value}>{children}</ProjectScopeContext.Provider>;
}

export function useProjectScope(): ProjectScopeValue {
  const context = useContext(ProjectScopeContext);
  if (!context) {
    throw new Error("useProjectScope must be used inside ProjectScopeProvider");
  }
  return context;
}
