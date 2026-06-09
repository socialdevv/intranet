import { Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectKnowledgeCategoryItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId: string | null;
  sortOrder: number;
  childOrder?: string[];
};

export type ProjectKnowledgeArticleSectionItem = {
  id: string;
  title: string;
  collapsible?: boolean;
  showSeparator?: boolean;
  tags?: string[];
  jsonContent: Prisma.JsonValue;
};

export type ProjectKnowledgeArticleItem = {
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
  sections: ProjectKnowledgeArticleSectionItem[];
  sortOrder?: number;
  externalSourceUrl?: string;
  sectionSearch?: boolean;
};

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

type ProjectKnowledgeCategoriesResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
        items: ProjectKnowledgeCategoryItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type ProjectKnowledgeArticlesResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
        items: ProjectKnowledgeArticleItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectKnowledgeResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

type ProjectKnowledgeValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectKnowledgeMutationFailure =
  | ProjectKnowledgeValidationFailure
  | {
      ok: false;
      reason:
        | "not_found"
        | "locked"
        | "forbidden"
        | "category_not_found"
        | "article_not_found";
    };

type ProjectKnowledgeMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectKnowledgeMutationResult<T> =
  | ProjectKnowledgeMutationSuccess<T>
  | ProjectKnowledgeMutationFailure;

type SerializableKnowledgeCategoryRecord = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  childOrder: string[];
};

type SerializableKnowledgeArticleSectionRecord = {
  id: string;
  title: string;
  collapsible: boolean;
  showSeparator: boolean;
  tags: string[];
  bodyJson: Prisma.JsonValue;
  sortOrder: number;
};

type SerializableKnowledgeArticleRecord = {
  id: string;
  categoryId: string;
  slug: string;
  title: string;
  summary: string;
  authorName: string | null;
  tags: string[];
  hiddenTags: string[];
  matrixLinkId: string | null;
  globalMatrixLinkIds: string[];
  keyDataPointsJson: Prisma.JsonValue | null;
  quickActions: string[];
  externalSourceUrl: string | null;
  sectionSearchEnabled: boolean;
  sortOrder: number;
  updatedAt: Date;
  category: {
    id: string;
    slug: string;
    name: string;
  };
  sections: SerializableKnowledgeArticleSectionRecord[];
};

type KnowledgeSectionInput = {
  id: string;
  title: string;
  collapsible: boolean;
  showSeparator: boolean;
  tags: string[];
  jsonContent: Record<string, unknown>;
};

type KnowledgeArticleInput = {
  id?: string;
  categoryId: string;
  slug: string;
  title: string;
  summary: string;
  author?: string | null;
  tags: string[];
  hiddenTags: string[];
  matrixLinkId?: string | null;
  globalMatrixLinkIds: string[];
  quickActions: string[];
  sections: KnowledgeSectionInput[];
  sortOrder?: number;
  externalSourceUrl?: string | null;
  sectionSearch: boolean;
};

type KnowledgeArticlePatchInput = {
  categoryId?: string;
  slug?: string;
  title?: string;
  summary?: string;
  author?: string | null;
  tags?: string[];
  hiddenTags?: string[];
  matrixLinkId?: string | null;
  globalMatrixLinkIds?: string[];
  quickActions?: string[];
  sections?: KnowledgeSectionInput[];
  externalSourceUrl?: string | null;
  sectionSearch?: boolean;
};

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
} satisfies Prisma.JsonObject;

const jsonDocSchema = z.record(z.string(), z.unknown());

const idSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(191, "Identifier must be at most 191 characters.");

function isValidSlug(value: string): boolean {
  return value.length > 0 && !/\s/.test(value);
}

const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(191, "Slug must be at most 191 characters.")
  .refine(isValidSlug, "Slug cannot contain whitespace.");

const knowledgeCategorySchema = z.object({
  id: idSchema.optional(),
  name: z.string().trim().min(1, "Name is required.").max(160, "Name must be at most 160 characters."),
  slug: slugSchema,
  description: z.string().trim().max(2_000, "Description must be at most 2000 characters.").nullish(),
  parentId: idSchema.nullish(),
  sortOrder: z.number().int().min(0, "Sort order must be at least 0.").default(0),
  childOrder: z.array(idSchema).default([]),
});

const knowledgeCategoryPatchSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required.").max(160, "Name must be at most 160 characters.").optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2_000, "Description must be at most 2000 characters.").nullish(),
    parentId: idSchema.nullish(),
    sortOrder: z.number().int().min(0, "Sort order must be at least 0.").optional(),
    childOrder: z.array(idSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const knowledgeSectionSchema = z.object({
  id: idSchema,
  title: z.string().trim().max(240, "Section title must be at most 240 characters.").default(""),
  collapsible: z.boolean().default(false),
  showSeparator: z.boolean().default(true),
  tags: z.array(z.string().trim().min(1).max(120, "Section tag must be at most 120 characters.")).default([]),
  jsonContent: jsonDocSchema.default(EMPTY_TIPTAP_DOC as unknown as Record<string, unknown>),
});

const knowledgeArticleSchema = z.object({
  id: idSchema.optional(),
  categoryId: idSchema,
  slug: slugSchema,
  title: z.string().trim().min(1, "Title is required.").max(240, "Title must be at most 240 characters."),
  summary: z.string().trim().max(4_000, "Summary must be at most 4000 characters.").default(""),
  author: z.string().trim().max(160, "Author must be at most 160 characters.").nullish(),
  tags: z.array(z.string().trim().min(1).max(120, "Tag must be at most 120 characters.")).default([]),
  hiddenTags: z.array(z.string().trim().min(1).max(120, "Hidden tag must be at most 120 characters.")).default([]),
  matrixLinkId: idSchema.nullish(),
  globalMatrixLinkIds: z.array(idSchema).default([]),
  quickActions: z.array(z.string().trim().min(1).max(240, "Quick action must be at most 240 characters.")).default([]),
  sections: z.array(knowledgeSectionSchema).default([]),
  sortOrder: z.number().int().min(0, "Sort order must be at least 0.").optional(),
  externalSourceUrl: z.string().trim().url("External source URL must be a valid URL.").nullish(),
  sectionSearch: z.boolean().default(false),
});

const knowledgeArticlePatchSchema = z
  .object({
    categoryId: idSchema.optional(),
    slug: slugSchema.optional(),
    title: z.string().trim().min(1, "Title is required.").max(240, "Title must be at most 240 characters.").optional(),
    summary: z.string().trim().max(4_000, "Summary must be at most 4000 characters.").optional(),
    author: z.string().trim().max(160, "Author must be at most 160 characters.").nullish(),
    tags: z.array(z.string().trim().min(1).max(120, "Tag must be at most 120 characters.")).optional(),
    hiddenTags: z.array(z.string().trim().min(1).max(120, "Hidden tag must be at most 120 characters.")).optional(),
    matrixLinkId: idSchema.nullish(),
    globalMatrixLinkIds: z.array(idSchema).optional(),
    quickActions: z.array(z.string().trim().min(1).max(240, "Quick action must be at most 240 characters.")).optional(),
    sections: z.array(knowledgeSectionSchema).optional(),
    externalSourceUrl: z.string().trim().url("External source URL must be a valid URL.").nullish(),
    sectionSearch: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const categoryReorderSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("siblings"),
    parentId: idSchema.nullish(),
    orderedIds: z.array(idSchema).min(1, "Provide at least one category id to reorder."),
  }),
  z.object({
    mode: z.literal("childOrder"),
    categoryId: idSchema,
    orderedIds: z.array(idSchema),
  }),
]);

const articleReorderSchema = z.object({
  categoryId: idSchema,
  orderedIds: z.array(idSchema).min(1, "Provide at least one article id to reorder."),
});

function canEditProjectContent(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function toFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    code: issue.code,
    message: issue.message,
  }));
}

function validationFailure(
  error: z.ZodError,
  message: string
): ProjectKnowledgeValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function customValidationFailure(
  field: string,
  message: string,
  summary = "Project knowledge payload is invalid."
): ProjectKnowledgeValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message: summary,
    fieldErrors: [
      {
        field,
        code: "custom",
        message,
      },
    ],
  };
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function normalizeDescription(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function toStoredJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function serializeKnowledgeCategory(
  item: SerializableKnowledgeCategoryRecord
): ProjectKnowledgeCategoryItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    parentId: item.parentId,
    sortOrder: item.sortOrder,
    ...(item.childOrder.length > 0 ? { childOrder: item.childOrder } : {}),
  };
}

function serializeKnowledgeSection(
  item: SerializableKnowledgeArticleSectionRecord
): ProjectKnowledgeArticleSectionItem {
  return {
    id: item.id,
    title: item.title,
    ...(item.collapsible ? { collapsible: true } : {}),
    ...(item.showSeparator ? {} : { showSeparator: false }),
    ...(item.tags.length > 0 ? { tags: item.tags } : {}),
    jsonContent: item.bodyJson ?? EMPTY_TIPTAP_DOC,
  };
}

