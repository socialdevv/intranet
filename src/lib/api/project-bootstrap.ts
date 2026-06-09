import { resolveProjectPathMatch, ROUTES } from "@/lib/routes";
import { sanitizeMatrixAdvisoryRules } from "@/lib/matrix/advisories";
import type {
  AppConfiguration,
  AppModuleKey,
  AppModuleSettingsMap,
  AppModuleToggleMap,
  HomeSpotlight,
} from "@/lib/types/domain";
import type { LeadConfig } from "@/lib/types/lead";
import {
  bytesToMegabytes,
  createBootstrapPreviewRequestHeaders,
  getSelectedBootstrapPreviewDevUserEmail,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

type ProjectModuleConfiguration = {
  enabled: boolean;
  navVisible: boolean;
  navOrder: number | null;
  settings: Record<string, unknown>;
};

export type ProjectHomeSpotlightRecord = {
  id: string;
  pageId: string;
  labelOverride?: string;
  sortOrder: number;
};

type ProjectModuleCapabilities = {
  enabled: boolean;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type UploadPolicyEntry = {
  maxBytes: number;
  allowedMimePatterns: string[];
  source: string;
};

type ProjectCapabilityShape = {
  canEnterProject: boolean;
  canViewProjectHome: boolean;
  canSearchProject: boolean;
  canViewRestrictedMaterial: boolean;
  canEditContent: boolean;
  canManageCategories: boolean;
  canManageModules: boolean;
  canManageMemberships: boolean;
  canUploadFiles: boolean;
  canViewAudit: boolean;
};

export type ProjectBootstrapPreviewRouteContext = {
  pathname: string;
  routeLabel: string;
  projectSlug: string;
};

export type ProjectBootstrapResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
  };
  access: {
    isVisible: boolean;
    isLocked: boolean;
    effectiveProjectRole: string | null;
    lockReason?: string;
    lockMessage?: string;
  };
  capabilities: {
    project: ProjectCapabilityShape;
    modules: Record<string, ProjectModuleCapabilities>;
  };
  configuration: {
    modules: Record<string, ProjectModuleConfiguration>;
    moduleAvailability: Record<string, boolean>;
    navigation: string[];
    rules: {
      matrixCategoryOrder: string[];
      matrixAdvisoryRules: unknown[];
    };
    homeSpotlights: ProjectHomeSpotlightRecord[];
    homeSpotlightsManaged: boolean;
    leadConfig: LeadConfig;
    leadConfigManaged: boolean;
  };
  content: {
    categories: unknown[];
    home: {
      importantTopics: unknown[];
      quickLinks: unknown[];
    };
    announcements: unknown[];
    communications: unknown[];
    links: unknown[];
    contacts: unknown[];
    matrix: unknown[];
  };
  uploads: {
    limits: Record<string, number>;
    policies: Record<string, UploadPolicyEntry>;
  };
  search: {
    projectSearchEnabled: boolean;
    minQueryLength: number;
  };
};

type ProjectPreviewModuleEntry = {
  key: string;
  label: string;
  enabled: boolean;
  navVisible: boolean;
  navOrder: number | null;
  capabilitySummary: string[];
};

type ProjectPreviewUploadPolicy = {
  mediaKind: string;
  label: string;
  maxBytes: number;
  maxMegabytes: number;
  source: string;
  allowedMimePatterns: string[];
};

export type ProjectBootstrapPreviewModel = {
  sourceMode: "api";
  routeContext: ProjectBootstrapPreviewRouteContext;
  requestMeta: {
    requestId: string;
    timestamp: string;
  };
  project: ProjectBootstrapResponse["project"];
  access: ProjectBootstrapResponse["access"];
  capabilities: ProjectBootstrapResponse["capabilities"];
  configuration: ProjectBootstrapResponse["configuration"];
  projectCapabilities: string[];
  navigation: Array<{
    key: string;
    label: string;
  }>;
  modules: ProjectPreviewModuleEntry[];
  uploadPolicies: ProjectPreviewUploadPolicy[];
  search: ProjectBootstrapResponse["search"];
  rules: NonNullable<AppConfiguration["rules"]>;
  selectedDevUserEmail: string | null;
};

export const BACKEND_TO_FRONTEND_MODULE_KEY_MAP: Partial<Record<string, AppModuleKey>> = {
  matrix: "matrix",
  announcements: "announcements",
  communications: "komunikaty",
  templates: "szablony",
  pricing: "cenniki",
  phrases: "zwroty",
  links: "linki",
  contacts: "kontakty",
  important_topics: "tematOrg",
  forms: "formularze",
  home_sections: "homeSections",
  lead: "lead",
};

