import { ModuleKey, ProjectRole, Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { AUDIT_ACTION_TYPES, AUDIT_ENTITY_TYPES, type AuditEntityType } from "./audit-log.js";
import {
  resolveEffectiveProjectRole,
  resolveProjectAccessModel,
} from "./project-access.js";
import type { ResolvedUser } from "./platform-bootstrap.js";

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

type ProjectAuditValidationFailure = {
  ok: false;
  reason: "validation";
  message: string;
  fieldErrors: Array<{
    field: string;
    code: string;
    message: string;
  }>;
};

type ProjectAuditHistoryResult =
  | {
      ok: true;
      data: {
        project: ProjectRef;
        filters: {
          limit: number;
          beforeId: string | null;
          actionType: keyof typeof AUDIT_ACTION_TYPES | null;
          entityType: AuditEntityType | null;
          moduleKey: ModuleKey | null;
        };
        items: ProjectAuditHistoryItem[];
        pageInfo: {
          hasMore: boolean;
          nextBeforeId: string | null;
        };
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    }
  | ProjectAuditValidationFailure;

export type ProjectAuditHistoryItem = {
  id: string;
  occurredAt: string;
  actionType: keyof typeof AUDIT_ACTION_TYPES;
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  entityId: string | null;
  entityTitle: string | null;
  areaKey: "content" | "configuration" | "system" | "global";
  areaLabel: string;
  moduleKey: ModuleKey | null;
  moduleLabel: string;
  summary: string;
  actor: {
    id: string | null;
    displayName: string | null;
    email: string | null;
    globalRole: string | null;
  };
  project: {
    id: string | null;
    slug: string | null;
    code: string | null;
    name: string | null;
  };
  changedFields: string[];
  metadata: Prisma.JsonValue | null;
};

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  beforeId: z
    .string()
    .trim()
    .regex(/^\d+$/, "beforeId must be a numeric audit id.")
    .optional(),
  actionType: z
    .enum([AUDIT_ACTION_TYPES.create, AUDIT_ACTION_TYPES.update, AUDIT_ACTION_TYPES.delete])
    .optional(),
  entityType: z
    .string()
    .trim()
    .refine(
      (value) => Object.values(AUDIT_ENTITY_TYPES).includes(value as AuditEntityType),
      "Unknown audit entity type."
    )
    .optional(),
  moduleKey: z.nativeEnum(ModuleKey).optional(),
});

const platformAuditQuerySchema = querySchema.extend({
  projectSlug: z.string().trim().min(1).optional(),
});

const PLATFORM_GLOBAL_ENTITY_TYPES: AuditEntityType[] = [
  AUDIT_ENTITY_TYPES.platformAnnouncement,
  AUDIT_ENTITY_TYPES.platformLink,
];

const ACTION_LABELS: Record<keyof typeof AUDIT_ACTION_TYPES, string> = {
  create: "Utworzono",
  update: "Zmieniono",
  delete: "Usunięto",
};

const ENTITY_LABELS: Record<string, string> = {
  [AUDIT_ENTITY_TYPES.platformAnnouncement]: "ogłoszenie globalne",
  [AUDIT_ENTITY_TYPES.platformLink]: "link globalny",
  [AUDIT_ENTITY_TYPES.projectSettings]: "ustawienia projektu",
  [AUDIT_ENTITY_TYPES.projectModuleConfiguration]: "konfiguracja modułu",
  [AUDIT_ENTITY_TYPES.projectMediaUpload]: "plik",
  [AUDIT_ENTITY_TYPES.projectQuickLink]: "szybki link",
  [AUDIT_ENTITY_TYPES.projectLink]: "link",
  [AUDIT_ENTITY_TYPES.projectForm]: "formularz",
  [AUDIT_ENTITY_TYPES.projectFormSubmission]: "wysłanie formularza",
  [AUDIT_ENTITY_TYPES.projectAnnouncement]: "ogłoszenie",
  [AUDIT_ENTITY_TYPES.projectCommunication]: "komunikat",
  [AUDIT_ENTITY_TYPES.projectContact]: "kontakt",
  [AUDIT_ENTITY_TYPES.projectHomeSpotlight]: "ważny temat",
  [AUDIT_ENTITY_TYPES.projectKnowledgeCategory]: "kategoria wiedzy",
  [AUDIT_ENTITY_TYPES.projectKnowledgeArticle]: "artykuł",
  [AUDIT_ENTITY_TYPES.projectImportantTopic]: "ważny temat",
  [AUDIT_ENTITY_TYPES.projectMatrixEntry]: "wpis macierzy",
  [AUDIT_ENTITY_TYPES.projectPricing]: "cennik",
  [AUDIT_ENTITY_TYPES.projectPhrase]: "zwrot",
  [AUDIT_ENTITY_TYPES.projectTemplate]: "szablon",
};

