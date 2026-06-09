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

export type ProjectQuickLinkItem = {
  id: string;
  label: string;
  url: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

type ProjectQuickLinksResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectQuickLinkItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectQuickLinksResult =
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

type ProjectQuickLinkMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectQuickLinkMutationFailure =
  | ProjectQuickLinkMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "quick_link_not_found";
    };

type ProjectQuickLinkMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectQuickLinkMutationResult<T> = ProjectQuickLinkMutationSuccess<T> | ProjectQuickLinkMutationFailure;

const projectQuickLinkSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required.").max(120, "Label must be at most 120 characters."),
    url: z.string().trim().min(1, "URL is required.").max(2048, "URL must be at most 2048 characters."),
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
          message: "Internal quick links must start with '/' and cannot contain spaces.",
        });
      }

      return;
    }

    if (!isValidHttpUrl(value.url)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "External quick links must use an absolute http:// or https:// URL.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    openInNewTab: value.isInternal ? false : value.openInNewTab,
  }));

const projectQuickLinkPatchSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required.").max(120, "Label must be at most 120 characters.").optional(),
    url: z.string().trim().min(1, "URL is required.").max(2048, "URL must be at most 2048 characters.").optional(),
    icon: z.string().trim().min(1, "Icon is required.").max(64, "Icon must be at most 64 characters.").optional(),
    openInNewTab: z.boolean().optional(),
    isInternal: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectQuickLinkReorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, "Quick link id is required."))
    .min(1, "Provide at least one quick link id to reorder."),
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

function validationFailure(error: z.ZodError, message: string): ProjectQuickLinkMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

async function resolveEditableProjectQuickLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectQuickLinksResult> {
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

export async function buildProjectQuickLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectQuickLinksResult> {
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
      quickLinks: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: {
          id: true,
          label: true,
          url: true,
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
      items: project.quickLinks,
    },
  };
}

export async function createProjectQuickLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectQuickLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; item: ProjectQuickLinkItem }>> {
  const parsed = projectQuickLinkSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project quick link payload is invalid.");
  }

  const access = await resolveEditableProjectQuickLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectQuickLink.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectQuickLink.create({
    data: {
      projectId: access.data.project.id,
      label: parsed.data.label,
      url: parsed.data.url,
      icon: parsed.data.icon,
      openInNewTab: parsed.data.openInNewTab,
      isInternal: parsed.data.isInternal,
      sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      label: true,
      url: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.quick_links,
    entityType: AUDIT_ENTITY_TYPES.projectQuickLink,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: {
      label: created.label,
      url: created.url,
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

export async function updateProjectQuickLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  quickLinkId: string,
  input: unknown
): Promise<ProjectQuickLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; item: ProjectQuickLinkItem }>> {
  const parsedPatch = projectQuickLinkPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project quick link update payload is invalid.");
  }

  const access = await resolveEditableProjectQuickLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectQuickLink.findFirst({
    where: {
      id: quickLinkId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      label: true,
      url: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "quick_link_not_found",
    };
  }

  const normalized = projectQuickLinkSchema.safeParse({
    label: parsedPatch.data.label ?? existing.label,
    url: parsedPatch.data.url ?? existing.url,
    icon: parsedPatch.data.icon ?? existing.icon,
    openInNewTab: parsedPatch.data.openInNewTab ?? existing.openInNewTab,
    isInternal: parsedPatch.data.isInternal ?? existing.isInternal,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project quick link update payload is invalid.");
  }

  const updated = await prisma.projectQuickLink.update({
    where: {
      id: existing.id,
    },
    data: {
      label: normalized.data.label,
      url: normalized.data.url,
      icon: normalized.data.icon,
      openInNewTab: normalized.data.openInNewTab,
      isInternal: normalized.data.isInternal,
    },
    select: {
      id: true,
      label: true,
      url: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.quick_links,
    entityType: AUDIT_ENTITY_TYPES.projectQuickLink,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      label: updated.label,
      url: updated.url,
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

export async function deleteProjectQuickLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  quickLinkId: string
): Promise<ProjectQuickLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; deletedId: string }>> {
  const access = await resolveEditableProjectQuickLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectQuickLink.findFirst({
    where: {
      id: quickLinkId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      label: true,
      url: true,
      icon: true,
      sortOrder: true,
      openInNewTab: true,
      isInternal: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "quick_link_not_found",
    };
  }

  const deleted = await prisma.projectQuickLink.deleteMany({
    where: {
      id: quickLinkId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "quick_link_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.quick_links,
    entityType: AUDIT_ENTITY_TYPES.projectQuickLink,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: {
      label: existing.label,
      url: existing.url,
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
      deletedId: quickLinkId,
    },
  };
}

export async function reorderProjectQuickLinks(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<ProjectQuickLinkMutationResult<{ project: { id: string; slug: string; code: string; name: string }; items: ProjectQuickLinkItem[] }>> {
  const parsed = projectQuickLinkReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project quick link reorder payload is invalid.");
  }

  const access = await resolveEditableProjectQuickLinks(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectQuickLink.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
    select: {
      id: true,
      label: true,
      url: true,
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
      message: "Project quick link reorder payload must include every quick link exactly once.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project quick link reorder payload must include every quick link exactly once.",
        },
      ],
    };
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return {
      ok: false,
      reason: "validation",
      message: "Project quick link reorder payload contains unknown quick links.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project quick link reorder payload contains unknown quick links.",
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
      prisma.projectQuickLink.update({
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
      moduleKey: ModuleKey.quick_links,
      entityType: AUDIT_ENTITY_TYPES.projectQuickLink,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        label: item.before.label,
        url: item.before.url,
        icon: item.before.icon,
        sortOrder: item.afterSortOrder,
        openInNewTab: item.before.openInNewTab,
        isInternal: item.before.isInternal,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectQuickLink.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { id: "asc" }],
    select: {
      id: true,
      label: true,
      url: true,
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