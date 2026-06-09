import { ModuleKey, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectPhraseItem = {
  id: string;
  title: string;
  content: string;
  requiresConfirmation: boolean;
  sortOrder: number;
};

type ProjectPhrasesResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectPhraseItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectPhrasesResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

type ProjectPhraseMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectPhraseMutationFailure =
  | ProjectPhraseMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "phrase_not_found";
    };

type ProjectPhraseMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectPhraseMutationResult<T> = ProjectPhraseMutationSuccess<T> | ProjectPhraseMutationFailure;

type SerializableProjectPhraseRecord = {
  id: string;
  title: string;
  content: string;
  requiresConfirmation: boolean;
  sortOrder: number;
};

const projectPhraseSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  content: z.string().trim().min(1, "Content is required.").max(20000, "Content must be at most 20000 characters."),
  requiresConfirmation: z.boolean().default(false),
});

const projectPhrasePatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    content: z.string().trim().min(1, "Content is required.").max(20000, "Content must be at most 20000 characters.").optional(),
    requiresConfirmation: z.boolean().optional(),
    sortOrder: z.number().int().min(0, "Sort order must be zero or greater.").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectPhraseReorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, "Phrase id is required."))
    .min(1, "Provide at least one phrase id to reorder."),
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
): ProjectPhraseMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function serializeProjectPhrase(item: SerializableProjectPhraseRecord): ProjectPhraseItem {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    requiresConfirmation: item.requiresConfirmation,
    sortOrder: item.sortOrder,
  };
}

function toAuditMetadata(item: SerializableProjectPhraseRecord) {
  return {
    title: item.title,
    requiresConfirmation: item.requiresConfirmation,
    sortOrder: item.sortOrder,
    contentLength: item.content.length,
  };
}

async function resolveEditableProjectPhrases(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectPhrasesResult> {
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

  if (!canEditProjectContent(effectiveRole)) {
    return {
      ok: false,
      reason: "forbidden",
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
    },
  };
}

export async function buildProjectPhrases(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectPhrasesResult> {
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
      phrases: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          content: true,
          requiresConfirmation: true,
          sortOrder: true,
        },
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const hasMembership = project.memberships.length > 0;
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
      items: project.phrases.map(serializeProjectPhrase),
    },
  };
}

export async function createProjectPhrase(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectPhraseMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectPhraseItem;
  }>
> {
  const parsed = projectPhraseSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project phrase payload is invalid.");
  }

  const access = await resolveEditableProjectPhrases(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectPhrase.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectPhrase.create({
    data: {
      projectId: access.data.project.id,
      title: parsed.data.title,
      content: parsed.data.content,
      requiresConfirmation: parsed.data.requiresConfirmation,
      sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.phrases,
    entityType: AUDIT_ENTITY_TYPES.projectPhrase,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectPhrase(created),
    },
  };
}

export async function updateProjectPhrase(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  phraseId: string,
  input: unknown
): Promise<
  ProjectPhraseMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectPhraseItem;
  }>
> {
  const parsedPatch = projectPhrasePatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project phrase update payload is invalid.");
  }

  const access = await resolveEditableProjectPhrases(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectPhrase.findFirst({
    where: {
      id: phraseId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "phrase_not_found",
    };
  }

  const normalized = projectPhraseSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    content: parsedPatch.data.content ?? existing.content,
    requiresConfirmation: parsedPatch.data.requiresConfirmation ?? existing.requiresConfirmation,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project phrase update payload is invalid.");
  }

  const updated = await prisma.projectPhrase.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      content: normalized.data.content,
      requiresConfirmation: normalized.data.requiresConfirmation,
      sortOrder: parsedPatch.data.sortOrder ?? existing.sortOrder,
    },
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.phrases,
    entityType: AUDIT_ENTITY_TYPES.projectPhrase,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(existing, updated),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectPhrase(updated),
    },
  };
}

export async function deleteProjectPhrase(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  phraseId: string
): Promise<
  ProjectPhraseMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectPhrases(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectPhrase.findFirst({
    where: {
      id: phraseId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "phrase_not_found",
    };
  }

  const deleted = await prisma.projectPhrase.deleteMany({
    where: {
      id: phraseId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "phrase_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.phrases,
    entityType: AUDIT_ENTITY_TYPES.projectPhrase,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectPhrases(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectPhraseMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    items: ProjectPhraseItem[];
  }>
> {
  const parsed = projectPhraseReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project phrase reorder payload is invalid.");
  }

  const access = await resolveEditableProjectPhrases(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectPhrase.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  const orderedIds = [...new Set(parsed.data.orderedIds.map((id) => id.trim()))];
  const existingIds = existing.map((item) => item.id);

  if (orderedIds.length !== existingIds.length) {
    return {
      ok: false,
      reason: "validation",
      message: "Project phrase reorder payload must include every phrase exactly once.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project phrase reorder payload must include every phrase exactly once.",
        },
      ],
    };
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return {
      ok: false,
      reason: "validation",
      message: "Project phrase reorder payload contains unknown phrases.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project phrase reorder payload contains unknown phrases.",
        },
      ],
    };
  }

  const changedItems = existing
    .map((item) => ({
      before: item,
      afterSortOrder: orderedIds.indexOf(item.id),
    }))
    .filter((item) => item.afterSortOrder !== item.before.sortOrder);

  await prisma.$transaction(
    changedItems.map((item) =>
      prisma.projectPhrase.update({
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
      moduleKey: ModuleKey.phrases,
      entityType: AUDIT_ENTITY_TYPES.projectPhrase,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditMetadata(item.before),
        sortOrder: item.afterSortOrder,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectPhrase.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      content: true,
      requiresConfirmation: true,
      sortOrder: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map(serializeProjectPhrase),
    },
  };
}