const MODULE_LABELS: Record<string, string> = {
  [ModuleKey.matrix]: "Macierz",
  [ModuleKey.announcements]: "Ogłoszenia",
  [ModuleKey.communications]: "Komunikaty",
  [ModuleKey.templates]: "Szablony",
  [ModuleKey.pricing]: "Cenniki",
  [ModuleKey.links]: "Linki",
  [ModuleKey.forms]: "Formularze",
  [ModuleKey.contacts]: "Kontakty",
  [ModuleKey.phrases]: "Zwroty",
  [ModuleKey.important_topics]: "Ważne tematy",
  [ModuleKey.quick_links]: "Szybkie linki",
  [ModuleKey.home_sections]: "Strona główna",
  [ModuleKey.lead]: "Lead",
};

function canViewProjectAudit(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function toFieldErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "query",
    code: issue.code,
    message: issue.message,
  }));
}

function validationFailure(error: z.ZodError, message: string): ProjectAuditValidationFailure {
  return {
    ok: false,
    reason: "validation",
    message,
    fieldErrors: toFieldErrors(error),
  };
}

function toProjectRef(project: ProjectRef): ProjectRef {
  return {
    id: project.id,
    slug: project.slug,
    code: project.code,
    name: project.name,
  };
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, Prisma.JsonValue>;
}

