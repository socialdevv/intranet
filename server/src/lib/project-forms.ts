import { ModuleKey, ProjectRole, Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectFormFieldType = "text" | "textarea" | "select" | "checkbox";

export type ProjectFormField = {
  id: string;
  label: string;
  type: ProjectFormFieldType;
  required: boolean;
  placeholder?: string;
  options?: Array<{
    value: string;
    label: string;
  }>;
};

export type ProjectFormItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  fields: ProjectFormField[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectFormSubmissionItem = {
  id: string;
  formId: string;
  formSlug: string;
  formTitle: string;
  payload: Prisma.JsonValue;
  submitter: {
    userId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
  };
  deliveryStatus: string;
  deliveryNote: string | null;
  createdAt: string;
};

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

type ViewProjectFormsResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditProjectFormsResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    };

type ValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type MutationFailureReason =
  | "not_found"
  | "locked"
  | "forbidden"
  | "form_not_found"
  | "form_not_active";

type MutationResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      reason: MutationFailureReason;
    }
  | ValidationFailure;

type QueryResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    }
  | ValidationFailure;

const formFieldOptionSchema = z.object({
  value: z.string().trim().min(1, "Option value is required.").max(120),
  label: z.string().trim().min(1, "Option label is required.").max(160),
});

const formFieldSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Field id is required.")
      .max(80, "Field id must be at most 80 characters.")
      .regex(
        /^[a-z0-9]+(?:_[a-z0-9]+)*$/,
        "Field id may contain lowercase letters, digits, and underscores."
      ),
    label: z.string().trim().min(1, "Field label is required.").max(160),
    type: z.enum(["text", "textarea", "select", "checkbox"]),
    required: z.boolean().default(false),
    placeholder: z.string().trim().max(200).optional(),
    options: z.array(formFieldOptionSchema).max(50).optional(),
  })
  .superRefine((value, context) => {
    if (value.type === "select") {
      if (!value.options || value.options.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Select field requires at least one option.",
        });
      }
      return;
    }

    if (value.options && value.options.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options are only allowed for select fields.",
      });
    }
  });

const formCreateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Form slug must contain at least 2 characters.")
      .max(80, "Form slug must be at most 80 characters.")
      .transform((value) => value.toLowerCase())
      .refine(
        (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        "Form slug may contain only lowercase letters, digits, and single dashes between segments."
      ),
    title: z.string().trim().min(1, "Form title is required.").max(160),
    description: z.string().trim().max(500, "Form description must be at most 500 characters.").default(""),
    isActive: z.boolean().default(true),
    fields: z.array(formFieldSchema).min(1, "Form must contain at least one field.").max(40),
  })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    value.fields.forEach((field, index) => {
      if (ids.has(field.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", index, "id"],
          message: "Field ids must be unique within a form.",
        });
      }
      ids.add(field.id);
    });
  });

const formPatchSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(2, "Form slug must contain at least 2 characters.")
      .max(80, "Form slug must be at most 80 characters.")
      .transform((value) => value.toLowerCase())
      .refine(
        (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
        "Form slug may contain only lowercase letters, digits, and single dashes between segments."
      )
      .optional(),
    title: z.string().trim().min(1, "Form title is required.").max(160).optional(),
    description: z.string().trim().max(500, "Form description must be at most 500 characters.").optional(),
    isActive: z.boolean().optional(),
    fields: z.array(formFieldSchema).min(1).max(40).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })
  .superRefine((value, context) => {
    if (!value.fields) {
      return;
    }

    const ids = new Set<string>();
    value.fields.forEach((field, index) => {
      if (ids.has(field.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields", index, "id"],
          message: "Field ids must be unique within a form.",
        });
      }
      ids.add(field.id);
    });
  });

const submissionSchema = z.object({
  answers: z.record(z.unknown()).default({}),
});

const submissionsQuerySchema = z.object({
  formId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(150),
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

function validationFailure(error: z.ZodError, message: string): ValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function splitDisplayName(displayName: string): {
  firstName: string | null;
  lastName: string | null;
} {
  const normalized = displayName.trim();
  if (!normalized) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {
      firstName: null,
      lastName: null,
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: null,
    };
  }

  return {
    firstName: parts[0] ?? null,
    lastName: parts.slice(1).join(" ") || null,
  };
}

function sanitizeFormFieldsForStorage(fields: ProjectFormField[]): Prisma.InputJsonValue {
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    type: field.type,
    required: field.required,
    ...(field.placeholder ? { placeholder: field.placeholder } : {}),
    ...(field.options ? { options: field.options } : {}),
  })) as Prisma.InputJsonValue;
}

