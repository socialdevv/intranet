import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import CategoryTree from "@/components/layout/category-tree";
import { ROUTES } from "@/lib/routes";
import { useData } from "@/contexts/data-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import type { TemporaryShellBootstrapCutover } from "@/hooks/useTemporaryShellBootstrapCutover";
import type { AppModuleKey } from "@/lib/types/domain";

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  shellCutover?: TemporaryShellBootstrapCutover;
};

/** Canonical map of all main-nav modules. Key = stable route-key identifier. */
const ALL_NAV_ITEMS: Record<string, { label: string; href: string; icon: ReactNode }> = {
  home:       { label: "Pulpit",           href: ROUTES.home,       icon: <GridIcon /> },
  matrix:     { label: "Macierz",          href: ROUTES.matrix,     icon: <TableIcon /> },
  szablony:   { label: "Szablony",         href: ROUTES.szablony,   icon: <TemplateIcon /> },
  cenniki:    { label: "Cenniki",          href: ROUTES.cenniki,    icon: <PriceListIcon /> },
  komunikaty: { label: "Komunikaty",           href: ROUTES.komunikaty, icon: <BellIcon /> },
  tematOrg:   { label: "Tematy organizacyjne", href: ROUTES.tematOrg,   icon: <OrgTopicsIcon /> },
  linki:      { label: "Linki",                href: ROUTES.linki,      icon: <LinkIcon /> },
  formularze: { label: "Formularze",           href: ROUTES.formularze, icon: <FormIcon /> },
  kontakty:   { label: "Dane kontaktowe",  href: ROUTES.kontakty,   icon: <PhoneBookIcon /> },
  zwroty:     { label: "Gotowe zwroty",    href: ROUTES.zwroty,     icon: <PhrasesIcon /> },
};

function isKnownNavItemKey(key: string): key is keyof typeof ALL_NAV_ITEMS {
  return key in ALL_NAV_ITEMS;
}

export default function Sidebar({ mobileOpen, onCloseMobile, shellCutover }: SidebarProps) {
  const { pathname } = useLocation();
  const { navOrder, enabledModules, moduleSettings } = useData();
  const { resolveHref } = useProjectRouting();

  const isModuleVisible = (moduleKey: AppModuleKey): boolean => {
    const settings = moduleSettings[moduleKey];
    const legacyNavVisible = settings && "navigation" in settings ? settings.navigation.visible : true;
    const legacyVisible = enabledModules[moduleKey] && legacyNavVisible;
    const shellVisible = shellCutover?.navigation?.moduleVisibility[moduleKey];

    // During cutover, backend navigation can opt modules into the shell,
    // but missing/false backend flags must not erase legacy pages.
    return shellVisible === true || legacyVisible;
  };

  const resolveOrderedNavKeys = (): Array<keyof typeof ALL_NAV_ITEMS> => {
    const preferredNavKeys = shellCutover?.navigation?.preferredNavKeys ?? [];

    const legacyVisibleKeys = navOrder.filter(
      (key): key is keyof typeof ALL_NAV_ITEMS =>
        isKnownNavItemKey(key) && (key === "home" || isModuleVisible(key as AppModuleKey))
    );

    if (preferredNavKeys.length === 0) {
      return legacyVisibleKeys;
    }

    const preferredVisibleKeys = preferredNavKeys.filter(
      (key): key is keyof typeof ALL_NAV_ITEMS =>
        isKnownNavItemKey(key) && (key === "home" || isModuleVisible(key as AppModuleKey))
    );

    return [...new Set([...preferredVisibleKeys, ...legacyVisibleKeys])];
  };

  const orderedItems = resolveOrderedNavKeys()
    .map((key) => {
      const item = ALL_NAV_ITEMS[key];
      if (!item) return null;
      if (key === "home") {
        return {
          key,
          ...item,
          href: resolveHref(item.href),
        };
      }
      const moduleKey = key as AppModuleKey;
      const settings = moduleSettings[moduleKey];
      const navLabel = settings && "navigation" in settings ? settings.navigation.label : item.label;
      return {
        key,
        ...item,
        label: navLabel,
        href: resolveHref(item.href),
      };
    })
    .filter((item): item is { key: string; label: string; href: string; icon: ReactNode } => Boolean(item));

  const navContent = (
    <div className="w-full px-3">
      <nav className="space-y-2">
        {orderedItems.map((item) => {
          const isActive =
            item.key === "home"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link key={item.href} to={item.href} onClick={onCloseMobile}>
              <span
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-[#e8edf5] text-[#111827] dark:bg-[#1e3a5f] dark:text-[#f1f5f9]"
                    : "text-[#4b5563] hover:bg-[#f3f5f8] hover:text-[#111827] dark:text-[#94a3b8] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
                }`}
              >
                <span className="text-[#6b7280]">{item.icon}</span>
                <span>{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <section className="mt-6 border-t border-[#edf1f5] pt-4">
        <h3 className="px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
          Kategorie
        </h3>
        <CategoryTree />
      </section>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-transparent lg:hidden"
          onClick={onCloseMobile}
          aria-label="Zamknij nawigację"
        />
      )}

      <aside
        className={`fixed left-0 top-(--topbar-h,3.5rem) z-40 h-[calc(100vh-var(--topbar-h,3.5rem))] w-[min(23rem,calc(100vw-1rem))] overflow-y-auto border-r border-[#e5e7eb] bg-[#f8fafb]/95 py-5 transition-all duration-200 lg:hidden dark:border-[#334155] dark:bg-[#0f172a]/95 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      <aside className="hidden h-[calc(100vh-var(--topbar-h,3.5rem))] w-92 shrink-0 basis-92 overflow-y-auto border-r border-[#e5e7eb] bg-[#f8fafb]/95 py-5 lg:sticky lg:top-(--topbar-h,3.5rem) lg:block dark:border-[#334155] dark:bg-[#0f172a]/95">
        {navContent}
      </aside>
    </>
  );
}

function GridIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18M15 3v18" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  );
}

function PriceListIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h10M4 17h14" />
      <circle cx="18" cy="7" r="2" />
    </svg>
  );
}

function OrgTopicsIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function FormIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function PhoneBookIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.82a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z" />
    </svg>
  );
}

function PhrasesIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}
