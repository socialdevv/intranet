import { Link } from "react-router-dom";
import type { CategoryNode } from "@/lib/types/domain";
import { ChevronIcon } from "@/components/layout/category-chevron";
import { knowledgeCategoryPath } from "@/lib/routes";
import { useProjectRouting } from "@/hooks/useProjectRouting";

type SidebarItemProps = {
  node: CategoryNode;
  depth: number;
  isOpen: boolean;
  isActive: boolean;
  hasActiveDescendant: boolean;
  onToggle: (id: string) => void;
  renderChildren: (children: CategoryNode[], depth: number) => React.ReactNode;
  children?: React.ReactNode;
};

export default function SidebarItem({
  node,
  depth,
  isOpen,
  isActive,
  hasActiveDescendant,
  onToggle,
  renderChildren,
  children,
}: SidebarItemProps) {
  const { resolveHref } = useProjectRouting();
  const hasChildren = node.children.length > 0 || Boolean(children);
  const href = resolveHref(knowledgeCategoryPath(node.slug));
  const isRoot = depth === 0;

  const rowShell = isActive
    ? "border-[#c7d5e8] bg-[#e8edf5] text-[#111827] shadow-[inset_0_0_0_1px_rgba(199,213,232,0.6)] dark:border-[#334155] dark:bg-[#1e3a5f] dark:text-[#f1f5f9] dark:shadow-none"
    : hasActiveDescendant
      ? "border-[#e8ecf3] bg-[#f3f6fa] text-[#1f2937] dark:border-[#2d3f55] dark:bg-[#1a2535] dark:text-[#cbd5e1]"
      : "border-transparent bg-transparent text-[#4b5563] hover:border-[#e5e7eb] hover:bg-[#f3f5f8] hover:text-[#111827] dark:text-[#94a3b8] dark:hover:border-[#334155] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]";

  const rowPad = "h-8";

  return (
    <li>
      <div
        className={`flex min-w-0 items-center overflow-hidden rounded-lg border transition-colors duration-200 ease-out ${rowPad} ${rowShell}`}
        style={{ marginLeft: `${depth * 6}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? `Zwiń kategorię ${node.name}` : `Rozwiń kategorię ${node.name}`}
            className={`flex min-w-0 w-full items-center justify-between gap-2 px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#94a3b8] ${
              isRoot ? "font-medium" : ""
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{node.name}</span>
            <span className="inline-flex shrink-0 text-[#6b7280]">
              <ChevronIcon open={isOpen} />
            </span>
          </button>
        ) : (
          <Link
            to={href}
            className={`flex min-w-0 flex-1 items-center px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#94a3b8] ${
              isRoot ? "font-medium" : ""
            }`}
          >
            <span className="truncate">{node.name}</span>
          </Link>
        )}
      </div>

      {hasChildren && (
        <div
          className="grid min-h-0 overflow-hidden transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
        >
          <div className="min-h-0 overflow-hidden pt-1">
            {children}
            {renderChildren(node.children, depth + 1)}
          </div>
        </div>
      )}

      {!hasChildren && children}
    </li>
  );
}
