import type {
  KnowledgeCategoryEntry,
  KnowledgePage,
  MatrixDecision,
  TextTemplate,
  CommunicationMessage,
  LinkItem,
  HomeQuickLink,
  ContactEntry,
  PhraseEntry,
  Cennik,
  OrgEntry,
} from "@/lib/types/domain";
import { ROUTES, knowledgeArticlePath, knowledgeCategoryPath, komunikatPath, tematOrgPath } from "@/lib/routes";
import { buildSectionAnchorId } from "@/lib/knowledge/section-anchors";

export type SearchResultItem = {
  id: string;
  type: "article" | "category" | "matrix" | "template" | "communication" | "link" | "quick_link" | "contact" | "phrase" | "cennik" | "org_topic";
  title: string;
  subtitle: string;
  href: string;
  /** When true, clicking should open href in a new tab rather than navigating in-app. */
  openInNewTab?: boolean;
  score: number;
};

// ── Scoring primitives ────────────────────────────────────────────────────────

/** Score how well a single query string matches a text field. */
function scoreField(q: string, text: string, weight: number): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t === q) return weight * 6;          // exact
  if (t.startsWith(q)) return weight * 3;  // prefix
  if (t.includes(q)) return weight;        // contains
  return 0;
}

/**
 * Score a field against the full query phrase AND each individual word.
 * Multi-word queries reward partial word hits at half weight.
 */
function score(query: string, text: string, weight: number): number {
  const q = query.toLowerCase();
  const full = scoreField(q, text, weight);
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return full;
  const wordSum = words.reduce((acc, w) => acc + scoreField(w, text, weight * 0.5), 0);
  return Math.max(full, wordSum);
}

/**
 * Score each item in an array individually and return only the best score.
 * Avoids inflating scores when multiple items are joined into a single string.
 */
function scoreBest(query: string, items: string[], weight: number): number {
  if (!items.length) return 0;
  return Math.max(...items.map((item) => score(query, item, weight)));
}

type SectionTagMatch = {
  sectionId: string;
  sectionTitle: string;
  matchedTag: string;
  score: number;
  anchorId: string;
};

function findBestSectionTagMatch(query: string, page: KnowledgePage): SectionTagMatch | null {
  let bestMatch: SectionTagMatch | null = null;

  for (const section of page.sections ?? []) {
    for (const rawTag of section.tags ?? []) {
      const tag = rawTag.trim();
      if (!tag) continue;
      const tagScore = score(query, tag, 6);
      if (tagScore <= 0) continue;
      if (bestMatch && bestMatch.score >= tagScore) continue;

      bestMatch = {
        sectionId: section.id,
        sectionTitle: section.title?.trim() || "Sekcja",
        matchedTag: tag,
        score: tagScore,
        anchorId: buildSectionAnchorId(section.id),
      };
    }
  }

  return bestMatch;
}

// ── Main search function ──────────────────────────────────────────────────────

