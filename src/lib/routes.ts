/** Public app routes — Polish URLs, compatible with HashRouter (#/...). */
export const ROUTES = {
  home: "/",
  projects: "/projekty",
  login: "/logowanie",
  admin: "/administracja",
  knowledgeBase: "/baza-wiedzy",
  matrix: "/macierz",
  szablony: "/szablony",
  cenniki: "/cenniki",
  komunikaty: "/komunikaty",
  tematOrg: "/tematy-organizacyjne",
  linki: "/linki",
  formularze: "/formularze",
  kontakty: "/kontakty",
  zwroty: "/zwroty",
} as const;

export const PROJECT_ROUTE_PREFIX = "/p";
export const DEFAULT_PROJECT_SLUG = "altcloud";

export type ProjectPathMatch = {
  projectSlug: string;
  localPath: string;
};

function splitHrefSuffix(href: string): {
  pathname: string;
  suffix: string;
} {
  const queryIndex = href.indexOf("?");
  const hashIndex = href.indexOf("#");
  const suffixIndex =
    queryIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? queryIndex
        : Math.min(queryIndex, hashIndex);

  if (suffixIndex === -1) {
    return { pathname: href, suffix: "" };
  }

  return {
    pathname: href.slice(0, suffixIndex),
    suffix: href.slice(suffixIndex),
  };
}

function ensureAbsolutePath(path: string): string {
  if (!path || path === ROUTES.home) {
    return ROUTES.home;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

export function projectPath(projectSlug: string, localPath: string = ROUTES.home): string {
  const normalizedSlug = encodeURIComponent(projectSlug.trim());
  const normalizedLocalPath = ensureAbsolutePath(localPath);

  if (normalizedLocalPath === ROUTES.home) {
    return `${PROJECT_ROUTE_PREFIX}/${normalizedSlug}`;
  }

  return `${PROJECT_ROUTE_PREFIX}/${normalizedSlug}${normalizedLocalPath}`;
}

export function globalAdminProjectCreatePath() {
  return `${ROUTES.admin}/projekty/nowy`;
}

export function globalAdminAuditPath() {
  return `${ROUTES.admin}/audit`;
}

export function globalAdminAnnouncementsPath() {
  return `${ROUTES.admin}/ogloszenia-globalne`;
}

export function globalAdminLinksPath() {
  return `${ROUTES.admin}/linki-globalne`;
}

export function resolveProjectPathMatch(pathname: string): ProjectPathMatch | null {
  const { pathname: plainPathname } = splitHrefSuffix(pathname);

  if (!plainPathname.startsWith(`${PROJECT_ROUTE_PREFIX}/`)) {
    return null;
  }

  const segments = plainPathname.split("/").filter(Boolean);
  if (segments[0] !== PROJECT_ROUTE_PREFIX.slice(1) || !segments[1]) {
    return null;
  }

  const localPath = segments.length > 2 ? `/${segments.slice(2).join("/")}` : ROUTES.home;

  return {
    projectSlug: decodeURIComponent(segments[1]),
    localPath,
  };
}

export function toProjectScopedHref(projectSlug: string, href: string): string {
  if (!href.startsWith("/")) {
    return href;
  }

  const { pathname, suffix } = splitHrefSuffix(href);
  if (resolveProjectPathMatch(pathname)) {
    return href;
  }

  return `${projectPath(projectSlug, pathname)}${suffix}`;
}

export function replaceProjectRouteSlug(href: string, nextProjectSlug: string): string {
  const { pathname, suffix } = splitHrefSuffix(href);
  const match = resolveProjectPathMatch(pathname);

  if (!match) {
    return href;
  }

  return `${projectPath(nextProjectSlug, match.localPath)}${suffix}`;
}

export function knowledgeArticlePath(categorySlug: string, articleSlug: string) {
  return `${ROUTES.knowledgeBase}/${categorySlug}/${articleSlug}`;
}

export function knowledgeCategoryPath(categorySlug: string) {
  return `${ROUTES.knowledgeBase}/kategoria/${categorySlug}`;
}

export function adminArticleEditorPath(articleId: string | "nowy") {
  return `${ROUTES.admin}/artykuly/${articleId}`;
}

export function adminMatrixEditorPath(entryId: string | "nowy") {
  return `${ROUTES.admin}/macierz/${entryId}`;
}

export function adminTemplateEditorPath(templateId: string | "nowy") {
  return `${ROUTES.admin}/szablony/${templateId}`;
}
export function adminKomunikatyEditorPath(komunikatId: string | "nowy") {
  return `${ROUTES.admin}/komunikaty/${komunikatId}`;
}
export function adminTematyOrgEditorPath(entryId: string | "nowy") {
  return `${ROUTES.admin}/tematy-org/${entryId}`;
}
export function adminCennikEditorPath(cennikId: string | "nowy") {
  return `${ROUTES.admin}/cenniki/${cennikId}`;
}
export function adminLinkEditorPath(linkId: string | "nowy") {
  return `${ROUTES.admin}/linki/${linkId}`;
}

/** Navigate to /komunikaty and pre-select a specific komunikat by id. */
export function komunikatPath(komunikatId: string) {
  return `${ROUTES.komunikaty}?id=${encodeURIComponent(komunikatId)}`;
}

/** Navigate to /tematy-organizacyjne and pre-select a specific entry by id. */
export function tematOrgPath(entryId: string) {
  return `${ROUTES.tematOrg}?id=${encodeURIComponent(entryId)}`;
}
