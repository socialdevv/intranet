import type {
  ProjectFormDefinition,
  ProjectFormField,
  ProjectFormSubmission,
} from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectFormRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
  fields: ProjectFormField[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectFormSubmissionRecord = {
  id: string;
  formId: string;
  formSlug: string;
  formTitle: string;
  payload: unknown;
  submitter: {
    userId: string | null;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    displayName: string | null;
  };
  deliveryStatus: string;
  deliveryNote: string | null;
  createdAt: string;
};

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

export type ProjectFormsResponse = {
  project: ProjectRef;
  items: ProjectFormRecord[];
};

export type ProjectFormSubmissionsResponse = {
  project: ProjectRef;
  items: ProjectFormSubmissionRecord[];
};

export type CreateProjectFormInput = {
  slug: string;
  title: string;
  description: string;
  isActive: boolean;
  fields: ProjectFormField[];
};

export type UpdateProjectFormInput = Partial<CreateProjectFormInput>;

export type ProjectFormMutationResponse = {
  project: ProjectRef;
  item: ProjectFormRecord;
};

export type ProjectFormDeleteResponse = {
  project: ProjectRef;
  deletedId: string;
};

export type ProjectFormSubmissionMutationResponse = {
  project: ProjectRef;
  submission: ProjectFormSubmissionRecord;
};

async function parseResponse<T>(response: Response, fallbackMessage: string): Promise<ApiEnvelope<T>> {
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }
  return (await response.json()) as ApiEnvelope<T>;
}

export async function fetchProjectForms(
  projectSlug: string,
  options?: {
    admin?: boolean;
    signal?: AbortSignal;
  }
): Promise<ApiEnvelope<ProjectFormsResponse>> {
  const path = options?.admin
    ? `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms/admin`
    : `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms`;
  const response = await fetch(path, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal: options?.signal,
  });

  return parseResponse(
    response,
    `Project forms request failed with HTTP ${response.status}.`
  );
}

export async function createProjectForm(
  projectSlug: string,
  input: CreateProjectFormInput
): Promise<ApiEnvelope<ProjectFormMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/forms`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  return parseResponse(
    response,
    `Create project form request failed with HTTP ${response.status}.`
  );
}

export async function updateProjectForm(
  projectSlug: string,
  formId: string,
  input: UpdateProjectFormInput
): Promise<ApiEnvelope<ProjectFormMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms/${encodeURIComponent(formId)}`,
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

  return parseResponse(
    response,
    `Update project form request failed with HTTP ${response.status}.`
  );
}

export async function deleteProjectForm(
  projectSlug: string,
  formId: string
): Promise<ApiEnvelope<ProjectFormDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms/${encodeURIComponent(formId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  return parseResponse(
    response,
    `Delete project form request failed with HTTP ${response.status}.`
  );
}

export async function submitProjectForm(
  projectSlug: string,
  formId: string,
  answers: Record<string, unknown>
): Promise<ApiEnvelope<ProjectFormSubmissionMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms/${encodeURIComponent(formId)}/submissions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      cache: "no-store",
      body: JSON.stringify({ answers }),
    }
  );

  return parseResponse(
    response,
    `Submit project form request failed with HTTP ${response.status}.`
  );
}

export async function fetchProjectFormSubmissions(
  projectSlug: string,
  options?: {
    formId?: string;
    limit?: number;
    signal?: AbortSignal;
  }
): Promise<ApiEnvelope<ProjectFormSubmissionsResponse>> {
  const query = new URLSearchParams();
  if (options?.formId) {
    query.set("formId", options.formId);
  }
  if (typeof options?.limit === "number") {
    query.set("limit", String(options.limit));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";

  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/forms/submissions${suffix}`,
    {
      method: "GET",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
      signal: options?.signal,
    }
  );

  return parseResponse(
    response,
    `Project form submissions request failed with HTTP ${response.status}.`
  );
}

export function adaptProjectForms(
  payload: ApiEnvelope<ProjectFormsResponse>
): ProjectFormDefinition[] {
  return payload.data.items.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    description: item.description,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    fields: item.fields,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

export function adaptProjectFormSubmissions(
  payload: ApiEnvelope<ProjectFormSubmissionsResponse>
): ProjectFormSubmission[] {
  return payload.data.items.map((item) => ({
    id: item.id,
    formId: item.formId,
    formSlug: item.formSlug,
    formTitle: item.formTitle,
    payload: item.payload,
    submitter: item.submitter,
    deliveryStatus: item.deliveryStatus,
    deliveryNote: item.deliveryNote,
    createdAt: item.createdAt,
  }));
}
