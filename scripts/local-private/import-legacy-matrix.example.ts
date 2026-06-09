import { readFile } from "node:fs/promises";
import process from "node:process";
import { ModuleKey, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const LEGACY_JSON_PATH = new URL("../../public/altcloud-data.json", import.meta.url);
const APPLY_IMPORT = process.argv.includes("--apply");

const PROJECT_MAPPINGS = [
  {
    sourceProjectDisplayName: "Generic Client",
    sourceProjectCode: "GENERIC",
    targetProjectSlug: "altcloud",
  },
] as const;

const DEFAULT_MATRIX_ADVISORY_RULES = [
  {
    id: "oze-prosumer-check",
    title: "Sprawdź czy klient jest prosumentem",
    message: "Kierowanie tego zgłoszenia różni się w zależności od statusu OZE klienta.",
    severity: "warning",
    match: {
      criterionValueIncludesAny: ["oze"],
    },
  },
] satisfies Prisma.InputJsonValue;

const legacyMatrixCriterionSchema = z.object({
  field: z.string().default(""),
  value: z.string().default(""),
});

const legacyMatrixConditionSchema = z.object({
  department: z.string().default(""),
  criteria: z.array(legacyMatrixCriterionSchema).optional().default([]),
});

const legacyMatrixEntrySchema = z.object({
  id: z.string().optional(),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  keywords: z.array(z.string()).optional().default([]),
  description: z.string().default(""),
  slaDays: z.number().int().min(1),
  instructions: z.string().optional().default(""),
  additionalNotes: z.string().optional().default(""),
  defaultDepartment: z.string().optional().default(""),
  conditions: z.array(legacyMatrixConditionSchema).optional().default([]),
  linkedTemplateIds: z.array(z.string()).optional().default([]),
  sortOrder: z.number().int().min(0).optional(),
});

const legacyDataSchema = z.object({
  meta: z
    .object({
      appName: z.string().optional(),
    })
    .optional(),
  system: z
    .object({
      deployment: z
        .object({
          projectDisplayName: z.string().optional(),
          projectCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  matrix: z.array(legacyMatrixEntrySchema).optional().default([]),
  matrixCategoryOrder: z.array(z.string()).optional(),
  configuration: z
    .object({
      rules: z
        .object({
          matrixCategoryOrder: z.array(z.string()).optional(),
          matrixAdvisoryRules: z.array(z.unknown()).optional(),
        })
        .optional(),
    })
    .optional(),
});

type LegacyDataFile = z.infer<typeof legacyDataSchema>;

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function resolveTargetProjectSlug(data: LegacyDataFile): string {
  const sourceProjectDisplayName = data.system?.deployment?.projectDisplayName?.trim() ?? null;
  const sourceProjectCode = data.system?.deployment?.projectCode?.trim() ?? null;

  const mapping = PROJECT_MAPPINGS.find((candidate) => {
    const displayNameMatches =
      sourceProjectDisplayName !== null &&
      candidate.sourceProjectDisplayName.toLowerCase() === sourceProjectDisplayName.toLowerCase();

    const projectCodeMatches =
      sourceProjectCode !== null &&
      candidate.sourceProjectCode.toLowerCase() === sourceProjectCode.toLowerCase();

    return displayNameMatches || projectCodeMatches;
  });

  if (!mapping) {
    throw new Error(
      `No local project mapping matched deployment projectDisplayName=${sourceProjectDisplayName ?? "<missing>"} projectCode=${sourceProjectCode ?? "<missing>"}.`
    );
  }

  return mapping.targetProjectSlug;
}

async function loadLegacyDataFile(): Promise<LegacyDataFile> {
  const rawFile = await readFile(LEGACY_JSON_PATH, "utf8");
  return legacyDataSchema.parse(JSON.parse(rawFile));
}

function resolveMatrixRules(data: LegacyDataFile): Prisma.InputJsonValue {
  const matrixCategoryOrder = uniqueStrings(
    data.configuration?.rules?.matrixCategoryOrder ?? data.matrixCategoryOrder ?? []
  );
  const matrixAdvisoryRules =
    Array.isArray(data.configuration?.rules?.matrixAdvisoryRules) &&
    data.configuration.rules.matrixAdvisoryRules.length > 0
      ? data.configuration.rules.matrixAdvisoryRules
      : DEFAULT_MATRIX_ADVISORY_RULES;

  return {
    matrixCategoryOrder,
    matrixAdvisoryRules,
  } satisfies Prisma.InputJsonValue;
}

function normalizeMatrixEntries(data: LegacyDataFile) {
  const categoryOrder = uniqueStrings(
    data.configuration?.rules?.matrixCategoryOrder ?? data.matrixCategoryOrder ?? []
  );
  const categoryIndex = new Map(categoryOrder.map((categoryName, index) => [categoryName, index]));
  const categoryCounters = new Map<string, number>();

  return [...data.matrix]
    .sort((left, right) => {
      const leftCategoryIndex = categoryIndex.get(left.category) ?? Number.MAX_SAFE_INTEGER;
      const rightCategoryIndex = categoryIndex.get(right.category) ?? Number.MAX_SAFE_INTEGER;

      if (leftCategoryIndex !== rightCategoryIndex) {
        return leftCategoryIndex - rightCategoryIndex;
      }

      const leftSortOrder = typeof left.sortOrder === "number" ? left.sortOrder : Number.MAX_SAFE_INTEGER;
      const rightSortOrder = typeof right.sortOrder === "number" ? right.sortOrder : Number.MAX_SAFE_INTEGER;

      if (leftSortOrder !== rightSortOrder) {
        return leftSortOrder - rightSortOrder;
      }

      return left.subcategory.localeCompare(right.subcategory, "pl");
    })
    .map((entry) => {
      const nextCategorySortOrder = categoryCounters.get(entry.category) ?? 0;
      const normalizedSortOrder = typeof entry.sortOrder === "number" ? entry.sortOrder : nextCategorySortOrder;

      categoryCounters.set(entry.category, Math.max(nextCategorySortOrder, normalizedSortOrder) + 1);

      return {
        ...entry,
        keywords: uniqueStrings(entry.keywords ?? []),
        linkedTemplateIds: uniqueStrings(entry.linkedTemplateIds ?? []),
        conditions: entry.conditions.map((condition) => ({
          department: condition.department.trim(),
          criteria: condition.criteria
            .map((criterion) => ({
              field: criterion.field.trim(),
              value: criterion.value.trim(),
            }))
            .filter((criterion) => criterion.field && criterion.value),
        })),
        sortOrder: normalizedSortOrder,
      };
    });
}

async function main() {
  const legacyData = await loadLegacyDataFile();
  const targetProjectSlug = resolveTargetProjectSlug(legacyData);
  const sourceAppName = legacyData.meta?.appName?.trim() ?? null;
  const sourceProjectDisplayName = legacyData.system?.deployment?.projectDisplayName?.trim() ?? null;
  const sourceProjectCode = legacyData.system?.deployment?.projectCode?.trim() ?? null;
  const entries = normalizeMatrixEntries(legacyData);
  const matrixRules = resolveMatrixRules(legacyData);

  console.log("[local-import] legacy file:", LEGACY_JSON_PATH.pathname);
  console.log("[local-import] source appName:", sourceAppName ?? "<missing>");
  console.log("[local-import] source deployment:", sourceProjectDisplayName ?? "<missing>", sourceProjectCode ?? "<missing>");
  console.log("[local-import] target project slug:", targetProjectSlug);
  console.log("[local-import] matrix entries found:", entries.length);
  console.log(
    "[local-import] sample categories:",
    uniqueStrings(entries.map((entry) => entry.category)).slice(0, 10).join(" | ") || "<none>"
  );

  if (!APPLY_IMPORT) {
    console.log("[local-import] dry-run only. Re-run with --apply to replace project_matrix_entries rows and matrix rules.");
    return;
  }

  const targetProject = await prisma.project.findUnique({
    where: {
      slug: targetProjectSlug,
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  if (!targetProject) {
    throw new Error(`Target project ${targetProjectSlug} does not exist in PostgreSQL.`);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.projectMatrixEntry.deleteMany({
      where: {
        projectId: targetProject.id,
      },
    });

    if (entries.length > 0) {
      await transaction.projectMatrixEntry.createMany({
        data: entries.map((entry) => ({
          ...(entry.id ? { id: entry.id } : {}),
          projectId: targetProject.id,
          category: entry.category,
          subcategory: entry.subcategory,
          keywords: entry.keywords,
          description: entry.description,
          slaDays: entry.slaDays,
          instructions: entry.instructions,
          additionalNotes: entry.additionalNotes,
          defaultDepartment: entry.defaultDepartment,
          conditionsJson: entry.conditions as Prisma.InputJsonValue,
          linkedTemplateIds: entry.linkedTemplateIds,
          sortOrder: entry.sortOrder,
        })),
      });
    }

    const moduleUpdate = await transaction.projectModule.updateMany({
      where: {
        projectId: targetProject.id,
        moduleKey: ModuleKey.matrix,
      },
      data: {
        settingsJson: {
          rules: matrixRules,
        } satisfies Prisma.InputJsonValue,
      },
    });

    if (moduleUpdate.count === 0) {
      throw new Error(`Project module ${ModuleKey.matrix} is missing for ${targetProject.slug}.`);
    }
  });

  console.log(
    `[local-import] imported ${entries.length} matrix entries into ${targetProject.slug} (${targetProject.name}) and updated matrix rules.`
  );
}

main()
  .catch((error) => {
    console.error("[local-import] matrix import failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });