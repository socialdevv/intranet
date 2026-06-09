import { Database, FolderLock, FolderOpen, ShieldCheck, Server, Waypoints } from "lucide-react";
import { useProjectBootstrapPreview } from "@/hooks/useProjectBootstrapPreview";
import { ROUTES } from "@/lib/routes";

type ProjectBootstrapPreviewProps = {
  pathname: string;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pl-PL");
}

export default function ProjectBootstrapPreview({
  pathname,
}: ProjectBootstrapPreviewProps) {
  if (pathname === ROUTES.home) {
    return null;
  }

  const state = useProjectBootstrapPreview(pathname);

  if (state.status === "disabled") {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#d6e2ef] bg-[#f6fbff] px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:border-[#1f3a5c] dark:bg-[#0b1d33]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#58779f] dark:text-[#93c5fd]">
            API Project Bootstrap Preview
          </p>
          <p className="mt-1 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            Current route: {state.routeContext.routeLabel} {"->"} backend project {state.routeContext.projectSlug}
          </p>
          <p className="mt-1 text-xs text-[#5b6473] dark:text-[#cbd5e1]">
            This panel is temporary and development-only. The legacy JSON-backed project page still renders below unchanged.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full border border-[#bfd3ea] bg-white px-2.5 py-1 text-[11px] font-medium text-[#375a7f] dark:border-[#31537a] dark:bg-[#0b1b30] dark:text-[#bfdbfe]">
          <Server size={12} />
          source: api
        </span>
      </div>

      {state.status === "loading" && (
        <p className="mt-3 text-sm text-[#4b5563] dark:text-[#cbd5e1]">
          Loading project bootstrap from the backend…
        </p>
      )}

      {state.status === "failed" && (
        <div className="mt-3 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2.5 text-sm text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
          <p className="font-medium">API project bootstrap preview failed.</p>
          <p className="mt-1">{state.error}</p>
          <p className="mt-1 text-xs opacity-80">The existing legacy JSON-backed project runtime remains active.</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.45fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#dbe6f2] bg-white px-4 py-3 dark:border-[#214467] dark:bg-[#0f2239]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                    Project Metadata
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {state.preview.project.name}
                  </p>
                  <p className="text-xs text-[#64748b] dark:text-[#cbd5e1]">
                    {state.preview.project.slug} • {state.preview.project.code}
                  </p>
                  <p className="mt-2 text-xs text-[#475569] dark:text-[#cbd5e1]">
                    {state.preview.project.description ?? "Brak opisu projektu w backend bootstrap."}
                  </p>
                </div>

                <span
                  className={[
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    state.preview.access.isLocked
                      ? "border-[#f5c2c7] bg-[#fff1f2] text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]"
                      : "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] dark:border-[#14532d] dark:bg-[#0b1a10] dark:text-[#86efac]",
                  ].join(" ")}
                >
                  {state.preview.access.isLocked ? <FolderLock size={12} /> : <FolderOpen size={12} />}
                  {state.preview.access.isLocked ? "locked" : "unlocked"}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-[#475569] dark:text-[#cbd5e1] sm:grid-cols-2">
                <p>
                  <span className="font-medium">Visible:</span> {state.preview.access.isVisible ? "yes" : "no"}
                </p>
                <p>
                  <span className="font-medium">Effective role:</span> {state.preview.access.effectiveProjectRole ?? "none"}
                </p>
                <p>
                  <span className="font-medium">Route source:</span> {state.preview.routeContext.pathname}
                </p>
                <p>
                  <span className="font-medium">Dev user:</span> {state.preview.selectedDevUserEmail ?? "fallback backend user"}
                </p>
              </div>

              {state.preview.access.lockMessage && (
                <div className="mt-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2 text-xs text-[#92400e] dark:border-[#8a5a00] dark:bg-[#261b00] dark:text-[#fcd34d]">
                  {state.preview.access.lockMessage}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#dbe6f2] bg-white px-4 py-3 dark:border-[#214467] dark:bg-[#0f2239]">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                <Database size={12} />
                Uploads And Search
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {state.preview.uploadPolicies.map((policy) => (
                  <div
                    key={policy.mediaKind}
                    className="rounded-lg border border-[#e2e8f0] bg-[#f8fbfe] px-3 py-2 dark:border-[#1e3a5f] dark:bg-[#0d1c31]"
                  >
                    <p className="text-xs font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {policy.label}
                    </p>
                    <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1]">
                      {policy.maxMegabytes} MB • {policy.source}
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                      {policy.allowedMimePatterns.join(", ") || "No MIME patterns"}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 text-xs text-[#475569] dark:text-[#cbd5e1] sm:grid-cols-2">
                <p>
                  <span className="font-medium">Project search:</span> {state.preview.search.projectSearchEnabled ? "enabled" : "disabled"}
                </p>
                <p>
                  <span className="font-medium">Min query length:</span> {state.preview.search.minQueryLength}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[#dbe6f2] bg-white px-4 py-3 dark:border-[#214467] dark:bg-[#0f2239]">
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                <ShieldCheck size={12} />
                Backend-Derived Capabilities
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {state.preview.projectCapabilities.length > 0 ? (
                  state.preview.projectCapabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-full border border-[#dbeafe] bg-[#eff6ff] px-2.5 py-1 text-[11px] font-medium text-[#1d4f91] dark:border-[#1e3a5f] dark:bg-[#10233c] dark:text-[#93c5fd]"
                    >
                      {capability}
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
                    No active project capabilities for the current backend role.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                  <Waypoints size={12} />
                  Module Navigation
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {state.preview.navigation.map((entry) => (
                    <span
                      key={entry.key}
                      className="rounded-full border border-[#e2e8f0] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-medium text-[#334155] dark:border-[#1e3a5f] dark:bg-[#0d1c31] dark:text-[#cbd5e1]"
                    >
                      {entry.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#dbe6f2] bg-white px-4 py-3 dark:border-[#214467] dark:bg-[#0f2239]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                Module Availability
              </p>

              <div className="mt-3 grid gap-2">
                {state.preview.modules.map((moduleEntry) => (
                  <div
                    key={moduleEntry.key}
                    className="rounded-lg border border-[#e2e8f0] bg-[#f8fbfe] px-3 py-2 dark:border-[#1e3a5f] dark:bg-[#0d1c31]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                        {moduleEntry.label}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={[
                            "rounded-full border px-2 py-0.5 font-medium",
                            moduleEntry.enabled
                              ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] dark:border-[#14532d] dark:bg-[#0b1a10] dark:text-[#86efac]"
                              : "border-[#e5e7eb] bg-[#f8fafc] text-[#64748b] dark:border-[#334155] dark:bg-[#111827] dark:text-[#94a3b8]",
                          ].join(" ")}
                        >
                          {moduleEntry.enabled ? "enabled" : "disabled"}
                        </span>
                        <span className="rounded-full border border-[#e2e8f0] px-2 py-0.5 text-[#64748b] dark:border-[#334155] dark:text-[#94a3b8]">
                          nav {moduleEntry.navVisible ? `visible #${moduleEntry.navOrder ?? "-"}` : "hidden"}
                        </span>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-[#475569] dark:text-[#cbd5e1]">
                      {moduleEntry.capabilitySummary.length > 0
                        ? moduleEntry.capabilitySummary.join(" • ")
                        : "No active module capabilities"}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-[#7c8da6] dark:text-[#93c5fd]">
                Request: {state.preview.requestMeta.requestId} • {formatTimestamp(state.preview.requestMeta.timestamp)}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}