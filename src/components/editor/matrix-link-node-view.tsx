import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ChevronUp, ChevronDown, Trash2, GitBranch } from "lucide-react";

/**
 * Editor-mode React NodeView for the matrixLink block node.
 * Renders a styled card inside the editor with move-up/move-down/delete controls.
 * Uses snapshotted attrs for display (no live data lookup needed).
 */
export default function MatrixLinkNodeView({
  node,
  editor,
  getPos,
  deleteNode,
}: NodeViewProps) {
  const { entryTitle, entryCategory, entryDepartment, entrySla } = node.attrs as {
    entryTitle: string | null;
    entryCategory: string | null;
    entryDepartment: string | null;
    entrySla: number | null;
  };

  function moveUp() {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (pos === undefined) return;
    const { doc, tr } = editor.state;
    const $pos = doc.resolve(pos);
    const prevNode = $pos.nodeBefore;
    if (!prevNode) return;
    const prevStart = pos - prevNode.nodeSize;
    const newTr = tr.delete(pos, pos + node.nodeSize).insert(prevStart, node);
    editor.view.dispatch(newTr);
  }

  function moveDown() {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (pos === undefined) return;
    const { doc, tr } = editor.state;
    const afterNode = pos + node.nodeSize;
    const $after = doc.resolve(afterNode);
    const nextNode = $after.nodeAfter;
    if (!nextNode) return;
    // Delete current first, then insert after what is now the next node at `pos`
    const newTr = tr
      .delete(pos, pos + node.nodeSize)
      .insert(pos + nextNode.nodeSize, node);
    editor.view.dispatch(newTr);
  }

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        data-drag-handle
        className="my-3 flex items-start gap-3 rounded-xl border border-[#1d4f91]/25 bg-[#f0f5ff] px-4 py-3 select-none"
      >
        {/* Icon */}
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1d4f91]/10">
          <GitBranch size={15} className="text-[#1d4f91]" />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#1d4f91]/60">
              Powiązanie z macierzą
            </span>
            {entrySla !== null && (
              <span className="rounded-full bg-[#1d4f91]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1d4f91]">
                Czas realizacji: {entrySla} dni
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm font-semibold text-[#0f172a]">
            {entryTitle ?? <span className="italic text-[#9ca3af]">Nieznana pozycja macierzy</span>}
          </p>
          {(entryCategory || entryDepartment) && (
            <p className="mt-0.5 text-xs text-[#64748b]">
              {[entryCategory, entryDepartment].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            title="Przesuń w górę"
            onMouseDown={(e) => { e.preventDefault(); moveUp(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#64748b] hover:bg-[#1d4f91]/10 hover:text-[#1d4f91]"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            title="Przesuń w dół"
            onMouseDown={(e) => { e.preventDefault(); moveDown(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#64748b] hover:bg-[#1d4f91]/10 hover:text-[#1d4f91]"
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            title="Usuń blok"
            onMouseDown={(e) => { e.preventDefault(); deleteNode(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#64748b] hover:bg-[#fee2e2] hover:text-[#ef4444]"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
