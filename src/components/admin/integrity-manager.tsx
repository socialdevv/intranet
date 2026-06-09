import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { useData } from "@/contexts/data-context";
import {
  runIntegrityChecks,
  type IntegrityFinding,
  type IntegritySeverity,
} from "@/lib/integrity/checks";

const SEVERITY_LABEL: Record<IntegritySeverity, string> = {
  error: "Błędy",
  warning: "Ostrzeżenia",
  info: "Info",
};

const SEVERITY_ICON: Record<IntegritySeverity, ReactNode> = {
  error: <AlertCircle size={14} className="text-[#dc2626] dark:text-[#f87171]" />,
  warning: <AlertTriangle size={14} className="text-[#d97706] dark:text-[#f59e0b]" />,
  info: <Info size={14} className="text-[#2563eb] dark:text-[#60a5fa]" />,
};

const SEVERITY_CONTAINER: Record<IntegritySeverity, string> = {
  error:
    "border-[#fecaca] bg-[#fff5f5] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808]",
  warning:
    "border-[#fed7aa] bg-[#fffaf3] dark:border-[#7c2d12]/50 dark:bg-[#1a0a00]",
  info:
    "border-[#bfdbfe] bg-[#f7fbff] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340]",
};

export default function IntegrityManager() {
  const { data } = useData();
  const report = useMemo(() => runIntegrityChecks(data), [data]);
  const [severityFilter, setSeverityFilter] = useState<IntegritySeverity | "all">("all");

  const filteredFindings = useMemo(() => {
    if (severityFilter === "all") return report.findings;
    return report.findings.filter((finding) => finding.severity === severityFilter);
  }, [report.findings, severityFilter]);

  function severityCount(level: IntegritySeverity): number {
    if (level === "error") return report.summary.errors;
    if (level === "warning") return report.summary.warnings;
    return report.summary.info;
  }

  const checkedAt = new Date(report.generatedAt).toLocaleString("pl-PL");

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_330px]">
      <div className="space-y-4">
        <section className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                Diagnostyka integralności treści, mediów i konfiguracji
              </h2>
              <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                Zestaw lekkich, nieblokujących kontroli wykrywających typowe problemy po edycjach,
                migracjach i imporcie danych, w tym podejrzane odwołania do plików i mediów.
              </p>
            </div>
            <span className="rounded-full border border-[#dbe5f0] bg-[#f8fbff] px-3 py-1 text-[11px] font-semibold text-[#4b6280] dark:border-[#1f334d] dark:bg-[#0b1a2c] dark:text-[#9fb3cc]">
              Ostatnie sprawdzenie: {checkedAt}
            </span>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setSeverityFilter("all")}
              className={[
                "rounded-lg border px-3 py-2 text-left transition",
                severityFilter === "all"
                  ? "border-[#1d4f91] bg-[#eef5ff] dark:border-[#2563eb] dark:bg-[#0f2340]"
                  : "border-[#e5e7eb] bg-[#fafbfc] hover:bg-[#f5f7fa] dark:border-[#1e293b] dark:bg-[#0f172a] dark:hover:bg-[#111b2e]",
              ].join(" ")}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Wszystkie
              </p>
              <p className="text-base font-bold text-[#0f172a] dark:text-[#f1f5f9]">{report.summary.total}</p>
            </button>

            {(["error", "warning", "info"] as IntegritySeverity[]).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setSeverityFilter(level)}
                className={[
                  "rounded-lg border px-3 py-2 text-left transition",
                  severityFilter === level
                    ? "border-[#1d4f91] bg-[#eef5ff] dark:border-[#2563eb] dark:bg-[#0f2340]"
                    : "border-[#e5e7eb] bg-[#fafbfc] hover:bg-[#f5f7fa] dark:border-[#1e293b] dark:bg-[#0f172a] dark:hover:bg-[#111b2e]",
                ].join(" ")}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                  {SEVERITY_LABEL[level]}
                </p>
                <p className="text-base font-bold text-[#0f172a] dark:text-[#f1f5f9]">{severityCount(level)}</p>
              </button>
            ))}
          </div>
        </section>

        {filteredFindings.length === 0 ? (
          <div className="rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-5 dark:border-[#14532d]/50 dark:bg-[#0a1f0a]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#16a34a] dark:text-[#4ade80]" />
              <p className="text-sm font-semibold text-[#166534] dark:text-[#4ade80]">
                Brak wykrytych problemów dla bieżącego filtra.
              </p>
            </div>
            <p className="mt-1 text-xs text-[#166534] dark:text-[#86efac]">
              To nie zastępuje testów biznesowych, ale oznacza brak typowych problemów referencyjnych w danych.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </div>

      <aside className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck size={15} className="text-[#64748b] dark:text-[#94a3b8]" />
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Jak czytać wyniki
          </h3>
        </div>

        <div className="space-y-2.5 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
          <p>
            Błąd: duże prawdopodobieństwo realnie uszkodzonego odwołania (np. link wewnętrzny do
            usuniętego zasobu).
          </p>
          <p>
            Ostrzeżenie: konfiguracja lub referencja, która zwykle powoduje mylące zachowanie,
            ale nie blokuje działania aplikacji.
          </p>
          <p>
            Info: stan potencjalnie intencjonalny, jednak wart świadomej decyzji podczas utrzymania
            wielu wdrożeń.
          </p>
          <p>
            Diagnostyka jest nieinwazyjna: nie modyfikuje danych i nie blokuje edycji, służy tylko
            do szybkiego wykrywania problemów.
          </p>
        </div>
      </aside>
    </div>
  );
}

function FindingCard({ finding }: { finding: IntegrityFinding }) {
  return (
    <article
      className={[
        "rounded-xl border p-4",
        SEVERITY_CONTAINER[finding.severity],
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{SEVERITY_ICON[finding.severity]}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              {finding.title}
            </h4>
            <span className="rounded-full border border-[#d4dbe6] bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#475569] dark:border-[#2b3a54] dark:bg-[#0f172a]/60 dark:text-[#93a4bc]">
              {finding.code}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[#334155] dark:text-[#cbd5e1]">
            {finding.description}
          </p>
          {finding.location ? (
            <p className="mt-1 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              Lokalizacja: {finding.location}
            </p>
          ) : null}
          {finding.suggestion ? (
            <p className="mt-1 text-[11px] text-[#1d4f91] dark:text-[#93c5fd]">
              Sugestia: {finding.suggestion}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
