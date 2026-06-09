import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Bell, FolderCog, History, Link2, ShieldCheck, Sparkles } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { resolveProjectDirectory } from "@/lib/access/project-access";
import {
  globalAdminAnnouncementsPath,
  globalAdminAuditPath,
  globalAdminLinksPath,
  globalAdminProjectCreatePath,
  ROUTES,
} from "@/lib/routes";

export default function GlobalAdminHomePage() {
  const { user } = useAuth();
  const platformBootstrap = usePlatformBootstrapPreview();
  const { buildProjectHref } = useProjectRouting();

  if (!user || !canAccessAdminPanel(user)) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const directory = resolveProjectDirectory(
    platformBootstrap.status === "ready" ? platformBootstrap.preview : null
  );

  return (
    <AppShell currentUser={user} navigationMode="global" searchPlaceholder="Szukaj po administracji i projektach…">
      <section className="mx-auto w-full max-w-7xl pb-8">
        <div className="rounded-4xl border border-[#dbe5f0] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4fb_45%,#ffffff_100%)] px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.07)] dark:border-[#1e3a5f] dark:bg-[linear-gradient(135deg,#0f2340_0%,#102846_45%,#0f172a_100%)] sm:px-8 lg:px-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91] backdrop-blur dark:border-[#31537a] dark:bg-[#0b1b30]/80 dark:text-[#93c5fd]">
            <Sparkles size={12} />
            Administracja globalna
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0f172a] dark:text-[#f8fafc] sm:text-4xl">
            Główne wejście do administracji i moderacji
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] dark:text-[#cbd5e1]">
            Ten widok porządkuje funkcje globalne bez przebudowy istniejącego panelu projektowego. Administracja projektu pozostaje na poziomie `/p/:slug/administracja`, a warstwa globalna prowadzi do niej w kontrolowany sposób.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <ShieldCheck size={13} className="text-[#1d4f91] dark:text-[#93c5fd]" />
              Wejścia globalne
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <AdminEntryCard
                href={ROUTES.projects}
                title="Katalog projektów"
                description="Przegląd projektów i stanu dostępu wynikającego z bieżącego modelu uprawnień."
              />
              <AdminEntryCard
                href={globalAdminAnnouncementsPath()}
                title="Ogłoszenia globalne"
                description="Zarządzanie komunikatami platformowymi widocznymi na globalnej stronie głównej."
                icon={<Bell size={14} />}
              />
              <AdminEntryCard
                href={globalAdminLinksPath()}
                title="Linki globalne"
                description="Utrzymanie wspólnych skrótów platformowych niezależnych od pojedynczego projektu."
                icon={<Link2 size={14} />}
              />
              <AdminEntryCard
                href={globalAdminAuditPath()}
                title="Historia zmian — intranet globalny"
                description="Dziennik zmian warstwy globalnej (ogłoszenia i linki platformowe), z opcją filtrowania po projekcie. Tylko super_admin."
                icon={<History size={14} />}
              />
              <AdminEntryCard
                href={globalAdminProjectCreatePath()}
                title="Utwórz projekt"
                description="Szybkie utworzenie nowego projektu z backendowym bootstrapem konfiguracji."
                disabled={!directory.canCreateProjects}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <FolderCog size={13} className="text-[#15803d] dark:text-[#86efac]" />
              Administracja projektowa
            </div>
            <p className="mt-3 text-sm text-[#64748b] dark:text-[#cbd5e1]">
              Dostępne są tylko projekty, do których bieżący użytkownik może wejść. To zachowanie jest już zgodne z docelowym kierunkiem integracji z zewnętrznym API uprawnień.
            </p>

            {platformBootstrap.status === "loading" && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Ładowanie projektów administracyjnych…
              </p>
            )}

            {platformBootstrap.status === "failed" && (
              <p className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-4 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
                {platformBootstrap.error}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {directory.accessibleProjects.map((project) => (
                <Link
                  key={project.id}
                  to={buildProjectHref(ROUTES.admin, project.slug)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#dde5ee] bg-[#f8fbfe] px-4 py-3 text-sm transition hover:border-[#c3d6ea] hover:bg-white dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846]"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {project.name}
                    </p>
                    <p className="mt-1 truncate text-xs text-[#64748b] dark:text-[#cbd5e1]">
                      {project.code} • rola: {project.effectiveProjectRole ?? "brak"}
                    </p>
                  </div>
                  <ArrowRight size={15} className="shrink-0 text-[#94a3b8]" />
                </Link>
              ))}
            </div>

            {platformBootstrap.status === "ready" && directory.accessibleCount === 0 && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Brak projektów, do których ten użytkownik ma jednocześnie wejście i administracyjny kontekst projektu.
              </p>
            )}
          </section>
        </div>
      </section>
    </AppShell>
  );
}

function AdminEntryCard({
  href,
  title,
  description,
  disabled = false,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  if (disabled) {
    return (
      <div className="rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
        <p className="font-semibold text-[#0f172a] dark:text-[#f8fafc]">{title}</p>
        <p className="mt-2">{description}</p>
        <p className="mt-2 text-xs uppercase tracking-[0.12em] text-[#94a3b8]">Tylko Super Admin</p>
      </div>
    );
  }

  return (
    <Link
      to={href}
      className="rounded-2xl border border-[#dde5ee] bg-[#f8fbfe] px-4 py-4 transition hover:-translate-y-0.5 hover:border-[#c3d6ea] hover:bg-white hover:shadow-[0_12px_28px_rgba(15,23,42,0.06)] dark:border-[#1e3a5f] dark:bg-[#0b1b30] dark:hover:border-[#31537a] dark:hover:bg-[#102846] dark:hover:shadow-none"
    >
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
        {icon ? <span className="text-[#1d4f91] dark:text-[#93c5fd]">{icon}</span> : null}
        <span>{title}</span>
      </p>
      <p className="mt-2 text-sm text-[#64748b] dark:text-[#cbd5e1]">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#1d4f91] dark:text-[#93c5fd]">
        Otwórz
        <ArrowRight size={13} />
      </span>
    </Link>
  );
}