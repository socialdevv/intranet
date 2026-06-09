import { useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import {
  DEFAULT_PROJECT_SLUG,
  projectPath,
  resolveProjectPathMatch,
  ROUTES,
  toProjectScopedHref,
} from "@/lib/routes";

export function useProjectRouting() {
  const { pathname } = useLocation();

  const projectRoute = useMemo(() => resolveProjectPathMatch(pathname), [pathname]);
  const activeProjectSlug = projectRoute?.projectSlug ?? DEFAULT_PROJECT_SLUG;

  const resolveHref = useCallback(
    (href: string) => (projectRoute ? toProjectScopedHref(projectRoute.projectSlug, href) : href),
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