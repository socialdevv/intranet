import { Link, useParams, Navigate } from "react-router-dom";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { canEditContent } from "@/lib/auth/authorization";
import {
  ROUTES,
  knowledgeArticlePath,
  knowledgeCategoryPath,
  adminArticleEditorPath,
} from "@/lib/routes";

export default function KnowledgeCategoryPage() {
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const { user } = useAuth();
  const { categories, pages, isLoading } = useData();

  const category = categories.find((c) => c.slug === categorySlug);
  const parentCategory = category?.parentId
    ? categories.find((c) => c.id === category.parentId)
    : null;
  const subCategories = categories
    .filter((c) => c.parentId === category?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const categoryPages = pages
    .filter((p) => p.categoryId === category?.id)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  if (!isLoading && !category) {
    return <Navigate to={ROUTES.knowledgeBase} replace />;
  }

  const isAdmin = canEditContent(user);

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w bazie wiedzy…">
      <section className="mx-auto w-full max-w-280 pb-10">
        {/* Breadcrumb */}
        <nav
          className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-[#64748b]"
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
          <span aria-hidden>›</span>
          <span className="font-medium text-[#0f172a] dark:text-[#e2e8f0]">{category?.name ?? "…"}</span>
        </nav>

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              {isLoading ? "…" : (category?.name ?? "")}
            </h1>
            {category?.description && (
              <p className="mt-1.5 text-sm text-[#64748b] dark:text-[#94a3b8]">{category.description}</p>
            )}
          </div>

          {isAdmin && !isLoading && category && (
            <Link
              to={`${adminArticleEditorPath("nowy")}?categoryId=${category.id}`}
              className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 text-sm font-medium text-white transition hover:bg-[#1a4580]"
            >
              + Nowy artykuł
            </Link>
          )}
        </div>

        {isLoading && (
          <div className="mt-10 text-sm text-[#9ca3af]">Ładowanie…</div>
        )}

        {!isLoading && (
          <>
            {/* Subcategories */}
            {subCategories.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Podkategorie
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {subCategories.map((sub) => (
                    <Link
                      key={sub.id}
                      to={knowledgeCategoryPath(sub.slug)}
                      className="group rounded-xl border border-[#dde5ee] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#cfd9e4] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a]"
                    >
                        <p className="text-sm font-semibold text-[#111827] group-hover:text-[#1d4f91] dark:text-[#e2e8f0] dark:group-hover:text-[#60a5fa]">
                          {sub.name}
                        </p>
                      {sub.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[#6b7280] dark:text-[#94a3b8]">
                          {sub.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Articles */}
            <div className="mt-8">
              {subCategories.length > 0 && (
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
                  Artykuły
                </h2>
              )}

              {categoryPages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#d1d5db] bg-white p-8 text-center text-sm text-[#6b7280] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#94a3b8]">
                  {isAdmin
                    ? 'Brak artykułów. Kliknij "+ Nowy artykuł", aby dodać pierwszy.'
                    : "Brak artykułów w tej kategorii."}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {categoryPages.map((page) => (
                    <Link
                      key={page.id}
                      to={knowledgeArticlePath(page.category, page.slug)}
                      className="group flex flex-col rounded-xl border border-[#dde5ee] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#cfd9e4] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a]"
                    >
                        <p className="text-sm font-semibold text-[#111827] group-hover:text-[#1d4f91] dark:text-[#e2e8f0] dark:group-hover:text-[#60a5fa]">
                          {page.title}
                        </p>
                      {page.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#6b7280] dark:text-[#94a3b8]">{page.summary}</p>
                      )}
                      {page.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {page.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-medium text-[#475569] dark:bg-[#1e293b] dark:text-[#94a3b8]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </AppShell>
  );
}
