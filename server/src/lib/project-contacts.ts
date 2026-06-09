import { randomUUID } from "node:crypto";
import { ContactGroup, ModuleKey, Prisma, ProjectRole, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  collectChangedFields,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import type { ApiFieldError } from "./envelope.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

export type ProjectContactItem = {
  id: string;
  title: string;
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  detailTable?: Prisma.JsonValue;
  group: ContactGroup;
  sortOrder: number;
};

type ProjectContactsResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectContactItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectContactsResult =
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

type ProjectContactMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectContactMutationFailure =
  | ProjectContactMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "contact_not_found";
    };

type ProjectContactMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectContactMutationResult<T> =
  | ProjectContactMutationSuccess<T>
  | ProjectContactMutationFailure;

const contactGroupSchema = z.enum(["wewnetrzne", "zewnetrzne"]);

const contactDetailGroupSchema = z.object({
  id: z.string().trim().min(1, "Detail group id is required.").max(191, "Detail group id must be at most 191 characters."),
  items: z.string().trim().max(12000, "Detail group items must be at most 12000 characters.").default(""),
  action: z.string().trim().max(12000, "Detail group action must be at most 12000 characters.").default(""),
});

const contactDetailSectionSchema = z.object({
  id: z.string().trim().min(1, "Detail section id is required.").max(191, "Detail section id must be at most 191 characters."),
  label: z.string().trim().max(160, "Detail section label must be at most 160 characters.").default(""),
  groups: z.array(contactDetailGroupSchema).max(200, "Detail section can contain at most 200 groups.").default([]),
});

const contactDetailTableSchema = z.object({
  title: z.string().trim().max(160, "Detail table title must be at most 160 characters.").optional(),
  sectionHeader: z.string().trim().max(64, "Section header must be at most 64 characters.").optional(),
  itemsHeader: z.string().trim().max(64, "Items header must be at most 64 characters.").optional(),
  actionHeader: z.string().trim().max(64, "Action header must be at most 64 characters.").optional(),
  sections: z.array(contactDetailSectionSchema).max(200, "Detail table can contain at most 200 sections.").default([]),
  notes: z.string().trim().max(4000, "Detail table notes must be at most 4000 characters.").optional(),
});

type ContactDetailTableInput = z.infer<typeof contactDetailTableSchema>;

const projectContactSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(160, "Title must be at most 160 characters."),
  description: z.string().trim().max(500, "Description must be at most 500 characters.").default(""),
  phone: z.string().trim().max(64, "Phone must be at most 64 characters.").nullable().optional(),
  email: z.string().trim().max(320, "Email must be at most 320 characters.").nullable().optional(),
  address: z.string().trim().max(2000, "Address must be at most 2000 characters.").nullable().optional(),
  detailTable: contactDetailTableSchema.nullable().optional(),
  group: contactGroupSchema.default("wewnetrzne"),
});

const projectContactPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(160, "Title must be at most 160 characters.").optional(),
    description: z.string().trim().max(500, "Description must be at most 500 characters.").optional(),
    phone: z.string().trim().max(64, "Phone must be at most 64 characters.").nullable().optional(),
    email: z.string().trim().max(320, "Email must be at most 320 characters.").nullable().optional(),
    address: z.string().trim().max(2000, "Address must be at most 2000 characters.").nullable().optional(),
    detailTable: contactDetailTableSchema.nullable().optional(),
    group: contactGroupSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

const projectContactReorderSchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1, "Contact id is required."))
    .min(1, "Provide at least one contact id to reorder."),
});

type SerializableContactRecord = {
  id: string;
  title: string;
  description: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  detailTableJson: Prisma.JsonValue | null;
  group: ContactGroup;
  sortOrder: number;
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
): ProjectContactMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStoredDetailTable(
  value: ContactDetailTableInput | null | undefined
): Prisma.InputJsonObject | typeof Prisma.JsonNull | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  return {
    ...(value.title ? { title: value.title } : {}),
    ...(value.sectionHeader ? { sectionHeader: value.sectionHeader } : {}),
    ...(value.itemsHeader ? { itemsHeader: value.itemsHeader } : {}),
    ...(value.actionHeader ? { actionHeader: value.actionHeader } : {}),
    sections: value.sections.map((section) => ({
      id: section.id,
      label: section.label,
      groups: section.groups.map((group) => ({
        id: group.id,
        items: group.items,
        action: group.action,
      })),
    })),
    ...(value.notes ? { notes: value.notes } : {}),
  } satisfies Prisma.InputJsonObject;
}

