import {
  MAIN_NAV_MODULE_KEYS,
  MODULE_DEFINITIONS,
  resolveEnabledModules,
  resolveModuleSettings,
} from "@/lib/config/modules";
import {
  DEFAULT_MEDIA_FOLDERS,
  detectMediaAssetSource,
  normalizeMediaSrc,
  type MediaAssetKind,
} from "@/lib/media/assets";
import { ROUTES } from "@/lib/routes";
import type { AppData, AppModuleKey } from "@/lib/types/domain";

export type IntegritySeverity = "error" | "warning" | "info";

export type IntegrityFinding = {
  id: string;
  severity: IntegritySeverity;
  code: string;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
};

export type IntegritySummary = {
  errors: number;
  warnings: number;
  info: number;
  total: number;
};

export type IntegrityReport = {
  generatedAt: string;
  findings: IntegrityFinding[];
  summary: IntegritySummary;
};

type InternalLinkReference = {
  entityType?: string;
  entityId?: string;
  hrefSnapshot?: string;
};

type TipTapMediaReference = {
  kind: MediaAssetKind;
  nodeType: string;
  rawValue: unknown;
  normalized: string;
  source: ReturnType<typeof detectMediaAssetSource>;
};

type NavConfigModuleKey =
  | "matrix"
  | "szablony"
  | "cenniki"
  | "komunikaty"
  | "tematOrg"
  | "linki"
  | "kontakty"
  | "zwroty";

const ROUTE_MODULE_BINDINGS: Array<{ route: string; moduleKey: AppModuleKey; label: string }> = [
  { route: ROUTES.matrix, moduleKey: "matrix", label: "Macierz" },
  { route: ROUTES.szablony, moduleKey: "szablony", label: "Szablony" },
  { route: ROUTES.cenniki, moduleKey: "cenniki", label: "Cenniki" },
  { route: ROUTES.komunikaty, moduleKey: "komunikaty", label: "Komunikaty" },
  { route: ROUTES.tematOrg, moduleKey: "tematOrg", label: "Tematy organizacyjne" },
  { route: ROUTES.linki, moduleKey: "linki", label: "Linki" },
  { route: ROUTES.kontakty, moduleKey: "kontakty", label: "Kontakty" },
  { route: ROUTES.zwroty, moduleKey: "zwroty", label: "Zwroty" },
];

function matchesRoutePrefix(path: string, route: string): boolean {
  if (route === "/") return path === "/";
  return path === route || path.startsWith(`${route}/`);
}

function normalizePath(url: string): string {
  const hashStripped = url.split("#")[0] ?? "";
  const queryStripped = hashStripped.split("?")[0] ?? "";
  return queryStripped.trim();
}

function resolveTargetModuleForInternalPath(path: string): AppModuleKey | null {
  const binding = ROUTE_MODULE_BINDINGS.find((row) => matchesRoutePrefix(path, row.route));
  return binding?.moduleKey ?? null;
}

function walkTipTapDoc(
  doc: unknown,
  onNode: (node: Record<string, unknown>) => void,
  onMark?: (mark: Record<string, unknown>, parentNodeType?: string) => void
): void {
  function walk(node: unknown): void {
    if (!node || typeof node !== "object") return;

    const objectNode = node as {
      type?: unknown;
      marks?: unknown;
      content?: unknown;
    };

    onNode(objectNode as Record<string, unknown>);

    if (Array.isArray(objectNode.marks) && onMark) {
      for (const mark of objectNode.marks) {
        if (!mark || typeof mark !== "object") continue;
        onMark(mark as Record<string, unknown>, typeof objectNode.type === "string" ? objectNode.type : undefined);
      }
    }

    if (Array.isArray(objectNode.content)) {
      for (const child of objectNode.content) {
        walk(child);
      }
    }
  }

  walk(doc);
}

