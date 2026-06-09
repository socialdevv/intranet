import { useCallback } from "react";
import {
  UserCheck,
  X,
  RotateCcw,
  ChevronDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  ClipboardCopy,
} from "lucide-react";
import { useLeadWidget, type ConsentType } from "@/contexts/lead-widget-context";
import { useData } from "@/contexts/data-context";
import type { LeadRule } from "@/lib/types/lead";

// ── Helpers ───────────────────────────────────────────────────────────────────

function outcomeIcon(rule: LeadRule) {
  if (rule.blocksLead || rule.outcome === "not_allowed") {
    return <XCircle size={16} className="shrink-0 text-red-500" />;
  }
  if (rule.outcome === "allowed") {
    return <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />;
  }
  if (rule.outcome === "conditional") {
    return <AlertCircle size={16} className="shrink-0 text-amber-500" />;
  }
  return <Info size={16} className="shrink-0 text-sky-500" />;
}

function outcomeBannerCls(rule: LeadRule): string {
  if (rule.blocksLead || rule.outcome === "not_allowed") {
    return "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800/40 dark:text-red-300";
  }
  if (rule.outcome === "allowed") {
    return "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800/40 dark:text-emerald-300";
  }
  if (rule.outcome === "conditional") {
    return "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800/40 dark:text-amber-300";
  }
  return "bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-900/20 dark:border-sky-800/40 dark:text-sky-300";
}

