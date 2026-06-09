/** Strip Polish diacritics and produce a URL-safe slug. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Format an ISO date string in Polish long form. */
export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Generate a random ID with an optional prefix. */
export function generateId(prefix = "id"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** True when user input is empty or contains only whitespace. */
export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/** Accept only absolute http/https URLs for external links. */
export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** Accept app-internal links like "/baza-wiedzy" without spaces. */
export function isValidInternalPath(value: string): boolean {
  return value.startsWith("/") && !/\s/.test(value);
}

// ── TipTap JSON utilities ─────────────────────────────────────────────────────

const BLOCK_TYPES = [
  "paragraph", "heading", "listItem", "blockquote", "codeBlock",
  "tableCell", "tableHeader",
];

/** Extract plain text from a TipTap JSON document node. */
export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  const children = (n.content ?? []).map(extractPlainText).join("");
  if (n.type && BLOCK_TYPES.includes(n.type)) return children + "\n";
  return children;
}

// ── Clipboard ─────────────────────────────────────────────────────────────────

/** Copy text to clipboard, falling back to execCommand for older browsers. */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}
