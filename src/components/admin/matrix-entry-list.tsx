import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { adminMatrixEditorPath } from "@/lib/routes";
import { MatrixCategorySection } from "./matrix-category-section";

export default function MatrixEntryList() {
  const { matrix, matrixCategoryOrder, matrixModule } = useData();
  const { push: toast } = useToast();
  const {
    source,
    isMutating,
    error: moduleError,
    canWrite,
    canReorder,
    removeEntry,
  } = matrixModule;
  const apiMode = source === "api";
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState(false);
  const [actionError, setActionError] = useState("");

  const filtered = query.trim()
    ? matrix.filter((m) => {
        const q = query.toLowerCase();
        return (
          m.category.toLowerCase().includes(q) ||
          m.subcategory.toLowerCase().includes(q) ||
          m.defaultDepartment.toLowerCase().includes(q) ||
          m.keywords.some((k) => k.toLowerCase().includes(q))
        );
      })
    : matrix;

  function moveCategoryUp(idx: number) {
    const next = [...matrixCategoryOrder];
    if (idx === 0) return;
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    matrixModule.reorderCategories(next);
  }

  function moveCategoryDown(idx: number) {
    const next = [...matrixCategoryOrder];
    if (idx >= next.length - 1) return;
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    matrixModule.reorderCategories(next);
  }

  async function confirmDelete(id: string, label: string) {
    if (apiMode && !canWrite) {
      setActionError(moduleError ?? "Zapis jest tymczasowo niedostępny.");
      return;
    }

    setActionError("");

    try {
      await removeEntry(id);
      setPendingDeleteId(null);
      toast(
        "success",
        `Wpis „${label}" usunięty.`
      );
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się usunąć wpisu macierzy.");
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Macierz</h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            {matrix.length} {matrix.length === 1 ? "wpis" : "wpisów"} w macierzy kategoryzacji
            {canReorder ? "." : " • kolejność jest tylko do odczytu."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!orderMode && (
            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
              />
              <input
                type="search"
                placeholder="Szukaj wpisów macierzy…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 w-52 rounded-lg border border-[#d1d5db] bg-white pl-8 pr-3 text-sm placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (!canReorder) return;
              setOrderMode((v) => !v);
              setQuery("");
            }}
            disabled={!canReorder}
            className={[
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
              orderMode
                ? "border-[#1d4f91] bg-[#e8edf5] text-[#1d4f91]"
                : "border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f1f5f9] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]",
            ].join(" ")}
          >
            <ArrowUpDown size={13} />
            Kolejność
          </button>
          {apiMode && !canWrite ? (
            <button
              type="button"
              disabled
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-4 text-sm font-medium text-[#9ca3af]"
            >
              <Plus size={14} />
              Nowy wpis
            </button>
          ) : (
            <Link
              to={adminMatrixEditorPath("nowy")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 text-sm font-medium text-white transition hover:bg-[#1a4580]"
            >
              <Plus size={14} />
              Nowy wpis
            </Link>
          )}
        </div>
      </div>

      {(actionError || moduleError) && (
        <div className="mb-4 rounded-lg border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#fca5a5]">
          {actionError || moduleError}
        </div>
      )}

      {/* Order mode view */}
      {orderMode && canReorder ? (
        matrixCategoryOrder.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-12 text-center dark:border-[#334155] dark:bg-[#1a2535]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak kategorii macierzy do posortowania.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">
              Użyj strzałek, aby zmienić kolejność kategorii. Rozwiń kategorię, aby posortować wpisy przeciąganiem.
            </p>
            {matrixCategoryOrder.map((name, idx) => (
              <MatrixCategorySection
                key={name}
                categoryName={name}
                entries={matrix.filter((m) => m.category === name)}
                isFirst={idx === 0}
                isLast={idx === matrixCategoryOrder.length - 1}
                onMoveUp={() => moveCategoryUp(idx)}
                onMoveDown={() => moveCategoryDown(idx)}
              />
            ))}
          </div>
        )
      ) : (
        <>
          {/* Table / Empty state */}
          {matrix.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-12 text-center dark:border-[#334155] dark:bg-[#1a2535]">
              <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
                Brak wpisów w macierzy.{" "}
                <Link
                  to={adminMatrixEditorPath("nowy")}
                  className="font-medium text-[#1d4f91] hover:underline dark:text-[#60a5fa]"
                >
                  Dodaj pierwszy wpis
                </Link>
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-10 text-center dark:border-[#334155] dark:bg-[#1a2535]">
              <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak wyników dla podanego zapytania.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#dde5ee] dark:border-[#1e3a5f]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] dark:border-[#1e293b] dark:bg-[#111827]">
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                      Kategoria / Podkategoria
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                      Dział
                    </th>
                    <th className="px-5 py-3 text-center text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                      Czas realizacji
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                      Akcje
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
                  {filtered.map((entry) => (
                    <tr
                      key={entry.id}
                      className="bg-white transition hover:bg-[#f8fafc] dark:bg-[#0d1b2e] dark:hover:bg-[#0f2340]"
                    >
                      <td className="px-5 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#94a3b8] dark:text-[#475569]">
                          {entry.category}
                        </p>
                        <p className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">{entry.subcategory}</p>
                  </td>
                  <td className="px-5 py-3 text-[#374151] dark:text-[#94a3b8]">
                    {entry.defaultDepartment}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span className="inline-flex items-center rounded-full bg-[#e9f2ff] px-2.5 py-0.5 text-xs font-semibold text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#60a5fa]">
                      {entry.slaDays} dni
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {pendingDeleteId === entry.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-[#ef4444] dark:text-[#f87171]">Usunąć?</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (isMutating) return;
                            void confirmDelete(entry.id, entry.subcategory);
                          }}
                          disabled={isMutating || (apiMode && !canWrite)}
                          className="rounded-lg bg-[#ef4444] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#dc2626]"
                        >
                          Potwierdź
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(null)}
                          className="rounded-lg border border-[#d1d5db] px-2.5 py-1 text-xs text-[#64748b] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                        >
                          Anuluj
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={adminMatrixEditorPath(entry.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#dde5ee] bg-white px-2.5 py-1 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]"
                        >
                          <Pencil size={11} />
                          Edytuj
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(entry.id)}
                          disabled={isMutating || (apiMode && !canWrite)}
                          className="text-[#fca5a5] transition hover:text-[#ef4444] dark:text-[#7f1d1d] dark:hover:text-[#f87171]"
                          title="Usuń wpis"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      )}
    </div>
  );
}
