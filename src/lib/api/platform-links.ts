import type { LinkItem } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type PlatformLinkRecord = {
  id: string;
  title: string;
  url: string;
  description: string;
  icon: string;
  sortOrder: number;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type PlatformLinksResponse = {
  items: PlatformLinkRecord[];
};

export type CreatePlatformLinkInput = {
  title: string;
  url: string;
  description: string;
  icon: string;
  openInNewTab: boolean;
  isInternal: boolean;
};

export type UpdatePlatformLinkInput = Partial<CreatePlatformLinkInput>;

export type PlatformLinkMutationResponse = {
  item: PlatformLinkRecord;
};

export type PlatformLinkDeleteResponse = {
  deletedId: string;
};

export async function fetchPlatformLinks(
  signal?: AbortSignal
): Promise<ApiEnvelope<PlatformLinksResponse>> {
  const response = await fetch("/api/v1/platform/links", {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Platform links request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformLinksResponse>;
}

export async function createPlatformLink(
  input: CreatePlatformLinkInput
): Promise<ApiEnvelope<PlatformLinkMutationResponse>> {
  const response = await fetch("/api/v1/platform/links", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create platform link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformLinkMutationResponse>;
}

export async function updatePlatformLink(
  linkId: string,
  input: UpdatePlatformLinkInput
): Promise<ApiEnvelope<PlatformLinkMutationResponse>> {
  const response = await fetch(`/api/v1/platform/links/${encodeURIComponent(linkId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Update platform link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformLinkMutationResponse>;
}

export async function deletePlatformLink(
  linkId: string
): Promise<ApiEnvelope<PlatformLinkDeleteResponse>> {
  const response = await fetch(`/api/v1/platform/links/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const fallbackMessage = `Delete platform link request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformLinkDeleteResponse>;
}

export function adaptPlatformLink(item: PlatformLinkRecord): LinkItem {
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