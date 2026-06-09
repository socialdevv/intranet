import { useMemo, useRef, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import type { DocSection } from "@/lib/types/domain";
import { sectionToTipTapDoc } from "@/lib/knowledge/content-doc";
import { buildSectionAnchorId, scrollSectionAnchorIntoView } from "@/lib/knowledge/section-anchors";
import { extractPlainText } from "@/lib/utils";

type Props = {
  sections: DocSection[];
};

type MatchParts = {
  before: string;
  match: string;
  after: string;
  hasMatch: boolean;
};

function getMatchParts(text: string, queryLower: string): MatchParts {
  if (!queryLower) {
    return { before: "", match: "", after: text, hasMatch: false };
  }
  const idx = text.toLowerCase().indexOf(queryLower);
  if (idx < 0) {
    return { before: "", match: "", after: text, hasMatch: false };
  }
  return {
    before: text.slice(0, idx),
    match: text.slice(idx, idx + queryLower.length),
    after: text.slice(idx + queryLower.length),
    hasMatch: true,
  };
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getContentSnippet(content: string, queryLower: string): MatchParts & { prefix: string; suffix: string } {
  const normalized = normalizeWhitespace(content);
  if (!queryLower || !normalized) {
    return { before: "", match: "", after: normalized, hasMatch: false, prefix: "", suffix: "" };
  }

  const idx = normalized.toLowerCase().indexOf(queryLower);
  if (idx < 0) {
    return { before: "", match: "", after: normalized, hasMatch: false, prefix: "", suffix: "" };
  }

  const CONTEXT_CHARS = 48;
  const start = Math.max(0, idx - CONTEXT_CHARS);
  const end = Math.min(normalized.length, idx + queryLower.length + CONTEXT_CHARS);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < normalized.length ? "…" : "";

  return {
    before: normalized.slice(start, idx),
    match: normalized.slice(idx, idx + queryLower.length),
    after: normalized.slice(idx + queryLower.length, end),
    hasMatch: true,
    prefix,
    suffix,
  };
}

export default function ArticleSectionSearch({ sections }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const navigate = useNavigate();
  const location = useLocation();

  const searchableSections = useMemo(
    () =>
      sections
        .filter((s) => s.title.trim())
        .map((section) => ({
          section,
          titleLower: section.title.toLowerCase(),
          tags: (section.tags ?? []).map((tag) => tag.trim()).filter(Boolean),
          contentText: normalizeWhitespace(extractPlainText(sectionToTipTapDoc(section))),
        })),
    [sections],
  );
  const trimmed = query.trim().toLowerCase();

  const results =
    trimmed.length > 0
      ? searchableSections
          .map((s) => {
            const hasTitleMatch = s.titleLower.includes(trimmed);
            const contentLower = s.contentText.toLowerCase();
            const hasContentMatch = contentLower.includes(trimmed);
            const tagMatches = s.tags.filter((tag) => tag.toLowerCase().includes(trimmed));
            const hasTagMatch = tagMatches.length > 0;
            return {
              section: s.section,
              hasTitleMatch,
              hasContentMatch,
              hasTagMatch,
              tagMatches,
              titleParts: getMatchParts(s.section.title, trimmed),
              contentParts: hasContentMatch ? getContentSnippet(s.contentText, trimmed) : null,
            };
          })
          .filter((s) => s.hasTitleMatch || s.hasContentMatch || s.hasTagMatch)
      : [];

  function navigateTo(section: DocSection) {
    const anchorId = buildSectionAnchorId(section.id);
    const nextHash = `#${anchorId}`;
    setQuery("");

    if (location.hash !== nextHash) {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: nextHash,
        },
        { replace: false },
      );
      return;
    }

    window.requestAnimationFrame(() => {
      scrollSectionAnchorIntoView(anchorId, { behavior: "smooth" });
    });
  }

  return (
    <div className="mb-6">
      {/* Search input */}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Szukaj sekcji w artykule
        </label>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]"
          aria-hidden
        />
        <input
          id={inputId}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Szukaj sekcji w artykule…"
          className="h-9 w-full rounded-lg border border-[#dde5ee] bg-white pl-8 pr-8 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#e2e8f0] dark:placeholder-[#4b5563] dark:focus:border-[#3b82f6]"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); inputRef.current?.focus(); }}
            aria-label="Wyczyść wyszukiwanie"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-[#94a3b8] transition hover:text-[#374151] dark:hover:text-[#e2e8f0]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results list */}
      {trimmed.length > 0 && (
        <div className="mt-1.5 overflow-hidden rounded-lg border border-[#dde5ee] bg-white shadow-sm dark:border-[#1e293b] dark:bg-[#111827]">
          {results.length === 0 ? (
            <div className="px-4 py-3">
              <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
                  Nie znaleziono dopasowan dla „{query.trim()}".
              </p>
              <p className="mt-1 text-xs text-[#9ca3af] dark:text-[#64748b]">
                  Przeszukiwane są tytuły, treść i tagi sekcji.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[#eef2f7] px-4 py-2 text-xs text-[#64748b] dark:border-[#1e293b] dark:text-[#94a3b8]">
                  <span>{results.length} wynikow</span>
                  <span>Kliknij, aby przejsc do sekcji</span>
              </div>
              <ul role="listbox" aria-label="Wyniki wyszukiwania sekcji" className="max-h-72 overflow-y-auto">
                {results.map((result) => {
                  const { section, hasTitleMatch, hasContentMatch, hasTagMatch, tagMatches, titleParts, contentParts } = result;
                  const badgeClass = "rounded-full border px-2 py-0.5 text-[10px] font-medium";
                  const markClass = "rounded bg-[#dbeafe] px-0.5 font-medium text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]";
                return (
                  <li key={section.id} role="option" aria-selected="false">
                    <button
                      type="button"
                      onClick={() => navigateTo(section)}
                      className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-[#f1f5f9] dark:hover:bg-[#1e293b]"
                    >
                      <Search size={13} className="shrink-0 text-[#94a3b8]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-[#374151] dark:text-[#cbd5e1]">
                          <span>
                            {titleParts.hasMatch ? (
                              <>
                                {titleParts.before}
                                <mark className={markClass}>{titleParts.match}</mark>
                                {titleParts.after}
                              </>
                            ) : (
                              section.title
                            )}
                          </span>
                          {hasTitleMatch && (
                            <span className={`${badgeClass} border-[#bfdbfe] bg-[#eff6ff] text-[#1d4f91] dark:border-[#1e3a5f] dark:bg-[#172554] dark:text-[#93c5fd]`}>
                                Tytul
                            </span>
                          )}
                          {hasContentMatch && (
                            <span className={`${badgeClass} border-[#d1fae5] bg-[#ecfdf5] text-[#065f46] dark:border-[#14532d] dark:bg-[#052e16] dark:text-[#6ee7b7]`}>
                                Treść
                            </span>
                          )}
                          {hasTagMatch && (
                            <span className={`${badgeClass} border-[#f5d0fe] bg-[#fdf4ff] text-[#86198f] dark:border-[#701a75] dark:bg-[#3b0764] dark:text-[#f5d0fe]`}>
                                Tagi
                            </span>
                          )}
                        </span>
                        {contentParts?.hasMatch && (
                          <span className="mt-1 block text-xs text-[#6b7280] dark:text-[#94a3b8]">
                            {contentParts.prefix}
                            {contentParts.before}
                            <mark className={markClass}>{contentParts.match}</mark>
                            {contentParts.after}
                            {contentParts.suffix}
                          </span>
                        )}
                        {hasTagMatch && (
                          <span className="mt-1 block text-xs text-[#6b7280] dark:text-[#94a3b8]">
                            Tagi: {tagMatches.slice(0, 5).join(", ")}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
                })}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
