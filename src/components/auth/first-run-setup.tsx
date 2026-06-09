import { useState, type FormEvent } from "react";
import { hashPin } from "@/lib/auth/pin-auth";
import { useData } from "@/contexts/data-context";
import { useAuth } from "@/contexts/auth-context";

/**
 * Shown once, when no admin PIN has been configured yet (first run).
 * Sets the admin PIN, persists it, then auto-logs in.
 */
export default function FirstRunSetup() {
  const { updateAuthHashes } = useData();
  const { loginWithPin } = useAuth();

  const [adminPin, setAdminPin] = useState("");
  const [adminConfirm, setAdminConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (adminPin.length < 4) {
      setError("PIN musi mieć co najmniej 4 znaki.");
      return;
    }
    if (adminPin !== adminConfirm) {
      setError("Podane PINy nie są takie same.");
      return;
    }

    setBusy(true);
    try {
      const aHash = await hashPin(adminPin);
      updateAuthHashes(aHash);
      await loginWithPin(adminPin, aHash);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-[#d1d5db] bg-white px-4 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/30 disabled:opacity-50 dark:border-[#334155] dark:bg-[#263347] dark:text-[#f1f5f9] dark:placeholder:text-[#475569] dark:focus:border-[#3b82f6]";

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 dark:bg-[#0f172a]">
      <section className="w-full max-w-sm rounded-2xl border border-[#e5e7eb] bg-white p-8 shadow-sm dark:border-[#1e293b] dark:bg-[#1e293b]">
        <h1 className="text-2xl font-bold tracking-tight text-[#111827] dark:text-[#f1f5f9]">
          Pierwsze uruchomienie
        </h1>
        <p className="mt-1 text-sm text-[#6b7280] dark:text-[#94a3b8]">
          Ustaw PIN administratora. Po zapisaniu zostaniesz zalogowany automatycznie.
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <input
            type="password"
            placeholder="Nowy PIN administratora"
            autoComplete="new-password"
            value={adminPin}
            disabled={busy}
            onChange={(e) => { setAdminPin(e.target.value); setError(""); }}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Powtórz PIN administratora"
            autoComplete="new-password"
            value={adminConfirm}
            disabled={busy}
            onChange={(e) => { setAdminConfirm(e.target.value); setError(""); }}
            className={inputClass}
          />

          {error && (
            <p role="alert" className="text-sm text-[#ef4444]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !adminPin || !adminConfirm}
            className={[
              "flex h-11 w-full items-center justify-center rounded-lg text-sm font-medium transition",
              busy || !adminPin || !adminConfirm
                ? "cursor-not-allowed bg-[#93c5fd] text-white dark:bg-[#1e3a5f] dark:text-[#475569]"
                : "bg-[#1d4f91] text-white hover:bg-[#1a4580]",
            ].join(" ")}
          >
            {busy ? "Zapisywanie…" : "Ustaw PIN i zaloguj się"}
          </button>
        </form>
      </section>
    </main>
  );
}