function asString(value: Prisma.JsonValue | null | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function resolveEntityTitle(metadata: Prisma.JsonValue | null): string | null {
  const record = asRecord(metadata);

  if (!record) {
    return null;
  }

  return (
    asString(record.title) ??
    asString(record.name) ??
    asString(record.labelOverride) ??
    asString(record.slug) ??
    asString(record.code) ??
    asString(record.categorySlug)
  );
}

function resolveArea(entry: { entityType: string; moduleKey: ModuleKey | null }): {
  key: "content" | "configuration" | "system" | "global";
  label: string;
} {
  if (
    entry.entityType === AUDIT_ENTITY_TYPES.platformAnnouncement ||
    entry.entityType === AUDIT_ENTITY_TYPES.platformLink
  ) {
    return {
      key: "global",
      label: "Globalne",
    };
  }

  if (
    entry.entityType === AUDIT_ENTITY_TYPES.projectSettings ||
    entry.entityType === AUDIT_ENTITY_TYPES.projectMediaUpload
  ) {
    return {
      key: "system",
      label: "System",
    };
  }

  if (entry.entityType === AUDIT_ENTITY_TYPES.projectModuleConfiguration) {
    return {
      key: "configuration",
      label: "Konfiguracja",
    };
  }

  return {
    key: "content",
    label: "Treść",
  };
}

function buildSummary(input: {
  actionType: keyof typeof AUDIT_ACTION_TYPES;
  entityType: string;
  entityTitle: string | null;
  moduleKey: ModuleKey | null;
}): string {
  const actionLabel = ACTION_LABELS[input.actionType];
  const entityLabel = ENTITY_LABELS[input.entityType] ?? input.entityType;
  const moduleLabel = input.moduleKey ? MODULE_LABELS[input.moduleKey] ?? input.moduleKey : null;

  if (input.entityTitle && moduleLabel) {
    return `${actionLabel} ${entityLabel} „${input.entityTitle}” w module ${moduleLabel}.`;
  }

  if (input.entityTitle) {
    return `${actionLabel} ${entityLabel} „${input.entityTitle}”.`;
  }

  if (moduleLabel) {
    return `${actionLabel} ${entityLabel} w module ${moduleLabel}.`;
  }

  return `${actionLabel} ${entityLabel}.`;
}

async function resolveProjectAuditContext(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<
  | {
      ok: true;
      data: {
        project: ProjectRef;
        effectiveRole: ProjectRole | null;
      };
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
    }
> {
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
  const effectiveRole = resolveEffectiveProjectRole({
    globalRole: currentUser.globalRole,
    membershipRole,
  });
  const access = resolveProjectAccessModel({
    globalRole: currentUser.globalRole,
    isListed: project.isListed,
    membershipRole,
  });

  if (!access.isVisible) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  if (access.isLocked) {
    return {
      ok: false,
      reason: "locked",
    };
  }

  if (!canViewProjectAudit(effectiveRole)) {
    return {
      ok: false,
      reason: "forbidden",
    };
  }

  return {
    ok: true,
    data: {
      project: toProjectRef(project),
      effectiveRole,
    },
  };
}

type PlatformAuditHistoryResult =
  | {
      ok: true;
      data: {
        scope: "global" | "project";
        filters: {
          limit: number;
          beforeId: string | null;
          actionType: keyof typeof AUDIT_ACTION_TYPES | null;
          entityType: AuditEntityType | null;
          moduleKey: ModuleKey | null;
          projectSlug: string | null;
        };
        items: ProjectAuditHistoryItem[];
        pageInfo: {
          hasMore: boolean;
          nextBeforeId: string | null;
        };
      };
    }
  | { ok: false; reason: "forbidden" | "not_found" }
  | ProjectAuditValidationFailure;

export async function buildPlatformAuditHistory(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  query: unknown
): Promise<PlatformAuditHistoryResult> {
  if (currentUser.globalRole !== "super_admin") {
    return { ok: false, reason: "forbidden" };
  }

  const parsedQuery = platformAuditQuerySchema.safeParse(query);

  if (!parsedQuery.success) {
    return validationFailure(parsedQuery.error, "Platform audit history request is invalid.");
  }

  const scope: "global" | "project" = parsedQuery.data.projectSlug ? "project" : "global";
  let projectId: string | null = null;

  if (parsedQuery.data.projectSlug) {
    const project = await prisma.project.findFirst({
      where: {
        slug: parsedQuery.data.projectSlug,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    projectId = project.id;
  }

  const where: Prisma.AuditLogWhereInput = {
    ...(parsedQuery.data.beforeId
      ? { id: { lt: BigInt(parsedQuery.data.beforeId) } }
      : {}),
    ...(parsedQuery.data.actionType ? { actionType: parsedQuery.data.actionType } : {}),
    ...(parsedQuery.data.moduleKey ? { moduleKey: parsedQuery.data.moduleKey } : {}),
    ...(scope === "project"
      ? { projectId }
      : {
          projectId: null,
          ...(parsedQuery.data.entityType
            ? { entityType: parsedQuery.data.entityType }
            : { entityType: { in: PLATFORM_GLOBAL_ENTITY_TYPES } }),
        }),
    ...(scope === "project" && parsedQuery.data.entityType
      ? { entityType: parsedQuery.data.entityType }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ id: "desc" }],
    take: parsedQuery.data.limit + 1,
    select: {
      id: true,
      occurredAt: true,
      actorUserId: true,
      projectId: true,
      moduleKey: true,
      entityType: true,
      entityId: true,
      actionType: true,
      metadataJson: true,
      actorUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
          globalRole: true,
        },
      },
      project: {
        select: {
          id: true,
          slug: true,
          code: true,
          name: true,
        },
      },
    },
  });

  const hasMore = rows.length > parsedQuery.data.limit;
  const pageRows = hasMore ? rows.slice(0, parsedQuery.data.limit) : rows;
  const items: ProjectAuditHistoryItem[] = pageRows.map((row) => {
    const metadataRecord = asRecord(row.metadataJson);
    const actorMetadata = asRecord(metadataRecord?.actor ?? null);
    const projectMetadata = asRecord(metadataRecord?.project ?? null);
    const entityTitle = resolveEntityTitle(row.metadataJson);
    const area = resolveArea({ entityType: row.entityType, moduleKey: row.moduleKey });
    const actionType = row.actionType as keyof typeof AUDIT_ACTION_TYPES;

    return {
      id: row.id.toString(),
      occurredAt: row.occurredAt.toISOString(),
      actionType,
      actionLabel: ACTION_LABELS[actionType] ?? row.actionType,
      entityType: row.entityType,
      entityLabel: ENTITY_LABELS[row.entityType] ?? row.entityType,
      entityId: row.entityId,
      entityTitle,
      areaKey: area.key,
      areaLabel: area.label,
      moduleKey: row.moduleKey,
      moduleLabel: row.moduleKey ? MODULE_LABELS[row.moduleKey] ?? row.moduleKey : area.label,
      summary: buildSummary({ actionType, entityType: row.entityType, entityTitle, moduleKey: row.moduleKey }),
      actor: {
        id: row.actorUser?.id ?? row.actorUserId,
        displayName: row.actorUser?.displayName ?? asString(actorMetadata?.displayName ?? null),
        email: row.actorUser?.email ?? asString(actorMetadata?.email ?? null),
        globalRole: row.actorUser?.globalRole ?? asString(actorMetadata?.globalRole ?? null),
      },
      project: {
        id: row.project?.id ?? row.projectId,
        slug: row.project?.slug ?? asString(projectMetadata?.slug ?? null),
        code: row.project?.code ?? asString(projectMetadata?.code ?? null),
        name: row.project?.name ?? asString(projectMetadata?.name ?? null),
      },
      changedFields: asStringArray(metadataRecord?.changedFields ?? null),
      metadata: row.metadataJson,
    };
  });

  return {
    ok: true,
    data: {
      scope,
      filters: {
        limit: parsedQuery.data.limit,
        beforeId: parsedQuery.data.beforeId ?? null,
        actionType: parsedQuery.data.actionType ?? null,
        entityType: (parsedQuery.data.entityType as AuditEntityType | undefined) ?? null,
        moduleKey: parsedQuery.data.moduleKey ?? null,
        projectSlug: parsedQuery.data.projectSlug ?? null,
      },
      items,
      pageInfo: {
        hasMore,
        nextBeforeId: hasMore ? pageRows[pageRows.length - 1]?.id.toString() ?? null : null,
      },
    },
  };
}

export async function buildProjectAuditHistory(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string,
  query: unknown
): Promise<ProjectAuditHistoryResult> {
  const parsedQuery = querySchema.safeParse(query);

  if (!parsedQuery.success) {
    return validationFailure(parsedQuery.error, "Audit history request is invalid.");
  }

  const context = await resolveProjectAuditContext(prisma, currentUser, projectSlug);

  if (!context.ok) {
    return context;
  }

  const where: Prisma.AuditLogWhereInput = {
    projectId: context.data.project.id,
    ...(parsedQuery.data.beforeId
      ? {
          id: {
            lt: BigInt(parsedQuery.data.beforeId),
          },
        }
      : {}),
    ...(parsedQuery.data.actionType
      ? {
          actionType: parsedQuery.data.actionType,
        }
      : {}),
    ...(parsedQuery.data.entityType
      ? {
          entityType: parsedQuery.data.entityType,
        }
      : {}),
    ...(parsedQuery.data.moduleKey
      ? {
          moduleKey: parsedQuery.data.moduleKey,
        }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ id: "desc" }],
    take: parsedQuery.data.limit + 1,
    select: {
      id: true,
      occurredAt: true,
      actorUserId: true,
      projectId: true,
      moduleKey: true,
      entityType: true,
      entityId: true,
      actionType: true,
      metadataJson: true,
      actorUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
          globalRole: true,
        },
      },
      project: {
        select: {
          id: true,
          slug: true,
          code: true,
          name: true,
        },
      },
    },
  });

  const hasMore = rows.length > parsedQuery.data.limit;
  const pageRows = hasMore ? rows.slice(0, parsedQuery.data.limit) : rows;
  const items: ProjectAuditHistoryItem[] = pageRows.map((row) => {
    const metadataRecord = asRecord(row.metadataJson);
    const actorMetadata = asRecord(metadataRecord?.actor ?? null);
    const projectMetadata = asRecord(metadataRecord?.project ?? null);
    const entityTitle = resolveEntityTitle(row.metadataJson);
    const area = resolveArea({
      entityType: row.entityType,
      moduleKey: row.moduleKey,
    });
    const actionType = row.actionType as keyof typeof AUDIT_ACTION_TYPES;

    return {
      id: row.id.toString(),
      occurredAt: row.occurredAt.toISOString(),
      actionType,
      actionLabel: ACTION_LABELS[actionType] ?? row.actionType,
      entityType: row.entityType,
      entityLabel: ENTITY_LABELS[row.entityType] ?? row.entityType,
      entityId: row.entityId,
      entityTitle,
      areaKey: area.key,
      areaLabel: area.label,
      moduleKey: row.moduleKey,
      moduleLabel: row.moduleKey ? MODULE_LABELS[row.moduleKey] ?? row.moduleKey : area.label,
      summary: buildSummary({
        actionType,
        entityType: row.entityType,
        entityTitle,
        moduleKey: row.moduleKey,
      }),
      actor: {
        id: row.actorUser?.id ?? row.actorUserId,
        displayName: row.actorUser?.displayName ?? asString(actorMetadata?.displayName ?? null),
        email: row.actorUser?.email ?? asString(actorMetadata?.email ?? null),
        globalRole:
          row.actorUser?.globalRole ?? asString(actorMetadata?.globalRole ?? null),
      },
      project: {
        id: row.project?.id ?? row.projectId,
        slug: row.project?.slug ?? asString(projectMetadata?.slug ?? null),
        code: row.project?.code ?? asString(projectMetadata?.code ?? null),
        name: row.project?.name ?? asString(projectMetadata?.name ?? null),
      },
      changedFields: asStringArray(metadataRecord?.changedFields ?? null),
      metadata: row.metadataJson,
    };
  });

  return {
    ok: true,
    data: {
      project: context.data.project,
      filters: {
        limit: parsedQuery.data.limit,
        beforeId: parsedQuery.data.beforeId ?? null,
        actionType: parsedQuery.data.actionType ?? null,
        entityType: (parsedQuery.data.entityType as AuditEntityType | undefined) ?? null,
        moduleKey: parsedQuery.data.moduleKey ?? null,
      },
      items,
      pageInfo: {
        hasMore,
        nextBeforeId: hasMore ? pageRows[pageRows.length - 1]?.id.toString() ?? null : null,
      },
    },
  };
}