function serializeKnowledgeArticle(
  item: SerializableKnowledgeArticleRecord
): ProjectKnowledgeArticleItem {
  return {
    id: item.id,
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
    categoryDisplayName: item.category.name,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    ...(item.authorName ? { author: item.authorName } : {}),
    updatedAt: item.updatedAt.toISOString(),
    tags: item.tags,
    ...(item.hiddenTags.length > 0 ? { hiddenTags: item.hiddenTags } : {}),
    ...(item.matrixLinkId ? { matrixLinkId: item.matrixLinkId } : {}),
    ...(item.globalMatrixLinkIds.length > 0
      ? { globalMatrixLinkIds: item.globalMatrixLinkIds }
      : {}),
    ...(item.quickActions.length > 0 ? { quickActions: item.quickActions } : {}),
    sections: item.sections
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(serializeKnowledgeSection),
    sortOrder: item.sortOrder,
    ...(item.externalSourceUrl ? { externalSourceUrl: item.externalSourceUrl } : {}),
    ...(item.sectionSearchEnabled ? { sectionSearch: true } : {}),
  };
}

function toAuditComparableCategory(item: SerializableKnowledgeCategoryRecord) {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description ?? null,
    parentId: item.parentId,
    sortOrder: item.sortOrder,
    childOrder: JSON.stringify(item.childOrder),
  };
}

function toAuditCategoryMetadata(
  item: SerializableKnowledgeCategoryRecord
): Prisma.InputJsonObject {
  return {
    slug: item.slug,
    name: item.name,
    description: item.description ?? null,
    parentId: item.parentId,
    sortOrder: item.sortOrder,
    childOrderSize: item.childOrder.length,
  } satisfies Prisma.InputJsonObject;
}

function toAuditComparableArticle(item: SerializableKnowledgeArticleRecord) {
  return {
    categoryId: item.categoryId,
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    authorName: item.authorName ?? null,
    tags: JSON.stringify(item.tags),
    hiddenTags: JSON.stringify(item.hiddenTags),
    matrixLinkId: item.matrixLinkId ?? null,
    globalMatrixLinkIds: JSON.stringify(item.globalMatrixLinkIds),
    keyDataPoints: JSON.stringify(item.keyDataPointsJson ?? []),
    quickActions: JSON.stringify(item.quickActions),
    externalSourceUrl: item.externalSourceUrl ?? null,
    sectionSearchEnabled: item.sectionSearchEnabled,
    sortOrder: item.sortOrder,
    sections: JSON.stringify(
      item.sections
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((section) => ({
          id: section.id,
          title: section.title,
          collapsible: section.collapsible,
          showSeparator: section.showSeparator,
          tags: section.tags,
          bodyJson: section.bodyJson,
          sortOrder: section.sortOrder,
        }))
    ),
  };
}

function toAuditArticleMetadata(
  item: SerializableKnowledgeArticleRecord
): Prisma.InputJsonObject {
  return {
    categoryId: item.categoryId,
    categorySlug: item.category.slug,
    slug: item.slug,
    title: item.title,
    tagsCount: item.tags.length,
    sectionsCount: item.sections.length,
    sortOrder: item.sortOrder,
    hasExternalSourceUrl: item.externalSourceUrl !== null,
    hasMatrixLink: item.matrixLinkId !== null,
  } satisfies Prisma.InputJsonObject;
}

