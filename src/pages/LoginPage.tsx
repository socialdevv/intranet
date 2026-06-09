import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import FirstRunSetup from "@/components/auth/first-run-setup";
import { GLOBAL_APP_NAME } from "@/lib/config/branding";
import { ROUTES } from "@/lib/routes";

export default function LoginPage() {
  const { user, loginWithPin } = useAuth();
  const { data, isLoading } = useData();
  const appBranding = GLOBAL_APP_NAME;

  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={ROUTES.home} replace />;

  // First-run: admin PIN not yet configured — show bootstrap setup.
  const isFirstRun =
    !isLoading &&
    !data.auth.adminPinHash;

  if (isFirstRun) return <FirstRunSetup />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || isLoading) return;
    setError("");
    setBusy(true);
    try {
      const result = await loginWithPin(
        pin,
        data.auth.adminPinHash
      );
      if (!result.ok) {
        setError(result.error);
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 dark:bg-[#0f172a]">
      <section className="w-full max-w-md rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm dark:border-[#1e293b] dark:bg-[#1e293b]">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#f1f5f9]">{appBranding}</h1>
        <p className="mt-1 text-sm text-[#6b7280] dark:text-[#94a3b8]">Logowanie administratora. Wprowadź PIN, aby uzyskać dostęp.</p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="pin" className="sr-only">PIN</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="PIN"
              value={pin}
              disabled={busy || isLoading}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError("");
              }}
              className={[
                "h-11 w-full rounded-lg border px-4 text-sm outline-none transition",
                "placeholder:text-[#9ca3af] dark:placeholder:text-[#475569]",
                "focus:ring-2 focus:ring-[#1d4f91]/30",
                error
                  ? "border-[#ef4444] bg-[#fff5f5] text-[#111827] focus:border-[#ef4444] dark:bg-[#2d1515] dark:text-[#fca5a5]"
                  : "border-[#d1d5db] bg-white text-[#111827] focus:border-[#1d4f91] dark:border-[#334155] dark:bg-[#263347] dark:text-[#f1f5f9] dark:focus:border-[#3b82f6]",
              ].join(" ")}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#ef4444]">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || isLoading || !pin.trim()}
            className={[
              "flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition",
              busy || isLoading || !pin.trim()
                ? "cursor-not-allowed bg-[#93c5fd] text-white dark:bg-[#1e3a5f] dark:text-[#475569]"
                : "bg-[#1d4f91] text-white hover:bg-[#1a4580]",
            ].join(" ")}
          >
            {busy ? "Weryfikacja…" : "Zaloguj się"}
          </button>
        </form>
      </section>
    </main>
  );
}
