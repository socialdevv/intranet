import type { AppRole, IdentitySourceMode } from "@/lib/types/domain";
import type {
  IdentityContractCode,
  IntegrationCapabilityState,
} from "@/lib/integration/contracts";

type ExternalIdentitySource = Exclude<IdentitySourceMode, "pin">;

type ExternalIdentityPayload = {
  role?: unknown;
  appRole?: unknown;
  displayName?: unknown;
  name?: unknown;
  initials?: unknown;
  principalId?: unknown;
  id?: unknown;
  email?: unknown;
  upn?: unknown;
};

export type ResolvedIdentity = {
  role: AppRole;
  displayName: string;
  initials: string;
  principalId?: string;
  email?: string;
  source: ExternalIdentitySource;
};

export type ResolveIdentityOptions = {
  source: IdentitySourceMode;
  externalIdentityHeader?: string;
  whoamiEndpoint?: string;
};

export type IdentityResolutionRuntime = {
  source: IdentitySourceMode;
  capability: IntegrationCapabilityState;
  externalIdentityHeader: string | null;
  whoamiEndpoint: string | null;
};

export type ResolveExternalIdentityResult =
  | {
      ok: true;
      outcome: "success";
      code: "identity-resolved";
      identity: ResolvedIdentity;
      runtime: IdentityResolutionRuntime;
    }
  | {
      ok: false;
      outcome: "not-configured" | "failure";
      code: Exclude<IdentityContractCode, "identity-resolved">;
      error: string;
      runtime: IdentityResolutionRuntime;
      httpStatus?: number;
    };

function toRole(value: unknown): AppRole | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "admin" || normalized === "editor" || normalized === "agent") {
    return normalized;
  }
  return null;
}

function deriveInitials(displayName: string): string {
  const tokens = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) return "US";
  return tokens.map((token) => token[0]?.toUpperCase() ?? "").join("") || "US";
}

function toNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseIdentity(
  payload: ExternalIdentityPayload,
  source: ExternalIdentitySource
): ResolvedIdentity | null {
  const role = toRole(payload.role ?? payload.appRole);
  if (!role) return null;

  const displayName =
    toNonEmptyString(payload.displayName) ??
    toNonEmptyString(payload.name) ??
    "Użytkownik";

  const initials =
    toNonEmptyString(payload.initials)?.slice(0, 4).toUpperCase() ??
    deriveInitials(displayName);

  return {
    role,
    displayName,
    initials,
    principalId: toNonEmptyString(payload.principalId) ?? toNonEmptyString(payload.id),
    email: toNonEmptyString(payload.email) ?? toNonEmptyString(payload.upn),
    source,
  };
}

function readWindowInjectedIdentity(): ExternalIdentityPayload | null {
  const runtimeWindow = window as Window & {
    __ALTCLOUD_IDENTITY__?: unknown;
  };

  if (!runtimeWindow.__ALTCLOUD_IDENTITY__ || typeof runtimeWindow.__ALTCLOUD_IDENTITY__ !== "object") {
    return null;
  }

  return runtimeWindow.__ALTCLOUD_IDENTITY__ as ExternalIdentityPayload;
}

function normalizeMaybeString(value: string | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function getIdentityResolutionRuntime(
  options: ResolveIdentityOptions
): IdentityResolutionRuntime {
  const externalIdentityHeader = normalizeMaybeString(options.externalIdentityHeader);
  const whoamiEndpoint = normalizeMaybeString(options.whoamiEndpoint);

  if (options.source === "pin") {
    return {
      source: "pin",
      capability: "not-configured",
      externalIdentityHeader,
      whoamiEndpoint,
    };
  }

  if (options.source === "external-header") {
    return {
      source: "external-header",
      capability: readWindowInjectedIdentity() ? "configured" : "not-configured",
      externalIdentityHeader,
      whoamiEndpoint,
    };
  }

  return {
    source: "external-whoami",
    capability: whoamiEndpoint ? "configured" : "not-configured",
    externalIdentityHeader,
    whoamiEndpoint,
  };
}

export async function resolveExternalIdentityResult(
  options: ResolveIdentityOptions
): Promise<ResolveExternalIdentityResult> {
  const runtime = getIdentityResolutionRuntime(options);

  if (options.source === "pin") {
    return {
      ok: false,
      outcome: "not-configured",
      code: "identity-pin-mode",
      error: "Tryb tożsamości pin nie korzysta z integracji zewnętrznej.",
      runtime,
    };
  }

  if (options.source === "external-header") {
    const injected = readWindowInjectedIdentity();
    if (!injected) {
      return {
        ok: false,
        outcome: "not-configured",
        code: "identity-header-unavailable",
        error:
          "Brak zainicjalizowanej tożsamości zewnętrznej w runtime (__ALTCLOUD_IDENTITY__).",
        runtime,
      };
    }

    const identity = parseIdentity(injected, "external-header");
    if (!identity) {
      return {
        ok: false,
        outcome: "failure",
        code: "identity-role-missing",
        error: "Nie udało się zmapować roli użytkownika z tożsamości zewnętrznej.",
        runtime,
      };
    }

    return {
      ok: true,
      outcome: "success",
      code: "identity-resolved",
      identity,
      runtime,
    };
  }

  if (!runtime.whoamiEndpoint) {
    return {
      ok: false,
      outcome: "not-configured",
      code: "identity-whoami-not-configured",
      error: "Nie skonfigurowano whoamiEndpoint dla trybu external-whoami.",
      runtime,
    };
  }

  try {
    const response = await fetch(runtime.whoamiEndpoint, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        ok: false,
        outcome: "failure",
        code: "identity-whoami-http-error",
        error: `Whoami zwróciło HTTP ${response.status}.`,
        runtime,
        httpStatus: response.status,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        ok: false,
        outcome: "failure",
        code: "identity-whoami-invalid-response",
        error: "Whoami zwróciło odpowiedź, której nie można sparsować jako JSON.",
        runtime,
      };
    }

    if (!payload || typeof payload !== "object") {
      return {
        ok: false,
        outcome: "failure",
        code: "identity-whoami-invalid-response",
        error: "Whoami zwróciło nieprawidłowy format danych.",
        runtime,
      };
    }

    const identity = parseIdentity(payload as ExternalIdentityPayload, "external-whoami");
    if (!identity) {
      return {
        ok: false,
        outcome: "failure",
        code: "identity-role-missing",
        error: "Whoami nie zwróciło rozpoznawalnej roli użytkownika.",
        runtime,
      };
    }

    return {
      ok: true,
      outcome: "success",
      code: "identity-resolved",
      identity,
      runtime,
    };
  } catch {
    return {
      ok: false,
      outcome: "failure",
      code: "identity-whoami-network-error",
      error: "Nie udało się połączyć z endpointem whoami.",
      runtime,
    };
  }
}

export async function resolveExternalIdentity(
  options: ResolveIdentityOptions
): Promise<ResolvedIdentity | null> {
  const result = await resolveExternalIdentityResult(options);
  return result.ok ? result.identity : null;
}
