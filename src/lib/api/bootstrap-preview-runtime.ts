export type BootstrapPreviewDataSourceMode = "api";

export type ApiEnvelope<T> = {
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
  };
};

export function getBootstrapPreviewDataSourceMode(): BootstrapPreviewDataSourceMode {
  return "api";
}

export function isApiBootstrapPreviewEnabled(): boolean {
  return true;
}

const PREVIEW_AUTH_USER_STORAGE_KEY = "altcloud.preview-auth-user-email";

export function getSelectedBootstrapPreviewDevUserEmail(): string | null {
  if (typeof window !== "undefined") {
    const storedEmail = window.sessionStorage.getItem(PREVIEW_AUTH_USER_STORAGE_KEY)?.trim();
    if (storedEmail) {
      return storedEmail;
    }
  }

  const selectedEmail = import.meta.env.VITE_ALTCLOUD_API_DEV_USER_EMAIL?.trim();
  return selectedEmail || null;
}

export function setSelectedBootstrapPreviewDevUserEmail(email: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedEmail = email.trim();
  if (!normalizedEmail) {
    window.sessionStorage.removeItem(PREVIEW_AUTH_USER_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(PREVIEW_AUTH_USER_STORAGE_KEY, normalizedEmail);
}

export function clearSelectedBootstrapPreviewDevUserEmail(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PREVIEW_AUTH_USER_STORAGE_KEY);
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
