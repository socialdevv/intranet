import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { X, Clock, Building2, ArrowRight, GitBranch, BookOpen, FileText } from "lucide-react";
import { ROUTES, knowledgeArticlePath } from "@/lib/routes";
import { useData } from "@/contexts/data-context";
import type { MatrixDecision } from "@/lib/types/domain";

interface Props {
  entry: MatrixDecision;
  onClose: () => void;
}

/**
 * Modal popup showing a concise preview of a MatrixDecision entry.
 * Clicking outside or pressing Escape closes it.
 * "Otwórz w macierzy" navigates to the matrix page with the entry pre-selected.
 */
export default function MatrixPreviewModal({ entry, onClose }: Props) {
  const { pages, templates } = useData();

  // Reverse-derived linked articles
  const linkedArticles = pages.filter(
    (p) => p.matrixLinkId === entry.id || (p.globalMatrixLinkIds ?? []).includes(entry.id)
  );

  // Linked templates
  const linkedTemplates = (entry.linkedTemplateIds ?? [])
    .map((id) => templates.find((t) => t.id === id))
    .filter(Boolean) as (typeof templates)[number][];

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Collect first few routing rules for display
  const routePreview = entry.conditions.slice(0, 3).map((cond, i) => (
    <div key={i} className="rounded-lg bg-[#f8fafc] px-3 py-2 dark:bg-[#1e293b]">
      <div className="space-y-2">
        <div className="min-w-0 space-y-1">
        {cond.criteria.map((cr, j) => (
          <p key={j} className="text-xs text-[#4b5563] wrap-anywhere dark:text-[#94a3b8]">
            <span className="font-medium text-[#374151] dark:text-[#cbd5e1]">{cr.field}:</span>{" "}
            {cr.value}
          </p>
        ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[#e2e8f0] pt-1.5 dark:border-[#334155]">
          <ArrowRight size={11} className="shrink-0 text-[#9ca3af] dark:text-[#475569]" />
          <span className="text-xs font-semibold text-[#1d4f91] wrap-anywhere dark:text-[#60a5fa]">
            {cond.department}
          </span>
        </div>
      </div>
    </div>
  ));

  return createPortal(
    <div
      className="fixed inset-0 z-200 flex items-end justify-center p-2 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Podgląd macierzy: ${entry.subcategory || entry.category}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-3xl min-h-0 max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-xl border border-[#dde5ee] bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#f1f5f9] px-4 py-4 sm:px-5 dark:border-[#1e3a5f]">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1d4f91]/10 dark:bg-[#1d4f91]/20">
              <GitBranch size={15} className="text-[#1d4f91] dark:text-[#60a5fa]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#1d4f91]/60 dark:text-[#60a5fa]/60">
                Macierz — {entry.category}
              </p>
              <h3 className="text-base font-bold text-[#0f172a] leading-snug dark:text-[#f1f5f9]">
                {entry.subcategory || entry.category}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] hover:bg-[#f1f5f9] hover:text-[#374151] transition dark:text-[#64748b] dark:hover:bg-[#1e293b] dark:hover:text-[#cbd5e1]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-5">
          {/* Czas realizacji + Department */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f2ff] px-3 py-1 text-xs font-semibold text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
              <Clock size={11} />
              Czas realizacji: {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}
            </span>
            {entry.defaultDepartment && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f1f5f9] px-3 py-1 text-xs font-medium text-[#374151] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
                <Building2 size={11} />
                {entry.defaultDepartment}
              </span>
            )}
          </div>

          {/* Description */}
          {entry.description && (
            <p className="text-sm leading-6 text-[#4b5563] wrap-anywhere dark:text-[#94a3b8]">
              {entry.description}
            </p>
          )}

          {/* Instructions */}
          {entry.instructions && (
            <div className="rounded-xl bg-[#f8fafc] px-3 py-2.5 dark:bg-[#1e293b]">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] dark:text-[#475569]">
                Instrukcja
              </p>
              <p className="text-xs leading-5 text-[#374151] wrap-anywhere dark:text-[#cbd5e1]">
                {entry.instructions}
              </p>
            </div>
          )}

          {/* Routing preview */}
          {entry.conditions.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] dark:text-[#475569]">
                Kierowanie
              </p>
              <div className="space-y-1.5">{routePreview}</div>
              {entry.conditions.length > 3 && (
                <p className="mt-2 text-[11px] text-[#9ca3af] dark:text-[#475569]">
                  + {entry.conditions.length - 3} więcej reguł — otwórz w macierzy
                </p>
              )}
            </div>
          )}

          {/* Linked templates */}
          {linkedTemplates.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] dark:text-[#475569]">
                Szablony ({linkedTemplates.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {linkedTemplates.map((tpl) => (
                  <Link
                    key={tpl.id}
                    to={`${ROUTES.szablony}?template=${tpl.id}`}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafbfc] px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#93c5fd] hover:bg-[#eff6ff] hover:text-[#1e40af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#cbd5e1] dark:hover:border-[#1e3a5f] dark:hover:bg-[#0f2340] dark:hover:text-[#93c5fd]"
                  >
                    <FileText size={12} className="shrink-0 text-[#94a3b8] dark:text-[#475569]" />
                    <span className="min-w-0 flex-1 wrap-anywhere">{tpl.title}</span>
                    <ArrowRight size={11} className="shrink-0 text-[#94a3b8]" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related articles — automatically derived from article→matrix links */}
          {linkedArticles.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#94a3b8] dark:text-[#475569]">
                Powiązane artykuły ({linkedArticles.length})
              </p>
              <div className="flex flex-col gap-1.5">
                {linkedArticles.map((page) => (
                  <Link
                    key={page.id}
                    to={knowledgeArticlePath(page.category, page.slug)}
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-[#fafbfc] px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#c3d6ea] hover:bg-[#eff6ff] hover:text-[#1d4f91] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#cbd5e1] dark:hover:border-[#1e3a5f] dark:hover:bg-[#0f2340] dark:hover:text-[#60a5fa]"
                  >
                    <BookOpen size={12} className="shrink-0 text-[#94a3b8] dark:text-[#475569]" />
                    <span className="min-w-0 flex-1 wrap-anywhere">{page.title}</span>
                    <ArrowRight size={11} className="shrink-0 text-[#94a3b8]" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-[#f1f5f9] px-4 py-3 sm:flex-row sm:justify-end sm:px-5 dark:border-[#1e3a5f]">
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-full rounded-lg border border-[#e5e7eb] px-3 text-xs font-medium text-[#374151] transition hover:bg-[#f8fafc] sm:w-auto dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Zamknij
          </button>
          <Link
            to={`${ROUTES.matrix}?entry=${entry.id}`}
            onClick={onClose}
            className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1d4f91] px-3 text-xs font-medium text-white transition hover:bg-[#1a4580] sm:w-auto dark:bg-[#1d4f91] dark:hover:bg-[#2563eb]"
          >
            Otwórz w macierzy
            <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
}
