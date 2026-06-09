import { useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useDragSort } from "@/hooks/useDragSort";
import { DragRow } from "./drag-row";
import type { MatrixDecision } from "@/lib/types/domain";

// ── Shared matrix category section used by matrix-entry-list and order-manager ──

export function MatrixCategorySection({
  categoryName,
  entries,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
}: {
  categoryName: string;
  entries: MatrixDecision[];
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { reorderMatrixInCategory } = useData();
  const [open, setOpen] = useState(false);

  const sorted = [...entries].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort<MatrixDecision>(
    sorted,
    (reordered) => reorderMatrixInCategory(categoryName, reordered)
  );

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="font-semibold text-[#0f172a]">{categoryName}</span>
          <span className="ml-2 text-xs text-[#94a3b8]">
            {entries.length === 1 ? "1 wpis" : entries.length <= 4 ? `${entries.length} wpisy` : `${entries.length} wpisów`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Przesuń kategorię w górę"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Przesuń kategorię w dół"
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#374151]"
            aria-label={open ? "Zwiń" : "Rozwiń wpisy"}
          >
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[#f1f5f9] px-3 pb-3 pt-2">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
            Kolejność wpisów (przeciągnij)
          </p>
          {sorted.length === 0 ? (
            <p className="text-xs text-[#c4cdd8]">Brak wpisów.</p>
          ) : (
            <div className="space-y-1">
              {sorted.map((entry, idx) => (
                <DragRow
                  key={entry.id}
                  idx={idx}
                  label={entry.subcategory}
                  isOver={overIdx === idx}
                  onDragStart={onDragStart}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragEnd={onDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
