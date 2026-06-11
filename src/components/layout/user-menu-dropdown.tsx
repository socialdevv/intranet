import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";
import type { AppRole, AppUser } from "@/lib/types/domain";

export type UserMenuDisplayOverride = {
  displayName: string;
  initials: string;
  secondaryText: string;
};

type UserMenuDropdownProps = {
  currentUser: AppUser;
  displayOverride?: UserMenuDisplayOverride;
};

const roleLabel: Record<AppRole, string> = {
  admin: "Administrator",
  editor: "Edytor",
  agent: "Agent",
};

export default function UserMenuDropdown({ currentUser, displayOverride }: UserMenuDropdownProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { reloadData } = useData();
  const { push: toast } = useToast();
  const { resolveHref } = useProjectRouting();
  const [open, setOpen] = useState(false);
  const [isRefreshingAccess, setIsRefreshingAccess] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  const usesBootstrapIdentity =
    currentUser.identitySource === "platform-bootstrap" ||
    currentUser.identitySource === "local-fallback";

  async function onRefreshAccess() {
    if (isRefreshingAccess) {
      return;
    }

    setIsRefreshingAccess(true);
    setOpen(false);

    try {
      const result = await reloadData();
      if (result.ok) {
        toast("success", "Odświeżono uprawnienia i dane sesji.", 3600);
        return;
      }

      toast("error", result.error ?? "Nie udało się odświeżyć dostępu.", 5200);
    } finally {
      setIsRefreshingAccess(false);
    }
  }

  function onLogout() {
    logout();
    setOpen(false);
    navigate(resolveHref(ROUTES.home));
  }

  const canOpenAdmin = canAccessAdminPanel(currentUser);

  const identityActionLabel = usesBootstrapIdentity ? "Odśwież dostęp" : "Wyloguj";

  const displayName = displayOverride?.displayName ?? currentUser.displayName;
  const initials = displayOverride?.initials ?? currentUser.initials;
  const secondaryText = displayOverride?.secondaryText ?? roleLabel[currentUser.role] ?? currentUser.role;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ui-btn ui-btn-ghost inline-flex h-9 max-w-[min(100%,13rem)] justify-start gap-2 px-1.5 text-sm text-[#334155] dark:text-[#cbd5e1] ${
          open ? "bg-[#eef3f8] dark:bg-[#1e293b]" : "hover:bg-[#f4f7fb] dark:hover:bg-[#1e293b]"
        }`}
      >
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full border border-[#dce5ef] bg-[#f1f5f9] text-[11px] font-semibold text-[#475569] dark:border-[#334155] dark:bg-[#263347] dark:text-[#94a3b8]"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate pr-0.5 text-left text-sm font-medium text-[#0f172a] sm:max-w-36">
          {displayName}
        </span>
        <svg
          className={`size-4 shrink-0 text-[#64748b] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <div
        className={`ui-menu-surface absolute right-0 top-full z-50 mt-2 w-56 origin-top-right p-1.5 transition-all duration-150 dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)] ${
          open
            ? "pointer-events-auto scale-100 opacity-100"
            : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <div className="border-b border-[#eef2f6] px-2 py-2 dark:border-[#42556e]">
          <p className="text-sm font-semibold text-[#111827]">{displayName}</p>
          <p className="text-xs text-[#6b7280]">{secondaryText}</p>
        </div>

        {canOpenAdmin && (
          <Link
            to={resolveHref(ROUTES.admin)}
            onClick={() => setOpen(false)}
            className="ui-menu-item mt-1"
          >
            Panel administracyjny
          </Link>
        )}

        <button
          type="button"
          onClick={() => {
            if (usesBootstrapIdentity) {
              void onRefreshAccess();
              return;
            }

            onLogout();
          }}
          disabled={usesBootstrapIdentity && isRefreshingAccess}
          className="ui-menu-item ui-menu-item-danger mt-1 text-left disabled:opacity-60"
        >
          {usesBootstrapIdentity && isRefreshingAccess ? "Odświeżanie…" : identityActionLabel}
        </button>
      </div>
    </div>
  );
}
