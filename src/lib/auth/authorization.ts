import type { AppRole, AppUser } from "@/lib/types/domain";

export type AdminAreaId = "content" | "configuration" | "system";

export type AdminPanelId =
  | "wiedza"
  | "historia"
  | "szablony"
  | "startowa"
  | "linki"
  | "formularze"
  | "kontakty"
  | "zwroty"
  | "ogloszenia"
  | "moduly"
  | "macierz"
  | "lead"
  | "tozsamosc"
  | "integrity";

export type AppPermission =
  | "admin.panel.access"
  | "admin.area.content.access"
  | "admin.area.configuration.access"
  | "admin.area.system.access"
  | "content.edit"
  | "configuration.edit"
  | "rules.edit"
  | "system.edit";

const ROLE_PERMISSION_MAP: Record<AppRole, readonly AppPermission[]> = {
  admin: [
    "admin.panel.access",
    "admin.area.content.access",
    "admin.area.configuration.access",
    "admin.area.system.access",
    "content.edit",
    "configuration.edit",
    "rules.edit",
    "system.edit",
  ],
  editor: [
    "admin.panel.access",
    "admin.area.content.access",
    "content.edit",
  ],
  agent: [],
};

const PANEL_TO_AREA_MAP: Record<AdminPanelId, AdminAreaId> = {
  wiedza: "content",
  historia: "system",
  szablony: "content",
  startowa: "content",
  linki: "content",
  formularze: "content",
  kontakty: "content",
  zwroty: "content",
  ogloszenia: "content",
  moduly: "configuration",
  macierz: "content",
  lead: "content",
  tozsamosc: "system",
  integrity: "system",
};

const PANEL_ACCESS_PERMISSION: Partial<Record<AdminPanelId, AppPermission>> = {
  macierz: "rules.edit",
  lead: "rules.edit",
};

const AREA_ACCESS_PERMISSION: Record<AdminAreaId, AppPermission> = {
  content: "admin.area.content.access",
  configuration: "admin.area.configuration.access",
  system: "admin.area.system.access",
};

function getUserRole(user: Pick<AppUser, "role"> | null | undefined): AppRole | null {
  return user?.role ?? null;
}

export function can(user: Pick<AppUser, "role"> | null | undefined, permission: AppPermission): boolean {
  const role = getUserRole(user);
  if (!role) return false;
  return ROLE_PERMISSION_MAP[role].includes(permission);
}

export function canAccessAdminPanel(user: Pick<AppUser, "role"> | null | undefined): boolean {
  return can(user, "admin.panel.access");
}

export function canAccessAdminArea(
  user: Pick<AppUser, "role"> | null | undefined,
  area: AdminAreaId
): boolean {
  return can(user, AREA_ACCESS_PERMISSION[area]);
}

export function canAccessAdminPanelById(
  user: Pick<AppUser, "role"> | null | undefined,
  panelId: AdminPanelId
): boolean {
  const area = PANEL_TO_AREA_MAP[panelId];
  if (!canAccessAdminArea(user, area)) {
    return false;
  }

  const requiredPermission = PANEL_ACCESS_PERMISSION[panelId];
  return requiredPermission ? can(user, requiredPermission) : true;
}

export function resolveAdminAreaForPanel(panelId: AdminPanelId): AdminAreaId {
  return PANEL_TO_AREA_MAP[panelId];
}

export function canEditContent(user: Pick<AppUser, "role"> | null | undefined): boolean {
  return can(user, "content.edit");
}

export function canEditConfiguration(user: Pick<AppUser, "role"> | null | undefined): boolean {
  return can(user, "configuration.edit");
}

export function canEditRules(user: Pick<AppUser, "role"> | null | undefined): boolean {
  return can(user, "rules.edit");
}

export function canEditSystem(user: Pick<AppUser, "role"> | null | undefined): boolean {
  return can(user, "system.edit");
}