export const FRONTEND_TO_BACKEND_MODULE_KEY_MAP: Record<AppModuleKey, string> = {
  matrix: "matrix",
  szablony: "templates",
  cenniki: "pricing",
  komunikaty: "communications",
  tematOrg: "important_topics",
  linki: "links",
  formularze: "forms",
  kontakty: "contacts",
  zwroty: "phrases",
  homeSections: "home_sections",
  lead: "lead",
  announcements: "announcements",
};

export const FRONTEND_TO_BACKEND_NAV_KEY_MAP: Partial<Record<string, string>> = {
  matrix: "matrix",
  szablony: "templates",
  cenniki: "pricing",
  komunikaty: "communications",
  tematOrg: "important_topics",
  linki: "links",
  formularze: "forms",
  kontakty: "contacts",
  zwroty: "phrases",
};

const PROJECT_PREVIEW_ROUTE_MATCHERS = [
  { prefix: ROUTES.home, routeLabel: "Pulpit" },
  { prefix: ROUTES.admin, routeLabel: "Administracja" },
  { prefix: ROUTES.knowledgeBase, routeLabel: "Baza wiedzy" },
  { prefix: ROUTES.matrix, routeLabel: "Macierz" },
  { prefix: ROUTES.szablony, routeLabel: "Szablony" },
  { prefix: ROUTES.cenniki, routeLabel: "Cenniki" },
  { prefix: ROUTES.komunikaty, routeLabel: "Komunikaty" },
  { prefix: ROUTES.tematOrg, routeLabel: "Tematy organizacyjne" },
  { prefix: ROUTES.linki, routeLabel: "Linki" },
  { prefix: ROUTES.formularze, routeLabel: "Formularze" },
  { prefix: ROUTES.kontakty, routeLabel: "Dane kontaktowe" },
  { prefix: ROUTES.zwroty, routeLabel: "Gotowe zwroty" },
] as const;

const MODULE_LABELS: Record<string, string> = {
  home: "Pulpit projektu",
  matrix: "Macierz",
  announcements: "Ogłoszenia globalne",
  communications: "Komunikaty",
  templates: "Szablony",
  pricing: "Cenniki",
  phrases: "Gotowe zwroty",
  links: "Linki",
  forms: "Formularze",
  contacts: "Kontakty",
  important_topics: "Tematy organizacyjne",
  quick_links: "Szybkie linki",
  home_sections: "Sekcje strony głównej",
  lead: "Kwalifikacja leada",
};

const MEDIA_KIND_LABELS: Record<string, string> = {
  image: "Obrazy",
  file: "Pliki",
  video: "Wideo",
};

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveModuleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key;
}

function resolveMediaKindLabel(key: string): string {
  return MEDIA_KIND_LABELS[key] ?? key;
}

function formatCapabilityLabel(key: string): string {
  return key
    .replace(/^can/, "")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, (character) => character.toUpperCase());
}

function sortModuleEntries(
  left: [string, ProjectModuleConfiguration],
  right: [string, ProjectModuleConfiguration]
): number {
  const leftOrder = left[1].navOrder ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = right[1].navOrder ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left[0].localeCompare(right[0]);
}

function adaptMatrixRules(
  rules: ProjectBootstrapResponse["configuration"]["rules"]
): NonNullable<AppConfiguration["rules"]> {
  const matrixCategoryOrder = Array.isArray(rules.matrixCategoryOrder)
    ? rules.matrixCategoryOrder
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];

  return {
    matrixCategoryOrder,
    matrixAdvisoryRules: sanitizeMatrixAdvisoryRules(rules.matrixAdvisoryRules),
  };
}

function buildPreviewModules(
  configuration: ProjectBootstrapResponse["configuration"],
  capabilities: ProjectBootstrapResponse["capabilities"]
): ProjectPreviewModuleEntry[] {
  return Object.entries(configuration.modules)
    .sort(sortModuleEntries)
    .map(([moduleKey, moduleConfiguration]) => {
      const moduleCapabilities = capabilities.modules[moduleKey];

      return {
        key: moduleKey,
        label: resolveModuleLabel(moduleKey),
        enabled: moduleConfiguration.enabled,
        navVisible: moduleConfiguration.navVisible,
        navOrder: moduleConfiguration.navOrder,
        capabilitySummary: moduleCapabilities
          ? Object.entries(moduleCapabilities)
              .filter(([key, enabled]) => key !== "enabled" && enabled)
              .map(([key]) => formatCapabilityLabel(key))
          : [],
      };
    });
}

function buildPreviewNavigation(
  navigationKeys: ProjectBootstrapResponse["configuration"]["navigation"]
): Array<{ key: string; label: string }> {
  return navigationKeys.map((entryKey) => ({
    key: entryKey,
    label: resolveModuleLabel(entryKey),
  }));
}

