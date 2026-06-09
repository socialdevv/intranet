import type { AppData, AppSystemSettings, SystemStorageMode } from "@/lib/types/domain";
import { isApiBootstrapPreviewEnabled } from "@/lib/api/bootstrap-preview-runtime";
import type {
  IntegrationCapabilityReasonCode,
  IntegrationCapabilityState,
  IntegrationOutcome,
  SaveContractCode,
  UploadContractCode,
} from "@/lib/integration/contracts";
import { resolveApiCapabilityDetails } from "@/lib/integration/contracts";
import {
  CURRENT_SCHEMA_VERSION,
  type DataMigrationReport,
  EMPTY_DATA,
  clearLocalStorage,
  fetchBundledData,
  hasStoredLocalOverride,
  isValidAppData,
  loadFromLocalStorage,
  migrateAppDataWithReport,
  parseImportedJson,
  saveToLocalStorage,
  triggerJsonDownload,
} from "@/lib/data/store";

export type DataStorageMode = "file-local" | "api-assisted";

export type DataLoadSource = "local-override" | "bundled-default" | "api" | "empty-fallback";

export type DataLoadDiagnostics = {
  at: string;
  source: DataLoadSource;
  storageMode: DataStorageMode;
  inputSchemaVersion: number | null;
  outputSchemaVersion: number;
  migratedSchema: boolean;
  normalized: boolean;
  notes: string[];
  fallbackFromApi?: boolean;
  localOverrideSuppressed?: boolean;
};

export type DataImportDiagnostics =
  | {
      at: string;
      ok: true;
      rawSchemaVersion: number | null;
      inputSchemaVersion: number | null;
      outputSchemaVersion: number;
      migratedSchema: boolean;
      normalized: boolean;
      notes: string[];
    }
  | {
      at: string;
      ok: false;
      rawSchemaVersion: number | null;
      error: string;
    };

export type DataExportDiagnostics = {
  at: string;
  filename: string;
  schemaVersion: number;
  appName: string;
  storageMode: DataStorageMode;
  localOverrideActive: boolean;
  counts: {
    categories: number;
    pages: number;
    matrix: number;
    templates: number;
    communications: number;
  };
};

export type DataPersistenceRuntime = {
  storageMode: DataStorageMode;
  apiConfigured: boolean;
  directApiSaveReady: boolean;
  appDataLocalStorageSuppressed: boolean;
  saveCapability: IntegrationCapabilityState;
  saveCapabilityReason: IntegrationCapabilityReasonCode;
  uploadCapability: IntegrationCapabilityState;
  uploadCapabilityReason: IntegrationCapabilityReasonCode;
  dataEndpoint: string | null;
  uploadEndpoint: string | null;
};

const DEFAULT_API_UPLOAD_PATH = "/api/v1/uploads";
const LEGACY_API_UPLOAD_PATH = "/uploads";

export type SaveAppDataResult =
  | {
      ok: true;
      outcome: Extract<IntegrationOutcome, "success" | "warning" | "fallback">;
      code: Exclude<SaveContractCode, "save-failed">;
      persistedVia: "local" | "api" | "memory";
      warning?: string;
    }
  | { ok: false; outcome: "failure"; code: "save-failed"; error: string };

export type UploadFileOptions = {
  folder?: string;
  filename?: string;
  mediaKind?: "image" | "video" | "file";
  projectSlug?: string;
};

export type UploadFileResult =
  | {
      ok: true;
      outcome: "success";
      code: "uploaded-api";
      url: string;
      provider: "api";
    }
  | {
      ok: false;
      outcome: "not-configured" | "failure";
      error: string;
      code: Exclude<UploadContractCode, "uploaded-api">;
      httpStatus?: number;
    };

/** Accepted API load response payload (direct AppData or wrapped envelope). */
export type DataApiLoadResponse = AppData | { data: AppData };

/** Optional metadata returned by API save endpoints. */
export type DataApiSaveResponse = {
  warning?: string;
};

/** Tolerant upload response shape currently supported by frontend runtime. */
export type UploadApiResponse = {
  url?: unknown;
  file?: {
    url?: unknown;
  };
  error?: {
    message?: unknown;
  };
  message?: unknown;
};