function parseStoredFormFields(value: Prisma.JsonValue): ProjectFormField[] {
  const parsed = z.array(formFieldSchema).safeParse(value);
  if (!parsed.success) {
    return [];
  }

  return parsed.data;
}

function serializeFormRecord(record: {
  id: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  fieldsJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): ProjectFormItem {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description,
    isActive: record.isActive,
    sortOrder: record.sortOrder,
    fields: parseStoredFormFields(record.fieldsJson),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toFormComparable(value: {
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  fields: ProjectFormField[];
}) {
  return {
    slug: value.slug,
    title: value.title,
    description: value.description,
    isActive: value.isActive,
    fields: JSON.stringify(value.fields),
  };
}

function ensureStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function normalizeBooleanValue(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value === "true" || value === "1" || value === "on") {
      return true;
    }
    if (value === "false" || value === "0" || value === "off") {
      return false;
    }
  }
  return false;
}

function normalizeSubmissionAnswers(
  fields: ProjectFormField[],
  answers: Record<string, unknown>
): {
  ok: true;
  answers: Record<string, string | boolean | null>;
} | ValidationFailure {
  const normalized: Record<string, string | boolean | null> = {};
  const fieldErrors: ApiFieldError[] = [];

  for (const field of fields) {
    const rawValue = answers[field.id];

    if (field.type === "checkbox") {
      const boolValue = normalizeBooleanValue(rawValue);
      if (field.required && !boolValue) {
        fieldErrors.push({
          field: `answers.${field.id}`,
          code: "custom",
          message: `Field "${field.label}" must be checked.`,
        });
      }
      normalized[field.id] = boolValue;
      continue;
    }

    const textValue = ensureStringValue(rawValue).trim();

    if (field.required && textValue.length === 0) {
      fieldErrors.push({
        field: `answers.${field.id}`,
        code: "custom",
        message: `Field "${field.label}" is required.`,
      });
      normalized[field.id] = null;
      continue;
    }

    if (textValue.length === 0) {
      normalized[field.id] = null;
      continue;
    }

    if (field.type === "text" && textValue.length > 500) {
      fieldErrors.push({
        field: `answers.${field.id}`,
        code: "too_big",
        message: `Field "${field.label}" must be at most 500 characters.`,
      });
      continue;
    }

    if (field.type === "textarea" && textValue.length > 5000) {
      fieldErrors.push({
        field: `answers.${field.id}`,
        code: "too_big",
        message: `Field "${field.label}" must be at most 5000 characters.`,
      });
      continue;
    }

    if (field.type === "select") {
      const options = field.options ?? [];
      if (!options.some((option) => option.value === textValue)) {
        fieldErrors.push({
          field: `answers.${field.id}`,
          code: "custom",
          message: `Field "${field.label}" contains an unsupported value.`,
        });
        continue;
      }
    }

    normalized[field.id] = textValue;
  }

  if (fieldErrors.length > 0) {
    return {
      ok: false,
      reason: "validation",
      message: "Form submission payload is invalid.",
      fieldErrors,
    };
  }

  return {
    ok: true,
    answers: normalized,
  };
}

async function resolveViewProjectForForms(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ViewProjectFormsResult> {
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

  const membershipRole = project.memberships[0]?.effectiveRole ?? null;
  const hasMembership = membershipRole !== null;
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
    },
  };
}

