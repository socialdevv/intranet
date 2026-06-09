import type { ProjectAuditHistoryItem } from "@/lib/api/project-audit";

export type AuditFieldChangePresentation = "scalar" | "neutral";

export type AuditFieldChangeRow = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  hasBefore: boolean;
  presentation: AuditFieldChangePresentation;
};

const FIELD_LABELS: Record<string, string> = {
  title: "Tytuł",
  name: "Nazwa",
  url: "Adres URL",
  description: "Opis",
  icon: "Ikona",
  sortOrder: "Kolejność",
  openInNewTab: "Otwieraj w nowej karcie",
  isInternal: "Link wewnętrzny",
  active: "Aktywny",
  color: "Kolor",
  visibleFrom: "Widoczny od",
  visibleUntil: "Widoczny do",
  enabled: "Włączony",
  navVisible: "Widoczny w nawigacji",
  navOrder: "Kolejność w nawigacji",
  slug: "Slug",
  code: "Kod",
  labelOverride: "Etykieta",
  categorySlug: "Slug kategorii",
  bodyJson: "Treść (JSON)",
  settingsJson: "Ustawienia (JSON)",
  leadConfig: "Konfiguracja leada",
  managed: "Zarządzany",
  matrixCategoryOrder: "Kolejność kategorii macierzy",
  childOrder: "Kolejność elementów",
};

const STRUCTURED_CHAR_THRESHOLD = 120;
const STRUCTURED_LINE_THRESHOLD = 3;
const MAX_EXPANDED_LEAF_ROWS = 32;
const NEUTRAL_PREVIEW_MAX_CHARS = 1200;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function isSimpleScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  );
}

function isSimpleScalarArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => isSimpleScalar(entry));
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return getValueAtPath(source, path);
}

function getValueAtPath(root: unknown, path: string): unknown {
  const segments = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = root;

  for (const segment of segments) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

    const record = asRecord(current);
    if (!record || !(segment in record)) {
      return undefined;
    }

    current = record[segment];
  }

  return current;
}

function humanizeFieldName(field: string): string {
  const normalized = field.replace(/\[(\d+)\]/g, ".$1");
  const leaf = normalized.split(".").pop() ?? field;

  if (FIELD_LABELS[leaf]) {
    if (normalized.includes(".")) {
      return `${normalized} (${FIELD_LABELS[leaf]})`;
    }

    return FIELD_LABELS[leaf];
  }

  return normalized
    .split(".")
    .map((segment) =>
      segment
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .toLowerCase()
    )
    .join(" → ");
}

