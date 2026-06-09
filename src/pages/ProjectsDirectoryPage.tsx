import { Link, Navigate } from "react-router-dom";
import { ArrowRight, FolderLock, FolderOpen } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { resolveProjectDirectory } from "@/lib/access/project-access";
import { ROUTES } from "@/lib/routes";

export default function ProjectsDirectoryPage() {
  const { user } = useAuth();
  const platformBootstrap = usePlatformBootstrapPreview();
  const { buildProjectHref } = useProjectRouting();

  if (
    platformBootstrap.status === "ready" &&
    !platformBootstrap.preview.platformCapabilities.canViewProjectDirectory
  ) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const directory = resolveProjectDirectory(
    platformBootstrap.status === "ready" ? platformBootstrap.preview : null
  );
  const canOpenProjectAdmin = user ? canAccessAdminPanel(user) : false;

  return (
    <AppShell currentUser={user} navigationMode="global" searchPlaceholder="Szukaj projektów i zasobów…">
      <section className="mx-auto w-full max-w-7xl pb-8">
        <div className="rounded-4xl border border-[#dbe5f0] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4fb_55%,#ffffff_100%)] px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.07)] dark:border-[#1e3a5f] dark:bg-[linear-gradient(135deg,#0f2340_0%,#102846_55%,#0f172a_100%)] sm:px-8 lg:px-10">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7fb0] dark:text-[#93c5fd]">
                Projekty
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#0f172a] dark:text-[#f8fafc] sm:text-4xl">
                Katalog wejść projektowych
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] dark:text-[#cbd5e1]">
                Ten widok oddziela katalog projektów od globalnej strony głównej i opiera wejście wyłącznie na aktualnym modelu dostępu z platform bootstrap.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryCard label="Dostępne" value={String(directory.accessibleCount)} accent="available" />
              <SummaryCard label="Ograniczone" value={String(directory.restrictedCount)} accent="restricted" />
              <SummaryCard
                label="Administracja projektowa"
                value={canOpenProjectAdmin ? "Tak" : "Nie"}
                accent="neutral"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <FolderOpen size={13} className="text-[#15803d] dark:text-[#86efac]" />
              Dostępne projekty
            </div>

            {platformBootstrap.status === "loading" && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Ładowanie katalogu projektów…
              </p>
            )}

            {platformBootstrap.status === "failed" && (
              <p className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-4 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
                {platformBootstrap.error}
              </p>
            )}

            {platformBootstrap.status === "ready" && directory.accessibleCount === 0 && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                W aktualnym payloadzie nie ma jeszcze projektów dostępnych dla tego użytkownika.
              </p>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {directory.accessibleProjects.map((project) => (
                <article
                  key={project.id}
                  className="rounded-2xl border border-[#dde5ee] bg-[#f8fbfe] p-4 dark:border-[#1e3a5f] dark:bg-[#0b1b30]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                        {project.name}
                      </h2>
                      <p className="mt-1 text-xs text-[#64748b] dark:text-[#cbd5e1]">
                        {project.code} • {project.slug}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-[11px] font-medium text-[#15803d] dark:border-[#14532d] dark:bg-[#0b1a10] dark:text-[#86efac]">
                      <FolderOpen size={11} />
                      dostęp
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[#64748b] dark:text-[#cbd5e1]">
                    {project.description ?? "Projekt dostępny w katalogu. Wejście prowadzi do projektowego pulpitu i modułów pod osobnym prefiksem trasy."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
                    <span>rola: {project.effectiveProjectRole ?? "brak"}</span>
                    <span>moduły: {project.enabledModuleCount}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to={buildProjectHref(undefined, project.slug)}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm font-medium text-[#1d4f91] transition hover:border-[#bfd3ea] hover:bg-[#f8fbff] dark:border-[#31537a] dark:bg-[#102846] dark:text-[#93c5fd]"
                    >
                      Otwórz projekt
                      <ArrowRight size={14} />
                    </Link>
                    {canOpenProjectAdmin && (
                      <Link
                        to={buildProjectHref(ROUTES.admin, project.slug)}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm font-medium text-[#44566f] transition hover:border-[#bfd3ea] hover:bg-[#f8fbff] dark:border-[#31537a] dark:bg-[#102846] dark:text-[#cbd5e1]"
                      >
                        Administracja projektu
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              <FolderLock size={13} className="text-[#9f1239] dark:text-[#fda4af]" />
              Projekty z ograniczonym dostępem
            </div>
            <p className="mt-3 text-sm text-[#64748b] dark:text-[#cbd5e1]">
              Sekcja pokazuje projekty widoczne w aktualnym bootstrapie, ale bez prawa wejścia. Gdy zewnętrzne API uprawnień przejmie ten obszar, ta lista może być filtrowana lub zastąpiona bez zmiany struktury widoku.
            </p>

            {platformBootstrap.status === "ready" && directory.restrictedCount === 0 ? (
              <p className="mt-4 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
                Brak projektów z ograniczonym dostępem w obecnym payloadzie.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {directory.restrictedProjects.map((project) => (
                  <article
                    key={project.id}
                    className="rounded-2xl border border-[#f5d0d4] bg-[#fff7f8] p-4 dark:border-[#5b2130] dark:bg-[#1a0f16]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                          {project.name}
                        </h2>
                        <p className="mt-1 text-xs text-[#7f1d1d] dark:text-[#fda4af]">
                          {project.code} • {project.slug}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#fecaca] bg-[#fff1f2] px-2.5 py-1 text-[11px] font-medium text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
                        <FolderLock size={11} />
                        brak wejścia
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#64748b] dark:text-[#cbd5e1]">
                      {project.description ?? "Projekt jest widoczny w katalogu, ale aktualny model dostępu nie pozwala na wejście."}
                    </p>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-4 text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]">
              Źródło dostępu pozostaje celowo odseparowane od UI. Dziś używa platform bootstrap, a docelowo może zostać podmienione na osobny payload uprawnień bez przebudowy katalogu.
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "available" | "restricted" | "neutral";
}) {
  const accentClass =
    accent === "available"
      ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] dark:border-[#14532d] dark:bg-[#0b1a10] dark:text-[#86efac]"
      : accent === "restricted"
        ? "border-[#fecaca] bg-[#fff1f2] text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]"
        : "border-[#dbe4f0] bg-white/85 text-[#44566f] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]";

  return (
    <div className={`rounded-2xl border p-4 ${accentClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{value}</p>
    </div>
  );
}