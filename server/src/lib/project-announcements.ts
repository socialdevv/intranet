import { AnnouncementColor, ModuleKey, Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectAnnouncementItem = {
  id: string;
  title: string;
  body?: Prisma.JsonValue;
  description: string;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom?: string;
  visibleUntil?: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectAnnouncementsResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectAnnouncementItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectAnnouncementsResult =
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

type ProjectAnnouncementMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectAnnouncementMutationFailure =
  | ProjectAnnouncementMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "announcement_not_found";
    };

type ProjectAnnouncementMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectAnnouncementMutationResult<T> =
  | ProjectAnnouncementMutationSuccess<T>
  | ProjectAnnouncementMutationFailure;

const announcementColorSchema = z.enum(["red", "orange", "green", "blue"]);

const announcementBodySchema = z.record(z.string(), z.unknown());

const projectAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
    body: announcementBodySchema.optional(),
    description: z.string().trim().max(12000, "Description must be at most 12000 characters.").default(""),
    color: announcementColorSchema.default("blue"),
    active: z.boolean().default(true),
    visibleFrom: z.string().datetime({ offset: true }).nullable().optional(),
    visibleUntil: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .superRefine((value, context) => {
    if (!value.visibleFrom || !value.visibleUntil) {
      return;
    }

    if (new Date(value.visibleUntil).getTime() < new Date(value.visibleFrom).getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visibleUntil"],
        message: "Visible-until must not be earlier than visible-from.",
      });
    }
  });

const projectAnnouncementPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    body: announcementBodySchema.optional(),
    description: z.string().trim().max(12000, "Description must be at most 12000 characters.").optional(),
    color: announcementColorSchema.optional(),
    active: z.boolean().optional(),
    visibleFrom: z.string().datetime({ offset: true }).nullable().optional(),
    visibleUntil: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

type SerializableAnnouncementRecord = {
  id: string;
  title: string;
  bodyJson: Prisma.JsonValue | null;
  description: string;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom: Date | null;
  visibleUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

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
): ProjectAnnouncementMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toStoredJson(
  body: Record<string, unknown> | undefined
): Prisma.InputJsonObject | undefined {
  return body as Prisma.InputJsonObject | undefined;
}

function toAnnouncementDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

function serializeProjectAnnouncement(
  item: SerializableAnnouncementRecord
): ProjectAnnouncementItem {
  return {
    id: item.id,
    title: item.title,
    ...(item.bodyJson !== null ? { body: item.bodyJson } : {}),
    description: item.description,
    color: item.color,
    active: item.active,
    ...(item.visibleFrom ? { visibleFrom: item.visibleFrom.toISOString() } : {}),
    ...(item.visibleUntil ? { visibleUntil: item.visibleUntil.toISOString() } : {}),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toAuditComparableAnnouncement(item: SerializableAnnouncementRecord) {
  return {
    title: item.title,
    description: item.description,
    color: item.color,
    active: item.active,
    visibleFrom: item.visibleFrom?.toISOString() ?? null,
    visibleUntil: item.visibleUntil?.toISOString() ?? null,
    body: JSON.stringify(item.bodyJson ?? null),
  };
}

function toAuditMetadata(item: SerializableAnnouncementRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    description: item.description,
    color: item.color,
    active: item.active,
    visibleFrom: item.visibleFrom?.toISOString() ?? null,
    visibleUntil: item.visibleUntil?.toISOString() ?? null,
    hasBody: item.bodyJson !== null,
  } satisfies Prisma.InputJsonObject;
}

async function resolveEditableProjectAnnouncements(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectAnnouncementsResult> {
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

export async function buildProjectAnnouncements(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectAnnouncementsResult> {
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
      announcements: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          bodyJson: true,
          description: true,
          color: true,
          active: true,
          visibleFrom: true,
          visibleUntil: true,
          createdAt: true,
          updatedAt: true,
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
      items: project.announcements.map(serializeProjectAnnouncement),
    },
  };
}

export async function createProjectAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectAnnouncementMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectAnnouncementItem;
  }>
> {
  const parsed = projectAnnouncementSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project announcement payload is invalid.");
  }

  const access = await resolveEditableProjectAnnouncements(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectAnnouncement.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectAnnouncement.create({
    data: {
      projectId: access.data.project.id,
      title: parsed.data.title,
      bodyJson: toStoredJson(parsed.data.body),
      description: parsed.data.description,
      color: parsed.data.color,
      active: parsed.data.active,
      sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
      visibleFrom: toAnnouncementDate(parsed.data.visibleFrom),
      visibleUntil: toAnnouncementDate(parsed.data.visibleUntil),
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      description: true,
      color: true,
      active: true,
      visibleFrom: true,
      visibleUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.announcements,
    entityType: AUDIT_ENTITY_TYPES.projectAnnouncement,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectAnnouncement(created),
    },
  };
}

export async function updateProjectAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  announcementId: string,
  input: unknown
): Promise<
  ProjectAnnouncementMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectAnnouncementItem;
  }>
> {
  const parsedPatch = projectAnnouncementPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project announcement update payload is invalid.");
  }

  const access = await resolveEditableProjectAnnouncements(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectAnnouncement.findFirst({
    where: {
      id: announcementId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      description: true,
      color: true,
      active: true,
      visibleFrom: true,
      visibleUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "announcement_not_found",
    };
  }

  const normalized = projectAnnouncementSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    body: parsedPatch.data.body === undefined
      ? ((existing.bodyJson ?? undefined) as Record<string, unknown> | undefined)
      : parsedPatch.data.body,
    description: parsedPatch.data.description ?? existing.description,
    color: parsedPatch.data.color ?? existing.color,
    active: parsedPatch.data.active ?? existing.active,
    visibleFrom:
      parsedPatch.data.visibleFrom === undefined
        ? existing.visibleFrom?.toISOString() ?? null
        : parsedPatch.data.visibleFrom,
    visibleUntil:
      parsedPatch.data.visibleUntil === undefined
        ? existing.visibleUntil?.toISOString() ?? null
        : parsedPatch.data.visibleUntil,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project announcement update payload is invalid.");
  }

  const updated = await prisma.projectAnnouncement.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      bodyJson: toStoredJson(normalized.data.body),
      description: normalized.data.description,
      color: normalized.data.color,
      active: normalized.data.active,
      visibleFrom: toAnnouncementDate(normalized.data.visibleFrom),
      visibleUntil: toAnnouncementDate(normalized.data.visibleUntil),
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      description: true,
      color: true,
      active: true,
      visibleFrom: true,
      visibleUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.announcements,
    entityType: AUDIT_ENTITY_TYPES.projectAnnouncement,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableAnnouncement(existing),
        toAuditComparableAnnouncement(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectAnnouncement(updated),
    },
  };
}

export async function deleteProjectAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  announcementId: string
): Promise<
  ProjectAnnouncementMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectAnnouncements(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectAnnouncement.findFirst({
    where: {
      id: announcementId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      description: true,
      color: true,
      active: true,
      visibleFrom: true,
      visibleUntil: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "announcement_not_found",
    };
  }

  const deleted = await prisma.projectAnnouncement.deleteMany({
    where: {
      id: announcementId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "announcement_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.announcements,
    entityType: AUDIT_ENTITY_TYPES.projectAnnouncement,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: announcementId,
    },
  };
}