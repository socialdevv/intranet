import { readFile } from "node:fs/promises";
import process from "node:process";
import { Prisma, PrismaClient, PricingStatus } from "@prisma/client";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const LEGACY_JSON_PATH = new URL("../../public/altcloud-data.json", import.meta.url);
const APPLY_IMPORT = process.argv.includes("--apply");
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const PROJECT_MAPPINGS = [
  {
    sourceProjectDisplayName: "Generic Client",
    sourceProjectCode: "GENERIC",
    targetProjectSlug: "altcloud",
  },
] as const;

const legacyPricingTableSectionSchema = z.object({
  type: z.literal("table"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  unit: z.string(),
  columns: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string(),
    })
  ),
  rows: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string(),
      symbol: z.string().optional(),
      unit: z.string().optional(),
      values: z.record(z.string()),
    })
  ),
  footnotes: z.array(z.string()).optional(),
});

const legacyPricingChargesSectionSchema = z.object({
  type: z.literal("charges"),
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      unit: z.string(),
      variants: z.array(
        z.object({
          id: z.string().min(1),
          conditions: z.string(),
          value: z.string(),
        })
      ),
    })
  ),
  footnotes: z.array(z.string()).optional(),
});

const legacyPricingDocumentSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  provider: z.string().optional(),
  effectiveFrom: z.string().regex(DATE_ONLY_PATTERN),
  updatedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["active", "archived"]).optional().default("active"),
  footnotes: z.array(z.string()).optional(),
  sections: z.array(z.union([legacyPricingTableSectionSchema, legacyPricingChargesSectionSchema])).min(1),
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
  cenniki: z
    .object({
      documents: z.array(legacyPricingDocumentSchema).optional().default([]),
    })
    .optional(),
});

type LegacyDataFile = z.infer<typeof legacyDataSchema>;

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

function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main() {
  const legacyData = await loadLegacyDataFile();
  const targetProjectSlug = resolveTargetProjectSlug(legacyData);
  const sourceAppName = legacyData.meta?.appName?.trim() ?? null;
  const sourceProjectDisplayName = legacyData.system?.deployment?.projectDisplayName?.trim() ?? null;
  const sourceProjectCode = legacyData.system?.deployment?.projectCode?.trim() ?? null;
  const documents = [...(legacyData.cenniki?.documents ?? [])].sort((left, right) => {
    const effectiveDiff = new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime();

    if (effectiveDiff !== 0) {
      return effectiveDiff;
    }

    return left.title.localeCompare(right.title, "pl");
  });

  console.log("[local-import] legacy file:", LEGACY_JSON_PATH.pathname);
  console.log("[local-import] source appName:", sourceAppName ?? "<missing>");
  console.log("[local-import] source deployment:", sourceProjectDisplayName ?? "<missing>", sourceProjectCode ?? "<missing>");
  console.log("[local-import] target project slug:", targetProjectSlug);
  console.log("[local-import] pricing documents found:", documents.length);
  console.log(
    "[local-import] sample titles:",
    documents.slice(0, 5).map((item) => `${item.effectiveFrom}:${item.title}`).join(" | ") || "<none>"
  );

  if (!APPLY_IMPORT) {
    console.log("[local-import] dry-run only. Re-run with --apply to replace project_pricing_documents rows.");
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
    await transaction.projectPricingDocument.deleteMany({
      where: {
        projectId: targetProject.id,
      },
    });

    if (documents.length > 0) {
      await transaction.projectPricingDocument.createMany({
        data: documents.map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          projectId: targetProject.id,
          title: item.title,
          subtitle: item.subtitle?.trim() || null,
          provider: item.provider?.trim() || null,
          effectiveFrom: toDateOnly(item.effectiveFrom),
          status: item.status === "archived" ? PricingStatus.archived : PricingStatus.active,
          footnotes: item.footnotes ?? [],
          sectionsJson: item.sections as Prisma.InputJsonValue,
          ...(item.updatedAt ? { updatedAt: new Date(item.updatedAt) } : {}),
        })),
      });
    }
  });

  console.log(
    `[local-import] imported ${documents.length} pricing documents into ${targetProject.slug} (${targetProject.name}).`
  );
}

main()
  .catch((error) => {
    console.error("[local-import] pricing import failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });