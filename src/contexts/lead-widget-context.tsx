import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { LeadAnswerValue, LeadQuestion, LeadRule } from "@/lib/types/lead";
import { useData } from "@/contexts/data-context";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConsentType = "trwala" | "jednorazowa";

type LeadWidgetContextValue = {
  /** Whether the widget panel is expanded. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Recorded answers keyed by question id. */
  answers: Record<string, LeadAnswerValue>;
  setAnswer: (questionId: string, answer: LeadAnswerValue) => void;
  /** Consent type selected after a non-blocking result. */
  consentType: ConsentType | null;
  setConsentType: (t: ConsentType | null) => void;
  /** Reset all state (answers, consent, result). */
  reset: () => void;
  // ─ Derived ─
  /** Questions that should currently be shown, in sort order. */
  visibleQuestions: LeadQuestion[];
  /** The highest-priority rule that fires given current answers, or null. */
  evaluatedRule: LeadRule | null;
  /** True when every visible question has been answered. */
  allAnswered: boolean;
};

const LeadWidgetContext = createContext<LeadWidgetContextValue | null>(null);

// ── Rule evaluation ───────────────────────────────────────────────────────────

function evaluateRules(
  rules: LeadRule[],
  answers: Record<string, LeadAnswerValue>
): LeadRule | null {
  const enabled = rules.filter((r) => r.enabled);
  const firing = enabled.filter((r) =>
    r.conditions.every((c) => answers[c.questionId] === c.answer)
  );
  if (firing.length === 0) return null;
  // Highest priority wins; equal priority: first in array wins.
  return firing.reduce((best, r) => (r.priority > best.priority ? r : best), firing[0]);
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LeadWidgetProvider({ children }: { children: React.ReactNode }) {
  const { leadConfig } = useData();
  const [open, setOpenState] = useState(false);
  const [answers, setAnswers] = useState<Record<string, LeadAnswerValue>>({});
  const [consentType, setConsentTypeState] = useState<ConsentType | null>(null);

  const setOpen = useCallback((v: boolean) => setOpenState(v), []);

  const setAnswer = useCallback((questionId: string, answer: LeadAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    // Clear consent when answers change — result may have changed.
    setConsentTypeState(null);
  }, []);

  const setConsentType = useCallback((t: ConsentType | null) => {
    setConsentTypeState(t);
  }, []);

  const reset = useCallback(() => {
    setAnswers({});
    setConsentTypeState(null);
  }, []);

  // Compute which questions are currently visible.
  const visibleQuestions = useMemo<LeadQuestion[]>(() => {
    const sorted = [...leadConfig.questions]
      .filter((q) => q.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return sorted.filter((q) => {
      if (!q.condition) return true;
      return answers[q.condition.questionId] === q.condition.answer;
    });
  }, [leadConfig.questions, answers]);

  const evaluatedRule = useMemo(
    () => evaluateRules(leadConfig.rules, answers),
    [leadConfig.rules, answers]
  );

  const allAnswered = useMemo(
    () => visibleQuestions.length > 0 && visibleQuestions.every((q) => q.id in answers),
    [visibleQuestions, answers]
  );

  const value = useMemo<LeadWidgetContextValue>(
    () => ({
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
    }),
    [
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
    ]
  );

  return (
    <LeadWidgetContext.Provider value={value}>{children}</LeadWidgetContext.Provider>
  );
}

export function useLeadWidget() {
  const ctx = useContext(LeadWidgetContext);
  if (!ctx) throw new Error("useLeadWidget must be used inside LeadWidgetProvider");
  return ctx;
}