async function resolveEditProjectForForms(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditProjectFormsResult> {
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

  const membershipRole = project.memberships[0]?.effectiveRole ?? null;
  const hasMembership = membershipRole !== null;
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

  if (!canEditProjectContent(membershipRole)) {
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

export async function buildProjectForms(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<QueryResult<{ project: ProjectRef; items: ProjectFormItem[] }>> {
  const access = await resolveViewProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const items = await prisma.projectForm.findMany({
    where: {
      projectId: access.data.project.id,
      isActive: true,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      sortOrder: true,
      fieldsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map(serializeFormRecord),
    },
  };
}

export async function buildProjectFormsAdmin(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<QueryResult<{ project: ProjectRef; items: ProjectFormItem[] }>> {
  const access = await resolveEditProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const items = await prisma.projectForm.findMany({
    where: {
      projectId: access.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      sortOrder: true,
      fieldsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map(serializeFormRecord),
    },
  };
}

export async function createProjectForm(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<MutationResult<{ project: ProjectRef; item: ProjectFormItem }>> {
  const parsed = formCreateSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error, "Project form payload is invalid.");
  }

  const access = await resolveEditProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const sortOrderAggregate = await prisma.projectForm.aggregate({
    where: {
      projectId: access.data.project.id,
    },
    _max: {
      sortOrder: true,
    },
  });

  try {
    const created = await prisma.projectForm.create({
      data: {
        projectId: access.data.project.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
        fieldsJson: sanitizeFormFieldsForStorage(parsed.data.fields),
        sortOrder: (sortOrderAggregate._max.sortOrder ?? -1) + 1,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        isActive: true,
        sortOrder: true,
        fieldsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const serialized = serializeFormRecord(created);

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: ModuleKey.forms,
      entityType: AUDIT_ENTITY_TYPES.projectForm,
      entityId: created.id,
      actionType: AUDIT_ACTION_TYPES.create,
      metadata: {
        slug: created.slug,
        title: created.title,
        description: created.description,
        isActive: created.isActive,
        sortOrder: created.sortOrder,
        fieldCount: serialized.fields.length,
      },
    });

    return {
      ok: true,
      data: {
        project: access.data.project,
        item: serialized,
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        reason: "validation",
        message: "Project form payload is invalid.",
        fieldErrors: [
          {
            field: "slug",
            code: "unique",
            message: "Form slug is already used in this project.",
          },
        ],
      };
    }

    throw error;
  }
}

export async function updateProjectForm(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  formId: string,
  input: unknown
): Promise<MutationResult<{ project: ProjectRef; item: ProjectFormItem }>> {
  const parsed = formPatchSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error, "Project form update payload is invalid.");
  }

  const access = await resolveEditProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectForm.findFirst({
    where: {
      id: formId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      sortOrder: true,
      fieldsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "form_not_found",
    };
  }

  const nextFields = parsed.data.fields ?? parseStoredFormFields(existing.fieldsJson);

  const nextData = {
    slug: parsed.data.slug ?? existing.slug,
    title: parsed.data.title ?? existing.title,
    description: parsed.data.description ?? existing.description,
    isActive: parsed.data.isActive ?? existing.isActive,
    fields: nextFields,
  };

  try {
    const updated = await prisma.projectForm.update({
      where: {
        id: existing.id,
      },
      data: {
        slug: nextData.slug,
        title: nextData.title,
        description: nextData.description,
        isActive: nextData.isActive,
        fieldsJson: sanitizeFormFieldsForStorage(nextData.fields),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        isActive: true,
        sortOrder: true,
        fieldsJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const beforeComparable = toFormComparable({
      slug: existing.slug,
      title: existing.title,
      description: existing.description,
      isActive: existing.isActive,
      fields: parseStoredFormFields(existing.fieldsJson),
    });
    const afterComparable = toFormComparable(nextData);

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: access.data.project,
      moduleKey: ModuleKey.forms,
      entityType: AUDIT_ENTITY_TYPES.projectForm,
      entityId: updated.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        slug: updated.slug,
        title: updated.title,
        description: updated.description,
        isActive: updated.isActive,
        sortOrder: updated.sortOrder,
        fieldCount: nextData.fields.length,
        changedFields: collectChangedFields(beforeComparable, afterComparable),
      },
    });

    return {
      ok: true,
      data: {
        project: access.data.project,
        item: serializeFormRecord(updated),
      },
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        reason: "validation",
        message: "Project form update payload is invalid.",
        fieldErrors: [
          {
            field: "slug",
            code: "unique",
            message: "Form slug is already used in this project.",
          },
        ],
      };
    }

    throw error;
  }
}

export async function deleteProjectForm(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  formId: string
): Promise<MutationResult<{ project: ProjectRef; deletedId: string }>> {
  const access = await resolveEditProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectForm.findFirst({
    where: {
      id: formId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      isActive: true,
      sortOrder: true,
      fieldsJson: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "form_not_found",
    };
  }

  await prisma.projectForm.delete({
    where: {
      id: existing.id,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.forms,
    entityType: AUDIT_ENTITY_TYPES.projectForm,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: {
      slug: existing.slug,
      title: existing.title,
      description: existing.description,
      isActive: existing.isActive,
      sortOrder: existing.sortOrder,
      fieldCount: parseStoredFormFields(existing.fieldsJson).length,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: existing.id,
    },
  };
}

export async function submitProjectForm(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  formId: string,
  input: unknown
): Promise<MutationResult<{ project: ProjectRef; submission: ProjectFormSubmissionItem }>> {
  const parsed = submissionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error, "Form submission payload is invalid.");
  }

  const access = await resolveViewProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const form = await prisma.projectForm.findFirst({
    where: {
      id: formId,
      projectId: access.data.project.id,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      fieldsJson: true,
      isActive: true,
    },
  });

  if (!form) {
    return {
      ok: false,
      reason: "form_not_found",
    };
  }

  if (!form.isActive) {
    return {
      ok: false,
      reason: "form_not_active",
    };
  }

  const fields = parseStoredFormFields(form.fieldsJson);
  const normalizedAnswers = normalizeSubmissionAnswers(fields, parsed.data.answers);
  if (!normalizedAnswers.ok) {
    return normalizedAnswers;
  }

  const splitName = splitDisplayName(currentUser.displayName);
  const created = await prisma.projectFormSubmission.create({
    data: {
      projectId: access.data.project.id,
      formId: form.id,
      payloadJson: {
        answers: normalizedAnswers.answers,
        fields: fields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
        })),
      } satisfies Prisma.InputJsonObject,
      submitterUserId: currentUser.id,
      submitterEmail: currentUser.email,
      submitterFirstName: splitName.firstName,
      submitterLastName: splitName.lastName,
      submitterDisplayName: currentUser.displayName,
      deliveryStatus: "not_configured",
      deliveryNote:
        "Submission stored in DB. External delivery integration is not configured yet.",
    },
    select: {
      id: true,
      payloadJson: true,
      submitterUserId: true,
      submitterEmail: true,
      submitterFirstName: true,
      submitterLastName: true,
      submitterDisplayName: true,
      deliveryStatus: true,
      deliveryNote: true,
      createdAt: true,
    },
  });

  const submission: ProjectFormSubmissionItem = {
    id: created.id,
    formId: form.id,
    formSlug: form.slug,
    formTitle: form.title,
    payload: created.payloadJson,
    submitter: {
      userId: created.submitterUserId,
      email: created.submitterEmail,
      firstName: created.submitterFirstName,
      lastName: created.submitterLastName,
      displayName: created.submitterDisplayName,
    },
    deliveryStatus: created.deliveryStatus,
    deliveryNote: created.deliveryNote,
    createdAt: created.createdAt.toISOString(),
  };

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.forms,
    entityType: AUDIT_ENTITY_TYPES.projectFormSubmission,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: {
      formId: form.id,
      formSlug: form.slug,
      formTitle: form.title,
      submitterEmail: created.submitterEmail,
      fieldCount: fields.length,
      deliveryStatus: created.deliveryStatus,
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      submission,
    },
  };
}

export async function buildProjectFormSubmissions(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  query: unknown
): Promise<QueryResult<{ project: ProjectRef; items: ProjectFormSubmissionItem[] }>> {
  const parsed = submissionsQuerySchema.safeParse(query);
  if (!parsed.success) {
    return validationFailure(parsed.error, "Project form submissions query is invalid.");
  }

  const access = await resolveEditProjectForForms(prisma, currentUser, projectSlug);
  if (!access.ok) {
    return access;
  }

  const items = await prisma.projectFormSubmission.findMany({
    where: {
      projectId: access.data.project.id,
      ...(parsed.data.formId
        ? {
            formId: parsed.data.formId,
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: parsed.data.limit,
    select: {
      id: true,
      formId: true,
      payloadJson: true,
      submitterUserId: true,
      submitterEmail: true,
      submitterFirstName: true,
      submitterLastName: true,
      submitterDisplayName: true,
      deliveryStatus: true,
      deliveryNote: true,
      createdAt: true,
      form: {
        select: {
          slug: true,
          title: true,
        },
      },
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      items: items.map((item) => ({
        id: item.id,
        formId: item.formId,
        formSlug: item.form.slug,
        formTitle: item.form.title,
        payload: item.payloadJson,
        submitter: {
          userId: item.submitterUserId,
          email: item.submitterEmail,
          firstName: item.submitterFirstName,
          lastName: item.submitterLastName,
          displayName: item.submitterDisplayName,
        },
        deliveryStatus: item.deliveryStatus,
        deliveryNote: item.deliveryNote,
        createdAt: item.createdAt.toISOString(),
      })),
    },
  };
}
