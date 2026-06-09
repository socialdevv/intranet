const SECTION_ANCHOR_PREFIX = "section-";
const APP_TOP_CHROME_SELECTOR = "[data-app-top-chrome]";
const DEFAULT_SECTION_SCROLL_GUTTER_PX = 12;

export function normalizeSectionAnchorToken(sectionId: string | null | undefined): string {
  if (!sectionId) return "";
  return sectionId
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9_.:-]/g, "");
}

export function buildSectionAnchorId(sectionId: string | null | undefined): string {
  const token = normalizeSectionAnchorToken(sectionId);
  return `${SECTION_ANCHOR_PREFIX}${token || "section"}`;
}

type SectionAnchorResolution = {
  sectionId: string | null;
  anchorId: string;
};

function normalizeComparableToken(value: string): string {
  return normalizeSectionAnchorToken(value).toLowerCase();
}

/**
 * Resolves a section reference token (raw section id or anchor id) to the
 * canonical anchor id used in the current article rendering.
 */
export function resolveSectionAnchorId(
  sectionRef: string | null | undefined,
  sectionIds: Array<string | null | undefined>,
): SectionAnchorResolution | null {
  const reference = (sectionRef ?? "").trim().replace(/^#/, "");
  if (!reference) return null;

  const normalizedReference = normalizeComparableToken(reference);
  const referenceToken = reference.startsWith(SECTION_ANCHOR_PREFIX)
    ? reference.slice(SECTION_ANCHOR_PREFIX.length)
    : null;
  const normalizedReferenceToken = referenceToken
    ? normalizeComparableToken(referenceToken)
    : "";

  for (const rawSectionId of sectionIds) {
    const sectionId = (rawSectionId ?? "").trim();
    if (!sectionId) continue;

    const anchorId = buildSectionAnchorId(sectionId);
    if (reference === sectionId || reference === anchorId) {
      return { sectionId, anchorId };
    }

    const normalizedSectionId = normalizeComparableToken(sectionId);
    const normalizedAnchorId = normalizeComparableToken(anchorId);
    if (
      normalizedReference === normalizedSectionId ||
      normalizedReference === normalizedAnchorId
    ) {
      return { sectionId, anchorId };
    }

    if (normalizedReferenceToken && normalizedReferenceToken === normalizedSectionId) {
      return { sectionId, anchorId };
    }

    if (sectionId.startsWith(SECTION_ANCHOR_PREFIX)) {
      const sectionIdToken = sectionId.slice(SECTION_ANCHOR_PREFIX.length);
      if (normalizeComparableToken(sectionIdToken) === normalizedReference) {
        return { sectionId, anchorId };
      }
    }
  }

  if (reference.startsWith(SECTION_ANCHOR_PREFIX)) {
    return { sectionId: null, anchorId: reference };
  }

  return { sectionId: null, anchorId: buildSectionAnchorId(reference) };
}

/**
 * Handles both plain hashes ("#section-...") and HashRouter-style
 * combined hashes ("#/path?x=y#section-...").
 */
export function extractSectionAnchorIdFromHash(hash: string): string | null {
  if (!hash) return null;
  const decoded = decodeURIComponent(hash);
  const direct = decoded.startsWith("#") ? decoded.slice(1) : decoded;
  if (direct.startsWith(SECTION_ANCHOR_PREFIX)) {
    return direct;
  }

  const nestedIdx = decoded.lastIndexOf(`#${SECTION_ANCHOR_PREFIX}`);
  if (nestedIdx >= 0) {
    return decoded.slice(nestedIdx + 1);
  }

  return null;
}

export function resolveSectionAnchorIdFromHash(
  hash: string,
  sectionIds: Array<string | null | undefined>,
): string | null {
  const extracted = extractSectionAnchorIdFromHash(hash);
  if (!extracted) return null;
  return resolveSectionAnchorId(extracted, sectionIds)?.anchorId ?? extracted;
}

function getTopChromeOffsetPx(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;

  const chromeNodes = document.querySelectorAll<HTMLElement>(APP_TOP_CHROME_SELECTOR);
  let maxBottom = 0;
  for (const node of chromeNodes) {
    const style = window.getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (style.position !== "sticky" && style.position !== "fixed") continue;

    const rect = node.getBoundingClientRect();
    if (rect.height <= 0 || rect.bottom <= 0 || rect.top > 1) continue;
    maxBottom = Math.max(maxBottom, rect.bottom);
  }

  return Math.max(0, Math.round(maxBottom));
}

type ScrollSectionAnchorIntoViewOptions = {
  behavior?: ScrollBehavior;
  extraOffsetPx?: number;
};

export function scrollSectionAnchorIntoView(
  anchorId: string | null | undefined,
  options?: ScrollSectionAnchorIntoViewOptions,
): boolean {
  const normalizedAnchorId = (anchorId ?? "").trim().replace(/^#/, "");
  if (!normalizedAnchorId) return false;

  const el = document.getElementById(normalizedAnchorId);
  if (!el) return false;

  if (el.tagName === "DETAILS") {
    (el as HTMLDetailsElement).open = true;
  }

  const topChromeOffsetPx = getTopChromeOffsetPx();
  const extraOffsetPx = options?.extraOffsetPx ?? DEFAULT_SECTION_SCROLL_GUTTER_PX;
  const targetTop = window.scrollY + el.getBoundingClientRect().top - topChromeOffsetPx - extraOffsetPx;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: options?.behavior ?? "smooth",
  });
  return true;
}
