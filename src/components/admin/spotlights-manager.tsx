import { useState } from "react";
import {
  GripVertical,
  Plus,
  Trash2,
  BookOpen,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { generateId } from "@/lib/utils";
import { useDragSort } from "@/hooks/useDragSort";
import type { HomeSpotlight } from "@/lib/types/domain";

export default function SpotlightsManager() {
  const { pages, homeSpotlights, setHomeSpotlights } = useData();

  const sorted = [...homeSpotlights].sort((a, b) => a.sortOrder - b.sortOrder);

  const [addQuery, setAddQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } =
    useDragSort<HomeSpotlight>(sorted, (reordered) =>
      void setHomeSpotlights(reordered.map((s, i) => ({ ...s, sortOrder: i })))
    );

  function pageTitle(s: HomeSpotlight) {
    const page = pages.find((p) => p.id === s.pageId);
    return s.labelOverride?.trim() || page?.title || "(nieznany artykuł)";
  }

  function pageCategory(s: HomeSpotlight) {
    return pages.find((p) => p.id === s.pageId)?.categoryDisplayName ?? "";
  }

  const alreadySelected = new Set(sorted.map((s) => s.pageId));
  const filteredPages = pages
    .filter((p) => {
      if (alreadySelected.has(p.id)) return false;
      if (!addQuery.trim()) return true;
      const q = addQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.categoryDisplayName ?? "").toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    })
    .slice(0, 12);

  function addSpotlight(pageId: string) {
    if (sorted.length >= 10) return;
    const next: HomeSpotlight[] = [
      ...sorted,
      { id: generateId("hsp"), pageId, sortOrder: sorted.length },
    ];
    void setHomeSpotlights(next);
    setAddQuery("");
    setAddOpen(false);
  }

  function removeSpotlight(id: string) {
    const next = sorted
      .filter((s) => s.id !== id)
      .map((s, i) => ({ ...s, sortOrder: i }));
    void setHomeSpotlights(next);
  }

  function startEdit(s: HomeSpotlight) {
    setEditingId(s.id);
    setEditLabel(s.labelOverride ?? "");
  }

  function commitEdit(id: string) {
    const next = sorted.map((s) =>
      s.id === id ? { ...s, labelOverride: editLabel.trim() || undefined } : s
    );
    void setHomeSpotlights(next);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Ważne tematy
          </h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Do 10 artykułów wyróżnionych na stronie głównej. Przeciągnij, aby zmienić kolejność.
          </p>
        </div>
        {sorted.length < 10 && (
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#1a4580]"
          >
            <Plus size={13} />
            Dodaj artykuł
          </button>
        )}
      </div>

      {/* Article picker */}
      {addOpen && (
        <div className="mb-4 rounded-xl border border-[#c3d6ea] bg-[#f8fafd] p-3 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8]">
            Wybierz artykuł
          </p>
          <input
            autoFocus
            type="search"
            placeholder="Szukaj po tytule, kategorii, tagach…"
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            className="mb-2 h-8 w-full rounded-lg border border-[#dde5ee] bg-white px-3 text-xs placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
          />
          {filteredPages.length === 0 ? (
            <p className="py-2 text-center text-xs text-[#9ca3af] dark:text-[#475569]">
              {addQuery ? "Brak wyników" : "Wszystkie artykuły już dodane lub brak artykułów"}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredPages.map((page) => (
                <button
                  key={page.id}
                  type="button"
                  onClick={() => addSpotlight(page.id)}
                  className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-[#e9f2ff] dark:hover:bg-[#1d4f91]/20"
                >
                  <BookOpen size={13} className="mt-0.5 shrink-0 text-[#1d4f91]/60 dark:text-[#60a5fa]/60" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {page.title}
                    </p>
                    {page.categoryDisplayName && (
                      <p className="truncate text-[10px] text-[#94a3b8]">{page.categoryDisplayName}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setAddOpen(false); setAddQuery(""); }}
            className="mt-2 text-xs text-[#9ca3af] hover:text-[#64748b] dark:text-[#475569] dark:hover:text-[#94a3b8]"
          >
            Zamknij
          </button>
        </div>
      )}

      {/* List */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-10 text-center dark:border-[#334155] dark:bg-[#1a2535]">
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak wyróżnionych tematów.</p>
          <p className="mt-1 text-xs text-[#9ca3af] dark:text-[#475569]">Kliknij „Dodaj artykuł", aby dodać pierwszy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((s, idx) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={(e) => onDragOver(e, idx)}
              onDrop={(e) => onDrop(e, idx)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition dark:bg-[#0d1b2e] ${
                overIdx === idx
                  ? "border-[#1d4f91] dark:border-[#2563eb]"
                  : "border-[#dde5ee] dark:border-[#1e3a5f]"
              }`}
            >
              <GripVertical size={14} className="shrink-0 cursor-grab text-[#c0cdd8] dark:text-[#334155]" />
              <span className="shrink-0 text-[10px] font-semibold text-[#94a3b8] dark:text-[#475569]">
                {idx + 1}.
              </span>
              <div className="min-w-0 flex-1">
                {editingId === s.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(s.id); if (e.key === "Escape") cancelEdit(); }}
                      placeholder={pages.find((p) => p.id === s.pageId)?.title ?? "Etykieta…"}
                      className="h-7 flex-1 rounded-lg border border-[#c3d6ea] bg-[#f8fafd] px-2 text-xs focus:border-[#1d4f91] focus:outline-none focus:ring-1 focus:ring-[#1d4f91]/20 dark:border-[#1e3a5f] dark:bg-[#111827] dark:text-[#f1f5f9]"
                    />
                    <button type="button" onClick={() => commitEdit(s.id)} className="text-[#22c55e] hover:text-[#16a34a]">
                      <Check size={14} />
                    </button>
                    <button type="button" onClick={cancelEdit} className="text-[#9ca3af] hover:text-[#64748b]">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1.5">
                    <p className="truncate text-xs font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {pageTitle(s)}
                    </p>
                    {s.labelOverride && (
                      <span className="shrink-0 rounded bg-[#e9f2ff] px-1 text-[10px] text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
                        własna etykieta
                      </span>
                    )}
                  </div>
                )}
                {editingId !== s.id && pageCategory(s) && (
                  <p className="truncate text-[10px] text-[#9ca3af]">{pageCategory(s)}</p>
                )}
              </div>
              {editingId !== s.id && (
                <>
                  <button
                    type="button"
                    title="Edytuj etykietę"
                    onClick={() => startEdit(s)}
                    className="shrink-0 text-[#c0cdd8] transition hover:text-[#64748b] dark:text-[#334155] dark:hover:text-[#94a3b8]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Usuń"
                    onClick={() => removeSpotlight(s.id)}
                    className="shrink-0 text-[#fca5a5] transition hover:text-[#dc2626] dark:text-[#7f1d1d] dark:hover:text-[#f87171]"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
