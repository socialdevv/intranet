import type { AppSystemSettings } from "@/lib/types/domain";
import type { PlatformBootstrapState } from "@/contexts/platform-scope-provider";
import type { ProjectBootstrapState } from "@/contexts/project-scope-provider";

export const GLOBAL_APP_NAME = "Intranet";
const BASE_APP_NAME = "Baza Wiedzy";
/** Bundled defaults from `store.ts` and historical JSON imports — must never appear in global shell chrome. */
const LEGACY_BUNDLED_APP_NAME_PATTERNS = [
  /^platforma\s*intranetowa$/i,
  /^baza\s*wiedzy\s*-\s*enea$/i,
] as const;

/** Bundled default from `store.ts` — must never appear in global shell chrome. */
export function isLegacyBundledAppName(value: string | null | undefined): boolean {
  const normalized = (value ?? "").trim();
  if (!normalized) return false;
  return LEGACY_BUNDLED_APP_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function isGlobalShellContext(
  navigationMode: "project" | "platform" | "global",
  isProjectRoute: boolean
): boolean {
  return navigationMode === "global" || !isProjectRoute;
}

/** True while API project bootstrap is in flight for the active project shell. */
export function isProjectBrandingPending(
  projectBootstrapState: ProjectBootstrapState,
  navigationMode: "project" | "platform" | "global" = "project",
  isProjectRoute = true
): boolean {
  return (
    isGlobalShellContext(navigationMode, isProjectRoute) === false &&
    projectBootstrapState.mode === "api" &&
    projectBootstrapState.status === "loading"
  );
}

export function isPlatformBrandingPending(
  platformBootstrapState: PlatformBootstrapState,
  isGlobalShell: boolean
): boolean {
  return (
    isGlobalShell &&
    platformBootstrapState.mode === "api" &&
    platformBootstrapState.status === "loading"
  );
}

export function isShellBrandingPending(input: {
  navigationMode?: "project" | "platform" | "global";
  isProjectRoute?: boolean;
  projectBootstrapState: ProjectBootstrapState;
  platformBootstrapState: PlatformBootstrapState;
}): boolean {
  const isGlobalShell = isGlobalShellContext(
    input.navigationMode ?? "project",
    input.isProjectRoute ?? true
  );

  return (
    isPlatformBrandingPending(input.platformBootstrapState, isGlobalShell) ||
    isProjectBrandingPending(
      input.projectBootstrapState,
      input.navigationMode,
      input.isProjectRoute ?? true
    )
  );
}

export function resolveProjectDisplayName(
  systemSettings: AppSystemSettings | undefined,
  fallbackAppName?: string | null,
  activeProjectSlug?: string | null
): string {
  const configured = systemSettings?.deployment?.projectDisplayName?.trim();
  if (configured) {
    return configured;
  }

  const rawFallback = isLegacyBundledAppName(fallbackAppName) ? "" : (fallbackAppName ?? "").trim();
  if (rawFallback) {
    const stripped = rawFallback
      .replace(/^Platforma\s*Intranetowa\s*-\s*/i, "")
      .replace(/^Baza\s*Wiedzy\s*-\s*/i, "")
      .trim();
    return stripped || rawFallback;
  }

  const slugLabel = (activeProjectSlug ?? "").trim();
  if (slugLabel) {
    return slugLabel
      .split(/[-_]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return GLOBAL_APP_NAME;
}

export function buildAppBrowserTitle(projectDisplayName: string): string {
  return `${BASE_APP_NAME} - ${projectDisplayName}`;
}

export function buildGlobalAppTitle(): string {
  return GLOBAL_APP_NAME;
}

/**
 * Title for routes outside an active project (`/`, `/projekty`, global admin).
 * Never reads bundled `meta.appName`.
 */
export function resolveGlobalShellTitle(input: {
  platformBootstrapState: PlatformBootstrapState;
}): string | null {
  if (isPlatformBrandingPending(input.platformBootstrapState, true)) {
    return null;
  }

  if (input.platformBootstrapState.status === "ready") {
    const welcomeTitle = input.platformBootstrapState.preview.homepage.welcomeTitle?.trim();
    if (welcomeTitle) {
      return welcomeTitle;
    }
  }

  return GLOBAL_APP_NAME;
}

/**
 * Resolves the project segment used in titles. Returns null while bootstrap is
 * loading so callers can avoid flashing legacy bundled defaults.
 */
export function resolveBrandingProjectName(input: {
  projectBootstrapState: ProjectBootstrapState;
  shellProjectDisplayName?: string | null;
  systemSettings?: AppSystemSettings;
  fallbackAppName?: string | null;
  activeProjectSlug?: string | null;
  navigationMode?: "project" | "platform" | "global";
  isProjectRoute?: boolean;
}): string | null {
  const shellName = input.shellProjectDisplayName?.trim();
  if (shellName) {
    return shellName;
  }

  if (
    isProjectBrandingPending(
      input.projectBootstrapState,
      input.navigationMode,
      input.isProjectRoute ?? true
    )
  ) {
    return null;
  }

  return resolveProjectDisplayName(
    input.systemSettings,
    input.fallbackAppName,
    input.activeProjectSlug
  );
}

export function resolveAppBrowserTitle(input: {
  projectBootstrapState: ProjectBootstrapState;
  platformBootstrapState: PlatformBootstrapState;
  shellProjectDisplayName?: string | null;
  systemSettings?: AppSystemSettings;
  fallbackAppName?: string | null;
  activeProjectSlug?: string | null;
  navigationMode?: "project" | "platform" | "global";
  isProjectRoute?: boolean;
}): string | null {
  const isGlobalShell = isGlobalShellContext(
    input.navigationMode ?? "project",
    input.isProjectRoute ?? true
  );

  if (isGlobalShell) {
    return resolveGlobalShellTitle({
      platformBootstrapState: input.platformBootstrapState,
    });
  }

  const projectName = resolveBrandingProjectName(input);
  if (!projectName) {
    return null;
  }

  return buildAppBrowserTitle(projectName);
}
