import type { AppData } from "@/lib/types/domain";
import type {
  IntegrationCapabilityReasonCode,
  IntegrationCapabilityState,
  UploadContractCode,
} from "@/lib/integration/contracts";
import { createBootstrapPreviewRequestHeaders } from "@/lib/api/bootstrap-preview-runtime";
import {
  CURRENT_SCHEMA_VERSION,
  type DataExportDiagnostics,
  type DataImportDiagnostics,
  parseImportedJson,
  triggerJsonDownload,
} from "@/lib/data/store";

const DEFAULT_API_UPLOAD_PATH = "/api/v1/uploads";
const LEGACY_API_UPLOAD_PATH = "/uploads";

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
      apiErrorCode?: string;
    };

export type UploadApiResponse = {
  url?: unknown;
  file?: {
    url?: unknown;
  };
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
  message?: unknown;
};

export type DataPersistenceRuntime = {
  apiConfigured: boolean;
  uploadCapability: IntegrationCapabilityState;
  uploadCapabilityReason: IntegrationCapabilityReasonCode;
  uploadEndpoint: string | null;
};

type RuntimeConfig = {
  apiBaseUrl: string;
  apiUploadPath: string;
};

type UploadAdapter = {
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
};

let lastImportDiagnostics: DataImportDiagnostics | null = null;
let lastExportDiagnostics: DataExportDiagnostics | null = null;

class NoopUploadAdapter implements UploadAdapter {
  async uploadFile(): Promise<UploadFileResult> {
    return buildUploadNotConfiguredResult(
      "Upload plików nie jest skonfigurowany — brak ścieżki API uploadu."
    );
  }
}

