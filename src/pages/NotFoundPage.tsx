import { Link } from "react-router-dom";
import { ROUTES } from "@/lib/routes";

export default function NotFoundPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9fb] px-4">
      <div className="text-center">
        <p className="text-5xl font-bold text-[#d1d5db]">404</p>
        <h1 className="mt-4 text-xl font-semibold text-[#111827]">Strona nie istnieje</h1>
        <p className="mt-2 text-sm text-[#6b7280]">
          Sprawdź adres URL lub wróć na stronę główną.
        </p>
        <Link
          to={ROUTES.home}
          className="mt-6 inline-flex items-center rounded-lg bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580]"
        >
          Wróć na pulpit
        </Link>
      </div>
    </main>
  );
}
