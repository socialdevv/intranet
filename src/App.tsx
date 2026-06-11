import { useEffect, useRef } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { useToast } from "@/contexts/toast-context";
import {
  DEFAULT_PROJECT_SLUG,
  PROJECT_ROUTE_PREFIX,
  ROUTES,
  globalAdminAnnouncementsPath,
  globalAdminAuditPath,
  globalAdminLinksPath,
  globalAdminProjectCreatePath,
  toProjectScopedHref,
} from "@/lib/routes";
import { buildGlobalAppTitle, resolveAppBrowserTitle } from "@/lib/config/branding";
import { resolveProjectPathMatch } from "@/lib/routes";
import type { AppModuleKey, AppUser } from "@/lib/types/domain";
import {
  canAccessAdminPanel,
  canEditContent,
  canEditRules,
} from "@/lib/auth/authorization";
import { findProjectDirectoryEntry } from "@/lib/access/project-access";
import GlobalAdminHomePage from "@/pages/GlobalAdminHomePage";
import GlobalAnnouncementsAdminPage from "@/pages/GlobalAnnouncementsAdminPage";
import GlobalAuditHistoryPage from "@/pages/GlobalAuditHistoryPage";
import GlobalHomePage from "@/pages/GlobalHomePage";
import GlobalLinksAdminPage from "@/pages/GlobalLinksAdminPage";
import GlobalProjectCreatePage from "@/pages/GlobalProjectCreatePage";
import HomePage from "@/pages/HomePage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import KnowledgeCategoryPage from "@/pages/KnowledgeCategoryPage";
import KnowledgeArticlePage from "@/pages/KnowledgeArticlePage";
import ArticleEditorPage from "@/pages/ArticleEditorPage";
import MatrixEditorPage from "@/pages/MatrixEditorPage";
import TemplateEditorPage from "@/pages/TemplateEditorPage";
import KomunikatyEditorPage from "@/pages/KomunikatyEditorPage";
import TematyOrganizacyjnePage from "@/pages/TematyOrganizacyjnePage";
import TematyOrganizacyjneEditorPage from "@/pages/TematyOrganizacyjneEditorPage";
import CennikiEditorPage from "@/pages/CennikiEditorPage";
import LinkEditorPage from "@/pages/LinkEditorPage";
import MatrixPage from "@/pages/MatrixPage";
import TemplatesPage from "@/pages/TemplatesPage";
import KomunikatyPage from "@/pages/KomunikatyPage";
import CennikiPage from "@/pages/CennikiPage";
import LinksPage from "@/pages/LinksPage";
import FormsPage from "@/pages/FormsPage";
import ContactsPage from "@/pages/ContactsPage";
import ZwrotyPage from "@/pages/ZwrotyPage";
import ProjectsDirectoryPage from "@/pages/ProjectsDirectoryPage";
import AdminPage from "@/pages/AdminPage";
import NotFoundPage from "@/pages/NotFoundPage";

function RequirePermission({
  children,
  allowed,
  redirectAuthenticatedTo = ROUTES.home,
}: {
  children: React.ReactNode;
  allowed: (roleUser: AppUser) => boolean;
  redirectAuthenticatedTo?: string;
}) {
  const { user, isResolvingUser } = useAuth();
  const { resolveHref } = useProjectRouting();

  if (isResolvingUser) return null;
  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!allowed(user)) return <Navigate to={resolveHref(redirectAuthenticatedTo)} replace />;
  return <>{children}</>;
}

function RequireEnabledModule({
  module,
  children,
}: {
  module: AppModuleKey;
  children: React.ReactNode;
}) {
  const { enabledModules } = useData();
  const { resolveHref } = useProjectRouting();

  if (!enabledModules[module]) return <Navigate to={resolveHref(ROUTES.home)} replace />;
  return <>{children}</>;
}

function LegacyProjectRouteRedirect() {
  const location = useLocation();
  return (
    <Navigate
      to={toProjectScopedHref(DEFAULT_PROJECT_SLUG, `${location.pathname}${location.search}${location.hash}`)}
      replace
    />
  );
}

