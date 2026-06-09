import type { KnowledgeCategoryEntry, KnowledgePage } from "@/lib/types/domain";

export type EditorCategoryOption = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
};

export type EditorPageOption = {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryId?: string;
  categoryDisplayName?: string;
  sections?: Array<{ id: string; title: string }>;
};

export function buildEditorCategoryOptions(
  categories: KnowledgeCategoryEntry[]
): EditorCategoryOption[] {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
  }));
}

export function buildEditorPageOptions(
  pages: KnowledgePage[],
  categories: KnowledgeCategoryEntry[]
): EditorPageOption[] {
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  return pages.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    category: page.category,
    categoryId: page.categoryId,
    categoryDisplayName: categoryNameById.get(page.categoryId),
    sections: (page.sections ?? []).map((section) => ({
      id: section.id,
      title: section.title,
    })),
  }));
}
