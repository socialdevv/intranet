import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, BriefcaseBusiness, Link2 } from "lucide-react";
import AnnouncementModal from "@/components/layout/announcement-modal";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";
import { adaptPlatformAnnouncement } from "@/lib/api/platform-announcements";
import { adaptPlatformLink } from "@/lib/api/platform-links";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { resolveProjectDirectory } from "@/lib/access/project-access";
import {
  globalAdminAnnouncementsPath,
  globalAdminLinksPath,
  ROUTES,
} from "@/lib/routes";
import { resolveIcon } from "@/lib/utils/link-icons";
import type { LinkItem } from "@/lib/types/domain";

const ANNOUNCEMENT_COLOR_BADGE = {
  red: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626] dark:border-[#7f1d1d]/40 dark:bg-[#1a0808] dark:text-[#f87171]",
  orange:
    "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c] dark:border-[#7c2d12]/40 dark:bg-[#1a0a00] dark:text-[#fb923c]",
  green:
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340] dark:text-[#60a5fa]",
} as const;

const ANNOUNCEMENT_COLOR_LABEL = {
  red: "Czerwony",
  orange: "Pomarańczowy",
  green: "Zielony",
  blue: "Niebieski",
} as const;

export default function GlobalHomePage() {
  const { user } = useAuth();
  const platformBootstrap = usePlatformBootstrapPreview();
  const [openAnnouncementId, setOpenAnnouncementId] = useState<string | null>(null);

  const homepage = platformBootstrap.status === "ready" ? platformBootstrap.preview.homepage : null;
  const directory = resolveProjectDirectory(
    platformBootstrap.status === "ready" ? platformBootstrap.preview : null
  );
  const globalAnnouncements = homepage?.globalAnnouncements.map(adaptPlatformAnnouncement) ?? [];
  const globalQuickLinks = homepage?.globalQuickLinks.map(adaptPlatformLink) ?? [];
  const featuredProjects = directory.accessibleProjects.slice(0, 3);
  const canOpenAdmin = user ? canAccessAdminPanel(user) : false;

  return (
    <AppShell currentUser={user} navigationMode="global" searchPlaceholder="Szukaj w intranecie…">
      <section className="mx-auto w-full max-w-7xl space-y-6 pb-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-[#0f172a] dark:text-[#f8fafc] sm:text-4xl">
            Intranet
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-[#475569] dark:text-[#cbd5e1] sm:text-[15px]">
            Globalne ogłoszenia, linki i projekty dostępne dla bieżącego użytkownika.
          </p>
        </header>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
                <Bell size={13} className="text-[#1d4f91] dark:text-[#93c5fd]" />
                Ogłoszenia globalne
              </div>
              {globalAnnouncements.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                  Brak aktualnie opublikowanych ogłoszeń globalnych.
                  {canOpenAdmin ? (
                    <>
                      {" "}
                      <Link to={globalAdminAnnouncementsPath()} className="font-semibold text-[#1d4f91] hover:underline dark:text-[#93c5fd]">
                        Dodaj je w administracji globalnej.
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {globalAnnouncements.map((announcement) => (
                    <button
                      type="button"
                      key={announcement.id}
                      onClick={() => setOpenAnnouncementId(announcement.id)}
                      className="w-full rounded-2xl border border-[#dbe5f0] bg-[#f8fbfe] px-4 py-4 text-left transition hover:border-[#bfd3ea] hover:bg-white dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                          {announcement.title}
                        </h2>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${ANNOUNCEMENT_COLOR_BADGE[announcement.color]}`}>
                          {ANNOUNCEMENT_COLOR_LABEL[announcement.color]}
                        </span>
                      </div>
                      {announcement.description && (
                        <p className="mt-1 text-sm text-[#64748b] dark:text-[#cbd5e1]">
                          {announcement.description}
                        </p>
                      )}
                      <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#1d4f91] dark:text-[#93c5fd]">
                        Otwórz pełną treść
                        <ArrowRight size={13} />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
                <Link2 size={13} className="text-[#0f766e] dark:text-[#5eead4]" />
                Linki globalne
              </div>
              {globalQuickLinks.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                  Brak opublikowanych linków globalnych.
                  {canOpenAdmin ? (
                    <>
                      {" "}
                      <Link to={globalAdminLinksPath()} className="font-semibold text-[#1d4f91] hover:underline dark:text-[#93c5fd]">
                        Dodaj je w administracji globalnej.
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {globalQuickLinks.map((link) => (
                    <GlobalQuickLinkCard key={link.id} link={link} />
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <BriefcaseBusiness size={13} className="text-[#375a7f] dark:text-[#93c5fd]" />
              Twoje projekty
            </div>
            <p className="mt-3 max-w-2xl text-sm text-[#64748b] dark:text-[#cbd5e1]">
              Projekty dostępne w aktualnym modelu uprawnień.
            </p>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-3 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
              <span>Dostępne projekty</span>
              <span className="rounded-full border border-[#dbe4f0] bg-white px-2 py-0.5 text-xs font-semibold text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#93c5fd]">
                {directory.accessibleCount}
              </span>
            </div>

            {platformBootstrap.status === "loading" && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Ładowanie katalogu projektów…
              </p>
            )}

            {platformBootstrap.status === "failed" && (
              <p className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-4 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
                {platformBootstrap.error}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {featuredProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/p/${encodeURIComponent(project.slug)}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-[#f8fbfe] px-4 py-3 transition hover:border-[#c3d6ea] hover:bg-white dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {project.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#64748b] dark:text-[#cbd5e1]">
                      {project.code} • {project.effectiveProjectRole ?? "dostęp podstawowy"}
                    </p>
                  </div>
                  <ArrowRight size={15} className="shrink-0 text-[#94a3b8]" />
                </Link>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Link
                to={ROUTES.projects}
                className="text-[11px] font-semibold text-[#1d4f91] transition hover:underline dark:text-[#93c5fd]"
              >
                Otwórz katalog projektów
              </Link>
              {canOpenAdmin ? (
                <Link
                  to={ROUTES.admin}
                  className="text-[11px] font-semibold text-[#1d4f91] transition hover:underline dark:text-[#93c5fd]"
                >
                  Administracja
                </Link>
              ) : null}
            </div>

            {platformBootstrap.status === "ready" && directory.accessibleCount === 0 && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Brak projektów dostępnych dla bieżącego użytkownika.
              </p>
            )}
          </section>
        </div>

        {openAnnouncementId && globalAnnouncements.length > 0 && (
          <AnnouncementModal
            announcements={globalAnnouncements}
            initialId={openAnnouncementId}
            onClose={() => setOpenAnnouncementId(null)}
          />
        )}
      </section>
    </AppShell>
  );
}

function GlobalQuickLinkCard({ link }: { link: LinkItem }) {
  const content = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#dbe5ee] bg-white text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#93c5fd]">
        {resolveIcon(link.icon)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
          {link.title}
        </span>
        {link.description ? (
          <span className="mt-1 block text-sm text-[#64748b] dark:text-[#cbd5e1]">
            {link.description}
          </span>
        ) : null}
      </span>
      <ArrowRight size={14} className="shrink-0 text-[#94a3b8]" />
    </>
  );

  if (link.isInternal) {
    return (
      <Link
        to={link.url}
        className="flex items-center gap-3 rounded-2xl border border-[#dbe5f0] bg-[#f8fbfe] px-4 py-3 transition hover:border-[#bfd3ea] hover:bg-white dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846]"
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={link.url}
      target={link.openInNewTab ? "_blank" : undefined}
      rel={link.openInNewTab ? "noopener noreferrer" : undefined}
      className="flex items-center gap-3 rounded-2xl border border-[#dbe5f0] bg-[#f8fbfe] px-4 py-3 transition hover:border-[#bfd3ea] hover:bg-white dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846]"
    >
      {content}
    </a>
  );
}
