import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronRight, Copy, Check, Search } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import type { PhraseEntry } from "@/lib/types/domain";

// ── Copy button with transient ✓ feedback ─────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] active:scale-95 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:bg-[#0f2340]"
      title="Kopiuj tekst"
    >
      {copied ? (
        <>
          <Check size={12} className="text-[#22c55e]" />
          Skopiowano
        </>
      ) : (
        <>
          <Copy size={12} />
          Kopiuj
        </>
      )}
    </button>
  );
}

// ── Single phrase card ─────────────────────────────────────────────────────────
function PhraseCard({ phrase, initialOpen = false }: { phrase: PhraseEntry; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync open state and scroll when deep-link target changes (same-route navigation)
  useEffect(() => {
    setOpen(initialOpen);
    if (initialOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [initialOpen]);

  return (
    <div ref={cardRef} className="overflow-hidden rounded-xl border border-[#dde5ee] bg-white transition-shadow hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-[#f8fafc] dark:hover:bg-[#0f2340]"
      >
        <span className="shrink-0 text-[#94a3b8] transition-transform">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          {phrase.title}
        </span>
      </button>

      {/* Body — shown when expanded */}
      {open && (
        <div className="border-t border-[#f1f5f9] px-5 pb-5 pt-4 dark:border-[#1e293b]">
          {phrase.requiresConfirmation && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-4 py-3 dark:border-[#7f1d1d]/70 dark:bg-[#7f1d1d]/25">
              <span className="mt-px shrink-0 text-base leading-none text-[#dc2626] dark:text-[#f87171]" aria-hidden="true">⚠</span>
              <p className="text-sm font-semibold leading-snug text-[#991b1b] dark:text-[#fca5a5]">
                Klient musi jednoznacznie potwierdzić TAK lub NIE
              </p>
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
            {phrase.content}
          </p>
          <div className="mt-4 flex justify-end">
            <CopyButton text={phrase.content} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ZwrotyPage() {
  const { user } = useAuth();
  const { phrases } = useData();
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("phrase");
  const [query, setQuery] = useState("");

  const sorted = [...phrases].sort((a, b) => a.sortOrder - b.sortOrder);

  const filtered = query.trim()
    ? sorted.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q)
        );
      })
    : sorted;

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-[70rem] pb-10">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Gotowe zwroty
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Kliknij zwrot, aby rozwin&#261;&#263; i skopiowa&#263; tre&#347;&#263;.
            </p>
          </div>
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj zwrotów…"
              className="h-9 w-full rounded-lg border border-[#d1d5db] bg-white pl-8 pr-3 text-sm placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
            />
          </div>
        </div>

        {/* Empty state */}
        {phrases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-16 text-center dark:border-[#334155] dark:bg-[#1a2535]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
              Brak dost&#281;pnych zwrot&#243;w. Administrator mo&#380;e doda&#263; je w panelu administracyjnym.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-12 text-center dark:border-[#334155] dark:bg-[#1a2535]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
              Brak wynik&#243;w dla podanego zapytania.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((phrase) => (
              <PhraseCard key={phrase.id} phrase={phrase} initialOpen={phrase.id === linkedId} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
