import { useMemo, useState } from "react";
import type { ReactNode, CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Clock, GitBranch, Info, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { normalizeMediaSrc } from "@/lib/media/assets";
import { buildSectionAnchorId, resolveSectionAnchorId } from "@/lib/knowledge/section-anchors";
import { knowledgeArticlePath, knowledgeCategoryPath, ROUTES, komunikatPath } from "@/lib/routes";
import MatrixPreviewModal from "@/components/knowledge/matrix-preview-modal";
import TemplatePreviewModal from "@/components/templates/template-preview-modal";

// ── TipTap JSON node types ────────────────────────────────────────────────────

type TipTapNode = {
  type: string;
  text?: string;
  content?: TipTapNode[];
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
};

type InternalLinkAttrs = {
  entityType?: "category" | "subcategory" | "article";
  entityId?: string | null;
  sectionId?: string | null;
  hrefSnapshot?: string | null;
};

type InternalLinkResolution = {
  href: string | null;
  missing: boolean;
};

type InternalLinkResolver = (attrs?: Record<string, unknown>) => InternalLinkResolution;

// ── Inline renderer ───────────────────────────────────────────────────────────

function renderInline(nodes: TipTapNode[], resolveInternalLink: InternalLinkResolver): ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    if (node.type !== "text") {
      // Nested inline (e.g. mention nodes)
      return <span key={i}>{renderInline(node.content ?? [], resolveInternalLink)}</span>;
    }

    let content: ReactNode = node.text ?? "";
    if (!node.marks?.length) return <span key={i}>{content}</span>;

    for (const mark of node.marks) {
      switch (mark.type) {
        case "bold":
          content = <strong>{content}</strong>;
          break;
        case "italic":
          content = <em>{content}</em>;
          break;
        case "underline":
          content = <u>{content}</u>;
          break;
        case "strike":
          content = <s>{content}</s>;
          break;
        case "code":
          content = (
            <code className="rounded bg-[#f1f5f9] px-1 py-0.5 font-mono text-[0.85em] text-[#1e293b]">
              {content}
            </code>
          );
          break;
        case "link":
          content = (
            <a
              href={mark.attrs?.href as string}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1d4f91] underline underline-offset-2 hover:text-[#1a4580]"
            >
              {content}
            </a>
          );
          break;
        case "internalLink": {
          const resolution = resolveInternalLink(mark.attrs);
          if (!resolution.href) {
            content = (
              <span className="text-[#64748b] underline decoration-dotted underline-offset-2">
                {content}
              </span>
            );
            break;
          }
          content = (
            <Link
              to={resolution.href}
              className={resolution.missing
                ? "text-[#64748b] underline decoration-dotted underline-offset-2"
                : "text-[#1d4f91] underline underline-offset-2 hover:text-[#1a4580]"}
            >
              {content}
            </Link>
          );
          break;
        }
        case "textStyle": {
          const color = mark.attrs?.color as string | undefined;
          const fontSize = mark.attrs?.fontSize as string | undefined;
          if (color || fontSize) {
            const style: CSSProperties = {};
            if (color) style.color = color;
            if (fontSize) style.fontSize = fontSize;
            content = <span style={style}>{content}</span>;
          }
          break;
        }
        case "noCopyInline":
          content = (
            <span data-no-copy="true" className="no-copy-inline">
              {content}
            </span>
          );
          break;
      }
    }
    return <span key={i}>{content}</span>;
  });
}

// ── Block renderer ────────────────────────────────────────────────────────────

