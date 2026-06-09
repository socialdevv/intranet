import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Building2, Clock, Tag, FileText, AlertCircle, AlertTriangle, Plus, ArrowRight, BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import TemplatePreviewModal from "@/components/templates/template-preview-modal";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditRules } from "@/lib/auth/authorization";
import { getApplicableMatrixAdvisoryRules } from "@/lib/matrix/advisories";
import { adminMatrixEditorPath, knowledgeArticlePath } from "@/lib/routes";
import type {
  KnowledgePage,
  MatrixAdvisoryRule,
  MatrixAdvisorySeverity,
  MatrixDecision,
  TextTemplate,
} from "@/lib/types/domain";

const MATRIX_ADVISORY_STYLES: Record<
  MatrixAdvisorySeverity,
  {
    container: string;
    icon: string;
    title: string;
    message: string;
  }
> = {
  info: {
    container: "border-[#93c5fd] bg-[#eff6ff] dark:border-[#1e3a5f] dark:bg-[#0f2340]",
    icon: "text-[#1d4f91] dark:text-[#60a5fa]",
    title: "text-[#1e3a8a] dark:text-[#93c5fd]",
    message: "text-[#1d4f91] dark:text-[#bfdbfe]",
  },
  warning: {
    container: "border-[#fbbf24] bg-[#fffbeb] dark:border-[#b45309]/60 dark:bg-[#1c1200]",
    icon: "text-[#d97706] dark:text-[#fbbf24]",
    title: "text-[#92400e] dark:text-[#fbbf24]",
    message: "text-[#78350f] dark:text-[#fcd34d]",
  },
  critical: {
    container: "border-[#fca5a5] bg-[#fff1f2] dark:border-[#7f1d1d]/60 dark:bg-[#1f0a0a]",
    icon: "text-[#dc2626] dark:text-[#fca5a5]",
    title: "text-[#991b1b] dark:text-[#fca5a5]",
    message: "text-[#7f1d1d] dark:text-[#fecaca]",
  },
};

// ── Fuzzy scoring ─────────────────────────────────────────────────────────────


function scoreEntry(entry: MatrixDecision, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  let score = 0;
  const sub = entry.subcategory.toLowerCase();
  const cat = entry.category.toLowerCase();
  const desc = entry.description.toLowerCase();
  const kws = entry.keywords.map((k) => k.toLowerCase());
  const inst = entry.instructions.toLowerCase();
  const notes = entry.additionalNotes.toLowerCase();

  if (sub === q) score += 120;
  else if (sub.includes(q)) score += 90;
  if (kws.some((k) => k === q)) score += 80;
  else if (kws.some((k) => k.includes(q))) score += 65;
  if (cat.includes(q)) score += 45;
  if (desc.includes(q)) score += 30;
  if (inst.includes(q)) score += 18;
  if (notes.includes(q)) score += 18;
  return score;
}

