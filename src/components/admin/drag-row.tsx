import { GripVertical } from "lucide-react";

// ── Shared draggable row used by article-list, matrix-entry-list, and order-manager ──

export function DragRow({
  idx,
  label,
  sublabel,
  isOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  idx: number;
  label: string;
  sublabel?: string;
  isOver: boolean;
  onDragStart: (i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDrop: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(idx)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDrop={(e) => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      className={[
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors cursor-grab active:cursor-grabbing",
        isOver
          ? "border-[#1d4f91] bg-[#e8edf5]"
          : "border-[#e5e7eb] bg-white hover:bg-[#f8fafc]",
      ].join(" ")}
    >
      <GripVertical size={14} className="shrink-0 text-[#c4cdd8]" />
      <div className="min-w-0 flex-1">
        <span className="truncate font-medium text-[#0f172a]">{label}</span>
        {sublabel && (
          <span className="ml-2 text-xs text-[#94a3b8]">{sublabel}</span>
        )}
      </div>
      <span className="shrink-0 text-xs text-[#c4cdd8]">{idx + 1}</span>
    </div>
  );
}
