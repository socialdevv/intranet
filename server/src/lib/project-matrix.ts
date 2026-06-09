import { ModuleKey, Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectMatrixCriterion = {
  field: string;
  value: string;
};

export type ProjectMatrixCondition = {
  department: string;
  criteria: ProjectMatrixCriterion[];
};

export type ProjectMatrixItem = {
  id: string;
  category: string;
  subcategory: string;
  keywords: string[];
  description: string;
  slaDays: number;
  instructions: string;
  additionalNotes: string;
  defaultDepartment: string;
  conditions: ProjectMatrixCondition[];
  linkedTemplateIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ProjectMatrixResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectMatrixItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectMatrixResult =
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

type ProjectMatrixMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectMatrixMutationFailure =
  | ProjectMatrixMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "matrix_not_found";
    };

type ProjectMatrixMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectMatrixMutationResult<T> =
  | ProjectMatrixMutationSuccess<T>
  | ProjectMatrixMutationFailure;

type SerializableProjectMatrixRecord = {
  id: string;
  category: string;
  subcategory: string;
  keywords: string[];
  description: string;
  slaDays: number;
  instructions: string;
  additionalNotes: string;
  defaultDepartment: string;
  conditionsJson: Prisma.JsonValue;
  linkedTemplateIds: string[];
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

const MATRIX_MODULE_DEFAULTS = {
  enabled: true,
  navVisible: true,
  navOrder: 10,
} as const;

const matrixCriterionSchema = z.object({
  field: z.string().trim().max(120, "Criterion field must be at most 120 characters."),
  value: z.string().trim().max(200, "Criterion value must be at most 200 characters."),
});

const matrixConditionSchema = z.object({
  department: z.string().trim().max(200, "Department must be at most 200 characters.").default(""),
  criteria: z.array(matrixCriterionSchema).default([]),
});

const matrixConditionsSchema = z.array(matrixConditionSchema).default([]);

const matrixLinkedTemplateIdSchema = z
  .string()
  .trim()
  .min(1, "Linked template id is required.")
  .max(191, "Linked template id must be at most 191 characters.");

const projectMatrixSchema = z.object({
  category: z.string().trim().min(1, "Category is required.").max(160, "Category must be at most 160 characters."),
  subcategory: z.string().trim().min(1, "Subcategory is required.").max(200, "Subcategory must be at most 200 characters."),
  keywords: z.array(z.string().trim().min(1).max(120, "Keyword must be at most 120 characters.")).default([]),
  description: z.string().trim().min(1, "Description is required.").max(10_000, "Description must be at most 10000 characters."),
  slaDays: z.number().int().min(1, "SLA days must be greater than 0.").max(365, "SLA days must be at most 365."),
  instructions: z.string().trim().max(20_000, "Instructions must be at most 20000 characters.").default(""),
  additionalNotes: z.string().trim().max(10_000, "Additional notes must be at most 10000 characters.").default(""),
  defaultDepartment: z.string().trim().max(200, "Default department must be at most 200 characters.").default(""),
  conditions: matrixConditionsSchema,
  linkedTemplateIds: z.array(matrixLinkedTemplateIdSchema).default([]),
});

const projectMatrixPatchSchema = z
  .object({
    category: z.string().trim().min(1, "Category is required.").max(160, "Category must be at most 160 characters.").optional(),
    subcategory: z.string().trim().min(1, "Subcategory is required.").max(200, "Subcategory must be at most 200 characters.").optional(),
    keywords: z.array(z.string().trim().min(1).max(120, "Keyword must be at most 120 characters.")).optional(),
    description: z.string().trim().min(1, "Description is required.").max(10_000, "Description must be at most 10000 characters.").optional(),
    slaDays: z.number().int().min(1, "SLA days must be greater than 0.").max(365, "SLA days must be at most 365.").optional(),
    instructions: z.string().trim().max(20_000, "Instructions must be at most 20000 characters.").optional(),
    additionalNotes: z.string().trim().max(10_000, "Additional notes must be at most 10000 characters.").optional(),
    defaultDepartment: z.string().trim().max(200, "Default department must be at most 200 characters.").optional(),
    conditions: matrixConditionsSchema.optional(),
    linkedTemplateIds: z.array(matrixLinkedTemplateIdSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectMatrixCategoryReorderSchema = z.object({
  orderedCategoryNames: z
    .array(z.string().trim().min(1, "Category name is required."))
    .min(1, "Provide at least one matrix category to reorder."),
});

const projectMatrixEntryReorderSchema = z.object({
  category: z.string().trim().min(1, "Category is required.").max(160, "Category must be at most 160 characters."),
  orderedIds: z
    .array(z.string().trim().min(1, "Matrix entry id is required."))
    .min(1, "Provide at least one matrix entry id to reorder."),
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
): ProjectMatrixMutationValidationFailure {
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
  summary = "Project matrix payload is invalid."
): ProjectMatrixMutationValidationFailure {
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

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }

    const normalized = item.trim();
    return normalized ? [normalized] : [];
  });
}

function normalizeConditions(
  conditions: ProjectMatrixCondition[]
):
  | {
      ok: true;
      data: ProjectMatrixCondition[];
    }
  | ProjectMatrixMutationValidationFailure {
  const normalizedConditions = conditions.map((condition) => ({
    department: condition.department.trim(),
    criteria: condition.criteria.map((criterion) => ({
      field: criterion.field.trim(),
      value: criterion.value.trim(),
    })),
  }));

  const hasPartialCriterion = normalizedConditions.some((condition) =>
    condition.criteria.some(
      (criterion) => Boolean(criterion.field) !== Boolean(criterion.value)
    )
  );

  if (hasPartialCriterion) {
    return customValidationFailure(
      "conditions",
      "Each matrix criterion must include both field and value."
    );
  }

  const compactConditions = normalizedConditions
    .map((condition) => ({
      ...condition,
      criteria: condition.criteria.filter((criterion) => criterion.field && criterion.value),
    }))
    .filter((condition) => condition.department || condition.criteria.length > 0);

  const hasCriteriaWithoutDepartment = compactConditions.some(
    (condition) => condition.criteria.length > 0 && !condition.department
  );

  if (hasCriteriaWithoutDepartment) {
    return customValidationFailure(
      "conditions",
      "Each routing rule with criteria must include a target department."
    );
  }

  return {
    ok: true,
    data: compactConditions,
  };
}

function normalizeStoredConditions(value: Prisma.JsonValue): ProjectMatrixCondition[] {
  const parsed = matrixConditionsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

function serializeProjectMatrix(item: SerializableProjectMatrixRecord): ProjectMatrixItem {
  return {
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    keywords: item.keywords,
    description: item.description,
    slaDays: item.slaDays,
    instructions: item.instructions,
    additionalNotes: item.additionalNotes,
    defaultDepartment: item.defaultDepartment,
    conditions: normalizeStoredConditions(item.conditionsJson),
    linkedTemplateIds: item.linkedTemplateIds,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toStoredConditions(value: ProjectMatrixCondition[]): Prisma.InputJsonArray {
  return value as unknown as Prisma.InputJsonArray;
}

function toAuditComparableMatrix(item: ProjectMatrixItem) {
  return {
    category: item.category,
    subcategory: item.subcategory,
    keywords: JSON.stringify(item.keywords),
    description: item.description,
    slaDays: item.slaDays,
    instructions: item.instructions,
    additionalNotes: item.additionalNotes,
    defaultDepartment: item.defaultDepartment,
    conditions: JSON.stringify(item.conditions),
    linkedTemplateIds: JSON.stringify(item.linkedTemplateIds),
    sortOrder: item.sortOrder,
  };
}

function toAuditMetadata(item: ProjectMatrixItem): Prisma.InputJsonObject {
  return {
    category: item.category,
    subcategory: item.subcategory,
    slaDays: item.slaDays,
    defaultDepartment: item.defaultDepartment,
    ruleCount: item.conditions.length,
    keywordCount: item.keywords.length,
    linkedTemplateCount: item.linkedTemplateIds.length,
    sortOrder: item.sortOrder,
  } satisfies Prisma.InputJsonObject;
}

async function validateLinkedTemplateIds(
  prisma: PrismaClient,
  projectId: string,
  linkedTemplateIds: string[]
): Promise<ProjectMatrixMutationValidationFailure | null> {
  if (linkedTemplateIds.length === 0) {
    return null;
  }

  const count = await prisma.projectTemplate.count({
    where: {
      projectId,
      id: {
        in: linkedTemplateIds,
      },
    },
  });

  if (count !== linkedTemplateIds.length) {
    return customValidationFailure(
      "linkedTemplateIds",
      "One or more linked templates do not belong to the selected project."
    );
  }

  return null;
}

async function resolveEditableProjectMatrix(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectMatrixResult> {
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

async function resolveNextCategorySortOrder(
  prisma: PrismaClient,
  projectId: string,
  category: string,
  excludeId?: string
): Promise<number> {
  const aggregate = await prisma.projectMatrixEntry.aggregate({
    where: {
      projectId,
      category,
      ...(excludeId
        ? {
            id: {
              not: excludeId,
            },
          }
        : {}),
    },
    _max: {
      sortOrder: true,
    },
  });

  return (aggregate._max.sortOrder ?? -1) + 1;
}

function normalizeCreatePayload(
  input: z.infer<typeof projectMatrixSchema>
):
  | {
      ok: true;
      data: z.infer<typeof projectMatrixSchema>;
    }
  | ProjectMatrixMutationValidationFailure {
  const normalizedConditions = normalizeConditions(input.conditions);

  if (!normalizedConditions.ok) {
    return normalizedConditions;
  }

  const data = {
    ...input,
    keywords: uniqueStrings(input.keywords),
    linkedTemplateIds: uniqueStrings(input.linkedTemplateIds),
    conditions: normalizedConditions.data,
  };

  if (data.conditions.length === 0 && !data.defaultDepartment) {
    return customValidationFailure(
      "defaultDepartment",
      "Provide a default department or at least one routing rule."
    );
  }

  return {
    ok: true,
    data,
  };
}

export async function buildProjectMatrix(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectMatrixResult> {
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
      matrixEntries: {
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { subcategory: "asc" }, { id: "asc" }],
        select: {
          id: true,
          category: true,
          subcategory: true,
          keywords: true,
          description: true,
          slaDays: true,
          instructions: true,
          additionalNotes: true,
          defaultDepartment: true,
          conditionsJson: true,
          linkedTemplateIds: true,
          sortOrder: true,
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
      items: project.matrixEntries.map(serializeProjectMatrix),
    },
  };
}

export async function createProjectMatrix(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectMatrixMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectMatrixItem;
  }>
> {
  const parsed = projectMatrixSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project matrix payload is invalid.");
  }

  const normalized = normalizeCreatePayload(parsed.data);

  if (!normalized.ok) {
    return normalized;
  }

  const access = await resolveEditableProjectMatrix(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const linkedTemplateValidation = await validateLinkedTemplateIds(
    prisma,
    access.data.project.id,
    normalized.data.linkedTemplateIds
  );

  if (linkedTemplateValidation) {
    return linkedTemplateValidation;
  }

  const sortOrder = await resolveNextCategorySortOrder(
    prisma,
    access.data.project.id,
    normalized.data.category
  );

  const created = await prisma.projectMatrixEntry.create({
    data: {
      projectId: access.data.project.id,
      category: normalized.data.category,
      subcategory: normalized.data.subcategory,
      keywords: normalized.data.keywords,
      description: normalized.data.description,
      slaDays: normalized.data.slaDays,
      instructions: normalized.data.instructions,
      additionalNotes: normalized.data.additionalNotes,
      defaultDepartment: normalized.data.defaultDepartment,
      conditionsJson: toStoredConditions(normalized.data.conditions),
      linkedTemplateIds: normalized.data.linkedTemplateIds,
      sortOrder,
    },
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serialized = serializeProjectMatrix(created);

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.matrix,
    entityType: AUDIT_ENTITY_TYPES.projectMatrixEntry,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(serialized),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serialized,
    },
  };
}

export async function updateProjectMatrix(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  matrixId: string,
  input: unknown
): Promise<
  ProjectMatrixMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectMatrixItem;
  }>
> {
  const parsed = projectMatrixPatchSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project matrix patch payload is invalid.");
  }

  const access = await resolveEditableProjectMatrix(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectMatrixEntry.findFirst({
    where: {
      id: matrixId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "matrix_not_found",
    };
  }

  const existingSerialized = serializeProjectMatrix(existing);
  const fullPayload = projectMatrixSchema.safeParse({
    category: parsed.data.category ?? existingSerialized.category,
    subcategory: parsed.data.subcategory ?? existingSerialized.subcategory,
    keywords: parsed.data.keywords ?? existingSerialized.keywords,
    description: parsed.data.description ?? existingSerialized.description,
    slaDays: parsed.data.slaDays ?? existingSerialized.slaDays,
    instructions: parsed.data.instructions ?? existingSerialized.instructions,
    additionalNotes: parsed.data.additionalNotes ?? existingSerialized.additionalNotes,
    defaultDepartment: parsed.data.defaultDepartment ?? existingSerialized.defaultDepartment,
    conditions: parsed.data.conditions ?? existingSerialized.conditions,
    linkedTemplateIds: parsed.data.linkedTemplateIds ?? existingSerialized.linkedTemplateIds,
  });

  if (!fullPayload.success) {
    return validationFailure(fullPayload.error, "Project matrix patch payload is invalid.");
  }

  const normalized = normalizeCreatePayload(fullPayload.data);

  if (!normalized.ok) {
    return normalized;
  }

  const linkedTemplateValidation = await validateLinkedTemplateIds(
    prisma,
    access.data.project.id,
    normalized.data.linkedTemplateIds
  );

  if (linkedTemplateValidation) {
    return linkedTemplateValidation;
  }

  const nextSortOrder =
    normalized.data.category === existing.category
      ? existing.sortOrder
      : await resolveNextCategorySortOrder(prisma, access.data.project.id, normalized.data.category, existing.id);

  const updated = await prisma.projectMatrixEntry.update({
    where: {
      id: existing.id,
    },
    data: {
      category: normalized.data.category,
      subcategory: normalized.data.subcategory,
      keywords: normalized.data.keywords,
      description: normalized.data.description,
      slaDays: normalized.data.slaDays,
      instructions: normalized.data.instructions,
      additionalNotes: normalized.data.additionalNotes,
      defaultDepartment: normalized.data.defaultDepartment,
      conditionsJson: toStoredConditions(normalized.data.conditions),
      linkedTemplateIds: normalized.data.linkedTemplateIds,
      sortOrder: nextSortOrder,
    },
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const serialized = serializeProjectMatrix(updated);

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.matrix,
    entityType: AUDIT_ENTITY_TYPES.projectMatrixEntry,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(serialized),
      changedFields: collectChangedFields(
        toAuditComparableMatrix(existingSerialized),
        toAuditComparableMatrix(serialized)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serialized,
    },
  };
}

export async function deleteProjectMatrix(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  matrixId: string
): Promise<
  ProjectMatrixMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectMatrix(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectMatrixEntry.findFirst({
    where: {
      id: matrixId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "matrix_not_found",
    };
  }

  const serialized = serializeProjectMatrix(existing);

  await prisma.projectMatrixEntry.delete({
    where: {
      id: existing.id,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.matrix,
    entityType: AUDIT_ENTITY_TYPES.projectMatrixEntry,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(serialized),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectMatrixCategories(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectMatrixMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    orderedCategoryNames: string[];
  }>
> {
  const parsed = projectMatrixCategoryReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project matrix category reorder payload is invalid.");
  }

  const access = await resolveEditableProjectMatrix(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const categories = uniqueStrings(
    (
      await prisma.projectMatrixEntry.findMany({
        where: {
          projectId: access.data.project.id,
        },
        select: {
          category: true,
        },
        orderBy: [{ category: "asc" }],
      })
    ).map((item) => item.category)
  );

  const orderedCategoryNames = uniqueStrings(parsed.data.orderedCategoryNames);

  if (orderedCategoryNames.length !== categories.length) {
    return customValidationFailure(
      "orderedCategoryNames",
      "Project matrix category reorder payload must include every category exactly once.",
      "Project matrix category reorder payload is invalid."
    );
  }

  const categorySet = new Set(categories);

  if (orderedCategoryNames.some((name) => !categorySet.has(name))) {
    return customValidationFailure(
      "orderedCategoryNames",
      "Project matrix category reorder payload contains unknown categories.",
      "Project matrix category reorder payload is invalid."
    );
  }

  const existingModule = await prisma.projectModule.findUnique({
    where: {
      projectId_moduleKey: {
        projectId: access.data.project.id,
        moduleKey: ModuleKey.matrix,
      },
    },
    select: {
      enabled: true,
      navVisible: true,
      navOrder: true,
      settingsJson: true,
    },
  });

  const existingSettings = toRecord(existingModule?.settingsJson);
  const existingRules = toRecord(existingSettings.rules);
  const previousCategoryOrder = readStringArray(existingRules.matrixCategoryOrder);
  const nextSettings = {
    ...existingSettings,
    rules: {
      ...existingRules,
      matrixCategoryOrder: orderedCategoryNames,
    },
  } satisfies Record<string, unknown>;

  await prisma.projectModule.upsert({
    where: {
      projectId_moduleKey: {
        projectId: access.data.project.id,
        moduleKey: ModuleKey.matrix,
      },
    },
    update: {
      settingsJson: nextSettings as Prisma.InputJsonValue,
    },
    create: {
      projectId: access.data.project.id,
      moduleKey: ModuleKey.matrix,
      enabled: existingModule?.enabled ?? MATRIX_MODULE_DEFAULTS.enabled,
      navVisible: existingModule?.navVisible ?? MATRIX_MODULE_DEFAULTS.navVisible,
      navOrder: existingModule?.navOrder ?? MATRIX_MODULE_DEFAULTS.navOrder,
      settingsJson: nextSettings as Prisma.InputJsonValue,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.matrix,
    entityType: AUDIT_ENTITY_TYPES.projectModuleConfiguration,
    entityId: ModuleKey.matrix,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      changedFields: ["rules.matrixCategoryOrder"],
      before: {
        matrixCategoryOrder: previousCategoryOrder,
      },
      after: {
        matrixCategoryOrder: orderedCategoryNames,
      },
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      orderedCategoryNames,
    },
  };
}

export async function reorderProjectMatrixEntries(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectMatrixMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    items: ProjectMatrixItem[];
  }>
> {
  const parsed = projectMatrixEntryReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project matrix reorder payload is invalid.");
  }

  const access = await resolveEditableProjectMatrix(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectMatrixEntry.findMany({
    where: {
      projectId: access.data.project.id,
      category: parsed.data.category,
    },
    orderBy: [{ sortOrder: "asc" }, { subcategory: "asc" }, { id: "asc" }],
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (existing.length === 0) {
    return customValidationFailure(
      "category",
      "Selected matrix category does not contain any reorderable entries.",
      "Project matrix reorder payload is invalid."
    );
  }

  const orderedIds = uniqueStrings(parsed.data.orderedIds);
  const existingIds = existing.map((item) => item.id);

  if (orderedIds.length !== existingIds.length) {
    return customValidationFailure(
      "orderedIds",
      "Project matrix reorder payload must include every entry in the selected category exactly once.",
      "Project matrix reorder payload is invalid."
    );
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return customValidationFailure(
      "orderedIds",
      "Project matrix reorder payload contains entries outside the selected category.",
      "Project matrix reorder payload is invalid."
    );
  }

  const changedItems = existing
    .map((item) => ({
      before: item,
      afterSortOrder: orderedIds.indexOf(item.id),
    }))
    .filter((item) => item.afterSortOrder !== item.before.sortOrder);

  await prisma.$transaction(
    changedItems.map((item) =>
      prisma.projectMatrixEntry.update({
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
    const serializedBefore = serializeProjectMatrix(item.before);

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: ModuleKey.matrix,
      entityType: AUDIT_ENTITY_TYPES.projectMatrixEntry,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditMetadata(serializedBefore),
        sortOrder: item.afterSortOrder,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectMatrixEntry.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { subcategory: "asc" }, { id: "asc" }],
    select: {
      id: true,
      category: true,
      subcategory: true,
      keywords: true,
      description: true,
      slaDays: true,
      instructions: true,
      additionalNotes: true,
      defaultDepartment: true,
      conditionsJson: true,
      linkedTemplateIds: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map(serializeProjectMatrix),
    },
  };
}