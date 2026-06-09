import { Navigate } from "react-router-dom";
import PlatformLinksManager from "@/components/admin/platform-links-manager";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";

export default function GlobalLinksAdminPage() {
  const { user } = useAuth();

  if (!user || !canAccessAdminPanel(user)) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <AppShell
      currentUser={user}
      navigationMode="global"
      searchPlaceholder="Szukaj po linkach globalnych…"
    >
      <section className="mx-auto w-full max-w-7xl pb-8">
        <div className="rounded-4xl border border-[#dbe5f0] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4fb_45%,#ffffff_100%)] px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.07)] dark:border-[#1e3a5f] dark:bg-[linear-gradient(135deg,#0f2340_0%,#102846_45%,#0f172a_100%)] sm:px-8 lg:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91] dark:text-[#93c5fd]">
            Warstwa globalna
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0f172a] dark:text-[#f8fafc] sm:text-4xl">
            Linki globalne
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] dark:text-[#cbd5e1]">
            Ten widok zarządza wspólnymi odnośnikami na globalnej stronie głównej. Linki pozostają wyraźnie platformowe i nie mieszają się z listami linków wewnątrz projektów.
          </p>
        </div>

        <div className="mt-8">
          <PlatformLinksManager />
        </div>
      </section>
    </AppShell>
  );
}