class ApiUploadAdapter implements UploadAdapter {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly uploadPath: string
  ) {}

  private get endpoint(): string {
    return this.apiBaseUrl ? `${this.apiBaseUrl}${this.uploadPath}` : this.uploadPath;
  }

  async uploadFile(file: File, options?: UploadFileOptions): Promise<UploadFileResult> {
    const form = new FormData();
    if (options?.projectSlug) form.append("projectSlug", options.projectSlug);
    if (options?.mediaKind) form.append("kind", options.mediaKind);
    form.append("file", file, options?.filename ?? file.name);
    form.append("sizeBytes", String(file.size));
    if (options?.folder) form.append("folder", options.folder);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: createBootstrapPreviewRequestHeaders(),
        body: form,
      });

      if (!response.ok) {
        const parsedError = await readJsonPayload(response);
        const { code: apiErrorCode, message: detailedMessage } = extractUploadErrorDetails(parsedError);

        return {
          ok: false,
          outcome: "failure",
          code: "http-error",
          error: detailedMessage ?? `Upload zakończony błędem HTTP ${response.status}.`,
          httpStatus: response.status,
          apiErrorCode: apiErrorCode ?? undefined,
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

async function readJsonPayload(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractUploadUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const direct = (payload as UploadApiResponse).url;
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const nested = (payload as UploadApiResponse).file?.url;
  if (typeof nested === "string" && nested.trim()) {
    return nested.trim();
  }

  return null;
}

function extractUploadErrorDetails(payload: unknown): {
  code: string | null;
  message: string | null;
} {
  if (!payload || typeof payload !== "object") {
    return { code: null, message: null };
  }

  const record = payload as UploadApiResponse;
  const nestedError = record.error;

  if (nestedError && typeof nestedError === "object") {
    const code =
      typeof nestedError.code === "string" && nestedError.code.trim()
        ? nestedError.code.trim()
        : null;
    const message =
      typeof nestedError.message === "string" && nestedError.message.trim()
        ? nestedError.message.trim()
        : null;

    if (code || message) {
      return { code, message };
    }
  }

  const directMessage = record.message;
  if (typeof directMessage === "string" && directMessage.trim()) {
    return { code: null, message: directMessage.trim() };
  }

  return { code: null, message: null };
}

function normalizeApiBaseUrl(baseUrl: string | null | undefined): string {
  return (baseUrl ?? "").trim().replace(/\/$/, "");
}

function normalizeUploadPath(path: string | undefined, fallback = DEFAULT_API_UPLOAD_PATH): string {
  const trimmed = (path ?? fallback).trim();
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized === LEGACY_API_UPLOAD_PATH ? DEFAULT_API_UPLOAD_PATH : normalized;
}

function buildUploadNotConfiguredResult(error: string): UploadFileResult {
  return {
    ok: false,
    outcome: "not-configured",
    code: "not-configured",
    error,
  };
}

function isApiConfigured(config: RuntimeConfig): boolean {
  // Empty base URL means same-origin relative API (unified Fastify static + API container).
  return Boolean(config.apiBaseUrl) || Boolean(config.apiUploadPath);
}

function resolveUploadCapability(config: RuntimeConfig): {
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

function buildInitialRuntimeConfig(): RuntimeConfig {
  return {
    apiBaseUrl: normalizeApiBaseUrl(import.meta.env.VITE_ALTCLOUD_API_BASE_URL),
    apiUploadPath: normalizeUploadPath(import.meta.env.VITE_ALTCLOUD_API_UPLOAD_PATH),
  };
}

let runtimeConfig: RuntimeConfig = buildInitialRuntimeConfig();
let uploadAdapter: UploadAdapter = isApiConfigured(runtimeConfig)
  ? new ApiUploadAdapter(runtimeConfig.apiBaseUrl, runtimeConfig.apiUploadPath)
  : new NoopUploadAdapter();

function rebuildUploadAdapter(config: RuntimeConfig): void {
  uploadAdapter = isApiConfigured(config)
    ? new ApiUploadAdapter(config.apiBaseUrl, config.apiUploadPath)
    : new NoopUploadAdapter();
}

function getPersistenceRuntime(): DataPersistenceRuntime {
  const uploadCapability = resolveUploadCapability(runtimeConfig);
  return {
    apiConfigured: isApiConfigured(runtimeConfig),
    uploadCapability: uploadCapability.state,
    uploadCapabilityReason: uploadCapability.reasonCode,
    uploadEndpoint: isApiConfigured(runtimeConfig)
      ? runtimeConfig.apiBaseUrl
        ? `${runtimeConfig.apiBaseUrl}${runtimeConfig.apiUploadPath}`
        : runtimeConfig.apiUploadPath
      : null,
  };
}

export function configureDataAccessFromSystem(system?: AppData["system"]): void {
  const integration = system?.integration;
  if (!integration) return;

  const nextConfig: RuntimeConfig = {
    apiBaseUrl: normalizeApiBaseUrl(integration.apiBaseUrl ?? runtimeConfig.apiBaseUrl),
    apiUploadPath: normalizeUploadPath(integration.uploadEndpointPath ?? runtimeConfig.apiUploadPath),
  };

  const hasChanged =
    nextConfig.apiBaseUrl !== runtimeConfig.apiBaseUrl ||
    nextConfig.apiUploadPath !== runtimeConfig.apiUploadPath;

  if (!hasChanged) return;

  runtimeConfig = nextConfig;
  rebuildUploadAdapter(runtimeConfig);
}

export type DataAccessGateway = {
  exportDataToFile: (data: AppData, filename?: string) => DataExportDiagnostics;
  parseImportedData: (raw: string) => ReturnType<typeof parseImportedJson>;
  getLastImportDiagnostics: () => DataImportDiagnostics | null;
  getLastExportDiagnostics: () => DataExportDiagnostics | null;
  getPersistenceRuntime: () => DataPersistenceRuntime;
  uploadFile: (file: File, options?: UploadFileOptions) => Promise<UploadFileResult>;
};

export const dataAccess: DataAccessGateway = {
  exportDataToFile: (data: AppData, filename?: string): DataExportDiagnostics => {
    const resolvedFilename = filename?.trim() || "intranet-export.json";
    triggerJsonDownload(data, resolvedFilename);
    const diagnostics: DataExportDiagnostics = {
      at: new Date().toISOString(),
      filename: resolvedFilename,
      schemaVersion:
        typeof data.meta?.schemaVersion === "number"
          ? data.meta.schemaVersion
          : CURRENT_SCHEMA_VERSION,
      appName: data.meta?.appName || "AltCloud",
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

  getLastImportDiagnostics: (): DataImportDiagnostics | null => lastImportDiagnostics,
  getLastExportDiagnostics: (): DataExportDiagnostics | null => lastExportDiagnostics,
  getPersistenceRuntime,
  uploadFile: (file: File, options?: UploadFileOptions) => uploadAdapter.uploadFile(file, options),
};

// Apply env defaults on module load.
configureDataAccessFromSystem({
  integration: {
    apiBaseUrl: import.meta.env.VITE_ALTCLOUD_API_BASE_URL,
    uploadEndpointPath: import.meta.env.VITE_ALTCLOUD_API_UPLOAD_PATH,
  },
});
