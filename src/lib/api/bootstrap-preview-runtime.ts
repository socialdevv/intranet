export type BootstrapPreviewDataSourceMode = "legacy-json" | "api";

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
};

export function resolveBootstrapPreviewDataSourceMode(
  rawValue: string | undefined
): BootstrapPreviewDataSourceMode {
  return rawValue === "api" ? "api" : "legacy-json";
}

export function getBootstrapPreviewDataSourceMode(): BootstrapPreviewDataSourceMode {
  return resolveBootstrapPreviewDataSourceMode(import.meta.env.VITE_ALTCLOUD_PLATFORM_DATA_SOURCE);
}

export function isApiBootstrapPreviewEnabled(): boolean {
  return getBootstrapPreviewDataSourceMode() === "api";
}

export function getSelectedBootstrapPreviewDevUserEmail(): string | null {
  const selectedEmail = import.meta.env.VITE_ALTCLOUD_API_DEV_USER_EMAIL?.trim();
  return selectedEmail || null;
}

export function createBootstrapPreviewRequestHeaders(): HeadersInit {
  const selectedEmail = getSelectedBootstrapPreviewDevUserEmail();

  if (!selectedEmail) {
    return {};
  }

  return {
    "x-dev-user-email": selectedEmail,
  };
}

export async function readApiErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const parsed = (await response.json()) as { error?: { message?: string } };
    return parsed.error?.message ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export function bytesToMegabytes(bytes: number): number {
  return Number((bytes / (1024 * 1024)).toFixed(1));
}