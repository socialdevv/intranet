import {
  bytesToMegabytes,
  createBootstrapPreviewRequestHeaders,
  getSelectedBootstrapPreviewDevUserEmail,
  readApiErrorMessage,
  type ApiEnvelope,
  type BootstrapPreviewDataSourceMode,
} from "./bootstrap-preview-runtime";
import type { PlatformAnnouncementRecord } from "./platform-announcements";
import type { PlatformLinkRecord } from "./platform-links";

export {
  getBootstrapPreviewDataSourceMode as getPlatformDataSourceMode,
  isApiBootstrapPreviewEnabled as isApiPlatformDataSourceEnabled,
} from "./bootstrap-preview-runtime";

export type PlatformDataSourceMode = BootstrapPreviewDataSourceMode;

type PlatformModuleKey =
  | "matrix"
  | "announcements"
  | "communications"
  | "templates"
  | "phrases"
  | "links"
  | "contacts"
  | "important_topics"
  | "quick_links";

type PlatformProjectAccess = {
  isVisible: boolean;
  isLocked: boolean;
  effectiveProjectRole: string | null;
  lockReason?: string;
  lockMessage?: string;
};

type PlatformProjectEntry = {
  id: string;
  slug: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  access: PlatformProjectAccess;
  modules: Record<PlatformModuleKey, boolean>;
  capabilities: {
    project: {
      canEnterProject: boolean;
      canViewProjectHome: boolean;
      canSearchProject: boolean;
      canEditContent: boolean;
      canManageModules: boolean;
      canManageMemberships: boolean;
      canViewAudit: boolean;
    };
  };
};

type UploadDefaultEntry = {
  maxBytes: number;
  allowedMimePatterns: string[];
};

export type PlatformBootstrapResponse = {
  session: {
    isAuthenticated: boolean;
    sessionId: string | null;
    authMode: string;
    expiresAt: string | null;
    impersonation: {
      active: boolean;
    };
    currentUserResolver: {
      type: string;
      headerName: string;
      fallbackEmail: string;
    };
  };
  user: {
    id: string;
    email: string;
    displayName: string;
    initials: string;
    globalRole: string;
    status: string;
  };
  capabilities: {
    platform: {
      canAccessIntranet: boolean;
      canViewProjectDirectory: boolean;
      canUseGlobalSearch: boolean;
      canViewGlobalAnnouncements: boolean;
      canViewGlobalQuickLinks: boolean;
      canUseDevImpersonation: boolean;
      canViewPlatformAudit: boolean;
    };
  };
  homepage: {
    welcomeTitle: string;
    globalAnnouncements: PlatformAnnouncementRecord[];
    globalQuickLinks: PlatformLinkRecord[];
  };
  projects: PlatformProjectEntry[];
  uploads: {
    defaults: {
      image: UploadDefaultEntry;
      file: UploadDefaultEntry;
      video: UploadDefaultEntry;
    };
  };
  search: {
    globalSearchEnabled: boolean;
    minQueryLength: number;
  };
};

export type PlatformBootstrapPreviewModel = {
  sourceMode: "api";
  authMode: string;
  currentUser: {
    displayName: string;
    email: string;
    globalRole: string;
  };
  platformCapabilities: PlatformBootstrapResponse["capabilities"]["platform"];
  homepage: PlatformBootstrapResponse["homepage"];
  requestMeta: {
    requestId: string;
    timestamp: string;
  };
  resolver: {
    headerName: string;
    fallbackEmail: string;
    selectedEmail: string | null;
  };
  projects: Array<{
    id: string;
    slug: string;
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isVisible: boolean;
    isLocked: boolean;
    canEnterProject: boolean;
    effectiveProjectRole: string | null;
    enabledModuleCount: number;
  }>;
  uploadLimitsMb: {
    image: number;
    file: number;
    video: number;
  };
  search: {
    globalSearchEnabled: boolean;
    minQueryLength: number;
  };
};

export async function fetchPlatformBootstrap(signal?: AbortSignal): Promise<ApiEnvelope<PlatformBootstrapResponse>> {
  const response = await fetch("/api/v1/platform/bootstrap", {
    method: "GET",
    headers: createBootstrapPreviewRequestHeaders(),
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    const fallbackMessage = `Platform bootstrap request failed with HTTP ${response.status}.`;
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ApiEnvelope<PlatformBootstrapResponse>;
}

export function adaptPlatformBootstrapToPreview(
  payload: ApiEnvelope<PlatformBootstrapResponse>
): PlatformBootstrapPreviewModel {
  const selectedEmail = getSelectedBootstrapPreviewDevUserEmail();

  return {
    sourceMode: "api",
    authMode: payload.data.session.authMode,
    currentUser: {
      displayName: payload.data.user.displayName,
      email: payload.data.user.email,
      globalRole: payload.data.user.globalRole,
    },
    platformCapabilities: payload.data.capabilities.platform,
    homepage: payload.data.homepage,
    requestMeta: payload.meta,
    resolver: {
      headerName: payload.data.session.currentUserResolver.headerName,
      fallbackEmail: payload.data.session.currentUserResolver.fallbackEmail,
      selectedEmail,
    },
    projects: payload.data.projects.map((project) => ({
      id: project.id,
      slug: project.slug,
      code: project.code,
      name: project.name,
      description: project.description,
      sortOrder: project.sortOrder,
      isVisible: project.access.isVisible,
      isLocked: project.access.isLocked,
      canEnterProject: project.capabilities.project.canEnterProject,
      effectiveProjectRole: project.access.effectiveProjectRole,
      enabledModuleCount: Object.values(project.modules).filter(Boolean).length,
    })),
    uploadLimitsMb: {
      image: bytesToMegabytes(payload.data.uploads.defaults.image.maxBytes),
      file: bytesToMegabytes(payload.data.uploads.defaults.file.maxBytes),
      video: bytesToMegabytes(payload.data.uploads.defaults.video.maxBytes),
    },
    search: payload.data.search,
  };
}