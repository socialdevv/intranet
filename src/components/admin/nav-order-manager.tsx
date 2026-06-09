import { ChevronUp, ChevronDown } from "lucide-react";
import { useData, NAV_MODULE_KEYS } from "@/contexts/data-context";

/** Human-readable labels for each navigation module key. */
const MODULE_LABELS: Record<string, string> = {
  home:       "Pulpit",
  matrix:     "Macierz",
  szablony:   "Szablony",
  cenniki:    "Cenniki",
  komunikaty: "Komunikaty",
  tematOrg:   "Tematy organizacyjne",
  linki:      "Linki",
  kontakty:   "Dane kontaktowe",
  zwroty:     "Gotowe zwroty",
};

export default function NavOrderManager() {
  const { navOrder, setNavOrder } = useData();

  function move(idx: number, dir: -1 | 1) {
    const next = [...navOrder];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    void setNavOrder(next);
  }

  function resetDefault() {
    void setNavOrder([...NAV_MODULE_KEYS]);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* Reorder list */}
      <div className="rounded-xl border border-[#dde5ee] bg-white dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4 dark:border-[#1e293b]">
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Kolejność modułów nawigacji
            </h2>
            <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
              Kolejność jest odzwierciedlona w bocznym menu aplikacji.
            </p>
          </div>
          <button
            type="button"
            onClick={resetDefault}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d1d5db] px-3 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Przywróć domyślną
          </button>
        </div>

        <div className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
          {navOrder.map((key, idx) => (
            <div
              key={key}
              className="flex items-center gap-3 px-5 py-3"
            >
              {/* Position badge */}
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[10px] font-bold text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]">
                {idx + 1}
              </span>

              {/* Label */}
              <span className="flex-1 text-sm font-medium text-[#111827] dark:text-[#f1f5f9]">
                {MODULE_LABELS[key] ?? key}
              </span>

              {/* Reorder controls */}
              <div className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                  aria-label="Przesuń w górę"
                >
                  <ChevronUp size={10} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === navOrder.length - 1}
                  className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                  aria-label="Przesuń w dół"
                >
                  <ChevronDown size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info panel */}
      <div className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <h2 className="mb-3 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          O konfiguracji kolejności
        </h2>
        <div className="space-y-2.5 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
          <p>
            Użyj strzałek po prawej stronie każdego modułu, aby zmienić jego kolejność
            w bocznym menu aplikacji.
          </p>
          <p>
            Zmiany są zapisywane natychmiast i widoczne dla wszystkich użytkowników
            po odświeżeniu strony.
          </p>
          <p>
            Kolejność jest przechowywana w danych aplikacji — eksport / import JSON
            zachowuje ustawioną kolejność.
          </p>
          <p>
            Przycisk <strong className="text-[#374151] dark:text-[#cbd5e1]">Przywróć domyślną</strong> resetuje
            do kolejności fabrycznej.
          </p>
        </div>
      </div>
    </div>
  );
}
