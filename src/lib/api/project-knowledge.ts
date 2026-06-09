import type {
  DocSection,
  KnowledgeCategoryEntry,
  KnowledgePage,
} from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectKnowledgeCategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId: string | null;
  sortOrder: number;
  childOrder?: string[];
};

export type ProjectKnowledgeArticleSectionRecord = {
  id: string;
  title: string;
  collapsible?: boolean;
  showSeparator?: boolean;
  tags?: string[];
  jsonContent: unknown;
};

export type ProjectKnowledgeArticleRecord = {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryDisplayName?: string;
  slug: string;
  title: string;
  summary: string;
  author?: string;
  updatedAt: string;
  tags: string[];
  hiddenTags?: string[];
  matrixLinkId?: string | null;
  globalMatrixLinkIds?: string[];
  quickActions?: string[];
  sections: ProjectKnowledgeArticleSectionRecord[];
  sortOrder?: number;
  externalSourceUrl?: string;
  sectionSearch?: boolean;
};

type ProjectRecord = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

export type ProjectKnowledgeCategoriesResponse = ApiEnvelope<{
  project: ProjectRecord;
  items: ProjectKnowledgeCategoryRecord[];
}>;

export type ProjectKnowledgeArticlesResponse = ApiEnvelope<{
  project: ProjectRecord;
  items: ProjectKnowledgeArticleRecord[];
}>;

export type CreateProjectKnowledgeCategoryInput = Omit<KnowledgeCategoryEntry, "id"> & {
  id?: string;
};

export type UpdateProjectKnowledgeCategoryInput = Partial<
  Omit<KnowledgeCategoryEntry, "id">
>;

export type ReorderProjectKnowledgeCategoriesInput =
  | {
      mode: "siblings";
      parentId: string | null;
      orderedIds: string[];
    }
  | {
      mode: "childOrder";
      categoryId: string;
      orderedIds: string[];
    };

export type CreateProjectKnowledgeArticleInput = Omit<
  KnowledgePage,
  "id" | "updatedAt" | "category" | "categoryDisplayName" | "keyDataPoints"
> & {
  id?: string;
};

export type UpdateProjectKnowledgeArticleInput = Partial<CreateProjectKnowledgeArticleInput>;

export type ReorderProjectKnowledgeArticlesInput = {
  categoryId: string;
  orderedIds: string[];
};

function requestPath(projectSlug: string, suffix: string): string {
  return `/api/v1/projects/${encodeURIComponent(projectSlug)}${suffix}`;
}

export function adaptProjectKnowledgeCategory(
  item: ProjectKnowledgeCategoryRecord
): KnowledgeCategoryEntry {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    parentId: item.parentId,
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
    ...(Array.isArray(item.childOrder) && item.childOrder.length > 0
      ? { childOrder: item.childOrder }
      : {}),
  };
}

export function adaptProjectKnowledgeCategories(
  payload: ProjectKnowledgeCategoriesResponse
): KnowledgeCategoryEntry[] {
  return payload.data.items.map(adaptProjectKnowledgeCategory);
}

export function adaptProjectKnowledgeSection(
  item: ProjectKnowledgeArticleSectionRecord
): DocSection {
  return {
    id: item.id,
    title: item.title,
    ...(item.collapsible ? { collapsible: true } : {}),
    ...(item.showSeparator === false ? { showSeparator: false } : {}),
    ...(Array.isArray(item.tags) && item.tags.length > 0 ? { tags: item.tags } : {}),
    jsonContent: item.jsonContent,
  };
}

