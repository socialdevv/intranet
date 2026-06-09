import type { MatrixCondition, MatrixDecision } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectMatrixRecord = {
  id: string;
  category: string;
  subcategory: string;
  keywords: string[];
  description: string;
  slaDays: number;
  instructions: string;
  additionalNotes: string;
  defaultDepartment: string;
  conditions: MatrixCondition[];
  linkedTemplateIds: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMatrixResponse = ApiEnvelope<{
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectMatrixRecord[];
}>;

export type ProjectMatrixCategoryReorderResponse = ApiEnvelope<{
  project: ProjectMatrixResponse["data"]["project"];
  orderedCategoryNames: string[];
}>;

export type CreateProjectMatrixInput = {
  category: string;
  subcategory: string;
  keywords: string[];
  description: string;
  slaDays: number;
  instructions: string;
  additionalNotes: string;
  defaultDepartment: string;
  conditions: MatrixCondition[];
  linkedTemplateIds: string[];
};

export type UpdateProjectMatrixInput = Partial<CreateProjectMatrixInput>;

function adaptConditions(value: unknown): MatrixCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((condition) => {
    if (!condition || typeof condition !== "object") {
      return [];
    }

    const candidate = condition as Record<string, unknown>;
    const criteria = Array.isArray(candidate.criteria)
      ? candidate.criteria.flatMap((criterion) => {
          if (!criterion || typeof criterion !== "object") {
            return [];
          }

          const criterionCandidate = criterion as Record<string, unknown>;
          const field = typeof criterionCandidate.field === "string" ? criterionCandidate.field : "";
          const value = typeof criterionCandidate.value === "string" ? criterionCandidate.value : "";

          return field || value ? [{ field, value }] : [];
        })
      : [];

    return [
      {
        department: typeof candidate.department === "string" ? candidate.department : "",
        criteria,
      },
    ];
  });
}

export function adaptProjectMatrix(item: ProjectMatrixRecord): MatrixDecision {
  return {
    id: item.id,
    category: item.category,
    subcategory: item.subcategory,
    keywords: Array.isArray(item.keywords) ? item.keywords : [],
    description: item.description,
    slaDays: item.slaDays,
    instructions: item.instructions,
    additionalNotes: item.additionalNotes,
    defaultDepartment: item.defaultDepartment,
    conditions: adaptConditions(item.conditions),
    linkedTemplateIds: Array.isArray(item.linkedTemplateIds) ? item.linkedTemplateIds : [],
    sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
  };
}

export function adaptProjectMatrixItems(payload: ProjectMatrixResponse): MatrixDecision[] {
  return payload.data.items.map(adaptProjectMatrix);
}

export async function fetchProjectMatrix(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ProjectMatrixResponse> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project matrix request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectMatrixResponse;
}

export async function reorderProjectMatrixCategories(
  projectSlug: string,
  orderedCategoryNames: string[]
): Promise<ProjectMatrixCategoryReorderResponse> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix/categories/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedCategoryNames }),
  });

  if (!response.ok) {
    const fallbackMessage = `Project matrix category reorder request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectMatrixCategoryReorderResponse;
}

export async function reorderProjectMatrixEntries(
  projectSlug: string,
  category: string,
  orderedIds: string[]
): Promise<ProjectMatrixResponse> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ category, orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Project matrix reorder request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectMatrixResponse;
}

export async function createProjectMatrix(
  projectSlug: string,
  input: CreateProjectMatrixInput
): Promise<
  ApiEnvelope<{
    project: ProjectMatrixResponse["data"]["project"];
    item: ProjectMatrixRecord;
  }>
> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Project matrix create request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectMatrixResponse["data"]["project"];
    item: ProjectMatrixRecord;
  }>;
}

export async function updateProjectMatrix(
  projectSlug: string,
  matrixId: string,
  input: UpdateProjectMatrixInput
): Promise<
  ApiEnvelope<{
    project: ProjectMatrixResponse["data"]["project"];
    item: ProjectMatrixRecord;
  }>
> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix/${encodeURIComponent(matrixId)}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project matrix update request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<{
    project: ProjectMatrixResponse["data"]["project"];
    item: ProjectMatrixRecord;
  }>;
}

export async function deleteProjectMatrix(projectSlug: string, matrixId: string): Promise<void> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/matrix/${encodeURIComponent(matrixId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Project matrix delete request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }
}