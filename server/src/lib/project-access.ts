import { GlobalRole, ProjectRole } from "@prisma/client";

type ResolveProjectAccessInput = {
  globalRole: GlobalRole;
  isListed: boolean;
  membershipRole: ProjectRole | null;
};

export function isSuperAdmin(globalRole: GlobalRole): boolean {
  return globalRole === GlobalRole.super_admin;
}

export function resolveEffectiveProjectRole({
  globalRole,
  membershipRole,
}: Pick<ResolveProjectAccessInput, "globalRole" | "membershipRole">): ProjectRole | null {
  if (membershipRole !== null) {
    return membershipRole;
  }

  if (isSuperAdmin(globalRole)) {
    return ProjectRole.project_admin;
  }

  return null;
}

export function canResolveProjectVisibility({
  globalRole,
  isListed,
  membershipRole,
}: ResolveProjectAccessInput): boolean {
  return isListed || membershipRole !== null || isSuperAdmin(globalRole);
}

export function resolveProjectAccessModel({
  globalRole,
  isListed,
  membershipRole,
}: ResolveProjectAccessInput) {
  const effectiveRole = resolveEffectiveProjectRole({ globalRole, membershipRole });
  const isVisible = canResolveProjectVisibility({ globalRole, isListed, membershipRole });
  const isLocked = effectiveRole === null;

  return {
    isVisible,
    isLocked,
    effectiveProjectRole: effectiveRole,
    ...(isLocked
      ? {
          lockReason: "membership_required",
          lockMessage: "Brak dostępu do tego projektu w aktualnym modelu uprawnień.",
        }
      : {}),
  };
}