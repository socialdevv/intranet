import {
  MediaKind,
  ModuleKey,
  type PrismaClient,
  ProjectRole,
} from "@prisma/client";
import type { ResolvedUser } from "./platform-bootstrap.js";
import {
  createProjectConfigurationSnapshot,
  type ProjectConfigurationHomeSpotlightShape,
  type ProjectConfigurationModuleShape,
} from "./project-configuration.js";
import {
  canResolveProjectVisibility,
  resolveEffectiveProjectRole,
  resolveProjectAccessModel,
} from "./project-access.js";

type ProjectBootstrapResult =
  | {
      ok: true;
      data: ReturnType<typeof createProjectBootstrapPayload>;
    }
  | {
      ok: false;
      reason: "not_found";
    };

type UploadPolicyShape = {
  mediaKind: MediaKind;
  maxBytes: bigint;
  allowedMimePatterns: string[];
};

type ProjectShape = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  isListed: boolean;
  sortOrder: number;
  memberships: Array<{
    effectiveRole: ProjectRole;
  }>;
  modules: ProjectConfigurationModuleShape[];
  homeSpotlights: ProjectConfigurationHomeSpotlightShape[];
  uploadPolicies: UploadPolicyShape[];
};

function canEditContent(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function canManageProject(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin;
}

function createModuleCapabilities(
  modules: ProjectConfigurationModuleShape[],
  effectiveRole: ProjectRole | null
) {
  const unlocked = effectiveRole !== null;
  const editable = unlocked && canEditContent(effectiveRole);
  const manageable = unlocked && canManageProject(effectiveRole);
  const moduleMap = new Map(modules.map((moduleEntry) => [moduleEntry.moduleKey, moduleEntry]));

  return Object.fromEntries(
    Object.values(ModuleKey).map((moduleKey) => {
      const moduleEntry = moduleMap.get(moduleKey) ?? null;
      const enabled = moduleEntry?.enabled ?? false;

      return [
        moduleKey,
        {
          enabled,
          canView: unlocked && enabled,
          canCreate: editable && enabled,
          canEdit: editable && enabled,
          canDelete: manageable && enabled,
        },
      ];
    })
  );
}

function createProjectCapabilities(
  modules: ProjectConfigurationModuleShape[],
  effectiveRole: ProjectRole | null
) {
  const unlocked = effectiveRole !== null;
  const editable = unlocked && canEditContent(effectiveRole);
  const manageable = unlocked && canManageProject(effectiveRole);

  return {
    project: {
      canEnterProject: unlocked,
      canViewProjectHome: unlocked,
      canSearchProject: unlocked,
      canViewRestrictedMaterial: false,
      canEditContent: editable,
      canManageCategories: manageable,
      canManageModules: manageable,
      canManageMemberships: manageable,
      canUploadFiles: editable,
      canViewAudit: editable,
    },
    modules: createModuleCapabilities(modules, effectiveRole),
  };
}

function createResolvedUploadPolicies(
  globalDefaults: UploadPolicyShape[],
  projectPolicies: UploadPolicyShape[]
) {
  const resolved = new Map<MediaKind, UploadPolicyShape>();

  for (const policy of globalDefaults) {
    resolved.set(policy.mediaKind, policy);
  }

  for (const policy of projectPolicies) {
    resolved.set(policy.mediaKind, policy);
  }

  const orderedKinds = Object.values(MediaKind);

  const limits = Object.fromEntries(
    orderedKinds.map((mediaKind) => [mediaKind, Number(resolved.get(mediaKind)?.maxBytes ?? 0n)])
  ) as Record<MediaKind, number>;

  const policies = Object.fromEntries(
    orderedKinds.map((mediaKind) => {
      const policy = resolved.get(mediaKind);

      return [
        mediaKind,
        {
          maxBytes: Number(policy?.maxBytes ?? 0n),
          allowedMimePatterns: policy?.allowedMimePatterns ?? [],
          source: projectPolicies.some((projectPolicy) => projectPolicy.mediaKind === mediaKind)
            ? "project"
            : "global-default",
        },
      ];
    })
  ) as Record<MediaKind, { maxBytes: number; allowedMimePatterns: string[]; source: string }>;

  return {
    limits,
    policies,
  };
}

function createEmptyContentPlaceholders() {
  return {
    categories: [],
    home: {
      importantTopics: [],
      quickLinks: [],
    },
    announcements: [],
    communications: [],
    links: [],
    contacts: [],
    matrix: [],
  };
}

function createProjectBootstrapPayload(
  project: ProjectShape,
  globalUploadPolicies: UploadPolicyShape[],
  currentUser: ResolvedUser
) {
  const membershipRole = project.memberships[0]?.effectiveRole ?? null;
  const effectiveRole = resolveEffectiveProjectRole({
    globalRole: currentUser.globalRole,
    membershipRole,
  });
  const access = resolveProjectAccessModel({
    globalRole: currentUser.globalRole,
    isListed: project.isListed,
    membershipRole,
  });
  const locked = access.isLocked;
  const configuration = createProjectConfigurationSnapshot(project);

  return {
    project: {
      id: project.id,
      slug: project.slug,
      code: project.code,
      name: project.name,
      description: project.description,
      sortOrder: project.sortOrder,
    },
    access,
    capabilities: createProjectCapabilities(project.modules, effectiveRole),
    configuration,
    content: createEmptyContentPlaceholders(),
    uploads: createResolvedUploadPolicies(globalUploadPolicies, project.uploadPolicies),
    search: {
      projectSearchEnabled: !locked,
      minQueryLength: 2,
    },
  };
}

export async function buildProjectBootstrap(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  projectSlug: string
): Promise<ProjectBootstrapResult> {
  const [project, globalUploadPolicies] = await Promise.all([
    prisma.project.findFirst({
      where: {
        slug: projectSlug,
        isActive: true,
      },
      select: {
        id: true,
        slug: true,
        code: true,
        name: true,
        description: true,
        isListed: true,
        sortOrder: true,
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
          orderBy: [{ navOrder: "asc" }, { moduleKey: "asc" }],
          select: {
            moduleKey: true,
            enabled: true,
            navVisible: true,
            navOrder: true,
            settingsJson: true,
          },
        },
        homeSpotlights: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          select: {
            id: true,
            articleId: true,
            labelOverride: true,
            sortOrder: true,
          },
        },
        uploadPolicies: {
          select: {
            mediaKind: true,
            maxBytes: true,
            allowedMimePatterns: true,
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
  ]);

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  const membershipRole = project.memberships[0]?.effectiveRole ?? null;
  const canSeeProject = canResolveProjectVisibility({
    globalRole: currentUser.globalRole,
    isListed: project.isListed,
    membershipRole,
  });

  if (!canSeeProject) {
    return {
      ok: false,
      reason: "not_found",
    };
  }

  return {
    ok: true,
    data: createProjectBootstrapPayload(project, globalUploadPolicies, currentUser),
  };
}