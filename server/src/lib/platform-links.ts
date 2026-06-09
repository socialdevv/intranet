import { GlobalRole, Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type PlatformLinkItem = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

type PlatformLinkMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type PlatformLinkMutationFailure =
  | PlatformLinkMutationValidationFailure
  | {
      ok: false;
      reason: "forbidden" | "link_not_found";
    };

type PlatformLinkMutationSuccess<T> = {
  ok: true;
  data: T;
};

type PlatformLinkMutationResult<T> = PlatformLinkMutationSuccess<T> | PlatformLinkMutationFailure;

const platformLinkSchema = z
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
          message: "Internal platform links must start with '/' and cannot contain spaces.",
        });
      }

      return;
    }

    if (!isValidHttpUrl(value.url)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "External platform links must use an absolute http:// or https:// URL.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    openInNewTab: value.isInternal ? false : value.openInNewTab,
  }));

const platformLinkPatchSchema = z
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

function canManagePlatformContent(role: GlobalRole): boolean {
  return role === GlobalRole.super_admin || role === GlobalRole.global_moderator;
}

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

function toFieldErrors(error: z.ZodError): ApiFieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    code: issue.code,
    message: issue.message,
  }));
}

function validationFailure(error: z.ZodError, message: string): PlatformLinkMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toAuditMetadata(item: PlatformLinkItem): Prisma.InputJsonObject {
  return {
    title: item.title,
    url: item.url,
    description: item.description,
    icon: item.icon,
    sortOrder: item.sortOrder,
    openInNewTab: item.openInNewTab,
    isInternal: item.isInternal,
  } satisfies Prisma.InputJsonObject;
}

function ensurePlatformLinkWriteAccess(
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

export async function buildPlatformLinks(prisma: PrismaClient) {
  const items = await prisma.platformLink.findMany({
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
    items,
  };
}

export async function buildHomepagePlatformLinks(prisma: PrismaClient) {
  const items = await prisma.platformLink.findMany({
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

  return items;
}

export async function createPlatformLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  input: unknown
): Promise<PlatformLinkMutationResult<{ item: PlatformLinkItem }>> {
  const accessFailure = ensurePlatformLinkWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const parsed = platformLinkSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Platform link payload is invalid.");
  }

  const sortOrderAggregate = await prisma.platformLink.aggregate({
    _max: {
      sortOrder: true,
    },
  });

  const created = await prisma.platformLink.create({
    data: {
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
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformLink,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      item: created,
    },
  };
}

export async function updatePlatformLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  linkId: string,
  input: unknown
): Promise<PlatformLinkMutationResult<{ item: PlatformLinkItem }>> {
  const accessFailure = ensurePlatformLinkWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const parsedPatch = platformLinkPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Platform link update payload is invalid.");
  }

  const existing = await prisma.platformLink.findUnique({
    where: {
      id: linkId,
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

  const normalized = platformLinkSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    url: parsedPatch.data.url ?? existing.url,
    description: parsedPatch.data.description ?? existing.description,
    icon: parsedPatch.data.icon ?? existing.icon,
    openInNewTab: parsedPatch.data.openInNewTab ?? existing.openInNewTab,
    isInternal: parsedPatch.data.isInternal ?? existing.isInternal,
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Platform link update payload is invalid.");
  }

  const updated = await prisma.platformLink.update({
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
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformLink,
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
      item: updated,
    },
  };
}

export async function deletePlatformLink(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  linkId: string
): Promise<PlatformLinkMutationResult<{ deletedId: string }>> {
  const accessFailure = ensurePlatformLinkWriteAccess(currentUser);

  if (accessFailure) {
    return accessFailure;
  }

  const existing = await prisma.platformLink.findUnique({
    where: {
      id: linkId,
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

  await prisma.platformLink.delete({
    where: {
      id: linkId,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    moduleKey: null,
    entityType: AUDIT_ENTITY_TYPES.platformLink,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      deletedId: linkId,
    },
  };
}