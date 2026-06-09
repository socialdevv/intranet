import { useState, Fragment, useEffect } from "react";
import { Link, useParams, Navigate, useLocation } from "react-router-dom";
import { ExternalLink, ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import MatrixLinkedBlock from "@/components/knowledge/matrix-linked-block";
import ArticleMatrixPanel from "@/components/knowledge/article-matrix-panel";
import MatrixPreviewModal from "@/components/knowledge/matrix-preview-modal";
import ArticleSectionSearch from "@/components/knowledge/article-section-search";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { canEditContent } from "@/lib/auth/authorization";
import {
  ROUTES,
  knowledgeCategoryPath,
  adminArticleEditorPath,
} from "@/lib/routes";
import { formatDate } from "@/lib/utils";
import type { MatrixDecision } from "@/lib/types/domain";
import { sectionToTipTapDoc } from "@/lib/knowledge/content-doc";
import {
  buildSectionAnchorId,
  extractSectionAnchorIdFromHash,
  resolveSectionAnchorIdFromHash,
  scrollSectionAnchorIntoView,
} from "@/lib/knowledge/section-anchors";

export default function KnowledgeArticlePage() {
  const { categorySlug, articleSlug } = useParams<{
    categorySlug: string;
    articleSlug: string;
  }>();
  const { user } = useAuth();
  const location = useLocation();
  const { pages, categories, matrix, isLoading } = useData();
  const [modalEntry, setModalEntry] = useState<MatrixDecision | null>(null);

  const page = pages.find(
    (p) => p.category === categorySlug && p.slug === articleSlug
  );
  const category = page ? categories.find((c) => c.id === page.categoryId) : null;
  const parentCategory =
    category?.parentId ? categories.find((c) => c.id === category.parentId) : null;

  if (!isLoading && !page) {
    return <Navigate to={ROUTES.knowledgeBase} replace />;
  }

  const isAdmin = canEditContent(user);

  const linkedMatrixEntry = page?.matrixLinkId
    ? matrix.find((m) => m.id === page.matrixLinkId) ?? null
    : null;

  const globalMatrixEntries: MatrixDecision[] = (page?.globalMatrixLinkIds ?? [])
    .map((id) => matrix.find((m) => m.id === id))
    .filter((m): m is MatrixDecision => Boolean(m));

  const tocItems = page?.sections
    .filter((s) => s.title)
    .map((s) => ({ label: s.title, href: `#${buildSectionAnchorId(s.id)}` }));
  const sectionIds = page?.sections.map((section) => section.id) ?? [];
  const sectionIdsKey = sectionIds.join("|");

  useEffect(() => {
    if (!page) return;
    const extractedAnchorId = extractSectionAnchorIdFromHash(location.hash);
    if (!extractedAnchorId) return;
    const resolvedAnchorId =
      resolveSectionAnchorIdFromHash(location.hash, sectionIds) ?? extractedAnchorId;

    let raf = 0;
    let attempts = 0;
    const maxAttempts = 24;
    const tryScrollToSection = () => {
      const didScrollToResolved = scrollSectionAnchorIntoView(resolvedAnchorId, { behavior: "smooth" });
      const didScrollToExtracted =
        !didScrollToResolved && resolvedAnchorId !== extractedAnchorId
          ? scrollSectionAnchorIntoView(extractedAnchorId, { behavior: "smooth" })
          : false;
      if (!didScrollToResolved && !didScrollToExtracted) {
        attempts += 1;
        if (attempts < maxAttempts) {
          raf = window.requestAnimationFrame(tryScrollToSection);
        }
      }
    };

    raf = window.requestAnimationFrame(tryScrollToSection);
    return () => window.cancelAnimationFrame(raf);
  }, [location.hash, page?.id, sectionIdsKey]);

  const matrixPanelContent =
    globalMatrixEntries.length > 0 ? (
      <ArticleMatrixPanel entries={globalMatrixEntries} onEntryClick={setModalEntry} />
    ) : undefined;

  return (
    <AppShell
      currentUser={user}
      tocItems={tocItems}
      searchPlaceholder="Szukaj w bazie wiedzy…"
      rightPanelExtra={matrixPanelContent}
    >
      {modalEntry && (
        <MatrixPreviewModal entry={modalEntry} onClose={() => setModalEntry(null)} />
      )}
      {isLoading ? (
        <div className="text-sm text-[#9ca3af]">Ładowanie…</div>
      ) : (
        <article className="mx-auto w-full max-w-220 pb-10">
          {/* Breadcrumb */}
          <nav
            className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[#64748b] dark:text-[#94a3b8]"
            aria-label="Nawigacja"
          >
            <Link to={ROUTES.knowledgeBase} className="hover:text-[#1d4f91]">
              Baza wiedzy
            </Link>
            {parentCategory && (
              <>
                <span aria-hidden>›</span>
                <Link
                  to={knowledgeCategoryPath(parentCategory.slug)}
                  className="hover:text-[#1d4f91]"
                >
                  {parentCategory.name}
                </Link>
              </>
            )}
            {category && (
              <>
                <span aria-hidden>›</span>
                <Link
                  to={knowledgeCategoryPath(category.slug)}
                  className="hover:text-[#1d4f91]"
                >
                  {category.name}
                </Link>
              </>
            )}
            <span aria-hidden>›</span>
            <span className="max-w-56 truncate font-medium text-[#0f172a] dark:text-[#e2e8f0]">
              {page?.title}
            </span>
          </nav>

          {/* Header */}
          <header className="mb-6">
            <div className="flex items-start justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
                {page?.title}
              </h1>
              <div className="flex shrink-0 items-center gap-2">
                {page?.externalSourceUrl && (
                  <a
                    href={page.externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Otwórz pełny artykuł w bazie wiedzy"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-white px-3 text-xs font-medium text-[#374151] transition hover:border-[#1d4f91] hover:text-[#1d4f91] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:border-[#60a5fa] dark:hover:text-[#60a5fa]"
                  >
                    <ExternalLink size={12} />
                    Pełna baza wiedzy
                  </a>
                )}
                {isAdmin && page && (
                  <Link
                    to={adminArticleEditorPath(page.id)}
                    className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-white px-3 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:bg-[#263347]"
                  >
                    Edytuj
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              {page?.updatedAt && (
                <span>Zaktualizowano {formatDate(page.updatedAt)}</span>
              )}
            </div>

            {page?.summary && (
              <p className="mt-3 text-sm leading-6 text-[#4b5563] dark:text-[#94a3b8]">{page.summary}</p>
            )}

            {page?.tags && page.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {page.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#475569] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </header>

          <hr className="mb-8 border-[#e5e7eb] dark:border-[#1e293b]" />

          {/* Per-article section search */}
          {page?.sectionSearch && page.sections.length > 0 && (
            <ArticleSectionSearch sections={page.sections} />
          )}

          {/* Matrix integration block */}
          {linkedMatrixEntry && (
            <MatrixLinkedBlock entry={linkedMatrixEntry} />
          )}
          {page?.matrixLinkId && !linkedMatrixEntry && (
            <div className="my-6 rounded-xl border border-[#e5e7eb] bg-[#fafbfc] p-4 text-xs text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
              Powiązanie z macierzą: wpis niedostępny.
            </div>
          )}

          {/* Sections */}
          {page?.sections && page.sections.length > 0 ? (
            page.sections.map((section, idx) => {
              const showSep = section.showSeparator !== false && idx > 0;
              const sectionTags = (section.tags ?? []).filter(Boolean);
              return (
                <Fragment key={section.id}>
                  {showSep && (
                    <hr className="my-6 border-[#e5e7eb] dark:border-[#1e293b]" />
                  )}
                  {section.collapsible ? (
                    <details
                      id={buildSectionAnchorId(section.id)}
                      className="group mb-6 scroll-mt-20 overflow-hidden rounded-xl border border-[#e5e7eb] dark:border-[#1e293b]"
                    >
                      <summary className="flex cursor-pointer select-none list-none items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
                        <ChevronDown
                          size={16}
                          className="shrink-0 text-[#9ca3af] transition-transform duration-200 group-open:rotate-180"
                        />
                        <h2 className="text-xl font-semibold text-[#0f172a] dark:text-[#f1f5f9] sm:text-[22px]">
                          {section.title || "Sekcja"}
                        </h2>
                      </summary>
                      <div className="px-5 pb-5 pt-1">
                        {sectionTags.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {sectionTags.map((tag) => (
                              <span
                                key={`${section.id}-${tag}`}
                                className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#64748b] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8]"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        <TipTapRenderer doc={sectionToTipTapDoc(section)} />
                      </div>
                    </details>
                  ) : (
                    <section
                      id={buildSectionAnchorId(section.id)}
                      className="mb-6 scroll-mt-20"
                    >
                      {section.title && (
                        <h2 className="mb-3 text-xl font-semibold text-[#0f172a] dark:text-[#f1f5f9] sm:text-[22px]">
                          {section.title}
                        </h2>
                      )}
                      {sectionTags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {sectionTags.map((tag) => (
                            <span
                              key={`${section.id}-${tag}`}
                              className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-2.5 py-0.5 text-xs font-medium text-[#64748b] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <TipTapRenderer doc={sectionToTipTapDoc(section)} />
                    </section>
                  )}
                </Fragment>
              );
            })
          ) : (
            <p className="text-sm italic text-[#9ca3af]">
              Ten artykuł nie ma jeszcze treści.
            </p>
          )}
        </article>
      )}
    </AppShell>
  );
}
