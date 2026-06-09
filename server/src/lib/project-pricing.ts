import { ModuleKey, Prisma, PricingStatus, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectPricingItem = {
  id: string;
  title: string;
  subtitle?: string;
  provider?: string;
  effectiveFrom: string;
  status: PricingStatus;
  footnotes: string[];
  sections: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

type ProjectPricingResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectPricingItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectPricingResult =
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

type ProjectPricingMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectPricingMutationFailure =
  | ProjectPricingMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "pricing_not_found";
    };

type ProjectPricingMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectPricingMutationResult<T> =
  | ProjectPricingMutationSuccess<T>
  | ProjectPricingMutationFailure;

type SerializableProjectPricingRecord = {
  id: string;
  title: string;
  subtitle: string | null;
  provider: string | null;
  effectiveFrom: Date;
  status: PricingStatus;
  footnotes: string[];
  sectionsJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const optionalNullableShortText = (label: string, maxLength: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().max(maxLength, `${label} must be at most ${maxLength} characters.`).nullable().optional()
  );

const footnoteSchema = z.string().trim().max(2_000, "Footnote must be at most 2000 characters.");

const pricingColumnSchema = z.object({
  key: z.string().trim().min(1, "Column key is required.").max(120, "Column key must be at most 120 characters."),
  label: z.string().max(200, "Column label must be at most 200 characters."),
});

const pricingRowSchema = z.object({
  id: z.string().trim().min(1, "Row id is required.").max(191, "Row id must be at most 191 characters."),
  label: z.string().max(200, "Row label must be at most 200 characters."),
  symbol: z.string().max(120, "Row symbol must be at most 120 characters.").optional(),
  unit: z.string().max(64, "Row unit must be at most 64 characters.").optional(),
  values: z.record(z.string().max(200, "Cell value must be at most 200 characters.")),
});

const pricingTableSectionSchema = z.object({
  type: z.literal("table"),
  id: z.string().trim().min(1, "Section id is required.").max(191, "Section id must be at most 191 characters."),
  title: z.string().trim().min(1, "Section title is required.").max(200, "Section title must be at most 200 characters."),
  description: z.string().trim().max(2_000, "Section description must be at most 2000 characters.").optional(),
  unit: z.string().max(64, "Section unit must be at most 64 characters."),
  columns: z.array(pricingColumnSchema),
  rows: z.array(pricingRowSchema),
  footnotes: z.array(footnoteSchema).optional(),
});

const pricingChargeVariantSchema = z.object({
  id: z.string().trim().min(1, "Charge variant id is required.").max(191, "Charge variant id must be at most 191 characters."),
  conditions: z.string().max(200, "Charge variant conditions must be at most 200 characters."),
  value: z.string().max(200, "Charge variant value must be at most 200 characters."),
});

const pricingChargeItemSchema = z.object({
  id: z.string().trim().min(1, "Charge item id is required.").max(191, "Charge item id must be at most 191 characters."),
  name: z.string().max(200, "Charge item name must be at most 200 characters."),
  unit: z.string().max(64, "Charge item unit must be at most 64 characters."),
  variants: z.array(pricingChargeVariantSchema),
});

const pricingChargesSectionSchema = z.object({
  type: z.literal("charges"),
  id: z.string().trim().min(1, "Section id is required.").max(191, "Section id must be at most 191 characters."),
  title: z.string().trim().min(1, "Section title is required.").max(200, "Section title must be at most 200 characters."),
  description: z.string().trim().max(2_000, "Section description must be at most 2000 characters.").optional(),
  items: z.array(pricingChargeItemSchema),
  footnotes: z.array(footnoteSchema).optional(),
});

const pricingSectionsSchema = z
  .array(z.union([pricingTableSectionSchema, pricingChargesSectionSchema]))
  .min(1, "At least one pricing section is required.");

const projectPricingSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  subtitle: optionalNullableShortText("Subtitle", 200),
  provider: optionalNullableShortText("Provider", 200),
  effectiveFrom: z.string().regex(DATE_ONLY_PATTERN, "Effective from must use YYYY-MM-DD format."),
  status: z.enum(["active", "archived"]).default("active"),
  footnotes: z.array(footnoteSchema).optional().default([]),
  sections: pricingSectionsSchema,
});

const projectPricingPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    subtitle: optionalNullableShortText("Subtitle", 200),
    provider: optionalNullableShortText("Provider", 200),
    effectiveFrom: z.string().regex(DATE_ONLY_PATTERN, "Effective from must use YYYY-MM-DD format.").optional(),
    status: z.enum(["active", "archived"]).optional(),
    footnotes: z.array(footnoteSchema).optional(),
    sections: pricingSectionsSchema.optional(),
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
): ProjectPricingMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function serializeDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toStoredSections(value: z.infer<typeof pricingSectionsSchema>): Prisma.InputJsonArray {
  return value as unknown as Prisma.InputJsonArray;
}