function RequireProjectAccess({ children }: { children: React.ReactNode }) {
  const { platformBootstrapState, projectBootstrapState } = useData();
  const { projectRoute } = useProjectRouting();

  if (!projectRoute) {
    return <Navigate to={ROUTES.projects} replace />;
  }

  if (projectBootstrapState.status === "disabled") {
    return <>{children}</>;
  }

  if (
    projectBootstrapState.status === "ready" &&
    projectBootstrapState.routeContext.projectSlug === projectRoute.projectSlug
  ) {
    if (
      projectBootstrapState.preview.access.isLocked ||
      !projectBootstrapState.preview.capabilities.project.canEnterProject
    ) {
      return <Navigate to={ROUTES.projects} replace />;
    }

    return <>{children}</>;
  }

  if (projectBootstrapState.status === "failed") {
    return <Navigate to={ROUTES.projects} replace />;
  }

  if (platformBootstrapState.status === "ready") {
    const matchedProject = findProjectDirectoryEntry(
      platformBootstrapState.preview,
      projectRoute.projectSlug
    );

    if (!matchedProject || !matchedProject.canEnterProject) {
      return <Navigate to={ROUTES.projects} replace />;
    }
    return <>{children}</>;
  }

  return null;
}

function GlobalAdminEntryOrLegacyRedirect() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const legacyProjectAdminRequest =
    searchParams.has("panel") || searchParams.has("tab") || searchParams.has("area");

  if (legacyProjectAdminRequest) {
    return <LegacyProjectRouteRedirect />;
  }

  return <GlobalAdminHomePage />;
}

