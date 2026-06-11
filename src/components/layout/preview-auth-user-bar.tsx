import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  getSelectedBootstrapPreviewDevUserEmail,
  setSelectedBootstrapPreviewDevUserEmail,
} from "@/lib/api/bootstrap-preview-runtime";
import { fetchPreviewAuthUsers, type PreviewAuthUserRecord } from "@/lib/api/preview-auth";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";

export default function PreviewAuthUserBar() {
  const platformBootstrap = usePlatformBootstrapPreview();
  const [users, setUsers] = useState<PreviewAuthUserRecord[]>([]);
  const [loadError, setLoadError] = useState("");

  const showBar =
    platformBootstrap.status === "ready" &&
    platformBootstrap.preview.authMode === "preview_header";

  const selectedEmail = getSelectedBootstrapPreviewDevUserEmail() ?? "";

  useEffect(() => {
    if (!showBar) {
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const nextUsers = await fetchPreviewAuthUsers(controller.signal);
        if (!controller.signal.aborted) {
          setUsers(nextUsers);
          setLoadError("");
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(
          error instanceof Error ? error.message : "Failed to load preview auth users."
        );
      }
    })();

    return () => {
      controller.abort();
    };
  }, [showBar]);

  if (!showBar) {
    return null;
  }

  const activeEmail =
    selectedEmail ||
    platformBootstrap.preview.currentUser.email ||
    users[0]?.email ||
    "";

  function handleUserChange(nextEmail: string) {
    setSelectedBootstrapPreviewDevUserEmail(nextEmail);
    window.location.reload();
  }

  return (
    <div className="border-b border-[#f59e0b]/40 bg-[#fffbeb] px-4 py-2 text-sm text-[#92400e] dark:border-[#b45309]/50 dark:bg-[#451a03] dark:text-[#fcd34d]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex items-center gap-2 font-medium">
          <ShieldAlert size={16} />
          Preview authentication is active. Switch test users before corporate IdP goes live.
        </div>

        <div className="flex flex-col gap-1 sm:items-end">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] opacity-80">
            Test user
          </label>
          <select
            value={activeEmail}
            onChange={(event) => handleUserChange(event.target.value)}
            className="min-w-[18rem] rounded-md border border-[#f59e0b]/50 bg-white px-3 py-1.5 text-sm text-[#78350f] shadow-sm dark:border-[#b45309]/60 dark:bg-[#1c1917] dark:text-[#fde68a]"
          >
            {users.map((user) => (
              <option key={user.email} value={user.email}>
                {user.displayName} ({user.email}) • {user.globalRole}
              </option>
            ))}
          </select>
          {loadError ? <p className="text-xs text-[#b45309]">{loadError}</p> : null}
        </div>
      </div>
    </div>
  );
}
