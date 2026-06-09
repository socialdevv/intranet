import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GripVertical } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { adminLinkEditorPath } from "@/lib/routes";
import { resolveIcon } from "@/lib/utils/link-icons";
import type { LinkItem } from "@/lib/types/domain";

export default function LinksManager() {
  const { links, linksModule } = useData();
  const { push: pushToast } = useToast();
  const {
    isLoading,
    isMutating,
    error,
    canWrite,
    canReorder,
    removeLink,
    reorderLinks: applyLinkOrder,
  } = linksModule;
  const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

  const draggingIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  function onDragStart(idx: number) {
    draggingIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, idx: number) {
    if (!canReorder) {
      return;
    }

    e.preventDefault();
    const from = draggingIdx.current;
    if (from === null || from === idx) {
      draggingIdx.current = null;
      setOverIdx(null);
      return;
    }
    const next = [...sorted];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    applyLinkOrder(next);
    draggingIdx.current = null;
    setOverIdx(null);
  }

  function onDragEnd() {
    draggingIdx.current = null;
    setOverIdx(null);
  }

  async function handleDelete(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }

    try {
      await removeLink(id);
      pushToast(
        "success",
        "Link został usunięty."
      );
      setPendingDelete(null);
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się usunąć linku."
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Linki</h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            {sorted.length} {sorted.length === 1 ? "link" : "linków"} • {canReorder ? "przeciągnij wiersze, aby zmienić kolejność wyświetlania." : "kolejność pozostaje tymczasowo tylko do odczytu."}
          </p>
        </div>
        {canWrite && (
          <Link
            to={adminLinkEditorPath("nowy")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580]"
          >
            <PlusIcon />
            Dodaj link
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] py-14 text-center text-sm text-[#5f6f86] dark:border-[#334155] dark:bg-[#1a2535] dark:text-[#9fb3cc]">
          Ładowanie linków…
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-14 text-center dark:border-[#334155] dark:bg-[#1a2535]">
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak linków. Dodaj pierwszy link.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((link, idx) => (
            <LinkRow
              key={link.id}
              link={link}
              idx={idx}
              isOver={overIdx === idx}
              isPendingDelete={pendingDelete === link.id}
              canReorder={canReorder}
              busy={isMutating}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onDelete={() => {
                void handleDelete(link.id);
              }}
              onCancelDelete={() => setPendingDelete(null)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LinkRow({
  link,
  idx,
  isOver,
  isPendingDelete,
  canReorder,
  busy,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onDelete,
  onCancelDelete,
}: {
  link: LinkItem;
  idx: number;
  isOver: boolean;
  isPendingDelete: boolean;
  canReorder: boolean;
  busy: boolean;
  onDragStart: (idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  return (
    <div
      draggable={canReorder && !busy}
      onDragStart={() => {
        if (canReorder && !busy) {
          onDragStart(idx);
        }
      }}
      onDragOver={(e) => {
        if (canReorder && !busy) {
          onDragOver(e, idx);
        }
      }}
      onDrop={(e) => {
        if (canReorder && !busy) {
          onDrop(e, idx);
        }
      }}
      onDragEnd={onDragEnd}
      className={[
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition",
        canReorder && !busy ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isOver
          ? "border-[#1d4f91] bg-[#edf3fa] dark:bg-[#1e3a5f]"
          : "border-[#e5e7eb] bg-white hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#1e293b] dark:hover:bg-[#263347]",
      ].join(" ")}
    >
      <GripVertical size={14} className="shrink-0 text-[#c4cdd8]" />

      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
        {resolveIcon(link.icon)}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">{link.title}</p>
        <p className="truncate text-xs text-[#94a3b8]">{link.url}</p>
      </div>

      {/* Badges */}
      <div className="hidden shrink-0 gap-1.5 sm:flex">
        {link.isInternal && (
          <span className="rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[10px] font-medium text-[#4f46e5] dark:bg-[#1e1b4b] dark:text-[#a5b4fc]">
            wewnętrzny
          </span>
        )}
        {link.openInNewTab && !link.isInternal && (
          <span className="rounded-full bg-[#f0fdf4] px-2 py-0.5 text-[10px] font-medium text-[#16a34a] dark:bg-[#14532d] dark:text-[#86efac]">
            nowa karta
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Link
          to={adminLinkEditorPath(link.id)}
          className="rounded-lg border border-[#d9e2ec] bg-white px-2.5 py-1.5 text-xs font-medium text-[#374151] transition hover:border-[#94a3b8] dark:border-[#334155] dark:bg-[#263347] dark:text-[#cbd5e1]"
          onClick={(e) => e.stopPropagation()}
        >
          Edytuj
        </Link>
        {isPendingDelete ? (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onDelete}
              className="rounded-lg bg-[#ef4444] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#dc2626]"
            >
              Potwierdź
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCancelDelete}
              className="rounded-lg border border-[#d9e2ec] px-2.5 py-1.5 text-xs font-medium text-[#64748b] transition hover:border-[#94a3b8] dark:border-[#334155]"
            >
              Anuluj
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="rounded-lg border border-[#fca5a5] px-2.5 py-1.5 text-xs font-medium text-[#ef4444] transition hover:bg-[#fef2f2]"
          >
            Usuń
          </button>
        )}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
