import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectAuditHistoryItem = {
  id: string;
  occurredAt: string;
  actionType: "create" | "update" | "delete";
  actionLabel: string;
  entityType: string;
  entityLabel: string;
  entityId: string | null;
  entityTitle: string | null;
  areaKey: "content" | "configuration" | "system" | "global";
  areaLabel: string;
  moduleKey: string | null;
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
  metadata: unknown;
};

export type ProjectAuditHistoryResponse = ApiEnvelope<{
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  filters: {
    limit: number;
    beforeId: string | null;
    actionType: "create" | "update" | "delete" | null;
    entityType: string | null;
    moduleKey: string | null;
  };
  items: ProjectAuditHistoryItem[];
  pageInfo: {
    hasMore: boolean;
    nextBeforeId: string | null;
  };
}>;

export type ProjectAuditHistoryQuery = {
  limit?: number;
  beforeId?: string | null;
  actionType?: "create" | "update" | "delete" | null;
  entityType?: string | null;
  moduleKey?: string | null;
};

function buildRequestPath(projectSlug: string, query?: ProjectAuditHistoryQuery): string {
  const params = new URLSearchParams();

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (query?.beforeId) {
    params.set("beforeId", query.beforeId);
  }

  if (query?.actionType) {
    params.set("actionType", query.actionType);
  }

  if (query?.entityType) {
    params.set("entityType", query.entityType);
  }

  if (query?.moduleKey) {
    params.set("moduleKey", query.moduleKey);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return `/api/v1/projects/${encodeURIComponent(projectSlug)}/audit${suffix}`;
}

export async function getProjectAuditHistory(
  projectSlug: string,
  query?: ProjectAuditHistoryQuery
): Promise<ProjectAuditHistoryResponse> {
  const response = await fetch(buildRequestPath(projectSlug, query), {
    method: "GET",
    headers: {
      ...createBootstrapPreviewRequestHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, `Project audit history request failed with HTTP ${response.status}.`)
    );
  }

  return (await response.json()) as ProjectAuditHistoryResponse;
}

export type PlatformAuditHistoryQuery = ProjectAuditHistoryQuery & {
  projectSlug?: string | null;
};

export type PlatformAuditHistoryResponse = ApiEnvelope<{
  scope: "global" | "project";
  filters: {
    limit: number;
    beforeId: string | null;
    actionType: "create" | "update" | "delete" | null;
    entityType: string | null;
    moduleKey: string | null;
    projectSlug: string | null;
  };
  items: ProjectAuditHistoryItem[];
  pageInfo: {
    hasMore: boolean;
    nextBeforeId: string | null;
  };
}>;

function buildPlatformRequestPath(query?: PlatformAuditHistoryQuery): string {
  const params = new URLSearchParams();

  if (typeof query?.limit === "number") {
    params.set("limit", String(query.limit));
  }

  if (query?.beforeId) {
    params.set("beforeId", query.beforeId);
  }

  if (query?.actionType) {
    params.set("actionType", query.actionType);
  }

  if (query?.entityType) {
    params.set("entityType", query.entityType);
  }

  if (query?.moduleKey) {
    params.set("moduleKey", query.moduleKey);
  }

  if (query?.projectSlug) {
    params.set("projectSlug", query.projectSlug);
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  return `/api/v1/platform/audit${suffix}`;
}

export async function getPlatformAuditHistory(
  query?: PlatformAuditHistoryQuery
): Promise<PlatformAuditHistoryResponse> {
  const response = await fetch(buildPlatformRequestPath(query), {
    method: "GET",
    headers: {
      ...createBootstrapPreviewRequestHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(
      await readApiErrorMessage(response, `Platform audit history request failed with HTTP ${response.status}.`)
    );
  }

  return (await response.json()) as PlatformAuditHistoryResponse;
}