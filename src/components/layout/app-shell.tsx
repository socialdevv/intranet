import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { ChevronUp } from "lucide-react";
import GlobalSidebar from "@/components/layout/global-sidebar";
import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import PageViewTransition from "@/components/layout/page-view-transition";
import GlobalSearchModal from "@/components/global-search-modal";
import LeadWidget from "@/components/lead-widget";
import { useData } from "@/contexts/data-context";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import { useTemporaryShellBootstrapCutover } from "@/hooks/useTemporaryShellBootstrapCutover";
import { isAnnouncementVisibleNow } from "@/lib/announcements/visibility";
import { scrollSectionAnchorIntoView } from "@/lib/knowledge/section-anchors";
import type { AppUser } from "@/lib/types/domain";

type TocItem = {
  label: string;
  href: string;
  active?: boolean;
};

type AppShellProps = {
  children: ReactNode;
  currentUser: AppUser | null;
  tocItems?: TocItem[];
  searchPlaceholder?: string;
  navigationMode?: "project" | "platform" | "global";
  /** Extra content rendered at the top of the sticky right panel (e.g. article matrix links). */
  rightPanelExtra?: ReactNode;
};

export default function AppShell({
  children,
  currentUser,
  tocItems,
  searchPlaceholder,
  navigationMode = "project",
  rightPanelExtra,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const { pathname } = useLocation();
  const shellCutover = useTemporaryShellBootstrapCutover(pathname);
  const isHome = pathname === "/";
  const showProjectNavigation = navigationMode === "project";
  const showGlobalNavigation = navigationMode === "global";
  const { announcements, enabledModules, moduleSettings } = useData();
  const now = useCurrentTime();
  const hasAnnouncementBar =
    showProjectNavigation &&
    !isHome &&
    enabledModules.announcements &&
    moduleSettings.announcements.surfaces.showTopbarPills &&
    announcements.some((a) => isAnnouncementVisibleNow(a, now));
  // 3.5rem = main topbar; 41px = announcement pill strip (py-2 + pill + border)
  const topbarH = hasAnnouncementBar ? "calc(3.5rem + 41px)" : "3.5rem";
  const hasToc = Boolean(tocItems?.length);
  const showRightPanel = hasToc || Boolean(rightPanelExtra);

  useEffect(() => {
    function onScroll() {
      setShowBackToTop(window.scrollY > 320);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Ctrl+K opens global search, but NOT when the user is inside
  // an input, textarea, or contenteditable (e.g. the rich text editor).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key.toLowerCase() !== "k") return;
      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      e.preventDefault();
      setSearchOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div
      className="min-h-screen bg-[#f8f9fb] text-[#111827] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
      style={{ "--topbar-h": topbarH } as React.CSSProperties}
    >
      <Topbar
        onToggleMobile={() => setMobileNavOpen((open) => !open)}
        currentUser={currentUser}
        searchPlaceholder={searchPlaceholder}
        onOpenSearch={() => setSearchOpen(true)}
        hideAnnouncementBar={!showProjectNavigation || isHome}
        shellCutover={shellCutover}
        navigationMode={navigationMode}
      />
      {searchOpen && <GlobalSearchModal onClose={() => setSearchOpen(false)} />}

      <div className="flex min-h-[calc(100vh-3.5rem)] w-full flex-col lg:flex-row">
        {showProjectNavigation && (
          <Sidebar
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
            shellCutover={shellCutover}
          />
        )}
        {showGlobalNavigation && (
          <GlobalSidebar
            mobileOpen={mobileNavOpen}
            onCloseMobile={() => setMobileNavOpen(false)}
            currentUser={currentUser}
          />
        )}

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 lg:px-10 lg:py-8">
          <PageViewTransition>{children}</PageViewTransition>
        </main>

        {showRightPanel && (
          <aside className="hidden w-72 shrink-0 basis-72 border-l border-[#e5e7eb] bg-[#f8f9fb] px-5 py-5 xl:sticky xl:top-(--topbar-h,3.5rem) xl:block xl:h-[calc(100vh-var(--topbar-h,3.5rem))] xl:overflow-y-auto dark:border-[#1e293b] dark:bg-[#0f172a]">
            {rightPanelExtra && (
              <div className={hasToc ? "mb-5" : ""}>
                {rightPanelExtra}
              </div>
            )}
            {hasToc && (
              <>
                {rightPanelExtra && (
                  <div className="mb-4 border-t border-[#e5e7eb]" />
                )}
                <div className="mb-2 px-1">
                  <h3 className="min-w-0 text-xs font-semibold tracking-wide text-[#6b7280]">
                    NA TEJ STRONIE
                  </h3>
                </div>
                <nav className="space-y-2">
                  {tocItems?.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        const id = item.href.startsWith("#") ? item.href.slice(1) : item.href;
                        scrollSectionAnchorIntoView(id, { behavior: "smooth" });
                      }}
                      className={`block w-full min-w-0 border-l-2 pl-2 text-left text-sm font-medium wrap-break-word ${
                        item.active
                          ? "border-[#111827] text-[#111827]"
                          : "border-transparent text-[#6b7280] hover:text-[#374151]"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </nav>
              </>
            )}
          </aside>
        )}
      </div>

      {/* Lead qualification widget — sits above the scroll-to-top button */}
    {showProjectNavigation && enabledModules.lead && moduleSettings.lead.widget.enabledInShell && <LeadWidget />}

      {/* Back to top */}
      <button
        type="button"
        aria-label="Wróć na górę"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-[#dde5ee] bg-white shadow-lg transition-all duration-200 hover:bg-[#f4f8fc] hover:border-[#1d4f91] hover:text-[#1d4f91] text-[#6b7280] dark:border-[#1e3a5f] dark:bg-[#0f1e33] dark:text-[#94a3b8] dark:hover:bg-[#0f2340] dark:hover:text-[#60a5fa] ${
          showBackToTop ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <ChevronUp size={18} />
      </button>
    </div>
  );
}
