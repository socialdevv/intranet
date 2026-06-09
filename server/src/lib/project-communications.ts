import {
  CommunicationKind,
  CommunicationStatus,
  ModuleKey,
  Prisma,
  ProjectRole,
  type PrismaClient,
} from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectCommunicationItem = {
  id: string;
  title: string;
  body: Prisma.JsonValue;
  status: CommunicationStatus;
  communicationDate: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectCommunicationsResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectCommunicationItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectCommunicationsResult =
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

type ProjectCommunicationMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectCommunicationMutationFailure =
  | ProjectCommunicationMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "communication_not_found";
    };

type ProjectCommunicationMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectCommunicationMutationResult<T> =
  | ProjectCommunicationMutationSuccess<T>
  | ProjectCommunicationMutationFailure;

type SerializableProjectCommunicationRecord = {
  id: string;
  title: string;
  bodyJson: Prisma.JsonValue | null;
  status: CommunicationStatus;
  communicationDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
} satisfies Prisma.JsonObject;

const communicationDocSchema = z.record(z.string(), z.unknown());

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime());
}

const communicationDateSchema = z
  .string()
  .trim()
  .refine(isValidDateOnly, "Communication date must use YYYY-MM-DD.");

const projectCommunicationSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  body: communicationDocSchema.default(EMPTY_TIPTAP_DOC as unknown as Record<string, unknown>),
  status: z.enum(["active", "archived"]).default("active"),
  communicationDate: communicationDateSchema.nullish(),
});

const projectCommunicationPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    body: communicationDocSchema.optional(),
    status: z.enum(["active", "archived"]).optional(),
    communicationDate: communicationDateSchema.nullish(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
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
): ProjectCommunicationMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toStoredJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function toStoredDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function toDateOnlyString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function toSortTimestamp(value: string): number {
  const isoValue = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(isoValue).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
}

function sortCommunications(items: ProjectCommunicationItem[]): ProjectCommunicationItem[] {
  return [...items].sort((left, right) => {
    const leftTimestamp = toSortTimestamp(left.communicationDate ?? left.updatedAt);
    const rightTimestamp = toSortTimestamp(right.communicationDate ?? right.updatedAt);

    if (leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    return left.title.localeCompare(right.title, "pl");
  });
}

function serializeProjectCommunication(
  item: SerializableProjectCommunicationRecord
): ProjectCommunicationItem {
  return {
    id: item.id,
    title: item.title,
    body: item.bodyJson ?? EMPTY_TIPTAP_DOC,
    status: item.status,
    communicationDate: toDateOnlyString(item.communicationDate),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toAuditComparableCommunication(item: SerializableProjectCommunicationRecord) {
  return {
    title: item.title,
    status: item.status,
    communicationDate: toDateOnlyString(item.communicationDate),
    body: JSON.stringify(item.bodyJson ?? EMPTY_TIPTAP_DOC),
  };
}

function toAuditMetadata(item: SerializableProjectCommunicationRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    status: item.status,
    communicationDate: toDateOnlyString(item.communicationDate),
    hasBody: item.bodyJson !== null,
  } satisfies Prisma.InputJsonObject;
}

async function resolveEditableProjectCommunications(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectCommunicationsResult> {
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

export async function buildProjectCommunications(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectCommunicationsResult> {
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
      communications: {
        where: {
          kind: CommunicationKind.communication,
        },
        select: {
          id: true,
          title: true,
          bodyJson: true,
          status: true,
          communicationDate: true,
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
      items: sortCommunications(project.communications.map(serializeProjectCommunication)),
    },
  };
}

export async function createProjectCommunication(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectCommunicationMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectCommunicationItem;
  }>
> {
  const parsed = projectCommunicationSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project communication payload is invalid.");
  }

  const access = await resolveEditableProjectCommunications(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const created = await prisma.projectCommunication.create({
    data: {
      projectId: access.data.project.id,
      kind: CommunicationKind.communication,
      title: parsed.data.title,
      bodyJson: toStoredJson(parsed.data.body),
      status: parsed.data.status,
      communicationDate: toStoredDate(parsed.data.communicationDate),
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      status: true,
      communicationDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.communications,
    entityType: AUDIT_ENTITY_TYPES.projectCommunication,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectCommunication(created),
    },
  };
}

export async function updateProjectCommunication(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  communicationId: string,
  input: unknown
): Promise<
  ProjectCommunicationMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectCommunicationItem;
  }>
> {
  const parsedPatch = projectCommunicationPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project communication update payload is invalid.");
  }

  const access = await resolveEditableProjectCommunications(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectCommunication.findFirst({
    where: {
      id: communicationId,
      projectId: access.data.project.id,
      kind: CommunicationKind.communication,
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      status: true,
      communicationDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "communication_not_found",
    };
  }

  const normalized = projectCommunicationSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    body:
      parsedPatch.data.body === undefined
        ? ((existing.bodyJson ?? EMPTY_TIPTAP_DOC) as Record<string, unknown>)
        : parsedPatch.data.body,
    status: parsedPatch.data.status ?? existing.status,
    communicationDate:
      Object.prototype.hasOwnProperty.call(parsedPatch.data, "communicationDate")
        ? parsedPatch.data.communicationDate
        : toDateOnlyString(existing.communicationDate),
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project communication update payload is invalid.");
  }

  const updated = await prisma.projectCommunication.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      bodyJson: toStoredJson(normalized.data.body),
      status: normalized.data.status,
      communicationDate: toStoredDate(normalized.data.communicationDate),
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      status: true,
      communicationDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.communications,
    entityType: AUDIT_ENTITY_TYPES.projectCommunication,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableCommunication(existing),
        toAuditComparableCommunication(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectCommunication(updated),
    },
  };
}

export async function deleteProjectCommunication(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  communicationId: string
): Promise<
  ProjectCommunicationMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectCommunications(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectCommunication.findFirst({
    where: {
      id: communicationId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      bodyJson: true,
      status: true,
      communicationDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "communication_not_found",
    };
  }

  const deleted = await prisma.projectCommunication.deleteMany({
    where: {
      id: communicationId,
      projectId: access.data.project.id,
      kind: CommunicationKind.communication,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "communication_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.communications,
    entityType: AUDIT_ENTITY_TYPES.projectCommunication,
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