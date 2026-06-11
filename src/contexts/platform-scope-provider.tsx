import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AppData, AppSystemSettings } from "@/lib/types/domain";
import {
  configureDataAccessFromSystem,
  dataAccess,
  type DataPersistenceRuntime,
  type UploadFileOptions,
  type UploadFileResult,
} from "@/lib/data/access";
import type { DataExportDiagnostics } from "@/lib/data/store";
import { EMPTY_DATA } from "@/lib/data/store";
import {
  adaptPlatformBootstrapToPreview,
  fetchPlatformBootstrap,
  type PlatformBootstrapPreviewModel,
} from "@/lib/api/platform-bootstrap";
import type {
  IntegrationCapabilityReasonCode,
  IntegrationCapabilityState,
} from "@/lib/integration/contracts";

export type PlatformBootstrapState =
  | {
      status: "loading";
      mode: "api";
    }
  | {
      status: "ready";
      mode: "api";
      preview: PlatformBootstrapPreviewModel;
    }
  | {
      status: "failed";
      mode: "api";
      error: string;
    };

export type DataPersistenceState = {
  uploadCapability: IntegrationCapabilityState;
  uploadCapabilityReason: IntegrationCapabilityReasonCode;
  uploadEndpoint: string | null;
};

export type PlatformScopeValue = {
  apiRuntimeRefreshKey: number;
  data: AppData;
  setData: (next: AppData) => void;
  loadError: string;
  platformBootstrapState: PlatformBootstrapState;
  syncPlatformBootstrapProject: (project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  }) => void;
  systemSettings: AppSystemSettings;
  setSystemSettings: (next: AppSystemSettings) => void;
  appBuildVersion: string | null;
  dataSchemaVersion: number | null;
  lastExportDiagnostics: DataExportDiagnostics | null;
  persistenceState: DataPersistenceState;
  exportData: (filename?: string) => DataExportDiagnostics;
  reloadData: () => Promise<{ ok: boolean; error?: string }>;
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
  updateAuthHashes: (adminPinHash: string) => void;
};

const PlatformScopeContext = createContext<PlatformScopeValue | null>(null);

function createPersistenceState(runtime: DataPersistenceRuntime): DataPersistenceState {
  return {
    uploadCapability: runtime.uploadCapability,
    uploadCapabilityReason: runtime.uploadCapabilityReason,
    uploadEndpoint: runtime.uploadEndpoint,
  };
}

