import type { MatrixAdvisoryRule, MatrixDecision, MatrixCriterion } from "@/lib/types/domain";

export const DEFAULT_MATRIX_ADVISORY_RULES: MatrixAdvisoryRule[] = [
  {
    id: "oze-prosumer-check",
    title: "Sprawdź czy klient jest prosumentem",
    message: "Kierowanie tego zgłoszenia różni się w zależności od statusu OZE klienta.",
    severity: "warning",
    match: {
      criterionValueIncludesAny: ["oze"],
    },
  },
];

function sanitizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

function normalizeCriterion(criterion: MatrixCriterion): { field: string; value: string } {
  return {
    field: criterion.field.trim().toLowerCase(),
    value: criterion.value.trim().toLowerCase(),
  };
}

function sanitizeMatrixAdvisoryRule(input: unknown): MatrixAdvisoryRule | null {
  if (!input || typeof input !== "object") return null;

  const candidate = input as Record<string, unknown>;
  const match =
    candidate.match && typeof candidate.match === "object"
      ? (candidate.match as Record<string, unknown>)
      : null;

  const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const message = typeof candidate.message === "string" ? candidate.message.trim() : "";
  const severity =
    candidate.severity === "info" ||
    candidate.severity === "warning" ||
    candidate.severity === "critical"
      ? candidate.severity
      : undefined;
  const criterionValueIncludesAny = sanitizeStringList(match?.criterionValueIncludesAny);
  const criterionFieldIn = sanitizeStringList(match?.criterionFieldIn);

  if (!id || !title || !message || criterionValueIncludesAny.length === 0) {
    return null;
  }

  return {
    id,
    title,
    message,
    severity,
    match: {
      criterionValueIncludesAny,
      ...(criterionFieldIn.length > 0 ? { criterionFieldIn } : {}),
    },
  };
}

export function sanitizeMatrixAdvisoryRules(input: unknown): MatrixAdvisoryRule[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((rule) => sanitizeMatrixAdvisoryRule(rule))
    .filter((rule): rule is MatrixAdvisoryRule => rule !== null);
}

export function getApplicableMatrixAdvisoryRules(
  entry: MatrixDecision,
  rules: MatrixAdvisoryRule[],
): MatrixAdvisoryRule[] {
  if (rules.length === 0) return [];

  const criteria = entry.conditions.flatMap((condition) =>
    condition.criteria.map((criterion) => normalizeCriterion(criterion)),
  );

  if (criteria.length === 0) return [];

  return rules.filter((rule) => {
    const fieldFilters = rule.match.criterionFieldIn?.map((field) => field.toLowerCase()) ?? [];
    const valueFilters = rule.match.criterionValueIncludesAny.map((value) => value.toLowerCase());

    return criteria.some((criterion) => {
      const matchesField = fieldFilters.length === 0 || fieldFilters.includes(criterion.field);
      const matchesValue = valueFilters.some((value) => criterion.value.includes(value));
      return matchesField && matchesValue;
    });
  });
}