function CopyButton({ text }: { text: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).catch(() => {
      /* ignore clipboard errors */
    });
  }, [text]);

  return (
    <button
      type="button"
      title="Skopiuj zwrot"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold text-[#1d4f91] transition hover:bg-[#1d4f91]/10 dark:text-[#60a5fa] dark:hover:bg-[#60a5fa]/10"
    >
      <ClipboardCopy size={11} />
      Kopiuj
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Global floating lead-qualification widget.
 *
 * Rendered as a fixed FAB in the bottom-right corner.
 * Positioned above the scroll-to-top button to avoid collision.
 * Widget state is fully in-memory (no localStorage).
 */
export default function LeadWidget() {
  const {
    open,
    setOpen,
    answers,
    setAnswer,
    consentType,
    setConsentType,
    reset,
    visibleQuestions,
    evaluatedRule,
    allAnswered,
  } = useLeadWidget();
  const { phrases, leadConfig, moduleSettings } = useData();
  const widgetTitle = moduleSettings.lead.widget.title;

  const hasQuestions = leadConfig.questions.some((q) => q.enabled);

  // Phrase lookup helper
  const findPhrase = useCallback(
    (id?: string) => (id ? phrases.find((p) => p.id === id) : undefined),
    [phrases]
  );

  const activePhrase =
    evaluatedRule && !evaluatedRule.blocksLead && consentType
      ? findPhrase(
          consentType === "trwala"
            ? evaluatedRule.phraseIdTrwala
            : evaluatedRule.phraseIdJednorazowa
        )
      : undefined;

  return (
    // Container: bottom-20 puts it above the scroll-to-top button (bottom-6 + h-10 = 64px total)
    <div className="fixed bottom-22 right-6 z-50 flex flex-col items-end gap-2">
      {/* Expanded panel — renders above the trigger button */}
      {open && (
        <div
          className="mb-1 flex max-h-[calc(100vh-10rem)] w-80 flex-col overflow-hidden rounded-2xl border border-[#dde5ee] bg-white shadow-2xl dark:border-[#1e3a5f] dark:bg-[#0f1e33]"
          style={{ maxWidth: "calc(100vw - 3rem)" }}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#e5e7eb] px-4 py-3 dark:border-[#1e293b]">
            <div className="flex items-center gap-2">
              <UserCheck size={15} className="text-[#1d4f91] dark:text-[#60a5fa]" />
              <span className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                {widgetTitle}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Resetuj"
                onClick={reset}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-[#f4f8fc] hover:text-[#1d4f91] dark:hover:bg-[#1e293b] dark:hover:text-[#60a5fa]"
              >
                <RotateCcw size={13} />
              </button>
              <button
                type="button"
                title="Zamknij"
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-[#f4f8fc] hover:text-[#374151] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {!hasQuestions ? (
              <div className="p-4 text-center text-sm text-[#9ca3af]">
                Brak skonfigurowanych pytań.
                <br />
                <span className="text-xs">Dodaj pytania w panelu admina.</span>
              </div>
            ) : (
              <div className="space-y-1 p-3">
                {/* Question list */}
                {visibleQuestions.map((q) => {
                  const ans = answers[q.id];
                  return (
                    <div
                      key={q.id}
                      className="rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] px-3 py-2.5 dark:border-[#1e293b] dark:bg-[#0f172a]"
                    >
                      <p className="mb-2 text-xs font-medium leading-snug text-[#374151] dark:text-[#cbd5e1]">
                        {q.text}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswer(q.id, "tak")}
                          className={[
                            "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition",
                            ans === "tak"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-[#d1d5db] bg-white text-[#374151] hover:border-emerald-400 hover:bg-emerald-50 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20",
                          ].join(" ")}
                        >
                          TAK
                        </button>
                        <button
                          type="button"
                          onClick={() => setAnswer(q.id, "nie")}
                          className={[
                            "flex-1 rounded-lg border py-1.5 text-xs font-semibold transition",
                            ans === "nie"
                              ? "border-red-400 bg-red-400 text-white"
                              : "border-[#d1d5db] bg-white text-[#374151] hover:border-red-300 hover:bg-red-50 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:border-red-400 dark:hover:bg-red-900/20",
                          ].join(" ")}
                        >
                          NIE
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Result banner */}
                {evaluatedRule && (
                  <div
                    className={[
                      "mt-2 rounded-xl border p-3",
                      outcomeBannerCls(evaluatedRule),
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2">
                      {outcomeIcon(evaluatedRule)}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold leading-snug">
                          {evaluatedRule.outcomeLabel}
                        </p>
                        {evaluatedRule.outcomeNote && (
                          <p className="mt-0.5 text-[11px] leading-snug opacity-80">
                            {evaluatedRule.outcomeNote}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* No result yet hint */}
                {!evaluatedRule && allAnswered && (
                  <div className="mt-2 rounded-xl border border-[#e5e7eb] bg-[#f8f9fb] p-3 text-center text-xs text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#0f172a]">
                    Brak dopasowanej reguły.
                  </div>
                )}

                {/* Consent selection */}
                {evaluatedRule && !evaluatedRule.blocksLead && (
                  <div className="mt-2 rounded-xl border border-[#dde5ee] p-3 dark:border-[#1e3a5f]">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
                      Rodzaj zgody
                    </p>
                    <div className="flex gap-2">
                      {(["trwala", "jednorazowa"] as ConsentType[]).map((ct) => (
                        <button
                          key={ct}
                          type="button"
                          onClick={() => setConsentType(consentType === ct ? null : ct)}
                          className={[
                            "flex-1 rounded-lg border py-2 text-[11px] font-semibold transition",
                            consentType === ct
                              ? "border-[#1d4f91] bg-[#1d4f91] text-white dark:border-[#60a5fa] dark:bg-[#1d4f91]"
                              : "border-[#d1d5db] bg-white text-[#374151] hover:border-[#1d4f91] hover:bg-[#f0f6ff] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1] dark:hover:border-[#60a5fa]",
                          ].join(" ")}
                        >
                          {ct === "trwala" ? "TRWAŁA" : "JEDNORAZOWA"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Phrase display */}
                {activePhrase && (
                  <div className="mt-2 rounded-xl border border-[#dde5ee] bg-[#f8f9fb] dark:border-[#1e3a5f] dark:bg-[#0f172a]">
                    <div className="flex items-center justify-between border-b border-[#e5e7eb] px-3 py-2 dark:border-[#1e293b]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
                        Gotowy zwrot
                      </span>
                      <CopyButton text={activePhrase.content} />
                    </div>
                    <p className="whitespace-pre-wrap px-3 py-2.5 text-xs leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
                      {activePhrase.content}
                    </p>
                  </div>
                )}

                {/* Phrase not linked warning */}
                {evaluatedRule &&
                  !evaluatedRule.blocksLead &&
                  consentType &&
                  !activePhrase && (
                    <p className="mt-1 text-center text-[11px] text-[#9ca3af]">
                      Brak powiązanego zwrotu dla tego rodzaju zgody.
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* Footer reset shortcut */}
          {(Object.keys(answers).length > 0 || consentType) && (
            <div className="shrink-0 border-t border-[#e5e7eb] px-4 py-2 dark:border-[#1e293b]">
              <button
                type="button"
                onClick={reset}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium text-[#6b7280] transition hover:bg-[#f4f8fc] hover:text-[#374151] dark:hover:bg-[#1e293b] dark:hover:text-[#cbd5e1]"
              >
                <RotateCcw size={11} />
                Zacznij od nowa
              </button>
            </div>
          )}
        </div>
      )}

      {/* FAB trigger button */}
      <button
        type="button"
        aria-label={open ? `Zamknij ${widgetTitle}` : `Otwórz ${widgetTitle}`}
        onClick={() => setOpen(!open)}
        className={[
          "flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-all duration-200",
          open
            ? "border-[#1d4f91] bg-[#1d4f91] text-white hover:bg-[#1a4580] dark:border-[#60a5fa] dark:bg-[#1d3a6a]"
            : "border-[#dde5ee] bg-white text-[#1d4f91] hover:border-[#1d4f91] hover:bg-[#f0f6ff] dark:border-[#1e3a5f] dark:bg-[#0f1e33] dark:text-[#60a5fa] dark:hover:border-[#60a5fa] dark:hover:bg-[#0f2340]",
        ].join(" ")}
      >
        {open ? <ChevronDown size={18} /> : <UserCheck size={18} />}
      </button>
    </div>
  );
}
