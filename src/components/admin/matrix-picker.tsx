import { useState, useMemo } from "react";
import { Search, X, Check } from "lucide-react";
import type { MatrixDecision } from "@/lib/types/domain";

type Props = {
  matrix: MatrixDecision[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** If set to 1, acts as a single-select and closes after picking. */
  maxSelect?: number;
  placeholder?: string;
};

export default function MatrixPicker({
  matrix,
  selectedIds,
  onChange,
  maxSelect,
  placeholder = "+ Dodaj procedurę",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedEntries = selectedIds
    .map((id) => matrix.find((m) => m.id === id))
    .filter((m): m is MatrixDecision => Boolean(m));

  const filtered = useMemo(() => {
    if (!query.trim()) return matrix.slice(0, 40);
    const q = query.toLowerCase();
    return matrix
      .filter(
        (m) =>
          m.category.toLowerCase().includes(q) ||
          m.subcategory.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.defaultDepartment.toLowerCase().includes(q) ||
          m.keywords.some((k) => k.toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [matrix, query]);

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else if (maxSelect === 1) {
      onChange([id]);
      setOpen(false);
      setQuery("");
    } else {
      onChange([...selectedIds, id]);
    }
  }

  function remove(id: string) {
    onChange(selectedIds.filter((s) => s !== id));
  }

  const canAddMore = maxSelect === undefined || selectedIds.length < maxSelect;

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedEntries.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {selectedEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-[#c3d6ea] bg-[#eff6ff] px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#1d4f91]">
                  {entry.category}
                </p>
                <p className="text-xs font-medium leading-tight text-[#0f172a]">
                  {entry.subcategory || entry.category}
                </p>
                {entry.defaultDepartment && (
                  <p className="text-[10px] text-[#64748b]">{entry.defaultDepartment}</p>
                )}
                {entry.slaDays != null && (
                  <p className="text-[10px] font-semibold text-[#1d4f91]">Czas realizacji: {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="Usuń"
                className="mt-0.5 shrink-0 text-[#94a3b8] hover:text-[#ef4444]"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Toggle button */}
      {canAddMore && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full rounded-lg border border-dashed border-[#c9d6e3] py-2 text-xs font-medium text-[#64748b] transition hover:border-[#1d4f91] hover:text-[#1d4f91]"
        >
          {open
            ? "Zamknij"
            : selectedIds.length === 0
            ? placeholder
            : "+ Dodaj kolejny"}
        </button>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="rounded-xl border border-[#d9e2ec] bg-white shadow-lg">
          <div className="border-b border-[#f1f5f9] p-2">
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94a3b8]"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj procedury…"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="h-8 w-full rounded-lg border border-[#d1d5db] pl-7 pr-3 text-xs outline-none focus:border-[#1d4f91] focus:ring-1 focus:ring-[#1d4f91]/20"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-[#9ca3af]">
                Brak wyników
              </p>
            ) : (
              filtered.map((entry) => {
                const isSelected = selectedIds.includes(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => toggle(entry.id)}
                    className={[
                      "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition hover:bg-[#f8fafc]",
                      isSelected ? "bg-[#eff6ff]" : "",
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        isSelected
                          ? "border-[#1d4f91] bg-[#1d4f91]"
                          : "border-[#d1d5db]",
                      ].join(" ")}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                        {entry.category}
                      </p>
                      <p className="text-xs font-medium leading-snug text-[#0f172a]">
                        {entry.subcategory || entry.category}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        {entry.defaultDepartment && (
                          <span className="text-[10px] text-[#64748b]">
                            {entry.defaultDepartment}
                          </span>
                        )}
                        {entry.slaDays != null && (
                          <span className="text-[10px] font-semibold text-[#1d4f91]">
                            Czas realizacji: {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
