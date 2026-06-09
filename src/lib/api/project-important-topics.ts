import type { OrgEntry, OrgEntryStatus } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
};

export type ProjectImportantTopicRecord = {
  id: string;
  title: string;
  body?: unknown;
  status: OrgEntryStatus;
  entryDate?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectImportantTopicsResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectImportantTopicRecord[];
};

export type CreateProjectImportantTopicInput = {
  title: string;
  body: unknown;
  status: OrgEntryStatus;
  entryDate?: string;
};

export type UpdateProjectImportantTopicInput = Partial<CreateProjectImportantTopicInput>;

export type ProjectImportantTopicMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectImportantTopicRecord;
};

export type ProjectImportantTopicDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectImportantTopics(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectImportantTopicsResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/important-topics`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project important topics request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectImportantTopicsResponse>;
}

export async function createProjectImportantTopic(
  projectSlug: string,
  input: CreateProjectImportantTopicInput
): Promise<ApiEnvelope<ProjectImportantTopicMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/important-topics`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project important topic request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectImportantTopicMutationResponse>;
}

export async function updateProjectImportantTopic(
  projectSlug: string,
  topicId: string,
  input: UpdateProjectImportantTopicInput
): Promise<ApiEnvelope<ProjectImportantTopicMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/important-topics/${encodeURIComponent(topicId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      cache: "no-store",
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Update project important topic request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectImportantTopicMutationResponse>;
}

export async function deleteProjectImportantTopic(
  projectSlug: string,
  topicId: string
): Promise<ApiEnvelope<ProjectImportantTopicDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/important-topics/${encodeURIComponent(topicId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project important topic request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectImportantTopicDeleteResponse>;
}

export function adaptProjectImportantTopic(item: ProjectImportantTopicRecord): OrgEntry {
  return {
    id: item.id,
    title: item.title,
    body: item.body ?? EMPTY_TIPTAP_DOC,
    status: item.status,
    entryDate: item.entryDate,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function adaptProjectImportantTopics(
  payload: ApiEnvelope<ProjectImportantTopicsResponse>
): OrgEntry[] {
  return payload.data.items.map(adaptProjectImportantTopic);
}