type DataAccessRuntimeConfig = {
  storageMode: DataStorageMode;
  apiBaseUrl: string;
  apiDataPath: string;
  apiUploadPath: string;
};

type DataStorageAdapter = {
  mode: DataStorageMode;
  loadData: () => Promise<AppData>;
  saveData: (data: AppData) => Promise<SaveAppDataResult>;
  clearLocalOverride: () => Promise<void>;
  hasLocalOverride: () => boolean;
  hasStoredLocalOverride: () => boolean;
  loadBundledDefault: () => Promise<AppData | null>;
};

type UploadAdapter = {
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
};

let lastLoadDiagnostics: DataLoadDiagnostics | null = null;
let lastImportDiagnostics: DataImportDiagnostics | null = null;
let lastExportDiagnostics: DataExportDiagnostics | null = null;

function toLoadDiagnostics(
  source: DataLoadSource,
  storageMode: DataStorageMode,
  report: DataMigrationReport
): DataLoadDiagnostics {
  return {
    at: new Date().toISOString(),
    source,
    storageMode,
    inputSchemaVersion: report.inputSchemaVersion,
    outputSchemaVersion: report.outputSchemaVersion,
    migratedSchema: report.migratedSchema,
    normalized: report.normalized,
    notes: report.notes,
  };
}

function isAppDataLocalStorageSuppressed(): boolean {
  return isApiBootstrapPreviewEnabled();
}

function buildLocalStorageSuppressedNote(hasStoredOverride: boolean): string {
  return hasStoredOverride
    ? "Tryb development API ignoruje zapisane nadpisania altcloud_data w localStorage, aby uniknąć konfliktu źródeł danych."
    : "Tryb development API wyłącza localStorage-backed dane aplikacji, aby uniknąć konfliktu źródeł danych."
}

function withLocalStorageSuppressedNote(
  diagnostics: DataLoadDiagnostics,
  hasStoredOverride: boolean
): DataLoadDiagnostics {
  return {
    ...diagnostics,
    localOverrideSuppressed: true,
    notes: [buildLocalStorageSuppressedNote(hasStoredOverride), ...diagnostics.notes],
  };
}

async function readJsonPayload(response: Response): Promise<unknown | null> {
  const raw = await response.text();
  if (!raw.trim()) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function extractLoadPayload(payload: unknown): DataApiLoadResponse | null {
  return parseDataApiLoadResponse(payload);
}

export function parseDataApiLoadResponse(payload: unknown): DataApiLoadResponse | null {
  if (isValidAppData(payload)) {
    return payload;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    isValidAppData((payload as { data?: unknown }).data)
  ) {
    return payload as { data: AppData };
  }

  return null;
}

function resolveLoadedData(payload: DataApiLoadResponse): AppData {
  return "data" in payload ? payload.data : payload;
}

function extractSaveWarning(payload: unknown): string | undefined {
  return parseDataApiSaveWarning(payload);
}

export function parseDataApiSaveWarning(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const { warning } = payload as DataApiSaveResponse;
  if (typeof warning !== "string") return undefined;
  const normalized = warning.trim();
  return normalized.length ? normalized : undefined;
}

function extractUploadUrl(payload: unknown): string | null {
  return parseUploadApiUrl(payload);
}

export function parseUploadApiUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;

  const direct = (payload as UploadApiResponse).url;
  if (typeof direct === "string" && direct.trim()) {
    return direct;
  }

  const nested = (payload as UploadApiResponse).file?.url;
  if (typeof nested === "string" && nested.trim()) {
    return nested;
  }

  return null;
}

class FileLocalStorageAdapter implements DataStorageAdapter {
  mode: DataStorageMode = "file-local";

  async loadData(): Promise<AppData> {
    const localStorageSuppressed = isAppDataLocalStorageSuppressed();
    const storedLocalOverride = hasStoredLocalOverride();

    if (!localStorageSuppressed) {
      const local = loadFromLocalStorage();
      if (local) {
        const migrated = migrateAppDataWithReport(local);
        lastLoadDiagnostics = toLoadDiagnostics("local-override", this.mode, migrated.report);
        return migrated.data;
      }
    }

    const bundled = await fetchBundledData();
    if (bundled) {
      const migrated = migrateAppDataWithReport(bundled);
      const diagnostics = toLoadDiagnostics("bundled-default", this.mode, migrated.report);
      lastLoadDiagnostics = localStorageSuppressed
        ? withLocalStorageSuppressedNote(diagnostics, storedLocalOverride)
        : diagnostics;
      return migrated.data;
    }

    const migrated = migrateAppDataWithReport(EMPTY_DATA);
    const diagnostics = toLoadDiagnostics("empty-fallback", this.mode, migrated.report);
    lastLoadDiagnostics = localStorageSuppressed
      ? withLocalStorageSuppressedNote(diagnostics, storedLocalOverride)
      : diagnostics;

    return migrated.data;
  }

  async saveData(data: AppData): Promise<SaveAppDataResult> {
    if (isAppDataLocalStorageSuppressed()) {
      return {
        ok: true,
        outcome: "success",
        code: "saved-memory-only",
        persistedVia: "memory",
        warning:
          "Tryb development API wyłączył persystencję altcloud_data w localStorage. Zmiany pozostają tylko w bieżącej sesji, chyba że dany moduł zapisuje je bezpośrednio do backendu.",
      };
    }

    const localSaveResult = saveToLocalStorage(data);
    if (!localSaveResult.ok) {
      return {
        ok: false,
        outcome: "failure",
        code: "save-failed",
        error: `Nie udało się zapisać danych w localStorage (${localSaveResult.error}).`,
      };
    }

    return {
      ok: true,
      outcome: "success",
      code: "saved-local",
      persistedVia: "local",
    };
  }

  async clearLocalOverride(): Promise<void> {
    clearLocalStorage();
  }

  hasLocalOverride(): boolean {
    return isAppDataLocalStorageSuppressed() ? false : hasStoredLocalOverride();
  }

  hasStoredLocalOverride(): boolean {
    return hasStoredLocalOverride();
  }

  async loadBundledDefault(): Promise<AppData | null> {
    const bundled = await fetchBundledData();
    if (!bundled) return null;
    const migrated = migrateAppDataWithReport(bundled);
    return migrated.data;
  }
}

class ApiAssistedStorageAdapter implements DataStorageAdapter {
  mode: DataStorageMode = "api-assisted";

  constructor(
    private readonly fallback: DataStorageAdapter,
    private readonly apiBaseUrl: string,
    private readonly dataPath: string,
  ) {}

  private get endpoint(): string {
    return `${this.apiBaseUrl}${this.dataPath}`;
  }

  async loadData(): Promise<AppData> {
    if (!this.apiBaseUrl) {
      return this.fallback.loadData();
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const parsed = await readJsonPayload(response);
      const payload = extractLoadPayload(parsed);
      if (!payload) {
        throw new Error("API response does not match AppData shape");
      }

      const migrated = migrateAppDataWithReport(resolveLoadedData(payload));
      lastLoadDiagnostics = toLoadDiagnostics("api", this.mode, migrated.report);
      return migrated.data;
    } catch (err) {
      console.warn(
        `[altcloud] API-assisted load failed, falling back to file-local storage: ${err instanceof Error ? err.message : String(err)}`
      );
      const fallbackData = await this.fallback.loadData();
      if (lastLoadDiagnostics) {
        lastLoadDiagnostics = {
          ...lastLoadDiagnostics,
          fallbackFromApi: true,
          notes: [
            `Odczyt API nieudany; użyto fallbacku file-local (${err instanceof Error ? err.message : String(err)}).`,
            ...lastLoadDiagnostics.notes,
          ],
        };
      }
      return fallbackData;
    }
  }

