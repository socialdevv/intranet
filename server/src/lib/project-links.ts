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

export type ProjectLinkItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

type ProjectLinksResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectLinkItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectLinksResult =
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

type ProjectLinkMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectLinkMutationFailure =
  | ProjectLinkMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "link_not_found";
    };

type ProjectLinkMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectLinkMutationResult<T> = ProjectLinkMutationSuccess<T> | ProjectLinkMutationFailure;

const projectLinkSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(160, "Title must be at most 160 characters."),
    url: z.string().trim().min(1, "URL is required.").max(2048, "URL must be at most 2048 characters."),
    description: z.string().trim().max(160, "Description must be at most 160 characters.").default(""),
    icon: z.string().trim().min(1, "Icon is required.").max(64, "Icon must be at most 64 characters.").default("link"),
    openInNewTab: z.boolean().default(true),
    isInternal: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.isInternal) {
      if (!isValidInternalPath(value.url)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["url"],
          message: "Internal project links must start with '/' and cannot contain spaces.",
        });
      }

      return;
    }

    if (!isValidHttpUrl(value.url)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "External project links must use an absolute http:// or https:// URL.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    openInNewTab: value.isInternal ? false : value.openInNewTab,
  }));

const projectLinkPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(160, "Title must be at most 160 characters.").optional(),
    url: z.string().trim().min(1, "URL is required.").max(2048, "URL must be at most 2048 characters.").optional(),
    description: z.string().trim().max(160, "Description must be at most 160 characters.").optional(),
    icon: z.string().trim().min(1, "Icon is required.").max(64, "Icon must be at most 64 characters.").optional(),
    openInNewTab: z.boolean().optional(),
    isInternal: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectLinkReorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, "Link id is required."))
    .min(1, "Provide at least one link id to reorder."),
});

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidInternalPath(value: string): boolean {
  return value.startsWith("/") && !/\s/.test(value);
}

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

function validationFailure(error: z.ZodError, message: string): ProjectLinkMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

async function resolveEditableProjectLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectLinksResult> {
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

export async function buildProjectLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectLinksResult> {
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
      links: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          url: true,
          description: true,
          icon: true,
          sortOrder: true,
          openInNewTab: true,
          isInternal: true,
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
      items: project.links,
    },
  };
}

export async function createProjectLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; item: ProjectLinkItem }>> {
  const parsed = projectLinkSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project link payload is invalid.");
  }

  const access = await resolveEditableProjectLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectLink.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectLink.create({
    data: {
      projectId: access.data.project.id,
      title: parsed.data.title,
      url: parsed.data.url,
      description: parsed.data.description,
      icon: parsed.data.icon,
      openInNewTab: parsed.data.openInNewTab,
      isInternal: parsed.data.isInternal,
      sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.links,
    entityType: AUDIT_ENTITY_TYPES.projectLink,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: {
      title: created.title,
      url: created.url,
      description: created.description,
      icon: created.icon,
      sortOrder: created.sortOrder,
      openInNewTab: created.openInNewTab,
      isInternal: created.isInternal,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: created,
    },
  };
}

export async function updateProjectLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  linkId: string,
  input: unknown
): Promise<ProjectLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; item: ProjectLinkItem }>> {
  const parsedPatch = projectLinkPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project link update payload is invalid.");
  }

  const access = await resolveEditableProjectLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectLink.findFirst({
    where: {
      id: linkId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "link_not_found",
    };
  }

  const normalized = projectLinkSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    url: parsedPatch.data.url ?? existing.url,
    description: parsedPatch.data.description ?? existing.description,
    icon: parsedPatch.data.icon ?? existing.icon,
    openInNewTab: parsedPatch.data.openInNewTab ?? existing.openInNewTab,
    isInternal: parsedPatch.data.isInternal ?? existing.isInternal,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project link update payload is invalid.");
  }

  const updated = await prisma.projectLink.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      url: normalized.data.url,
      description: normalized.data.description,
      icon: normalized.data.icon,
      openInNewTab: normalized.data.openInNewTab,
      isInternal: normalized.data.isInternal,
    },
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.links,
    entityType: AUDIT_ENTITY_TYPES.projectLink,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      title: updated.title,
      url: updated.url,
      description: updated.description,
      icon: updated.icon,
      sortOrder: updated.sortOrder,
      openInNewTab: updated.openInNewTab,
      isInternal: updated.isInternal,
      changedFields: collectChangedFields(existing, updated),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: updated,
    },
  };
}

export async function deleteProjectLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  linkId: string
): Promise<ProjectLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; deletedId: string }>> {
  const access = await resolveEditableProjectLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectLink.findFirst({
    where: {
      id: linkId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "link_not_found",
    };
  }

  const deleted = await prisma.projectLink.deleteMany({
    where: {
      id: linkId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "link_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.links,
    entityType: AUDIT_ENTITY_TYPES.projectLink,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: {
      title: existing.title,
      url: existing.url,
      description: existing.description,
      icon: existing.icon,
      sortOrder: existing.sortOrder,
      openInNewTab: existing.openInNewTab,
      isInternal: existing.isInternal,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: linkId,
    },
  };
}

export async function reorderProjectLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; items: ProjectLinkItem[] }>> {
  const parsed = projectLinkReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project link reorder payload is invalid.");
  }

  const access = await resolveEditableProjectLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectLink.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  const orderedIds = [...new Set(parsed.data.orderedIds.map((id) => id.trim()))];
  const existingIds = existing.map((item) => item.id);

  if (orderedIds.length !== existingIds.length) {
    return {
      ok: false,
      reason: "validation",
      message: "Project link reorder payload must include every link exactly once.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project link reorder payload must include every link exactly once.",
        },
      ],
    };
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return {
      ok: false,
      reason: "validation",
      message: "Project link reorder payload contains unknown links.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project link reorder payload contains unknown links.",
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
      prisma.projectLink.update({
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
      moduleKey: ModuleKey.links,
      entityType: AUDIT_ENTITY_TYPES.projectLink,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        title: item.before.title,
        url: item.before.url,
        description: item.before.description,
        icon: item.before.icon,
        sortOrder: item.afterSortOrder,
        openInNewTab: item.before.openInNewTab,
        isInternal: item.before.isInternal,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectLink.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      url: true,
      description: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items,
    },
  };
}