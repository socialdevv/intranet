import type { PhraseEntry } from "@/lib/types/domain";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type ProjectPhraseRecord = {
  id: string;
  title: string;
  content: string;
  requiresConfirmation: boolean;
  sortOrder: number;
};

export type ProjectPhrasesResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  items: ProjectPhraseRecord[];
};

export type CreateProjectPhraseInput = {
  title: string;
  content: string;
  requiresConfirmation: boolean;
};

export type UpdateProjectPhraseInput = Partial<CreateProjectPhraseInput> & {
  sortOrder?: number;
};

export type ProjectPhraseMutationResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  item: ProjectPhraseRecord;
};

export type ProjectPhraseDeleteResponse = {
  project: {
    id: string;
    slug: string;
    code: string;
    name: string;
  };
  deletedId: string;
};

export async function fetchProjectPhrases(
  projectSlug: string,
  signal?: AbortSignal
): Promise<ApiEnvelope<ProjectPhrasesResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/phrases`, {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Project phrases request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPhrasesResponse>;
}

export async function reorderProjectPhrases(
  projectSlug: string,
  orderedIds: string[]
): Promise<ApiEnvelope<ProjectPhrasesResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/phrases/reorder`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify({ orderedIds }),
  });

  if (!response.ok) {
    const fallbackMessage = `Reorder project phrases request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPhrasesResponse>;
}

export async function createProjectPhrase(
  projectSlug: string,
  input: CreateProjectPhraseInput
): Promise<ApiEnvelope<ProjectPhraseMutationResponse>> {
  const response = await fetch(`/api/v1/projects/${encodeURIComponent(projectSlug)}/phrases`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create project phrase request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPhraseMutationResponse>;
}

export async function updateProjectPhrase(
  projectSlug: string,
  phraseId: string,
  input: UpdateProjectPhraseInput
): Promise<ApiEnvelope<ProjectPhraseMutationResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/phrases/${encodeURIComponent(phraseId)}`,
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
    const fallbackMessage = `Update project phrase request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPhraseMutationResponse>;
}

export async function deleteProjectPhrase(
  projectSlug: string,
  phraseId: string
): Promise<ApiEnvelope<ProjectPhraseDeleteResponse>> {
  const response = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectSlug)}/phrases/${encodeURIComponent(phraseId)}`,
    {
      method: "DELETE",
      headers: createBootstrapPreviewRequestHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const fallbackMessage = `Delete project phrase request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<ProjectPhraseDeleteResponse>;
}

export function adaptProjectPhrase(item: ProjectPhraseRecord): PhraseEntry {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    requiresConfirmation: item.requiresConfirmation,
    sortOrder: item.sortOrder,
  };
}

export function adaptProjectPhrases(payload: ApiEnvelope<ProjectPhrasesResponse>): PhraseEntry[] {
  return payload.data.items.map(adaptProjectPhrase);
}