  async saveData(data: AppData): Promise<SaveAppDataResult> {
    if (!this.apiBaseUrl) {
      const fallbackResult = await this.fallback.saveData(data);
      if (!fallbackResult.ok) {
        return fallbackResult;
      }
      return {
        ok: true,
        outcome: "fallback",
        code: "saved-local-unconfigured",
        persistedVia: fallbackResult.persistedVia,
        warning:
          "Tryb API-assisted jest aktywny, ale nie skonfigurowano apiBaseUrl. Zastosowano zapis lokalny.",
      };
    }

    try {
      const response = await fetch(this.endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await readJsonPayload(response);
      const warning = extractSaveWarning(payload);

      return {
        ok: true,
        outcome: warning ? "warning" : "success",
        code: "saved-api",
        persistedVia: "api",
        warning,
      };
    } catch (err) {
      const fallbackResult = await this.fallback.saveData(data);
      if (!fallbackResult.ok) {
        return fallbackResult;
      }

      const reason = err instanceof Error ? err.message : String(err);
      return {
        ok: true,
        outcome: "fallback",
        code: "saved-local-fallback",
        persistedVia: fallbackResult.persistedVia,
        warning:
          `Nie udało się zapisać przez API (${reason}). Zastosowano zapis lokalny jako bezpieczny fallback.`,
      };
    }
  }

  async clearLocalOverride(): Promise<void> {
    await this.fallback.clearLocalOverride();
  }

  hasLocalOverride(): boolean {
    return this.fallback.hasLocalOverride();
  }

  hasStoredLocalOverride(): boolean {
    return this.fallback.hasStoredLocalOverride();
  }

  async loadBundledDefault(): Promise<AppData | null> {
    return this.fallback.loadBundledDefault();
  }
}

class NoopUploadAdapter implements UploadAdapter {
  async uploadFile(): Promise<UploadFileResult> {
    return buildUploadNotConfiguredResult(
      "Upload plików nie jest skonfigurowany dla bieżącego trybu storage."
    );
  }
}

class ApiUploadAdapter implements UploadAdapter {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly uploadPath: string,
  ) {}

  private get endpoint(): string {
    return `${this.apiBaseUrl}${this.uploadPath}`;
  }

  async uploadFile(file: File, options?: UploadFileOptions): Promise<UploadFileResult> {
    if (!this.apiBaseUrl) {
      return buildUploadNotConfiguredResult("Brak konfiguracji API do uploadu plików.");
    }

    const form = new FormData();
    if (options?.projectSlug) form.append("projectSlug", options.projectSlug);
    if (options?.mediaKind) form.append("kind", options.mediaKind);
    form.append("file", file, options?.filename ?? file.name);
    if (options?.folder) form.append("folder", options.folder);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const parsedError = await readJsonPayload(response);
        const detailedMessage = extractUploadError(parsedError);

        return {
          ok: false,
          outcome: "failure",
          code: "http-error",
          error: detailedMessage ?? `Upload zakończony błędem HTTP ${response.status}.`,
          httpStatus: response.status,
        };
      }

      const parsed = await readJsonPayload(response);
      const url = extractUploadUrl(parsed);

      if (!url) {
        return {
          ok: false,
          outcome: "failure",
          code: "invalid-response",
          error: "API uploadu zwróciło nieprawidłową odpowiedź (brak pola url lub file.url).",
        };
      }

      return {
        ok: true,
        outcome: "success",
        code: "uploaded-api",
        provider: "api",
        url,
      };
    } catch {
      return {
        ok: false,
        outcome: "failure",
        code: "network",
        error: "Nie udało się połączyć z API uploadu plików.",
      };
    }
  }
}

function extractUploadError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const directMessage = (payload as UploadApiResponse).message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return directMessage.trim();
  }

  const nestedMessage = (payload as UploadApiResponse).error?.message;
  if (typeof nestedMessage === "string" && nestedMessage.trim()) {
    return nestedMessage.trim();
  }

  return null;
}

function resolveStorageMode(rawValue: string | undefined): DataStorageMode {
  return rawValue === "api-assisted" ? "api-assisted" : "file-local";
}

function normalizeApiBaseUrl(baseUrl: string | null | undefined): string {
  return (baseUrl ?? "").trim().replace(/\/$/, "");
}

function buildUploadNotConfiguredResult(error: string): UploadFileResult {
  return {
    ok: false,
    outcome: "not-configured",
    code: "not-configured",
    error,
  };
}

function isApiConfigured(config: DataAccessRuntimeConfig): boolean {
  return Boolean(config.apiBaseUrl);
}

function isDirectApiRuntime(config: DataAccessRuntimeConfig): boolean {
  return config.storageMode === "api-assisted" && isApiConfigured(config);
}

