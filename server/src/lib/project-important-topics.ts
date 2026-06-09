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

export type ProjectImportantTopicItem = {
  id: string;
  title: string;
  body: Prisma.JsonValue;
  status: CommunicationStatus;
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectImportantTopicsResult =
  | {
      ok: true;
      data: {
        project: {
          id: string;
          slug: string;
          code: string;
          name: string;
        };
        items: ProjectImportantTopicItem[];
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked";
    };

type EditableProjectImportantTopicsResult =
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

type ProjectImportantTopicMutationValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: ApiFieldError[];
};

type ProjectImportantTopicMutationFailure =
  | ProjectImportantTopicMutationValidationFailure
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden" | "topic_not_found";
    };

type ProjectImportantTopicMutationSuccess<T> = {
  ok: true;
  data: T;
};

type ProjectImportantTopicMutationResult<T> =
  | ProjectImportantTopicMutationSuccess<T>
  | ProjectImportantTopicMutationFailure;

type SerializableImportantTopicRecord = {
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

const importantTopicStatusSchema = z.enum(["active", "archived"]);
const importantTopicBodySchema = z.record(z.string(), z.unknown());
const isoDateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

const importantTopicEntryDateSchema = z.string().trim().refine(
  (value) => {
    if (!isoDateOnlyPattern.test(value)) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  },
  {
    message: "Entry date must be a valid ISO date in YYYY-MM-DD format.",
  }
);

const projectImportantTopicSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters."),
  body: importantTopicBodySchema,
  status: importantTopicStatusSchema.default("active"),
  entryDate: importantTopicEntryDateSchema.optional(),
});

const projectImportantTopicPatchSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be at most 200 characters.").optional(),
    body: importantTopicBodySchema.optional(),
    status: importantTopicStatusSchema.optional(),
    entryDate: importantTopicEntryDateSchema.optional(),
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
): ProjectImportantTopicMutationValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toStoredJson(body: Record<string, unknown>): Prisma.InputJsonObject {
  return body as Prisma.InputJsonObject;
}

function toImportantTopicEntryDate(value: string | undefined): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function serializeEntryDate(value: Date | null): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