export function searchAll(
  query: string,
  pages: KnowledgePage[],
  categories: KnowledgeCategoryEntry[],
  matrix: MatrixDecision[],
  templates: TextTemplate[],
  communications: CommunicationMessage[],
  links: LinkItem[],
  contacts: ContactEntry[],
  phrases: PhraseEntry[],
  cenniki: Cennik[],
  orgTopics: OrgEntry[],
  homeQuickLinks: HomeQuickLink[],
): SearchResultItem[] {
  const q = query.trim();
  if (!q || q.length < 2) return [];

  const results: SearchResultItem[] = [];

  // ── Articles ───────────────────────────────────────────────────────────────
  for (const page of pages) {
    const sectionTagMatch = findBestSectionTagMatch(q, page);
    const sectionTagScore = sectionTagMatch?.score ?? 0;
    const baseArticleHref = knowledgeArticlePath(page.category, page.slug);
    const baseSubtitle = page.categoryDisplayName ?? page.category;

    let s = 0;
    s += score(q, page.title, 10);
    s += score(q, (page.tags ?? []).join(" "), 7);
    s += sectionTagScore;
    s += score(q, (page.hiddenTags ?? []).join(" "), 4);
    if (s > 0) {
      results.push({
        id: page.id,
        type: "article",
        title: page.title,
        subtitle: sectionTagMatch
          ? `${baseSubtitle} · Sekcja: ${sectionTagMatch.sectionTitle} · Tag: ${sectionTagMatch.matchedTag}`
          : baseSubtitle,
        href: sectionTagMatch
          ? `${baseArticleHref}#${sectionTagMatch.anchorId}`
          : baseArticleHref,
        score: s,
      });
    }
  }

  // ── Categories ─────────────────────────────────────────────────────────────
  const catMap = new Map(categories.map((c) => [c.id, c]));
  for (const cat of categories) {
    let s = 0;
    s += score(q, cat.name, 10);
    if (s > 0) {
      const parent = cat.parentId ? catMap.get(cat.parentId) : null;
      results.push({
        id: cat.id,
        type: "category",
        title: cat.name,
        subtitle: parent ? `Podkategoria · ${parent.name}` : "Kategoria",
        href: knowledgeCategoryPath(cat.slug),
        score: s,
      });
    }
  }

  // ── Matrix entries ─────────────────────────────────────────────────────────
  for (const entry of matrix) {
    let s = 0;
    // Subcategory and category are the primary identifying labels — weight them heavily.
    s += score(q, entry.subcategory, 14);
    s += score(q, entry.category, 11);
    // Score each keyword individually (max); avoids joining inflating contains scores.
    s += scoreBest(q, entry.keywords ?? [], 7);
    if (s > 0) {
      results.push({
        id: entry.id,
        type: "matrix",
        title: entry.subcategory || entry.category,
        subtitle: `${entry.category} · Czas realizacji: ${entry.slaDays} dni`,
        href: `${ROUTES.matrix}?entry=${entry.id}`,
        score: s,
      });
    }
  }

  // ── Templates — title only (per design requirement) ───────────────────────
  for (const tpl of templates) {
    const s = score(q, tpl.title, 10);
    if (s > 0) {
      results.push({
        id: tpl.id,
        type: "template",
        title: tpl.title,
        subtitle: `Szablon · ${tpl.channel ?? ""}`.replace(/·\s*$/, "").trim(),
        href: `${ROUTES.szablony}?template=${encodeURIComponent(tpl.id)}`,
        score: s,
      });
    }
  }

  // ── Communications — title only (body is TipTap JSON, not searchable) ─────
  for (const kom of communications) {
    const s = score(q, kom.title, 10);
    if (s > 0) {
      results.push({
        id: kom.id,
        type: "communication",
        title: kom.title,
        subtitle: `Komunikat · ${kom.status === "active" ? "Aktywny" : "Archiwalny"}`,
        href: komunikatPath(kom.id),
        score: s,
      });
    }
  }

  // ── Links — title + description (opens actual destination directly) ────────
  for (const link of links) {
    let s = 0;
    s += score(q, link.title, 10);
    s += score(q, link.description, 5);
    if (s > 0) {
      results.push({
        id: link.id,
        type: "link",
        title: link.title,
        subtitle: link.description || link.url,
        href: link.url,
        openInNewTab: !link.isInternal && link.openInNewTab,
        score: s,
      });
    }
  }

  // ── Contacts — title, description, phone, email, address + detail table ──
  for (const contact of contacts) {
    // Collect searchable text from the structured detail table
    const sectionLabels: string[] = [];
    const groupItems: string[] = [];
    const groupActions: string[] = [];
    const t = contact.detailTable;
    if (t) {
      if (t.notes) groupItems.push(t.notes);
      for (const section of t.sections ?? []) {
        if (section.label) sectionLabels.push(section.label);
        for (const group of section.groups ?? []) {
          if (group.items) groupItems.push(group.items);
          if (group.action) groupActions.push(group.action);
        }
      }
    }

    let s = 0;
    s += score(q, contact.title, 10);
    s += score(q, contact.description, 6);
    s += score(q, contact.phone ?? "", 8);
    s += score(q, contact.email ?? "", 7);
    s += score(q, contact.address ?? "", 5);
    s += score(q, sectionLabels.join(" "), 5);
    s += score(q, groupItems.join(" "), 4);
    s += score(q, groupActions.join(" "), 4);

    if (s > 0) {
      results.push({
        id: contact.id,
        type: "contact",
        title: contact.title,
        subtitle: contact.description || (contact.phone ?? contact.email ?? "Dane kontaktowe"),
        href: `${ROUTES.kontakty}?contact=${encodeURIComponent(contact.id)}`,
        score: s,
      });
    }
  }

  // ── Phrases — title + content ──────────────────────────────────────────────
  for (const phrase of phrases) {
    let s = 0;
    s += score(q, phrase.title, 10);
    s += score(q, phrase.content, 4);
    if (s > 0) {
      results.push({
        id: phrase.id,
        type: "phrase",
        title: phrase.title,
        subtitle: phrase.content.length > 80
          ? phrase.content.slice(0, 80) + "…"
          : phrase.content,
        href: `${ROUTES.zwroty}?phrase=${encodeURIComponent(phrase.id)}`,
        score: s,
      });
    }
  }

  // ── Cenniki — document title/subtitle/provider + section titles +
  //             table-row labels/symbols + charge-item names
  //             (numeric values and raw cell data intentionally excluded)
  for (const doc of cenniki) {
    const sectionTexts: string[] = [];
    const itemTexts: string[] = [];

    for (const section of doc.sections ?? []) {
      if (section.title) sectionTexts.push(section.title);
      if (section.description) sectionTexts.push(section.description);

      if (section.type === "table") {
        for (const row of section.rows ?? []) {
          if (row.label) itemTexts.push(row.label);
          if (row.symbol) itemTexts.push(row.symbol);
        }
      } else if (section.type === "charges") {
        for (const item of section.items ?? []) {
          if (item.name) itemTexts.push(item.name);
        }
      }
    }

    let s = 0;
    s += score(q, doc.title, 10);
    s += score(q, doc.subtitle ?? "", 7);
    s += score(q, doc.provider ?? "", 6);
    s += score(q, sectionTexts.join(" "), 5);
    s += score(q, itemTexts.join(" "), 3);

    if (s > 0) {
      const sub = [doc.provider, doc.subtitle].filter(Boolean).join(" · ") ||
        (doc.sections?.length ? `${doc.sections.length} sekcji` : "Cennik");
      results.push({
        id: doc.id,
        type: "cennik",
        title: doc.title,
        subtitle: sub,
        href: `${ROUTES.cenniki}?id=${encodeURIComponent(doc.id)}`,
        score: s,
      });
    }
  }

  // ── Organizational topics — title only ────────────────────────────────────
  for (const topic of orgTopics) {
    const s = score(q, topic.title, 10);
    if (s > 0) {
      results.push({
        id: topic.id,
        type: "org_topic",
        title: topic.title,
        subtitle: `Temat organizacyjny · ${topic.status === "active" ? "Aktywny" : "Archiwalny"}`,
        href: tematOrgPath(topic.id),
        score: s,
      });
    }
  }

  // ── Quick links (Szybkie linki) — label, opens actual destination directly ─
  for (const ql of homeQuickLinks) {
    const s = score(q, ql.label, 10);
    if (s > 0) {
      results.push({
        id: ql.id,
        type: "quick_link",
        title: ql.label,
        subtitle: ql.url,
        href: ql.url,
        openInNewTab: !ql.isInternal && ql.openInNewTab !== false,
        score: s,
      });
    }
  }

  // Sort by score descending so each group in the modal surfaces its best matches first.
  results.sort((a, b) => b.score - a.score);
  return results;
}
