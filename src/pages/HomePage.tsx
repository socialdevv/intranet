import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/layout/app-shell";
import AnnouncementModal from "@/components/layout/announcement-modal";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { canEditContent } from "@/lib/auth/authorization";
import {
  buildResolvedHomeSpotlights,
  buildSortedHomeQuickLinks,
  buildVisibleQuickAccessItems,
  resolveHomepageLayoutFlags,
  resolveQuickAccessGridClass,
  type QuickAccessModuleKey,
} from "@/lib/project/project-home-sections";
import { ROUTES, komunikatPath } from "@/lib/routes";
import { resolveIcon } from "@/lib/utils/link-icons";
import { isAnnouncementVisibleNow } from "@/lib/announcements/visibility";
import { BookOpen, Flame, Zap, Settings, Bell, ChevronLeft, ChevronRight, Megaphone } from "lucide-react";
import type { AnnouncementColor, CommunicationMessage } from "@/lib/types/domain";

const COMM_PAGE_SIZE = 10;

function resolveCommunicationSortDate(communication: CommunicationMessage): string {
  return communication.communicationDate ?? communication.updatedAt;
}

function resolveCommunicationDisplayDate(communication: CommunicationMessage): string {
  return communication.communicationDate ?? communication.updatedAt.slice(0, 10);
}

const PILL_COLOR: Record<AnnouncementColor, string> = {
  red: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626] hover:border-[#dc2626] hover:bg-[#fee2e2] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#f87171] dark:hover:border-[#f87171]",
  orange: "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c] hover:border-[#ea580c] dark:border-[#7c2d12]/50 dark:bg-[#1a0a00] dark:text-[#fb923c]",
  green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] hover:border-[#16a34a] dark:border-[#14532d]/50 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] hover:border-[#2563eb] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340] dark:text-[#60a5fa]",
};

