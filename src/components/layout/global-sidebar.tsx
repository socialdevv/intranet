import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Bell, BriefcaseBusiness, ChevronDown, FolderPlus, History, Home, Link2, Shield } from "lucide-react";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import {
  canCreateProjects,
  resolveProjectDirectory,
} from "@/lib/access/project-access";
import {
  globalAdminAnnouncementsPath,
  globalAdminAuditPath,
  globalAdminLinksPath,
  globalAdminProjectCreatePath,
  ROUTES,
} from "@/lib/routes";
import type { AppUser } from "@/lib/types/domain";

type GlobalSidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: AppUser | null;
};

export default function GlobalSidebar({
  mobileOpen,
  onCloseMobile,
  currentUser,
}: GlobalSidebarProps) {
  const { pathname } = useLocation();
  const platformBootstrap = usePlatformBootstrapPreview();
  const [adminExpanded, setAdminExpanded] = useState(() => pathname.startsWith(ROUTES.admin));

  useEffect(() => {
    if (pathname.startsWith(ROUTES.admin)) {
      setAdminExpanded(true);
    }
  }, [pathname]);

  const directory = useMemo(
    () =>
      resolveProjectDirectory(
        platformBootstrap.status === "ready" ? platformBootstrap.preview : null
      ),
    [platformBootstrap]
  );
  const canOpenAdmin = currentUser ? canAccessAdminPanel(currentUser) : false;
  const showProjectCreationEntry =
    platformBootstrap.status === "ready" && canCreateProjects(platformBootstrap.preview.currentUser.globalRole);
  const showPlatformAuditEntry =
    platformBootstrap.status === "ready" &&
    platformBootstrap.preview.platformCapabilities.canViewPlatformAudit;

  const navContent = (
    <div className="w-full px-3">
      <nav className="space-y-3.5">
        <div className="space-y-1.5">
          <SidebarLink
            href={ROUTES.home}
            label="Strona główna"
            icon={<Home size={16} />}
            active={pathname === ROUTES.home}
            onClick={onCloseMobile}
          />
          <SidebarLink
            href={ROUTES.projects}
            label="Projekty"
            icon={<BriefcaseBusiness size={16} />}
            active={pathname === ROUTES.projects}
            badge={directory.accessibleCount > 0 ? String(directory.accessibleCount) : undefined}
            onClick={onCloseMobile}
          />
        </div>

        <div className="rounded-2xl border border-[#e2e8f0] bg-[#f3f6fa]/88 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-[#223147] dark:bg-[#0b1220]/60 dark:shadow-none">
          <button
            type="button"
            onClick={() => {
              if (!canOpenAdmin) {
                return;
              }

              setAdminExpanded((current) => !current);
            }}
            className={`flex h-11 w-full items-center justify-between gap-3 rounded-[1rem] border px-3 text-left text-sm font-medium transition ${
              pathname.startsWith(ROUTES.admin)
                ? "border-[#d7e0ea] bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-[#2b3a54] dark:bg-[#122033] dark:text-[#f1f5f9] dark:shadow-none"
                : canOpenAdmin
                  ? "border-transparent text-[#4b5563] hover:border-[#d7e0ea] hover:bg-white/90 hover:text-[#111827] dark:text-[#94a3b8] dark:hover:border-[#2b3a54] dark:hover:bg-[#152338] dark:hover:text-[#f1f5f9]"
                  : "text-[#9ca3af] dark:text-[#64748b]"
            }`}
            aria-expanded={canOpenAdmin ? adminExpanded : undefined}
            aria-disabled={!canOpenAdmin}
          >
            <span className="flex items-center gap-3">
              <span className="text-[#6b7280]">
                <Shield size={16} />
              </span>
              <span>Administracja</span>
            </span>
            {canOpenAdmin ? (
              <ChevronDown
                size={16}
                className={`transition-transform ${adminExpanded ? "rotate-180" : ""}`}
              />
            ) : (
              <span className="rounded-full border border-[#e5e7eb] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af] dark:border-[#334155] dark:text-[#64748b]">
                brak
              </span>
            )}
          </button>

          {canOpenAdmin && adminExpanded && (
            <div className="mt-1.5 space-y-1 border-t border-[#d7e3ef] px-1 pt-1.5 dark:border-[#223147]">
              <SidebarSubLink
                href={globalAdminAnnouncementsPath()}
                label="Ogłoszenia globalne"
                active={pathname === globalAdminAnnouncementsPath()}
                icon={<Bell size={14} />}
                onClick={onCloseMobile}
              />
              <SidebarSubLink
                href={globalAdminLinksPath()}
                label="Linki globalne"
                active={pathname === globalAdminLinksPath()}
                icon={<Link2 size={14} />}
                onClick={onCloseMobile}
              />
              {showPlatformAuditEntry && (
                <SidebarSubLink
                  href={globalAdminAuditPath()}
                  label="Historia zmian"
                  active={pathname === globalAdminAuditPath()}
                  icon={<History size={14} />}
                  onClick={onCloseMobile}
                />
              )}
              {showProjectCreationEntry && (
                <SidebarSubLink
                  href={globalAdminProjectCreatePath()}
                  label="Utwórz projekt"
                  active={pathname === globalAdminProjectCreatePath()}
                  icon={<FolderPlus size={14} />}
                  onClick={onCloseMobile}
                />
              )}
            </div>
          )}
        </div>
      </nav>
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
        className={`fixed left-0 top-(--topbar-h,3.5rem) z-40 h-[calc(100vh-var(--topbar-h,3.5rem))] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto border-r border-[#e5e7eb] bg-[#f8fafb]/95 py-5 transition-all duration-200 lg:hidden dark:border-[#334155] dark:bg-[#0f172a]/95 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      <aside className="hidden h-[calc(100vh-var(--topbar-h,3.5rem))] w-88 shrink-0 basis-88 overflow-y-auto border-r border-[#e5e7eb] bg-[#f8fafb]/95 py-5 lg:sticky lg:top-(--topbar-h,3.5rem) lg:block dark:border-[#334155] dark:bg-[#0f172a]/95">
        {navContent}
      </aside>
    </>
  );
}

function SidebarLink({
  href,
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Link to={href} onClick={onClick}>
      <span
        className={`flex h-11 items-center justify-between gap-3 rounded-[1rem] border px-3.5 text-sm font-medium transition ${
          active
            ? "border-[#d7e0ea] bg-white text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.05)] dark:border-[#2b3a54] dark:bg-[#122033] dark:text-[#f1f5f9] dark:shadow-none"
            : "border-transparent text-[#4b5563] hover:border-[#e2e8f0] hover:bg-white/90 hover:text-[#111827] dark:text-[#94a3b8] dark:hover:border-[#223147] dark:hover:bg-[#152338] dark:hover:text-[#f1f5f9]"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className="text-[#6b7280]">{icon}</span>
          <span>{label}</span>
        </span>
        {badge && (
          <span className="rounded-full border border-[#dbe4f0] bg-white px-2 py-0.5 text-xs font-semibold text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#93c5fd]">
            {badge}
          </span>
        )}
      </span>
    </Link>
  );
}

function SidebarSubLink({
  href,
  label,
  active,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Link to={href} onClick={onClick}>
      <span
        className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition ${
          active
            ? "border-[#1d4f91] bg-[#1d4f91] text-white"
            : "border-transparent text-[#5f6f86] hover:border-[#d7e0ea] hover:bg-white hover:text-[#21324a] dark:text-[#9fb3cc] dark:hover:border-[#223147] dark:hover:bg-[#152338] dark:hover:text-[#f1f5f9]"
        }`}
      >
        {icon ? <span>{icon}</span> : <span className="ml-1 h-1.5 w-1.5 rounded-full bg-current/60" />}
        <span>{label}</span>
      </span>
    </Link>
  );
}