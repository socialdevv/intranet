import { Extension } from "@tiptap/core";

/** Block-level tags treated as paragraph containers when they only contain inline content. */
const BLOCK_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "MAIN", "ASIDE", "HEADER", "FOOTER", "NAV"]);
const INLINE_TAGS = new Set(["SPAN", "A", "B", "STRONG", "I", "EM", "U", "S", "STRIKE", "CODE", "SMALL", "SUP", "SUB", "MARK", "FONT"]);

function hasBlockChild(el: Element): boolean {
  for (const child of Array.from(el.children)) {
    if (!INLINE_TAGS.has(child.tagName)) return true;
  }
  return false;
}

export function sanitizePastedHtml(rawHtml: string): string {
  // 1. Strip common Word/Office noise before DOM parsing.
  let html = rawHtml
    .replace(/<!--\[if[\s\S]*?\]>([\s\S]*?)<!\ \[endif\]-->/gi, "$1")
    .replace(/<!--[^>]*-->/g, "")
    .replace(/<\/?(?:o|w|v|m|x):[a-z][^>]*>/gi, "")
    .replace(/\bmso-[\w-]+\s*:[^;"']*(;|(?=["']))/gi, "")
    .replace(/@font-face\s*\{[^}]*\}/gi, "")
    .replace(/((?:&nbsp;|\u00a0){2,})/gi, " ");

  const wrap = document.createElement("div");
  wrap.innerHTML = html;

  // 2. Promote inline style emphasis to semantic tags.
  wrap.querySelectorAll("*").forEach((el) => {
    const s = (el as HTMLElement).style;
    if (!s) return;

    const wrapWith = (tag: string) => {
      const sem = document.createElement(tag);
      while (el.firstChild) sem.appendChild(el.firstChild);
      el.appendChild(sem);
    };

    if (/^bold(er)?$|^[6-9]00$/.test(s.fontWeight)) {
      s.fontWeight = "";
      wrapWith("strong");
    }
    if (s.fontStyle === "italic") {
      s.fontStyle = "";
      wrapWith("em");
    }
    if (s.textDecoration?.includes("underline")) {
      s.textDecoration = s.textDecoration.replace("underline", "").trim() || "";
      if (el.tagName !== "A") wrapWith("u");
    }
  });

  // 3. Collapse block wrappers containing only inline content.
  wrap.querySelectorAll([...BLOCK_TAGS].join(",")).forEach((el) => {
    if (hasBlockChild(el)) return;
    const p = document.createElement("p");
    while (el.firstChild) p.appendChild(el.firstChild);
    el.replaceWith(p);
  });

  // 4. Normalize deep heading levels to h3 max.
  wrap.querySelectorAll("h4,h5,h6").forEach((el) => {
    const h3 = document.createElement("h3");
    h3.innerHTML = el.innerHTML;
    el.replaceWith(h3);
  });

  // 5. Strip unsafe attributes while preserving minimal styling for TipTap.
  wrap.querySelectorAll("*").forEach((el) => {
    const saved: Record<string, string> = {};

    for (const attr of Array.from(el.attributes)) {
      const n = attr.name;
      if (n === "href" && el.tagName === "A") {
        const v = attr.value.trim();
        if (/^https?:\/\/|^mailto:/i.test(v)) saved.href = v;
      } else if (n === "style") {
        const s = (el as HTMLElement).style;
        if (s.color) saved._color = s.color;
        if (s.fontSize) saved._fontSize = s.fontSize;
      }
    }

    Array.from(el.attributes).forEach((a) => el.removeAttribute(a.name));
    if (saved.href) el.setAttribute("href", saved.href);
    const hs = (el as HTMLElement).style;
    if (saved._color) hs.color = saved._color;
    if (saved._fontSize) hs.fontSize = saved._fontSize;
  });

  // 6. Replace deprecated font tags with spans.
  wrap.querySelectorAll("font").forEach((font) => {
    const span = document.createElement("span");
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
  });

  // 7. Collapse repeated <br> runs into paragraph breaks.
  let out = wrap.innerHTML;
  out = out.replace(/((?:\s*<br\s*\/?>){2,})/gi, "</p><p>");

  const wrap2 = document.createElement("div");
  wrap2.innerHTML = out;

  // 8. Remove empty wrappers and empty block artifacts.
  wrap2.querySelectorAll("span").forEach((span) => {
    if (!span.hasAttributes()) span.replaceWith(...Array.from(span.childNodes));
  });

  wrap2.querySelectorAll("p,li").forEach((el) => {
    if (el.textContent?.replace(/\u00a0/g, " ").trim() === "" && !el.querySelector("img,table,br")) {
      el.remove();
    }
  });

  return wrap2.innerHTML;
}

/**
 * Convert clipboard plain text into TipTap block nodes while preserving structure.
 */
export function plainTextToNodes(raw: string): object[] {
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = text.split("\n");

  const lines: string[] = [];
  let blankRun = 0;
  for (const line of rawLines) {
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun === 1) lines.push(line);
    } else {
      blankRun = 0;
      lines.push(line);
    }
  }

  const BULLET_RE = /^[\-\u2022\u2013\u2014\*]\s+([\s\S]*)$/;

  const nodes: object[] = [];
  let bulletBuffer: string[] = [];

  function flushBullets() {
    if (!bulletBuffer.length) return;
    nodes.push({
      type: "bulletList",
      content: bulletBuffer.map((itemText) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: itemText ? [{ type: "text", text: itemText }] : [],
          },
        ],
      })),
    });
    bulletBuffer = [];
  }

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    const bulletMatch = trimmed.match(BULLET_RE);
    if (bulletMatch) {
      bulletBuffer.push(bulletMatch[1].trim());
      continue;
    }
    flushBullets();
    nodes.push({
      type: "paragraph",
      content: trimmed ? [{ type: "text", text: trimmed }] : [],
    });
  }
  flushBullets();

  while (nodes.length > 0) {
    const n = nodes[0] as { type: string; content?: unknown[] };
    if (n.type === "paragraph" && (!n.content || n.content.length === 0)) nodes.shift();
    else break;
  }
  while (nodes.length > 0) {
    const n = nodes[nodes.length - 1] as { type: string; content?: unknown[] };
    if (n.type === "paragraph" && (!n.content || n.content.length === 0)) nodes.pop();
    else break;
  }

  return nodes.length ? nodes : [{ type: "paragraph", content: [] }];
}

/**
 * Handles Ctrl/Cmd+Shift+V by inserting plain text as structured TipTap content.
 */
export const PlainTextPasteExtension = Extension.create({
  name: "plainTextPaste",
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-v": () => {
        const { editor } = this;
        navigator.clipboard
          .readText()
          .then((text) => {
            if (!text) return;
            const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
            if (!normalized.includes("\n")) {
              editor.chain().focus().insertContent(normalized).run();
            } else {
              editor.chain().focus().insertContent(plainTextToNodes(normalized)).run();
            }
          })
          .catch(() => {
            // Clipboard access denied.
          });
        return true;
      },
    };
  },
});