function resolveCapability(config: DataAccessRuntimeConfig): {
  state: IntegrationCapabilityState;
  reasonCode: IntegrationCapabilityReasonCode;
} {
  const details = resolveApiCapabilityDetails(config.storageMode, isApiConfigured(config));
  return {
    state: details.state,
    reasonCode: details.reasonCode,
  };
}

function resolveUploadCapability(config: DataAccessRuntimeConfig): {
  state: IntegrationCapabilityState;
  reasonCode: IntegrationCapabilityReasonCode;
} {
  if (!isApiConfigured(config)) {
    return {
      state: "not-configured",
      reasonCode: "api-base-url-missing",
    };
  }

  return {
    state: "configured",
    reasonCode: "api-ready",
  };
}

function normalizePath(path: string, fallback: string): string {
  const trimmed = path.trim();
  if (!trimmed) return fallback;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizeUploadPath(path: string | undefined, fallback = DEFAULT_API_UPLOAD_PATH): string {
  const normalized = normalizePath(path ?? fallback, fallback);
  return normalized === LEGACY_API_UPLOAD_PATH ? DEFAULT_API_UPLOAD_PATH : normalized;
}

function buildInitialRuntimeConfig(): DataAccessRuntimeConfig {
  return {
    storageMode: resolveStorageMode(import.meta.env.VITE_ALTCLOUD_DATA_STORAGE_MODE),
    apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_ALTCLOUD_API_BASE_URL),
    apiDataPath: normalizePath(import.meta.env.VITE_ALTCLOUD_API_DATA_PATH ?? "/app-data", "/app-data"),
    apiUploadPath: normalizeUploadPath(import.meta.env.VITE_ALTCLOUD_API_UPLOAD_PATH),
  };
}

let runtimeConfig: DataAccessRuntimeConfig = buildInitialRuntimeConfig();

const fileLocalAdapter = new FileLocalStorageAdapter();
let storageAdapter: DataStorageAdapter = fileLocalAdapter;
let uploadAdapter: UploadAdapter = new NoopUploadAdapter();

function rebuildAdapters(config: DataAccessRuntimeConfig): void {
  storageAdapter =
    config.storageMode === "api-assisted"
      ? new ApiAssistedStorageAdapter(fileLocalAdapter, config.apiBaseUrl, config.apiDataPath)
      : fileLocalAdapter;

  uploadAdapter =
    isApiConfigured(config)
      ? new ApiUploadAdapter(config.apiBaseUrl, config.apiUploadPath)
      : new NoopUploadAdapter();
}

rebuildAdapters(runtimeConfig);

function getPersistenceRuntime(): DataPersistenceRuntime {
  const apiConfigured = isApiConfigured(runtimeConfig);
  const directApiRuntime = isDirectApiRuntime(runtimeConfig);
  const capability = resolveCapability(runtimeConfig);
  const uploadCapability = resolveUploadCapability(runtimeConfig);
  return {
    storageMode: storageAdapter.mode,
    apiConfigured,
    directApiSaveReady: directApiRuntime,
    appDataLocalStorageSuppressed: isAppDataLocalStorageSuppressed(),
    saveCapability: capability.state,
    saveCapabilityReason: capability.reasonCode,
    uploadCapability: uploadCapability.state,
    uploadCapabilityReason: uploadCapability.reasonCode,
    dataEndpoint: apiConfigured ? `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiDataPath}` : null,
    uploadEndpoint: apiConfigured ? `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiUploadPath}` : null,
  };
}