export function PlatformScopeProvider({ children }: { children: React.ReactNode }) {
  const [data, setDataState] = useState<AppData>(EMPTY_DATA);
  const [loadError, setLoadError] = useState("");
  const [apiRuntimeRefreshKey, setApiRuntimeRefreshKey] = useState(0);
  const [lastExportDiagnostics, setLastExportDiagnostics] = useState<DataExportDiagnostics | null>(
    () => dataAccess.getLastExportDiagnostics()
  );
  const [persistenceState, setPersistenceState] = useState<DataPersistenceState>(() =>
    createPersistenceState(dataAccess.getPersistenceRuntime())
  );
  const platformBootstrapStateRef = useRef<PlatformBootstrapState>({
    status: "loading",
    mode: "api",
  });
  const [platformBootstrapState, setPlatformBootstrapState] = useState<PlatformBootstrapState>({
    status: "loading",
    mode: "api",
  });

  const syncPersistenceRuntime = useCallback(() => {
    setPersistenceState(createPersistenceState(dataAccess.getPersistenceRuntime()));
  }, []);

  const syncPlatformBootstrapProject = useCallback(
    (project: { id: string; slug: string; code: string; name: string }) => {
      setPlatformBootstrapState((current) => {
        if (current.status !== "ready") {
          return current;
        }

        return {
          ...current,
          preview: {
            ...current.preview,
            projects: current.preview.projects.map((entry) =>
              entry.id === project.id
                ? {
                    ...entry,
                    slug: project.slug,
                    code: project.code,
                    name: project.name,
                  }
                : entry
            ),
          },
        };
      });
    },
    []
  );

  useEffect(() => {
    platformBootstrapStateRef.current = platformBootstrapState;
  }, [platformBootstrapState]);

  useEffect(() => {
    const controller = new AbortController();
    const isBackgroundRefresh = platformBootstrapStateRef.current.status === "ready";

    if (!isBackgroundRefresh) {
      setPlatformBootstrapState({ status: "loading", mode: "api" });
    }

    void (async () => {
      try {
        const payload = await fetchPlatformBootstrap(controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        setPlatformBootstrapState({
          status: "ready",
          mode: "api",
          preview: adaptPlatformBootstrapToPreview(payload),
        });
        setLoadError("");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPlatformBootstrapState({
          status: "failed",
          mode: "api",
          error:
            error instanceof Error ? error.message : "Platform bootstrap request failed.",
        });
        setLoadError(
          error instanceof Error ? error.message : "Platform bootstrap request failed."
        );
      }
    })();

    return () => {
      controller.abort();
    };
  }, [apiRuntimeRefreshKey]);

  const setData = useCallback((next: AppData) => {
    configureDataAccessFromSystem(next.system);
    setDataState(next);
    syncPersistenceRuntime();
  }, [syncPersistenceRuntime]);

  const updateAuthHashes = useCallback(
    (adminPinHash: string) => {
      setData({
        ...data,
        auth: { consultantPinHash: "", adminPinHash },
      });
    },
    [data, setData]
  );

  const setSystemSettings = useCallback(
    (next: AppSystemSettings): void => {
      configureDataAccessFromSystem(next);
      setData({
        ...data,
        system: next,
      });
    },
    [data, setData]
  );

  const exportData = useCallback(
    (filename?: string): DataExportDiagnostics => {
      const diagnostics = dataAccess.exportDataToFile(data, filename);
      setLastExportDiagnostics(diagnostics);
      return diagnostics;
    },
    [data]
  );

  const reloadData = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setApiRuntimeRefreshKey((current) => current + 1);
    syncPersistenceRuntime();
    return { ok: true };
  }, [syncPersistenceRuntime]);

  const uploadFile = useCallback(
    (file: File, options?: UploadFileOptions) => dataAccess.uploadFile(file, options),
    []
  );

  const systemSettings = useMemo<AppSystemSettings>(
    () =>
      data.system ?? {
        auth: {
          identitySource: "pin",
          plannedRoles: ["admin", "editor", "agent"],
        },
        deployment: {},
      },
    [data.system]
  );

  const appBuildVersion = useMemo(
    () => (typeof __APP_VERSION__ === "string" && __APP_VERSION__.trim() ? __APP_VERSION__ : null),
    []
  );

  const dataSchemaVersion = useMemo(
    () => (typeof data.meta?.schemaVersion === "number" ? data.meta.schemaVersion : null),
    [data.meta?.schemaVersion]
  );

  const value = useMemo<PlatformScopeValue>(
    () => ({
      apiRuntimeRefreshKey,
      data,
      setData,
      loadError,
      platformBootstrapState,
      syncPlatformBootstrapProject,
      systemSettings,
      setSystemSettings,
      appBuildVersion,
      dataSchemaVersion,
      lastExportDiagnostics,
      persistenceState,
      exportData,
      reloadData,
      uploadFile,
      updateAuthHashes,
    }),
    [
      apiRuntimeRefreshKey,
      data,
      setData,
      loadError,
      platformBootstrapState,
      syncPlatformBootstrapProject,
      systemSettings,
      setSystemSettings,
      appBuildVersion,
      dataSchemaVersion,
      lastExportDiagnostics,
      persistenceState,
      exportData,
      reloadData,
      uploadFile,
      updateAuthHashes,
    ]
  );

  return <PlatformScopeContext.Provider value={value}>{children}</PlatformScopeContext.Provider>;
}

export function usePlatformScope(): PlatformScopeValue {
  const context = useContext(PlatformScopeContext);
  if (!context) {
    throw new Error("usePlatformScope must be used inside PlatformScopeProvider");
  }
  return context;
}
