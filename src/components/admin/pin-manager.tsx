import { useState, type FormEvent } from "react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { hashPin } from "@/lib/auth/pin-auth";

export default function PinManager() {
  const { updateAuthHashes, data } = useData();
  const { push: toast } = useToast();

  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const hasAdminPin = Boolean(data.auth.adminPinHash);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (newPin.length < 4) {
      setFormError("PIN musi mieć co najmniej 4 znaki.");
      return;
    }
    if (newPin !== confirmPin) {
      setFormError("Podane PINy nie są takie same.");
      return;
    }
    setBusy(true);
    try {
      const hash = await hashPin(newPin);
      updateAuthHashes(hash);
      toast("success", "PIN administratora zaktualizowany.");
      setNewPin("");
      setConfirmPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#dde5ee] bg-white p-6 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
      <h2 className="text-base font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Zarządzanie PINem</h2>
      <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
        Zmień PIN dostępu administratora.
      </p>

      {/* Status badge */}
      <div className="mt-4">
        <span
          className={[
            "inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium",
            hasAdminPin
              ? "bg-[#dcfce7] text-[#166534] dark:bg-[#166534]/20 dark:text-[#4ade80]"
              : "bg-[#fee2e2] text-[#991b1b] dark:bg-[#991b1b]/20 dark:text-[#f87171]",
          ].join(" ")}
        >
          Administrator: {hasAdminPin ? "PIN ustawiony" : "brak PINu"}
        </span>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4 max-w-sm">
        <input
          type="password"
          placeholder="Nowy PIN"
          value={newPin}
          disabled={busy}
          onChange={(e) => { setNewPin(e.target.value); setFormError(""); }}
          className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-4 text-sm outline-none focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/30 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
        />
        <input
          type="password"
          placeholder="Powtórz PIN"
          value={confirmPin}
          disabled={busy}
          onChange={(e) => { setConfirmPin(e.target.value); setFormError(""); }}
          className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-4 text-sm outline-none focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/30 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
        />

        {formError && (
          <p role="alert" className="text-sm text-[#ef4444]">{formError}</p>
        )}

        <button
          type="submit"
          disabled={busy || !newPin || !confirmPin}
          className={[
            "h-9 w-full rounded-lg text-sm font-medium transition",
            busy || !newPin || !confirmPin
              ? "cursor-not-allowed bg-[#93c5fd] text-white"
              : "bg-[#1d4f91] text-white hover:bg-[#1a4580]",
          ].join(" ")}
        >
          {busy ? "Zapisywanie…" : "Zapisz PIN"}
        </button>
      </form>
    </div>
  );
}
