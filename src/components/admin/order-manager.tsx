import { useMemo, useState, type DragEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FolderPlus,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { useDragSort } from "@/hooks/useDragSort";
import {
  adminArticleEditorPath,
  knowledgeArticlePath,
  knowledgeCategoryPath,
} from "@/lib/routes";
import type { KnowledgeCategoryEntry, KnowledgePage } from "@/lib/types/domain";
import { generateId, slugify } from "@/lib/utils";

type FormState = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
  sortOrder: string;
};

type MixedHierarchyItem =
  | {
      id: string;
      type: "article";
      page: KnowledgePage;
    }
  | {
      id: string;
      type: "category";
      category: KnowledgeCategoryEntry;
    };

type DragBinding = {
  idx: number;
  isOver: boolean;
  onDragStart: (idx: number) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, idx: number) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, idx: number) => void;
  onDragEnd: () => void;
};

type CategoryRowProps = {
  category: KnowledgeCategoryEntry;
  depth: number;
  categories: KnowledgeCategoryEntry[];
  pages: KnowledgePage[];
  openIds: Set<string>;
  toggleOpen: (id: string) => void;
  openBranch: (categoryId: string) => void;
  startCreateSubcategory: (parent: KnowledgeCategoryEntry) => void;
  startEditCategory: (category: KnowledgeCategoryEntry) => void;
  pendingDeleteCategoryId: string | null;
  clearPendingDeleteCategory: () => void;
  requestDeleteCategory: (category: KnowledgeCategoryEntry) => void;
  confirmDeleteCategory: (category: KnowledgeCategoryEntry) => Promise<void>;
  pendingDeleteArticleId: string | null;
  clearPendingDeleteArticle: () => void;
  requestDeleteArticle: (page: KnowledgePage) => void;
  confirmDeleteArticle: (page: KnowledgePage) => Promise<void>;
  reorderPages: (categoryId: string, orderedItems: KnowledgePage[]) => void | Promise<void>;
  reorderCategories: (
    parentId: string | null,
    orderedItems: KnowledgeCategoryEntry[]
  ) => void | Promise<void>;
  reorderCategoryChildren: (categoryId: string, orderedIds: string[]) => void | Promise<void>;
  dragBinding?: DragBinding;
};

const EMPTY_FORM: FormState = {
  name: "",
  slug: "",
  description: "",
  parentId: "",
  sortOrder: "0",
};

function buildOrderedChildren(
  category: KnowledgeCategoryEntry,
  categories: KnowledgeCategoryEntry[],
  pages: KnowledgePage[]
): MixedHierarchyItem[] {
  const directCategories = [...categories]
    .filter((entry) => entry.parentId === category.id)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const directPages = [...pages]
    .filter((entry) => entry.categoryId === category.id)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const seenIds = new Set<string>();
  const ordered: MixedHierarchyItem[] = [];

  for (const childId of category.childOrder ?? []) {
    if (seenIds.has(childId)) {
      continue;
    }

    const page = directPages.find((entry) => entry.id === childId);
    if (page) {
      seenIds.add(childId);
      ordered.push({ id: page.id, type: "article", page });
      continue;
    }

    const subcategory = directCategories.find((entry) => entry.id === childId);
    if (subcategory) {
      seenIds.add(childId);
      ordered.push({ id: subcategory.id, type: "category", category: subcategory });
    }
  }

  for (const subcategory of directCategories) {
    if (!seenIds.has(subcategory.id)) {
      seenIds.add(subcategory.id);
      ordered.push({ id: subcategory.id, type: "category", category: subcategory });
    }
  }

  for (const page of directPages) {
    if (!seenIds.has(page.id)) {
      seenIds.add(page.id);
      ordered.push({ id: page.id, type: "article", page });
    }
  }

  return ordered;
}

