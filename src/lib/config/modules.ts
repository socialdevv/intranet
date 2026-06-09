import type {
  AppModuleKey,
  AppModuleSettingsMap,
  AppModuleToggleMap,
  GenericModuleSettings,
} from "@/lib/types/domain";

export type ModuleGroup = "knowledge" | "operations" | "experience";

export type ModuleDefinition = {
  key: AppModuleKey;
  label: string;
  description: string;
  group: ModuleGroup;
  navKey?: string;
  supports: {
    navigation: boolean;
    homepageCard: boolean;
    customSettings: "none" | "homeSections" | "lead" | "announcements";
  };
};

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    key: "matrix",
    label: "Macierz",
    description: "Routing spraw i decyzje operacyjne.",
    group: "operations",
    navKey: "matrix",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "szablony",
    label: "Szablony",
    description: "Biblioteka gotowych treści dla konsultantów.",
    group: "knowledge",
    navKey: "szablony",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "cenniki",
    label: "Cenniki",
    description: "Publikacja i wyszukiwanie danych taryfowych.",
    group: "operations",
    navKey: "cenniki",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "komunikaty",
    label: "Komunikaty",
    description: "Moduł aktualności i komunikacji wewnętrznej.",
    group: "experience",
    navKey: "komunikaty",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "tematOrg",
    label: "Tematy organizacyjne",
    description: "Wpisy organizacyjne i informacje proceduralne.",
    group: "experience",
    navKey: "tematOrg",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "linki",
    label: "Linki",
    description: "Szybki dostęp do zasobów wewnętrznych i zewnętrznych.",
    group: "experience",
    navKey: "linki",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "formularze",
    label: "Formularze",
    description: "Własne formularze projektowe i ich zgłoszenia.",
    group: "operations",
    navKey: "formularze",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "kontakty",
    label: "Dane kontaktowe",
    description: "Książka kontaktów i grup roboczych.",
    group: "operations",
    navKey: "kontakty",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "zwroty",
    label: "Gotowe zwroty",
    description: "Baza zatwierdzonych formuł komunikacyjnych.",
    group: "knowledge",
    navKey: "zwroty",
    supports: { navigation: true, homepageCard: true, customSettings: "none" },
  },
  {
    key: "homeSections",
    label: "Sekcje strony głównej",
    description: "Konfigurowalne sekcje " +
      "Ważne tematy" +
      " i " +
      "Szybkie linki" +
      ".",
    group: "experience",
    supports: { navigation: false, homepageCard: false, customSettings: "homeSections" },
  },
  {
    key: "lead",
    label: "Kwalifikacja leada",
    description: "Widget pytań i reguł kwalifikacji leada.",
    group: "operations",
    supports: { navigation: false, homepageCard: false, customSettings: "lead" },
  },
  {
    key: "announcements",
    label: "Ogłoszenia globalne",
    description: "Paski i modalne ogłoszenia w interfejsie.",
    group: "experience",
    supports: { navigation: false, homepageCard: false, customSettings: "announcements" },
  },
];

export const MODULE_KEYS = MODULE_DEFINITIONS.map((m) => m.key) as AppModuleKey[];

export const QUICK_ACCESS_MAX_TILES = 6;

/** Sidebar modules that may appear as quick-access tiles when enabled. */
export const QUICK_ACCESS_ELIGIBLE_MODULE_KEYS: AppModuleKey[] = MODULE_DEFINITIONS.filter(
  (moduleDef) => moduleDef.supports.navigation && Boolean(moduleDef.navKey)
).map((moduleDef) => moduleDef.key);

export const HOME_QUICK_ACCESS_DEFAULT_KEYS: AppModuleKey[] = [
  "matrix",
  "szablony",
  "cenniki",
  "kontakty",
  "zwroty",
  "linki",
];

export function isQuickAccessEligibleModuleKey(
  moduleKey: AppModuleKey
): moduleKey is (typeof QUICK_ACCESS_ELIGIBLE_MODULE_KEYS)[number] {
  return QUICK_ACCESS_ELIGIBLE_MODULE_KEYS.includes(
    moduleKey as (typeof QUICK_ACCESS_ELIGIBLE_MODULE_KEYS)[number]
  );
}

