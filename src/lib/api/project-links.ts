import type { LinkItem } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectLinkRecord = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type ProjectLinksResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectLinkRecord[];
};

export type CreateProjectLinkInput = {
  title: string;
  url: string;
  description: string;
  icon: string;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type UpdateProjectLinkInput = Partial<CreateProjectLinkInput>;

export type ProjectLinkMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectLinkRecord;
};

export type ProjectLinkDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectLinks(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectLinksResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/links`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project links request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectLinksResponse>;
}

export async function reorderProjectLinks(
  projectSlug: string,
  orderedIds: string[]
): Promise<ApiEnvelope<ProjectLinksResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/links/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Reorder project links request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectLinksResponse>;
}

export async function createProjectLink(
  projectSlug: string,
  input: CreateProjectLinkInput
): Promise<ApiEnvelope<ProjectLinkMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/links`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectLinkMutationResponse>;
}

export async function updateProjectLink(
  projectSlug: string,
  linkId: string,
  input: UpdateProjectLinkInput
): Promise<ApiEnvelope<ProjectLinkMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/links/${encodeURIComponent(linkId)}`,
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
    const fallbackMessage = `Update project link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectLinkMutationResponse>;
}

export async function deleteProjectLink(
  projectSlug: string,
  linkId: string
): Promise<ApiEnvelope<ProjectLinkDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/links/${encodeURIComponent(linkId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectLinkDeleteResponse>;
}

export function adaptProjectLinkToLinkItem(item: ProjectLinkRecord): LinkItem {
  return {
    id: item.id,
    title: item.title,
    url: item.url,
    description: item.description,
    icon: item.icon,
    sortOrder: item.sortOrder,
    openInNewTab: item.openInNewTab,
    isInternal: item.isInternal,
  };
}

export function adaptProjectLinksToLinkItems(
  payload: ApiEnvelope<ProjectLinksResponse>
): LinkItem[] {
  return payload.data.items.map(adaptProjectLinkToLinkItem);
}