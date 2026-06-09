import type { Announcement, AnnouncementColor } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectAnnouncementRecord = {
  id: string;
  title: string;
  body?: unknown;
  description: string;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom?: string;
  visibleUntil?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectAnnouncementsResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectAnnouncementRecord[];
};

export type CreateProjectAnnouncementInput = {
  title: string;
  body?: unknown;
  description: string;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom?: string | null;
  visibleUntil?: string | null;
};

export type UpdateProjectAnnouncementInput = Partial<CreateProjectAnnouncementInput>;

export type ProjectAnnouncementMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectAnnouncementRecord;
};

export type ProjectAnnouncementDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectAnnouncements(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectAnnouncementsResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/announcements`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project announcements request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectAnnouncementsResponse>;
}

export async function createProjectAnnouncement(
  projectSlug: string,
  input: CreateProjectAnnouncementInput
): Promise<ApiEnvelope<ProjectAnnouncementMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/announcements`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectAnnouncementMutationResponse>;
}

export async function updateProjectAnnouncement(
  projectSlug: string,
  announcementId: string,
  input: UpdateProjectAnnouncementInput
): Promise<ApiEnvelope<ProjectAnnouncementMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/announcements/${encodeURIComponent(announcementId)}`,
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
    const fallbackMessage = `Update project announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectAnnouncementMutationResponse>;
}

export async function deleteProjectAnnouncement(
  projectSlug: string,
  announcementId: string
): Promise<ApiEnvelope<ProjectAnnouncementDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/announcements/${encodeURIComponent(announcementId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project announcement request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectAnnouncementDeleteResponse>;
}

export function adaptProjectAnnouncement(item: ProjectAnnouncementRecord): Announcement {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    description: item.description,
    color: item.color,
    active: item.active,
    visibleFrom: item.visibleFrom,
    visibleUntil: item.visibleUntil,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function adaptProjectAnnouncements(
  payload: ApiEnvelope<ProjectAnnouncementsResponse>
): Announcement[] {
  return payload.data.items.map(adaptProjectAnnouncement);
}