export function resolveQuickAccessOrder(
  moduleSettings: ResolvedModuleSettingsMap,
  navOrder: string[]
): AppModuleKey[] {
  const eligible = QUICK_ACCESS_ELIGIBLE_MODULE_KEYS;
  const eligibleSet = new Set(eligible);
  const saved = moduleSettings.homeSections.homepage.quickAccessOrder ?? [];
  const fromSaved = saved.filter((key) => eligibleSet.has(key));
  const fromNav = navOrder.filter(
    (key): key is AppModuleKey => key !== "home" && eligibleSet.has(key as AppModuleKey)
  );
  const base =
    fromSaved.length > 0
      ? fromSaved
      : fromNav.length > 0
        ? fromNav
        : HOME_QUICK_ACCESS_DEFAULT_KEYS.filter((key) => eligibleSet.has(key));
  const missing = eligible.filter((key) => !base.includes(key));

  return [...base, ...missing];
}

export function countActiveQuickAccessTiles(
  enabledModules: AppModuleToggleMap,
  moduleSettings: ResolvedModuleSettingsMap
): number {
  return resolveQuickAccessOrder(moduleSettings, []).filter((moduleKey) => {
    if (!enabledModules[moduleKey]) {
      return false;
    }

    const settings = moduleSettings[moduleKey];
    return "homepageCard" in settings && settings.homepageCard.visible;
  }).length;
}

export const MAIN_NAV_MODULE_KEYS = MODULE_DEFINITIONS
  .filter((m) => Boolean(m.navKey))
  .map((m) => m.navKey as string);

export const DEFAULT_NAV_ORDER = ["home", ...MAIN_NAV_MODULE_KEYS];

export const DEFAULT_ENABLED_MODULES: Record<AppModuleKey, boolean> = MODULE_DEFINITIONS.reduce(
  (acc, moduleDef) => {
    acc[moduleDef.key] = true;
    return acc;
  },
  {} as Record<AppModuleKey, boolean>
);

type ResolvedGenericModuleSettings = {
  navigation: {
    visible: boolean;
    label: string;
  };
  homepageCard: {
    visible: boolean;
    title: string;
    description: string;
  };
};

export type ResolvedModuleSettingsMap = {
  matrix: ResolvedGenericModuleSettings;
  szablony: ResolvedGenericModuleSettings;
  cenniki: ResolvedGenericModuleSettings;
  komunikaty: ResolvedGenericModuleSettings;
  tematOrg: ResolvedGenericModuleSettings;
  linki: ResolvedGenericModuleSettings;
  formularze: ResolvedGenericModuleSettings;
  kontakty: ResolvedGenericModuleSettings;
  zwroty: ResolvedGenericModuleSettings;
  homeSections: {
    homepage: {
      showQuickAccess: boolean;
      showSpotlights: boolean;
      showQuickLinks: boolean;
      quickAccessOrder: AppModuleKey[];
    };
  };
  lead: {
    widget: {
      enabledInShell: boolean;
      title: string;
    };
  };
  announcements: {
    surfaces: {
      showTopbarPills: boolean;
      showHomePills: boolean;
    };
  };
};

const MODULE_BY_KEY: Record<AppModuleKey, ModuleDefinition> = MODULE_DEFINITIONS.reduce(
  (acc, moduleDef) => {
    acc[moduleDef.key] = moduleDef;
    return acc;
  },
  {} as Record<AppModuleKey, ModuleDefinition>
);

function defaultGenericSettings(moduleKey: AppModuleKey): ResolvedGenericModuleSettings {
  const moduleDef = MODULE_BY_KEY[moduleKey];
  return {
    navigation: {
      visible: Boolean(moduleDef.navKey),
      label: moduleDef.label,
    },
    homepageCard: {
      visible: HOME_QUICK_ACCESS_DEFAULT_KEYS.includes(moduleKey),
      title: moduleDef.label,
      description: moduleDef.description,
    },
  };
}

function mergeGenericSettings(
  defaults: ResolvedGenericModuleSettings,
  input: GenericModuleSettings | undefined
): ResolvedGenericModuleSettings {
  return {
    navigation: {
      visible: input?.navigation?.visible ?? defaults.navigation.visible,
      label: input?.navigation?.label?.trim() || defaults.navigation.label,
    },
    homepageCard: {
      visible: input?.homepageCard?.visible ?? defaults.homepageCard.visible,
      title: input?.homepageCard?.title?.trim() || defaults.homepageCard.title,
      description: input?.homepageCard?.description?.trim() || defaults.homepageCard.description,
    },
  };
}

