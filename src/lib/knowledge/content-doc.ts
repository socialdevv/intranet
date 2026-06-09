import type { DocBlock, DocSection, InlineSegment, RichText } from "@/lib/types/domain";

export type TipTapMark = {
  type: string;
  attrs?: Record<string, unknown>;
};

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
};

export type TipTapDoc = {
  type: "doc";
  content: unknown[];
};

export const EMPTY_TIPTAP_DOC: TipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function textNode(text: string, marks?: TipTapMark[]): TipTapNode {
  if (!marks?.length) {
    return { type: "text", text };
  }
  return { type: "text", text, marks };
}

function paragraphNode(content?: TipTapNode[]): TipTapNode {
  if (!content || content.length === 0) {
    return { type: "paragraph" };
  }
  return { type: "paragraph", content };
}

export function isTipTapDoc(value: unknown): value is TipTapDoc {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; content?: unknown };
  return candidate.type === "doc" && Array.isArray(candidate.content);
}

export function plainTextToTipTapDoc(text: string): TipTapDoc {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return EMPTY_TIPTAP_DOC;
  }

  const content = normalized
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line ? paragraphNode([textNode(line)]) : paragraphNode()));

  return {
    type: "doc",
    content: content.length > 0 ? content : EMPTY_TIPTAP_DOC.content,
  };
}

export function coerceTipTapDoc(value: unknown, fallbackPlainText?: string): TipTapDoc {
  if (isTipTapDoc(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    return plainTextToTipTapDoc(value);
  }

  if (fallbackPlainText && fallbackPlainText.trim()) {
    return plainTextToTipTapDoc(fallbackPlainText);
  }

  return EMPTY_TIPTAP_DOC;
}

function legacySegmentToNode(segment: InlineSegment): TipTapNode {
  if (segment.type === "text") {
    return textNode(segment.text);
  }

  if (segment.type === "internal_link") {
    return textNode(segment.label || "Artykul", [
      {
        type: "internalLink",
        attrs: {
          entityType: "article",
          entityId: segment.pageId,
          labelSnapshot: segment.label || null,
          hrefSnapshot: null,
        },
      },
    ]);
  }

  return textNode(segment.label || "Pozycja macierzy");
}

function legacyRichTextToInlineNodes(richText: RichText): TipTapNode[] {
  return richText
    .map(legacySegmentToNode)
    .filter((node) => node.type === "text" && typeof node.text === "string" && node.text.length > 0);
}

function legacyBlockToNode(block: DocBlock): TipTapNode {
  if (block.type === "paragraph") {
    return paragraphNode(legacyRichTextToInlineNodes(block.content));
  }

  if (block.type === "list") {
    return {
      type: "bulletList",
      content: block.items.map((item) => ({
        type: "listItem",
        content: [paragraphNode(legacyRichTextToInlineNodes(item))],
      })),
    };
  }

  const headerCells = block.headers.map((header) => ({
    type: "tableHeader",
    content: [paragraphNode([textNode(header)])],
  }));

  const bodyRows = block.rows.map((row) => ({
    type: "tableRow",
    content: row.map((cell) => ({
      type: "tableCell",
      content: [paragraphNode([textNode(cell)])],
    })),
  }));

  return {
    type: "table",
    content: [
      {
        type: "tableRow",
        content: headerCells,
      },
      ...bodyRows,
    ],
  };
}

export function legacySectionToTipTapDoc(section: DocSection): TipTapDoc {
  const blocks = section.blocks ?? [];
  if (blocks.length === 0) {
    return EMPTY_TIPTAP_DOC;
  }

  const nodes = blocks.map(legacyBlockToNode);
  return {
    type: "doc",
    content: nodes.length > 0 ? nodes : EMPTY_TIPTAP_DOC.content,
  };
}

export function sectionToTipTapDoc(section: DocSection): TipTapDoc {
  if (isTipTapDoc(section.jsonContent)) {
    return section.jsonContent;
  }
  return legacySectionToTipTapDoc(section);
}

export function migrateSectionJsonContent(section: DocSection): DocSection {
  if (isTipTapDoc(section.jsonContent)) {
    return section;
  }
  return {
    ...section,
    jsonContent: legacySectionToTipTapDoc(section),
  };
}
