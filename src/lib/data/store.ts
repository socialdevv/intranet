import {
  DEFAULT_ENABLED_MODULES,
  DEFAULT_NAV_ORDER,
  sanitizeModuleSettings,
} from "@/lib/config/modules";
import {
  migrateSectionJsonContent,
  isTipTapDoc,
  plainTextToTipTapDoc,
} from "@/lib/knowledge/content-doc";
import {
  DEFAULT_MATRIX_ADVISORY_RULES,
  sanitizeMatrixAdvisoryRules,
} from "@/lib/matrix/advisories";
import type { AppData, AppRole } from "@/lib/types/domain";

// ── Constants ─────────────────────────────────────────────────────────────────

const LS_KEY = "altcloud_data";
export const CURRENT_SCHEMA_VERSION = 4;
const DEFAULT_UPLOAD_ENDPOINT_PATH = "/api/v1/uploads";
const LEGACY_UPLOAD_ENDPOINT_PATH = "/uploads";

const DEFAULT_PLANNED_ROLES: AppRole[] = ["admin", "editor", "agent"];

function normalizeUploadEndpointPath(path: unknown): string {
  if (typeof path !== "string") return DEFAULT_UPLOAD_ENDPOINT_PATH;

  const trimmed = path.trim();
  if (!trimmed) return DEFAULT_UPLOAD_ENDPOINT_PATH;

  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return normalized === LEGACY_UPLOAD_ENDPOINT_PATH ? DEFAULT_UPLOAD_ENDPOINT_PATH : normalized;
}

export type DataMigrationReport = {
  inputSchemaVersion: number | null;
  outputSchemaVersion: number;
  migratedSchema: boolean;
  normalized: boolean;
  notes: string[];
};

export type ParseImportedJsonResult =
  | { ok: true; data: AppData; report: DataMigrationReport; rawSchemaVersion: number | null }
  | { ok: false; error: string; rawSchemaVersion: number | null };

export type LocalStorageSaveResult =
  | { ok: true }
  | { ok: false; error: string };

// ── Default / empty data ─────────────────────────────────────────────────────

export const EMPTY_DATA: AppData = {
  meta: {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: "Platforma Intranetowa",
  },
  auth: {
    consultantPinHash: "",
    adminPinHash: "",
  },
  categories: [],
  pages: [],
  matrix: [],
  templates: [],
  communications: [],
  cenniki: { documents: [] },
  links: [],
  homeSpotlights: [],
  homeQuickLinks: [],
  contacts: [],
  phrases: [],
  orgEntries: [],
  navOrder: [...DEFAULT_NAV_ORDER],
  matrixCategoryOrder: [],
  leadConfig: { questions: [], rules: [] },
  configuration: {
    modules: {
      enabled: { ...DEFAULT_ENABLED_MODULES },
      settings: {},
    },
    navigation: {
      mainNavOrder: [...DEFAULT_NAV_ORDER],
    },
    rules: {
      matrixCategoryOrder: [],
      matrixAdvisoryRules: DEFAULT_MATRIX_ADVISORY_RULES,
    },
  },
  system: {
    auth: {
      identitySource: "pin",
      plannedRoles: [...DEFAULT_PLANNED_ROLES],
    },
    deployment: {},
    integration: {
      storageMode: "file-local",
      dataEndpointPath: "/app-data",
      uploadEndpointPath: DEFAULT_UPLOAD_ENDPOINT_PATH,
    },
  },
};

// ── Shape guard ───────────────────────────────────────────────────────────────

/**
 * Lightweight structural guard. Returns true if the value looks like a valid
 * AppData object — enough to catch truncated or wrong-file imports early.
 */
export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["meta"] === "object" &&
    typeof v["auth"] === "object" &&
    Array.isArray(v["categories"]) &&
    Array.isArray(v["pages"]) &&
    Array.isArray(v["matrix"]) &&
    Array.isArray(v["templates"]) &&
    Array.isArray(v["communications"]) &&
    typeof v["cenniki"] === "object"
    // links is optional for backwards-compat with existing exports
  );
}

// ── localStorage persistence ──────────────────────────────────────────────────

