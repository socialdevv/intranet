import { Server, Database, FolderLock, FolderOpen } from "lucide-react";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";

export default function PlatformBootstrapPreview() {
  const state = usePlatformBootstrapPreview();

  return (
    <section className="mb-6 rounded-2xl border border-[#c7d7ea] bg-[#eef5fb] px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:border-[#1e3a5f] dark:bg-[#0f2340]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5b7aa0] dark:text-[#93c5fd]">
            API Platform Bootstrap Preview
          </p>
          <p className="mt-1 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            The global homepage now reads its project directory from platform bootstrap. This panel remains temporary and development-only.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bfd3ea] bg-white px-2.5 py-1 text-[11px] font-medium text-[#375a7f] dark:border-[#31537a] dark:bg-[#0b1b30] dark:text-[#bfdbfe]">
          <Server size={12} />
          source: api
        </span>
      </div>

      {state.status === "loading" && (
        <p className="mt-3 text-sm text-[#4b5563] dark:text-[#cbd5e1]">
          Loading platform bootstrap from the mock API…
        </p>
      )}

      {state.status === "failed" && (
        <div className="mt-3 rounded-xl border border-[#f5c2c7] bg-[#fff1f2] px-3 py-2.5 text-sm text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
          <p className="font-medium">API bootstrap preview failed.</p>
          <p className="mt-1">{state.error}</p>
          <p className="mt-1 text-xs opacity-80">The homepage falls back to empty-state platform sections until the bootstrap request succeeds.</p>
        </div>
      )}

      {state.status === "ready" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
          <div className="space-y-3 rounded-xl border border-[#d7e4f2] bg-white px-4 py-3 dark:border-[#24466c] dark:bg-[#0b1b30]">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                Current Backend User
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                {state.preview.currentUser.displayName}
              </p>
              <p className="text-xs text-[#64748b] dark:text-[#cbd5e1]">
                {state.preview.currentUser.email} • {state.preview.currentUser.globalRole}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                Resolver
              </p>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1]">
                Header: <span className="font-medium">{state.preview.resolver.headerName}</span>
              </p>
              <p className="text-xs text-[#475569] dark:text-[#cbd5e1]">
                Selected: <span className="font-medium">{state.preview.resolver.selectedEmail ?? state.preview.resolver.fallbackEmail}</span>
              </p>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                Global Search
              </p>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#cbd5e1]">
                Enabled: <span className="font-medium">{state.preview.search.globalSearchEnabled ? "yes" : "no"}</span>
              </p>
              <p className="text-xs text-[#475569] dark:text-[#cbd5e1]">
                Min query length: <span className="font-medium">{state.preview.search.minQueryLength}</span>
              </p>
            </div>

            <div>
              <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
                <Database size={12} />
                Upload Defaults
              </p>
              <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-[#475569] dark:text-[#cbd5e1]">
                <div>
                  <p className="font-medium">Images</p>
                  <p>{state.preview.uploadLimitsMb.image} MB</p>
                </div>
                <div>
                  <p className="font-medium">Files</p>
                  <p>{state.preview.uploadLimitsMb.file} MB</p>
                </div>
                <div>
                  <p className="font-medium">Videos</p>
                  <p>{state.preview.uploadLimitsMb.video} MB</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#d7e4f2] bg-white px-4 py-3 dark:border-[#24466c] dark:bg-[#0b1b30]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7c8da6] dark:text-[#93c5fd]">
              Backend Project Directory
            </p>
            <div className="mt-3 grid gap-2">
              {state.preview.projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-[#e2e8f0] bg-[#f8fbfe] px-3 py-2.5 dark:border-[#1e3a5f] dark:bg-[#0f2340]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                        {project.name}
                      </p>
                      <p className="truncate text-xs text-[#64748b] dark:text-[#cbd5e1]">
                        {project.slug} • {project.description ?? "No description"}
                      </p>
                    </div>
                    <span
                      className={[
                        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        project.isLocked
                          ? "border-[#f5c2c7] bg-[#fff1f2] text-[#9f1239] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]"
                          : "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] dark:border-[#14532d] dark:bg-[#0b1a10] dark:text-[#86efac]",
                      ].join(" ")}
                    >
                      {project.isLocked ? <FolderLock size={12} /> : <FolderOpen size={12} />}
                      {project.isLocked ? "locked" : "unlocked"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#475569] dark:text-[#cbd5e1]">
                    <span>role: <span className="font-medium">{project.effectiveProjectRole ?? "none"}</span></span>
                    <span>enabled modules: <span className="font-medium">{project.enabledModuleCount}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-[#7c8da6] dark:text-[#93c5fd]">
              Request: {state.preview.requestMeta.requestId}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}