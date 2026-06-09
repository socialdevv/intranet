import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Megaphone } from "lucide-react";
import UserMenuDropdown from "@/components/layout/user-menu-dropdown";
import type { UserMenuDisplayOverride } from "@/components/layout/user-menu-dropdown";
import AnnouncementModal from "@/components/layout/announcement-modal";
import { useTheme } from "@/contexts/theme-context";
import { useData } from "@/contexts/data-context";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import type { TemporaryShellBootstrapCutover } from "@/hooks/useTemporaryShellBootstrapCutover";
import { isAnnouncementVisibleNow } from "@/lib/announcements/visibility";
import {
  GLOBAL_APP_NAME,
  isShellBrandingPending,
  resolveAppBrowserTitle,
} from "@/lib/config/branding";
import { ROUTES } from "@/lib/routes";
import type { AppUser, AnnouncementColor } from "@/lib/types/domain";

// ── Color config for navbar pills ────────────────────────────────────────────

const PILL_COLOR: Record<AnnouncementColor, string> = {
  red: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626] hover:border-[#dc2626] hover:bg-[#fee2e2] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#f87171] dark:hover:border-[#f87171]",
  orange: "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c] hover:border-[#ea580c] dark:border-[#7c2d12]/50 dark:bg-[#1a0a00] dark:text-[#fb923c]",
  green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] hover:border-[#16a34a] dark:border-[#14532d]/50 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] hover:border-[#2563eb] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340] dark:text-[#60a5fa]",
};

type TopbarProps = {
  onToggleMobile: () => void;
  currentUser: AppUser | null;
  searchPlaceholder?: string;
  onOpenSearch: () => void;
  hideAnnouncementBar?: boolean;
  shellCutover?: TemporaryShellBootstrapCutover;
  navigationMode?: "project" | "platform" | "global";
};