async function resolveProjectKnowledgeAccess(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<
  | {
      ok: true;
      data: {
        project: ProjectRef;
        effectiveRole: ProjectRole | null;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    }
> {
  const project = await prisma.project.findFirst({
    where: {
      slug: projectSlug,
      isActive: true,
    },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      isListed: true,
      memberships: {
        where: {
          userId: currentUser.id,
        },
        select: {
          effectiveRole: true,
        },
        take: 1,
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const membership = project.memberships[0] ?? null;
  const effectiveRole = membership?.effectiveRole ?? null;
  const hasMembership = effectiveRole !== null;
  const canSeeProject = project.isListed || hasMembership;

  if (!canSeeProject) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (!hasMembership) {
    return {
      ok: false,
      reason: "locked",
    };
  }

  return {
    ok: true,
    data: {
      project: {
        id: project.id,
        slug: project.slug,
        code: project.code,
        name: project.name,
      },
      effectiveRole,
    },
  };
}

async function resolveEditableProjectKnowledge(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectKnowledgeResult> {
  const access = await resolveProjectKnowledgeAccess(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  if (!canEditProjectContent(access.data.effectiveRole)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  return {
    ok: true,
    data: {
      project: access.data.project,
    },
  };
}

async function findCategoryById(
  prisma: PrismaClient,
  projectId: string,
  categoryId: string
) {
  return prisma.projectKnowledgeCategory.findFirst({
    where: {
      projectId,
      id: categoryId,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      childOrder: true,
      _count: {
        select: {
          children: true,
          articles: true,
        },
      },
    },
  });
}

async function ensureUniqueCategorySlug(
  prisma: PrismaClient,
  projectId: string,
  slug: string,
  excludeCategoryId?: string
): Promise<boolean> {
  const existing = await prisma.projectKnowledgeCategory.findFirst({
    where: {
      projectId,
      slug,
      ...(excludeCategoryId ? { id: { not: excludeCategoryId } } : {}),
    },
    select: {
      id: true,
    },
  });

  return existing === null;
}

async function validateCategoryParent(
  prisma: PrismaClient,
  projectId: string,
  categoryId: string | null,
  parentId: string | null,
  hasChildren: boolean
): Promise<ProjectKnowledgeValidationFailure | null> {
  if (!parentId) {
    return null;
  }

  if (categoryId && parentId === categoryId) {
    return customValidationFailure("parentId", "A category cannot be its own parent.");
  }

  if (hasChildren) {
    return customValidationFailure(
      "parentId",
      "A category with subcategories cannot be moved under another category.",
      "Category hierarchy is invalid."
    );
  }

  const parent = await prisma.projectKnowledgeCategory.findFirst({
    where: {
      projectId,
      id: parentId,
    },
    select: {
      id: true,
      parentId: true,
    },
  });

  if (!parent) {
    return customValidationFailure("parentId", "Parent category was not found.");
  }

  if (parent.parentId !== null) {
    return customValidationFailure(
      "parentId",
      "Only top-level categories can be selected as parents.",
      "Category hierarchy is invalid."
    );
  }

  return null;
}

async function selectProjectKnowledgeCategories(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectKnowledgeCategoryItem[]> {
  const items = await prisma.projectKnowledgeCategory.findMany({
    where: {
      projectId,
    },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      childOrder: true,
    },
  });

  return items.map(serializeKnowledgeCategory);
}

async function selectProjectKnowledgeArticles(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectKnowledgeArticleItem[]> {
  const items = await prisma.projectKnowledgeArticle.findMany({
    where: {
      projectId,
    },
    orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      categoryId: true,
      slug: true,
      title: true,
      summary: true,
      authorName: true,
      tags: true,
      hiddenTags: true,
      matrixLinkId: true,
      globalMatrixLinkIds: true,
      keyDataPointsJson: true,
      quickActions: true,
      externalSourceUrl: true,
      sectionSearchEnabled: true,
      sortOrder: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          collapsible: true,
          showSeparator: true,
          tags: true,
          bodyJson: true,
          sortOrder: true,
        },
      },
    },
  });

  return items.map(serializeKnowledgeArticle);
}

async function resolveNextArticleSortOrder(
  prisma: PrismaClient,
  projectId: string,
  categoryId: string,
  excludeArticleId?: string
): Promise<number> {
  const existing = await prisma.projectKnowledgeArticle.findMany({
    where: {
      projectId,
      categoryId,
      ...(excludeArticleId ? { id: { not: excludeArticleId } } : {}),
    },
    select: {
      sortOrder: true,
    },
  });

  return existing.reduce((maxSortOrder, item) => Math.max(maxSortOrder, item.sortOrder), -1) + 1;
}

async function ensureUniqueArticleSlug(
  prisma: PrismaClient,
  projectId: string,
  categoryId: string,
  slug: string,
  excludeArticleId?: string
): Promise<boolean> {
  const existing = await prisma.projectKnowledgeArticle.findFirst({
    where: {
      projectId,
      categoryId,
      slug,
      ...(excludeArticleId ? { id: { not: excludeArticleId } } : {}),
    },
    select: {
      id: true,
    },
  });

  return existing === null;
}

function normalizeSectionInput(
  section: KnowledgeSectionInput
): KnowledgeSectionInput {
  return {
    ...section,
    title: section.title.trim(),
    tags: uniqueStrings(section.tags),
  };
}

function normalizeArticleInput(
  article: KnowledgeArticleInput
): KnowledgeArticleInput {
  return {
    ...article,
    summary: article.summary.trim(),
    author: normalizeOptionalText(article.author) ?? undefined,
    tags: uniqueStrings(article.tags),
    hiddenTags: uniqueStrings(article.hiddenTags),
    matrixLinkId: normalizeOptionalText(article.matrixLinkId) ?? undefined,
    globalMatrixLinkIds: uniqueStrings(article.globalMatrixLinkIds),
    quickActions: uniqueStrings(article.quickActions),
    sections: article.sections.map(normalizeSectionInput),
    externalSourceUrl: normalizeOptionalText(article.externalSourceUrl) ?? undefined,
  };
}

export async function buildProjectKnowledgeCategories(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectKnowledgeCategoriesResult> {
  const access = await resolveProjectKnowledgeAccess(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: await selectProjectKnowledgeCategories(prisma, access.data.project.id),
    },
  };
}

export async function buildProjectKnowledgeArticles(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectKnowledgeArticlesResult> {
  const access = await resolveProjectKnowledgeAccess(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: await selectProjectKnowledgeArticles(prisma, access.data.project.id),
    },
  };
}

export async function createProjectKnowledgeCategory(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    item: ProjectKnowledgeCategoryItem;
  }>
> {
  const parsed = knowledgeCategorySchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge category payload is invalid.");
  }

  const normalized = {
    ...parsed.data,
    description: normalizeDescription(parsed.data.description),
    parentId: normalizeOptionalText(parsed.data.parentId),
    childOrder: uniqueStrings(parsed.data.childOrder),
  };

  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  if (!(await ensureUniqueCategorySlug(prisma, access.data.project.id, normalized.slug))) {
    return customValidationFailure("slug", "Slug must be unique within the project knowledge tree.");
  }

  const parentValidation = await validateCategoryParent(
    prisma,
    access.data.project.id,
    null,
    normalized.parentId,
    false
  );

  if (parentValidation) {
    return parentValidation;
  }

  const created = await prisma.projectKnowledgeCategory.create({
    data: {
      id: normalized.id,
      projectId: access.data.project.id,
      slug: normalized.slug,
      name: normalized.name,
      description: normalized.description,
      parentId: normalized.parentId,
      sortOrder: normalized.sortOrder,
      childOrder: normalized.childOrder,
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      childOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeCategory,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditCategoryMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeKnowledgeCategory(created),
    },
  };
}

export async function updateProjectKnowledgeCategory(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  categoryId: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    item: ProjectKnowledgeCategoryItem;
  }>
> {
  const parsed = knowledgeCategoryPatchSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge category payload is invalid.");
  }

  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await findCategoryById(prisma, access.data.project.id, categoryId);

  if (!existing) {
    return {
      ok: false,
      reason: "category_not_found",
    };
  }

  const normalized = knowledgeCategorySchema.safeParse({
    id: existing.id,
    name: parsed.data.name ?? existing.name,
    slug: parsed.data.slug ?? existing.slug,
    description:
      parsed.data.description === undefined ? existing.description : normalizeDescription(parsed.data.description),
    parentId:
      parsed.data.parentId === undefined ? existing.parentId : normalizeOptionalText(parsed.data.parentId),
    sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
    childOrder: parsed.data.childOrder ?? existing.childOrder,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project knowledge category payload is invalid.");
  }

  if (!(await ensureUniqueCategorySlug(prisma, access.data.project.id, normalized.data.slug, existing.id))) {
    return customValidationFailure("slug", "Slug must be unique within the project knowledge tree.");
  }

  const parentValidation = await validateCategoryParent(
    prisma,
    access.data.project.id,
    existing.id,
    normalizeOptionalText(normalized.data.parentId),
    existing._count.children > 0
  );

  if (parentValidation) {
    return parentValidation;
  }

  const updated = await prisma.projectKnowledgeCategory.update({
    where: {
      id: existing.id,
    },
    data: {
      slug: normalized.data.slug,
      name: normalized.data.name,
      description: normalizeDescription(normalized.data.description),
      parentId: normalizeOptionalText(normalized.data.parentId),
      sortOrder: normalized.data.sortOrder,
      childOrder: uniqueStrings(normalized.data.childOrder),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      parentId: true,
      sortOrder: true,
      childOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeCategory,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditCategoryMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableCategory(existing),
        toAuditComparableCategory(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeKnowledgeCategory(updated),
    },
  };
}

export async function deleteProjectKnowledgeCategory(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  categoryId: string
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await findCategoryById(prisma, access.data.project.id, categoryId);

  if (!existing) {
    return {
      ok: false,
      reason: "category_not_found",
    };
  }

  if (existing._count.children > 0) {
    return customValidationFailure(
      "categoryId",
      `Cannot delete this category until its ${existing._count.children === 1 ? "subcategory is" : "subcategories are"} removed.`,
      "Knowledge category cannot be deleted."
    );
  }

  if (existing._count.articles > 0) {
    return customValidationFailure(
      "categoryId",
      `Cannot delete this category until its ${existing._count.articles === 1 ? "article is" : "articles are"} moved or deleted.`,
      "Knowledge category cannot be deleted."
    );
  }

  await prisma.projectKnowledgeCategory.delete({
    where: {
      id: existing.id,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeCategory,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditCategoryMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectKnowledgeCategories(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    items: ProjectKnowledgeCategoryItem[];
  }>
> {
  const parsed = categoryReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge category reorder payload is invalid.");
  }

  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  if (parsed.data.mode === "siblings") {
    const parentId = normalizeOptionalText(parsed.data.parentId);
    const siblings = await prisma.projectKnowledgeCategory.findMany({
      where: {
        projectId: access.data.project.id,
        parentId,
      },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        sortOrder: true,
        childOrder: true,
      },
    });

    const siblingIds = siblings.map((item) => item.id);
    const orderedIds = uniqueStrings(parsed.data.orderedIds);

    if (orderedIds.length !== siblingIds.length) {
      return customValidationFailure(
        "orderedIds",
        "Reorder payload must include every sibling category exactly once.",
        "Knowledge category reorder payload is invalid."
      );
    }

    const siblingIdSet = new Set(siblingIds);
    if (orderedIds.some((id) => !siblingIdSet.has(id))) {
      return customValidationFailure(
        "orderedIds",
        "Reorder payload contains categories outside the requested parent scope.",
        "Knowledge category reorder payload is invalid."
      );
    }

    const changedItems = siblings
      .map((item) => ({
        before: item,
        afterSortOrder: orderedIds.indexOf(item.id),
      }))
      .filter((item) => item.afterSortOrder !== item.before.sortOrder);

    await prisma.$transaction(
      changedItems.map((item) =>
        prisma.projectKnowledgeCategory.update({
          where: {
            id: item.before.id,
          },
          data: {
            sortOrder: item.afterSortOrder,
          },
        })
      )
    );

    for (const item of changedItems) {
      await recordAuditLogBestEffort(prisma, {
        actor: currentUser,
        project: access.data.project,
        moduleKey: null,
        entityType: AUDIT_ENTITY_TYPES.projectKnowledgeCategory,
        entityId: item.before.id,
        actionType: AUDIT_ACTION_TYPES.update,
        metadata: {
          ...toAuditCategoryMetadata(item.before),
          changedFields: ["sortOrder"],
          sortOrder: item.afterSortOrder,
        },
      });
    }
  } else {
    const category = await prisma.projectKnowledgeCategory.findFirst({
      where: {
        projectId: access.data.project.id,
        id: parsed.data.categoryId,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        sortOrder: true,
        childOrder: true,
        children: {
          select: {
            id: true,
          },
        },
        articles: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!category) {
      return {
        ok: false,
        reason: "category_not_found",
      };
    }

    const directIds = new Set([
      ...category.children.map((item) => item.id),
      ...category.articles.map((item) => item.id),
    ]);
    const orderedIds = uniqueStrings(parsed.data.orderedIds);

    if (orderedIds.length !== directIds.size) {
      return customValidationFailure(
        "orderedIds",
        "Child order payload must include every direct article and subcategory exactly once.",
        "Knowledge category reorder payload is invalid."
      );
    }

    if (orderedIds.some((id) => !directIds.has(id))) {
      return customValidationFailure(
        "orderedIds",
        "Child order payload contains ids outside the selected category.",
        "Knowledge category reorder payload is invalid."
      );
    }

    const updated = await prisma.projectKnowledgeCategory.update({
      where: {
        id: category.id,
      },
      data: {
        childOrder: orderedIds,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        parentId: true,
        sortOrder: true,
        childOrder: true,
      },
    });

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: null,
      entityType: AUDIT_ENTITY_TYPES.projectKnowledgeCategory,
      entityId: category.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditCategoryMetadata(updated),
        changedFields: ["childOrder"],
      },
    });
  }

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: await selectProjectKnowledgeCategories(prisma, access.data.project.id),
    },
  };
}

export async function createProjectKnowledgeArticle(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    item: ProjectKnowledgeArticleItem;
  }>
> {
  const parsed = knowledgeArticleSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge article payload is invalid.");
  }

  const normalized = normalizeArticleInput(parsed.data as KnowledgeArticleInput);
  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const category = await prisma.projectKnowledgeCategory.findFirst({
    where: {
      projectId: access.data.project.id,
      id: normalized.categoryId,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    return {
      ok: false,
      reason: "category_not_found",
    };
  }

  if (!(await ensureUniqueArticleSlug(prisma, access.data.project.id, normalized.categoryId, normalized.slug))) {
    return customValidationFailure("slug", "Slug must be unique within the selected category.");
  }

  const sortOrder =
    normalized.sortOrder ??
    (await resolveNextArticleSortOrder(prisma, access.data.project.id, normalized.categoryId));

  const created = await prisma.projectKnowledgeArticle.create({
    data: {
      id: normalized.id,
      projectId: access.data.project.id,
      categoryId: normalized.categoryId,
      slug: normalized.slug,
      title: normalized.title,
      summary: normalized.summary,
      authorName: normalizeOptionalText(normalized.author),
      tags: normalized.tags,
      hiddenTags: normalized.hiddenTags,
      matrixLinkId: normalizeOptionalText(normalized.matrixLinkId),
      globalMatrixLinkIds: normalized.globalMatrixLinkIds,
      quickActions: normalized.quickActions,
      externalSourceUrl: normalizeOptionalText(normalized.externalSourceUrl),
      sectionSearchEnabled: normalized.sectionSearch,
      sortOrder,
      sections: {
        create: normalized.sections.map((section, index) => ({
          id: section.id,
          sortOrder: index,
          title: section.title,
          tags: section.tags,
          collapsible: section.collapsible,
          showSeparator: section.showSeparator,
          bodyJson: toStoredJson(section.jsonContent),
        })),
      },
    },
    select: {
      id: true,
      categoryId: true,
      slug: true,
      title: true,
      summary: true,
      authorName: true,
      tags: true,
      hiddenTags: true,
      matrixLinkId: true,
      globalMatrixLinkIds: true,
      keyDataPointsJson: true,
      quickActions: true,
      externalSourceUrl: true,
      sectionSearchEnabled: true,
      sortOrder: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          collapsible: true,
          showSeparator: true,
          tags: true,
          bodyJson: true,
          sortOrder: true,
        },
      },
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeArticle,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditArticleMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeKnowledgeArticle(created),
    },
  };
}

export async function updateProjectKnowledgeArticle(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  articleId: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    item: ProjectKnowledgeArticleItem;
  }>
> {
  const parsed = knowledgeArticlePatchSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge article payload is invalid.");
  }

  const patch = parsed.data as KnowledgeArticlePatchInput;

  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectKnowledgeArticle.findFirst({
    where: {
      projectId: access.data.project.id,
      id: articleId,
    },
    select: {
      id: true,
      categoryId: true,
      slug: true,
      title: true,
      summary: true,
      authorName: true,
      tags: true,
      hiddenTags: true,
      matrixLinkId: true,
      globalMatrixLinkIds: true,
      keyDataPointsJson: true,
      quickActions: true,
      externalSourceUrl: true,
      sectionSearchEnabled: true,
      sortOrder: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          collapsible: true,
          showSeparator: true,
          tags: true,
          bodyJson: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "article_not_found",
    };
  }

  const normalized = knowledgeArticleSchema.safeParse({
    id: existing.id,
    categoryId: patch.categoryId ?? existing.categoryId,
    slug: patch.slug ?? existing.slug,
    title: patch.title ?? existing.title,
    summary: patch.summary ?? existing.summary,
    author:
      patch.author === undefined ? existing.authorName : normalizeOptionalText(patch.author),
    tags: patch.tags ?? existing.tags,
    hiddenTags: patch.hiddenTags ?? existing.hiddenTags,
    matrixLinkId:
      patch.matrixLinkId === undefined ? existing.matrixLinkId : normalizeOptionalText(patch.matrixLinkId),
    globalMatrixLinkIds: patch.globalMatrixLinkIds ?? existing.globalMatrixLinkIds,
    quickActions: patch.quickActions ?? existing.quickActions,
    sections:
      patch.sections ??
      existing.sections.map((section) => ({
        id: section.id,
        title: section.title,
        collapsible: section.collapsible,
        showSeparator: section.showSeparator,
        tags: section.tags,
        jsonContent: (section.bodyJson ?? EMPTY_TIPTAP_DOC) as Record<string, unknown>,
      })),
    sortOrder: existing.sortOrder,
    externalSourceUrl:
      patch.externalSourceUrl === undefined
        ? existing.externalSourceUrl
        : normalizeOptionalText(patch.externalSourceUrl),
    sectionSearch:
      patch.sectionSearch === undefined ? existing.sectionSearchEnabled : patch.sectionSearch,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project knowledge article payload is invalid.");
  }

  const normalizedArticle = normalizeArticleInput(normalized.data as KnowledgeArticleInput);
  const nextCategoryId = normalizedArticle.categoryId;

  const category = await prisma.projectKnowledgeCategory.findFirst({
    where: {
      projectId: access.data.project.id,
      id: nextCategoryId,
    },
    select: {
      id: true,
    },
  });

  if (!category) {
    return {
      ok: false,
      reason: "category_not_found",
    };
  }

  if (
    !(await ensureUniqueArticleSlug(
      prisma,
      access.data.project.id,
      nextCategoryId,
      normalizedArticle.slug,
      existing.id
    ))
  ) {
    return customValidationFailure("slug", "Slug must be unique within the selected category.");
  }

  const nextSortOrder =
    nextCategoryId === existing.categoryId
      ? existing.sortOrder
      : await resolveNextArticleSortOrder(prisma, access.data.project.id, nextCategoryId, existing.id);

  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.projectKnowledgeArticle.update({
      where: {
        id: existing.id,
      },
      data: {
        categoryId: nextCategoryId,
        slug: normalizedArticle.slug,
        title: normalizedArticle.title,
        summary: normalizedArticle.summary,
        authorName: normalizeOptionalText(normalizedArticle.author),
        tags: normalizedArticle.tags,
        hiddenTags: normalizedArticle.hiddenTags,
        matrixLinkId: normalizeOptionalText(normalizedArticle.matrixLinkId),
        globalMatrixLinkIds: normalizedArticle.globalMatrixLinkIds,
        quickActions: normalizedArticle.quickActions,
        externalSourceUrl: normalizeOptionalText(normalizedArticle.externalSourceUrl),
        sectionSearchEnabled: normalizedArticle.sectionSearch,
        sortOrder: nextSortOrder,
      },
    });

    await transaction.projectKnowledgeArticleSection.deleteMany({
      where: {
        articleId: existing.id,
      },
    });

    if (normalizedArticle.sections.length > 0) {
      await transaction.projectKnowledgeArticleSection.createMany({
        data: normalizedArticle.sections.map((section, index) => ({
          id: section.id,
          articleId: existing.id,
          sortOrder: index,
          title: section.title,
          tags: section.tags,
          collapsible: section.collapsible,
          showSeparator: section.showSeparator,
          bodyJson: toStoredJson(section.jsonContent),
        })),
      });
    }

    const next = await transaction.projectKnowledgeArticle.findUnique({
      where: {
        id: existing.id,
      },
      select: {
        id: true,
        categoryId: true,
        slug: true,
        title: true,
        summary: true,
        authorName: true,
        tags: true,
        hiddenTags: true,
        matrixLinkId: true,
        globalMatrixLinkIds: true,
        keyDataPointsJson: true,
        quickActions: true,
        externalSourceUrl: true,
        sectionSearchEnabled: true,
        sortOrder: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
        sections: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            collapsible: true,
            showSeparator: true,
            tags: true,
            bodyJson: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!next) {
      throw new Error("Updated article could not be reloaded.");
    }

    return next;
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeArticle,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditArticleMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableArticle(existing),
        toAuditComparableArticle(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeKnowledgeArticle(updated),
    },
  };
}

export async function deleteProjectKnowledgeArticle(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  articleId: string
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectKnowledgeArticle.findFirst({
    where: {
      projectId: access.data.project.id,
      id: articleId,
    },
    select: {
      id: true,
      categoryId: true,
      slug: true,
      title: true,
      summary: true,
      authorName: true,
      tags: true,
      hiddenTags: true,
      matrixLinkId: true,
      globalMatrixLinkIds: true,
      keyDataPointsJson: true,
      quickActions: true,
      externalSourceUrl: true,
      sectionSearchEnabled: true,
      sortOrder: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          collapsible: true,
          showSeparator: true,
          tags: true,
          bodyJson: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "article_not_found",
    };
  }

  await prisma.projectKnowledgeArticle.delete({
    where: {
      id: existing.id,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.projectKnowledgeArticle,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditArticleMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectKnowledgeArticles(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectKnowledgeMutationResult<{
    project: ProjectRef;
    items: ProjectKnowledgeArticleItem[];
  }>
> {
  const parsed = articleReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project knowledge article reorder payload is invalid.");
  }

  const access = await resolveEditableProjectKnowledge(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const articles = await prisma.projectKnowledgeArticle.findMany({
    where: {
      projectId: access.data.project.id,
      categoryId: parsed.data.categoryId,
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      categoryId: true,
      slug: true,
      title: true,
      summary: true,
      authorName: true,
      tags: true,
      hiddenTags: true,
      matrixLinkId: true,
      globalMatrixLinkIds: true,
      keyDataPointsJson: true,
      quickActions: true,
      externalSourceUrl: true,
      sectionSearchEnabled: true,
      sortOrder: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      sections: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          collapsible: true,
          showSeparator: true,
          tags: true,
          bodyJson: true,
          sortOrder: true,
        },
      },
    },
  });

  const articleIds = articles.map((item) => item.id);
  const orderedIds = uniqueStrings(parsed.data.orderedIds);

  if (orderedIds.length !== articleIds.length) {
    return customValidationFailure(
      "orderedIds",
      "Reorder payload must include every article in the selected category exactly once.",
      "Knowledge article reorder payload is invalid."
    );
  }

  const articleIdSet = new Set(articleIds);
  if (orderedIds.some((id) => !articleIdSet.has(id))) {
    return customValidationFailure(
      "orderedIds",
      "Reorder payload contains articles outside the selected category.",
      "Knowledge article reorder payload is invalid."
    );
  }

  const changedItems = articles
    .map((item) => ({
      before: item,
      afterSortOrder: orderedIds.indexOf(item.id),
    }))
    .filter((item) => item.afterSortOrder !== item.before.sortOrder);

  await prisma.$transaction(
    changedItems.map((item) =>
      prisma.projectKnowledgeArticle.update({
        where: {
          id: item.before.id,
        },
        data: {
          sortOrder: item.afterSortOrder,
        },
      })
    )
  );

  for (const item of changedItems) {
    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: null,
      entityType: AUDIT_ENTITY_TYPES.projectKnowledgeArticle,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditArticleMetadata(item.before),
        changedFields: ["sortOrder"],
        sortOrder: item.afterSortOrder,
      },
    });
  }

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: await selectProjectKnowledgeArticles(prisma, access.data.project.id),
    },
  };
}