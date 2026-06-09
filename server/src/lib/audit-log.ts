import { ModuleKey, Prisma, type PrismaClient } from "@prisma/client";
import type { ResolvedUser } from "./platform-bootstrap.js";

export const AUDIT_ENTITY_TYPES = {
  platformAnnouncement: "platform_announcement",
  platformLink: "platform_link",
  projectSettings: "project_settings",
  projectModuleConfiguration: "project_module_configuration",
  projectMediaUpload: "project_media_upload",
  projectQuickLink: "project_quick_link",
  projectLink: "project_link",
  projectForm: "project_form",
  projectFormSubmission: "project_form_submission",
  projectAnnouncement: "project_announcement",
  projectCommunication: "project_communication",
  projectContact: "project_contact",
  projectHomeSpotlight: "project_home_spotlight",
  projectKnowledgeCategory: "project_knowledge_category",
  projectKnowledgeArticle: "project_knowledge_article",
  projectImportantTopic: "project_important_topic",
  projectMatrixEntry: "project_matrix_entry",
  projectPricing: "project_pricing_document",
  projectPhrase: "project_phrase",
  projectTemplate: "project_template",
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];

export const AUDIT_ACTION_TYPES = {
  create: "create",
  update: "update",
  delete: "delete",
} as const;

export type AuditActionType = (typeof AUDIT_ACTION_TYPES)[keyof typeof AUDIT_ACTION_TYPES];

export type AuditProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

export type RecordAuditLogInput = {
  actor?: ResolvedUser | null;
  project?: AuditProjectRef | null;
  moduleKey?: ModuleKey | null;
  entityType: AuditEntityType;
  entityId?: string | null;
  actionType: AuditActionType;
  metadata?: Prisma.InputJsonObject;
};

export function collectChangedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): string[] {
  return Object.keys(after).filter((fieldName) => before[fieldName] !== after[fieldName]);
}

function buildMetadata(input: RecordAuditLogInput): Prisma.InputJsonObject | undefined {
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.actor
      ? {
          actor: {
            email: input.actor.email,
            displayName: input.actor.displayName,
            globalRole: input.actor.globalRole,
          },
        }
      : {}),
    ...(input.project
      ? {
          project: {
            slug: input.project.slug,
            code: input.project.code,
            name: input.project.name,
          },
        }
      : {}),
  } satisfies Prisma.InputJsonObject;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export async function recordAuditLog(prisma: PrismaClient, input: RecordAuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor?.id ?? null,
      projectId: input.project?.id ?? null,
      moduleKey: input.moduleKey ?? null,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      actionType: input.actionType,
      metadataJson: buildMetadata(input),
    },
  });
}

export async function recordAuditLogBestEffort(
  prisma: PrismaClient,
  input: RecordAuditLogInput
): Promise<void> {
  try {
    await recordAuditLog(prisma, input);
  } catch (error) {
    console.error("Failed to persist technical audit event.", {
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      projectId: input.project?.id ?? null,
      actorUserId: input.actor?.id ?? null,
      error,
    });
  }
}