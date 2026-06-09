import type {
  CennikSection,
  CennikTableSection,
  CennikChargesSection,
} from "@/lib/types/domain";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtVal(v: string | undefined): string {
  return v?.trim() || "—";
}

// ── Standard table renderer ───────────────────────────────────────────────────

function TableSectionBlock({ section }: { section: CennikTableSection }) {
  const { columns, rows, footnotes } = section;

  // Detect fully-empty fixed columns (label / symbol) and dynamic columns.
  // A column is considered empty when every row has no non-whitespace value.
  const showLabel  = rows.some((r) => r.label.trim() !== "");
  const showSymbol = rows.some((r) => (r.symbol ?? "").trim() !== "");
  const visibleCols = columns.filter((col) =>
    rows.some((r) => (r.values[col.key] ?? "").trim() !== "")
  );

  const totalCols =
    (showLabel ? 1 : 0) + (showSymbol ? 1 : 0) + visibleCols.length;

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-[#0f172a]">{section.title}</h3>
        <span className="shrink-0 text-xs font-medium text-[#64748b]">{section.unit}</span>
      </div>
      {section.description && (
        <p className="mb-3 text-xs text-[#64748b]">{section.description}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[#f8fafc]">
              {showLabel && (
                <th className="border-b border-r border-[#e2e8f0] px-4 py-2.5 text-left text-xs font-semibold text-[#374151]">
                  Nazwa
                </th>
              )}
              {showSymbol && (
                <th className="border-b border-r border-[#e2e8f0] px-3 py-2.5 text-left text-xs font-semibold text-[#374151] w-16">
                  Symbol
                </th>
              )}
              {visibleCols.map((col, ci) => (
                <th
                  key={col.key}
                  className={`border-b border-[#e2e8f0] px-4 py-2.5 text-right text-xs font-semibold text-[#374151] whitespace-nowrap ${ci < visibleCols.length - 1 ? "border-r" : ""}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols || 1} className="px-4 py-5 text-center text-xs italic text-[#9ca3af]">
                  Brak danych.
                </td>
              </tr>
            ) : (
              rows.map((row, ri) => (
                <tr key={row.id} className={ri % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                  {showLabel && (
                    <td className="border-b border-r border-[#e2e8f0] px-4 py-3">
                      <div className="font-medium text-[#0f172a] leading-snug">{row.label}</div>
                      {row.unit && (
                        <div className="mt-0.5 text-[11px] font-semibold text-[#6b7280]">{row.unit}</div>
                      )}
                    </td>
                  )}
                  {showSymbol && (
                    <td className="border-b border-r border-[#e2e8f0] px-3 py-3 text-[12px] text-[#94a3b8] font-mono">
                      {row.symbol ?? ""}
                    </td>
                  )}
                  {visibleCols.map((col, ci) => (
                    <td
                      key={col.key}
                      className={`border-b border-[#e2e8f0] px-4 py-3 text-right font-mono text-sm tabular-nums text-[#0f172a] ${ci < visibleCols.length - 1 ? "border-r" : ""}`}
                    >
                      {fmtVal(row.values[col.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {footnotes && footnotes.length > 0 && (
        <ul className="mt-2 space-y-0.5 pl-1">
          {footnotes.map((fn, i) => (
            <li key={i} className="text-[11px] text-[#94a3b8]">* {fn}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Charges renderer ──────────────────────────────────────────────────────────

function ChargesSectionBlock({ section }: { section: CennikChargesSection }) {
  const { items, footnotes } = section;

  return (
    <div className="mb-8">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[#0f172a]">{section.title}</h3>
        {section.description && (
          <p className="mt-1 text-xs text-[#64748b]">{section.description}</p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-xs italic text-[#9ca3af]">Brak danych.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="overflow-hidden rounded-xl border border-[#e2e8f0] bg-white"
            >
              {/* Item header */}
              <div className="flex items-center justify-between gap-2 border-b border-[#e2e8f0] bg-[#f8fafc] px-4 py-2.5">
                <span className="text-sm font-semibold text-[#0f172a]">{item.name || "—"}</span>
                <span className="shrink-0 rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-medium text-[#1d4f91]">
                  {item.unit}
                </span>
              </div>

              {/* Variants */}
              {item.variants.length === 1 && !item.variants[0].conditions ? (
                // Single variant without conditions — just show the value prominently
                <div className="px-4 py-3 font-mono text-base font-bold text-[#0f172a] tabular-nums">
                  {fmtVal(item.variants[0].value)}
                </div>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {item.variants.map((v, vi) => (
                      <tr key={v.id} className={vi % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                        <td className="border-b border-r border-[#e2e8f0] px-4 py-2.5 text-xs text-[#374151]">
                          {v.conditions || "—"}
                        </td>
                        <td className="border-b border-[#e2e8f0] px-4 py-2.5 text-right font-mono text-sm tabular-nums font-semibold text-[#0f172a] w-28">
                          {fmtVal(v.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {footnotes && footnotes.length > 0 && (
        <ul className="mt-3 space-y-0.5 pl-1">
          {footnotes.map((fn, i) => (
            <li key={i} className="text-[11px] text-[#94a3b8]">* {fn}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Dispatcher (public API, same component name kept for compatibility) ───────

export default function CennikSectionTable({ section }: { section: CennikSection }) {
  if (section.type === "table") {
    return <TableSectionBlock section={section} />;
  }
  return <ChargesSectionBlock section={section} />;
}
