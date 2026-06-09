import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useData } from "@/contexts/data-context";
import type { AppRole, AppUser, IdentitySourceMode } from "@/lib/types/domain";
import { verifyPin } from "@/lib/auth/pin-auth";
import { loadSession, saveSession, clearSession } from "@/lib/auth/session";
import {
  resolveExternalIdentityResult,
  type ResolveExternalIdentityResult,
} from "@/lib/auth/identity";
import type { IdentityContractCode } from "@/lib/integration/contracts";

// ── Types ─────────────────────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true }
  | { ok: false; error: string };

export type IdentityBootstrapState = {
  status: "idle" | "resolved" | "not-configured" | "failed";
  source: IdentitySourceMode;
  code: IdentityContractCode | null;
  message: string | null;
  at: string | null;
};

type AuthContextValue = {
  user: AppUser | null;
  isResolvingUser: boolean;
  identityBootstrapState: IdentityBootstrapState;
  /**
   * Explicit local PIN fallback. Kept only as a minimal compatibility path while
   * the frontend moves to backend-resolved identity.
   */
  loginWithPin: (
    pin: string,
    adminHash: string
  ) => Promise<LoginResult>;
  bootstrapExternalIdentity: (options: {
    source: IdentitySourceMode;
    externalIdentityHeader?: string;
    whoamiEndpoint?: string;
  }) => Promise<ResolveExternalIdentityResult | null>;
  logout: () => void;
};

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

function createIdleIdentityState(source: IdentitySourceMode = "pin"): IdentityBootstrapState {
  return {
    status: "idle",
    source,
    code: null,
    message: null,
    at: null,
  };
}

function toAppRole(value: string | null | undefined): AppRole | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === "admin" ||
    normalized === "super_admin" ||
    normalized === "project_admin"
  ) {
    return "admin";
  }

  if (
    normalized === "editor" ||
    normalized === "global_moderator" ||
    normalized === "content_manager"
  ) {
    return "editor";
  }

  if (
    normalized === "agent" ||
    normalized === "user" ||
    normalized === "project_user"
  ) {
    return "agent";
  }

  return null;
}

function deriveInitials(displayName: string): string {
  const tokens = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) {
    return "US";
  }

  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("") || "US";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const {
    isLoading: isDataLoading,
    systemSettings,
    platformBootstrapState,
    projectBootstrapState,
  } = useData();
  const [sessionUser, setSessionUser] = useState<AppUser | null>(() => loadSession());
  const [identityBootstrapState, setIdentityBootstrapState] = useState<IdentityBootstrapState>(
    () => createIdleIdentityState()
  );

  const configuredIdentitySource = systemSettings.auth?.identitySource ?? "pin";

  useEffect(() => {
    setIdentityBootstrapState((current) => {
      if (current.status !== "idle" || current.source === configuredIdentitySource) {
        return current;
      }

      return createIdleIdentityState(configuredIdentitySource);
    });
  }, [configuredIdentitySource]);

  const platformResolvedUser = useMemo<AppUser | null>(() => {
    if (platformBootstrapState.status !== "ready") {
      return null;
    }

    const projectRole =
      projectBootstrapState.status === "ready"
        ? toAppRole(projectBootstrapState.preview.access.effectiveProjectRole)
        : null;
    const globalRole = toAppRole(platformBootstrapState.preview.currentUser.globalRole);
    const resolvedRole = projectRole ?? globalRole;

    if (!resolvedRole) {
      return null;
    }

    return {
      role: resolvedRole,
      displayName: platformBootstrapState.preview.currentUser.displayName,
      initials: deriveInitials(platformBootstrapState.preview.currentUser.displayName),
      email: platformBootstrapState.preview.currentUser.email,
      identitySource: "platform-bootstrap",
    };
  }, [platformBootstrapState, projectBootstrapState]);

  const localFallbackUser = useMemo<AppUser | null>(() => {
    if (isDataLoading || platformResolvedUser || sessionUser) {
      return null;
    }

    const shouldUseFallback =
      configuredIdentitySource === "pin" ||
      identityBootstrapState.status === "failed" ||
      identityBootstrapState.status === "not-configured";

    if (!shouldUseFallback) {
      return null;
    }

    return {
      role: "admin",
      displayName: "Lokalny administrator",
      initials: "LA",
      identitySource: "local-fallback",
    };
  }, [configuredIdentitySource, identityBootstrapState.status, isDataLoading, platformResolvedUser, sessionUser]);

  const user = platformResolvedUser ?? sessionUser ?? localFallbackUser;

  const isResolvingUser =
    !user &&
    (isDataLoading ||
      platformBootstrapState.status === "loading" ||
      (configuredIdentitySource !== "pin" && identityBootstrapState.status === "idle"));

  const establishSession = useCallback((nextUser: AppUser): void => {
    saveSession(nextUser);
    setSessionUser(nextUser);
  }, []);

  const loginWithPin = useCallback(
    async (
      pin: string,
      adminHash: string
    ): Promise<LoginResult> => {
      const trimmed = pin.trim();
      if (!trimmed) {
        return { ok: false, error: "Wprowadź PIN." };
      }

      if (!adminHash) {
        return {
          ok: false,
          error: "Brak skonfigurowanego PINu. Skontaktuj się z administratorem systemu.",
        };
      }

      if (await verifyPin(trimmed, adminHash)) {
        const appUser: AppUser = {
          role: "admin",
          displayName: "Administrator",
          initials: "AD",
          identitySource: "pin",
        };
        establishSession(appUser);
        setIdentityBootstrapState(createIdleIdentityState("pin"));
        return { ok: true };
      }

      return { ok: false, error: "Nieprawidłowy PIN." };
    },
    [establishSession]
  );

  const bootstrapExternalIdentity = useCallback(
    async (options: {
      source: IdentitySourceMode;
      externalIdentityHeader?: string;
      whoamiEndpoint?: string;
    }): Promise<ResolveExternalIdentityResult | null> => {
      if (platformResolvedUser || sessionUser) return null;
      if (options.source === "pin") {
        setIdentityBootstrapState(createIdleIdentityState("pin"));
        return null;
      }

      const resolved = await resolveExternalIdentityResult(options);
      if (!resolved.ok) {
        setIdentityBootstrapState({
          status: resolved.outcome === "not-configured" ? "not-configured" : "failed",
          source: resolved.runtime.source,
          code: resolved.code,
          message: resolved.error,
          at: new Date().toISOString(),
        });
        return resolved;
      }

      establishSession({
        role: resolved.identity.role,
        displayName: resolved.identity.displayName,
        initials: resolved.identity.initials,
        identitySource: resolved.identity.source,
        principalId: resolved.identity.principalId,
        email: resolved.identity.email,
      });
      setIdentityBootstrapState({
        status: "resolved",
        source: resolved.runtime.source,
        code: resolved.code,
        message: null,
        at: new Date().toISOString(),
      });
      return resolved;
    },
    [establishSession, platformResolvedUser, sessionUser]
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionUser(null);
    setIdentityBootstrapState(createIdleIdentityState(configuredIdentitySource));
  }, [configuredIdentitySource]);

  const value = useMemo(
    () => ({
      user,
      isResolvingUser,
      identityBootstrapState,
      loginWithPin,
      bootstrapExternalIdentity,
      logout,
    }),
    [user, isResolvingUser, identityBootstrapState, loginWithPin, bootstrapExternalIdentity, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
