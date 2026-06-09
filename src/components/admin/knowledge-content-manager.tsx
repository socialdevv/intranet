import OrderManager from "@/components/admin/order-manager";
import { useData } from "@/contexts/data-context";

export default function KnowledgeContentManager() {
  const { categories, pages } = useData();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#dbe4f0] bg-linear-to-br from-[#f8fbff] via-white to-[#f5f8fc] p-5 shadow-sm dark:border-[#223147] dark:bg-linear-to-br dark:from-[#0f172a] dark:via-[#111827] dark:to-[#10223d]">
        <h2 className="text-base font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          Baza wiedzy
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-[#5f6f86] dark:text-[#9fb3cc]">
          Hierarchia kategorii jest teraz głównym miejscem pracy nad strukturą wiedzy. Rozwijaj tylko
          te gałęzie, nad którymi pracujesz, i zarządzaj kolejnością oraz akcjami artykułów bez
          przechodzenia do osobnych list.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-[#5f6f86] dark:text-[#9fb3cc]">
          <span className="rounded-full border border-[#dbe4f0] bg-white px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Kategorie: {categories.length}
          </span>
          <span className="rounded-full border border-[#dbe4f0] bg-white px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Artykuły: {pages.length}
          </span>
          <span className="rounded-full border border-[#dbe4f0] bg-white px-3 py-1 dark:border-[#334155] dark:bg-[#0f172a]">
            Jedna hierarchia zamiast osobnych list kategorii, artykułów i kolejności
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-sm dark:border-[#1f2937] dark:bg-[#111827]">
        <OrderManager />
      </section>
    </div>
  );
}