export default function HomePage() {
  const { user } = useAuth();
  const { resolveHref } = useProjectRouting();
  const {
    homeSpotlights,
    homeQuickLinks,
    pages,
    communications,
    announcements,
    enabledModules,
    moduleSettings,
    navOrder,
  } = useData();
  const now = useCurrentTime();
  const [commPage, setCommPage] = useState(0);
  const [announcementModalId, setAnnouncementModalId] = useState<string | null>(null);

  const homepageLayout = useMemo(
    () => resolveHomepageLayoutFlags(enabledModules, moduleSettings),
    [enabledModules, moduleSettings]
  );

  const visibleQuickAccess = useMemo(
    () => buildVisibleQuickAccessItems(enabledModules, moduleSettings, navOrder),
    [enabledModules, moduleSettings, navOrder]
  );

  const spotlightItems = useMemo(
    () =>
      buildResolvedHomeSpotlights(homeSpotlights, pages, {
        enabled: homepageLayout.showSpotlights,
        resolveProjectHref: resolveHref,
      }),
    [homeSpotlights, homepageLayout.showSpotlights, pages, resolveHref]
  );

  const quickLinkItems = useMemo(
    () => buildSortedHomeQuickLinks(homeQuickLinks, homepageLayout.showQuickLinks),
    [homeQuickLinks, homepageLayout.showQuickLinks]
  );

  const activeAnnouncements = useMemo(
    () =>
      enabledModules.announcements && moduleSettings.announcements.surfaces.showHomePills
        ? announcements.filter((a) => isAnnouncementVisibleNow(a, now))
        : [],
    [announcements, enabledModules.announcements, moduleSettings.announcements.surfaces.showHomePills, now]
  );

  const isAdmin = canEditContent(user);

  useEffect(() => {
    if (!announcementModalId) return;
    if (activeAnnouncements.some((announcement) => announcement.id === announcementModalId)) return;
    setAnnouncementModalId(null);
  }, [activeAnnouncements, announcementModalId]);

  const sortedComms = useMemo(() => {
    if (!enabledModules.komunikaty) return [];
    return [...communications]
      .filter((c) => c.status !== "archived")
      .sort((a, b) => {
        const da = resolveCommunicationSortDate(a);
        const db = resolveCommunicationSortDate(b);
        return db.localeCompare(da);
      });
  }, [communications, enabledModules.komunikaty]);

  const commTotalPages = Math.ceil(sortedComms.length / COMM_PAGE_SIZE);
  const commSlice = sortedComms.slice(commPage * COMM_PAGE_SIZE, (commPage + 1) * COMM_PAGE_SIZE);

  const showQuickAccessSection = visibleQuickAccess.length > 0;
  const showSpotlightsSection = spotlightItems.length > 0;
  const showQuickLinksSection = quickLinkItems.length > 0;
  const showCommunicationsSection = sortedComms.length > 0;
  const showLeftColumn = showSpotlightsSection || showQuickLinksSection;
  const showOperationalGrid = showLeftColumn || showCommunicationsSection;

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w całej bazie wiedzy…">
      <section className="mx-auto w-full max-w-7xl pb-8">
        {activeAnnouncements.length > 0 && (
          <div className="mb-6 rounded-xl border border-[#d1dce8] bg-[#e2e8f0] px-4 py-3 dark:border-[#1e293b] dark:bg-[#090f1a]">
            <div className="flex flex-wrap items-center gap-2">
              <Megaphone size={13} className="shrink-0 text-[#64748b] dark:text-[#475569]" />
              {activeAnnouncements.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAnnouncementModalId(a.id)}
                  className={`flex items-center gap-1.5 truncate rounded-full border px-3 py-1 text-xs font-medium transition ${PILL_COLOR[a.color]}`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {showQuickAccessSection && (
          <div className="w-full">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
              Szybki dostęp
            </h2>
            <div
              className={`mt-3 ${resolveQuickAccessGridClass(visibleQuickAccess.length)}`}
            >
              {visibleQuickAccess.map((item) => (
                <Link
                  key={item.moduleKey}
                  to={resolveHref(item.href)}
                  className="group min-w-0 rounded-2xl border border-[#dde5ee] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_20px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cfd9e4] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] dark:border-[#334155] dark:bg-[#1e293b] dark:hover:border-[#475569]"
                >
                  <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf3fa] text-[#375a7f] transition group-hover:bg-[#e5eef9] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
                    {resolveQuickAccessIcon(item.moduleKey)}
                  </div>
                  <h3 className="text-sm font-semibold text-[#111827] dark:text-[#f1f5f9]">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-[#6b7280] dark:text-[#94a3b8]">{item.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {showOperationalGrid && (
          <div
            className={[
              "grid grid-cols-1 gap-6",
              showLeftColumn && showCommunicationsSection ? "lg:grid-cols-2" : "",
              showQuickAccessSection ? "mt-8" : "",
            ].join(" ")}
          >
            {showLeftColumn && (
              <div className="flex flex-col gap-8">
                {showSpotlightsSection && (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                        <Flame size={13} className="text-[#f97316]" />
                        Ważne tematy
                      </h2>
                      {isAdmin && (
                        <Link
                          to={resolveHref(`${ROUTES.admin}?tab=startowa`)}
                          className="flex items-center gap-1 text-[10px] text-[#94a3b8] transition hover:text-[#64748b] dark:hover:text-[#cbd5e1]"
                        >
                          <Settings size={11} />
                          Zarządzaj
                        </Link>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {spotlightItems.map((spotlight) => (
                        <Link
                          key={spotlight.id}
                          to={spotlight.href}
                          className="group flex items-start gap-2.5 rounded-xl border border-[#dde5ee] bg-white px-3 py-2.5 transition hover:border-[#c3d6ea] hover:bg-[#f8fafd] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2563eb]/40 dark:hover:bg-[#0f2340]"
                        >
                          <BookOpen
                            size={14}
                            className="mt-0.5 shrink-0 text-[#1d4f91]/50 transition group-hover:text-[#1d4f91] dark:text-[#60a5fa]/50 dark:group-hover:text-[#60a5fa]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                              {spotlight.label}
                            </p>
                            {spotlight.categoryDisplayName ? (
                              <p className="truncate text-xs text-[#9ca3af]">
                                {spotlight.categoryDisplayName}
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {showQuickLinksSection && (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                        <Zap size={13} className="text-[#1d4f91]" />
                        Szybkie linki
                      </h2>
                      {isAdmin && (
                        <Link
                          to={resolveHref(`${ROUTES.admin}?tab=startowa`)}
                          className="flex items-center gap-1 text-[10px] text-[#94a3b8] transition hover:text-[#64748b] dark:hover:text-[#cbd5e1]"
                        >
                          <Settings size={11} />
                          Zarządzaj
                        </Link>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quickLinkItems.map((link) => {
                        const commonClass =
                          "group inline-flex items-center gap-2 rounded-xl border border-[#dde5ee] bg-white px-3 py-2 text-sm font-medium text-[#374151] shadow-[0_1px_0_rgba(15,23,42,0.03)] transition hover:border-[#c3d6ea] hover:bg-[#f8fafd] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#cbd5e1] dark:hover:border-[#2563eb]/40 dark:hover:bg-[#0f2340]";
                        const iconEl = (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf3fa] text-[#375a7f] transition group-hover:bg-[#e5eef9] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
                            {resolveIcon(link.icon)}
                          </span>
                        );
                        if (link.isInternal) {
                          return (
                            <Link key={link.id} to={resolveHref(link.url)} className={commonClass}>
                              {iconEl}
                              {link.label}
                            </Link>
                          );
                        }
                        return (
                          <a
                            key={link.id}
                            href={link.url}
                            target={link.openInNewTab !== false ? "_blank" : undefined}
                            rel="noopener noreferrer"
                            className={commonClass}
                          >
                            {iconEl}
                            {link.label}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {showCommunicationsSection && (
              <div className={showLeftColumn ? "" : "lg:col-span-1"}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#94a3b8]">
                    <Bell size={13} className="text-[#1d4f91]" />
                    Ostatnie komunikaty
                  </h2>
                  <Link
                    to={resolveHref(ROUTES.komunikaty)}
                    className="text-[10px] text-[#94a3b8] transition hover:text-[#64748b] dark:hover:text-[#cbd5e1]"
                  >
                    Wszystkie →
                  </Link>
                </div>
                <div className="mt-3 flex flex-col gap-1.5">
                  {commSlice.map((comm) => {
                    const dateStr = resolveCommunicationDisplayDate(comm);
                    return (
                      <Link
                        key={comm.id}
                        to={resolveHref(komunikatPath(comm.id))}
                        className="group flex items-center gap-2.5 rounded-xl border border-[#dde5ee] bg-white px-3 py-2.5 transition hover:border-[#c3d6ea] hover:bg-[#f8fafd] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2563eb]/40 dark:hover:bg-[#0f2340]"
                      >
                        <span className="shrink-0 font-mono text-[11px] text-[#94a3b8] dark:text-[#475569]">
                          {dateStr}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#0f172a] transition group-hover:text-[#1d4f91] dark:text-[#f1f5f9] dark:group-hover:text-[#60a5fa]">
                          {comm.title}
                        </p>
                      </Link>
                    );
                  })}
                </div>
                {commTotalPages > 1 && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#94a3b8]">
                      {commPage + 1} / {commTotalPages}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={commPage === 0}
                        onClick={() => setCommPage((p) => p - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dde5ee] bg-white text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]"
                        aria-label="Poprzednia strona"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={commPage >= commTotalPages - 1}
                        onClick={() => setCommPage((p) => p + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dde5ee] bg-white text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]"
                        aria-label="Następna strona"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {announcementModalId && (
        <AnnouncementModal
          announcements={activeAnnouncements}
          initialId={announcementModalId}
          onClose={() => setAnnouncementModalId(null)}
        />
      )}
    </AppShell>
  );
}

function resolveQuickAccessIcon(moduleKey: QuickAccessModuleKey) {
  switch (moduleKey) {
    case "matrix":
      return <TableIcon />;
    case "szablony":
      return <TemplateIcon />;
    case "cenniki":
      return <PriceListIcon />;
    case "komunikaty":
      return <CommunicationIcon />;
    case "tematOrg":
      return <OrgTopicsIcon />;
    case "kontakty":
      return <ContactIcon />;
    case "zwroty":
      return <PhrasesIcon />;
    case "linki":
      return <LinkIcon />;
    case "formularze":
      return <FormIcon />;
    default:
      return <TableIcon />;
  }
}

function TableIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18M15 3v18" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h6" />
    </svg>
  );
}

function PriceListIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7h16M4 12h10M4 17h14" />
      <circle cx="18" cy="7" r="2" />
    </svg>
  );
}

function ContactIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.9-.9a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.02z" />
    </svg>
  );
}

function PhrasesIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h8M8 13h5" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function CommunicationIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function OrgTopicsIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FormIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}