export default function App() {
  const { user, bootstrapExternalIdentity } = useAuth();
  const { data, isLoading, platformBootstrapState, projectBootstrapState, systemSettings } = useData();
  const { push: toast } = useToast();
  const externalIdentityAttemptRef = useRef<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith(`${PROJECT_ROUTE_PREFIX}/`)) {
      const matchedProjectRoute = resolveProjectPathMatch(location.pathname);
      const shellProjectDisplayName =
        projectBootstrapState.status === "ready" &&
        matchedProjectRoute &&
        projectBootstrapState.routeContext.projectSlug === matchedProjectRoute.projectSlug
          ? projectBootstrapState.preview.project.name
          : null;

      const projectTitle = resolveAppBrowserTitle({
        projectBootstrapState,
        platformBootstrapState,
        shellProjectDisplayName,
        systemSettings,
        fallbackAppName: data.meta?.appName,
        activeProjectSlug: matchedProjectRoute?.projectSlug,
        navigationMode: "project",
        isProjectRoute: true,
      });
      document.title = projectTitle ?? buildGlobalAppTitle();
      return;
    }

    const globalTitle = resolveAppBrowserTitle({
      projectBootstrapState,
      platformBootstrapState,
      systemSettings,
      navigationMode: "global",
      isProjectRoute: false,
    });
    document.title = globalTitle ?? buildGlobalAppTitle();
  }, [data.meta?.appName, location.pathname, platformBootstrapState, projectBootstrapState, systemSettings]);

  useEffect(() => {
    if (isLoading || user) return;

    const authSettings = systemSettings.auth;
    const source = authSettings?.identitySource ?? "pin";
    if (source === "pin") return;

    const key = `${source}|${authSettings?.externalIdentityHeader ?? ""}|${authSettings?.whoamiEndpoint ?? ""}`;
    if (externalIdentityAttemptRef.current === key) return;
    externalIdentityAttemptRef.current = key;

    void (async () => {
      const result = await bootstrapExternalIdentity({
        source,
        externalIdentityHeader: authSettings?.externalIdentityHeader,
        whoamiEndpoint: authSettings?.whoamiEndpoint,
      });

      if (!result || result.ok) return;

      if (result.outcome === "not-configured") {
        toast(
          "info",
          "Tożsamość zewnętrzna nie jest skonfigurowana. Aplikacja przełączy się na jawną lokalną tożsamość zastępczą.",
          5200
        );
        return;
      }

      toast(
        "error",
        `${result.error} Aplikacja przełączy się na jawną lokalną tożsamość zastępczą.`,
        6200
      );
    })();
  }, [bootstrapExternalIdentity, isLoading, systemSettings.auth, toast, user]);

  return (
    <Routes>
      <Route path={ROUTES.login} element={<Navigate to={ROUTES.home} replace />} />

      <Route path={ROUTES.home} element={<GlobalHomePage />} />
      <Route path={ROUTES.projects} element={<ProjectsDirectoryPage />} />
      <Route
        path={ROUTES.admin}
        element={
          <RequirePermission allowed={canAccessAdminPanel}>
            <GlobalAdminEntryOrLegacyRedirect />
          </RequirePermission>
        }
      />
      <Route
        path={globalAdminProjectCreatePath()}
        element={
          <RequirePermission allowed={canAccessAdminPanel}>
            <GlobalProjectCreatePage />
          </RequirePermission>
        }
      />
      <Route
        path={globalAdminAnnouncementsPath()}
        element={
          <RequirePermission allowed={canAccessAdminPanel}>
            <GlobalAnnouncementsAdminPage />
          </RequirePermission>
        }
      />
      <Route
        path={globalAdminLinksPath()}
        element={
          <RequirePermission allowed={canAccessAdminPanel}>
            <GlobalLinksAdminPage />
          </RequirePermission>
        }
      />
      <Route
        path={globalAdminAuditPath()}
        element={
          <RequirePermission allowed={canAccessAdminPanel}>
            <GlobalAuditHistoryPage />
          </RequirePermission>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug`}
        element={
          <RequireProjectAccess>
            <HomePage />
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.knowledgeBase}`}
        element={
          <RequireProjectAccess>
            <KnowledgeBasePage />
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.knowledgeBase}/kategoria/:categorySlug`}
        element={
          <RequireProjectAccess>
            <KnowledgeCategoryPage />
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.knowledgeBase}/:categorySlug/:articleSlug`}
        element={
          <RequireProjectAccess>
            <KnowledgeArticlePage />
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.knowledgeBase}/*`}
        element={
          <RequireProjectAccess>
            <KnowledgeBasePage />
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.matrix}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="matrix">
              <MatrixPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.szablony}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="szablony">
              <TemplatesPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.cenniki}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="cenniki">
              <CennikiPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.komunikaty}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="komunikaty">
              <KomunikatyPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.tematOrg}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="tematOrg">
              <TematyOrganizacyjnePage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.linki}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="linki">
              <LinksPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.formularze}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="formularze">
              <FormsPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.kontakty}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="kontakty">
              <ContactsPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.zwroty}`}
        element={
          <RequireProjectAccess>
            <RequireEnabledModule module="zwroty">
              <ZwrotyPage />
            </RequireEnabledModule>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/artykuly/:articleId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <ArticleEditorPage />
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/macierz/:entryId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditRules} redirectAuthenticatedTo={ROUTES.matrix}>
              <RequireEnabledModule module="matrix">
                <MatrixEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/szablony/:templateId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <RequireEnabledModule module="szablony">
                <TemplateEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/komunikaty/:komunikatId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <RequireEnabledModule module="komunikaty">
                <KomunikatyEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/tematy-org/:topicId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <RequireEnabledModule module="tematOrg">
                <TematyOrganizacyjneEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/cenniki/:cennikId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <RequireEnabledModule module="cenniki">
                <CennikiEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/linki/:linkId`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canEditContent}>
              <RequireEnabledModule module="linki">
                <LinkEditorPage />
              </RequireEnabledModule>
            </RequirePermission>
          </RequireProjectAccess>
        }
      />
      <Route
        path={`${PROJECT_ROUTE_PREFIX}/:projectSlug${ROUTES.admin}/*`}
        element={
          <RequireProjectAccess>
            <RequirePermission allowed={canAccessAdminPanel}>
              <AdminPage />
            </RequirePermission>
          </RequireProjectAccess>
        }
      />

      <Route path={`${ROUTES.knowledgeBase}/*`} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.matrix} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.szablony} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.cenniki} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.komunikaty} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.tematOrg} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.linki} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.formularze} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.kontakty} element={<LegacyProjectRouteRedirect />} />
      <Route path={ROUTES.zwroty} element={<LegacyProjectRouteRedirect />} />
      <Route path={`${ROUTES.admin}/*`} element={<LegacyProjectRouteRedirect />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
