import type { ContactDetailTable, ContactEntry, ContactGroup } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectContactRecord = {
  id: string;
  title: string;
  description: string;
  phone?: string;
  email?: string;
  address?: string;
  detailTable?: ContactDetailTable;
  group: ContactGroup;
  sortOrder: number;
};

export type ProjectContactsResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectContactRecord[];
};

export type CreateProjectContactInput = {
  title: string;
  description: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  detailTable?: ContactDetailTable | null;
  group: ContactGroup;
};

export type UpdateProjectContactInput = Partial<CreateProjectContactInput>;

export type ProjectContactMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectContactRecord;
};

export type ProjectContactDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectContacts(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectContactsResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/contacts`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project contacts request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectContactsResponse>;
}

export async function reorderProjectContacts(
  projectSlug: string,
  orderedIds: string[]
): Promise<ApiEnvelope<ProjectContactsResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/contacts/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Reorder project contacts request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectContactsResponse>;
}

export async function createProjectContact(
  projectSlug: string,
  input: CreateProjectContactInput
): Promise<ApiEnvelope<ProjectContactMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/contacts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project contact request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectContactMutationResponse>;
}

export async function updateProjectContact(
  projectSlug: string,
  contactId: string,
  input: UpdateProjectContactInput
): Promise<ApiEnvelope<ProjectContactMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/contacts/${encodeURIComponent(contactId)}`,
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
    const fallbackMessage = `Update project contact request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectContactMutationResponse>;
}

export async function deleteProjectContact(
  projectSlug: string,
  contactId: string
): Promise<ApiEnvelope<ProjectContactDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/contacts/${encodeURIComponent(contactId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project contact request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectContactDeleteResponse>;
}

export function adaptProjectContactToEntry(item: ProjectContactRecord): ContactEntry {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    phone: item.phone,
    email: item.email,
    address: item.address,
    detailTable: item.detailTable,
    group: item.group,
    sortOrder: item.sortOrder,
  };
}

export function adaptProjectContactsToEntries(
  payload: ApiEnvelope<ProjectContactsResponse>
): ContactEntry[] {
  return payload.data.items.map(adaptProjectContactToEntry);
}