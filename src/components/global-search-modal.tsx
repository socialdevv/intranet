import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { BookOpen, FolderOpen, GitBranch, Search, ArrowRight, FileText, Bell, Link2, Phone, MessageSquare, Receipt, Users } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { searchAll } from "@/lib/search/search";
import type { SearchResultItem } from "@/lib/search/search";
import { ROUTES } from "@/lib/routes";

// ── Config per result type ────────────────────────────────────────────────────

// Priority order: Articles first, Matrix second, then remaining modules
const GROUP_ORDER: Array<SearchResultItem["type"]> = [
  "article",
  "matrix",
  "category",
  "template",
  "communication",
  "org_topic",
  "cennik",
  "link",
  "quick_link",
  "contact",
  "phrase",
];

const GROUP_LABELS: Record<SearchResultItem["type"], string> = {
  article:       "Artykuły",
  category:      "Kategorie",
  matrix:        "Macierz",
  template:      "Szablony",
  communication: "Komunikaty",
  org_topic:     "Tematy organizacyjne",
  cennik:        "Cenniki",
  link:          "Linki",
  quick_link:    "Szybkie linki",
  contact:       "Dane kontaktowe",
  phrase:        "Gotowe zwroty",
};

// Max results shown per group
const GROUP_CAPS: Record<SearchResultItem["type"], number> = {
  article:       5,
  category:      3,
  matrix:        4,
  template:      4,
  communication: 3,
  org_topic:     3,
  cennik:        4,
  link:          4,
  quick_link:    8,
  contact:       3,
  phrase:        3,
};

type IconComponent = React.FC<{ size: number; className?: string }>;

const TYPE_ICON: Record<SearchResultItem["type"], IconComponent> = {
  article:       BookOpen as IconComponent,
  category:      FolderOpen as IconComponent,
  matrix:        GitBranch as IconComponent,
  template:      FileText as IconComponent,
  communication: Bell as IconComponent,
  org_topic:     Users as IconComponent,
  cennik:        Receipt as IconComponent,
  link:          Link2 as IconComponent,
  quick_link:    Link2 as IconComponent,
  contact:       Phone as IconComponent,
  phrase:        MessageSquare as IconComponent,
};

