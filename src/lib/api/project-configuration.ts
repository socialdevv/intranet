import type { AppModuleKey, HomeSpotlight } from "@/lib/types/domain";
import type { LeadConfig } from "@/lib/types/lead";
import {
  createBootstrapPreviewRequestHeaders,
  readApiErrorMessage,
  type ApiEnvelope,
} from "./bootstrap-preview-runtime";
import {
  FRONTEND_TO_BACKEND_MODULE_KEY_MAP,
  FRONTEND_TO_BACKEND_NAV_KEY_MAP,
  type ProjectBootstrapResponse,
} from "./project-bootstrap";

export type ProjectConfigurationResponse = ApiEnvelope<{
  project: ProjectBootstrapResponse["project"];
  configuration: ProjectBootstrapResponse["configuration"];
}>;

function requestPath(projectSlug: string, suffix: string): string {
  return `/api/v1/projects/${encodeURIComponent(projectSlug)}${suffix}`;
}

async function parseProjectConfigurationResponse(
  response: Response,
  fallbackMessage: string
): Promise<ProjectConfigurationResponse> {
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, fallbackMessage));
  }

  return (await response.json()) as ProjectConfigurationResponse;
}

export async function updateProjectModuleConfiguration(
  projectSlug: string,
  moduleKey: AppModuleKey,
  input: {
    enabled?: boolean;
    settings?: unknown;
  }
): Promise<ProjectConfigurationResponse> {
  const backendModuleKey = FRONTEND_TO_BACKEND_MODULE_KEY_MAP[moduleKey];

  const response = await fetch(
    requestPath(projectSlug, `/modules/${encodeURIComponent(backendModuleKey)}`),
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        ...createBootstrapPreviewRequestHeaders(),
      },
      body: JSON.stringify(input),
    }
  );

  return parseProjectConfigurationResponse(
    response,
    `Project module update request failed with HTTP ${response.status}.`
  );
}

export async function updateProjectMetadata(
  projectSlug: string,
  input: {
    slug: string;
    code: string;
    name: string;
  }
): Promise<ProjectConfigurationResponse> {
  const response = await fetch(requestPath(projectSlug, ""), {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(input),
  });

  return parseProjectConfigurationResponse(
    response,
    `Project metadata update request failed with HTTP ${response.status}.`
  );
}

export async function updateProjectNavigation(
  projectSlug: string,
  orderedNavKeys: string[]
): Promise<ProjectConfigurationResponse> {
  const orderedModuleKeys = orderedNavKeys
    .filter((entryKey) => entryKey !== "home")
    .map((entryKey) => {
      const backendModuleKey = FRONTEND_TO_BACKEND_NAV_KEY_MAP[entryKey];

      if (!backendModuleKey) {
        throw new Error(`Cannot map navigation key '${entryKey}' to a backend project module.`);
      }

      return backendModuleKey;
    });

  const response = await fetch(requestPath(projectSlug, "/navigation"), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify({ orderedModuleKeys }),
  });

  return parseProjectConfigurationResponse(
    response,
    `Project navigation update request failed with HTTP ${response.status}.`
  );
}

export async function replaceProjectHomeSpotlights(
  projectSlug: string,
  items: HomeSpotlight[]
): Promise<ProjectConfigurationResponse> {
  const response = await fetch(requestPath(projectSlug, "/home-spotlights"), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify({
      items: items.map((item, index) => ({
        id: item.id,
        pageId: item.pageId,
        labelOverride: item.labelOverride,
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : index,
      })),
    }),
  });

  return parseProjectConfigurationResponse(
    response,
    `Project home spotlights update request failed with HTTP ${response.status}.`
  );
}

export async function replaceProjectLeadConfig(
  projectSlug: string,
  config: LeadConfig
): Promise<ProjectConfigurationResponse> {
  const response = await fetch(requestPath(projectSlug, "/lead-config"), {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      ...createBootstrapPreviewRequestHeaders(),
    },
    body: JSON.stringify(config),
  });

  return parseProjectConfigurationResponse(
    response,
    `Project lead configuration update request failed with HTTP ${response.status}.`
  );
}