export function formatAuditFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "boolean") {
    return value ? "Tak" : "Nie";
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    if (isSimpleScalarArray(value)) {
      return value.map((entry) => formatAuditFieldValue(entry) ?? "—").join(", ");
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function isStructuredPayload(value: unknown, formatted: string | null): boolean {
  if (value !== null && typeof value === "object") {
    return true;
  }

  if (!formatted) {
    return false;
  }

  if (formatted.length > STRUCTURED_CHAR_THRESHOLD) {
    return true;
  }

  return formatted.split("\n").length > STRUCTURED_LINE_THRESHOLD;
}

function valuesAreEqual(left: unknown, right: unknown): boolean {
  if (isSimpleScalar(left) && isSimpleScalar(right)) {
    return formatAuditFieldValue(left) === formatAuditFieldValue(right);
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return formatAuditFieldValue(left) === formatAuditFieldValue(right);
  }
}

function collectDiffFieldPaths(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = ""
): string[] {
  const paths: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const beforeValue = before[key];
    const afterValue = after[key];
    const beforeRecord = asRecord(beforeValue);
    const afterRecord = asRecord(afterValue);

    if (beforeRecord && afterRecord) {
      paths.push(...collectDiffFieldPaths(beforeRecord, afterRecord, path));
      continue;
    }

    if (Array.isArray(beforeValue) || Array.isArray(afterValue)) {
      const left = Array.isArray(beforeValue) ? beforeValue : [];
      const right = Array.isArray(afterValue) ? afterValue : [];

      if (isSimpleScalarArray(left) && isSimpleScalarArray(right)) {
        if (!valuesAreEqual(left, right)) {
          paths.push(path);
        }
        continue;
      }

      const maxLength = Math.max(left.length, right.length);
      for (let index = 0; index < maxLength; index += 1) {
        if (!valuesAreEqual(left[index], right[index])) {
          paths.push(`${path}[${index}]`);
        }
      }
      continue;
    }

    if (!valuesAreEqual(beforeValue, afterValue)) {
      paths.push(path);
    }
  }

  return paths;
}

function resolvePresentation(
  beforeValue: unknown,
  afterValue: unknown,
  before: string | null,
  after: string | null
): AuditFieldChangePresentation {
  if (isStructuredPayload(beforeValue, before) || isStructuredPayload(afterValue, after)) {
    return "neutral";
  }

  return "scalar";
}

function buildScalarRow(
  field: string,
  beforeValue: unknown,
  afterValue: unknown
): AuditFieldChangeRow | null {
  const before = formatAuditFieldValue(beforeValue);
  const after = formatAuditFieldValue(afterValue);

  if (before === null && after === null) {
    return null;
  }

  if (before !== null && after !== null && before === after) {
    return null;
  }

  return {
    field,
    label: humanizeFieldName(field),
    before,
    after,
    hasBefore: before !== null,
    presentation: resolvePresentation(beforeValue, afterValue, before, after),
  };
}

function tryExpandStructuredChange(
  field: string,
  beforeValue: unknown,
  afterValue: unknown
): AuditFieldChangeRow[] | null {
  const beforeRecord = asRecord(beforeValue);
  const afterRecord = asRecord(afterValue);

  if (beforeRecord || afterRecord) {
    const before = beforeRecord ?? {};
    const after = afterRecord ?? {};
    const paths = collectDiffFieldPaths(before, after);

    if (paths.length === 0) {
      return null;
    }

    if (paths.length > MAX_EXPANDED_LEAF_ROWS) {
      return null;
    }

    const rows = paths
      .map((path) => {
        const leafField = `${field}.${path}`;
        return buildScalarRow(
          leafField,
          getValueAtPath(beforeValue, path),
          getValueAtPath(afterValue, path)
        );
      })
      .filter((row): row is AuditFieldChangeRow => row !== null);

    return rows.length > 0 ? rows : null;
  }

  const beforeArray = Array.isArray(beforeValue) ? beforeValue : null;
  const afterArray = Array.isArray(afterValue) ? afterValue : null;

  if (!beforeArray && !afterArray) {
    return null;
  }

  const before = beforeArray ?? [];
  const after = afterArray ?? [];

  if (isSimpleScalarArray(before) && isSimpleScalarArray(after)) {
    return null;
  }

  const maxLength = Math.max(before.length, after.length);
  const indices: number[] = [];

  for (let index = 0; index < maxLength; index += 1) {
    if (!valuesAreEqual(before[index], after[index])) {
      indices.push(index);
    }
  }

  if (indices.length === 0 || indices.length > MAX_EXPANDED_LEAF_ROWS) {
    return null;
  }

  const rows = indices
    .map((index) =>
      buildScalarRow(`${field}[${index}]`, before[index] ?? null, after[index] ?? null)
    )
    .filter((row): row is AuditFieldChangeRow => row !== null);

  return rows.length > 0 ? rows : null;
}

function buildRowsFromChange(
  field: string,
  beforeValue: unknown,
  afterValue: unknown
): AuditFieldChangeRow[] {
  const expanded = tryExpandStructuredChange(field, beforeValue, afterValue);
  if (expanded) {
    return expanded;
  }

  const row = buildScalarRow(field, beforeValue, afterValue);
  if (!row) {
    return [];
  }

  if (row.presentation === "neutral") {
    return [row];
  }

  return [row];
}

function resolveFieldsFromExplicitBeforeAfter(
  metadata: Record<string, unknown>,
  changedFields: string[]
): AuditFieldChangeRow[] {
  const before = asRecord(metadata.before);
  const after = asRecord(metadata.after);

  if (!before || !after) {
    return [];
  }

  const fields =
    changedFields.length > 0 ? changedFields : collectDiffFieldPaths(before, after);

  return fields.flatMap((field) =>
    buildRowsFromChange(
      field,
      getValueAtPath(before, field),
      getValueAtPath(after, field)
    )
  );
}

function resolveFieldsFromFlatSnapshot(
  metadata: Record<string, unknown>,
  changedFields: string[]
): AuditFieldChangeRow[] {
  if (changedFields.length === 0) {
    return [];
  }

  return changedFields.flatMap((field) => {
    const afterValue = getNestedValue(metadata, field) ?? metadata[field];
    return buildRowsFromChange(field, null, afterValue);
  });
}

export function resolveAuditFieldChanges(item: ProjectAuditHistoryItem): AuditFieldChangeRow[] {
  if (item.actionType !== "update") {
    return [];
  }

  const metadata = asRecord(item.metadata);
  if (!metadata) {
    return [];
  }

  const changedFields =
    item.changedFields.length > 0 ? item.changedFields : asStringArray(metadata.changedFields);

  const explicit = resolveFieldsFromExplicitBeforeAfter(metadata, changedFields);
  if (explicit.length > 0) {
    return explicit;
  }

  return resolveFieldsFromFlatSnapshot(metadata, changedFields);
}

export function auditEntryHasFieldDiff(item: ProjectAuditHistoryItem): boolean {
  return resolveAuditFieldChanges(item).length > 0;
}

export function truncateAuditPreview(value: string, maxChars = NEUTRAL_PREVIEW_MAX_CHARS): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}\n…`;
}