const TYPE_BADGE: Record<SearchResultItem["type"], { bg: string; icon: string }> = {
  article:       { bg: "bg-[#e9f2ff]",  icon: "text-[#1d4f91]" },
  category:      { bg: "bg-[#dcfce7]",  icon: "text-[#166534]" },
  matrix:        { bg: "bg-[#ede9fe]",  icon: "text-[#6d28d9]" },
  template:      { bg: "bg-[#fff7ed]",  icon: "text-[#c2410c]" },
  communication: { bg: "bg-[#fef9c3]",  icon: "text-[#854d0e]" },
  org_topic:     { bg: "bg-[#e0e7ff]",  icon: "text-[#3730a3]" },
  cennik:        { bg: "bg-[#f0fdf4]",  icon: "text-[#166534]" },
  link:          { bg: "bg-[#ecfdf5]",  icon: "text-[#15803d]" },
  quick_link:    { bg: "bg-[#f0fdfa]",  icon: "text-[#0f766e]" },
  contact:       { bg: "bg-[#fdf2f8]",  icon: "text-[#9d174d]" },
  phrase:        { bg: "bg-[#f0f9ff]",  icon: "text-[#0369a1]" },
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export default function GlobalSearchModal({ onClose }: Props) {
  const { pages, categories, matrix, templates, communications, links, contacts, phrases, cenniki, orgEntries, homeQuickLinks, enabledModules } = useData();
  const navigate = useNavigate();
  const { resolveHref } = useProjectRouting();

  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Search results ────────────────────────────────────────────────────────

  const results = useMemo(
    () =>
      searchAll(
        query,
        pages,
        categories,
        enabledModules.matrix ? matrix : [],
        enabledModules.szablony ? templates : [],
        enabledModules.komunikaty ? communications : [],
        enabledModules.linki ? links : [],
        enabledModules.kontakty ? contacts : [],
        enabledModules.zwroty ? phrases : [],
        enabledModules.cenniki ? cenniki.documents : [],
        enabledModules.tematOrg ? orgEntries : [],
        enabledModules.homeSections ? homeQuickLinks : []
      ),
    [
      query,
      pages,
      categories,
      matrix,
      templates,
      communications,
      links,
      contacts,
      phrases,
      cenniki,
      orgEntries,
      homeQuickLinks,
      enabledModules,
    ],
  );

  /** Flat list in display order: articles → categories → matrix, each capped. */
  const flatList = useMemo((): SearchResultItem[] => {
    const out: SearchResultItem[] = [];
    for (const type of GROUP_ORDER) {
      const items = results.filter((r) => r.type === type).slice(0, GROUP_CAPS[type]);
      out.push(...items);
    }
    return out;
  }, [results]);

  /** Starting index in flatList for each group type. */
  const groupOffsets = useMemo(() => {
    const offsets: Partial<Record<SearchResultItem["type"], number>> = {};
    let cursor = 0;
    for (const type of GROUP_ORDER) {
      offsets[type] = cursor;
      cursor += results.filter((r) => r.type === type).slice(0, GROUP_CAPS[type]).length;
    }
    return offsets;
  }, [results]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIdx(flatList.length > 0 ? 0 : -1);
  }, [flatList]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (activeIdx < 0) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const goToItem = useCallback(
    (item: SearchResultItem) => {
      const resolvedHref = resolveHref(item.href);
      if (item.openInNewTab) {
        window.open(resolvedHref, "_blank", "noopener,noreferrer");
      } else {
        navigate(resolvedHref);
      }
      onClose();
    },
    [navigate, onClose, resolveHref],
  );

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) =>
          flatList.length === 0 ? -1 : (i + 1) % flatList.length,
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) =>
          flatList.length === 0 ? -1 : (i - 1 + flatList.length) % flatList.length,
        );
        break;
      case "Enter":
        if (activeIdx >= 0 && flatList[activeIdx]) {
          e.preventDefault();
          goToItem(flatList[activeIdx]);
        }
        break;
    }
  }

  const hasQuery = query.trim().length >= 2;
  const hasResults = flatList.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Wyszukiwanie globalne"
      className="fixed inset-0 z-300 flex items-start justify-center px-4 pt-[8vh]"
      onMouseDown={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" aria-hidden />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-2xl dark:border-[#334155] dark:bg-[#1e293b] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)]"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 border-b border-[#e5e7eb] px-4 py-3">
          <Search size={15} className="shrink-0 text-[#94a3b8]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj artykułów, macierzy, szablonów, kontaktów…"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
            aria-label="Wyszukaj"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden shrink-0 rounded border border-[#e5e7eb] bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-medium text-[#94a3b8] sm:block">
            Esc
          </kbd>
        </div>

        {/* Results body */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
          {/* Prompt state */}
          {!hasQuery && (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-[#9ca3af]">
              <Search size={28} className="text-[#d1d5db]" />
              <span>Wpisz co najmniej 2 znaki, aby wyszukać</span>
            </div>
          )}

          {/* Empty state */}
          {hasQuery && !hasResults && (
            <div className="flex flex-col items-center gap-2 py-10 text-sm">
              <Search size={28} className="text-[#d1d5db]" />
              <span className="text-[#6b7280]">
                Brak wyników dla{" "}
                <span className="font-medium text-[#374151]">„{query}"</span>
              </span>
            </div>
          )}

          {/* Result groups */}
          {hasResults && (
            <div className="pb-2">
              {GROUP_ORDER.map((type) => {
                const items = results
                  .filter((r) => r.type === type)
                  .slice(0, GROUP_CAPS[type]);
                if (!items.length) return null;

                const offset = groupOffsets[type] ?? 0;
                const Icon = TYPE_ICON[type];
                const badge = TYPE_BADGE[type];

                return (
                  <div key={type}>
                    <p className="px-4 pb-1 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                      {GROUP_LABELS[type]}
                    </p>
                    {items.map((item, i) => {
                      const idx = offset + i;
                      const isActive = idx === activeIdx;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-idx={idx}
                          onMouseEnter={() => setActiveIdx(idx)}
                          onClick={() => goToItem(item)}
                          className={[
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                            isActive ? "bg-[#f0f5ff]" : "hover:bg-[#fafbfc]",
                          ].join(" ")}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${badge.bg}`}
                          >
                            <Icon size={13} className={badge.icon} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[#0f172a]">
                              {item.title}
                            </span>
                            <span className="block truncate text-xs text-[#6b7280]">
                              {item.subtitle}
                            </span>
                          </span>
                          {isActive && (
                            <ArrowRight size={13} className="shrink-0 text-[#94a3b8]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Keyboard shortcut hints */}
        <div className="flex items-center gap-4 border-t border-[#f1f5f9] bg-[#fafbfc] px-4 py-2 text-[10px] text-[#94a3b8]">
          {hasQuery && enabledModules.matrix ? (
            <button
              type="button"
              onClick={() => {
                navigate(resolveHref(`${ROUTES.matrix}?q=${encodeURIComponent(query.trim())}`));
                onClose();
              }}
              className="flex items-center gap-1.5 font-medium text-[#1d4f91] transition hover:underline"
            >
              <ArrowRight size={11} />
              Pokaż wszystkie wyniki w Macierzy
            </button>
          ) : null}
          <span className="ml-auto flex items-center gap-4">
            <span>
              <kbd className="mr-0.5 rounded border border-[#e5e7eb] bg-white px-1 py-px font-medium">
                ↑↓
              </kbd>{" "}
              Nawiguj
            </span>
            <span>
              <kbd className="mr-0.5 rounded border border-[#e5e7eb] bg-white px-1 py-px font-medium">
                ↵
              </kbd>{" "}
              Otwórz
            </span>
            <span>
              <kbd className="mr-0.5 rounded border border-[#e5e7eb] bg-white px-1 py-px font-medium">
                Esc
              </kbd>{" "}
              Zamknij
            </span>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