function collectInternalLinkReferences(doc: unknown): InternalLinkReference[] {
  const collected: InternalLinkReference[] = [];

  walkTipTapDoc(
    doc,
    () => undefined,
    (mark) => {
      if (mark.type !== "internalLink") return;

      const attrs =
        mark.attrs && typeof mark.attrs === "object"
          ? (mark.attrs as Record<string, unknown>)
          : {};

      collected.push({
        entityType: typeof attrs.entityType === "string" ? attrs.entityType : undefined,
        entityId: typeof attrs.entityId === "string" ? attrs.entityId : undefined,
        hrefSnapshot: typeof attrs.hrefSnapshot === "string" ? attrs.hrefSnapshot : undefined,
      });
    }
  );

  return collected;
}

function collectTipTapMediaReferences(doc: unknown): TipTapMediaReference[] {
  const collected: TipTapMediaReference[] = [];

  function pushReference(kind: MediaAssetKind, nodeType: string, rawValue: unknown) {
    const rawString = typeof rawValue === "string" ? rawValue : "";
    const normalized = normalizeMediaSrc(rawString);
    collected.push({
      kind,
      nodeType,
      rawValue,
      normalized,
      source: detectMediaAssetSource(normalized),
    });
  }

  walkTipTapDoc(
    doc,
    (node) => {
      const nodeType = typeof node.type === "string" ? node.type : "unknown";
      const attrs = node.attrs && typeof node.attrs === "object"
        ? (node.attrs as Record<string, unknown>)
        : null;

      if (!attrs) return;

      if (nodeType === "imageBlock" || nodeType === "imageSideBySide") {
        pushReference("image", nodeType, attrs.src);
        return;
      }

      if (nodeType === "videoBlock") {
        pushReference("video", nodeType, attrs.src);
        return;
      }

      if (nodeType === "sectionLink" && attrs.linkType === "url") {
        pushReference("file", nodeType, attrs.url);
      }
    },
    (mark, parentNodeType) => {
      if (mark.type !== "link") return;

      const attrs =
        mark.attrs && typeof mark.attrs === "object"
          ? (mark.attrs as Record<string, unknown>)
          : {};

      pushReference("file", `mark:link${parentNodeType ? ` (${parentNodeType})` : ""}`, attrs.href);
    }
  );

  return collected;
}

function stripQueryAndHash(value: string): string {
  const hashStripped = value.split("#")[0] ?? "";
  return hashStripped.split("?")[0] ?? "";
}

function extractScheme(value: string): string | null {
  const match = value.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!match) return null;
  return match[1]?.toLowerCase() ?? null;
}

function extractFileExtension(path: string): string | null {
  const stripped = stripQueryAndHash(path);
  const lastSegment = stripped.split("/").pop() ?? "";
  if (!lastSegment || lastSegment.endsWith(".")) return null;
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) return null;
  return lastSegment.slice(dotIndex + 1).toLowerCase();
}

function looksLikeFilesystemPath(path: string): boolean {
  return /^([a-zA-Z]:[\\/]|[\\]{2}|\/Users\/|\/home\/|\/var\/|\/tmp\/)/.test(path);
}

function isLikelyLocalMediaSource(source: ReturnType<typeof detectMediaAssetSource>): boolean {
  return source === "deployment-public" || source === "api-upload";
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "bmp",
  "avif",
  "ico",
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "webm",
  "ogg",
  "ogv",
  "mov",
  "m4v",
]);

function sortFindings(findings: IntegrityFinding[]): IntegrityFinding[] {
  const weight: Record<IntegritySeverity, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };

  return [...findings].sort((a, b) => {
    if (weight[a.severity] !== weight[b.severity]) {
      return weight[a.severity] - weight[b.severity];
    }
    if (a.code !== b.code) return a.code.localeCompare(b.code);
    return a.title.localeCompare(b.title);
  });
}

