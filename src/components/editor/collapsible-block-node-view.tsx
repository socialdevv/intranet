import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ChevronDown, Trash2 } from "lucide-react";

export default function CollapsibleBlockNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const title = (node.attrs.title as string) ?? "";

  return (
    <NodeViewWrapper>
      <div
        className={[
          "my-3 overflow-hidden rounded-xl border bg-white",
          selected
            ? "border-[#1d4f91] ring-2 ring-[#1d4f91]/20"
            : "border-[#d1d5db]",
        ].join(" ")}
      >
        {/* Header / title row */}
        <div className="flex items-center gap-2 border-b border-[#e5e7eb] bg-[#f8fafc] px-3 py-2">
          <ChevronDown size={14} className="shrink-0 text-[#6b7280]" />
          <input
            type="text"
            placeholder="Tytuł sekcji rozwijanej…"
            value={title}
            onKeyDown={(e) => e.stopPropagation()}
            onChange={(e) => updateAttributes({ title: e.target.value })}
            className="flex-1 bg-transparent text-sm font-semibold text-[#0f172a] placeholder-[#9ca3af] outline-none"
          />
          <button
            type="button"
            title="Usuń blok rozwijany"
            onMouseDown={(e) => {
              e.preventDefault();
              deleteNode();
            }}
            className="shrink-0 rounded p-0.5 text-[#9ca3af] transition hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Editable content area */}
        <div className="px-4 py-3">
          <NodeViewContent className="outline-none" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
