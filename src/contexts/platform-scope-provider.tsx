import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import type { AppData, AppSystemSettings } from "@/lib/types/domain";
import {
  configureDataAccessFromSystem,
  dataAccess,
  type DataExportDiagnostics,
  type DataImportDiagnostics,
  type DataLoadDiagnostics,
  type DataPersistenceRuntime,
  type DataStorageMode,
  type UploadFileOptions,
  type UploadFileResult,
} from "@/lib/data/access";
import { EMPTY_DATA } from "@/lib/data/store";
import {
  adaptPlatformBootstrapToPreview,
  fetchPlatformBootstrap,
  getPlatformDataSourceMode,
  type PlatformBootstrapPreviewModel,
  type PlatformDataSourceMode,
} from "@/lib/api/platform-bootstrap";
import { isApiBootstrapPreviewEnabled } from "@/lib/api/bootstrap-preview-runtime";
import type {
  IntegrationCapabilityReasonCode,
  IntegrationCapabilityState,
  IntegrationOutcome,
  SaveContractCode,
} from "@/lib/integration/contracts";
import { ROUTES } from "@/lib/routes";
import { useToast } from "@/contexts/toast-context";

export type PersistenceStatus = "idle" | "unsaved" | "saving" | "saved" | "failed";

export type PlatformBootstrapState =
  | {
      status: "disabled";
      mode: PlatformDataSourceMode;
    }
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
  status: PersistenceStatus;
  hasPendingChanges: boolean;
  isSaving: boolean;
  storageMode: DataStorageMode;
  directApiSaveReady: boolean;
  appDataLocalStorageSuppressed: boolean;
  saveCapability: IntegrationCapabilityState;
  saveCapabilityReason: IntegrationCapabilityReasonCode;
  uploadCapability: IntegrationCapabilityState;
  uploadCapabilityReason: IntegrationCapabilityReasonCode;
  fallbackModeActive: boolean;
  lastSaveOutcome: IntegrationOutcome | null;
  lastSaveCode: SaveContractCode | null;
  lastPersistedVia: "local" | "api" | "memory" | null;
  lastSavedAt: string | null;
  lastWarning: string | null;
  lastError: string | null;
};

export type PlatformScopeValue = {
  apiMode: boolean;
  apiRuntimeRefreshKey: number;
  data: AppData;
  setData: (next: AppData) => void;
  isLoading: boolean;
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
  lastLoadDiagnostics: DataLoadDiagnostics | null;
  lastImportDiagnostics: DataImportDiagnostics | null;
  lastExportDiagnostics: DataExportDiagnostics | null;
  dataStorageMode: DataStorageMode;
  persistenceState: DataPersistenceState;
  retryPendingSave: () => void;
  exportData: (filename?: string) => DataExportDiagnostics;
  importData: (jsonString: string) => {
    ok: boolean;
    error?: string;
    diagnostics?: DataImportDiagnostics;
  };
  reloadData: () => Promise<{ ok: boolean; error?: string }>;
  resetToDefault: () => Promise<{ ok: boolean; error?: string }>;
  clearLocalOverrides: () => void;
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
  localOverrideActive: boolean;
  storedLocalOverrideAvailable: boolean;
  updateAuthHashes: (adminPinHash: string) => void;
};

const DATA_FRESHNESS_COOLDOWN_MS = 45_000;

const PlatformScopeContext = createContext<PlatformScopeValue | null>(null);

function canAutoRefreshDataForPath(pathname: string): boolean {
  if (pathname === ROUTES.login) return false;
  if (pathname === ROUTES.admin || pathname.startsWith(`${ROUTES.admin}/`)) return false;
  return true;
}

function createPersistenceState(
  runtime: DataPersistenceRuntime,
  input: Partial<DataPersistenceState> = {}
): DataPersistenceState {
  return {
    status: input.status ?? "idle",
    hasPendingChanges: input.hasPendingChanges ?? false,
    isSaving: input.isSaving ?? false,
    storageMode: runtime.storageMode,
    directApiSaveReady: runtime.directApiSaveReady,
    appDataLocalStorageSuppressed: runtime.appDataLocalStorageSuppressed,
    saveCapability: runtime.saveCapability,
    saveCapabilityReason: runtime.saveCapabilityReason,
    uploadCapability: runtime.uploadCapability,
    uploadCapabilityReason: runtime.uploadCapabilityReason,
    fallbackModeActive:
      input.fallbackModeActive ??
      (runtime.storageMode === "file-local" || !runtime.directApiSaveReady),
    lastSaveOutcome: input.lastSaveOutcome ?? null,
    lastSaveCode: input.lastSaveCode ?? null,
    lastPersistedVia: input.lastPersistedVia ?? null,
    lastSavedAt: input.lastSavedAt ?? null,
    lastWarning: input.lastWarning ?? null,
    lastError: input.lastError ?? null,
  };
}

