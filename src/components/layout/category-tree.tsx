import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useData } from "@/contexts/data-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import type { CategoryNode } from "@/lib/types/domain";
import SidebarItem from "@/components/layout/sidebar-item";
import { knowledgeArticlePath, knowledgeCategoryPath, ROUTES } from "@/lib/routes";

function collectOpenIds(
  nodes: CategoryNode[],
  pathname: string,
  resolveHref: (href: string) => string
): Set<string> {
  const open = new Set<string>();

  function walk(node: CategoryNode, parentIds: string[]) {
    const href = resolveHref(knowledgeCategoryPath(node.slug));
    const articlePrefix = resolveHref(`${ROUTES.knowledgeBase}/${node.slug}`);
    const active =
      pathname === href ||
      pathname.startsWith(`${href}/`) ||
      pathname.startsWith(`${articlePrefix}/`);

    if (active) {
      for (const id of parentIds) open.add(id);
      open.add(node.id);
    }

    for (const child of node.children) {
      walk(child, [...parentIds, node.id]);
    }

    for (const article of node.articles) {
      const articleHref = resolveHref(knowledgeArticlePath(article.categorySlug, article.slug));
      const articleActive = pathname === articleHref || pathname.startsWith(`${articleHref}#`);
      if (articleActive) {
        for (const id of parentIds) open.add(id);
        open.add(node.id);
      }
    }
  }

  for (const node of nodes) walk(node, []);
  return open;
}

function hasActiveInBranch(
  node: CategoryNode,
  pathname: string,
  resolveHref: (href: string) => string
): boolean {
  const href = resolveHref(knowledgeCategoryPath(node.slug));
  const articlePrefix = resolveHref(`${ROUTES.knowledgeBase}/${node.slug}`);
  const isSelfActive =
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    pathname.startsWith(`${articlePrefix}/`);
  if (isSelfActive) return true;
  return node.children.some((child) => hasActiveInBranch(child, pathname, resolveHref));
}

function hasActiveArticleInNode(
  node: CategoryNode,
  pathname: string,
  resolveHref: (href: string) => string
) {
  return node.articles.some((article) => {
    const href = resolveHref(knowledgeArticlePath(article.categorySlug, article.slug));
    return pathname === href || pathname.startsWith(`${href}#`);
  });
}

