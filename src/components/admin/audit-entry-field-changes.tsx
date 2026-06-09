import { useMemo, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import type { ProjectAuditHistoryItem } from "@/lib/api/project-audit";
import {
  auditEntryHasFieldDiff,
  resolveAuditFieldChanges,
  truncateAuditPreview,
  type AuditFieldChangeRow,
} from "@/lib/audit/audit-field-changes";

type AuditEntryFieldChangesProps = {
  item: ProjectAuditHistoryItem;
};

export default function AuditEntryFieldChanges({ item }: AuditEntryFieldChangesProps) {
  const rows = useMemo(() => resolveAuditFieldChanges(item), [item]);

  if (!auditEntryHasFieldDiff(item) || rows.length === 0) {
    return null;
  }

  const partialBeforeOnly = rows.some((row) => !row.hasBefore);

  return (
    <div className="mt-3 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-3 dark:border-[#334155] dark:bg-[#0f172a]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5f6f86] dark:text-[#9fb3cc]">
          Zmienione pola
        </p>
        {partialBeforeOnly ? (
          <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
            Starsze wpisy mogą pokazywać tylko wartość po zmianie.
          </p>
        ) : null}
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#dbe4f0] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
              <th className="py-2 pr-3">Pole</th>
              <th className="py-2 pr-3">Przed</th>
              <th className="w-6 py-2" aria-hidden />
              <th className="py-2">Po</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AuditChangeRow key={row.field} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditChangeRow({ row }: { row: AuditFieldChangeRow }) {
  if (row.presentation === "neutral") {
    return (
      <tr className="border-b border-[#e8edf3] align-top last:border-b-0 dark:border-[#1f2937]">
        <td className="py-2.5 pr-3 font-medium text-[#334155] dark:text-[#cbd5e1]">
          {row.label}
        </td>
        <td colSpan={3} className="py-2.5">
          <StructuredNeutralDiff before={row.before} after={row.after} />
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-[#e8edf3] align-top last:border-b-0 dark:border-[#1f2937]">
      <td className="py-2.5 pr-3 font-medium text-[#334155] dark:text-[#cbd5e1]">
        {row.label}
      </td>
      <td className="max-w-xs py-2.5 pr-3">
        <AuditScalarValueCell value={row.before} tone="before" placeholder="brak zapisu" />
      </td>
      <td className="py-2.5 text-[#94a3b8]">
        <ArrowRight size={12} className="mx-auto" />
      </td>
      <td className="max-w-xs py-2.5">
        <AuditScalarValueCell value={row.after} tone="after" placeholder="—" />
      </td>
    </tr>
  );
}

function StructuredNeutralDiff({
  before,
  after,
}: {
  before: string | null;
  after: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const previewBefore = before ? truncateAuditPreview(before, 240) : null;
  const previewAfter = after ? truncateAuditPreview(after, 240) : null;
  const hasFullDiff = Boolean(before && after && before !== after);

  return (
    <div className="rounded-lg border border-[#dbe4f0] bg-white/80 p-2.5 dark:border-[#334155] dark:bg-[#111827]/80">
      <p className="text-[11px] text-[#64748b] dark:text-[#94a3b8]">
        Złożona struktura — poniżej podgląd bez pełnego kolorowania całego bloku.
        {hasFullDiff ? " Rozwiń, aby porównać pełne wartości." : null}
      </p>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <NeutralPreviewColumn label="Przed" value={previewBefore} placeholder="brak zapisu" />
        <NeutralPreviewColumn label="Po" value={previewAfter} placeholder="—" />
      </div>

      {(before && before.length > 240) || (after && after.length > 240) ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1d4f91] hover:underline dark:text-[#93c5fd]"
          >
            <ChevronDown size={12} className={expanded ? "rotate-180" : ""} />
            {expanded ? "Zwiń pełny podgląd" : "Pokaż pełny podgląd"}
          </button>

          {expanded ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <NeutralPreviewColumn label="Przed (pełne)" value={before} placeholder="brak zapisu" full />
              <NeutralPreviewColumn label="Po (pełne)" value={after} placeholder="—" full />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function NeutralPreviewColumn({
  label,
  value,
  placeholder,
  full = false,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  full?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
        {label}
      </p>
      {value ? (
        <pre
          className={[
            "overflow-auto rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-[#334155] dark:border-[#334155] dark:bg-[#0b1220] dark:text-[#cbd5e1]",
            full ? "max-h-56" : "max-h-24",
          ].join(" ")}
        >
          {value}
        </pre>
      ) : (
        <span className="italic text-[#94a3b8] dark:text-[#64748b]">{placeholder}</span>
      )}
    </div>
  );
}

function AuditScalarValueCell({
  value,
  tone,
  placeholder,
}: {
  value: string | null;
  tone: "before" | "after";
  placeholder: string;
}) {
  if (!value) {
    return (
      <span className="italic text-[#94a3b8] dark:text-[#64748b]">{placeholder}</span>
    );
  }

  const isMultiline = value.includes("\n");

  return (
    <span
      className={[
        "block wrap-break-word rounded-md border px-2 py-1 font-mono text-[11px] leading-relaxed",
        tone === "before"
          ? "border-[#fecaca] bg-[#fef2f2] text-[#991b1b] line-through decoration-[#fca5a5]/80 dark:border-[#7f1d1d] dark:bg-[#2a1111] dark:text-[#fca5a5]"
          : "border-[#bbf7d0] bg-[#f0fdf4] font-semibold text-[#166534] dark:border-[#14532d] dark:bg-[#0f2416] dark:text-[#86efac]",
        isMultiline ? "max-h-32 overflow-auto whitespace-pre-wrap" : "whitespace-pre-wrap",
      ].join(" ")}
      title={value.length > 120 ? value : undefined}
    >
      {value}
    </span>
  );
}
