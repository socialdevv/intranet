import type { PlatformBootstrapPreviewModel } from "@/lib/api/platform-bootstrap";

export type ProjectDirectoryEntry = PlatformBootstrapPreviewModel["projects"][number] & {
  availability: "available" | "restricted";
};

function normalizeRole(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export function isSuperAdminRole(globalRole: string | null | undefined): boolean {
  return normalizeRole(globalRole) === "super_admin";
}

export function canAccessGlobalAdministration(globalRole: string | null | undefined): boolean {
  const normalized = normalizeRole(globalRole);
  return normalized === "super_admin" || normalized === "global_moderator";
}

export function canCreateProjects(globalRole: string | null | undefined): boolean {
  return isSuperAdminRole(globalRole);
}

export function resolveProjectDirectory(preview: PlatformBootstrapPreviewModel | null | undefined) {
  const sortedProjects: ProjectDirectoryEntry[] = (preview?.projects ?? [])
    .filter((project) => project.isVisible)
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.name.localeCompare(right.name, "pl");
    })
    .map((project) => ({
      ...project,
      availability: project.canEnterProject ? "available" : "restricted",
    }));

  const accessibleProjects = sortedProjects.filter((project) => project.canEnterProject);
  const restrictedProjects = sortedProjects.filter((project) => !project.canEnterProject);

  return {
    allProjects: sortedProjects,
    accessibleProjects,
    restrictedProjects,
    accessibleCount: accessibleProjects.length,
    restrictedCount: restrictedProjects.length,
    globalRole: preview?.currentUser.globalRole ?? null,
    canAccessGlobalAdministration: canAccessGlobalAdministration(preview?.currentUser.globalRole),
    canCreateProjects: canCreateProjects(preview?.currentUser.globalRole),
  };
}

export function findProjectDirectoryEntry(
  preview: PlatformBootstrapPreviewModel | null | undefined,
  projectSlug: string
): ProjectDirectoryEntry | null {
  const normalizedSlug = projectSlug.trim().toLowerCase();
  return (
    resolveProjectDirectory(preview).allProjects.find(
      (project) => project.slug.trim().toLowerCase() === normalizedSlug
    ) ?? null
  );
}