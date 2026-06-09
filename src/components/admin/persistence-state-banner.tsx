import { AlertTriangle, CloudOff, Loader2 } from "lucide-react";
import { useData } from "@/contexts/data-context";

type Props = {
  className?: string;
};

export default function PersistenceStateBanner({ className = "" }: Props) {
  const { persistenceState, retryPendingSave } = useData();

  const isFailed = persistenceState.status === "failed";
  const isSaving = persistenceState.status === "saving";
  const isUnsaved = persistenceState.status === "unsaved";
  const isSessionOnlyMode = persistenceState.appDataLocalStorageSuppressed;
  const isFallbackMode =
    persistenceState.fallbackModeActive || persistenceState.saveCapability === "not-configured";
  const shouldRender =
    isFailed || isSaving || isUnsaved || isFallbackMode || Boolean(persistenceState.lastWarning);

  if (!shouldRender) {
    return null;
  }

  const title = isFailed
    ? "Nie udało się zapisać zmian"
    : isSaving
      ? "Zapisywanie zmian…"
      : isUnsaved
        ? "Zmiany oczekują na zapis"
        : isSessionOnlyMode
          ? "Zmiany są tylko w bieżącej sesji"
          : isFallbackMode
            ? "Zapis działa w trybie lokalnym"
            : "Uwaga";

  const detailParts: string[] = [];

  if (isFailed && persistenceState.lastError) {
    detailParts.push(persistenceState.lastError);
    detailParts.push("Zmiany nadal są w bieżącej sesji. Nie zamykaj strony przed ponowną próbą.");
  } else {
    if (isSessionOnlyMode) {
      detailParts.push(
        "Część ustawień może nie być trwale zapisana po odświeżeniu strony. Zapisz ponownie lub skontaktuj się z administratorem."
      );
    }
    if (isFallbackMode) {
      if (persistenceState.saveCapabilityReason === "storage-mode-local") {
        detailParts.push("Konfiguracja jest zapisywana lokalnie w tej instalacji.");
      } else if (persistenceState.saveCapabilityReason === "api-base-url-missing") {
        detailParts.push("Brak połączenia z serwerem zapisu. Sprawdź konfigurację wdrożenia.");
      } else {
        detailParts.push("Zapis do serwera jest tymczasowo niedostępny.");
      }
    }
    if (persistenceState.lastWarning) {
      detailParts.push(persistenceState.lastWarning);
    }
  }

  const palette = isFailed
    ? "border-[#fecaca] bg-[#fff5f5] text-[#7f1d1d] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]"
    : isSaving || isUnsaved
      ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4f91] dark:border-[#1e3a8a] dark:bg-[#0f1b3a] dark:text-[#bfdbfe]"
      : isSessionOnlyMode
        ? "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4f91] dark:border-[#1e3a8a] dark:bg-[#0f1b3a] dark:text-[#bfdbfe]"
        : "border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:border-[#78350f] dark:bg-[#2b2110] dark:text-[#fde68a]";

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${palette} ${className}`.trim()}>
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0">
          {isFailed ? (
            <AlertTriangle size={16} />
          ) : isSaving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <CloudOff size={16} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          {detailParts.length > 0 ? (
            <p className="mt-1 text-xs leading-5 opacity-90">{detailParts.join(" ")}</p>
          ) : null}
          {isFailed ? (
            <button
              type="button"
              onClick={retryPendingSave}
              className="mt-2 inline-flex h-7 items-center rounded-md border border-current/30 px-2.5 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5"
            >
              Spróbuj zapisać ponownie
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
