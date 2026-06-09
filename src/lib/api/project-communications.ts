import type { CommunicationMessage, KomunikatStatus } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
};

export type ProjectCommunicationRecord = {
  id: string;
  title: string;
  body?: unknown;
  status: KomunikatStatus;
  communicationDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectCommunicationsResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectCommunicationRecord[];
};

export type CreateProjectCommunicationInput = {
  title: string;
  body: unknown;
  status: KomunikatStatus;
  communicationDate?: string | null;
};

export type UpdateProjectCommunicationInput = Partial<CreateProjectCommunicationInput>;

export type ProjectCommunicationMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectCommunicationRecord;
};

export type ProjectCommunicationDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectCommunications(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectCommunicationsResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/communications`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project communications request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectCommunicationsResponse>;
}

export async function createProjectCommunication(
  projectSlug: string,
  input: CreateProjectCommunicationInput
): Promise<ApiEnvelope<ProjectCommunicationMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/communications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project communication request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectCommunicationMutationResponse>;
}

export async function updateProjectCommunication(
  projectSlug: string,
  communicationId: string,
  input: UpdateProjectCommunicationInput
): Promise<ApiEnvelope<ProjectCommunicationMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/communications/${encodeURIComponent(communicationId)}`,
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
    const fallbackMessage = `Update project communication request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectCommunicationMutationResponse>;
}

export async function deleteProjectCommunication(
  projectSlug: string,
  communicationId: string
): Promise<ApiEnvelope<ProjectCommunicationDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/communications/${encodeURIComponent(communicationId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project communication request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectCommunicationDeleteResponse>;
}

export function adaptProjectCommunication(item: ProjectCommunicationRecord): CommunicationMessage {
  return {
    id: item.id,
    title: item.title,
    body: item.body ?? EMPTY_TIPTAP_DOC,
    status: item.status,
    communicationDate: item.communicationDate ?? undefined,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function adaptProjectCommunications(
  payload: ApiEnvelope<ProjectCommunicationsResponse>
): CommunicationMessage[] {
  return payload.data.items.map(adaptProjectCommunication);
}