export const DEFAULT_MODULE_SETTINGS: ResolvedModuleSettingsMap = {
  matrix: defaultGenericSettings("matrix"),
  szablony: defaultGenericSettings("szablony"),
  cenniki: defaultGenericSettings("cenniki"),
  komunikaty: defaultGenericSettings("komunikaty"),
  tematOrg: defaultGenericSettings("tematOrg"),
  linki: defaultGenericSettings("linki"),
  formularze: defaultGenericSettings("formularze"),
  kontakty: defaultGenericSettings("kontakty"),
  zwroty: defaultGenericSettings("zwroty"),
  homeSections: {
    homepage: {
      showQuickAccess: true,
      showSpotlights: true,
      showQuickLinks: true,
      quickAccessOrder: [...QUICK_ACCESS_ELIGIBLE_MODULE_KEYS],
    },
  },
  lead: {
    widget: {
      enabledInShell: true,
      title: "Kwalifikacja leada",
    },
  },
  announcements: {
    surfaces: {
      showTopbarPills: true,
      showHomePills: true,
    },
  },
};

export function resolveModuleSettings(
  settings?: AppModuleSettingsMap
): ResolvedModuleSettingsMap {
  return {
    matrix: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.matrix, settings?.matrix),
    szablony: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.szablony, settings?.szablony),
    cenniki: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.cenniki, settings?.cenniki),
    komunikaty: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.komunikaty, settings?.komunikaty),
    tematOrg: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.tematOrg, settings?.tematOrg),
    linki: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.linki, settings?.linki),
    formularze: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.formularze, settings?.formularze),
    kontakty: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.kontakty, settings?.kontakty),
    zwroty: mergeGenericSettings(DEFAULT_MODULE_SETTINGS.zwroty, settings?.zwroty),
    homeSections: {
      homepage: {
        showQuickAccess:
          settings?.homeSections?.homepage?.showQuickAccess ??
          DEFAULT_MODULE_SETTINGS.homeSections.homepage.showQuickAccess,
        showSpotlights:
          settings?.homeSections?.homepage?.showSpotlights ??
          DEFAULT_MODULE_SETTINGS.homeSections.homepage.showSpotlights,
        showQuickLinks:
          settings?.homeSections?.homepage?.showQuickLinks ??
          DEFAULT_MODULE_SETTINGS.homeSections.homepage.showQuickLinks,
        quickAccessOrder: (() => {
          const saved = settings?.homeSections?.homepage?.quickAccessOrder;
          if (!Array.isArray(saved)) {
            return DEFAULT_MODULE_SETTINGS.homeSections.homepage.quickAccessOrder;
          }

          const eligible = new Set(QUICK_ACCESS_ELIGIBLE_MODULE_KEYS);
          const normalized = saved.filter(
            (key): key is AppModuleKey =>
              typeof key === "string" && eligible.has(key as AppModuleKey)
          );
          const missing = QUICK_ACCESS_ELIGIBLE_MODULE_KEYS.filter((key) => !normalized.includes(key));

          return normalized.length > 0
            ? [...normalized, ...missing]
            : DEFAULT_MODULE_SETTINGS.homeSections.homepage.quickAccessOrder;
        })(),
      },
    },
    lead: {
      widget: {
        enabledInShell:
          settings?.lead?.widget?.enabledInShell ??
          DEFAULT_MODULE_SETTINGS.lead.widget.enabledInShell,
        title:
          settings?.lead?.widget?.title?.trim() ||
          DEFAULT_MODULE_SETTINGS.lead.widget.title,
      },
    },
    announcements: {
      surfaces: {
        showTopbarPills:
          settings?.announcements?.surfaces?.showTopbarPills ??
          DEFAULT_MODULE_SETTINGS.announcements.surfaces.showTopbarPills,
        showHomePills:
          settings?.announcements?.surfaces?.showHomePills ??
          DEFAULT_MODULE_SETTINGS.announcements.surfaces.showHomePills,
      },
    },
  };
}

export function resolveEnabledModules(
  enabled?: AppModuleToggleMap
): Record<AppModuleKey, boolean> {
  const merged = { ...DEFAULT_ENABLED_MODULES };
  if (!enabled) return merged;
  for (const key of MODULE_KEYS) {
    if (typeof enabled[key] === "boolean") merged[key] = enabled[key] as boolean;
  }
  return merged;
}

export function sanitizeModuleSettings(input: unknown): AppModuleSettingsMap {
  if (!input || typeof input !== "object") return {};
  const raw = input as Record<string, unknown>;
  const sanitized: AppModuleSettingsMap = {};

  for (const key of MODULE_KEYS) {
    const candidate = raw[key];
    if (candidate && typeof candidate === "object") {
      (sanitized as Record<string, unknown>)[key] = candidate;
    }
  }

  return sanitized;
}
