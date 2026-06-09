const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
  "codeBlock",
  "tableCell",
  "tableHeader",
];

type TipTapLikeMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

type TipTapLikeNode = {
  type?: string;
  text?: string;
  content?: unknown[];
  marks?: TipTapLikeMark[];
};

type SelectionClipboardPayload = {
  text: string;
  html: string;
};

const NO_COPY_SELECTOR = '[data-no-copy="true"]';

function hasNoCopyMark(marks?: TipTapLikeMark[]): boolean {
  if (!marks?.length) return false;
  return marks.some((mark) => {
    if (!mark || typeof mark !== "object") return false;
    if (mark.type === "noCopyInline") return true;
    const attrFlag = mark.attrs?.["data-no-copy"];
    return attrFlag === true || attrFlag === "true" || attrFlag === "1";
  });
}

function normalizeClipboardPlainText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{2,}/g, (m) => (m.length >= 3 ? "\n\n" : "\n"))
    .trim();
}

function textFromNodeWithoutNoCopy(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as TipTapLikeNode;

  if (n.type === "text") {
    if (hasNoCopyMark(n.marks)) return "";
    return n.text ?? "";
  }

  if (n.type === "hardBreak") return "\n";

  const children = (n.content ?? []).map(textFromNodeWithoutNoCopy).join("");
  if (n.type && BLOCK_TYPES.includes(n.type)) return children + "\n";
  return children;
}

function selectionIntersectsScope(selection: Selection, scope?: HTMLElement | null): boolean {
  if (!scope) return true;
  const anchorInScope = selection.anchorNode ? scope.contains(selection.anchorNode) : false;
  const focusInScope = selection.focusNode ? scope.contains(selection.focusNode) : false;
  return anchorInScope || focusInScope;
}

export function extractCopyablePlainText(node: unknown): string {
  return textFromNodeWithoutNoCopy(node);
}

export function buildSelectionClipboardPayload(
  selection: Selection | null,
  scope?: HTMLElement | null
): SelectionClipboardPayload | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  if (!selectionIntersectsScope(selection, scope)) return null;

  const container = document.createElement("div");
  for (let i = 0; i < selection.rangeCount; i += 1) {
    container.appendChild(selection.getRangeAt(i).cloneContents());
  }
  container.querySelectorAll(NO_COPY_SELECTOR).forEach((el) => el.remove());

  const measurementHost = document.createElement("div");
  measurementHost.style.cssText =
    "position:fixed;left:-99999px;top:-99999px;opacity:0;pointer-events:none;white-space:normal;";
  measurementHost.appendChild(container.cloneNode(true));
  document.body.appendChild(measurementHost);
  const raw = measurementHost.innerText || measurementHost.textContent || "";
  document.body.removeChild(measurementHost);

  const text = normalizeClipboardPlainText(raw);
  if (!text) return null;

  const html = container.innerHTML;
  return { text, html: html || `<div>${text.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>")}</div>` };
}