export function adaptProjectKnowledgeArticle(
  item: ProjectKnowledgeArticleRecord
): KnowledgePage {
  return {
    id: item.id,
    categoryId: item.categoryId,
    category: item.categorySlug,
    ...(item.categoryDisplayName ? { categoryDisplayName: item.categoryDisplayName } : {}),
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    ...(item.author ? { author: item.author } : {}),
    updatedAt: item.updatedAt,
    tags: Array.isArray(item.tags) ? item.tags : [],
    ...(Array.isArray(item.hiddenTags) && item.hiddenTags.length > 0
      ? { hiddenTags: item.hiddenTags }
      : {}),
    ...(item.matrixLinkId === undefined ? {} : { matrixLinkId: item.matrixLinkId ?? null }),
    ...(Array.isArray(item.globalMatrixLinkIds) && item.globalMatrixLinkIds.length > 0
      ? { globalMatrixLinkIds: item.globalMatrixLinkIds }
      : {}),
    ...(Array.isArray(item.quickActions) && item.quickActions.length > 0
      ? { quickActions: item.quickActions }
      : {}),
    sections: Array.isArray(item.sections)
      ? item.sections.map(adaptProjectKnowledgeSection)
      : [],
    ...(typeof item.sortOrder === "number" ? { sortOrder: item.sortOrder } : {}),
    ...(item.externalSourceUrl ? { externalSourceUrl: item.externalSourceUrl } : {}),
    ...(item.sectionSearch ? { sectionSearch: true } : {}),
  };
}

export function adaptProjectKnowledgeArticles(
  payload: ProjectKnowledgeArticlesResponse
): KnowledgePage[] {
  return payload.data.items.map(adaptProjectKnowledgeArticle);
}

export async function fetchProjectKnowledgeCategories(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ProjectKnowledgeCategoriesResponse> {
  const response = await fetch(requestPath(projectSlug, "/categories"), {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge categories request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectKnowledgeCategoriesResponse;
}

export async function createProjectKnowledgeCategory(
  projectSlug: string,
  input: CreateProjectKnowledgeCategoryInput
): Promise<
  ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeCategoryRecord;
  }>
> {
  const response = await fetch(requestPath(projectSlug, "/categories"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge category create request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeCategoryRecord;
  }>;
}

export async function updateProjectKnowledgeCategory(
  projectSlug: string,
  categoryId: string,
  input: UpdateProjectKnowledgeCategoryInput
): Promise<
  ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeCategoryRecord;
  }>
> {
  const response = await fetch(
    requestPath(projectSlug, `/categories/${encodeURIComponent(categoryId)}`),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project knowledge category update request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeCategoryRecord;
  }>;
}

export async function deleteProjectKnowledgeCategory(
  projectSlug: string,
  categoryId: string
): Promise<void> {
  const response = await fetch(
    requestPath(projectSlug, `/categories/${encodeURIComponent(categoryId)}`),
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project knowledge category delete request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }
}

export async function reorderProjectKnowledgeCategories(
  projectSlug: string,
  input: ReorderProjectKnowledgeCategoriesInput
): Promise<ProjectKnowledgeCategoriesResponse> {
  const response = await fetch(requestPath(projectSlug, "/categories/reorder"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge category reorder request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectKnowledgeCategoriesResponse;
}

export async function fetchProjectKnowledgeArticles(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ProjectKnowledgeArticlesResponse> {
  const response = await fetch(requestPath(projectSlug, "/articles"), {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge articles request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectKnowledgeArticlesResponse;
}

export async function createProjectKnowledgeArticle(
  projectSlug: string,
  input: CreateProjectKnowledgeArticleInput
): Promise<
  ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeArticleRecord;
  }>
> {
  const response = await fetch(requestPath(projectSlug, "/articles"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge article create request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeArticleRecord;
  }>;
}

export async function updateProjectKnowledgeArticle(
  projectSlug: string,
  articleId: string,
  input: UpdateProjectKnowledgeArticleInput
): Promise<
  ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeArticleRecord;
  }>
> {
  const response = await fetch(
    requestPath(projectSlug, `/articles/${encodeURIComponent(articleId)}`),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project knowledge article update request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectRecord;
    item: ProjectKnowledgeArticleRecord;
  }>;
}

export async function deleteProjectKnowledgeArticle(
  projectSlug: string,
  articleId: string
): Promise<void> {
  const response = await fetch(
    requestPath(projectSlug, `/articles/${encodeURIComponent(articleId)}`),
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project knowledge article delete request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }
}

export async function reorderProjectKnowledgeArticles(
  projectSlug: string,
  input: ReorderProjectKnowledgeArticlesInput
): Promise<ProjectKnowledgeArticlesResponse> {
  const response = await fetch(requestPath(projectSlug, "/articles/reorder"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Project knowledge article reorder request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectKnowledgeArticlesResponse;
}