export function adaptProjectBootstrapConfiguration(
  configuration: ProjectBootstrapResponse["configuration"]
): AppConfiguration {
  const enabled: AppModuleToggleMap = {};
  const settings: AppModuleSettingsMap = {};

  for (const [backendModuleKey, moduleConfiguration] of Object.entries(configuration.modules)) {
    const frontendModuleKey = BACKEND_TO_FRONTEND_MODULE_KEY_MAP[backendModuleKey];

    if (!frontendModuleKey) {
      continue;
    }

    enabled[frontendModuleKey] = moduleConfiguration.enabled;
    (settings as Record<string, unknown>)[frontendModuleKey] = moduleConfiguration.settings;
  }

  const mainNavOrder = configuration.navigation.reduce<Array<"home" | AppModuleKey>>(
    (result, entryKey) => {
      if (entryKey === "home") {
        result.push("home");
        return result;
      }

      const frontendModuleKey = BACKEND_TO_FRONTEND_MODULE_KEY_MAP[entryKey];

      if (frontendModuleKey) {
        result.push(frontendModuleKey);
      }

      return result;
    },
    []
  );

  return {
    modules: {
      enabled,
      settings,
    },
    navigation: {
      mainNavOrder,
    },
    rules: adaptMatrixRules(configuration.rules),
  };
}

export function adaptProjectBootstrapHomeSpotlights(
  configuration: ProjectBootstrapResponse["configuration"]
): {
  items: HomeSpotlight[];
  managed: boolean;
} {
  return {
    items: [...configuration.homeSpotlights]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        pageId: item.pageId,
        ...(item.labelOverride?.trim() ? { labelOverride: item.labelOverride.trim() } : {}),
        sortOrder: item.sortOrder,
      })),
    managed: configuration.homeSpotlightsManaged,
  };
}

export function adaptProjectBootstrapLeadConfig(
  configuration: ProjectBootstrapResponse["configuration"]
): {
  config: LeadConfig;
  managed: boolean;
} {
  return {
    config: configuration.leadConfig,
    managed: configuration.leadConfigManaged,
  };
}

export function resolveProjectBootstrapPreviewRoute(
  pathname: string
): ProjectBootstrapPreviewRouteContext | null {
  const projectPath = resolveProjectPathMatch(pathname);

  if (!projectPath) {
    return null;
  }

  const matchedRoute = PROJECT_PREVIEW_ROUTE_MATCHERS.find(({ prefix }) =>
    matchesRoutePrefix(projectPath.localPath, prefix)
  );

  if (!matchedRoute) {
    return null;
  }

  return {
    pathname,
    routeLabel: matchedRoute.routeLabel,
    projectSlug: projectPath.projectSlug,
  };
}

export async function fetchProjectBootstrap(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectBootstrapResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/bootstrap`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project bootstrap request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectBootstrapResponse>;
}

export function adaptProjectBootstrapToPreview(
  routeContext: ProjectBootstrapPreviewRouteContext,
  payload: ApiEnvelope<ProjectBootstrapResponse>
): ProjectBootstrapPreviewModel {
  const projectCapabilities = Object.entries(payload.data.capabilities.project)
    .filter(([, enabled]) => enabled)
    .map(([key]) => formatCapabilityLabel(key));

  const modules = buildPreviewModules(payload.data.configuration, payload.data.capabilities);

  const navigation = buildPreviewNavigation(payload.data.configuration.navigation);

  const uploadPolicies = Object.entries(payload.data.uploads.policies).map(
    ([mediaKind, policy]) => ({
      mediaKind,
      label: resolveMediaKindLabel(mediaKind),
      maxBytes: policy.maxBytes,
      maxMegabytes: bytesToMegabytes(policy.maxBytes),
      source: policy.source,
      allowedMimePatterns: policy.allowedMimePatterns,
    })
  );

  return {
    sourceMode: "api",
    routeContext,
    requestMeta: payload.meta,
    project: payload.data.project,
    access: payload.data.access,
    capabilities: payload.data.capabilities,
    configuration: payload.data.configuration,
    projectCapabilities,
    navigation,
    modules,
    uploadPolicies,
    search: payload.data.search,
    rules: adaptMatrixRules(payload.data.configuration.rules),
    selectedDevUserEmail: getSelectedBootstrapPreviewDevUserEmail(),
  };
}

export function withUpdatedProjectBootstrapConfiguration(
  preview: ProjectBootstrapPreviewModel,
  configuration: ProjectBootstrapResponse["configuration"]
): ProjectBootstrapPreviewModel {
  return {
    ...preview,
    configuration,
    modules: buildPreviewModules(configuration, preview.capabilities),
    navigation: buildPreviewNavigation(configuration.navigation),
    rules: adaptMatrixRules(configuration.rules),
  };
}