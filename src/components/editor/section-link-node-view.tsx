import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { ChevronUp, ChevronDown, Trash2, ExternalLink, BookOpen, MessageSquare, FileText } from "lucide-react";
import { buildSectionAnchorId } from "@/lib/knowledge/section-anchors";

type LinkType = "url" | "article" | "category" | "subcategory" | "komunikat" | "template";

const TYPE_META: Record<LinkType, {
  icon: React.ReactNode;
  typeLabel: string;
  borderCls: string;
  bgCls: string;
  textCls: string;
}> = {
  url: {
    icon: <ExternalLink size={13} />,
    typeLabel: "Zewnętrzny link",
    borderCls: "border-[#bfdbfe]",
    bgCls: "bg-[#eff6ff]",
    textCls: "text-[#1d4f91]",
  },
  article: {
    icon: <BookOpen size={13} />,
    typeLabel: "Artykuł w bazie wiedzy",
    borderCls: "border-[#bbf7d0]",
    bgCls: "bg-[#f0fdf4]",
    textCls: "text-[#15803d]",
  },
  category: {
    icon: <BookOpen size={13} />,
    typeLabel: "Kategoria",
    borderCls: "border-[#bae6fd]",
    bgCls: "bg-[#f0f9ff]",
    textCls: "text-[#0369a1]",
  },
  subcategory: {
    icon: <BookOpen size={13} />,
    typeLabel: "Podkategoria",
    borderCls: "border-[#c7d2fe]",
    bgCls: "bg-[#eef2ff]",
    textCls: "text-[#4338ca]",
  },
  komunikat: {
    icon: <MessageSquare size={13} />,
    typeLabel: "Komunikat",
    borderCls: "border-[#fde68a]",
    bgCls: "bg-[#fffbeb]",
    textCls: "text-[#92400e]",
  },
  template: {
    icon: <FileText size={13} />,
    typeLabel: "Szablon wiadomości",
    borderCls: "border-[#e9d5ff]",
    bgCls: "bg-[#faf5ff]",
    textCls: "text-[#7c3aed]",
  },
};

export default function SectionLinkNodeView({
  node,
  editor,
  getPos,
  deleteNode,
}: NodeViewProps) {
  const {
    linkType,
    label,
    url,
    articleSlug,
    articleCategorySlug,
    articleSectionId,
    articleSectionTitle,
    categorySlug,
    komunikatId,
    templateId,
    templateChannel,
  } = node.attrs as {
    linkType: LinkType;
    label: string | null;
    url: string | null;
    articleSlug: string | null;
    articleCategorySlug: string | null;
    articleSectionId: string | null;
    articleSectionTitle: string | null;
    categorySlug: string | null;
    komunikatId: string | null;
    templateId: string | null;
    templateChannel: string | null;
  };

  const meta = TYPE_META[linkType] ?? TYPE_META.url;

  function targetHint(): string {
    if (linkType === "url") {
      try { return new URL(url ?? "").hostname; } catch { return url ?? "—"; }
    }
    if (linkType === "article") {
      if (!articleCategorySlug || !articleSlug) return "—";
      const base = `/${articleCategorySlug}/${articleSlug}`;
      if (!articleSectionId) return base;
      return `${base}#${buildSectionAnchorId(articleSectionId)}`;
    }
    if (linkType === "category" || linkType === "subcategory") {
      const slug = categorySlug || articleCategorySlug;
      return slug ? `/kategoria/${slug}` : "—";
    }
    if (linkType === "template") {
      if (templateChannel) return templateChannel;
      if (templateId) return templateId.slice(0, 14) + "\u2026";
      return "\u2014";
    }
    return komunikatId ? komunikatId.slice(0, 14) + "…" : "—";
  }

  function moveUp() {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (pos === undefined) return;
    const { doc, tr } = editor.state;
    const $pos = doc.resolve(pos);
    const prevNode = $pos.nodeBefore;
    if (!prevNode) return;
    const prevStart = pos - prevNode.nodeSize;
    editor.view.dispatch(tr.delete(pos, pos + node.nodeSize).insert(prevStart, node));
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
    editor.view.dispatch(
      tr.delete(pos, pos + node.nodeSize).insert(pos + nextNode.nodeSize, node)
    );
  }

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        data-drag-handle
        className={`my-1 inline-flex min-w-50 max-w-65 items-center gap-2.5 rounded-xl border ${meta.borderCls} ${meta.bgCls} px-3 py-2 select-none`}
      >
        {/* Icon */}
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 border ${meta.borderCls} ${meta.textCls}`}>
          {meta.icon}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${meta.textCls} opacity-70`}>
            {meta.typeLabel}
          </p>
          <p className="truncate text-sm font-medium leading-snug text-[#111827]">
            {label || <span className="italic text-[#9ca3af]">Bez etykiety</span>}
          </p>
          <p className="truncate text-[10px] text-[#94a3b8]">{targetHint()}</p>
          {linkType === "article" && articleSectionTitle && (
            <p className="truncate text-[10px] text-[#64748b]">Sekcja: {articleSectionTitle}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            title="Przesuń w górę"
            onMouseDown={(e) => { e.preventDefault(); moveUp(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#64748b] hover:bg-white/70 hover:text-[#374151]"
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            title="Przesuń w dół"
            onMouseDown={(e) => { e.preventDefault(); moveDown(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#64748b] hover:bg-white/70 hover:text-[#374151]"
          >
            <ChevronDown size={13} />
          </button>
          <button
            type="button"
            title="Usuń blok"
            onMouseDown={(e) => { e.preventDefault(); deleteNode(); }}
            className="flex h-6 w-6 items-center justify-center rounded text-[#f87171] hover:bg-red-100 hover:text-[#dc2626]"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}
