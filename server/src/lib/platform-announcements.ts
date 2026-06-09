import { AnnouncementColor, GlobalRole, Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type PlatformAnnouncementItem = {
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

type PlatformAnnouncementMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type PlatformAnnouncementMutationFailure =
  | PlatformAnnouncementMutationValidationFailure
  | {
      ok: false;
      reason: "forbidden" | "announcement_not_found";
    };

type PlatformAnnouncementMutationSuccess<T> = {
  ok: true;
  data: T;
};

type PlatformAnnouncementMutationResult<T> =
  | PlatformAnnouncementMutationSuccess<T>
  | PlatformAnnouncementMutationFailure;

type SerializablePlatformAnnouncementRecord = {
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

const announcementColorSchema = z.enum(["red", "orange", "green", "blue"]);

const announcementBodySchema = z.record(z.string(), z.unknown());

const platformAnnouncementSchema = z
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

const platformAnnouncementPatchSchema = z
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

function canManagePlatformContent(role: GlobalRole): boolean {
  return role === GlobalRole.super_admin || role === GlobalRole.global_moderator;
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
): PlatformAnnouncementMutationValidationFailure {
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

function serializePlatformAnnouncement(
  item: SerializablePlatformAnnouncementRecord
): PlatformAnnouncementItem {
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

function toAuditComparableAnnouncement(item: SerializablePlatformAnnouncementRecord) {
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

function toAuditMetadata(item: SerializablePlatformAnnouncementRecord): Prisma.InputJsonObject {
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

function ensurePlatformAnnouncementWriteAccess(
  currentUser: ResolvedUser
): { ok: false; reason: "forbidden" } | null {
  if (canManagePlatformContent(currentUser.globalRole)) {
    return null;
  }

  return {
    ok: false,
    reason: "forbidden",
  };
}

export async function buildPlatformAnnouncements(prisma: PrismaClient) {
  const items = await prisma.platformAnnouncement.findMany({
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
  });

  return {
    items: items.map(serializePlatformAnnouncement),
  };
}

export async function buildHomepagePlatformAnnouncements(prisma: PrismaClient) {
  const now = new Date();
  const items = await prisma.platformAnnouncement.findMany({
    where: {
      active: true,
      AND: [
        {
          OR: [{ visibleFrom: null }, { visibleFrom: { lte: now } }],
        },
        {
          OR: [{ visibleUntil: null }, { visibleUntil: { gte: now } }],
        },
      ],
    },
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
  });

  return items.map(serializePlatformAnnouncement);
}

export async function createPlatformAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  input: unknown
): Promise<PlatformAnnouncementMutationResult<{ item: PlatformAnnouncementItem }>> {
  const accessFailure = ensurePlatformAnnouncementWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const parsed = platformAnnouncementSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Platform announcement payload is invalid.");
  }

  const sortOrderAggregate = await prisma.platformAnnouncement.aggregate({
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.platformAnnouncement.create({
    data: {
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
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformAnnouncement,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      item: serializePlatformAnnouncement(created),
    },
  };
}

export async function updatePlatformAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  announcementId: string,
  input: unknown
): Promise<PlatformAnnouncementMutationResult<{ item: PlatformAnnouncementItem }>> {
  const accessFailure = ensurePlatformAnnouncementWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const parsedPatch = platformAnnouncementPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Platform announcement update payload is invalid.");
  }

  const existing = await prisma.platformAnnouncement.findUnique({
    where: {
      id: announcementId,
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

  const normalized = platformAnnouncementSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    body:
      parsedPatch.data.body === undefined
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
    return validationFailure(normalized.error, "Platform announcement update payload is invalid.");
  }

  const updated = await prisma.platformAnnouncement.update({
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
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformAnnouncement,
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
      item: serializePlatformAnnouncement(updated),
    },
  };
}

export async function deletePlatformAnnouncement(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  announcementId: string
): Promise<PlatformAnnouncementMutationResult<{ deletedId: string }>> {
  const accessFailure = ensurePlatformAnnouncementWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const existing = await prisma.platformAnnouncement.findUnique({
    where: {
      id: announcementId,
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

  await prisma.platformAnnouncement.delete({
    where: {
      id: announcementId,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformAnnouncement,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      deletedId: announcementId,
    },
  };
}