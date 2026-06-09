import {
  QUICK_ACCESS_ELIGIBLE_MODULE_KEYS,
  QUICK_ACCESS_MAX_TILES,
  resolveQuickAccessOrder,
  type ResolvedModuleSettingsMap,
} from "@/lib/config/modules";
import { ROUTES, knowledgeArticlePath } from "@/lib/routes";
import type {
  AppModuleKey,
  AppModuleToggleMap,
  HomeQuickLink,
  HomeSpotlight,
  KnowledgePage,
} from "@/lib/types/domain";

export type QuickAccessModuleKey = Exclude<AppModuleKey, "homeSections" | "lead" | "announcements">;

export type QuickAccessItem = {
  moduleKey: QuickAccessModuleKey;
  title: string;
  description: string;
  href: string;
};

export type ResolvedHomeSpotlight = {
  id: string;
  label: string;
  href: string;
  categoryDisplayName?: string;
};

const QUICK_ACCESS_META: Record<
  QuickAccessModuleKey,
  { href: string; fallbackTitle: string; fallbackDescription: string }
> = {
  matrix: {
    href: ROUTES.matrix,
    fallbackTitle: "Macierz",
    fallbackDescription: "Rozdzielnik spraw i routingów.",
  },
  szablony: {
    href: ROUTES.szablony,
    fallbackTitle: "Szablony",
    fallbackDescription: "Gotowe treści do korespondencji.",
  },
  cenniki: {
    href: ROUTES.cenniki,
    fallbackTitle: "Cenniki",
    fallbackDescription: "Obowiązujące taryfy energetyczne.",
  },
  komunikaty: {
    href: ROUTES.komunikaty,
    fallbackTitle: "Komunikaty",
    fallbackDescription: "Aktualności i komunikacja wewnętrzna.",
  },
  tematOrg: {
    href: ROUTES.tematOrg,
    fallbackTitle: "Tematy organizacyjne",
    fallbackDescription: "Informacje proceduralne i organizacyjne.",
  },
  kontakty: {
    href: ROUTES.kontakty,
    fallbackTitle: "Dane kontaktowe",
    fallbackDescription: "Kontakty i grupy kontaktowe.",
  },
  zwroty: {
    href: ROUTES.zwroty,
    fallbackTitle: "Gotowe zwroty",
    fallbackDescription: "Szybkie zwroty dla konsultantów.",
  },
  linki: {
    href: ROUTES.linki,
    fallbackTitle: "Linki",
    fallbackDescription: "Przydatne linki do codziennej pracy.",
  },
  formularze: {
    href: ROUTES.formularze,
    fallbackTitle: "Formularze",
    fallbackDescription: "Własne formularze i zgłoszenia projektowe.",
  },
};

export function isHomeSectionsModuleActive(enabledModules: AppModuleToggleMap): boolean {
  return Boolean(enabledModules.homeSections);
}

export function resolveHomepageLayoutFlags(
  enabledModules: AppModuleToggleMap,
  moduleSettings: ResolvedModuleSettingsMap
) {
  const homeSectionsActive = isHomeSectionsModuleActive(enabledModules);

  return {
    showQuickAccess:
      homeSectionsActive && moduleSettings.homeSections.homepage.showQuickAccess,
    showSpotlights:
      homeSectionsActive && moduleSettings.homeSections.homepage.showSpotlights,
    showQuickLinks:
      homeSectionsActive && moduleSettings.homeSections.homepage.showQuickLinks,
  };
}

/** Tailwind grid classes for the dashboard quick-access row (1–6 tiles). */
export function resolveQuickAccessGridClass(tileCount: number): string {
  const count = Math.min(Math.max(tileCount, 1), 6);
  const base = "grid w-full gap-4";

  switch (count) {
    case 1:
      // Single tile: avoid a full-bleed strip; still left-aligned in the section.
      return `${base} max-w-xs grid-cols-1`;
    case 2:
      return `${base} grid-cols-1 sm:grid-cols-2`;
    case 3:
      return `${base} grid-cols-1 sm:grid-cols-3`;
    case 4:
      return `${base} grid-cols-2 lg:grid-cols-4`;
    case 5:
      return `${base} grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`;
    default:
      return `${base} grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`;
  }
}

export function buildVisibleQuickAccessItems(
  enabledModules: AppModuleToggleMap,
  moduleSettings: ResolvedModuleSettingsMap,
  navOrder: string[] = []
): QuickAccessItem[] {
  const { showQuickAccess } = resolveHomepageLayoutFlags(enabledModules, moduleSettings);

  if (!showQuickAccess) {
    return [];
  }

  const orderedKeys = resolveQuickAccessOrder(moduleSettings, navOrder);
  const items: QuickAccessItem[] = [];

  for (const moduleKey of orderedKeys) {
    if (items.length >= QUICK_ACCESS_MAX_TILES) {
      break;
    }

    if (!QUICK_ACCESS_ELIGIBLE_MODULE_KEYS.includes(moduleKey as QuickAccessModuleKey)) {
      continue;
    }

    if (!enabledModules[moduleKey]) {
      continue;
    }

    const settings = moduleSettings[moduleKey];
    if (!("homepageCard" in settings) || !settings.homepageCard.visible) {
      continue;
    }

    const meta = QUICK_ACCESS_META[moduleKey as QuickAccessModuleKey];

    items.push({
      moduleKey: moduleKey as QuickAccessModuleKey,
      href: meta.href,
      title: settings.homepageCard.title.trim() || meta.fallbackTitle,
      description: settings.homepageCard.description.trim() || meta.fallbackDescription,
    });
  }

  return items;
}

export function buildResolvedHomeSpotlights(
  spotlights: HomeSpotlight[],
  pages: KnowledgePage[],
  options: {
    enabled: boolean;
    resolveProjectHref: (href: string) => string;
  }
): ResolvedHomeSpotlight[] {
  if (!options.enabled) {
    return [];
  }

  return [...spotlights]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .flatMap((spotlight) => {
      const page = pages.find((entry) => entry.id === spotlight.pageId);
      if (!page) {
        return [];
      }

      return [
        {
          id: spotlight.id,
          label: spotlight.labelOverride?.trim() || page.title,
          href: options.resolveProjectHref(knowledgeArticlePath(page.category, page.slug)),
          categoryDisplayName: page.categoryDisplayName,
        },
      ];
    });
}

export function buildSortedHomeQuickLinks(
  links: HomeQuickLink[],
  enabled: boolean
): HomeQuickLink[] {
  if (!enabled) {
    return [];
  }

  return [...links].sort((left, right) => left.sortOrder - right.sortOrder);
}
