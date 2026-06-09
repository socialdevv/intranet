import type { Announcement } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
};

export type PlatformAnnouncementRecord = {
  id: string;
  title: string;
  body?: unknown;
  description: string;
  color: Announcement["color"];
  active: boolean;
  visibleFrom?: string;
  visibleUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAnnouncementsResponse = {
  items: PlatformAnnouncementRecord[];
};

export type CreatePlatformAnnouncementInput = {
  title: string;
  body: unknown;
  description: string;
  color: Announcement["color"];
  active: boolean;
  visibleFrom?: string | null;
  visibleUntil?: string | null;
};

export type UpdatePlatformAnnouncementInput = Partial<CreatePlatformAnnouncementInput>;

export type PlatformAnnouncementMutationResponse = {
  item: PlatformAnnouncementRecord;
};

export type PlatformAnnouncementDeleteResponse = {
  deletedId: string;
};

export async function fetchPlatformAnnouncements(
  signal?: AbortSignal
): Promise<ApiEnvelope<PlatformAnnouncementsResponse>> {
  const response = await fetch("/api/v1/platform/announcements", {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Platform announcements request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformAnnouncementsResponse>;
}

export async function createPlatformAnnouncement(
  input: CreatePlatformAnnouncementInput
): Promise<ApiEnvelope<PlatformAnnouncementMutationResponse>> {
  const response = await fetch("/api/v1/platform/announcements", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create platform announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformAnnouncementMutationResponse>;
}

export async function updatePlatformAnnouncement(
  announcementId: string,
  input: UpdatePlatformAnnouncementInput
): Promise<ApiEnvelope<PlatformAnnouncementMutationResponse>> {
  const response = await fetch(
    `/api/v1/platform/announcements/${encodeURIComponent(announcementId)}`,
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
    const fallbackMessage = `Update platform announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformAnnouncementMutationResponse>;
}

export async function deletePlatformAnnouncement(
  announcementId: string
): Promise<ApiEnvelope<PlatformAnnouncementDeleteResponse>> {
  const response = await fetch(
    `/api/v1/platform/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete platform announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformAnnouncementDeleteResponse>;
}

export function adaptPlatformAnnouncement(item: PlatformAnnouncementRecord): Announcement {
  return {
    id: item.id,
    title: item.title,
    body: item.body ?? EMPTY_TIPTAP_DOC,
    description: item.description,
    color: item.color,
    active: item.active,
    visibleFrom: item.visibleFrom,
    visibleUntil: item.visibleUntil,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}