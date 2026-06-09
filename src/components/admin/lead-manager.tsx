import { useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Zap,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { generateId } from "@/lib/utils";
import type {
  LeadQuestion,
  LeadRule,
  LeadAnswerValue,
  LeadOutcomeType,
  LeadVisibilityCondition,
  LeadRuleCondition,
} from "@/lib/types/lead";

// ── Style helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "h-10 w-full rounded-xl border border-[#d1d5db] bg-white px-3 text-sm text-[#374151] placeholder:text-[#b0bac9] shadow-sm transition focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]";
const selectCls =
  "h-10 w-full rounded-xl border border-[#d1d5db] bg-white px-3 text-sm text-[#374151] shadow-sm transition focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]";
const labelCls = "mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]";
const sectionHeadCls =
  "flex items-center gap-2 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]";
const cardCls =
  "rounded-2xl border border-[#dbe4f0] bg-gradient-to-br from-white to-[#f9fbff] p-4 shadow-sm dark:border-[#223147] dark:bg-gradient-to-br dark:from-[#0f172a] dark:to-[#111827]";

const OUTCOME_OPTIONS: { value: LeadOutcomeType; label: string }[] = [
  { value: "allowed", label: "Dozwolony" },
  { value: "not_allowed", label: "Niedozwolony" },
  { value: "conditional", label: "Warunkowy" },
  { value: "informational", label: "Informacyjny" },
];

// ── Question form ─────────────────────────────────────────────────────────────

type QuestionDraft = {
  text: string;
  enabled: boolean;
  conditionQuestionId: string;
  conditionAnswer: LeadAnswerValue;
  hasCondition: boolean;
};

function blankQuestionDraft(): QuestionDraft {
  return {
    text: "",
    enabled: true,
    conditionQuestionId: "",
    conditionAnswer: "tak",
    hasCondition: false,
  };
}

function draftFromQuestion(q: LeadQuestion): QuestionDraft {
  return {
    text: q.text,
    enabled: q.enabled,
    conditionQuestionId: q.condition?.questionId ?? "",
    conditionAnswer: q.condition?.answer ?? "tak",
    hasCondition: Boolean(q.condition),
  };
}

function QuestionForm({
  editing,
  otherQuestions,
  onSave,
  onCancel,
}: {
  editing: LeadQuestion | null;
  otherQuestions: LeadQuestion[];
  onSave: (draft: QuestionDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<QuestionDraft>(
    editing ? draftFromQuestion(editing) : blankQuestionDraft()
  );
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.text.trim()) {
      setError("Treść pytania jest wymagana.");
      return;
    }
    if (draft.hasCondition && !draft.conditionQuestionId) {
      setError("Wybierz pytanie warunkujące.");
      return;
    }
    onSave({ ...draft, text: draft.text.trim() });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label className={labelCls}>Treść pytania *</label>
        <input
          autoFocus
          type="text"
          value={draft.text}
          onChange={(e) => {
            setDraft((d) => ({ ...d, text: e.target.value }));
            setError("");
          }}
          placeholder='np. "Czy posiada ofertę?"'
          className={inputCls}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="rounded"
          />
          Aktywne
        </label>
      </div>

      <div className="rounded-lg border border-[#e5e7eb] p-3 dark:border-[#334155]">
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm font-medium text-[#374151] dark:text-[#cbd5e1]">
          <input
            type="checkbox"
            checked={draft.hasCondition}
            onChange={(e) => setDraft((d) => ({ ...d, hasCondition: e.target.checked }))}
            className="rounded"
          />
          Pytanie warunkowe (zależy od odpowiedzi na inne pytanie)
        </label>
        {draft.hasCondition && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Pytanie poprzedzające</label>
              <select
                value={draft.conditionQuestionId}
                onChange={(e) => setDraft((d) => ({ ...d, conditionQuestionId: e.target.value }))}
                className={selectCls}
              >
                <option value="">— wybierz —</option>
                {otherQuestions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text.length > 40 ? q.text.slice(0, 40) + "…" : q.text}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Odpowiedź wymagana</label>
              <select
                value={draft.conditionAnswer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, conditionAnswer: e.target.value as LeadAnswerValue }))
                }
                className={selectCls}
              >
                <option value="tak">TAK</option>
                <option value="nie">NIE</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1a4580]"
        >
          <Check size={13} />
          {editing ? "Zapisz" : "Dodaj pytanie"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-xs font-medium text-[#374151] transition hover:bg-[#f9fafb] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]"
        >
          <X size={13} />
          Anuluj
        </button>
      </div>
    </form>
  );
}

// ── Rule form ─────────────────────────────────────────────────────────────────

type RuleDraft = {
  name: string;
  priority: number;
  enabled: boolean;
  outcome: LeadOutcomeType;
  outcomeLabel: string;
  outcomeNote: string;
  blocksLead: boolean;
  phraseIdTrwala: string;
  phraseIdJednorazowa: string;
  conditions: Array<{ questionId: string; answer: LeadAnswerValue }>;
};

function blankRuleDraft(): RuleDraft {
  return {
    name: "",
    priority: 10,
    enabled: true,
    outcome: "allowed",
    outcomeLabel: "",
    outcomeNote: "",
    blocksLead: false,
    phraseIdTrwala: "",
    phraseIdJednorazowa: "",
    conditions: [],
  };
}

function draftFromRule(r: LeadRule): RuleDraft {
  return {
    name: r.name,
    priority: r.priority,
    enabled: r.enabled,
    outcome: r.outcome,
    outcomeLabel: r.outcomeLabel,
    outcomeNote: r.outcomeNote ?? "",
    blocksLead: r.blocksLead,
    phraseIdTrwala: r.phraseIdTrwala ?? "",
    phraseIdJednorazowa: r.phraseIdJednorazowa ?? "",
    conditions: r.conditions.map((c) => ({ ...c })),
  };
}

function RuleForm({
  editing,
  questions,
  phrases,
  onSave,
  onCancel,
}: {
  editing: LeadRule | null;
  questions: LeadQuestion[];
  phrases: Array<{ id: string; title: string }>;
  onSave: (draft: RuleDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<RuleDraft>(
    editing ? draftFromRule(editing) : blankRuleDraft()
  );
  const [error, setError] = useState("");

  function addCondition() {
    setDraft((d) => ({
      ...d,
      conditions: [
        ...d.conditions,
        { questionId: questions[0]?.id ?? "", answer: "tak" as LeadAnswerValue },
      ],
    }));
  }

  function removeCondition(idx: number) {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.filter((_, i) => i !== idx),
    }));
  }

  function updateCondition(
    idx: number,
    field: "questionId" | "answer",
    value: string
  ) {
    setDraft((d) => ({
      ...d,
      conditions: d.conditions.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      ),
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError("Nazwa reguły jest wymagana.");
      return;
    }
    if (!draft.outcomeLabel.trim()) {
      setError("Etykieta wyniku jest wymagana.");
      return;
    }
    onSave({ ...draft, name: draft.name.trim(), outcomeLabel: draft.outcomeLabel.trim() });
  }

  const showPhraseLinks = !draft.blocksLead;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Basic info */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Nazwa reguły *</label>
          <input
            autoFocus
            type="text"
            value={draft.name}
            onChange={(e) => {
              setDraft((d) => ({ ...d, name: e.target.value }));
              setError("");
            }}
            placeholder='np. "Wykluczona — brak oferty"'
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Priorytet (im wyższy, tym silniejszy)</label>
          <input
            type="number"
            min={0}
            max={9999}
            value={draft.priority}
            onChange={(e) =>
              setDraft((d) => ({ ...d, priority: parseInt(e.target.value, 10) || 0 }))
            }
            className={inputCls}
          />
        </div>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151] dark:text-[#cbd5e1]">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
              className="rounded"
            />
            Aktywna
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <input
              type="checkbox"
              checked={draft.blocksLead}
              onChange={(e) => setDraft((d) => ({ ...d, blocksLead: e.target.checked }))}
              className="rounded accent-red-500"
            />
            Blokuje lead
          </label>
        </div>
      </div>

      {/* Outcome */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Typ wyniku</label>
          <select
            value={draft.outcome}
            onChange={(e) =>
              setDraft((d) => ({ ...d, outcome: e.target.value as LeadOutcomeType }))
            }
            className={selectCls}
          >
            {OUTCOME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Etykieta wyniku *</label>
          <input
            type="text"
            value={draft.outcomeLabel}
            onChange={(e) => {
              setDraft((d) => ({ ...d, outcomeLabel: e.target.value }));
              setError("");
            }}
            placeholder='np. "Lead dozwolony"'
            className={inputCls}
          />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Dodatkowa uwaga (opcjonalna)</label>
          <input
            type="text"
            value={draft.outcomeNote}
            onChange={(e) => setDraft((d) => ({ ...d, outcomeNote: e.target.value }))}
            placeholder="Wyjaśnienie lub instrukcja dla konsultanta"
            className={inputCls}
          />
        </div>
      </div>

      {/* Conditions */}
      <div className="rounded-lg border border-[#e5e7eb] p-3 dark:border-[#334155]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#374151] dark:text-[#cbd5e1]">
            Warunki wyzwalające (wszystkie muszą być spełnione)
          </p>
          <button
            type="button"
            onClick={addCondition}
            disabled={questions.length === 0}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#1d4f91] transition hover:bg-[#f0f6ff] disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#60a5fa] dark:hover:bg-[#1d4f91]/10"
          >
            <Plus size={11} />
            Dodaj warunek
          </button>
        </div>
        {draft.conditions.length === 0 && (
          <p className="text-[11px] text-[#9ca3af]">
            Brak warunków — reguła zawsze odpala (catch-all / domyślna).
          </p>
        )}
        <div className="space-y-2">
          {draft.conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={cond.questionId}
                onChange={(e) => updateCondition(idx, "questionId", e.target.value)}
                className={selectCls + " flex-1"}
              >
                <option value="">— pytanie —</option>
                {questions.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.text.length > 40 ? q.text.slice(0, 40) + "…" : q.text}
                  </option>
                ))}
              </select>
              <select
                value={cond.answer}
                onChange={(e) =>
                  updateCondition(idx, "answer", e.target.value)
                }
                className={selectCls + " w-24"}
              >
                <option value="tak">TAK</option>
                <option value="nie">NIE</option>
              </select>
              <button
                type="button"
                onClick={() => removeCondition(idx)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#9ca3af] transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-[#334155] dark:hover:border-red-700 dark:hover:bg-red-900/20"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Phrase links */}
      {showPhraseLinks && (
        <div className="rounded-lg border border-[#e5e7eb] p-3 dark:border-[#334155]">
          <p className="mb-2 text-xs font-semibold text-[#374151] dark:text-[#cbd5e1]">
            Powiązane gotowe zwroty
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Zgoda TRWAŁA</label>
              <select
                value={draft.phraseIdTrwala}
                onChange={(e) => setDraft((d) => ({ ...d, phraseIdTrwala: e.target.value }))}
                className={selectCls}
              >
                <option value="">— brak —</option>
                {phrases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.length > 40 ? p.title.slice(0, 40) + "…" : p.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Zgoda JEDNORAZOWA</label>
              <select
                value={draft.phraseIdJednorazowa}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, phraseIdJednorazowa: e.target.value }))
                }
                className={selectCls}
              >
                <option value="">— brak —</option>
                {phrases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title.length > 40 ? p.title.slice(0, 40) + "…" : p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#1a4580]"
        >
          <Check size={13} />
          {editing ? "Zapisz" : "Dodaj regułę"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-xs font-medium text-[#374151] transition hover:bg-[#f9fafb] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]"
        >
          <X size={13} />
          Anuluj
        </button>
      </div>
    </form>
  );
}

// ── Helpers for applying drafts ───────────────────────────────────────────────

function questionFromDraft(
  draft: QuestionDraft,
  id: string,
  sortOrder: number
): LeadQuestion {
  const condition: LeadVisibilityCondition | null = draft.hasCondition && draft.conditionQuestionId
    ? { questionId: draft.conditionQuestionId, answer: draft.conditionAnswer }
    : null;
  return {
    id,
    text: draft.text,
    sortOrder,
    enabled: draft.enabled,
    condition,
  };
}

function ruleFromDraft(draft: RuleDraft, id: string): LeadRule {
  const conditions: LeadRuleCondition[] = draft.conditions
    .filter((c) => c.questionId)
    .map((c) => ({ questionId: c.questionId, answer: c.answer }));
  return {
    id,
    name: draft.name,
    priority: draft.priority,
    enabled: draft.enabled,
    conditions,
    outcome: draft.outcome,
    outcomeLabel: draft.outcomeLabel,
    outcomeNote: draft.outcomeNote || undefined,
    blocksLead: draft.blocksLead,
    phraseIdTrwala: draft.phraseIdTrwala || undefined,
    phraseIdJednorazowa: draft.phraseIdJednorazowa || undefined,
  };
}

// ── Outcome badge ─────────────────────────────────────────────────────────────

function OutcomeBadge({ rule }: { rule: LeadRule }) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-semibold";
  if (rule.blocksLead || rule.outcome === "not_allowed") {
    return <span className={`${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`}>Blokuje</span>;
  }
  if (rule.outcome === "allowed") {
    return <span className={`${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400`}>Dozwolony</span>;
  }
  if (rule.outcome === "conditional") {
    return <span className={`${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400`}>Warunkowy</span>;
  }
  return <span className={`${base} bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400`}>Info</span>;
}

// ── Main manager ──────────────────────────────────────────────────────────────

type Panel = "question-new" | "question-edit" | "rule-new" | "rule-edit" | null;

export default function LeadManager() {
  const { leadConfig, setLeadConfig, phrases } = useData();
  const { push: showToast } = useToast();

  const [panel, setPanel] = useState<Panel>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const { questions, rules } = leadConfig;
  const sortedQuestions = [...questions].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // ── Question mutations ──────────────────────────────────────────────────────

  const handleAddQuestion = useCallback(
    async (draft: QuestionDraft) => {
      const id = generateId("lq");
      const sortOrder = questions.length > 0
        ? Math.max(...questions.map((q) => q.sortOrder)) + 1
        : 0;
      const q = questionFromDraft(draft, id, sortOrder);
      await setLeadConfig({ ...leadConfig, questions: [...questions, q] });
      setPanel(null);
      showToast("success", "Pytanie dodane.");
    },
    [leadConfig, questions, setLeadConfig, showToast]
  );

  const handleUpdateQuestion = useCallback(
    async (draft: QuestionDraft) => {
      if (!editingQuestionId) return;
      const existing = questions.find((q) => q.id === editingQuestionId);
      if (!existing) return;
      const q = questionFromDraft(draft, editingQuestionId, existing.sortOrder);
      await setLeadConfig({
        ...leadConfig,
        questions: questions.map((x) => (x.id === editingQuestionId ? q : x)),
      });
      setPanel(null);
      setEditingQuestionId(null);
      showToast("success", "Pytanie zaktualizowane.");
    },
    [editingQuestionId, leadConfig, questions, setLeadConfig, showToast]
  );

  const handleDeleteQuestion = useCallback(
    async (id: string) => {
      // Clean up any rules referencing this question.
      const updatedRules = rules.map((r) => ({
        ...r,
        conditions: r.conditions.filter((c) => c.questionId !== id),
      }));
      const updatedQuestions = questions
        .filter((q) => q.id !== id)
        .map((q, idx) => ({ ...q, sortOrder: idx }));
      // Also remove condition references from other questions.
      const cleanedQuestions = updatedQuestions.map((q) =>
        q.condition?.questionId === id ? { ...q, condition: null } : q
      );
      await setLeadConfig({ questions: cleanedQuestions, rules: updatedRules });
      showToast("success", "Pytanie usunięte.");
    },
    [leadConfig, questions, rules, setLeadConfig, showToast]
  );

  function moveQuestion(id: string, dir: -1 | 1) {
    const sorted = [...sortedQuestions];
    const idx = sorted.findIndex((q) => q.id === id);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= sorted.length) return;
    const updated = sorted.map((q, i) => {
      if (i === idx) return { ...q, sortOrder: sorted[swap].sortOrder };
      if (i === swap) return { ...q, sortOrder: sorted[idx].sortOrder };
      return q;
    });
    void setLeadConfig({ ...leadConfig, questions: updated });
  }

  function toggleQuestion(id: string) {
    void setLeadConfig({
      ...leadConfig,
      questions: questions.map((q) =>
        q.id === id ? { ...q, enabled: !q.enabled } : q
      ),
    });
  }

  // ── Rule mutations ──────────────────────────────────────────────────────────

  const handleAddRule = useCallback(
    async (draft: RuleDraft) => {
      const id = generateId("lr");
      const r = ruleFromDraft(draft, id);
      await setLeadConfig({ ...leadConfig, rules: [...rules, r] });
      setPanel(null);
      showToast("success", "Reguła dodana.");
    },
    [leadConfig, rules, setLeadConfig, showToast]
  );

  const handleUpdateRule = useCallback(
    async (draft: RuleDraft) => {
      if (!editingRuleId) return;
      const r = ruleFromDraft(draft, editingRuleId);
      await setLeadConfig({
        ...leadConfig,
        rules: rules.map((x) => (x.id === editingRuleId ? r : x)),
      });
      setPanel(null);
      setEditingRuleId(null);
      showToast("success", "Reguła zaktualizowana.");
    },
    [editingRuleId, leadConfig, rules, setLeadConfig, showToast]
  );

  const handleDeleteRule = useCallback(
    async (id: string) => {
      await setLeadConfig({ ...leadConfig, rules: rules.filter((r) => r.id !== id) });
      showToast("success", "Reguła usunięta.");
    },
    [leadConfig, rules, setLeadConfig, showToast]
  );

  function toggleRule(id: string) {
    void setLeadConfig({
      ...leadConfig,
      rules: rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    });
  }

  const editingQuestion =
    editingQuestionId ? questions.find((q) => q.id === editingQuestionId) ?? null : null;
  const editingRule =
    editingRuleId ? rules.find((r) => r.id === editingRuleId) ?? null : null;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#dbe4f0] bg-linear-to-r from-[#f7fbff] via-white to-[#f0f7ff] p-4 shadow-sm dark:border-[#24344b] dark:bg-linear-to-r dark:from-[#0f172a] dark:via-[#111827] dark:to-[#10233d] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5f7ea8] dark:text-[#8fb0d6]">
              Workspace konfiguracji
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9] sm:text-xl">
              Kwalifikacja leada
            </h2>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#9fb3cc]">
              Zarządzaj pytaniami i regułami decyzyjnymi bez zmiany logiki aplikacji.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div className="rounded-xl border border-[#d5e3f6] bg-white/80 px-3 py-2 text-center dark:border-[#2a3e5b] dark:bg-[#0b1220]/70">
              <p className="text-[#7a8ca6] dark:text-[#94a3b8]">Pytania</p>
              <p className="mt-0.5 text-base font-semibold text-[#1d4f91] dark:text-[#93c5fd]">{questions.length}</p>
            </div>
            <div className="rounded-xl border border-[#d5e3f6] bg-white/80 px-3 py-2 text-center dark:border-[#2a3e5b] dark:bg-[#0b1220]/70">
              <p className="text-[#7a8ca6] dark:text-[#94a3b8]">Reguły</p>
              <p className="mt-0.5 text-base font-semibold text-[#1d4f91] dark:text-[#93c5fd]">{rules.length}</p>
            </div>
            <div className="rounded-xl border border-[#d5e3f6] bg-white/80 px-3 py-2 text-center dark:border-[#2a3e5b] dark:bg-[#0b1220]/70 col-span-2 sm:col-span-1">
              <p className="text-[#7a8ca6] dark:text-[#94a3b8]">Aktywne reguły</p>
              <p className="mt-0.5 text-base font-semibold text-[#1d4f91] dark:text-[#93c5fd]">
                {rules.filter((r) => r.enabled).length}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-12">
        {/* ── Questions section ── */}
        <section className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm dark:border-[#1f2937] dark:bg-[#111827] xl:col-span-5 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={sectionHeadCls}>
                <HelpCircle size={16} className="text-[#1d4f91] dark:text-[#60a5fa]" />
                Pytania
              </div>
              <p className="mt-1 text-xs text-[#72829a] dark:text-[#94a3b8]">
                Kolejność pytań wpływa na przebieg kwalifikacji.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPanel("question-new");
                setEditingQuestionId(null);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#1d4f91] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1a4580]"
            >
              <Plus size={13} />
              Dodaj pytanie
            </button>
          </div>

          {/* Question form */}
          {(panel === "question-new" || panel === "question-edit") && (
            <div className={cardCls}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9ca3af]">
                {panel === "question-new" ? "Nowe pytanie" : "Edytuj pytanie"}
              </p>
              <QuestionForm
                editing={editingQuestion}
                otherQuestions={sortedQuestions.filter(
                  (q) => q.id !== editingQuestionId
                )}
                onSave={panel === "question-new" ? handleAddQuestion : handleUpdateQuestion}
                onCancel={() => {
                  setPanel(null);
                  setEditingQuestionId(null);
                }}
              />
            </div>
          )}

          {/* Questions list */}
          {sortedQuestions.length === 0 && panel !== "question-new" && (
            <div className="rounded-xl border border-dashed border-[#d5deea] bg-[#f8fbff] p-4 text-sm text-[#7b8ba3] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
              Brak pytań. Dodaj pierwsze pytanie.
            </div>
          )}
          <div className="space-y-3">
            {sortedQuestions.map((q, idx) => (
              <div
                key={q.id}
                className={[
                  "group flex items-start gap-3 rounded-xl border p-3.5 transition sm:p-4",
                  q.enabled
                    ? "border-[#dce4ef] bg-white shadow-sm hover:border-[#bfd0e6] hover:shadow dark:border-[#243449] dark:bg-[#0f172a] dark:hover:border-[#34506f]"
                    : "border-[#e5e7eb] bg-[#f8f9fb] opacity-70 dark:border-[#1f2937] dark:bg-[#0b1220]",
                ].join(" ")}
              >
                <div className="flex shrink-0 flex-col rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-0.5 dark:border-[#334155] dark:bg-[#111827]">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveQuestion(q.id, -1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-[#94a3b8] transition hover:bg-[#eaf2fc] hover:text-[#334155] disabled:opacity-30 dark:hover:bg-[#1e293b]"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sortedQuestions.length - 1}
                    onClick={() => moveQuestion(q.id, 1)}
                    className="flex h-6 w-6 items-center justify-center rounded text-[#94a3b8] transition hover:bg-[#eaf2fc] hover:text-[#334155] disabled:opacity-30 dark:hover:bg-[#1e293b]"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="wrap-break-word text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {q.text}
                    </p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        q.enabled
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
                      ].join(" ")}
                    >
                      {q.enabled ? "Aktywne" : "Nieaktywne"}
                    </span>
                  </div>

                  {q.condition ? (
                    <p className="mt-1 text-[11px] text-[#8091a8] dark:text-[#94a3b8]">
                      Widoczne gdy: <span className="font-medium text-[#5d6f88] dark:text-[#cbd5e1]">
                        {(() => {
                          const ref = questions.find((x) => x.id === q.condition?.questionId)?.text;
                          if (!ref) return q.condition.questionId;
                          return ref.length > 52 ? ref.slice(0, 52) + "…" : ref;
                        })()}
                      </span> = <span className="font-semibold uppercase">{q.condition.answer}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] text-[#94a3b8]">Pytanie podstawowe (zawsze widoczne).</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-1 dark:border-[#334155] dark:bg-[#111827]">
                  <button
                    type="button"
                    title={q.enabled ? "Dezaktywuj" : "Aktywuj"}
                    onClick={() => toggleQuestion(q.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-white hover:text-[#334155] dark:hover:bg-[#1f2937]"
                  >
                    {q.enabled ? (
                      <ToggleRight size={16} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Edytuj"
                    onClick={() => {
                      setEditingQuestionId(q.id);
                      setEditingRuleId(null);
                      setPanel("question-edit");
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-white hover:text-[#334155] dark:hover:bg-[#1f2937]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Usuń"
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Rules section ── */}
        <section className="space-y-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm dark:border-[#1f2937] dark:bg-[#111827] xl:col-span-7 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className={sectionHeadCls}>
                <Zap size={16} className="text-[#1d4f91] dark:text-[#60a5fa]" />
                Reguły decyzyjne
              </div>
              <p className="mt-1 text-xs text-[#72829a] dark:text-[#94a3b8]">
                Reguły z wyższym priorytetem mają pierwszeństwo przy kwalifikacji.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPanel("rule-new");
                setEditingRuleId(null);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-[#1d4f91] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1a4580]"
            >
              <Plus size={13} />
              Dodaj regułę
            </button>
          </div>

          <p className="rounded-lg border border-[#e2e8f0] bg-[#f8fbff] px-3 py-2 text-xs text-[#74859d] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
            Pierwsza pasująca reguła wyznacza wynik. Reguła bez warunków działa jako domyślna (catch-all).
          </p>

          {/* Rule form */}
          {(panel === "rule-new" || panel === "rule-edit") && (
            <div className={cardCls}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280] dark:text-[#9ca3af]">
                {panel === "rule-new" ? "Nowa reguła" : "Edytuj regułę"}
              </p>
              <RuleForm
                editing={editingRule}
                questions={sortedQuestions}
                phrases={phrases}
                onSave={panel === "rule-new" ? handleAddRule : handleUpdateRule}
                onCancel={() => {
                  setPanel(null);
                  setEditingRuleId(null);
                }}
              />
            </div>
          )}

          {/* Rules list */}
          {sortedRules.length === 0 && panel !== "rule-new" && (
            <div className="rounded-xl border border-dashed border-[#d5deea] bg-[#f8fbff] p-4 text-sm text-[#7b8ba3] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
              Brak reguł. Dodaj pierwszą regułę.
            </div>
          )}
          <div className="space-y-3">
            {sortedRules.map((r) => (
              <div
                key={r.id}
                className={[
                  "group flex items-start gap-3 rounded-xl border p-3.5 transition sm:p-4",
                  r.enabled
                    ? "border-[#dce4ef] bg-white shadow-sm hover:border-[#bfd0e6] hover:shadow dark:border-[#243449] dark:bg-[#0f172a] dark:hover:border-[#34506f]"
                    : "border-[#e5e7eb] bg-[#f8f9fb] opacity-70 dark:border-[#1f2937] dark:bg-[#0b1220]",
                ].join(" ")}
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="wrap-break-word text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {r.name}
                    </span>
                    <OutcomeBadge rule={r} />
                    <span className="rounded-full bg-[#edf2fb] px-2 py-0.5 text-[10px] font-medium text-[#5f7393] dark:bg-[#1f2b3d] dark:text-[#9fb3cc]">
                      Priorytet: {r.priority}
                    </span>
                    {!r.enabled && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Nieaktywna
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#64748b] dark:text-[#9fb3cc]">{r.outcomeLabel}</p>

                  {r.conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {r.conditions.map((c, i) => (
                        <span
                          key={i}
                          className="max-w-full rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] text-[#475569] dark:bg-[#334155] dark:text-[#94a3b8]"
                        >
                          {(() => {
                            const ref = questions.find((q) => q.id === c.questionId)?.text;
                            if (!ref) return c.questionId;
                            return ref.length > 36 ? ref.slice(0, 36) + "…" : ref;
                          })()} = {c.answer.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#94a3b8]">Brak warunków: reguła domyślna.</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-1 dark:border-[#334155] dark:bg-[#111827]">
                  <button
                    type="button"
                    title={r.enabled ? "Dezaktywuj" : "Aktywuj"}
                    onClick={() => toggleRule(r.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-white hover:text-[#334155] dark:hover:bg-[#1f2937]"
                  >
                    {r.enabled ? (
                      <ToggleRight size={16} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Edytuj"
                    onClick={() => {
                      setEditingRuleId(r.id);
                      setEditingQuestionId(null);
                      setPanel("rule-edit");
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-white hover:text-[#334155] dark:hover:bg-[#1f2937]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Usuń"
                    onClick={() => handleDeleteRule(r.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[#94a3b8] transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
