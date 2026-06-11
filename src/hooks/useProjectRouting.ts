import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_PROJECT_SLUG,
  globalAdminAnnouncementsPath,
  globalAdminAuditPath,
  globalAdminLinksPath,
  globalAdminProjectCreatePath,
  projectPath,
  resolveProjectPathMatch,
  ROUTES,
  toProjectScopedHref,
} from "@/lib/routes";

function splitHrefSuffix(href: string): { pathname: string; suffix: string } {
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

function isGlobalOnlyHref(pathname: string): boolean {
  return (
    pathname === ROUTES.projects ||
    pathname === ROUTES.login ||
    pathname.startsWith(globalAdminProjectCreatePath()) ||
    pathname.startsWith(globalAdminAuditPath()) ||
    pathname.startsWith(globalAdminAnnouncementsPath()) ||
    pathname.startsWith(globalAdminLinksPath())
  );
}

export function useProjectRouting() {
  const { pathname } = useLocation();

  const projectRoute = useMemo(() => resolveProjectPathMatch(pathname), [pathname]);
  const activeProjectSlug = projectRoute?.projectSlug ?? DEFAULT_PROJECT_SLUG;

  const resolveHref = useCallback(
    (href: string) => {
      if (!href.startsWith("/") || !projectRoute) {
        return href;
      }

      const { pathname: targetPathname, suffix } = splitHrefSuffix(href);
      if (isGlobalOnlyHref(targetPathname)) {
        return href;
      }

      return `${toProjectScopedHref(projectRoute.projectSlug, targetPathname)}${suffix}`;
    },
    [projectRoute]
  );

  const buildProjectHref = useCallback(
    (localPath: string = ROUTES.home, projectSlug: string = activeProjectSlug) =>
      projectPath(projectSlug, localPath),
    [activeProjectSlug]
  );

  return {
    projectRoute,
    isProjectRoute: projectRoute !== null,
    activeProjectSlug,
    resolveHref,
    buildProjectHref,
  };
}