export default function CategoryTree() {
  const { pathname } = useLocation();
  const { categoryTree, isLoading } = useData();
  const { resolveHref } = useProjectRouting();

  const initialOpen = useMemo(
    () => collectOpenIds(categoryTree, pathname, resolveHref),
    [categoryTree, pathname, resolveHref]
  );
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setOpenIds(initialOpen);
  }, [initialOpen]);

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ARTICLE_ACTIVE =
    "border-[#c7d5e8] bg-[#e8edf5] font-medium text-[#111827] shadow-[inset_0_0_0_1px_rgba(199,213,232,0.6)] dark:border-[#334155] dark:bg-[#1e3a5f] dark:text-[#f1f5f9] dark:shadow-none";
  const ARTICLE_INACTIVE =
    "border-transparent bg-transparent text-[#4b5563] hover:border-[#e5e7eb] hover:bg-[#f3f5f8] hover:text-[#111827] dark:text-[#94a3b8] dark:hover:border-[#334155] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]";

  /**
   * Returns the expanded-area content (children prop) for a SidebarItem.
   * When the node has a childOrder, articles and subcategories are interleaved
   * in that unified order. Otherwise falls back to articles-only (subcategories
   * are rendered separately via the renderChildren prop in SidebarItem).
   */
  function buildNodeChildrenContent(node: CategoryNode, depth: number): React.ReactNode {
    const hasMixedOrder = (node.childOrder?.length ?? 0) > 0;

    if (hasMixedOrder) {
      type MixedEntry =
        | { type: "article"; item: (typeof node.articles)[0] }
        | { type: "category"; item: CategoryNode };

      const articleMap = new Map(node.articles.map((a) => [a.id, a]));
      const childMap = new Map(node.children.map((c) => [c.id, c]));
      const seen = new Set<string>();
      const items: MixedEntry[] = [];

      for (const id of node.childOrder!) {
        if (seen.has(id)) continue;
        seen.add(id);
        const a = articleMap.get(id);
        if (a) { items.push({ type: "article", item: a }); continue; }
        const c = childMap.get(id);
        if (c) items.push({ type: "category", item: c });
      }
      // Safety: append items not covered by childOrder
      for (const a of node.articles) {
        if (!seen.has(a.id)) { seen.add(a.id); items.push({ type: "article", item: a }); }
      }
      for (const c of node.children) {
        if (!seen.has(c.id)) { seen.add(c.id); items.push({ type: "category", item: c }); }
      }

      if (items.length === 0) return null;

      const articleIndent = (depth + 1) * 6 + 4;

      return (
        <ul className="mt-1 space-y-1 pb-0.5 pr-1">
          {items.map(({ type, item }) => {
            if (type === "article") {
              const articleHref = resolveHref(knowledgeArticlePath(item.categorySlug, item.slug));
              const isArticleActive =
                pathname === articleHref || pathname.startsWith(`${articleHref}#`);
              return (
                <li key={item.id} style={{ marginLeft: `${articleIndent}px` }}>
                  <Link
                    to={articleHref}
                    className={`flex h-8 min-w-0 items-center overflow-hidden rounded-lg border px-3 text-sm transition-colors ${
                      isArticleActive ? ARTICLE_ACTIVE : ARTICLE_INACTIVE
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              );
            } else {
              const childHref = resolveHref(knowledgeCategoryPath(item.slug));
              const isChildActive =
                pathname === childHref || pathname.startsWith(`${childHref}/`);
              const hasChildActiveDesc =
                item.children.some((gc) => hasActiveInBranch(gc, pathname, resolveHref)) ||
                hasActiveArticleInNode(item, pathname, resolveHref);
              return (
                <SidebarItem
                  key={item.id}
                  node={item}
                  depth={depth + 1}
                  isOpen={openIds.has(item.id)}
                  isActive={isChildActive}
                  hasActiveDescendant={hasChildActiveDesc}
                  onToggle={toggle}
                  renderChildren={(item.childOrder?.length ?? 0) > 0 ? () => null : renderNodes}
                >
                  {buildNodeChildrenContent(item, depth + 1)}
                </SidebarItem>
              );
            }
          })}
        </ul>
      );
    }

    // Default mode: just the articles list.
    // Subcategories are rendered separately by SidebarItem via renderChildren.
    if (node.articles.length === 0) return null;
    return (
      <ul
        className="mt-1 space-y-1 pb-0.5 pr-1"
        style={{ marginLeft: `${depth * 6 + 10}px` }}
      >
        {node.articles.map((article) => {
          const articleHref = knowledgeArticlePath(article.categorySlug, article.slug);
          const isArticleActive =
            pathname === articleHref || pathname.startsWith(`${articleHref}#`);
          return (
            <li key={article.id}>
              <Link
                to={articleHref}
                className={`flex h-8 min-w-0 items-center overflow-hidden rounded-lg border px-3 text-sm transition-colors ${
                  isArticleActive ? ARTICLE_ACTIVE : ARTICLE_INACTIVE
                }`}
              >
                <span className="truncate">{article.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderNodes(nodes: CategoryNode[], depth: number): React.ReactNode {
    return (
      <ul className="space-y-1">
        {nodes.map((node) => {
          const href = resolveHref(knowledgeCategoryPath(node.slug));
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const hasActiveDescendant =
            node.children.some((child) => hasActiveInBranch(child, pathname, resolveHref)) ||
            hasActiveArticleInNode(node, pathname, resolveHref);
          const hasMixedOrder = (node.childOrder?.length ?? 0) > 0;

          return (
            <SidebarItem
              key={node.id}
              node={node}
              depth={depth}
              isOpen={openIds.has(node.id)}
              isActive={isActive}
              hasActiveDescendant={hasActiveDescendant}
              onToggle={toggle}
              renderChildren={hasMixedOrder ? () => null : renderNodes}
            >
              {buildNodeChildrenContent(node, depth)}
            </SidebarItem>
          );
        })}
      </ul>
    );
  }

  if (isLoading) {
    return <p className="px-3 py-2 text-xs text-[#9ca3af]">Ładowanie…</p>;
  }

  if (categoryTree.length === 0) {
    return <p className="px-3 py-2 text-xs text-[#9ca3af]">Brak kategorii.</p>;
  }

  return <div className="mt-2">{renderNodes(categoryTree, 0)}</div>;
}
