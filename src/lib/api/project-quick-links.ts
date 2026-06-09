import type { HomeQuickLink } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectQuickLinkRecord = {
  id: string;
  label: string;
  url: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type ProjectQuickLinksResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectQuickLinkRecord[];
};

export type CreateProjectQuickLinkInput = {
  label: string;
  url: string;
  icon: string;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type UpdateProjectQuickLinkInput = Partial<CreateProjectQuickLinkInput>;

export type ProjectQuickLinkMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectQuickLinkRecord;
};

export type ProjectQuickLinkDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectQuickLinks(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectQuickLinksResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/quick-links`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project quick links request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectQuickLinksResponse>;
}

export async function reorderProjectQuickLinks(
  projectSlug: string,
  orderedIds: string[]
): Promise<ApiEnvelope<ProjectQuickLinksResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/quick-links/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Reorder quick links request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectQuickLinksResponse>;
}

export async function createProjectQuickLink(
  projectSlug: string,
  input: CreateProjectQuickLinkInput
): Promise<ApiEnvelope<ProjectQuickLinkMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/quick-links`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create quick link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectQuickLinkMutationResponse>;
}

export async function updateProjectQuickLink(
  projectSlug: string,
  quickLinkId: string,
  input: UpdateProjectQuickLinkInput
): Promise<ApiEnvelope<ProjectQuickLinkMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/quick-links/${encodeURIComponent(quickLinkId)}`,
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
    const fallbackMessage = `Update quick link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectQuickLinkMutationResponse>;
}

export async function deleteProjectQuickLink(
  projectSlug: string,
  quickLinkId: string
): Promise<ApiEnvelope<ProjectQuickLinkDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/quick-links/${encodeURIComponent(quickLinkId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete quick link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectQuickLinkDeleteResponse>;
}

export function adaptProjectQuickLinkToHomeQuickLink(item: ProjectQuickLinkRecord): HomeQuickLink {
  return {
    id: item.id,
    label: item.label,
    url: item.url,
    icon: item.icon,
    sortOrder: item.sortOrder,
    openInNewTab: item.openInNewTab,
    isInternal: item.isInternal,
  };
}

export function adaptProjectQuickLinksToHomeQuickLinks(
  payload: ApiEnvelope<ProjectQuickLinksResponse>
): HomeQuickLink[] {
  return payload.data.items.map(adaptProjectQuickLinkToHomeQuickLink);
}