// ── Lead-qualification widget — domain types ─────────────────────────────────
//
// These types define the configurable decision/rule system for the lead
// qualification widget. All configuration is stored inside AppData and managed
// from the admin panel — no business logic is hardcoded in the UI.

// ── Primitives ────────────────────────────────────────────────────────────────

/** The two possible answer values for a lead question. */
export type LeadAnswerValue = "tak" | "nie";

// ── Questions ─────────────────────────────────────────────────────────────────

/**
 * A single visibility condition for a question.
 * The question is only shown when the referenced question (`questionId`) has
 * been answered with the given `answer` value.
 */
export type LeadVisibilityCondition = {
  questionId: string;
  answer: LeadAnswerValue;
};

/**
 * A single configurable question shown in the lead widget.
 * Questions are displayed in ascending `sortOrder`.
 */
export type LeadQuestion = {
  id: string;
  /** The question text shown to the consultant. */
  text: string;
  /** Lower = shown first. */
  sortOrder: number;
  /** When false the question is hidden from the widget entirely. */
  enabled: boolean;
  /**
   * Visibility condition.
   * `null` = always visible (when enabled).
   * Defined = only visible when the referenced question has the given answer.
   */
  condition: LeadVisibilityCondition | null;
};

// ── Rules ─────────────────────────────────────────────────────────────────────

/** The semantic kind of a rule outcome. */
export type LeadOutcomeType = "allowed" | "not_allowed" | "conditional" | "informational";

/**
 * A single answer-match requirement inside a rule.
 * ALL conditions in a rule must be satisfied for the rule to fire.
 */
export type LeadRuleCondition = {
  questionId: string;
  answer: LeadAnswerValue;
};

/**
 * A configurable decision rule.
 *
 * Evaluation:
 * 1. Filter to enabled rules only.
 * 2. A rule fires when ALL its `conditions` are satisfied by current answers.
 * 3. Among all firing rules, the one with the highest `priority` wins.
 * 4. Ties are broken by the rule's position in the list (earlier wins).
 */
export type LeadRule = {
  id: string;
  /** Human-readable name, shown in the admin list and as rule label. */
  name: string;
  /**
   * Higher number = higher priority.
   * When multiple rules fire simultaneously, the highest-priority rule
   * determines the outcome.
   */
  priority: number;
  /** When false the rule is excluded from evaluation. */
  enabled: boolean;
  /**
   * All of these answer-conditions must be satisfied for the rule to fire.
   * An empty array means the rule always fires (catch-all / default).
   */
  conditions: LeadRuleCondition[];
  /** Semantic outcome type. */
  outcome: LeadOutcomeType;
  /** Short label displayed in the result banner, e.g. "Lead dozwolony". */
  outcomeLabel: string;
  /**
   * Optional extra explanatory note shown below the outcome label.
   * Especially useful for "conditional" and "informational" outcomes.
   */
  outcomeNote?: string;
  /**
   * When true this rule blocks lead creation regardless of outcome type.
   * Consent selection and phrase display are hidden.
   */
  blocksLead: boolean;
  /**
   * ID of the PhraseEntry linked for TRWAŁA consent.
   * Only relevant when `blocksLead` is false.
   */
  phraseIdTrwala?: string;
  /**
   * ID of the PhraseEntry linked for JEDNORAZOWA consent.
   * Only relevant when `blocksLead` is false.
   */
  phraseIdJednorazowa?: string;
};

// ── Aggregate config ──────────────────────────────────────────────────────────

/** The full, persisted configuration for the lead-qualification widget. */
export type LeadConfig = {
  questions: LeadQuestion[];
  rules: LeadRule[];
};
