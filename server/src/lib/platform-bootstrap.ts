import {
  GlobalRole,
  MediaKind,
  ModuleKey,
  type PrismaClient,
  ProjectRole,
  UserStatus,
} from "@prisma/client";
import {
  resolveEffectiveProjectRole,
  resolveProjectAccessModel,
} from "./project-access.js";
import { buildHomepagePlatformAnnouncements } from "./platform-announcements.js";
import { buildHomepagePlatformLinks } from "./platform-links.js";

export const DEV_USER_HEADER_NAME = "x-dev-user-email";
export const DEFAULT_DEV_USER_EMAIL = "super.admin@intranet.local";

/**
 * Development-only identity resolution guard.
 * Header-based user selection must never be treated as production authentication.
 */
export function isDevHeaderAuthEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export type ResolvedUser = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
  globalRole: GlobalRole;
  status: UserStatus;
};

type ProjectMembershipShape = {
  effectiveRole: ProjectRole;
};

type ProjectModuleShape = {
  moduleKey: ModuleKey;
  enabled: boolean;
};

type ProjectShape = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isListed: boolean;
  memberships: ProjectMembershipShape[];
  modules: ProjectModuleShape[];
};

function resolvePlatformCapabilities(globalRole: GlobalRole) {
  return {
    canAccessIntranet: true,
    canViewProjectDirectory: true,
    canUseGlobalSearch: true,
    canViewGlobalAnnouncements: true,
    canViewGlobalQuickLinks: true,
    canUseDevImpersonation: false,
    canViewPlatformAudit: globalRole === GlobalRole.super_admin,
  };
}

function canEditContent(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function canManageProject(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin;
}

function createModuleAvailability(modules: ProjectModuleShape[]) {
  const availability = Object.fromEntries(
    Object.values(ModuleKey).map((moduleKey) => [moduleKey, false])
  ) as Record<ModuleKey, boolean>;

  for (const moduleEntry of modules) {
    availability[moduleEntry.moduleKey] = moduleEntry.enabled;
  }

  return availability;
}

function createProjectCapabilities(effectiveRole: ProjectRole | null) {
  const unlocked = effectiveRole !== null;

  return {
    project: {
      canEnterProject: unlocked,
      canViewProjectHome: unlocked,
      canSearchProject: unlocked,
      canEditContent: unlocked && canEditContent(effectiveRole),
      canManageModules: unlocked && canManageProject(effectiveRole),
      canManageMemberships: unlocked && canManageProject(effectiveRole),
      canViewAudit: unlocked && canEditContent(effectiveRole),
    },
  };
}

function createProjectEntry(project: ProjectShape, globalRole: GlobalRole) {
  const membershipRole = project.memberships[0]?.effectiveRole ?? null;
  const effectiveRole = resolveEffectiveProjectRole({
    globalRole,
    membershipRole,
  });
  const access = resolveProjectAccessModel({
    globalRole,
    isListed: project.isListed,
    membershipRole,
  });

  return {
    id: project.id,
    slug: project.slug,
    code: project.code,
    name: project.name,
    description: project.description,
    sortOrder: project.sortOrder,
    access,
    modules: createModuleAvailability(project.modules),
    capabilities: createProjectCapabilities(effectiveRole),
  };
}

function createUploadDefaults(
  uploadPolicies: Array<{
    mediaKind: MediaKind;
    maxBytes: bigint;
    allowedMimePatterns: string[];
  }>
) {
  return Object.fromEntries(
    uploadPolicies.map((policy) => [
      policy.mediaKind,
      {
        maxBytes: Number(policy.maxBytes),
        allowedMimePatterns: policy.allowedMimePatterns,
      },
    ])
  ) as Record<MediaKind, { maxBytes: number; allowedMimePatterns: string[] }>;
}

export async function resolveCurrentPlatformUser(prisma: PrismaClient, headerValue?: string) {
  if (!isDevHeaderAuthEnabled()) {
    return null;
  }

  const requestedEmail = headerValue?.trim() || DEFAULT_DEV_USER_EMAIL;

  const user = await prisma.user.findFirst({
    where: {
      email: requestedEmail,
      status: UserStatus.active,
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      initials: true,
      globalRole: true,
      status: true,
    },
  });

  return user satisfies ResolvedUser | null;
}

export async function buildPlatformBootstrap(prisma: PrismaClient, currentUser: ResolvedUser) {
  const [projects, uploadPolicies, globalAnnouncements, globalQuickLinks] = await Promise.all([
    prisma.project.findMany({
      where:
        currentUser.globalRole === GlobalRole.super_admin
          ? {
              isActive: true,
            }
          : {
              isActive: true,
              OR: [
                { isListed: true },
                {
                  memberships: {
                    some: {
                      userId: currentUser.id,
                    },
                  },
                },
              ],
            },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        code: true,
        name: true,
        description: true,
        sortOrder: true,
        isListed: true,
        memberships: {
          where: {
            userId: currentUser.id,
          },
          select: {
            effectiveRole: true,
          },
          take: 1,
        },
        modules: {
          select: {
            moduleKey: true,
            enabled: true,
          },
        },
      },
    }),
    prisma.uploadPolicy.findMany({
      where: {
        projectId: null,
      },
      orderBy: {
        mediaKind: "asc",
      },
      select: {
        mediaKind: true,
        maxBytes: true,
        allowedMimePatterns: true,
      },
    }),
    buildHomepagePlatformAnnouncements(prisma),
    buildHomepagePlatformLinks(prisma),
  ]);

  return {
    session: {
      isAuthenticated: true,
      sessionId: null,
      authMode: "development_header",
      expiresAt: null,
      impersonation: {
        active: false,
      },
      currentUserResolver: {
        type: "header",
        headerName: DEV_USER_HEADER_NAME,
        fallbackEmail: DEFAULT_DEV_USER_EMAIL,
      },
    },
    user: {
      id: currentUser.id,
      email: currentUser.email,
      displayName: currentUser.displayName,
      initials: currentUser.initials,
      globalRole: currentUser.globalRole,
      status: currentUser.status,
    },
    capabilities: {
      platform: resolvePlatformCapabilities(currentUser.globalRole),
    },
    homepage: {
      welcomeTitle: "Intranet",
      globalAnnouncements,
      globalQuickLinks,
    },
    projects: projects.map((project) => createProjectEntry(project, currentUser.globalRole)),
    uploads: {
      defaults: createUploadDefaults(uploadPolicies),
    },
    search: {
      globalSearchEnabled: true,
      minQueryLength: 2,
    },
  };
}