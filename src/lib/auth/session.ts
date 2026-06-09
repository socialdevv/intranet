/**
 * Session management — Phase 2 placeholder.
 *
 * Full implementation in Phase 2:
 *  - Store session in sessionStorage
 *  - 12-hour TTL
 *  - Logout clears session
 */

import type { AppRole, AppUser } from "@/lib/types/domain";

const SESSION_KEY = "altcloud_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

type StoredSession = {
  role: AppRole;
  expiresAt: number;
  displayName?: string;
  initials?: string;
  identitySource?: AppUser["identitySource"];
  principalId?: string;
  email?: string;
};

export function saveSession(input: AppRole | AppUser): void {
  const user = typeof input === "string" ? roleToUser(input) : input;
  const session: StoredSession = {
    role: user.role,
    expiresAt: Date.now() + SESSION_TTL_MS,
    displayName: user.displayName,
    initials: user.initials,
    identitySource: user.identitySource,
    principalId: user.principalId,
    email: user.email,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AppUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as StoredSession;
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const fallback = roleToUser(session.role);
    return {
      ...fallback,
      displayName: session.displayName ?? fallback.displayName,
      initials: session.initials ?? fallback.initials,
      identitySource: session.identitySource,
      principalId: session.principalId,
      email: session.email,
    };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

function roleToUser(_role: AppRole): AppUser {
  const role = _role;
  if (role === "editor") {
    return { role, displayName: "Edytor", initials: "ED" };
  }
  if (role === "agent") {
    return { role, displayName: "Agent", initials: "AG" };
  }
  return { role: "admin", displayName: "Administrator", initials: "AD" };
}