export function loadFromLocalStorage(): AppData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidAppData(parsed)) {
      console.warn("localStorage data invalid — discarding.");
      localStorage.removeItem(LS_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveToLocalStorage(data: AppData): LocalStorageSaveResult {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (error) {
    console.warn("Could not persist data to localStorage.");
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Nieznany błąd localStorage.",
    };
  }
}

export function clearLocalStorage(): void {
  localStorage.removeItem(LS_KEY);
}

/** Returns true if app data is currently persisted under the local override key. */
export function hasStoredLocalOverride(): boolean {
  try {
    return localStorage.getItem(LS_KEY) !== null;
  } catch {
    return false;
  }
}

/** Returns true if the app currently has persisted local overrides in localStorage. */
export function hasLocalOverride(): boolean {
  return hasStoredLocalOverride();
}

// ── Bundled JSON fetch ────────────────────────────────────────────────────────

export async function fetchBundledData(): Promise<AppData | null> {
  // Build a base-aware URL so the fetch works whether the app is served from
  // the root ("/") or a sub-path (e.g. "/altcloud/").
  // import.meta.env.BASE_URL is injected by Vite and matches the `base`
  // option in vite.config.ts (defaults to "/" in dev).
  const base = import.meta.env.BASE_URL ?? "/";
  const url = `${base.endsWith("/") ? base : `${base}/`}altcloud-data.json`;
  const cacheBustedUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
  try {
    const response = await fetch(cacheBustedUrl, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, max-age=0",
        Pragma: "no-cache",
      },
    });
    if (!response.ok) {
      console.error(
        `[altcloud] Failed to fetch bundled data: HTTP ${response.status} for ${cacheBustedUrl}`
      );
      return null;
    }
    const parsed: unknown = await response.json();
    if (!isValidAppData(parsed)) {
      console.error(
        "[altcloud] altcloud-data.json fetched successfully but has an unexpected shape. " +
          "Check that the file is a valid AltCloud data export."
      );
      return null;
    }
    return parsed;
  } catch (err) {
    console.error(
      `[altcloud] Could not fetch bundled data from ${url}:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ── Boot load: localStorage first, then bundled JSON, then EMPTY_DATA ────────

function readSchemaVersion(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const { meta } = value as { meta?: unknown };
  if (!meta || typeof meta !== "object") return null;
  const { schemaVersion } = meta as { schemaVersion?: unknown };
  return typeof schemaVersion === "number" ? schemaVersion : null;
}

/** Migrate persisted data from older schema versions to current shape with diagnostics. */
export function migrateAppDataWithReport(data: AppData): { data: AppData; report: DataMigrationReport } {
  let d = data;
  const notes: string[] = [];
  const inputSchemaVersion = readSchemaVersion(data);
  let normalized = false;

  if (inputSchemaVersion !== CURRENT_SCHEMA_VERSION) {
    notes.push(
      inputSchemaVersion === null
        ? "Brak jawnej wersji schematu w danych źródłowych; zastosowano normalizację bieżącą."
        : `Wykryto starszą wersję schematu (${inputSchemaVersion} -> ${CURRENT_SCHEMA_VERSION}).`
    );
  }

  // v1 → current: links array was added later
  if (!Array.isArray(d.links)) {
    normalized = true;
    notes.push("Uzupełniono brakującą kolekcję linków.");
    d = { ...d, links: [] };
  }
  // homepage curated sections were added later
  if (!Array.isArray(d.homeSpotlights)) {
    normalized = true;
    notes.push("Uzupełniono brakującą kolekcję spotlightów strony głównej.");
    d = { ...d, homeSpotlights: [] };
  }
  if (!Array.isArray(d.homeQuickLinks)) {
    normalized = true;
    notes.push("Uzupełniono brakującą kolekcję szybkich linków strony głównej.");
    d = { ...d, homeQuickLinks: [] };
  }
  // orgEntries were added later
  if (!Array.isArray(d.orgEntries)) {
    normalized = true;
    notes.push("Uzupełniono brakującą kolekcję tematów organizacyjnych.");
    d = { ...d, orgEntries: [] };
  }
  // announcements were added later
  if (!Array.isArray(d.announcements)) {
    normalized = true;
    notes.push("Uzupełniono brakującą kolekcję ogłoszeń.");
    d = { ...d, announcements: [] };
  }

  function normalizeIsoDateTimeOrUndefined(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
  }

  let announcementBodyNormalizedCount = 0;
  let announcementVisibilityWindowNormalizedCount = 0;
  d = {
    ...d,
    announcements: (d.announcements ?? []).map((announcement) => {
      const legacyDescription =
        typeof announcement.description === "string" ? announcement.description : "";
      const existingBody = (announcement as { body?: unknown }).body;
      const normalizedBody = isTipTapDoc(existingBody)
        ? existingBody
        : legacyDescription.trim()
        ? plainTextToTipTapDoc(legacyDescription)
        : undefined;

      if (!isTipTapDoc(existingBody) && normalizedBody) {
        announcementBodyNormalizedCount += 1;
      }

      const nextVisibleFrom = normalizeIsoDateTimeOrUndefined(
        (announcement as { visibleFrom?: unknown }).visibleFrom
      );
      const nextVisibleUntil = normalizeIsoDateTimeOrUndefined(
        (announcement as { visibleUntil?: unknown }).visibleUntil
      );

      const previousVisibleFrom = (announcement as { visibleFrom?: unknown }).visibleFrom;
      const previousVisibleUntil = (announcement as { visibleUntil?: unknown }).visibleUntil;
      const visibleFromChanged =
        (typeof previousVisibleFrom === "string" ? previousVisibleFrom.trim() : undefined) !==
        nextVisibleFrom;
      const visibleUntilChanged =
        (typeof previousVisibleUntil === "string" ? previousVisibleUntil.trim() : undefined) !==
        nextVisibleUntil;

      if (visibleFromChanged || visibleUntilChanged) {
        announcementVisibilityWindowNormalizedCount += 1;
      }

      return {
        ...announcement,
        description: legacyDescription,
        body: normalizedBody,
        visibleFrom: nextVisibleFrom,
        visibleUntil: nextVisibleUntil,
      };
    }),
  };

  if (announcementBodyNormalizedCount > 0) {
    normalized = true;
    notes.push(
      `Znormalizowano treść TipTap dla ${announcementBodyNormalizedCount} ogłoszeń na podstawie opisu legacy.`
    );
  }

  if (announcementVisibilityWindowNormalizedCount > 0) {
    normalized = true;
    notes.push(
      `Znormalizowano pola okna widoczności dla ${announcementVisibilityWindowNormalizedCount} ogłoszeń.`
    );
  }

  let templateSortOrderNormalizedCount = 0;
  d = {
    ...d,
    templates: (d.templates ?? []).map((template, index) => {
      const rawSortOrder = (template as { sortOrder?: unknown }).sortOrder;
      if (typeof rawSortOrder === "number" && Number.isFinite(rawSortOrder)) {
        return template;
      }

      templateSortOrderNormalizedCount += 1;
      return {
        ...template,
        sortOrder: index,
      };
    }),
  };

  if (templateSortOrderNormalizedCount > 0) {
    normalized = true;
    notes.push(
      `Uzupełniono sortOrder dla ${templateSortOrderNormalizedCount} szablonów.`
    );
  }

  const legacyNavOrder = Array.isArray(d.navOrder) ? d.navOrder : [];
  const legacyMatrixOrder = Array.isArray(d.matrixCategoryOrder) ? d.matrixCategoryOrder : [];
  const existingConfig = d.configuration ?? {};
  const existingSystem = d.system ?? {};
  const rawUploadEndpointPath = existingSystem.integration?.uploadEndpointPath;
  const normalizedUploadEndpointPath = normalizeUploadEndpointPath(rawUploadEndpointPath);
  const rawModuleSettings = existingConfig.modules?.settings;
  const rawModuleSettingsKeys =
    rawModuleSettings && typeof rawModuleSettings === "object"
      ? Object.keys(rawModuleSettings as Record<string, unknown>)
      : [];
  const sanitizedModuleSettings = sanitizeModuleSettings(rawModuleSettings);
  const rawMatrixAdvisoryRules = existingConfig.rules?.matrixAdvisoryRules;
  const hasExplicitMatrixAdvisoryRules = Array.isArray(rawMatrixAdvisoryRules);
  const sanitizedMatrixAdvisoryRules = sanitizeMatrixAdvisoryRules(rawMatrixAdvisoryRules);

  if (rawModuleSettingsKeys.length > Object.keys(sanitizedModuleSettings).length) {
    normalized = true;
    notes.push("Usunięto nieobsługiwane klucze w ustawieniach modułów.");
  }

  if (!hasExplicitMatrixAdvisoryRules) {
    normalized = true;
    notes.push("Dodano domyślne reguły komunikatów doradczych macierzy.");
  } else if (rawMatrixAdvisoryRules.length > sanitizedMatrixAdvisoryRules.length) {
    normalized = true;
    notes.push("Usunięto niepoprawne reguły komunikatów doradczych macierzy.");
  }

  if (!existingConfig.navigation?.mainNavOrder && legacyNavOrder.length > 0) {
    normalized = true;
    notes.push("Przeniesiono legacy kolejność nawigacji do configuration.navigation.mainNavOrder.");
  }

  if (!existingConfig.rules?.matrixCategoryOrder && legacyMatrixOrder.length > 0) {
    normalized = true;
    notes.push("Przeniesiono legacy kolejność kategorii macierzy do configuration.rules.matrixCategoryOrder.");
  }

  if (typeof rawUploadEndpointPath === "string") {
    const trimmedUploadEndpointPath = rawUploadEndpointPath.trim();
    const prefixedUploadEndpointPath = trimmedUploadEndpointPath.startsWith("/")
      ? trimmedUploadEndpointPath
      : `/${trimmedUploadEndpointPath}`;

    if (prefixedUploadEndpointPath !== normalizedUploadEndpointPath) {
      normalized = true;
      notes.push("Zaktualizowano legacy uploadEndpointPath do /api/v1/uploads.");
    }
  }

  d = {
    ...d,
    meta: {
      ...(d.meta ?? EMPTY_DATA.meta),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    },
    configuration: {
      ...existingConfig,
      modules: {
        enabled: {
          ...DEFAULT_ENABLED_MODULES,
          ...(existingConfig.modules?.enabled ?? {}),
        },
        settings: sanitizedModuleSettings,
      },
      navigation: {
        mainNavOrder:
          existingConfig.navigation?.mainNavOrder ??
          legacyNavOrder ??
          [...DEFAULT_NAV_ORDER],
      },
      rules: {
        matrixCategoryOrder:
          existingConfig.rules?.matrixCategoryOrder ?? legacyMatrixOrder ?? [],
        matrixAdvisoryRules: hasExplicitMatrixAdvisoryRules
          ? sanitizedMatrixAdvisoryRules
          : DEFAULT_MATRIX_ADVISORY_RULES,
      },
    },
    system: {
      ...existingSystem,
      auth: {
        identitySource: existingSystem.auth?.identitySource ?? "pin",
        externalIdentityHeader: existingSystem.auth?.externalIdentityHeader,
        whoamiEndpoint: existingSystem.auth?.whoamiEndpoint,
        plannedRoles: existingSystem.auth?.plannedRoles ?? [...DEFAULT_PLANNED_ROLES],
      },
      deployment: {
        ...existingSystem.deployment,
      },
      integration: {
        storageMode: existingSystem.integration?.storageMode ?? "file-local",
        apiBaseUrl: existingSystem.integration?.apiBaseUrl,
        dataEndpointPath: existingSystem.integration?.dataEndpointPath ?? "/app-data",
        uploadEndpointPath: normalizedUploadEndpointPath,
      },
    },
  };

  let migratedSectionCount = 0;
  d = {
    ...d,
    pages: d.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => {
        if (!isTipTapDoc(section.jsonContent)) {
          migratedSectionCount += 1;
        }
        return migrateSectionJsonContent(section);
      }),
    })),
  };

  if (migratedSectionCount > 0) {
    normalized = true;
    notes.push(`Znormalizowano ${migratedSectionCount} sekcji artykułów do modelu TipTap JSON.`);
  }

  return {
    data: d,
    report: {
      inputSchemaVersion,
      outputSchemaVersion: CURRENT_SCHEMA_VERSION,
      migratedSchema: inputSchemaVersion !== CURRENT_SCHEMA_VERSION,
      normalized,
      notes,
    },
  };
}

/** Migrate persisted data from older schema versions to current shape. */
export function migrateAppData(data: AppData): AppData {
  return migrateAppDataWithReport(data).data;
}

export async function loadAppData(): Promise<AppData> {
  const local = loadFromLocalStorage();
  if (local) return migrateAppData(local);

  const bundled = await fetchBundledData();
  if (bundled) return migrateAppData(bundled);

  return EMPTY_DATA;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function buildExportJson(data: AppData): string {
  const exportable: AppData = {
    ...data,
    meta: { ...data.meta, exportedAt: new Date().toISOString() },
  };
  return JSON.stringify(exportable, null, 2);
}

export function triggerJsonDownload(data: AppData, filename = "altcloud-data.json"): void {
  const json = buildExportJson(data);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ────────────────────────────────────────────────────────────────────

export function parseImportedJson(raw: string): ParseImportedJsonResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Plik nie jest poprawnym JSON.", rawSchemaVersion: null };
  }
  const rawSchemaVersion = readSchemaVersion(parsed);
  if (!isValidAppData(parsed)) {
    return {
      ok: false,
      error:
        "Plik nie ma oczekiwanej struktury danych AltCloud." +
        (rawSchemaVersion !== null ? ` Wykryto schemaVersion=${rawSchemaVersion}.` : ""),
      rawSchemaVersion,
    };
  }
  const migrated = migrateAppDataWithReport(parsed);
  return {
    ok: true,
    data: migrated.data,
    report: migrated.report,
    rawSchemaVersion,
  };
}
