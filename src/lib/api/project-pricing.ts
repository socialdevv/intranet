import type { Cennik } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectPricingRecord = {
  id: string;
  title: string;
  subtitle?: string;
  provider?: string;
  effectiveFrom: string;
  status: Cennik["status"];
  footnotes: string[];
  sections: unknown;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPricingResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectPricingRecord[];
};

export type CreateProjectPricingInput = {
  title: string;
  subtitle?: string | null;
  provider?: string | null;
  effectiveFrom: string;
  status: Cennik["status"];
  footnotes?: string[];
  sections: Cennik["sections"];
};

export type UpdateProjectPricingInput = Partial<CreateProjectPricingInput>;

export type ProjectPricingMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectPricingRecord;
};

export type ProjectPricingDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectPricing(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectPricingResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/pricing`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project pricing request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPricingResponse>;
}

export async function createProjectPricing(
  projectSlug: string,
  input: CreateProjectPricingInput
): Promise<ApiEnvelope<ProjectPricingMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/pricing`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project pricing request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPricingMutationResponse>;
}

export async function updateProjectPricing(
  projectSlug: string,
  pricingId: string,
  input: UpdateProjectPricingInput
): Promise<ApiEnvelope<ProjectPricingMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/pricing/${encodeURIComponent(pricingId)}`,
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
    const fallbackMessage = `Update project pricing request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPricingMutationResponse>;
}

export async function deleteProjectPricing(
  projectSlug: string,
  pricingId: string
): Promise<ApiEnvelope<ProjectPricingDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/pricing/${encodeURIComponent(pricingId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project pricing request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPricingDeleteResponse>;
}

export function adaptProjectPricing(item: ProjectPricingRecord): Cennik {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle ?? undefined,
    provider: item.provider ?? undefined,
    effectiveFrom: item.effectiveFrom,
    updatedAt: item.updatedAt,
    status: item.status,
    footnotes: item.footnotes.length > 0 ? item.footnotes : undefined,
    sections: Array.isArray(item.sections) ? (item.sections as Cennik["sections"]) : [],
  };
}

export function adaptProjectPricingItems(
  payload: ApiEnvelope<ProjectPricingResponse>
): Cennik[] {
  return payload.data.items.map(adaptProjectPricing);
}