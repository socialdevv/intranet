import { GlobalRole, Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";
import { getDefaultProjectModuleDefinitions } from "./project-configuration.js";

export type PlatformProjectItem = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isListed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type PlatformProjectMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type PlatformProjectMutationFailure =
  | PlatformProjectMutationValidationFailure
  | {
      ok: false;
      reason: "forbidden";
    };

type PlatformProjectMutationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | PlatformProjectMutationFailure;

const createPlatformProjectSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Project slug must contain at least 2 characters.")
      .max(80, "Project slug cannot exceed 80 characters.")
      .transform((value) => value.toLowerCase())
      .refine(
        (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        "Project slug may contain only lowercase letters, digits, and single dashes between segments."
      ),
    code: z
      .string()
      .trim()
      .min(2, "Project code must contain at least 2 characters.")
      .max(64, "Project code cannot exceed 64 characters.")
      .transform((value) => value.toUpperCase())
      .refine(
        (value) => /^[A-Z0-9][A-Z0-9._-]*$/.test(value),
        "Project code may contain only letters, digits, dots, underscores, and dashes."
      ),
    name: z
      .string()
      .trim()
      .min(2, "Project name must contain at least 2 characters.")
      .max(120, "Project name cannot exceed 120 characters."),
  })
  .strict();

function canCreatePlatformProjects(globalRole: GlobalRole): boolean {
  return globalRole === GlobalRole.super_admin;
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
): PlatformProjectMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function conflictFailure(field: "slug" | "code", message: string): PlatformProjectMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: [
      {
        field,
        code: "unique",
        message,
      },
    ],
  };
}

function serializePlatformProject(item: {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isListed: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PlatformProjectItem {
  return {
    id: item.id,
    slug: item.slug,
    code: item.code,
    name: item.name,
    description: item.description,
    sortOrder: item.sortOrder,
    isListed: item.isListed,
    isActive: item.isActive,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function createPlatformProject(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  input: unknown
): Promise<PlatformProjectMutationResult<{ project: PlatformProjectItem }>> {
  if (!canCreatePlatformProjects(currentUser.globalRole)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  const parsed = createPlatformProjectSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Platform project payload is invalid.");
  }

  const moduleDefaults = getDefaultProjectModuleDefinitions();

  try {
    const created = await prisma.$transaction(async (tx) => {
      const aggregate = await tx.project.aggregate({
        _max: {
          sortOrder: true,
        },
      });
      const nextSortOrder = (aggregate._max.sortOrder ?? 0) + 10;

      const project = await tx.project.create({
        data: {
          slug: parsed.data.slug,
          code: parsed.data.code,
          name: parsed.data.name,
          isListed: true,
          isActive: true,
          sortOrder: nextSortOrder,
        },
        select: {
          id: true,
          slug: true,
          code: true,
          name: true,
          description: true,
          sortOrder: true,
          isListed: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.projectModule.createMany({
        data: moduleDefaults.map((moduleEntry) => ({
          projectId: project.id,
          moduleKey: moduleEntry.moduleKey,
          enabled: moduleEntry.enabled,
          navVisible: moduleEntry.navVisible,
          navOrder: moduleEntry.navOrder,
          settingsJson: moduleEntry.settingsJson as Prisma.InputJsonValue,
        })),
      });

      await tx.projectMembership.create({
        data: {
          projectId: project.id,
          userId: currentUser.id,
          effectiveRole: ProjectRole.project_admin,
        },
      });

      return project;
    });

    const auditAfter = {
      slug: created.slug,
      code: created.code,
      name: created.name,
      sortOrder: created.sortOrder,
      isListed: created.isListed,
      isActive: created.isActive,
      bootstrap: {
        moduleCount: moduleDefaults.length,
        creatorRole: "project_admin",
      },
    };

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: {
        id: created.id,
        slug: created.slug,
        code: created.code,
        name: created.name,
      },
      entityType: AUDIT_ENTITY_TYPES.projectSettings,
      entityId: created.id,
      actionType: AUDIT_ACTION_TYPES.create,
      metadata: {
        changedFields: collectChangedFields({}, auditAfter),
        before: null,
        after: auditAfter,
      },
    });

    return {
      ok: true,
      data: {
        project: serializePlatformProject(created),
      },
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : typeof error.meta?.target === "string"
          ? error.meta.target
          : "";

      if (target.includes("slug")) {
        return conflictFailure("slug", "Slug projektu jest już zajęty.");
      }

      if (target.includes("code")) {
        return conflictFailure("code", "Kod projektu jest już zajęty.");
      }
    }

    throw error;
  }
}