export function configureDataAccessFromSystem(system?: AppSystemSettings): void {
  const integration = system?.integration;
  if (!integration) return;

  const rawStorageMode = integration.storageMode as SystemStorageMode | undefined;
  const nextConfig: DataAccessRuntimeConfig = {
    storageMode: resolveStorageMode(rawStorageMode ?? runtimeConfig.storageMode),
    apiBaseUrl: normalizeApiBaseUrl(integration.apiBaseUrl ?? runtimeConfig.apiBaseUrl),
    apiDataPath: normalizePath(integration.dataEndpointPath ?? runtimeConfig.apiDataPath, "/app-data"),
    apiUploadPath: normalizeUploadPath(integration.uploadEndpointPath ?? runtimeConfig.apiUploadPath),
  };

  const hasChanged =
    nextConfig.storageMode !== runtimeConfig.storageMode ||
    nextConfig.apiBaseUrl !== runtimeConfig.apiBaseUrl ||
    nextConfig.apiDataPath !== runtimeConfig.apiDataPath ||
    nextConfig.apiUploadPath !== runtimeConfig.apiUploadPath;

  if (!hasChanged) return;

  runtimeConfig = nextConfig;
  rebuildAdapters(runtimeConfig);
}

export type DataAccessGateway = {
  readonly mode: DataStorageMode;
  loadAppData: () => Promise<AppData>;
  saveAppData: (data: AppData) => Promise<SaveAppDataResult>;
  clearLocalOverride: () => Promise<void>;
  hasLocalOverride: () => boolean;
  hasStoredLocalOverride: () => boolean;
  loadBundledDefault: () => Promise<AppData | null>;
  exportDataToFile: (data: AppData, filename?: string) => DataExportDiagnostics;
  parseImportedData: (raw: string) => ReturnType<typeof parseImportedJson>;
  getLastLoadDiagnostics: () => DataLoadDiagnostics | null;
  getLastImportDiagnostics: () => DataImportDiagnostics | null;
  getLastExportDiagnostics: () => DataExportDiagnostics | null;
  getPersistenceRuntime: () => DataPersistenceRuntime;
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
};

export const dataAccess: DataAccessGateway = {
  get mode() {
    return storageAdapter.mode;
  },

  loadAppData: () => storageAdapter.loadData(),
  saveAppData: (data: AppData) => storageAdapter.saveData(data),
  clearLocalOverride: () => storageAdapter.clearLocalOverride(),
  hasLocalOverride: () => storageAdapter.hasLocalOverride(),
  hasStoredLocalOverride: () => storageAdapter.hasStoredLocalOverride(),
  loadBundledDefault: () => storageAdapter.loadBundledDefault(),

  exportDataToFile: (data: AppData, filename?: string): DataExportDiagnostics => {
    const resolvedFilename = filename?.trim() || "altcloud-data.json";
    triggerJsonDownload(data, resolvedFilename);
    const diagnostics: DataExportDiagnostics = {
      at: new Date().toISOString(),
      filename: resolvedFilename,
      schemaVersion:
        typeof data.meta?.schemaVersion === "number"
          ? data.meta.schemaVersion
          : CURRENT_SCHEMA_VERSION,
      appName: data.meta?.appName || "AltCloud",
      storageMode: storageAdapter.mode,
      localOverrideActive: storageAdapter.hasLocalOverride(),
      counts: {
        categories: data.categories.length,
        pages: data.pages.length,
        matrix: data.matrix.length,
        templates: data.templates.length,
        communications: data.communications.length,
      },
    };
    lastExportDiagnostics = diagnostics;
    return diagnostics;
  },
  parseImportedData: (raw: string) => {
    const result = parseImportedJson(raw);
    const at = new Date().toISOString();
    if (result.ok) {
      lastImportDiagnostics = {
        at,
        ok: true,
        rawSchemaVersion: result.rawSchemaVersion,
        inputSchemaVersion: result.report.inputSchemaVersion,
        outputSchemaVersion: result.report.outputSchemaVersion,
        migratedSchema: result.report.migratedSchema,
        normalized: result.report.normalized,
        notes: result.report.notes,
      };
    } else {
      lastImportDiagnostics = {
        at,
        ok: false,
        rawSchemaVersion: result.rawSchemaVersion,
        error: result.error,
      };
    }
    return result;
  },

  getLastLoadDiagnostics: (): DataLoadDiagnostics | null => lastLoadDiagnostics,
  getLastImportDiagnostics: (): DataImportDiagnostics | null => lastImportDiagnostics,
  getLastExportDiagnostics: (): DataExportDiagnostics | null => lastExportDiagnostics,
  getPersistenceRuntime,

  uploadFile: (file: File, options?: UploadFileOptions) =>
    uploadAdapter.uploadFile(file, options),
};