function renderNode(
  node: TipTapNode,
  key: string | number,
  resolveInternalLink: InternalLinkResolver
): ReactNode {
  switch (node.type) {
    case "doc": {
      // Group consecutive sectionLink nodes so they render side-by-side in a
      // flex-wrap row rather than stacking as individual full-width blocks.
      const docContent = node.content ?? [];
      const elements: ReactNode[] = [];
      let slGroup: TipTapNode[] = [];
      let k = 0;

      const flushGroup = () => {
        if (!slGroup.length) return;
        const group = slGroup;
        slGroup = [];
        elements.push(
          <div key={`slg-${k++}`} className="my-3 flex flex-wrap gap-3">
            {group.map((n, gi) => {
              const sla = (n.attrs ?? {}) as {
                linkType?: "url" | "article" | "category" | "subcategory" | "komunikat" | "template";
                label?: string;
                url?: string | null;
                articleId?: string | null;
                articleSlug?: string | null;
                articleCategorySlug?: string | null;
                articleSectionId?: string | null;
                articleSectionTitle?: string | null;
                categoryId?: string | null;
                categorySlug?: string | null;
                komunikatId?: string | null;
                templateId?: string | null;
                templateChannel?: string | null;
              };
              return <SectionLinkBlock key={gi} {...sla} />;
            })}
          </div>
        );
      };

      for (const n of docContent) {
        if (n.type === "sectionLink") {
          slGroup.push(n);
        } else {
          flushGroup();
          elements.push(renderNode(n, k++, resolveInternalLink));
        }
      }
      flushGroup();

      return <>{elements}</>;
    }

    case "paragraph": {
      const align = node.attrs?.textAlign as string | undefined;
      const style = align && align !== "left" ? { textAlign: align as "left" | "center" | "right" } : undefined;
      if (!node.content?.length) {
        return <p key={key} className="min-h-[1.5em] select-none" aria-hidden="true" style={style} />;
      }
      return (
        <p key={key} className="mb-4 leading-7 text-[#374151]" style={style}>
          {renderInline(node.content, resolveInternalLink)}
        </p>
      );
    }

    case "heading": {
      const level = (node.attrs?.level as number) ?? 2;
      const align = node.attrs?.textAlign as string | undefined;
      const style = align && align !== "left" ? { textAlign: align as "left" | "center" | "right" } : undefined;
      const classMap: Record<number, string> = {
        1: "mt-6 mb-3 text-2xl font-bold text-[#0f172a]",
        2: "mt-6 mb-3 text-xl font-semibold text-[#0f172a]",
        3: "mt-5 mb-2 text-lg font-semibold text-[#1e293b]",
        4: "mt-4 mb-2 text-base font-semibold text-[#1e293b]",
      };
      const cls = classMap[level] ?? "mt-4 mb-2 font-semibold text-[#0f172a]";
      if (level === 1) return <h3 key={key} className={cls} style={style}>{renderInline(node.content ?? [], resolveInternalLink)}</h3>;
      if (level === 2) return <h4 key={key} className={cls} style={style}>{renderInline(node.content ?? [], resolveInternalLink)}</h4>;
      if (level === 3) return <h5 key={key} className={cls} style={style}>{renderInline(node.content ?? [], resolveInternalLink)}</h5>;
      return <h6 key={key} className={cls} style={style}>{renderInline(node.content ?? [], resolveInternalLink)}</h6>;
    }

    case "bulletList":
      return (
        <ul key={key} className="tiptap-bullet-list mb-5 ml-10 list-disc space-y-1.5">
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </ul>
      );

    case "orderedList": {
      const listStart = node.attrs?.start as number | undefined;
      const listType = node.attrs?.listType as string | undefined;
      const listStyle = listType && listType !== "decimal" ? { listStyleType: listType } : undefined;
      return (
        <ol
          key={key}
          className="mb-5 ml-10 list-decimal space-y-1.5"
          style={listStyle}
          start={listStart != null && listStart !== 1 ? listStart : undefined}
        >
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </ol>
      );
    }

    case "listItem":
      return (
        <li key={key} className="leading-7 text-[#374151]">
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </li>
      );

    case "blockquote":
      return (
        <blockquote
          key={key}
          className="mb-4 border-l-4 border-[#1d4f91] pl-4 text-[#4b5563] italic"
        >
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </blockquote>
      );

    case "codeBlock": {
      const code = (node.content ?? []).map((n) => n.text ?? "").join("");
      return (
        <pre
          key={key}
          className="mb-4 overflow-x-auto rounded-lg bg-[#f1f5f9] px-4 py-3 text-sm font-mono text-[#1e293b]"
        >
          <code>{code}</code>
        </pre>
      );
    }

    case "horizontalRule":
      return <hr key={key} className="my-6 border-[#e5e7eb]" />;

    case "hardBreak":
      return <br key={key} />;

    case "table": {
      const rows = node.content ?? [];
      const firstRow = rows[0];
      const hasHeaderRow = firstRow?.content?.some((c) => c.type === "tableHeader");
      if (hasHeaderRow) {
        return (
          <div key={key} className="mb-4 overflow-hidden rounded-lg border border-[#e5e7eb]">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-[#f8fafc]">{renderNode(rows[0], 0, resolveInternalLink)}</thead>
              {rows.length > 1 && (
                <tbody>{rows.slice(1).map((n, i) => renderNode(n, i + 1, resolveInternalLink))}</tbody>
              )}
            </table>
          </div>
        );
      }
      return (
        <div key={key} className="mb-4 overflow-hidden rounded-lg border border-[#e5e7eb]">
          <table className="w-full table-fixed border-collapse text-sm">
            <tbody>{rows.map((n, i) => renderNode(n, i, resolveInternalLink))}</tbody>
          </table>
        </div>
      );
    }

    case "tableRow":
      return (
        <tr key={key}>
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </tr>
      );

    case "tableCell":
      return (
        <td key={key} className="wrap-break-word border border-[#d1d5db] px-4 py-2.5 text-[#374151] align-top">
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </td>
      );

    case "tableHeader":
      return (
        <th
          key={key}
          className="wrap-break-word border border-[#d1d5db] bg-[#f8fafc] px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#475569]"
        >
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </th>
      );

    case "sectionLink": {
      const sla = (node.attrs ?? {}) as {
        linkType?: "url" | "article" | "category" | "subcategory" | "komunikat" | "template";
        label?: string;
        url?: string | null;
        articleId?: string | null;
        articleSlug?: string | null;
        articleCategorySlug?: string | null;
        articleSectionId?: string | null;
        articleSectionTitle?: string | null;
        categoryId?: string | null;
        categorySlug?: string | null;
        komunikatId?: string | null;
        templateId?: string | null;
        templateChannel?: string | null;
      };
      return <SectionLinkBlock key={key} {...sla} />;
    }

    case "matrixLink": {
      const attrs = (node.attrs ?? {}) as {
        entryTitle?: string;
        entryCategory?: string;
        entryDepartment?: string;
        entrySla?: number;
        entryId?: string;
      };
      return <MatrixLinkBlock key={key} {...attrs} />;
    }

    case "videoBlock": {
      const { src, width, align } = (node.attrs ?? {}) as {
        src?: string;
        width?: string;
        align?: "left" | "center" | "right";
      };
      const resolvedSrc = normalizeMediaSrc(src ?? "");
      if (!resolvedSrc) return null;
      const marginClass =
        align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
      return (
        <div key={key} className="my-4">
          <video
            src={resolvedSrc}
            controls
            style={{ width: width ?? "100%" }}
            className={`${marginClass} block rounded-lg border border-[#e5e7eb]`}
          />
        </div>
      );
    }

    case "imageBlock": {
      const { src, alt, width, align } = (node.attrs ?? {}) as {
        src?: string;
        alt?: string;
        width?: string;
        align?: "left" | "center" | "right";
      };
      const resolvedSrc = normalizeMediaSrc(src ?? "");
      if (!resolvedSrc) return null;
      const marginClass =
        align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
      return (
        <div key={key} className="my-4">
          <img
            src={resolvedSrc}
            alt={alt ?? ""}
            style={{ width: width ?? "100%" }}
            className={`${marginClass} block rounded-lg border border-[#e5e7eb] object-contain`}
          />
        </div>
      );
    }

    case "imageSideBySide": {
      const { src, alt, layout, imageWidth } = (node.attrs ?? {}) as {
        src?: string;
        alt?: string;
        layout?: "image-left" | "image-right";
        imageWidth?: string;
      };
      const resolvedSrc = normalizeMediaSrc(src ?? "");
      const isImageLeft = (layout ?? "image-left") === "image-left";
      const wrapW = imageWidth ?? "50%";
      const imageEl = resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt ?? ""}
          className="block w-full rounded-lg border border-[#e5e7eb] object-contain"
        />
      ) : null;
      return (
        <div key={key} className="my-4 flex items-start gap-6">
          {isImageLeft ? (
            <>
              {imageEl && <div style={{ width: wrapW, flexShrink: 0 }}>{imageEl}</div>}
              <div className="min-w-0 flex-1">
                {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
              </div>
            </>
          ) : (
            <>
              <div className="min-w-0 flex-1">
                {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
              </div>
              {imageEl && <div style={{ width: wrapW, flexShrink: 0 }}>{imageEl}</div>}
            </>
          )}
        </div>
      );
    }

    case "collapsibleBlock": {
      const cbTitle = (node.attrs?.title as string) ?? "";
      return (
        <CollapsibleBlockDisplay key={key} title={cbTitle}>
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </CollapsibleBlockDisplay>
      );
    }

    case "calloutBlock": {
      const variant = (node.attrs?.variant as string) ?? "info";
      return (
        <CalloutBlockDisplay key={key} variant={variant}>
          {(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}
        </CalloutBlockDisplay>
      );
    }

    default:
      // Unknown node — try to render children gracefully
      if (node.content?.length) {
        return <div key={key}>{(node.content ?? []).map((n, i) => renderNode(n, i, resolveInternalLink))}</div>;
      }
      return null;
  }
}

// ── Callout block ────────────────────────────────────────────────────────────

const CALLOUT_VARIANT_CONFIG: Record<
  string,
  { border: string; bgClass: string; iconClass: string; Icon: LucideIcon }
> = {
  info:     { border: "#2563eb", bgClass: "bg-[#dbeafe] dark:bg-[#1e3a5f]/50",   iconClass: "text-[#1d4ed8] dark:text-[#93c5fd]",  Icon: Info },
  warning:  { border: "#d97706", bgClass: "bg-[#fef3c7] dark:bg-[#78350f]/50",   iconClass: "text-[#92400e] dark:text-[#fcd34d]",  Icon: AlertTriangle },
  critical: { border: "#dc2626", bgClass: "bg-[#fee2e2] dark:bg-[#7f1d1d]/50",   iconClass: "text-[#991b1b] dark:text-[#fca5a5]",  Icon: XCircle },
  success:  { border: "#16a34a", bgClass: "bg-[#dcfce7] dark:bg-[#14532d]/50",   iconClass: "text-[#166534] dark:text-[#86efac]",  Icon: CheckCircle2 },
};

function CalloutBlockDisplay({
  variant,
  children,
}: {
  variant: string;
  children: React.ReactNode;
}) {
  const cfg = CALLOUT_VARIANT_CONFIG[variant] ?? CALLOUT_VARIANT_CONFIG.info;
  const IconComp = cfg.Icon;
  return (
    <div
      className={`my-3 flex gap-3 rounded-xl py-3 pl-4 pr-5 ${cfg.bgClass} [&_p]:dark:text-[#cbd5e1] [&_li]:dark:text-[#cbd5e1] [&_strong]:dark:text-[#e2e8f0] [&_h3]:dark:text-[#f1f5f9] [&_h4]:dark:text-[#f1f5f9] [&_h5]:dark:text-[#f1f5f9]`}
      style={{
        borderLeft: `5px solid ${cfg.border}`,
        boxShadow: `inset 0 0 0 1px ${cfg.border}22`,
      }}
    >
      <IconComp
        size={17}
        className={`mt-0.5 shrink-0 ${cfg.iconClass}`}
      />
      <div className="min-w-0 flex-1 [&>*:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}

// ── Collapsible block ────────────────────────────────────────────────────────

function CollapsibleBlockDisplay({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-[#d1d5db] bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-[#f8fafc]"
      >
        <ChevronDown
          size={15}
          className={`shrink-0 text-[#6b7280] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
        <span className="flex-1 text-sm font-semibold text-[#0f172a]">
          {title || "Sekcja rozwijana"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[#e5e7eb] px-4 py-3">{children}</div>
      )}
    </div>
  );
}

// ── SectionLink block ─────────────────────────────────────────────────────────

function SectionLinkBlock({
  linkType,
  label,
  url,
  articleId,
  articleSlug,
  articleCategorySlug,
  articleSectionId,
  articleSectionTitle,
  categoryId,
  categorySlug,
  komunikatId,
  templateId,
  templateChannel,
}: {
  linkType?: "url" | "article" | "category" | "subcategory" | "komunikat" | "template";
  label?: string;
  url?: string | null;
  articleId?: string | null;
  articleSlug?: string | null;
  articleCategorySlug?: string | null;
  articleSectionId?: string | null;
  articleSectionTitle?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  komunikatId?: string | null;
  templateId?: string | null;
  templateChannel?: string | null;
}) {
  const { pages: pagesFromData, categories: categoriesFromData } = useData();
  const pages = pagesFromData ?? [];
  const categories = categoriesFromData ?? [];
  const displayLabel = label || "Link";
  const resolvedArticle = articleId ? pages.find((p) => p.id === articleId) ?? null : null;
  const resolvedArticleSectionRef =
    resolvedArticle && articleSectionId
      ? resolveSectionAnchorId(
          articleSectionId,
          resolvedArticle.sections.map((section) => section.id),
        )
      : null;
  const resolvedArticleSection =
    resolvedArticle && resolvedArticleSectionRef?.sectionId
      ? resolvedArticle.sections.find(
          (section) => section.id === resolvedArticleSectionRef.sectionId,
        ) ?? null
      : null;
  const hasResolvedSection = Boolean(resolvedArticleSection);
  const articleAnchor = articleSectionId
    ? resolvedArticleSectionRef?.anchorId ?? buildSectionAnchorId(articleSectionId)
    : null;
  const resolvedArticlePath = resolvedArticle
    ? `${knowledgeArticlePath(resolvedArticle.category, resolvedArticle.slug)}${articleAnchor ? `#${articleAnchor}` : ""}`
    : articleCategorySlug && articleSlug
    ? `${knowledgeArticlePath(articleCategorySlug, articleSlug)}${articleAnchor ? `#${articleAnchor}` : ""}`
    : null;
  const resolvedSectionTitle = (
    resolvedArticleSection?.title || articleSectionTitle || ""
  ).trim();
  const articleLabel =
    resolvedSectionTitle
      ? `${resolvedArticle?.title || displayLabel} - ${resolvedSectionTitle}`
      : resolvedArticle?.title || displayLabel;

  const resolvedCategory = categoryId ? categories.find((cat) => cat.id === categoryId) ?? null : null;
  const resolvedCategorySlug = resolvedCategory?.slug ?? categorySlug ?? articleCategorySlug ?? null;
  const resolvedCategoryPath = resolvedCategorySlug
    ? knowledgeCategoryPath(resolvedCategorySlug)
    : null;
  const categoryLabel = resolvedCategory?.name || displayLabel;

  const cardBase =
    "inline-flex w-fit min-w-[160px] max-w-sm items-start gap-3 rounded-xl border px-3.5 py-2.5 transition hover:shadow-sm";

  // ── Article ────────────────────────────────────────────────────────────────
  if (linkType === "article" && resolvedArticlePath) {
    return (
      <Link
        to={resolvedArticlePath}
        className={`${cardBase} border-[#bbf7d0] bg-[#f0fdf4] hover:border-[#4ade80] dark:border-[#14532d]/60 dark:bg-[#052e16]/40 dark:hover:border-[#4ade80]/50`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#bbf7d0] bg-white/80 dark:border-[#14532d]/60 dark:bg-[#052e16]">
          <svg className="size-4 text-[#16a34a] dark:text-[#4ade80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#15803d] opacity-70 dark:text-[#4ade80]">
            {articleSectionId ? "Sekcja artykułu" : "Artykuł"}
          </span>
          <span className="block text-sm font-semibold leading-snug text-[#14532d] dark:text-[#86efac]">{articleLabel}</span>
          {articleSectionId && !hasResolvedSection && (
            <span className="block text-[10px] text-[#166534]/70 dark:text-[#4ade80]/70">
              Sekcja nie została znaleziona, link otworzy artykuł.
            </span>
          )}
        </span>
        <svg className="size-3.5 shrink-0 text-[#16a34a]/60 dark:text-[#4ade80]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  // ── Category / Subcategory ───────────────────────────────────────────────
  if (linkType === "category" || linkType === "subcategory") {
    const isSubcategory = linkType === "subcategory";
    const borderCls = isSubcategory
      ? "border-[#c7d2fe] bg-[#eef2ff] hover:border-[#818cf8] dark:border-[#312e81]/60 dark:bg-[#1e1b4b]/40 dark:hover:border-[#818cf8]/50"
      : "border-[#bae6fd] bg-[#f0f9ff] hover:border-[#38bdf8] dark:border-[#0c4a6e]/60 dark:bg-[#082f49]/40 dark:hover:border-[#38bdf8]/50";
    const iconBorderCls = isSubcategory
      ? "border-[#c7d2fe] dark:border-[#312e81]/60"
      : "border-[#bae6fd] dark:border-[#0c4a6e]/60";
    const iconTextCls = isSubcategory
      ? "text-[#4338ca] dark:text-[#818cf8]"
      : "text-[#0369a1] dark:text-[#38bdf8]";
    const tagTextCls = isSubcategory
      ? "text-[#4338ca] dark:text-[#818cf8]"
      : "text-[#0369a1] dark:text-[#38bdf8]";
    const labelTextCls = isSubcategory
      ? "text-[#312e81] dark:text-[#c7d2fe]"
      : "text-[#0c4a6e] dark:text-[#bae6fd]";

    return (
      <Link
        to={resolvedCategoryPath ?? ROUTES.knowledgeBase}
        className={`${cardBase} ${borderCls}`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-[#0f172a] border ${iconBorderCls}`}>
          <svg className={`size-4 ${iconTextCls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-[10px] font-semibold uppercase tracking-widest opacity-70 ${tagTextCls}`}>
            {isSubcategory ? "Podkategoria" : "Kategoria"}
          </span>
          <span className={`block text-sm font-semibold leading-snug ${labelTextCls}`}>{categoryLabel}</span>
        </span>
        <svg className={`size-3.5 shrink-0 opacity-60 ${iconTextCls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  // ── Template ──────────────────────────────────────────────────────────────
  if (linkType === "template") {
    return <TemplateBlockCard templateId={templateId} templateChannel={templateChannel} label={displayLabel} />;
  }

  // ── Komunikat ──────────────────────────────────────────────────────────────
  if (linkType === "komunikat") {
    const to = komunikatId ? komunikatPath(komunikatId) : ROUTES.komunikaty;
    return (
      <Link
        to={to}
        className={`${cardBase} border-[#fde68a] bg-[#fffbeb] hover:border-[#f59e0b] dark:border-[#78350f]/60 dark:bg-[#1c0900]/40 dark:hover:border-[#f59e0b]/50`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#fde68a] bg-white/80 dark:border-[#78350f]/60 dark:bg-[#1c0900]">
          <svg className="size-4 text-[#92400e] dark:text-[#fbbf24]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#92400e] opacity-70 dark:text-[#fbbf24]">Komunikat</span>
          <span className="block text-sm font-semibold leading-snug text-[#78350f] dark:text-[#fcd34d]">{displayLabel}</span>
        </span>
        <svg className="size-3.5 shrink-0 text-[#92400e]/60 dark:text-[#fbbf24]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    );
  }

  // ── External URL ───────────────────────────────────────────────────────────
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${cardBase} border-[#bfdbfe] bg-[#eff6ff] hover:border-[#60a5fa] dark:border-[#1e3a5f] dark:bg-[#0f2340] dark:hover:border-[#2563eb]/60`}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#bfdbfe] bg-white/80 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <svg className="size-4 text-[#1d4f91] dark:text-[#60a5fa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#1d4f91] opacity-70 dark:text-[#60a5fa]">Zewnętrzny link</span>
        <span className="block text-sm font-semibold leading-snug text-[#1e3a8a] dark:text-[#93c5fd]">{displayLabel}</span>
      </span>
      <svg className="size-3.5 shrink-0 text-[#1d4f91]/60 dark:text-[#60a5fa]/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </a>
  );
}

// ── TemplateBlockCard (stateful — looks up template + opens modal) ─────────

function TemplateBlockCard({
  templateId,
  templateChannel,
  label,
}: {
  templateId?: string | null;
  templateChannel?: string | null;
  label: string;
}) {
  const { templates: templatesFromData } = useData();
  const templates = templatesFromData ?? [];
  const [modalOpen, setModalOpen] = useState(false);
  const found = templateId ? templates.find((t) => t.id === templateId) ?? null : null;

  return (
    <>
      <button
        type="button"
        onClick={() => found && setModalOpen(true)}
        disabled={!found}
        title={found ? "Kliknij, aby zobaczyć szablon" : undefined}
        className={
          "inline-flex w-fit min-w-40 max-w-sm items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition " +
          (found
            ? "cursor-pointer border-[#e9d5ff] bg-[#faf5ff] hover:border-[#c084fc] hover:shadow-sm dark:border-[#581c87]/50 dark:bg-[#2d1b4e]/40 dark:hover:border-[#a855f7]/50"
            : "cursor-default border-[#e9d5ff] bg-[#faf5ff] opacity-60 dark:border-[#581c87]/50 dark:bg-[#2d1b4e]/40")
        }
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e9d5ff] bg-white/80 dark:border-[#581c87]/50 dark:bg-[#1a0d33]">
          <svg className="size-4 text-[#7c3aed] dark:text-[#a78bfa]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-[#7c3aed] opacity-70 dark:text-[#a78bfa]">Szablon</span>
          <span className="block text-sm font-semibold leading-snug text-[#4c1d95] dark:text-[#c4b5fd]">{label}</span>
          {templateChannel && (
            <span className="block truncate text-[10px] text-[#7c3aed]/60 dark:text-[#a78bfa]/60">{templateChannel}</span>
          )}
        </span>
        {found && (
          <svg className="size-3.5 shrink-0 text-[#7c3aed]/40 dark:text-[#a78bfa]/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
      {modalOpen && found && (
        <TemplatePreviewModal template={found} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ── MatrixLink block (stateful — needs modal + data lookup) ──────────────────

interface MatrixLinkBlockProps {
  entryId?: string;
  entryTitle?: string;
  entryCategory?: string;
  entrySla?: number;
}

function MatrixLinkBlock({ entryId, entryTitle, entryCategory, entrySla }: MatrixLinkBlockProps) {
  const { matrix: matrixFromData } = useData();
  const matrix = matrixFromData ?? [];
  const [modalOpen, setModalOpen] = useState(false);
  const fullEntry = entryId ? matrix.find((e) => e.id === entryId) ?? null : null;

  const displaySubcategory = entryTitle ?? "Pozycja macierzy";

  return (
    <>
      <button
        type="button"
        onClick={() => fullEntry && setModalOpen(true)}
        className="my-3 inline-flex w-full max-w-95 items-start gap-3 rounded-xl border border-[#c3d6ea] bg-[#eff6ff]/60 px-3 py-2.5 text-left transition hover:border-[#1d4f91]/50 hover:bg-[#eff6ff] hover:shadow-sm disabled:cursor-default dark:border-[#1e3a5f] dark:bg-[#0f2340]/60 dark:hover:border-[#2563eb]/60 dark:hover:bg-[#0f2340]"
        disabled={!fullEntry}
        title={fullEntry ? "Kliknij, aby zobaczyć szczegóły" : undefined}
      >
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1d4f91]/10 text-[#1d4f91] dark:bg-[#60a5fa]/20 dark:text-[#60a5fa]">
          <GitBranch size={13} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1d4f91]/70 dark:text-[#60a5fa]/70">
            {entryCategory ?? "Powiązanie z macierzą"}
          </p>
          <p className="text-xs font-semibold leading-snug text-[#0f172a] dark:text-[#e2e8f0]">
            {displaySubcategory}
          </p>
          {(fullEntry?.defaultDepartment || (entrySla !== null && entrySla !== undefined)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {fullEntry?.defaultDepartment && (
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                  {fullEntry.defaultDepartment}
                </span>
              )}
              {entrySla !== null && entrySla !== undefined && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1d4f91] dark:text-[#60a5fa]">
                  <Clock size={10} />
                  Czas realizacji: {String(entrySla)} dni
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {modalOpen && fullEntry && (
        <MatrixPreviewModal entry={fullEntry} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

type Props = { doc: unknown };

export default function TipTapRenderer({ doc }: Props) {
  const { categories: categoriesFromData, pages: pagesFromData } = useData();
  const categories = categoriesFromData ?? [];
  const pages = pagesFromData ?? [];

  const categoryById = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories]);
  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);

  const resolveInternalLink: InternalLinkResolver = (rawAttrs) => {
    const attrs = (rawAttrs ?? {}) as InternalLinkAttrs;
    const entityId = attrs.entityId ?? null;
    const snapshot = attrs.hrefSnapshot;

    if (attrs.entityType === "article" && entityId) {
      const page = pageById.get(entityId);
      if (page) {
        const sectionId = attrs.sectionId ?? null;
        const sectionResolution = sectionId
          ? resolveSectionAnchorId(
              sectionId,
              page.sections.map((section) => section.id),
            )
          : null;
        const sectionExists = sectionId ? Boolean(sectionResolution?.sectionId) : true;
        const anchor = sectionId
          ? sectionResolution?.anchorId ?? buildSectionAnchorId(sectionId)
          : null;
        return {
          href: `${knowledgeArticlePath(page.category, page.slug)}${anchor ? `#${anchor}` : ""}`,
          missing: !sectionExists,
        };
      }
    }

    if ((attrs.entityType === "category" || attrs.entityType === "subcategory") && entityId) {
      const category = categoryById.get(entityId);
      if (category) {
        return {
          href: knowledgeCategoryPath(category.slug),
          missing: false,
        };
      }
    }

    if (typeof snapshot === "string" && snapshot.startsWith("/")) {
      return {
        href: snapshot,
        missing: true,
      };
    }

    return {
      href: null,
      missing: true,
    };
  };

  if (!doc || typeof doc !== "object") {
    return <p className="text-sm italic text-[#9ca3af]">Brak treści.</p>;
  }
  return (
    <div className="tiptap-prose [&>*:last-child]:mb-0">
      {renderNode(doc as TipTapNode, 0, resolveInternalLink)}
    </div>
  );
}
