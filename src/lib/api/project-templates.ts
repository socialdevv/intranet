import type { TemplateChannel, TextTemplate } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

const EMPTY_TIPTAP_DOC = {
  type: "doc",
  content: [],
};

export type ProjectTemplateRecord = {
  id: string;
  title: string;
  channel: TemplateChannel;
  body?: unknown;
  example?: unknown;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectTemplatesResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectTemplateRecord[];
};

export type CreateProjectTemplateInput = {
  title: string;
  channel: TemplateChannel;
  body: unknown;
  example: unknown;
};

export type UpdateProjectTemplateInput = Partial<CreateProjectTemplateInput> & {
  sortOrder?: number;
};

export type ProjectTemplateMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectTemplateRecord;
};

export type ProjectTemplateDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectTemplates(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectTemplatesResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/templates`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project templates request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectTemplatesResponse>;
}

export async function reorderProjectTemplates(
  projectSlug: string,
  orderedIds: string[]
): Promise<ApiEnvelope<ProjectTemplatesResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/templates/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Reorder project templates request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectTemplatesResponse>;
}

export async function createProjectTemplate(
  projectSlug: string,
  input: CreateProjectTemplateInput
): Promise<ApiEnvelope<ProjectTemplateMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/templates`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project template request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectTemplateMutationResponse>;
}

export async function updateProjectTemplate(
  projectSlug: string,
  templateId: string,
  input: UpdateProjectTemplateInput
): Promise<ApiEnvelope<ProjectTemplateMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/templates/${encodeURIComponent(templateId)}`,
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
    const fallbackMessage = `Update project template request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectTemplateMutationResponse>;
}

export async function deleteProjectTemplate(
  projectSlug: string,
  templateId: string
): Promise<ApiEnvelope<ProjectTemplateDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/templates/${encodeURIComponent(templateId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project template request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectTemplateDeleteResponse>;
}

export function adaptProjectTemplate(item: ProjectTemplateRecord): TextTemplate {
  return {
    id: item.id,
    title: item.title,
    channel: item.channel,
    body: item.body ?? EMPTY_TIPTAP_DOC,
    example: item.example ?? EMPTY_TIPTAP_DOC,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function adaptProjectTemplates(
  payload: ApiEnvelope<ProjectTemplatesResponse>
): TextTemplate[] {
  return payload.data.items.map(adaptProjectTemplate);
}