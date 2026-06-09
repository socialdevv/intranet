import { useState, type FormEvent } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import type { KnowledgeCategoryEntry } from "@/lib/types/domain";
import { slugify, generateId } from "@/lib/utils";

type FormState = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  sortOrder: "0",
};

export default function CategoryManager() {
  const { categories, addCategory, updateCategory, deleteCategory, reorderCategories } = useData();
  const { push: toast } = useToast();

  const [editing, setEditing] = useState<KnowledgeCategoryEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugManual, setSlugManual] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Build grouped structure: top-level cats with their direct children
  const topLevelSorted = [...categories]
    .filter((c) => c.parentId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const childrenOf = (parentId: string) =>
    [...categories]
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  function startNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugManual(false);
    setFormError("");
    setPendingDeleteId(null);
  }

  function startEdit(cat: KnowledgeCategoryEntry) {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description ?? "",
      parentId: cat.parentId ?? "",
      sortOrder: String(cat.sortOrder),
    });
    setSlugManual(true);
    setFormError("");
    setPendingDeleteId(null);
  }

  function handleNameChange(v: string) {
    setForm((f) => ({
      ...f,
      name: v,
      slug: slugManual ? f.slug : slugify(v),
    }));
  }

  function requestDelete(cat: KnowledgeCategoryEntry) {
    if (editing?.id === cat.id) startNew();
    setPendingDeleteId(cat.id);
  }

  async function confirmDelete(cat: KnowledgeCategoryEntry) {
    const result = await deleteCategory(cat.id);
    setPendingDeleteId(null);
    if (result.ok) {
      toast("success", `Kategoria „${cat.name}” usunięta.`);
    } else {
      toast("error", result.error);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) { setFormError("Nazwa jest wymagana."); return; }
    if (!form.slug.trim()) { setFormError("Slug jest wymagany."); return; }

    const payload: KnowledgeCategoryEntry = {
      id: editing?.id ?? generateId("cat"),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      parentId: form.parentId || null,
      sortOrder: parseInt(form.sortOrder, 10) || 0,
    };

    try {
      if (editing) {
        await updateCategory(payload);
        toast("success", "Kategoria zaktualizowana.");
      } else {
        await addCategory(payload);
        toast("success", "Kategoria utworzona.");
      }

      setEditing(null);
      setForm(EMPTY_FORM);
      setSlugManual(false);
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się zapisać kategorii bazy wiedzy."
      );
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-[#d1d5db] px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20";

  // Only top-level categories available as parents (to keep tree max 2 levels)
  const topLevelCats = categories.filter((c) => c.parentId === null);

  async function moveTopLevel(idx: number, dir: -1 | 1) {
    const next = [...topLevelSorted];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    await reorderCategories(null, next);
  }

  async function moveSub(parentId: string, subs: KnowledgeCategoryEntry[], idx: number, dir: -1 | 1) {
    const next = [...subs];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    await reorderCategories(parentId, next);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* Category list */}
      <div className="rounded-xl border border-[#dde5ee] bg-white">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4">
          <h2 className="text-sm font-semibold text-[#0f172a]">Kategorie</h2>
        </div>

        {categories.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-[#9ca3af]">
            Brak kategorii. Użyj formularza aby dodać pierwszą.
          </p>
        ) : (
          <div className="divide-y divide-[#f1f5f9]">
            {topLevelSorted.map((cat, catIdx) => {
              const subs = childrenOf(cat.id);
              return (
                <div key={cat.id}>
                  {/* Top-level category row */}
                  <div className="flex items-center justify-between gap-3 bg-[#f8fafc] px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111827]">{cat.name}</p>
                      <p className="truncate font-mono text-[11px] text-[#94a3b8]">{cat.slug}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[10px] font-medium text-[#1d4f91]">
                        główna
                      </span>
                      {/* Reorder arrows */}
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveTopLevel(catIdx, -1)}
                          disabled={catIdx === 0}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Przesuń w górę"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveTopLevel(catIdx, 1)}
                          disabled={catIdx === topLevelSorted.length - 1}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Przesuń w dół"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                      {pendingDeleteId === cat.id ? (
                        <>
                          <span className="text-xs text-[#ef4444]">Usunąć?</span>
                          <button
                            type="button"
                            onClick={() => confirmDelete(cat)}
                            className="text-xs font-semibold text-[#ef4444] hover:underline"
                          >
                            Potwierdź
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="text-xs font-medium text-[#374151] hover:underline"
                          >
                            Anuluj
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(cat)}
                            className="text-xs font-medium text-[#1d4f91] hover:underline"
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDelete(cat)}
                            className="text-xs font-medium text-[#ef4444] hover:underline"
                          >
                            Usuń
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Subcategory rows */}
                  {subs.map((sub, subIdx) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between gap-3 border-t border-[#f1f5f9] py-2.5 pl-10 pr-5"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="shrink-0 text-[#d1d5db]">&#x21B3;</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#374151]">{sub.name}</p>
                          <p className="truncate font-mono text-[11px] text-[#94a3b8]">{sub.slug}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {/* Reorder arrows */}
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => moveSub(cat.id, subs, subIdx, -1)}
                            disabled={subIdx === 0}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Przesuń w górę"
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSub(cat.id, subs, subIdx, 1)}
                            disabled={subIdx === subs.length - 1}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label="Przesuń w dół"
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                        {pendingDeleteId === sub.id ? (
                          <>
                            <span className="text-xs text-[#ef4444]">Usunąć?</span>
                            <button
                              type="button"
                              onClick={() => confirmDelete(sub)}
                              className="text-xs font-semibold text-[#ef4444] hover:underline"
                            >
                              Potwierdź
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteId(null)}
                              className="text-xs font-medium text-[#374151] hover:underline"
                            >
                              Anuluj
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(sub)}
                              className="shrink-0 text-xs font-medium text-[#1d4f91] hover:underline"
                            >
                              Edytuj
                            </button>
                            <button
                              type="button"
                              onClick={() => requestDelete(sub)}
                              className="shrink-0 text-xs font-medium text-[#ef4444] hover:underline"
                            >
                              Usuń
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-[#dde5ee] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-[#0f172a]">
          {editing ? "Edycja kategorii" : "Nowa kategoria"}
        </h2>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">Nazwa *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Nazwa kategorii"
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">Slug *</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => { setForm((f) => ({ ...f, slug: e.target.value })); setSlugManual(true); }}
              placeholder="slug-kategorii"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">
              Kategoria nadrzędna
            </label>
            <select
              value={form.parentId}
              onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
              className={inputCls}
            >
              <option value="">— brak (kategoria główna) —</option>
              {topLevelCats
                .filter((c) => c.id !== editing?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">Opis</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Krótki opis kategorii…"
              rows={3}
              className="w-full resize-y rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151]">Kolejność</label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
              min={0}
              className={inputCls}
            />
          </div>

          {formError && (
            <p role="alert" className="text-xs text-[#ef4444]">
              {formError}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 h-9 rounded-lg bg-[#1d4f91] text-xs font-medium text-white transition hover:bg-[#1a4580]"
            >
              {editing ? "Zapisz zmiany" : "Utwórz kategorię"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={startNew}
                className="h-9 rounded-lg border border-[#d1d5db] px-4 text-xs font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
