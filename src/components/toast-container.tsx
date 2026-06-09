import { useToast } from "@/contexts/toast-context";

export default function ToastContainer() {
  const { toasts, remove } = useToast();

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 flex flex-col gap-2 sm:left-auto sm:w-[min(24rem,calc(100vw-2rem))]">
      {toasts.map((toast) => {
        const toneClass =
          toast.type === "success"
            ? "ui-toast-success"
            : toast.type === "error"
              ? "ui-toast-error"
              : "ui-toast-info";
        const iconColor =
          toast.type === "success"
            ? "text-[#10b981]"
            : toast.type === "error"
              ? "text-[#ef4444]"
              : "text-[#3b82f6]";

        return (
          <div
            key={toast.id}
            className={`ui-toast ${toneClass}`}
          >
            <div className={`flex size-5 shrink-0 items-center justify-center ${iconColor}`}>
              {toast.type === "success" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
              {toast.type === "error" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              )}
              {toast.type === "info" && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              )}
            </div>
            <p className="min-w-0 flex-1 text-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="ui-btn-icon ml-2 size-6 border-transparent bg-transparent text-lg font-bold opacity-60 hover:opacity-100"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