function serializeProjectContact(item: SerializableContactRecord): ProjectContactItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    ...(item.phone ? { phone: item.phone } : {}),
    ...(item.email ? { email: item.email } : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.detailTableJson !== null ? { detailTable: item.detailTableJson } : {}),
    group: item.group,
    sortOrder: item.sortOrder,
  };
}

function toAuditComparableContact(item: SerializableContactRecord) {
  return {
    title: item.title,
    description: item.description,
    phone: item.phone,
    email: item.email,
    address: item.address,
    group: item.group,
    detailTable: JSON.stringify(item.detailTableJson ?? null),
  };
}

function toAuditMetadata(item: SerializableContactRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    description: item.description,
    phone: item.phone,
    email: item.email,
    address: item.address,
    group: item.group,
    sortOrder: item.sortOrder,
    hasDetailTable: item.detailTableJson !== null,
  } satisfies Prisma.InputJsonObject;
}

async function resolveEditableProjectContacts(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectContactsResult> {
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

export async function buildProjectContacts(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectContactsResult> {
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
      contacts: {
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          phone: true,
          email: true,
          address: true,
          detailTableJson: true,
          group: true,
          sortOrder: true,
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

  return {
    ok: true,
    data: {
      project: {
        id: project.id,
        slug: project.slug,
        code: project.code,
        name: project.name,
      },
      items: project.contacts.map(serializeProjectContact),
    },
  };
}

export async function createProjectContact(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  payload: unknown
): Promise<
  ProjectContactMutationResult<{
    project: {
      id: string;
      slug: string;
      code: string;
      name: string;
    };
    item: ProjectContactItem;
  }>
> {
  const parsed = projectContactSchema.safeParse(payload);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project contact payload is invalid.");
  }

  const projectResult = await resolveEditableProjectContacts(prisma, currentUser, projectSlug);

  if (!projectResult.ok) {
    return projectResult;
  }

  const lastContact = await prisma.projectContact.findFirst({
    where: {
      projectId: projectResult.data.project.id,
    },
    orderBy: [{ sortOrder: "desc" }, { id: "desc" }],
    select: {
      sortOrder: true,
    },
  });

  const created = await prisma.projectContact.create({
    data: {
      id: randomUUID(),
      projectId: projectResult.data.project.id,
      title: parsed.data.title,
      description: parsed.data.description,
      phone: normalizeNullableText(parsed.data.phone),
      email: normalizeNullableText(parsed.data.email),
      address: normalizeNullableText(parsed.data.address),
      detailTableJson: toStoredDetailTable(parsed.data.detailTable),
      group: parsed.data.group,
      sortOrder: (lastContact?.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectResult.data.project,
    moduleKey: ModuleKey.contacts,
    entityType: AUDIT_ENTITY_TYPES.projectContact,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: projectResult.data.project,
      item: serializeProjectContact(created),
    },
  };
}

export async function updateProjectContact(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  contactId: string,
  payload: unknown
): Promise<
  ProjectContactMutationResult<{
    project: {
      id: string;
      slug: string;
      code: string;
      name: string;
    };
    item: ProjectContactItem;
  }>
> {
  const parsed = projectContactPatchSchema.safeParse(payload);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project contact patch payload is invalid.");
  }

  const projectResult = await resolveEditableProjectContacts(prisma, currentUser, projectSlug);

  if (!projectResult.ok) {
    return projectResult;
  }

  const existing = await prisma.projectContact.findFirst({
    where: {
      id: contactId,
      projectId: projectResult.data.project.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "contact_not_found",
    };
  }

  const nextData: Prisma.ProjectContactUpdateInput = {};

  if (Object.prototype.hasOwnProperty.call(parsed.data, "title")) {
    nextData.title = parsed.data.title;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "description")) {
    nextData.description = parsed.data.description;
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "phone")) {
    nextData.phone = normalizeNullableText(parsed.data.phone);
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "email")) {
    nextData.email = normalizeNullableText(parsed.data.email);
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "address")) {
    nextData.address = normalizeNullableText(parsed.data.address);
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "detailTable")) {
    nextData.detailTableJson = toStoredDetailTable(parsed.data.detailTable);
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, "group")) {
    nextData.group = parsed.data.group;
  }

  const updated = await prisma.projectContact.update({
    where: {
      id: existing.id,
    },
    data: nextData,
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectResult.data.project,
    moduleKey: ModuleKey.contacts,
    entityType: AUDIT_ENTITY_TYPES.projectContact,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableContact(existing),
        toAuditComparableContact(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: projectResult.data.project,
      item: serializeProjectContact(updated),
    },
  };
}