// ── Routing section (detail panel) ───────────────────────────────────────────
function RoutingSection({ entry }: { entry: MatrixDecision }) {
  const hasRules = entry.conditions && entry.conditions.length > 0;
  const hasDefault = Boolean(entry.defaultDepartment);

  return (
    <div className="space-y-3">
      {/* Default department — always visible when set, shown ABOVE rules */}
      {hasDefault && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#6b7280] dark:text-[#94a3b8]">Domyślnie:</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] px-3 py-1.5 text-xs font-medium text-[#4338ca] dark:border-[#3730a3]/40 dark:bg-[#1e1b4b]/30 dark:text-[#818cf8]">
            <Building2 size={12} />
            {entry.defaultDepartment}
          </span>
        </div>
      )}

      {/* Numbered rule cards */}
      {hasRules && (
        <div className="space-y-2">
          {hasDefault && (
            <p className="pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b] dark:text-[#94a3b8]">
              Reguły szczegółowe ({entry.conditions.length})
            </p>
          )}
          {entry.conditions.map((cond, i) => (
            <div key={i} className="rounded-lg border border-[#dde8f4] bg-white p-3 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                Reguła {i + 1}
              </p>
              {cond.criteria.length > 0 ? (
                <div className="mb-2 space-y-1">
                  {cond.criteria.map((cr, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-[#64748b] dark:text-[#94a3b8]">{cr.field}</span>
                      <span className="text-[#9ca3af]">=</span>
                      <span className="rounded bg-[#f1f5f9] px-1.5 py-0.5 font-medium text-[#374151] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
                        {cr.value}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-2 text-xs italic text-[#9ca3af]">Brak kryteriów — zawsze pasuje</p>
              )}
              <div className="flex items-center gap-1.5 border-t border-[#f1f5f9] pt-2 dark:border-[#1e293b]">
                <ArrowRight size={11} className="shrink-0 text-[#94a3b8]" />
                <span className="inline-flex items-center gap-1 rounded-md border border-[#c7d2fe] bg-[#eef2ff] px-2 py-0.5 text-xs font-medium text-[#4338ca] dark:border-[#3730a3]/40 dark:bg-[#1e1b4b]/30 dark:text-[#818cf8]">
                  <Building2 size={10} />
                  {cond.department}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!hasRules && !hasDefault && (
        <p className="text-xs italic text-[#9ca3af]">Brak skonfigurowanego kierowania.</p>
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────
function MatrixDetailPanel({
  entry,
  onEdit,
  onDelete,
  isAdmin,
  templates,
  onPreview,
  pages,
  advisoryRules,
}: {
  entry: MatrixDecision;
  onEdit: () => void;
  onDelete: () => void;
  isAdmin: boolean;
  templates: TextTemplate[];
  onPreview: (id: string) => void;
  pages: KnowledgePage[];
  advisoryRules: MatrixAdvisoryRule[];
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const advisories = getApplicableMatrixAdvisoryRules(entry, advisoryRules);

  const linkedArticles = pages.filter(
    (p) => p.matrixLinkId === entry.id || (p.globalMatrixLinkIds ?? []).includes(entry.id)
  );

  return (
    <div className="rounded-xl border border-[#dbe3ec] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
            {entry.category}
          </p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
            {entry.subcategory}
          </h2>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-white px-3 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:bg-[#263347]"
            >
              Edytuj
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="inline-flex h-8 items-center rounded-lg bg-[#dc2626] px-3 text-xs font-medium text-white transition hover:bg-[#b91c1c]"
                >
                  Potwierdź
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="inline-flex h-8 items-center rounded-lg border border-[#e5e7eb] px-2 text-xs text-[#6b7280] transition hover:bg-[#f9fafb] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="inline-flex h-8 items-center rounded-lg border border-[#fecaca] bg-[#fff5f5] px-3 text-xs font-medium text-[#dc2626] transition hover:bg-[#fee2e2] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#f87171] dark:hover:bg-[#2d0f0f]"
              >
                Usuń
              </button>
            )}
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-4 rounded-lg border border-[#e5e7eb] bg-[#fafbfc] p-4 dark:border-[#1e293b] dark:bg-[#111827]">
        <p className="whitespace-pre-wrap text-sm leading-6 text-[#374151] dark:text-[#cbd5e1]">{entry.description}</p>
      </div>

      {/* Czas realizacji + Keywords */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[#e5e7eb] bg-[#fafcff] p-4 dark:border-[#1e293b] dark:bg-[#111827]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Czas realizacji
          </p>
          <p className="mt-1 text-lg font-bold text-[#1d4f91] dark:text-[#60a5fa]">
            {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}
          </p>
        </div>
        <div className="rounded-lg border border-[#e5e7eb] bg-[#fafcff] p-4 dark:border-[#1e293b] dark:bg-[#111827]">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8]">
            Słowa kluczowe
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {entry.keywords.length > 0 ? (
              entry.keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-xs text-[#374151] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]"
                >
                  {k}
                </span>
              ))
            ) : (
              <span className="text-xs text-[#9ca3af]">brak</span>
            )}
          </div>
        </div>
      </div>

      {/* Linked templates — shown prominently above instructions */}
      {entry.linkedTemplateIds && entry.linkedTemplateIds.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] p-4 dark:border-[#1e3a5f] dark:bg-[#0f2340]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1e3a8a] dark:text-[#93c5fd]">
            Powiązane szablony ({entry.linkedTemplateIds.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.linkedTemplateIds.map((id) => {
              const tpl = templates.find((t) => t.id === id);
              if (!tpl) return null;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPreview(id)}
                  className="flex items-center gap-2 rounded-xl border border-[#93c5fd] bg-white px-3 py-2.5 text-sm font-medium text-[#1e40af] shadow-sm transition hover:border-[#1d4f91] hover:bg-[#dbeafe] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#93c5fd] dark:hover:border-[#2563eb] dark:hover:bg-[#0f2340]"
                >
                  <span className="truncate">{tpl.title}</span>
                  <ArrowRight size={13} className="ml-1 shrink-0 text-[#60a5fa]" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Related articles — automatically derived from article→matrix links */}
      {linkedArticles.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#c3d6ea] bg-[#eff6ff] p-4 dark:border-[#1e3a5f] dark:bg-[#0f2340]">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1d4f91] dark:text-[#60a5fa]">
            Powiązane artykuły ({linkedArticles.length})
          </p>
          <div className="flex flex-col gap-2">
            {linkedArticles.map((page) => (
              <Link
                key={page.id}
                to={knowledgeArticlePath(page.category, page.slug)}
                className="flex items-center gap-2 rounded-lg border border-[#93c5fd]/60 bg-white px-3 py-2.5 text-sm font-medium text-[#1e40af] shadow-sm transition hover:border-[#1d4f91] hover:bg-[#dbeafe] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#93c5fd] dark:hover:border-[#2563eb] dark:hover:bg-[#0f2340]"
              >
                <BookOpen size={13} className="shrink-0 text-[#1d4f91]/60 dark:text-[#60a5fa]/60" />
                <span className="flex-1 truncate">{page.title}</span>
                <ArrowRight size={13} className="ml-1 shrink-0 text-[#60a5fa]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      {entry.instructions && (
        <div className="mb-4 rounded-lg border border-[#e5e7eb] bg-white p-4 dark:border-[#1e293b] dark:bg-[#111827]">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#374151] dark:text-[#cbd5e1]">
            <FileText size={12} />
            Instrukcja obsługi
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#374151] dark:text-[#cbd5e1]">
            {entry.instructions}
          </p>
        </div>
      )}

      {/* Additional Notes */}
      {entry.additionalNotes && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fffafa] p-4 dark:border-[#7f1d1d]/50 dark:bg-[#1a0808]">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#dc2626] dark:text-[#f87171]">
            <AlertCircle size={12} />
            Uwagi dodatkowe
          </p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#7f1d1d] dark:text-[#fca5a5]">
            {entry.additionalNotes}
          </p>
        </div>
      )}

      {/* Advisory notices driven by configuration.rules.matrixAdvisoryRules */}
      {advisories.length > 0 && (
        <div className="mb-4 space-y-3">
          {advisories.map((advisory) => {
            const severity = advisory.severity ?? "warning";
            const styles = MATRIX_ADVISORY_STYLES[severity];
            const Icon = severity === "info" ? AlertCircle : AlertTriangle;

            return (
              <div
                key={advisory.id}
                className={`flex items-start gap-3 rounded-xl border p-4 ${styles.container}`}
              >
                <Icon size={18} className={`mt-0.5 shrink-0 ${styles.icon}`} />
                <div>
                  <p className={`text-sm font-bold uppercase tracking-wide ${styles.title}`}>
                    {advisory.title}
                  </p>
                  <p className={`mt-0.5 text-xs ${styles.message}`}>
                    {advisory.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Routing */}
      <div className="rounded-xl border border-[#c3d6ea] bg-[#eff6ff] p-4 dark:border-[#1e3a5f] dark:bg-[#0f2340]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#1d4f91] dark:text-[#60a5fa]">
          Kierowanie
        </p>
        <RoutingSection entry={entry} />
      </div>

    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────────
function MatrixResultCard({
  entry,
  selected,
  onClick,
  showCategory = true,
}: {
  entry: MatrixDecision;
  selected: boolean;
  onClick: () => void;
  showCategory?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#b6c6d8] bg-[#f4f8fc] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-[#1d4f91]/60 dark:bg-[#0f2340]"
          : "border-[#e5e7eb] bg-white hover:border-[#ccd7e4] hover:bg-[#fbfdff] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:bg-[#0f2340]"
      }`}
    >
      {showCategory && (
        <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
          {entry.category}
        </p>
      )}
      <h3 className="mb-1.5 text-base font-semibold tracking-[-0.01em] text-[#0f172a] dark:text-[#f1f5f9]">
        {entry.subcategory}
      </h3>
      <p className="mb-3 line-clamp-2 text-xs text-[#4b5563] dark:text-[#94a3b8]">
        {(() => { const flat = entry.description.replace(/\n+/g, " "); return flat.length > 120 ? flat.slice(0, 120) + "…" : flat; })()}
      </p>
      <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f2ff] px-2.5 py-1 text-xs font-semibold text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
        <Clock size={11} />
        Czas realizacji: {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}
      </span>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MatrixPage() {
  const { user } = useAuth();
  const {
    matrix,
    templates,
    pages,
    isLoading,
    matrixModule,
    matrixCategoryOrder,
    projectConfiguration,
  } = useData();
  const { push: pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Matrix local search is URL-driven (?q=) so global search navigation can
  // reliably clear/replace stale local filters on the same route.
  const rawQuery = searchParams.get("q") ?? "";
  const [debouncedQuery, setDebouncedQuery] = useState(rawQuery);
  // Derive selectedId directly from the URL — the URL is the single source of truth.
  // This eliminates the two-way effect sync that caused selection to revert when
  // navigating to a matrix entry from global search while already on the matrix page.
  const selectedId = searchParams.get("entry");
  const setRawQuery = useCallback(
    (nextQuery: string) => {
      const next = new URLSearchParams(searchParams);
      const hasSearchText = nextQuery.trim().length > 0;
      if (hasSearchText) next.set("q", nextQuery);
      else next.delete("q");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) {
        next.set("entry", id);
      } else {
        next.delete("entry");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );
  const [filterCategory, setFilterCategory] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const collapseInitialized = useRef(false);

  const toggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  const isAdmin = canEditRules(user);
  const {
    source,
    isLoading: isMatrixLoading,
    isMutating,
    error: moduleError,
    canWrite,
    removeEntry,
  } = matrixModule;
  const apiMode = source === "api";
  const matrixAdvisoryRules = projectConfiguration.rules?.matrixAdvisoryRules ?? [];
  const [actionError, setActionError] = useState("");

  const previewTemplate = useMemo(
    () => (previewTemplateId ? templates.find((t) => t.id === previewTemplateId) ?? null : null),
    [previewTemplateId, templates]
  );

  const handlePreview = useCallback((id: string) => setPreviewTemplateId(id), []);
  const handleClosePreview = useCallback(() => setPreviewTemplateId(null), []);

  // 140ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim()), 140);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Scroll the selected card into view whenever the selection changes
  useEffect(() => {
    if (!selectedId) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`entry-${selectedId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [selectedId]);

  const categoryOptions = useMemo(
    () => [...new Set(matrix.map((m) => m.category))].sort(),
    [matrix]
  );

  const results = useMemo(() => {
    let filtered = matrix;
    if (filterCategory) filtered = filtered.filter((m) => m.category === filterCategory);
    if (!debouncedQuery) {
      return [...filtered].sort((a, b) => {
        const catA = matrixCategoryOrder.indexOf(a.category);
        const catB = matrixCategoryOrder.indexOf(b.category);
        const catDiff = (catA === -1 ? 9999 : catA) - (catB === -1 ? 9999 : catB);
        if (catDiff !== 0) return catDiff;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      });
    }
    return filtered
      .map((m) => ({ entry: m, score: scoreEntry(m, debouncedQuery) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ entry }) => entry);
  }, [matrix, filterCategory, debouncedQuery, matrixCategoryOrder]);

  /** When no text search is active, group entries by category for browsing. */
  const groupedByCategory = useMemo(() => {
    if (debouncedQuery) return null;
    const map = new Map<string, MatrixDecision[]>();
    for (const entry of results) {
      const bucket = map.get(entry.category) ?? [];
      bucket.push(entry);
      map.set(entry.category, bucket);
    }
    return [...map.entries()]; // order reflects sortOrder of entries
  }, [results, debouncedQuery]);

  const selectedEntry = useMemo(
    () => results.find((m) => m.id === selectedId) ?? results[0] ?? null,
    [results, selectedId]
  );

  useEffect(() => {
    if (!selectedEntry && results.length > 0) {
      setSelectedId(results[0].id);
    }
  }, [results, selectedEntry, setSelectedId]);

  // One-time init: collapse all categories on first data load.
  // Declared before auto-expand so that React 18 batching lets the
  // auto-expand functional updater see the already-collapsed state.
  // The cleanup resets the ref so React Strict Mode double-invoke
  // re-runs the init on the second mount (state resets but ref would not).
  useEffect(() => {
    if (collapseInitialized.current || !groupedByCategory || groupedByCategory.length === 0) return;
    collapseInitialized.current = true;
    setCollapsedCategories(new Set(groupedByCategory.map(([cat]) => cat)));
    return () => { collapseInitialized.current = false; };
  }, [groupedByCategory]);

  // Auto-expand category when the user explicitly selects an entry that is
  // inside a collapsed category (e.g. navigating from global search).
  // Guard on selectedId so the default results[0] fallback — which has no
  // explicit URL selection — does NOT undo the init collapse on load.
  useEffect(() => {
    if (!selectedEntry || !selectedId) return;
    setCollapsedCategories((prev) => {
      if (!prev.has(selectedEntry.category)) return prev;
      const next = new Set(prev);
      next.delete(selectedEntry.category);
      return next;
    });
  }, [selectedEntry, selectedId]);

  async function handleDelete() {
    if (!selectedEntry) return;

    if (apiMode && !canWrite) {
      setActionError(moduleError ?? "Backend modułu macierzy nie jest jeszcze gotowy do zapisu.");
      return;
    }

    setActionError("");

    try {
      await removeEntry(selectedEntry.id);
      setSelectedId(null);
      pushToast(
        "success",
        apiMode ? "Wpis macierzy został usunięty z backendu." : "Wpis macierzy został usunięty."
      );
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się usunąć wpisu macierzy.");
    }
  }

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w macierzy…">
      <section className="mx-auto w-full max-w-304 pb-10">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Macierz decyzyjna
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Kierowanie zgłoszeń, czas realizacji i instrukcje obsługi
            </p>
          </div>
          {isAdmin && (apiMode && !canWrite ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d1d5db] bg-white px-4 py-2.5 text-sm font-semibold text-[#9ca3af] shadow-sm"
            >
              <Plus size={15} />
              Nowy wpis
            </button>
          ) : (
            <Link
              to={adminMatrixEditorPath("nowy")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d4f91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72]"
            >
              <Plus size={15} />
              Nowy wpis
            </Link>
          ))}
        </div>

        {(actionError || moduleError) && (
          <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#fca5a5]">
            {actionError || moduleError}
          </div>
        )}

        {apiMode && isMatrixLoading && matrix.length === 0 && (
          <div className="mb-4 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86]">
            Ładowanie macierzy z backendu…
          </div>
        )}

        {/* Search + filters */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-50 flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            />
            <input
              type="search"
              placeholder="Szukaj po kategorii, słowach kluczowych, opisie…"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-[#d9e2ec] bg-white pl-9 pr-4 text-sm placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9] dark:placeholder:text-[#475569] dark:focus:border-[#2563eb]"
            />
          </div>
          {categoryOptions.length > 1 && (
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 rounded-xl border border-[#d9e2ec] bg-white px-3 text-sm text-[#374151] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9]"
            >
              <option value="">Wszystkie kategorie</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-[#9ca3af]">Ładowanie…</div>
        ) : matrix.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Tag size={36} className="mb-4 text-[#d1d5db]" />
            <p className="text-base font-medium text-[#374151] dark:text-[#cbd5e1]">Brak wpisów w macierzy</p>
            {isAdmin && (
              <Link
                to={adminMatrixEditorPath("nowy")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#1d4f91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72]"
              >
                <Plus size={14} />
                Dodaj pierwszy wpis
              </Link>
            )}
          </div>
        ) : results.length === 0 ? (
          <div className="py-16 text-center text-sm text-[#9ca3af]">
            Brak wyników dla podanych kryteriów.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            {/* Card list */}
            <div>
              {groupedByCategory ? (
                /* Grouped browse mode — no active search query */
                <div className="space-y-7">
                  {groupedByCategory.map(([cat, entries]) => (
                    <div key={cat}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(cat)}
                        className="mb-2.5 flex w-full items-center gap-2 text-left"
                      >
                        <span className="text-sm font-bold uppercase tracking-wider text-[#1d4f91] dark:text-[#60a5fa]">
                          {cat}
                        </span>
                        <span className="rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
                          {entries.length}
                        </span>
                        <span className="ml-auto text-[#94a3b8]">
                          {collapsedCategories.has(cat) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>
                      {!collapsedCategories.has(cat) && (
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <div key={entry.id} id={`entry-${entry.id}`} className="scroll-mt-4">
                              <MatrixResultCard
                                entry={entry}
                                selected={selectedEntry?.id === entry.id}
                                onClick={() => setSelectedId(entry.id)}
                                showCategory={false}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat ranked results — search query is active */
                <div className="space-y-3">
                  <p className="text-xs text-[#9ca3af]">
                    {results.length} {results.length === 1 ? "wynik" : "wyników"}
                  </p>
                  {results.map((entry) => (
                    <div key={entry.id} id={`entry-${entry.id}`} className="scroll-mt-4">
                      <MatrixResultCard
                        entry={entry}
                        selected={selectedEntry?.id === entry.id}
                        onClick={() => setSelectedId(entry.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel — sticky on xl */}
            {selectedEntry && (
              <div className="xl:sticky xl:top-20 xl:self-start xl:max-h-[calc(100vh-5rem)] xl:overflow-y-auto xl:pb-6">
                <MatrixDetailPanel
                  entry={selectedEntry}
                  isAdmin={isAdmin}
                  templates={templates}
                  pages={pages}
                  advisoryRules={matrixAdvisoryRules}
                  onPreview={handlePreview}
                  onEdit={() => navigate(adminMatrixEditorPath(selectedEntry.id))}
                  onDelete={() => {
                    if (isMutating) return;
                    void handleDelete();
                  }}
                />
              </div>
            )}
          </div>
        )}
      </section>
      {previewTemplate && (
        <TemplatePreviewModal template={previewTemplate} onClose={handleClosePreview} />
      )}
    </AppShell>
  );
}
