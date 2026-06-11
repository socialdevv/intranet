import type { TipTapDoc } from "@/lib/knowledge/content-doc";

export type ArticleEditorSectionDraft = {
  id: string;
  title: string;
  tags: string;
  content: TipTapDoc;
  collapsible: boolean;
  showSeparator: boolean;
};

export type ArticleEditorDraft = {
  version: 1;
  title: string;
  summary: string;
  slug: string;
  slugManual: boolean;
  categoryId: string;
  tags: string;
  globalMatrixLinkIds: string[];
  externalSourceUrl: string;
  sectionSearch: boolean;
  sections: ArticleEditorSectionDraft[];
  savedAt: string;
};

const DRAFT_KEY_PREFIX = "intranet:article-editor-draft:";

export function buildArticleEditorDraftKey(articleId: string): string {
  return `${DRAFT_KEY_PREFIX}${articleId}`;
}

export function readArticleEditorDraft(articleId: string): ArticleEditorDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(buildArticleEditorDraftKey(articleId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ArticleEditorDraft;
    if (parsed?.version !== 1 || !Array.isArray(parsed.sections)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeArticleEditorDraft(articleId: string, draft: Omit<ArticleEditorDraft, "version" | "savedAt">): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: ArticleEditorDraft = {
      version: 1,
      ...draft,
      savedAt: new Date().toISOString(),
    };
    window.sessionStorage.setItem(buildArticleEditorDraftKey(articleId), JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable or full — ignore silently
  }
}

export function clearArticleEditorDraft(articleId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(buildArticleEditorDraftKey(articleId));
  } catch {
    // ignore
  }
}