export function PlatformScopeProvider({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { push: toast } = useToast();
  const apiMode = isApiBootstrapPreviewEnabled();

  const [data, setDataState] = useState<AppData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [apiRuntimeRefreshKey, setApiRuntimeRefreshKey] = useState(0);
  const [localOverrideActive, setLocalOverrideActive] = useState(() => dataAccess.hasLocalOverride());
  const [storedLocalOverrideAvailable, setStoredLocalOverrideAvailable] = useState(
    () => dataAccess.hasStoredLocalOverride()
  );
  const [lastLoadDiagnostics, setLastLoadDiagnostics] = useState<DataLoadDiagnostics | null>(
    () => dataAccess.getLastLoadDiagnostics()
  );
  const [lastImportDiagnostics, setLastImportDiagnostics] = useState<DataImportDiagnostics | null>(
    () => dataAccess.getLastImportDiagnostics()
  );
  const [lastExportDiagnostics, setLastExportDiagnostics] = useState<DataExportDiagnostics | null>(
    () => dataAccess.getLastExportDiagnostics()
  );
  const [persistenceState, setPersistenceState] = useState<DataPersistenceState>(() =>
    createPersistenceState(dataAccess.getPersistenceRuntime())
  );
  const pendingSaveRef = useRef<AppData | null>(null);
  const isDrainingSavesRef = useRef(false);
  const lastSaveFeedbackKeyRef = useRef<string | null>(null);
  const isFreshnessReloadInFlightRef = useRef(false);
  const lastFreshnessReloadAtRef = useRef(0);
  const [platformBootstrapState, setPlatformBootstrapState] = useState<PlatformBootstrapState>(() => {
    const mode = getPlatformDataSourceMode();
    return mode === "api" ? { status: "loading", mode: "api" } : { status: "disabled", mode };
  });

  const syncPlatformBootstrapProject = useCallback(
    (project: { id: string; slug: string; code: string; name: string }): void => {
      setPlatformBootstrapState((current) => {
        if (current.mode !== "api" || current.status !== "ready") {
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

  const syncPersistenceRuntime = useCallback((input: Partial<DataPersistenceState> = {}) => {
    const runtime = dataAccess.getPersistenceRuntime();
    setPersistenceState((prev) =>
      createPersistenceState(runtime, {
        status: input.status ?? prev.status,
        hasPendingChanges: input.hasPendingChanges ?? prev.hasPendingChanges,
        isSaving: input.isSaving ?? prev.isSaving,
        appDataLocalStorageSuppressed:
          input.appDataLocalStorageSuppressed ?? prev.appDataLocalStorageSuppressed,
        fallbackModeActive: input.fallbackModeActive ?? prev.fallbackModeActive,
        lastSaveOutcome: input.lastSaveOutcome ?? prev.lastSaveOutcome,
        lastSaveCode: input.lastSaveCode ?? prev.lastSaveCode,
        lastPersistedVia: input.lastPersistedVia ?? prev.lastPersistedVia,
        lastSavedAt: input.lastSavedAt ?? prev.lastSavedAt,
        lastWarning: input.lastWarning ?? prev.lastWarning,
        lastError: input.lastError ?? prev.lastError,
      })
    );
  }, []);

  const drainPendingSaves = useCallback(() => {
    if (isDrainingSavesRef.current) return;
    isDrainingSavesRef.current = true;

    void (async () => {
      while (pendingSaveRef.current) {
        const nextToSave = pendingSaveRef.current;
        pendingSaveRef.current = null;

        syncPersistenceRuntime({
          status: "saving",
          isSaving: true,
          hasPendingChanges: true,
          lastError: null,
        });

        const result = await dataAccess.saveAppData(nextToSave);
        const hasQueuedChange = pendingSaveRef.current !== null;
        setLocalOverrideActive(dataAccess.hasLocalOverride());
        setStoredLocalOverrideAvailable(dataAccess.hasStoredLocalOverride());

        if (!result.ok) {
          const shouldPauseForRetry = !hasQueuedChange;
          if (shouldPauseForRetry) {
            pendingSaveRef.current = nextToSave;
          }

          syncPersistenceRuntime({
            status: "failed",
            isSaving: hasQueuedChange,
            hasPendingChanges: true,
            lastSaveOutcome: result.outcome,
            lastSaveCode: result.code,
            lastError: result.error,
            lastWarning: null,
          });

          const feedbackKey = `${result.code}:${result.error}`;
          if (lastSaveFeedbackKeyRef.current !== feedbackKey) {
            toast("error", `Błąd zapisu danych: ${result.error}`, 6200);
            lastSaveFeedbackKeyRef.current = feedbackKey;
          }

          if (shouldPauseForRetry) {
            break;
          }
          continue;
        }

        const runtime = dataAccess.getPersistenceRuntime();
        const fallbackModeActive =
          runtime.storageMode === "file-local" ||
          !runtime.directApiSaveReady ||
          result.outcome === "fallback" ||
          result.persistedVia === "local" ||
          result.persistedVia === "memory";

        syncPersistenceRuntime({
          status: hasQueuedChange ? "saving" : "saved",
          isSaving: hasQueuedChange,
          hasPendingChanges: hasQueuedChange,
          appDataLocalStorageSuppressed: runtime.appDataLocalStorageSuppressed,
          lastSaveOutcome: result.outcome,
          lastSaveCode: result.code,
          lastPersistedVia: result.persistedVia,
          lastSavedAt: new Date().toISOString(),
          lastWarning: result.warning ?? null,
          lastError: null,
          fallbackModeActive,
        });

        if (!hasQueuedChange && (result.outcome === "fallback" || result.outcome === "warning")) {
          const feedbackMessage =
            result.warning ??
            (result.outcome === "fallback"
              ? "Zapisano lokalnie jako fallback."
              : "Zapis został wykonany z ostrzeżeniem.");
          const feedbackKey = `${result.code}:${feedbackMessage}`;
          if (lastSaveFeedbackKeyRef.current !== feedbackKey) {
            toast("info", feedbackMessage, 5200);
            lastSaveFeedbackKeyRef.current = feedbackKey;
          }
        }

        if (result.outcome === "success" && result.persistedVia === "api") {
          lastSaveFeedbackKeyRef.current = null;
        }
      }

      isDrainingSavesRef.current = false;
    })();
  }, [syncPersistenceRuntime, toast]);

  const queuePersistedSave = useCallback(
    (next: AppData) => {
      pendingSaveRef.current = next;
      syncPersistenceRuntime({
        status: "unsaved",
        hasPendingChanges: true,
        isSaving: isDrainingSavesRef.current,
      });
      drainPendingSaves();
    },
    [drainPendingSaves, syncPersistenceRuntime]
  );

  const retryPendingSave = useCallback(() => {
    if (isDrainingSavesRef.current) return;
    if (!pendingSaveRef.current) {
      pendingSaveRef.current = data;
    }
    syncPersistenceRuntime({
      status: "unsaved",
      hasPendingChanges: true,
      isSaving: false,
      lastError: null,
    });
    drainPendingSaves();
  }, [data, drainPendingSaves, syncPersistenceRuntime]);

  useEffect(() => {
    dataAccess
      .loadAppData()
      .then((loaded) => {
        configureDataAccessFromSystem(loaded.system);
        setDataState(loaded);
        setLoadError("");
        setLocalOverrideActive(dataAccess.hasLocalOverride());
        setStoredLocalOverrideAvailable(dataAccess.hasStoredLocalOverride());
        setLastLoadDiagnostics(dataAccess.getLastLoadDiagnostics());
        syncPersistenceRuntime({
          status: "idle",
          hasPendingChanges: false,
          isSaving: false,
          lastSaveOutcome: null,
          lastSaveCode: null,
          lastError: null,
          lastWarning: null,
        });
      })
      .catch(() => {
        setLoadError("Nie udało się wczytać danych aplikacji.");
      })
      .finally(() => setIsLoading(false));
  }, [syncPersistenceRuntime]);

  useEffect(() => {
    if (!apiMode) {
      setPlatformBootstrapState({
        status: "disabled",
        mode: getPlatformDataSourceMode(),
      });
      return;
    }

    const controller = new AbortController();
    setPlatformBootstrapState({ status: "loading", mode: "api" });

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
      }
    })();

    return () => {
      controller.abort();
    };
  }, [apiMode, apiRuntimeRefreshKey]);

  const setData = useCallback(
    (next: AppData) => {
      configureDataAccessFromSystem(next.system);
      setDataState(next);
      queuePersistedSave(next);
    },
    [queuePersistedSave]
  );

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

  const importData = useCallback(
    (jsonString: string): {
      ok: boolean;
      error?: string;
      diagnostics?: DataImportDiagnostics;
    } => {
      const result = dataAccess.parseImportedData(jsonString);
      const diagnostics = dataAccess.getLastImportDiagnostics();
      setLastImportDiagnostics(diagnostics);
      if (!result.ok) return { ok: false, error: result.error, diagnostics: diagnostics ?? undefined };
      setData(result.data);
      return { ok: true, diagnostics: diagnostics ?? undefined };
    },
    [setData]
  );

  const reloadData = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      const loaded = await dataAccess.loadAppData();
      configureDataAccessFromSystem(loaded.system);
      pendingSaveRef.current = null;
      setDataState(loaded);
      setLoadError("");
      setLocalOverrideActive(dataAccess.hasLocalOverride());
      setStoredLocalOverrideAvailable(dataAccess.hasStoredLocalOverride());
      setLastLoadDiagnostics(dataAccess.getLastLoadDiagnostics());
      syncPersistenceRuntime({
        status: "idle",
        hasPendingChanges: false,
        isSaving: false,
        lastSaveOutcome: null,
        lastSaveCode: null,
        lastError: null,
        lastWarning: null,
      });
      setApiRuntimeRefreshKey((current) => current + 1);
      return { ok: true };
    } catch {
      return { ok: false, error: "Nie udało się ponownie wczytać danych." };
    }
  }, [syncPersistenceRuntime]);

  const allowFreshnessRefresh = useMemo(() => canAutoRefreshDataForPath(pathname), [pathname]);

  useEffect(() => {
    function tryFreshnessReload(): void {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "visible") return;
      if (!allowFreshnessRefresh || isLoading) return;
      if (persistenceState.hasPendingChanges || persistenceState.isSaving) return;
      if (isFreshnessReloadInFlightRef.current) return;

      const nowMs = Date.now();
      if (nowMs - lastFreshnessReloadAtRef.current < DATA_FRESHNESS_COOLDOWN_MS) return;

      lastFreshnessReloadAtRef.current = nowMs;
      isFreshnessReloadInFlightRef.current = true;

      void reloadData().finally(() => {
        isFreshnessReloadInFlightRef.current = false;
      });
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        tryFreshnessReload();
      }
    }

    function handleWindowFocus(): void {
      tryFreshnessReload();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [allowFreshnessRefresh, isLoading, persistenceState.hasPendingChanges, persistenceState.isSaving, reloadData]);

  const resetToDefault = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const bundled = await dataAccess.loadBundledDefault();
    if (!bundled) {
      return { ok: false, error: "Nie udało się pobrać domyślnych danych." };
    }
    configureDataAccessFromSystem(bundled.system);
    await dataAccess.clearLocalOverride();
    pendingSaveRef.current = null;
    setDataState(bundled);
    setLocalOverrideActive(dataAccess.hasLocalOverride());
    setStoredLocalOverrideAvailable(dataAccess.hasStoredLocalOverride());
    setLastLoadDiagnostics(dataAccess.getLastLoadDiagnostics());
    syncPersistenceRuntime({
      status: "idle",
      hasPendingChanges: false,
      isSaving: false,
      lastSaveOutcome: null,
      lastSaveCode: null,
      lastError: null,
      lastWarning: null,
    });
    setApiRuntimeRefreshKey((current) => current + 1);
    return { ok: true };
  }, [syncPersistenceRuntime]);

  const clearLocalOverrides = useCallback(() => {
    void dataAccess.clearLocalOverride().then(() => {
      setLocalOverrideActive(dataAccess.hasLocalOverride());
      setStoredLocalOverrideAvailable(dataAccess.hasStoredLocalOverride());
      syncPersistenceRuntime();
    });
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
      apiMode,
      apiRuntimeRefreshKey,
      data,
      setData,
      isLoading,
      loadError,
      platformBootstrapState,
      syncPlatformBootstrapProject,
      systemSettings,
      setSystemSettings,
      appBuildVersion,
      dataSchemaVersion,
      lastLoadDiagnostics,
      lastImportDiagnostics,
      lastExportDiagnostics,
      dataStorageMode: dataAccess.mode,
      persistenceState,
      retryPendingSave,
      exportData,
      importData,
      reloadData,
      resetToDefault,
      clearLocalOverrides,
      uploadFile,
      localOverrideActive,
      storedLocalOverrideAvailable,
      updateAuthHashes,
    }),
    [
      apiMode,
      apiRuntimeRefreshKey,
      data,
      setData,
      isLoading,
      loadError,
      platformBootstrapState,
      syncPlatformBootstrapProject,
      systemSettings,
      setSystemSettings,
      appBuildVersion,
      dataSchemaVersion,
      lastLoadDiagnostics,
      lastImportDiagnostics,
      lastExportDiagnostics,
      persistenceState,
      retryPendingSave,
      exportData,
      importData,
      reloadData,
      resetToDefault,
      clearLocalOverrides,
      uploadFile,
      localOverrideActive,
      storedLocalOverrideAvailable,
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
