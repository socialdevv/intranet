import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { Link } from "react-router-dom";
import { knowledgeCategoryPath } from "@/lib/routes";

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const { categoryTree, isLoading } = useData();

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w bazie wiedzy…">
      <section className="mx-auto w-full max-w-[70rem] pb-8">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
          Baza wiedzy
        </h1>
        <p className="mt-2 text-sm text-[#64748b] dark:text-[#94a3b8]">
          Przeglądaj artykuły i dokumentację operacyjną według kategorii.
        </p>

        {isLoading && (
          <div className="mt-8 text-sm text-[#9ca3af]">Ładowanie…</div>
        )}

        {!isLoading && categoryTree.length === 0 && (
          <div className="mt-8 rounded-xl border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#94a3b8]">
            Brak kategorii. Administrator może dodać treści w panelu administracyjnym.
          </div>
        )}

        {!isLoading && categoryTree.length > 0 && (
          <div className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
            {categoryTree.map((cat) => (
              <Link
                key={cat.id}
                to={knowledgeCategoryPath(cat.slug)}
                className="group rounded-2xl border border-[#dde5ee] bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cfd9e4] hover:shadow-[0_8px_28px_rgba(15,23,42,0.08)] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:shadow-none"
              >
                <h2 className="text-base font-semibold text-[#111827] group-hover:text-[#1d4f91] dark:text-[#e2e8f0] dark:group-hover:text-[#60a5fa]">
                  {cat.name}
                </h2>
                <p className="mt-1 text-sm text-[#6b7280] dark:text-[#94a3b8]">
                  {cat.articles.length}{" "}
                  {cat.articles.length === 1 ? "artykuł" : "artykułów"}
                  {cat.children.length > 0 &&
                    ` · ${cat.children.length} podkategorii`}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
