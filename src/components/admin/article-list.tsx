import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Trash2, ArrowUpDown } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { adminArticleEditorPath, knowledgeArticlePath } from "@/lib/routes";
import { formatDate } from "@/lib/utils";
import { useDragSort } from "@/hooks/useDragSort";
import { DragRow } from "./drag-row";
import type { KnowledgePage, KnowledgeCategoryEntry } from "@/lib/types/domain";

// ── Per-category article order panel ─────────────────────────────────────────
function CategoryOrderSection({
  cat,
  pages,
  reorderPages,
}: {
  cat: KnowledgeCategoryEntry;
  pages: KnowledgePage[];
  reorderPages: (catId: string, ordered: KnowledgePage[]) => void | Promise<void>;
}) {
  const catPages = [...pages]
    .filter((p) => p.categoryId === cat.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort<KnowledgePage>(
    catPages,
    (reordered) => reorderPages(cat.id, reordered)
  );

  if (catPages.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94a3b8]">
        {cat.name}
      </p>
      <div className="space-y-1">
        {catPages.map((page, idx) => (
          <DragRow
            key={page.id}
            idx={idx}
            label={page.title}
            sublabel={page.slug}
            isOver={overIdx === idx}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
}

export default function ArticleList() {
  const { pages, categories, deletePage, reorderPages } = useData();
  const { push: toast } = useToast();
  const [query, setQuery] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState(false);

  const categoryName = (catId: string) =>
    categories.find((c) => c.id === catId)?.name ?? "—";

  const filtered = pages.filter((p) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.slug.toLowerCase().includes(q) ||
      categoryName(p.categoryId).toLowerCase().includes(q)
    );
  });

  const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const catsWithArticles = sortedCats.filter((c) => pages.some((p) => p.categoryId === c.id));

  async function confirmDelete(id: string, title: string) {
    try {
      await deletePage(id);
      setPendingDeleteId(null);
      toast("success", `Artykuł „${title}” usunięty.`);
    } catch (caught) {
      toast(
        "error",
        caught instanceof Error
          ? caught.message
          : "Nie udało się usunąć artykułu bazy wiedzy."
      );
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Artykuły</h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            {pages.length} {pages.length === 1 ? "artykuł" : "artykułów"} w bazie wiedzy
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
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj artykułów…"
                className="h-9 w-52 rounded-lg border border-[#d1d5db] bg-white pl-8 pr-3 text-sm placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => { setOrderMode((v) => !v); setQuery(""); }}
            className={[
              "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition",
              orderMode
                ? "border-[#1d4f91] bg-[#e8edf5] text-[#1d4f91]"
                : "border-[#d1d5db] bg-white text-[#374151] hover:bg-[#f1f5f9] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]",
            ].join(" ")}
          >
            <ArrowUpDown size={13} />
            Kolejność
          </button>
          <Link
            to={adminArticleEditorPath("nowy")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 text-sm font-medium text-white transition hover:bg-[#1a4580]"
          >
            <Plus size={14} />
            Nowy artykuł
          </Link>
        </div>
      </div>

      {/* Order mode view */}
      {orderMode ? (
        catsWithArticles.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-12 text-center dark:border-[#334155] dark:bg-[#1a2535]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak artykułów do posortowania.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-xs text-[#64748b] dark:text-[#94a3b8]">Przeciągnij artykuły, aby zmienić ich kolejność w ramach kategorii.</p>
            {catsWithArticles.map((cat) => (
              <CategoryOrderSection
                key={cat.id}
                cat={cat}
                pages={pages}
                reorderPages={reorderPages}
              />
            ))}
          </div>
        )
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-12 text-center dark:border-[#334155] dark:bg-[#1a2535]">
              <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
                {pages.length === 0
                  ? `Brak artyku\u0142\u00f3w. Kliknij \u201e+ Nowy artyku\u0142\u201d aby doda\u0107 pierwszy.`
                  : "Brak wynik\u00f3w dla podanego zapytania."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#dde5ee] dark:border-[#1e3a5f]">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#f1f5f9] bg-[#f8fafc] dark:border-[#1e293b] dark:bg-[#111827]">
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                  Tytuł
                </th>
                <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                  Kategoria
                </th>
                <th className="hidden px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8] sm:table-cell">
                  Zaktualizowano
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
              {filtered.map((page) => (
                <tr
                  key={page.id}
                  className="bg-white transition hover:bg-[#f8fafc] dark:bg-[#0d1b2e] dark:hover:bg-[#0f2340]"
                >
                  <td className="max-w-[16rem] px-5 py-3">
                    <p className="truncate font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {page.title}
                    </p>
                    <p className="truncate font-mono text-[11px] text-[#94a3b8]">{page.slug}</p>
                  </td>
                  <td className="px-5 py-3 text-[#4b5563] dark:text-[#94a3b8]">
                    {categoryName(page.categoryId)}
                  </td>
                  <td className="hidden px-5 py-3 text-[#64748b] dark:text-[#94a3b8] sm:table-cell">
                    {formatDate(page.updatedAt)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {pendingDeleteId === page.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-[#ef4444] dark:text-[#f87171]">Usunąć?</span>
                        <button
                          type="button"
                          onClick={() => confirmDelete(page.id, page.title)}
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
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          to={knowledgeArticlePath(page.category, page.slug)}
                          className="text-xs text-[#64748b] transition hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#60a5fa]"
                        >
                          Podgląd
                        </Link>
                        <Link
                          to={adminArticleEditorPath(page.id)}
                          className="text-xs font-medium text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
                        >
                          Edytuj
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(page.id)}
                          className="text-[#fca5a5] transition hover:text-[#ef4444] dark:text-[#7f1d1d] dark:hover:text-[#f87171]"
                          title="Usuń artykuł"
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