function ArticleRow({
  page,
  pendingDeleteArticleId,
  clearPendingDeleteArticle,
  requestDeleteArticle,
  confirmDeleteArticle,
  dragBinding,
}: {
  page: KnowledgePage;
  pendingDeleteArticleId: string | null;
  clearPendingDeleteArticle: () => void;
  requestDeleteArticle: (page: KnowledgePage) => void;
  confirmDeleteArticle: (page: KnowledgePage) => Promise<void>;
  dragBinding: DragBinding;
}) {
  return (
    <div
      draggable
      onDragStart={() => dragBinding.onDragStart(dragBinding.idx)}
      onDragOver={(event) => dragBinding.onDragOver(event, dragBinding.idx)}
      onDrop={(event) => dragBinding.onDrop(event, dragBinding.idx)}
      onDragEnd={dragBinding.onDragEnd}
      className={[
        "flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors cursor-grab active:cursor-grabbing",
        dragBinding.isOver
          ? "border-[#1d4f91] bg-[#e8edf5] dark:border-[#31598b] dark:bg-[#12253e]"
          : "border-[#e5e7eb] bg-white hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#0f172a] dark:hover:bg-[#132033]",
      ].join(" ")}
    >
      <GripVertical size={14} className="mt-0.5 shrink-0 text-[#94a3b8]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5b7fb0] dark:border-[#334155] dark:bg-[#111827] dark:text-[#93c5fd]">
            Artykuł
          </span>
          <p className="truncate font-medium text-[#0f172a] dark:text-[#f1f5f9]">{page.title}</p>
        </div>
        <p className="mt-1 truncate font-mono text-[11px] text-[#94a3b8]">{page.slug}</p>
        {page.summary ? (
          <p className="mt-1 line-clamp-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
            {page.summary}
          </p>
        ) : null}
      </div>
      {pendingDeleteArticleId === page.id ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-[#ef4444] dark:text-[#fca5a5]">Usunąć?</span>
          <button
            type="button"
            onClick={() => void confirmDeleteArticle(page)}
            className="rounded-lg bg-[#ef4444] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#dc2626]"
          >
            Potwierdź
          </button>
          <button
            type="button"
            onClick={clearPendingDeleteArticle}
            className="rounded-lg border border-[#d1d5db] px-2.5 py-1 text-xs text-[#64748b] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Anuluj
          </button>
        </div>
      ) : (
        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
          <Link
            to={knowledgeArticlePath(page.category, page.slug)}
            className="inline-flex items-center gap-1 text-[#64748b] transition hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#93c5fd]"
          >
            <Eye size={13} />
            Podgląd
          </Link>
          <Link
            to={adminArticleEditorPath(page.id)}
            className="inline-flex items-center gap-1 text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
          >
            <Pencil size={13} />
            Edytuj
          </Link>
          <button
            type="button"
            onClick={() => requestDeleteArticle(page)}
            className="inline-flex items-center gap-1 text-[#ef4444] transition hover:text-[#dc2626] dark:text-[#fca5a5] dark:hover:text-[#f87171]"
          >
            <Trash2 size={13} />
            Usuń
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  category,
  depth,
  categories,
  pages,
  openIds,
  toggleOpen,
  openBranch,
  startCreateSubcategory,
  startEditCategory,
  pendingDeleteCategoryId,
  clearPendingDeleteCategory,
  requestDeleteCategory,
  confirmDeleteCategory,
  pendingDeleteArticleId,
  clearPendingDeleteArticle,
  requestDeleteArticle,
  confirmDeleteArticle,
  reorderPages,
  reorderCategories,
  reorderCategoryChildren,
  dragBinding,
}: CategoryRowProps) {
  const orderedChildren = useMemo(
    () => buildOrderedChildren(category, categories, pages),
    [category, categories, pages]
  );
  const directSubcategories = useMemo(
    () => categories.filter((entry) => entry.parentId === category.id).sort((left, right) => left.sortOrder - right.sortOrder),
    [categories, category.id]
  );
  const directPages = useMemo(
    () => pages.filter((entry) => entry.categoryId === category.id).sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
    [pages, category.id]
  );
  const isOpen = openIds.has(category.id);
  const hasChildren = orderedChildren.length > 0;
  const canAddSubcategory = depth === 0;

  const mixedDrag = useDragSort<MixedHierarchyItem>(orderedChildren, async (reordered) => {
    await reorderCategoryChildren(
      category.id,
      reordered.map((item) => item.id)
    );

    const reorderedCategories = reordered
      .filter((item): item is Extract<MixedHierarchyItem, { type: "category" }> => item.type === "category")
      .map((item) => item.category);
    if (reorderedCategories.length > 0) {
      await reorderCategories(category.id, reorderedCategories);
    }

    const reorderedPages = reordered
      .filter((item): item is Extract<MixedHierarchyItem, { type: "article" }> => item.type === "article")
      .map((item) => item.page);
    if (reorderedPages.length > 0) {
      await reorderPages(category.id, reorderedPages);
    }
  });

  return (
    <div className="space-y-2">
      <div
        draggable={Boolean(dragBinding)}
        onDragStart={dragBinding ? () => dragBinding.onDragStart(dragBinding.idx) : undefined}
        onDragOver={dragBinding ? (event) => dragBinding.onDragOver(event, dragBinding.idx) : undefined}
        onDrop={dragBinding ? (event) => dragBinding.onDrop(event, dragBinding.idx) : undefined}
        onDragEnd={dragBinding?.onDragEnd}
        className={[
          "flex items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
          dragBinding ? "cursor-grab active:cursor-grabbing" : "",
          dragBinding?.isOver
            ? "border-[#1d4f91] bg-[#e8edf5] dark:border-[#31598b] dark:bg-[#12253e]"
            : "border-[#dbe4f0] bg-white hover:bg-[#f8fbff] dark:border-[#223147] dark:bg-[#0f172a] dark:hover:bg-[#132136]",
        ].join(" ")}
      >
        <GripVertical size={14} className="mt-0.5 shrink-0 text-[#94a3b8]" />
        <button
          type="button"
          onClick={() => toggleOpen(category.id)}
          className="mt-0.5 shrink-0 text-[#64748b] transition hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#93c5fd]"
          aria-label={isOpen ? "Zwiń kategorię" : "Rozwiń kategorię"}
        >
          {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-[#0f172a] dark:text-[#f1f5f9]">{category.name}</p>
            <span className="truncate rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2 py-0.5 font-mono text-[10px] text-[#5f6f86] dark:border-[#334155] dark:bg-[#111827] dark:text-[#9fb3cc]">
              {category.slug}
            </span>
            {depth === 0 ? (
              <span className="rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[10px] font-medium text-[#1d4f91] dark:bg-[#17304f] dark:text-[#93c5fd]">
                główna
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
            {directSubcategories.length} {directSubcategories.length === 1 ? "podkategoria" : "podkategorii"} • {directPages.length} {directPages.length === 1 ? "artykuł" : "artykułów"}
          </p>
          {category.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-[#64748b] dark:text-[#94a3b8]">
              {category.description}
            </p>
          ) : null}
        </div>
        {pendingDeleteCategoryId === category.id ? (
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <span className="text-[#ef4444] dark:text-[#fca5a5]">Usunąć?</span>
            <button
              type="button"
              onClick={() => void confirmDeleteCategory(category)}
              className="rounded-lg bg-[#ef4444] px-2.5 py-1 font-medium text-white transition hover:bg-[#dc2626]"
            >
              Potwierdź
            </button>
            <button
              type="button"
              onClick={clearPendingDeleteCategory}
              className="rounded-lg border border-[#d1d5db] px-2.5 py-1 text-[#64748b] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
            >
              Anuluj
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
            <Link
              to={`${adminArticleEditorPath("nowy")}?categoryId=${category.id}`}
              className="inline-flex items-center gap-1 text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
            >
              <Plus size={13} />
              Nowy artykuł
            </Link>
            {canAddSubcategory ? (
              <button
                type="button"
                onClick={() => {
                  openBranch(category.id);
                  startCreateSubcategory(category);
                }}
                className="inline-flex items-center gap-1 text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
              >
                <FolderPlus size={13} />
                Podkategoria
              </button>
            ) : null}
            <Link
              to={knowledgeCategoryPath(category.slug)}
              className="inline-flex items-center gap-1 text-[#64748b] transition hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#93c5fd]"
            >
              <Eye size={13} />
              Podgląd
            </Link>
            <button
              type="button"
              onClick={() => {
                openBranch(category.id);
                startEditCategory(category);
              }}
              className="inline-flex items-center gap-1 text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
            >
              <Pencil size={13} />
              Edytuj
            </button>
            <button
              type="button"
              onClick={() => requestDeleteCategory(category)}
              className="inline-flex items-center gap-1 text-[#ef4444] transition hover:text-[#dc2626] dark:text-[#fca5a5] dark:hover:text-[#f87171]"
            >
              <Trash2 size={13} />
              Usuń
            </button>
          </div>
        )}
      </div>

      {isOpen ? (
        <div className="ml-7 border-l border-[#dbe4f0] pl-4 dark:border-[#223147]">
          {hasChildren ? (
            <div className="space-y-2">
              {orderedChildren.map((item, idx) => {
                const childDragBinding: DragBinding = {
                  idx,
                  isOver: mixedDrag.overIdx === idx,
                  onDragStart: mixedDrag.onDragStart,
                  onDragOver: mixedDrag.onDragOver,
                  onDrop: mixedDrag.onDrop,
                  onDragEnd: mixedDrag.onDragEnd,
                };

                return item.type === "article" ? (
                  <ArticleRow
                    key={item.page.id}
                    page={item.page}
                    pendingDeleteArticleId={pendingDeleteArticleId}
                    clearPendingDeleteArticle={clearPendingDeleteArticle}
                    requestDeleteArticle={requestDeleteArticle}
                    confirmDeleteArticle={confirmDeleteArticle}
                    dragBinding={childDragBinding}
                  />
                ) : (
                  <CategoryRow
                    key={item.category.id}
                    category={item.category}
                    depth={depth + 1}
                    categories={categories}
                    pages={pages}
                    openIds={openIds}
                    toggleOpen={toggleOpen}
                    openBranch={openBranch}
                    startCreateSubcategory={startCreateSubcategory}
                    startEditCategory={startEditCategory}
                    pendingDeleteCategoryId={pendingDeleteCategoryId}
                    clearPendingDeleteCategory={clearPendingDeleteCategory}
                    requestDeleteCategory={requestDeleteCategory}
                    confirmDeleteCategory={confirmDeleteCategory}
                    pendingDeleteArticleId={pendingDeleteArticleId}
                    clearPendingDeleteArticle={clearPendingDeleteArticle}
                    requestDeleteArticle={requestDeleteArticle}
                    confirmDeleteArticle={confirmDeleteArticle}
                    reorderPages={reorderPages}
                    reorderCategories={reorderCategories}
                    reorderCategoryChildren={reorderCategoryChildren}
                    dragBinding={childDragBinding}
                  />
                );
              })}
            </div>
          ) : (
            <p className="py-1 text-xs text-[#94a3b8]">
              Brak bezpośrednich elementów. Dodaj artykuł lub podkategorię z poziomu tego wiersza.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function OrderManager() {
  const {
    categories,
    pages,
    addCategory,
    updateCategory,
    deleteCategory,
    deletePage,
    reorderCategories,
    reorderPages,
    reorderCategoryChildren,
  } = useData();
  const { push: toast } = useToast();

  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingCategory, setEditingCategory] = useState<KnowledgeCategoryEntry | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugManual, setSlugManual] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [pendingDeleteArticleId, setPendingDeleteArticleId] = useState<string | null>(null);

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const topLevel = useMemo(
    () => [...categories].filter((category) => category.parentId === null).sort((left, right) => left.sortOrder - right.sortOrder),
    [categories]
  );
  const topLevelOptions = useMemo(
    () => [...topLevel].filter((category) => category.id !== editingCategory?.id),
    [editingCategory?.id, topLevel]
  );

  const topLevelDrag = useDragSort<KnowledgeCategoryEntry>(
    topLevel,
    (reordered) => reorderCategories(null, reordered)
  );

  function toggleOpen(id: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openBranch(categoryId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      let cursor = categoriesById.get(categoryId) ?? null;
      while (cursor) {
        next.add(cursor.id);
        cursor = cursor.parentId ? categoriesById.get(cursor.parentId) ?? null : null;
      }
      return next;
    });
  }

  function resetForm(nextForm: Partial<FormState> = {}) {
    setEditingCategory(null);
    setForm({ ...EMPTY_FORM, ...nextForm });
    setSlugManual(false);
    setFormError("");
  }

  function startCreateRootCategory() {
    resetForm({ sortOrder: String(topLevel.length) });
  }

  function startCreateSubcategory(parent: KnowledgeCategoryEntry) {
    const siblingCount = categories.filter((category) => category.parentId === parent.id).length;
    resetForm({
      parentId: parent.id,
      sortOrder: String(siblingCount),
    });
  }

  function startEditCategory(category: KnowledgeCategoryEntry) {
    setEditingCategory(category);
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
      sortOrder: String(category.sortOrder),
    });
    setSlugManual(true);
    setFormError("");
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      slug: slugManual ? current.slug : slugify(value),
    }));
  }

  function requestDeleteCategory(category: KnowledgeCategoryEntry) {
    if (editingCategory?.id === category.id) {
      resetForm();
    }
    setPendingDeleteCategoryId(category.id);
  }

  async function confirmDeleteCategory(category: KnowledgeCategoryEntry) {
    const result = await deleteCategory(category.id);
    setPendingDeleteCategoryId(null);

    if (result.ok) {
      toast("success", `Kategoria „${category.name}” usunięta.`);
      return;
    }

    toast("error", result.error);
  }

  function requestDeleteArticle(page: KnowledgePage) {
    setPendingDeleteArticleId(page.id);
  }

  async function confirmDeleteArticle(page: KnowledgePage) {
    try {
      await deletePage(page.id);
      setPendingDeleteArticleId(null);
      toast("success", `Artykuł „${page.title}” usunięty.`);
    } catch (caught) {
      toast(
        "error",
        caught instanceof Error
          ? caught.message
          : "Nie udało się usunąć artykułu bazy wiedzy."
      );
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError("Nazwa jest wymagana.");
      return;
    }

    if (!form.slug.trim()) {
      setFormError("Slug jest wymagany.");
      return;
    }

    const payload: KnowledgeCategoryEntry = {
      id: editingCategory?.id ?? generateId("cat"),
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim() || undefined,
      parentId: form.parentId || null,
      sortOrder: Number.parseInt(form.sortOrder, 10) || 0,
      childOrder: editingCategory?.childOrder ?? [],
    };

    try {
      if (editingCategory) {
        await updateCategory(payload);
        toast("success", "Kategoria zaktualizowana.");
        openBranch(payload.id);
      } else {
        const created = await addCategory(payload);
        toast("success", "Kategoria utworzona.");
        openBranch(created.parentId ?? created.id);
      }

      resetForm();
    } catch (caught) {
      setFormError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się zapisać kategorii bazy wiedzy."
      );
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_360px]">
      <section className="rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-sm dark:border-[#223147] dark:bg-[#111827]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Struktura i kolejność bazy wiedzy
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[#64748b] dark:text-[#94a3b8]">
              To jest główny widok zarządzania strukturą. Gałęzie startują zwinięte, a kolejność kategorii,
              podkategorii i artykułów jest aktualizowana bezpośrednio w tej samej hierarchii.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={adminArticleEditorPath("nowy")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#374151] transition hover:bg-[#f8fafc] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#e2e8f0] dark:hover:bg-[#132033]"
            >
              <Plus size={14} />
              Nowy artykuł
            </Link>
            <button
              type="button"
              onClick={startCreateRootCategory}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 text-sm font-medium text-white transition hover:bg-[#1a4580]"
            >
              <FolderPlus size={14} />
              Nowa kategoria
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#5f6f86] dark:text-[#9fb3cc]">
          <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Kategorie: {categories.length}
          </span>
          <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Artykuły: {pages.length}
          </span>
          <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Jedna hierarchia zarządzania
          </span>
          <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Drzewo startuje zwinięte
          </span>
        </div>

        <div className="mt-5 space-y-3">
          {topLevel.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] px-5 py-10 text-center dark:border-[#334155] dark:bg-[#0f172a]">
              <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
                Brak kategorii. Utwórz pierwszą kategorię, aby zacząć budować strukturę wiedzy.
              </p>
            </div>
          ) : (
            topLevel.map((category, idx) => (
              <CategoryRow
                key={category.id}
                category={category}
                depth={0}
                categories={categories}
                pages={pages}
                openIds={openIds}
                toggleOpen={toggleOpen}
                openBranch={openBranch}
                startCreateSubcategory={startCreateSubcategory}
                startEditCategory={startEditCategory}
                pendingDeleteCategoryId={pendingDeleteCategoryId}
                clearPendingDeleteCategory={() => setPendingDeleteCategoryId(null)}
                requestDeleteCategory={requestDeleteCategory}
                confirmDeleteCategory={confirmDeleteCategory}
                pendingDeleteArticleId={pendingDeleteArticleId}
                clearPendingDeleteArticle={() => setPendingDeleteArticleId(null)}
                requestDeleteArticle={requestDeleteArticle}
                confirmDeleteArticle={confirmDeleteArticle}
                reorderPages={reorderPages}
                reorderCategories={reorderCategories}
                reorderCategoryChildren={reorderCategoryChildren}
                dragBinding={{
                  idx,
                  isOver: topLevelDrag.overIdx === idx,
                  onDragStart: topLevelDrag.onDragStart,
                  onDragOver: topLevelDrag.onDragOver,
                  onDrop: topLevelDrag.onDrop,
                  onDragEnd: topLevelDrag.onDragEnd,
                }}
              />
            ))
          )}
        </div>
      </section>

      <aside className="rounded-2xl border border-[#dbe4f0] bg-white p-5 shadow-sm dark:border-[#223147] dark:bg-[#111827]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              {editingCategory ? "Edycja kategorii" : "Nowa kategoria"}
            </h3>
            <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              Formularz jest kontekstowy dla drzewa, żeby nie utrzymywać osobnej listy kategorii.
            </p>
          </div>
          {(editingCategory || form.name || form.slug || form.description || form.parentId) ? (
            <button
              type="button"
              onClick={() => resetForm()}
              className="text-xs font-medium text-[#64748b] transition hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#93c5fd]"
            >
              Wyczyść
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
              Nazwa *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleNameChange(event.target.value)}
              placeholder="Nazwa kategorii"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
              Slug *
            </label>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => {
                setForm((current) => ({ ...current, slug: event.target.value }));
                setSlugManual(true);
              }}
              placeholder="slug-kategorii"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
              Kategoria nadrzędna
            </label>
            <select
              value={form.parentId}
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
              className={inputClass}
            >
              <option value="">— brak (kategoria główna) —</option>
              {topLevelOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
              Opis
            </label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Krótki opis kategorii…"
              rows={3}
              className="w-full resize-y rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]">
              Kolejność
            </label>
            <input
              type="number"
              value={form.sortOrder}
              onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
              min={0}
              className={inputClass}
            />
          </div>

          {formError ? (
            <p role="alert" className="text-xs text-[#ef4444] dark:text-[#fca5a5]">
              {formError}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 h-9 rounded-lg bg-[#1d4f91] text-xs font-medium text-white transition hover:bg-[#1a4580]"
            >
              {editingCategory ? "Zapisz zmiany" : "Utwórz kategorię"}
            </button>
            {editingCategory ? (
              <button
                type="button"
                onClick={() => resetForm()}
                className="h-9 rounded-lg border border-[#d1d5db] px-4 text-xs font-medium text-[#374151] transition hover:bg-[#f9fafb] dark:border-[#334155] dark:text-[#e2e8f0] dark:hover:bg-[#132033]"
              >
                Anuluj
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-5 rounded-xl border border-[#e2e8f0] bg-[#f8fbff] px-4 py-3 text-xs leading-relaxed text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
          Rozwijana hierarchia jest teraz głównym miejscem pracy nad strukturą. Akcje podglądu, edycji i usuwania artykułów są dostępne bezpośrednio na wierszach drzewa, a przeciąganie nadal utrzymuje wspólny porządek artykułów i podkategorii.
        </div>
      </aside>
    </div>
  );
}