import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";

export type PreviewAuthUserRecord = {
  email: string;
  displayName: string;
  initials: string;
  globalRole: string;
};

export async function fetchPreviewAuthUsers(
  signal?: AbortSignal
): Promise<PreviewAuthUserRecord[]> {
  const response = await fetch("/api/v1/platform/preview-auth/users", {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Preview auth user directory failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  const payload = (await response.json()) as ApiEnvelope<{ users: PreviewAuthUserRecord[] }>;
  return payload.data.users;
}