function serializeProjectImportantTopic(
  item: SerializableImportantTopicRecord
): ProjectImportantTopicItem {
  return {
    id: item.id,
    title: item.title,
    body: item.bodyJson ?? EMPTY_TIPTAP_DOC,
    status: item.status,
    ...(item.communicationDate ? { entryDate: serializeEntryDate(item.communicationDate) } : {}),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function toAuditComparableImportantTopic(item: SerializableImportantTopicRecord) {
  return {
    title: item.title,
    status: item.status,
    entryDate: serializeEntryDate(item.communicationDate) ?? null,
    body: JSON.stringify(item.bodyJson ?? EMPTY_TIPTAP_DOC),
  };
}

function toAuditMetadata(item: SerializableImportantTopicRecord): Prisma.InputJsonObject {
  return {
    title: item.title,
    status: item.status,
    entryDate: serializeEntryDate(item.communicationDate) ?? null,
    hasBody: item.bodyJson !== null,
  } satisfies Prisma.InputJsonObject;
}

function sortImportantTopics(
  items: SerializableImportantTopicRecord[]
): SerializableImportantTopicRecord[] {
  return [...items].sort((left, right) => {
    const leftTimestamp = new Date(
      `${serializeEntryDate(left.communicationDate) ?? left.updatedAt.toISOString().slice(0, 10)}T00:00:00.000Z`
    ).getTime();
    const rightTimestamp = new Date(
      `${serializeEntryDate(right.communicationDate) ?? right.updatedAt.toISOString().slice(0, 10)}T00:00:00.000Z`
    ).getTime();

    return rightTimestamp - leftTimestamp || left.title.localeCompare(right.title);
  });
}

async function resolveEditableProjectImportantTopics(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<EditableProjectImportantTopicsResult> {
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

export async function buildProjectImportantTopics(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectImportantTopicsResult> {
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
          kind: CommunicationKind.organizational_topic,
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
      items: sortImportantTopics(project.communications).map(serializeProjectImportantTopic),
    },
  };
}

export async function createProjectImportantTopic(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  input: unknown
): Promise<
  ProjectImportantTopicMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectImportantTopicItem;
  }>
> {
  const parsed = projectImportantTopicSchema.safeParse(input);

  if (!parsed.success) {
    return validationFailure(parsed.error, "Project important topic payload is invalid.");
  }

  const access = await resolveEditableProjectImportantTopics(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const created = await prisma.projectCommunication.create({
    data: {
      projectId: access.data.project.id,
      kind: CommunicationKind.organizational_topic,
      title: parsed.data.title,
      bodyJson: toStoredJson(parsed.data.body),
      status: parsed.data.status,
      communicationDate: toImportantTopicEntryDate(parsed.data.entryDate),
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
    moduleKey: ModuleKey.important_topics,
    entityType: AUDIT_ENTITY_TYPES.projectImportantTopic,
    entityId: created.id,
    actionType: AUDIT_ACTION_TYPES.create,
    metadata: toAuditMetadata(created),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectImportantTopic(created),
    },
  };
}

export async function updateProjectImportantTopic(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  topicId: string,
  input: unknown
): Promise<
  ProjectImportantTopicMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    item: ProjectImportantTopicItem;
  }>
> {
  const parsedPatch = projectImportantTopicPatchSchema.safeParse(input);

  if (!parsedPatch.success) {
    return validationFailure(parsedPatch.error, "Project important topic update payload is invalid.");
  }

  const access = await resolveEditableProjectImportantTopics(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectCommunication.findFirst({
    where: {
      id: topicId,
      projectId: access.data.project.id,
      kind: CommunicationKind.organizational_topic,
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
      reason: "topic_not_found",
    };
  }

  const normalized = projectImportantTopicSchema.safeParse({
    title: parsedPatch.data.title ?? existing.title,
    body: parsedPatch.data.body === undefined
      ? ((existing.bodyJson ?? EMPTY_TIPTAP_DOC) as Record<string, unknown>)
      : parsedPatch.data.body,
    status: parsedPatch.data.status ?? existing.status,
    entryDate: parsedPatch.data.entryDate ?? serializeEntryDate(existing.communicationDate),
  });

  if (!normalized.success) {
    return validationFailure(normalized.error, "Project important topic update payload is invalid.");
  }

  const updated = await prisma.projectCommunication.update({
    where: {
      id: existing.id,
    },
    data: {
      title: normalized.data.title,
      bodyJson: toStoredJson(normalized.data.body),
      status: normalized.data.status,
      communicationDate: toImportantTopicEntryDate(normalized.data.entryDate),
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
    moduleKey: ModuleKey.important_topics,
    entityType: AUDIT_ENTITY_TYPES.projectImportantTopic,
    entityId: updated.id,
    actionType: AUDIT_ACTION_TYPES.update,
    metadata: {
      ...toAuditMetadata(updated),
      changedFields: collectChangedFields(
        toAuditComparableImportantTopic(existing),
        toAuditComparableImportantTopic(updated)
      ),
    },
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      item: serializeProjectImportantTopic(updated),
    },
  };
}

export async function deleteProjectImportantTopic(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  topicId: string
): Promise<
  ProjectImportantTopicMutationResult<{
    project: { id: string; slug: string; code: string; name: string };
    deletedId: string;
  }>
> {
  const access = await resolveEditableProjectImportantTopics(prisma, currentUser, projectSlug);

  if (!access.ok) {
    return access;
  }

  const existing = await prisma.projectCommunication.findFirst({
    where: {
      id: topicId,
      projectId: access.data.project.id,
      kind: CommunicationKind.organizational_topic,
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
      reason: "topic_not_found",
    };
  }

  const deleted = await prisma.projectCommunication.deleteMany({
    where: {
      id: topicId,
      projectId: access.data.project.id,
      kind: CommunicationKind.organizational_topic,
    },
  });

  if (deleted.count === 0) {
    return {
      ok: false,
      reason: "topic_not_found",
    };
  }

  await recordAuditLogBestEffort(prisma, {
    actor: currentUser,
    project: access.data.project,
    moduleKey: ModuleKey.important_topics,
    entityType: AUDIT_ENTITY_TYPES.projectImportantTopic,
    entityId: existing.id,
    actionType: AUDIT_ACTION_TYPES.delete,
    metadata: toAuditMetadata(existing),
  });

  return {
    ok: true,
    data: {
      project: access.data.project,
      deletedId: topicId,
    },
  };
}