export async function deleteProjectContact(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  contactId: string
): Promise<
  ProjectContactMutationResult<{
    project: {
      id: string;
      slug: string;
      code: string;
      name: string;
    };
    deletedId: string;
  }>
> {
  const projectResult = await resolveEditableProjectContacts(prisma, currentUser, projectSlug);

  if (!projectResult.ok) {
    return projectResult;
  }

  const existing = await prisma.projectContact.findFirst({
    where: {
      id: contactId,
      projectId: projectResult.data.project.id,
    },
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  if (!existing) {
    return {
      ok: false,
      reason: "contact_not_found",
    };
  }

  await prisma.projectContact.delete({
    where: {
      id: existing.id,
    },
  });

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: projectResult.data.project,
    moduleKey: ModuleKey.contacts,
    entityType: AUDIT_ENTITY_TYPES.projectContact,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: projectResult.data.project,
      deletedId: existing.id,
    },
  };
}

export async function reorderProjectContacts(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectContactMutationResult<{
    project: {
      id: string;
      slug: string;
      code: string;
      name: string;
    };
    items: ProjectContactItem[];
  }>
> {
  const parsed = projectContactReorderSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project contact reorder payload is invalid.");
  }

  const projectResult = await resolveEditableProjectContacts(prisma, currentUser, projectSlug);

  if (!projectResult.ok) {
    return projectResult;
  }

  const existing = await prisma.projectContact.findMany({
    where: {
      projectId: projectResult.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  const orderedIds = [...new Set(parsed.data.orderedIds.map((id) => id.trim()))];
  const existingIds = existing.map((item) => item.id);

  if (orderedIds.length !== existingIds.length) {
    return {
      ok: false,
      reason: "validation",
      message: "Project contact reorder payload must include every contact exactly once.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project contact reorder payload must include every contact exactly once.",
        },
      ],
    };
  }

  const existingIdSet = new Set(existingIds);

  if (orderedIds.some((id) => !existingIdSet.has(id))) {
    return {
      ok: false,
      reason: "validation",
      message: "Project contact reorder payload contains unknown contacts.",
      fieldErrors: [
        {
          field: "orderedIds",
          code: "custom",
          message: "Project contact reorder payload contains unknown contacts.",
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
      prisma.projectContact.update({
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
      project: projectResult.data.project,
      moduleKey: ModuleKey.contacts,
      entityType: AUDIT_ENTITY_TYPES.projectContact,
      entityId: item.before.id,
      actionType: AUDIT_ACTION_TYPES.update,
      metadata: {
        ...toAuditMetadata(item.before),
        sortOrder: item.afterSortOrder,
        changedFields: ["sortOrder"],
      },
    });
  }

  const items = await prisma.projectContact.findMany({
    where: {
      projectId: projectResult.data.project.id,
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      phone: true,
      email: true,
      address: true,
      detailTableJson: true,
      group: true,
      sortOrder: true,
    },
  });

  return {
    ok: true,
    data: {
      project: projectResult.data.project,
      items: items.map(serializeProjectContact),
    },
  };
}