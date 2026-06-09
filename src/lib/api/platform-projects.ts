import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type CreatePlatformProjectInput = {
  name: string;
  slug: string;
  code: string;
};

export type PlatformProjectRecord = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isListed: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformProjectMutationResponse = {
  project: PlatformProjectRecord;
};

export async function createPlatformProject(
  input: CreatePlatformProjectInput
): Promise<ApiEnvelope<PlatformProjectMutationResponse>> {
  const response = await fetch("/api/v1/platform/projects", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    cache: "no-store",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const fallbackMessage = `Create platform project request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformProjectMutationResponse>;
}