function serializeProjectPricing(item: SerializableProjectPricingRecord): ProjectPricingItem {
  return {
    id: item.id,
    title: item.title,
    ...(item.subtitle ? { subtitle: item.subtitle } : {}),
    ...(item.provider ? { provider: item.provider } : {}),
    effectiveFrom: serializeDateOnly(item.effectiveFrom),
    status: item.status,
    footnotes: item.footnotes,
    sections: Array.isArray(item.sectionsJson) ? item.sectionsJson : [],
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toAuditComparablePricing(item: SerializableProjectPricingRecord) {
  return {
    title: item.title,
    subtitle: item.subtitle ?? "",
    provider: item.provider ?? "",
    effectiveFrom: serializeDateOnly(item.effectiveFrom),
    status: item.status,
    footnotes: JSON.stringify(item.footnotes),
    sections: JSON.stringify(item.sectionsJson),
  };
}

function toAuditMetadata(item: SerializableProjectPricingRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    subtitle: item.subtitle,
    provider: item.provider,
    effectiveFrom: serializeDateOnly(item.effectiveFrom),
    status: item.status,
    footnoteCount: item.footnotes.length,
    sectionCount: Array.isArray(item.sectionsJson) ? item.sectionsJson.length : 0,
  } satisfies Prisma.InputJsonObject;
}

async function resolveEditableProjectPricing(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectPricingResult> {
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

export async function buildProjectPricing(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectPricingResult> {
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
      pricingDocuments: {
        orderBy: [{ effectiveFrom: "desc" }, { updatedAt: "desc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          subtitle: true,
          provider: true,
          effectiveFrom: true,
          status: true,
          footnotes: true,
          sectionsJson: true,
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
      items: project.pricingDocuments.map(serializeProjectPricing),
    },
  };
}

export async function createProjectPricing(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectPricingMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectPricingItem;
  }>
> {
  const parsed = projectPricingSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project pricing payload is invalid.");
  }

  const access = await resolveEditableProjectPricing(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const created = await prisma.projectPricingDocument.create({
    data: {
      projectId: access.data.project.id,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      provider: parsed.data.provider ?? null,
      effectiveFrom: toDateOnly(parsed.data.effectiveFrom),
      status: parsed.data.status,
      footnotes: parsed.data.footnotes,
      sectionsJson: toStoredSections(parsed.data.sections),
    },
    select: {
      id: true,
      title: true,
      subtitle: true,
      provider: true,
      effectiveFrom: true,
      status: true,
      footnotes: true,
      sectionsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.pricing,
    entityType: AUDIT_ENTITY_TYPES.projectPricing,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectPricing(created),
    },
  };
}

export async function updateProjectPricing(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  pricingId: string,
  input: unknown
): Promise<
  ProjectPricingMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectPricingItem;
  }>
> {
  const parsedPatch = projectPricingPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project pricing update payload is invalid.");
  }

  const access = await resolveEditableProjectPricing(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectPricingDocument.findFirst({
    where: {
      id: pricingId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      subtitle: true,
      provider: true,
      effectiveFrom: true,
      status: true,
      footnotes: true,
      sectionsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "pricing_not_found",
    };
  }

  const normalized = projectPricingSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    subtitle: parsedPatch.data.subtitle === undefined ? existing.subtitle : parsedPatch.data.subtitle,
    provider: parsedPatch.data.provider === undefined ? existing.provider : parsedPatch.data.provider,
    effectiveFrom: parsedPatch.data.effectiveFrom ?? serializeDateOnly(existing.effectiveFrom),
    status: parsedPatch.data.status ?? existing.status,
    footnotes: parsedPatch.data.footnotes ?? existing.footnotes,
    sections: parsedPatch.data.sections ?? (Array.isArray(existing.sectionsJson) ? existing.sectionsJson : []),
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project pricing update payload is invalid.");
  }

  const updated = await prisma.projectPricingDocument.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      subtitle: normalized.data.subtitle ?? null,
      provider: normalized.data.provider ?? null,
      effectiveFrom: toDateOnly(normalized.data.effectiveFrom),
      status: normalized.data.status,
      footnotes: normalized.data.footnotes,
      sectionsJson: toStoredSections(normalized.data.sections),
    },
    select: {
      id: true,
      title: true,
      subtitle: true,
      provider: true,
      effectiveFrom: true,
      status: true,
      footnotes: true,
      sectionsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.pricing,
    entityType: AUDIT_ENTITY_TYPES.projectPricing,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparablePricing(existing),
        toAuditComparablePricing(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectPricing(updated),
    },
  };
}

export async function deleteProjectPricing(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  pricingId: string
): Promise<
  ProjectPricingMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectPricing(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectPricingDocument.findFirst({
    where: {
      id: pricingId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      title: true,
      subtitle: true,
      provider: true,
      effectiveFrom: true,
      status: true,
      footnotes: true,
      sectionsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "pricing_not_found",
    };
  }

  const deleted = await prisma.projectPricingDocument.deleteMany({
    where: {
      id: pricingId,
      projectId: access.data.project.id,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "pricing_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.pricing,
    entityType: AUDIT_ENTITY_TYPES.projectPricing,
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