export function runIntegrityChecks(data: AppData): IntegrityReport {
  const findings: IntegrityFinding[] = [];
  let seq = 1;

  function addFinding(input: Omit<IntegrityFinding, "id">) {
    findings.push({
      id: `diag-${seq++}`,
      ...input,
    });
  }

  const categories = data.categories ?? [];
  const pages = data.pages ?? [];
  const matrix = data.matrix ?? [];
  const templates = data.templates ?? [];
  const homeSpotlights = data.homeSpotlights ?? [];
  const homeQuickLinks = data.homeQuickLinks ?? [];
  const links = data.links ?? [];
  const communications = data.communications ?? [];
  const orgEntries = data.orgEntries ?? [];
  const announcements = data.announcements ?? [];

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const pageById = new Map(pages.map((p) => [p.id, p]));
  const matrixById = new Map(matrix.map((m) => [m.id, m]));
  const templateById = new Map(templates.map((t) => [t.id, t]));

  const enabledModules = resolveEnabledModules(data.configuration?.modules?.enabled);
  const moduleSettings = resolveModuleSettings(data.configuration?.modules?.settings);

  function checkTipTapInternalLinks(doc: unknown, source: string) {
    const refs = collectInternalLinkReferences(doc);
    for (const ref of refs) {
      if (!ref.entityType || !ref.entityId) {
        addFinding({
          severity: "warning",
          code: "internal-link.malformed",
          title: "Malformed internal link mark",
          description:
            "A rich-text internal link is missing required target attributes and may not resolve correctly.",
          location: source,
          suggestion: "Open the item in editor and reinsert the internal link target.",
        });
        continue;
      }

      if (ref.entityType === "article") {
        if (!pageById.has(ref.entityId)) {
          addFinding({
            severity: "error",
            code: "internal-link.missing-article",
            title: "Internal link points to missing article",
            description: `Target article id \"${ref.entityId}\" no longer exists.`,
            location: source,
            suggestion: "Update or remove this internal link from the rich content.",
          });
        }
        continue;
      }

      if (ref.entityType === "category" || ref.entityType === "subcategory") {
        if (!categoryById.has(ref.entityId)) {
          addFinding({
            severity: "error",
            code: "internal-link.missing-category",
            title: "Internal link points to missing category",
            description: `Target category id \"${ref.entityId}\" no longer exists.`,
            location: source,
            suggestion: "Update or remove this internal link from the rich content.",
          });
        }
        continue;
      }

      addFinding({
        severity: "warning",
        code: "internal-link.unknown-entity",
        title: "Internal link uses unknown entity type",
        description: `Entity type \"${ref.entityType}\" is not supported by the resolver.`,
        location: source,
        suggestion: "Recreate the link using the internal-link picker in editor.",
      });
    }
  }

  function checkTipTapMediaReferences(doc: unknown, source: string) {
    const refs = collectTipTapMediaReferences(doc);

    for (const ref of refs) {
      const location = `${source} / ${ref.nodeType}`;
      const normalizedPath = stripQueryAndHash(ref.normalized);
      const scheme = extractScheme(ref.normalized);

      if (typeof ref.rawValue !== "string") {
        addFinding({
          severity: "warning",
          code: "media.ref.non-string",
          title: "Media/file reference has invalid shape",
          description:
            "A media or file reference is not stored as text and cannot be resolved reliably.",
          location,
          suggestion: "Open this content block and reselect media/link target in editor.",
        });
        continue;
      }

      if (!ref.normalized) {
        addFinding({
          severity: "error",
          code: "media.ref.empty",
          title: "Media/file reference is empty",
          description: "A media or file reference is missing required src/url value.",
          location,
          suggestion: "Set a valid media path or remove the broken block/link.",
        });
        continue;
      }

      if (scheme === "javascript" || scheme === "vbscript") {
        addFinding({
          severity: "error",
          code: "media.ref.unsafe-scheme",
          title: "Media/file reference uses unsafe URL scheme",
          description: `Reference uses unsupported scheme "${scheme}:" and should be removed.`,
          location,
          suggestion: "Use deployment-local path, uploads path, or a safe http(s) URL.",
        });
      }

      if (scheme === "file") {
        addFinding({
          severity: "warning",
          code: "media.ref.local-file-scheme",
          title: "Media/file reference points to machine-local file:// path",
          description:
            "file:// references do not work consistently across deployments and browsers.",
          location,
          suggestion: "Move the asset to deployment files (public/) or use a hosted URL.",
        });
      }

      if (ref.source === "blob-uri") {
        addFinding({
          severity: "warning",
          code: "media.ref.blob-uri",
          title: "Media/file reference uses temporary blob URL",
          description:
            "blob: URLs are session-local and typically break after reload/export/import.",
          location,
          suggestion: "Persist asset under deployment path (e.g. photos/, videos/, files/) before saving.",
        });
      }

      if (ref.kind !== "file") {
        if (scheme && !["http", "https", "data", "blob"].includes(scheme)) {
          addFinding({
            severity: "error",
            code: "media.ref.unsupported-scheme",
            title: "Embedded media uses unsupported URL scheme",
            description: `Embedded ${ref.kind} uses unsupported scheme "${scheme}:".`,
            location,
            suggestion: "Use deployment-local path, uploads path, or a safe http(s) URL.",
          });
        }

        if (ref.source === "data-uri") {
          const expectedPrefix = ref.kind === "image" ? "data:image/" : "data:video/";
          if (!ref.normalized.toLowerCase().startsWith(expectedPrefix)) {
            addFinding({
              severity: "warning",
              code: "media.ref.data-uri-kind-mismatch",
              title: "Embedded media data URI type looks inconsistent",
              description: `Expected ${expectedPrefix} for ${ref.kind}, got "${ref.normalized.slice(0, 24)}...".`,
              location,
              suggestion: "Reinsert the media or switch to a deployment-local file path.",
            });
          }
        }

        if (isLikelyLocalMediaSource(ref.source)) {
          if (looksLikeFilesystemPath(ref.normalized)) {
            addFinding({
              severity: "error",
              code: "media.ref.filesystem-path",
              title: "Embedded media path looks machine-specific",
              description:
                "Path appears to point to a local filesystem location and will break on other deployments.",
              location,
              suggestion: "Use relative deployment path under public/ (e.g. photos/name.png).",
            });
          }

          if (normalizedPath.endsWith("/")) {
            addFinding({
              severity: "error",
              code: "media.ref.missing-filename",
              title: "Embedded media path is missing filename",
              description: `Path "${ref.normalized}" ends with slash and does not identify a concrete asset file.`,
              location,
              suggestion: "Point src to a specific file, for example photos/example.png.",
            });
          }

          if (ref.normalized.startsWith("public/")) {
            addFinding({
              severity: "warning",
              code: "media.ref.public-prefix",
              title: "Embedded media path includes redundant public/ prefix",
              description:
                "Runtime paths should be relative to public root (e.g. photos/x.png), not public/photos/x.png.",
              location,
              suggestion: "Remove leading public/ from saved media path.",
            });
          }

          if (ref.normalized.includes("\\")) {
            addFinding({
              severity: "warning",
              code: "media.ref.backslash-path",
              title: "Embedded media path uses backslashes",
              description:
                "Backslash path separators are fragile in browser URLs and can break between environments.",
              location,
              suggestion: "Use forward slashes in media paths, e.g. photos/folder/image.png.",
            });
          }

          if (ref.normalized.includes("../")) {
            addFinding({
              severity: "warning",
              code: "media.ref.parent-segment",
              title: "Embedded media path contains parent directory traversal",
              description:
                "Paths with ../ are brittle and can resolve differently across deployment roots.",
              location,
              suggestion: "Use stable root-relative deployment paths (photos/, videos/, files/, uploads/).",
            });
          }

          if (
            ref.kind === "image" &&
            (ref.normalized === `${DEFAULT_MEDIA_FOLDERS.image}/` ||
              normalizedPath === DEFAULT_MEDIA_FOLDERS.image)
          ) {
            addFinding({
              severity: "warning",
              code: "media.image.folder-only",
              title: "Image reference points to folder only",
              description: "Image src points to photos/ without a concrete file.",
              location,
              suggestion: "Select an actual image file path, e.g. photos/example.png.",
            });
          }

          if (
            ref.kind === "video" &&
            (ref.normalized === `${DEFAULT_MEDIA_FOLDERS.video}/` ||
              normalizedPath === DEFAULT_MEDIA_FOLDERS.video)
          ) {
            addFinding({
              severity: "warning",
              code: "media.video.folder-only",
              title: "Video reference points to folder only",
              description: "Video src points to videos/ without a concrete file.",
              location,
              suggestion: "Select an actual video file path, e.g. videos/example.mp4.",
            });
          }

          const extension = extractFileExtension(ref.normalized);
          if (!extension && !normalizedPath.endsWith("/")) {
            addFinding({
              severity: "warning",
              code: "media.ref.missing-extension",
              title: "Embedded media path has no file extension",
              description:
                "Missing extension makes media resolution harder to validate and often indicates malformed path.",
              location,
              suggestion: "Use explicit file name with extension, e.g. .png or .mp4.",
            });
          }

          if (extension) {
            const allowed = ref.kind === "image" ? IMAGE_EXTENSIONS : VIDEO_EXTENSIONS;
            if (!allowed.has(extension)) {
              addFinding({
                severity: "warning",
                code: "media.ref.unexpected-extension",
                title: "Embedded media file extension looks unusual",
                description: `${ref.kind} reference uses extension ".${extension}", which is uncommon for this media type.`,
                location,
                suggestion: "Verify that src points to the intended file and media type.",
              });
            }
          }
        }
      }
    }
  }

  for (const page of pages) {
    for (const section of page.sections ?? []) {
      checkTipTapInternalLinks(
        section.jsonContent,
        `Article \"${page.title}\" / section \"${section.title}\"`
      );
      checkTipTapMediaReferences(
        section.jsonContent,
        `Article \"${page.title}\" / section \"${section.title}\"`
      );
    }

    if (page.matrixLinkId && !matrixById.has(page.matrixLinkId)) {
      addFinding({
        severity: "warning",
        code: "article.matrix-link.missing",
        title: "Article main matrix link is missing",
        description: `Article references matrix id \"${page.matrixLinkId}\" that no longer exists.`,
        location: `Article \"${page.title}\"`,
        suggestion: "Update article matrix relation in article editor.",
      });
    }

    for (const matrixId of page.globalMatrixLinkIds ?? []) {
      if (matrixById.has(matrixId)) continue;
      addFinding({
        severity: "warning",
        code: "article.global-matrix-link.missing",
        title: "Article global matrix relation is missing",
        description: `Article references matrix id \"${matrixId}\" that no longer exists.`,
        location: `Article \"${page.title}\"`,
        suggestion: "Review global matrix links in article editor.",
      });
    }
  }

  for (const template of templates) {
    checkTipTapInternalLinks(template.body, `Template \"${template.title}\" / body`);
    checkTipTapInternalLinks(template.example, `Template \"${template.title}\" / example`);
    checkTipTapMediaReferences(template.body, `Template \"${template.title}\" / body`);
    checkTipTapMediaReferences(template.example, `Template \"${template.title}\" / example`);
  }

  for (const komunikat of communications) {
    checkTipTapInternalLinks(komunikat.body, `Komunikat \"${komunikat.title}\"`);
    checkTipTapMediaReferences(komunikat.body, `Komunikat \"${komunikat.title}\"`);
  }

  for (const entry of orgEntries) {
    checkTipTapInternalLinks(entry.body, `Temat organizacyjny \"${entry.title}\"`);
    checkTipTapMediaReferences(entry.body, `Temat organizacyjny \"${entry.title}\"`);
  }

  for (const announcement of announcements) {
    checkTipTapInternalLinks(announcement.body, `Ogłoszenie \"${announcement.title}\"`);
    checkTipTapMediaReferences(announcement.body, `Ogłoszenie \"${announcement.title}\"`);
  }

  for (const spotlight of homeSpotlights) {
    if (pageById.has(spotlight.pageId)) continue;
    addFinding({
      severity: "error",
      code: "home.spotlight.missing-page",
      title: "Homepage spotlight points to missing article",
      description: `Spotlight references article id \"${spotlight.pageId}\" that no longer exists.`,
      location: "Homepage / spotlights",
      suggestion: "Replace or remove this spotlight entry.",
    });
  }

  for (const matrixEntry of matrix) {
    for (const templateId of matrixEntry.linkedTemplateIds ?? []) {
      if (templateById.has(templateId)) continue;
      addFinding({
        severity: "warning",
        code: "matrix.template.missing",
        title: "Matrix entry points to missing template",
        description: `Matrix entry \"${matrixEntry.subcategory}\" references template id \"${templateId}\" that no longer exists.`,
        location: `Matrix \"${matrixEntry.category} / ${matrixEntry.subcategory}\"`,
        suggestion: "Open matrix editor and update linked templates.",
      });
    }
  }

  const subcategoriesByParentId = new Map<string, Set<string>>();
  for (const category of categories) {
    if (!category.parentId) continue;
    if (!subcategoriesByParentId.has(category.parentId)) {
      subcategoriesByParentId.set(category.parentId, new Set());
    }
    subcategoriesByParentId.get(category.parentId)?.add(category.id);
  }

  const pageIdsByCategoryId = new Map<string, Set<string>>();
  for (const page of pages) {
    if (!pageIdsByCategoryId.has(page.categoryId)) {
      pageIdsByCategoryId.set(page.categoryId, new Set());
    }
    pageIdsByCategoryId.get(page.categoryId)?.add(page.id);
  }

  for (const category of categories) {
    const childOrder = category.childOrder ?? [];
    if (childOrder.length === 0) continue;

    const allowedIds = new Set<string>([
      ...(subcategoriesByParentId.get(category.id) ?? new Set<string>()),
      ...(pageIdsByCategoryId.get(category.id) ?? new Set<string>()),
    ]);

    const seen = new Set<string>();
    for (const childId of childOrder) {
      if (seen.has(childId)) {
        addFinding({
          severity: "warning",
          code: "category.child-order.duplicate",
          title: "Category child order contains duplicate id",
          description: `Duplicate id \"${childId}\" appears more than once in childOrder.`,
          location: `Category \"${category.name}\"`,
          suggestion: "Reorder category children and keep each item only once.",
        });
        continue;
      }
      seen.add(childId);

      if (!allowedIds.has(childId)) {
        addFinding({
          severity: "warning",
          code: "category.child-order.orphan",
          title: "Category child order references missing child",
          description: `childOrder contains id \"${childId}\" that is not a direct child article/subcategory anymore.`,
          location: `Category \"${category.name}\"`,
          suggestion: "Open ordering panel and rebuild this category child order.",
        });
      }
    }
  }

  const matrixCategoryOrder =
    data.configuration?.rules?.matrixCategoryOrder ?? data.matrixCategoryOrder ?? [];
  const currentMatrixCategories = new Set(matrix.map((entry) => entry.category));

  for (const categoryName of matrixCategoryOrder) {
    if (currentMatrixCategories.has(categoryName)) continue;
    addFinding({
      severity: "warning",
      code: "config.matrix-category-order.orphan",
      title: "Matrix category order contains missing category",
      description: `Configuration keeps matrix category \"${categoryName}\" that does not exist in current matrix entries.`,
      location: "Configuration / matrix category order",
      suggestion: "Review ordering config and remove obsolete matrix categories.",
    });
  }

  const navOrder = data.configuration?.navigation?.mainNavOrder ?? data.navOrder ?? [];
  const navKeyToModule = new Map<string, NavConfigModuleKey>(
    MODULE_DEFINITIONS.filter((def) => Boolean(def.navKey)).map((def) => [
      def.navKey as string,
      def.key as NavConfigModuleKey,
    ])
  );

  const seenNavKeys = new Set<string>();
  for (const navKey of navOrder) {
    if (seenNavKeys.has(navKey)) {
      addFinding({
        severity: "warning",
        code: "config.nav-order.duplicate",
        title: "Navigation order contains duplicate key",
        description: `Navigation key \"${navKey}\" appears more than once in configured order.`,
        location: "Configuration / main navigation order",
        suggestion: "Remove duplicate navigation keys from the saved order.",
      });
      continue;
    }
    seenNavKeys.add(navKey);

    if (navKey !== "home" && !MAIN_NAV_MODULE_KEYS.includes(navKey)) {
      addFinding({
        severity: "warning",
        code: "config.nav-order.unknown-key",
        title: "Navigation order contains unknown key",
        description: `Navigation key \"${navKey}\" is not recognized by current module definitions.`,
        location: "Configuration / main navigation order",
        suggestion: "Remove unknown keys in navigation configuration.",
      });
      continue;
    }

    const moduleKey = navKeyToModule.get(navKey);
    if (!moduleKey) continue;

    if (!enabledModules[moduleKey]) {
      addFinding({
        severity: "info",
        code: "config.nav-order.disabled-module",
        title: "Navigation order includes disabled module",
        description: `Navigation still includes \"${navKey}\", but module \"${moduleKey}\" is disabled and hidden in runtime.`,
        location: "Configuration / main navigation order",
      });
      continue;
    }

    if (moduleSettings[moduleKey].navigation.visible === false) {
      addFinding({
        severity: "info",
        code: "config.nav-order.hidden-module",
        title: "Navigation order includes nav-hidden module",
        description: `Navigation includes \"${navKey}\", but module settings hide this item from sidebar.`,
        location: "Configuration / module navigation settings",
      });
    }
  }

  const rawSettings =
    data.configuration?.modules?.settings && typeof data.configuration.modules.settings === "object"
      ? (data.configuration.modules.settings as Record<string, unknown>)
      : {};

  const knownModuleKeys = new Set(MODULE_DEFINITIONS.map((def) => def.key));

  for (const key of Object.keys(rawSettings)) {
    if (knownModuleKeys.has(key as AppModuleKey)) continue;
    addFinding({
      severity: "warning",
      code: "config.module-settings.unknown-module",
      title: "Module settings contain unknown module key",
      description: `Configuration contains module settings for unknown key \"${key}\".`,
      location: "Configuration / modules.settings",
      suggestion: "Remove stale module settings keys from imported configuration.",
    });
  }

  for (const def of MODULE_DEFINITIONS) {
    const entry = rawSettings[def.key];
    if (!entry || typeof entry !== "object") continue;

    const allowedRootKeys =
      def.supports.customSettings === "homeSections"
        ? new Set(["homepage"])
        : def.supports.customSettings === "lead"
        ? new Set(["widget"])
        : def.supports.customSettings === "announcements"
        ? new Set(["surfaces"])
        : new Set(["navigation", "homepageCard"]);

    for (const key of Object.keys(entry as Record<string, unknown>)) {
      if (allowedRootKeys.has(key)) continue;
      addFinding({
        severity: "warning",
        code: "config.module-settings.orphan-key",
        title: "Module settings contain unsupported key",
        description: `Module \"${def.key}\" has unsupported settings key \"${key}\" that is ignored by runtime.`,
        location: `Configuration / modules.settings.${def.key}`,
        suggestion: "Keep only settings keys supported by this module type.",
      });
    }
  }

  const rawEnabled =
    data.configuration?.modules?.enabled && typeof data.configuration.modules.enabled === "object"
      ? (data.configuration.modules.enabled as Record<string, unknown>)
      : {};

  for (const key of Object.keys(rawEnabled)) {
    if (knownModuleKeys.has(key as AppModuleKey)) continue;
    addFinding({
      severity: "warning",
      code: "config.module-enabled.unknown-module",
      title: "Enabled-modules map contains unknown module key",
      description: `Configuration contains enabled flag for unknown module key \"${key}\".`,
      location: "Configuration / modules.enabled",
      suggestion: "Remove stale module toggle keys from imported configuration.",
    });
  }

  if (!enabledModules.homeSections && (homeSpotlights.length > 0 || homeQuickLinks.length > 0)) {
    addFinding({
      severity: "info",
      code: "module.home-sections.disabled-with-content",
      title: "Homepage curated content exists while module is disabled",
      description:
        "Spotlights/quick links are configured, but homeSections module is disabled so these sections stay hidden.",
      location: "Modules / homeSections",
    });
  }

  if (!enabledModules.announcements && announcements.some((a) => a.active)) {
    addFinding({
      severity: "warning",
      code: "module.announcements.disabled-with-active-items",
      title: "Active announcements exist while module is disabled",
      description:
        "There are active announcements, but announcements module is disabled so users will not see them.",
      location: "Modules / announcements",
      suggestion: "Either re-enable module or deactivate stale announcements.",
    });
  }

  if (
    !enabledModules.lead &&
    (data.leadConfig?.questions?.some((question) => question.enabled) ?? false)
  ) {
    addFinding({
      severity: "info",
      code: "module.lead.disabled-with-config",
      title: "Lead module is disabled but lead rules/questions are configured",
      description:
        "Lead widget configuration is present, but module toggle keeps it unavailable in runtime.",
      location: "Modules / lead",
    });
  }

  function checkInternalAppLink(url: string, location: string) {
    const path = normalizePath(url);
    if (!path.startsWith("/")) {
      addFinding({
        severity: "warning",
        code: "internal-link.invalid-path",
        title: "Internal link does not use app path format",
        description: `Configured internal URL \"${url}\" is not an absolute app path.`,
        location,
        suggestion: "Use app routes starting with '/' for internal links.",
      });
      return;
    }

    const isKnownRoute = Object.values(ROUTES).some((route) => matchesRoutePrefix(path, route));
    if (!isKnownRoute) {
      addFinding({
        severity: "warning",
        code: "internal-link.unknown-route",
        title: "Internal link points to unknown route",
        description: `Configured internal URL \"${url}\" does not match known app routes.`,
        location,
        suggestion: "Verify route path or switch this item to external link.",
      });
      return;
    }

    const targetModule = resolveTargetModuleForInternalPath(path);
    if (targetModule && !enabledModules[targetModule]) {
      addFinding({
        severity: "warning",
        code: "internal-link.disabled-module-target",
        title: "Internal link points to disabled module",
        description: `Configured internal URL \"${url}\" targets module \"${targetModule}\" that is currently disabled.`,
        location,
        suggestion: "Enable target module or change/remove the link.",
      });
    }
  }

  for (const link of links) {
    if (!link.isInternal) continue;
    checkInternalAppLink(link.url, `Linki / \"${link.title}\"`);
  }

  for (const quickLink of homeQuickLinks) {
    if (!quickLink.isInternal) continue;
    checkInternalAppLink(quickLink.url, `Home quick links / \"${quickLink.label}\"`);
  }

  const sortedFindings = sortFindings(findings);

  const summary: IntegritySummary = {
    errors: sortedFindings.filter((f) => f.severity === "error").length,
    warnings: sortedFindings.filter((f) => f.severity === "warning").length,
    info: sortedFindings.filter((f) => f.severity === "info").length,
    total: sortedFindings.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    findings: sortedFindings,
    summary,
  };
}