export default function Topbar({
  onToggleMobile,
  currentUser,
  searchPlaceholder,
  onOpenSearch,
  hideAnnouncementBar,
  shellCutover,
  navigationMode = "project",
}: TopbarProps) {
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const { theme, toggleTheme } = useTheme();
  const {
    announcements,
    data,
    enabledModules,
    moduleSettings,
    systemSettings,
    projectBootstrapState,
    platformBootstrapState,
  } = useData();
  const { activeProjectSlug, buildProjectHref, isProjectRoute } = useProjectRouting();
  const isBrandingPending = isShellBrandingPending({
    navigationMode,
    isProjectRoute,
    projectBootstrapState,
    platformBootstrapState,
  });
  const appBranding =
    resolveAppBrowserTitle({
      projectBootstrapState,
      platformBootstrapState,
      shellProjectDisplayName: shellCutover?.projectBranding?.projectDisplayName,
      systemSettings,
      fallbackAppName: data.meta?.appName,
      activeProjectSlug,
      navigationMode,
      isProjectRoute,
    }) ?? GLOBAL_APP_NAME;
  const brandHref = navigationMode === "project" && isProjectRoute
    ? buildProjectHref(ROUTES.home)
    : "/";
  const now = useCurrentTime();
  const activeAnnouncements = useMemo(
    () =>
      enabledModules.announcements && moduleSettings.announcements.surfaces.showTopbarPills
        ? announcements.filter((a) => isAnnouncementVisibleNow(a, now))
        : [],
    [announcements, enabledModules.announcements, moduleSettings.announcements.surfaces.showTopbarPills, now]
  );
  const [modalInitialId, setModalInitialId] = useState<string | null>(null);

  useEffect(() => {
    if (!modalInitialId) return;
    if (activeAnnouncements.some((announcement) => announcement.id === modalInitialId)) return;
    setModalInitialId(null);
  }, [activeAnnouncements, modalInitialId]);

  const shellUserDisplayOverride: UserMenuDisplayOverride | undefined = shellCutover?.currentUserDisplay
    ? {
        displayName: shellCutover.currentUserDisplay.displayName,
        initials: shellCutover.currentUserDisplay.initials,
        secondaryText: shellCutover.currentUserDisplay.secondaryText,
      }
    : undefined;

  return (
    <>
      <header data-app-top-chrome className="sticky top-0 z-40 border-b border-[#e8edf3] bg-white/90 shadow-sm backdrop-blur-md supports-backdrop-filter:bg-white/80 dark:border-[#1e293b] dark:bg-[#0f172a]/90 dark:shadow-[0_1px_0_rgba(0,0,0,0.25)] dark:supports-backdrop-filter:bg-[#0f172a]/80">
        {/* Main topbar row */}
        <div className="mx-auto flex h-14 w-full max-w-400 items-center gap-3 px-4 sm:gap-4 sm:px-5 lg:px-10">
          {/* Left — logo + mobile menu toggle */}
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onToggleMobile}
              className="ui-btn ui-btn-neutral ui-btn-md h-9 shrink-0 px-2.5 text-sm lg:hidden"
              aria-label="Przełącz menu nawigacji"
            >
              Menu
            </button>
            <Link
              to={brandHref}
              className="flex min-h-7 min-w-0 items-center truncate text-lg font-bold tracking-[-0.03em] text-[#0f172a] sm:min-h-8 sm:text-xl dark:text-[#f1f5f9]"
              aria-label={isBrandingPending ? "Ładowanie nazwy aplikacji" : appBranding}
            >
              {isBrandingPending ? (
                <span
                  className="inline-block h-6 w-44 max-w-[52vw] shrink-0 animate-pulse rounded-md bg-[#e2e8f0] sm:h-7 sm:w-52 dark:bg-[#334155]"
                  aria-hidden
                />
              ) : (
                appBranding
              )}
            </Link>
          </div>

          {/* Centre — search trigger */}
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              ref={searchBtnRef}
              type="button"
              onClick={onOpenSearch}
              aria-label="Otwórz wyszukiwanie (Ctrl+K)"
              className="ui-panel-soft relative flex h-9 w-full max-w-md items-center gap-2 pl-9 pr-3 text-left text-sm text-[#94a3b8] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] hover:border-[#94a3b8] hover:bg-[#f1f5f9] lg:max-w-xl dark:shadow-none dark:hover:border-[#475569] dark:hover:bg-[#263347]"
            >
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
              <span className="flex-1 truncate">{searchPlaceholder ?? "Szukaj…"}</span>
              <kbd className="ui-kbd hidden shrink-0 sm:inline">
                Ctrl+K
              </kbd>
            </button>
          </div>

          {/* Right — theme toggle + user menu */}
          <div className="flex shrink-0 items-center gap-1.5 pl-1">
            {!currentUser && shellCutover?.currentUserDisplay && (
              <span
                title={shellCutover.currentUserDisplay.secondaryText}
                className="hidden h-8 max-w-48 items-center gap-2 rounded-full border border-[#dbeafe] bg-[#eff6ff] px-2.5 text-xs font-medium text-[#1d4f91] md:inline-flex dark:border-[#1e3a5f] dark:bg-[#0f2340] dark:text-[#93c5fd]"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/70 text-[10px] font-semibold text-[#1d4f91] dark:bg-[#0b1b30] dark:text-[#bfdbfe]">
                  {shellCutover.currentUserDisplay.initials}
                </span>
                <span className="truncate">{shellCutover.currentUserDisplay.displayName}</span>
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Przełącz na tryb jasny" : "Przełącz na tryb ciemny"}
              className="ui-btn-icon h-9 w-9 shrink-0 hover:bg-[#f1f5f9] hover:text-[#374151] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {currentUser ? (
              <UserMenuDropdown currentUser={currentUser} displayOverride={shellUserDisplayOverride} />
            ) : (
              <span className="inline-flex h-8 items-center rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 text-[11px] font-medium text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Ustalanie dostępu…
              </span>
            )}
          </div>
        </div>

        {/* Announcement pills row — only when active announcements exist, and not suppressed for homepage */}
        {!hideAnnouncementBar && activeAnnouncements.length > 0 && (
          <div className="border-t border-[#e2e8f0] bg-[#e2e8f0] px-4 py-2 dark:border-[#1e293b] dark:bg-[#090f1a]">
            <div className="mx-auto flex max-w-400 flex-wrap items-center gap-2 px-0 sm:px-1 lg:px-6">
              <Megaphone size={13} className="shrink-0 text-[#64748b] dark:text-[#475569]" />
              {activeAnnouncements.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setModalInitialId(a.id)}
                  className={`flex items-center gap-1.5 truncate rounded-full border px-3 py-1 text-xs font-medium transition ${PILL_COLOR[a.color]}`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {modalInitialId && (
        <AnnouncementModal
          announcements={activeAnnouncements}
          initialId={modalInitialId}
          onClose={() => setModalInitialId(null)}
        />
      )}
    </>
  );
}

function SearchIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  );
}
