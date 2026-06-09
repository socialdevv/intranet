import { readFile } from "node:fs/promises";
import process from "node:process";
import { CommunicationKind, Prisma, PrismaClient } from "@prisma/client";
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

const emptyDoc = {
  type: "doc",
  content: [],
};

const legacyCommunicationSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  status: z.enum(["active", "archived"]).optional().default("active"),
  communicationDate: z.string().optional(),
  body: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
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
  communications: z.array(legacyCommunicationSchema).optional(),
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

function toOptionalDate(value: string | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(normalized);

  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
}

async function main() {
  const legacyData = await loadLegacyDataFile();
  const targetProjectSlug = resolveTargetProjectSlug(legacyData);
  const sourceAppName = legacyData.meta?.appName?.trim() ?? null;
  const sourceProjectDisplayName = legacyData.system?.deployment?.projectDisplayName?.trim() ?? null;
  const sourceProjectCode = legacyData.system?.deployment?.projectCode?.trim() ?? null;
  const communications = [...(legacyData.communications ?? [])].sort((left, right) => {
    const leftDate = toOptionalDate(left.communicationDate)?.getTime() ?? toOptionalDate(left.updatedAt)?.getTime() ?? 0;
    const rightDate = toOptionalDate(right.communicationDate)?.getTime() ?? toOptionalDate(right.updatedAt)?.getTime() ?? 0;

    return rightDate - leftDate || left.title.localeCompare(right.title, "pl");
  });

  console.log("[local-import] legacy file:", LEGACY_JSON_PATH.pathname);
  console.log("[local-import] source appName:", sourceAppName ?? "<missing>");
  console.log("[local-import] source deployment:", sourceProjectDisplayName ?? "<missing>", sourceProjectCode ?? "<missing>");
  console.log("[local-import] target project slug:", targetProjectSlug);
  console.log("[local-import] communications found:", communications.length);
  console.log(
    "[local-import] sample titles:",
    communications.slice(0, 5).map((item) => `${item.status}:${item.title}`).join(" | ") || "<none>"
  );

  if (!APPLY_IMPORT) {
    console.log("[local-import] dry-run only. Re-run with --apply to replace communication rows in project_communications.");
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
    await transaction.projectCommunication.deleteMany({
      where: {
        projectId: targetProject.id,
        kind: CommunicationKind.communication,
      },
    });

    if (communications.length > 0) {
      await transaction.projectCommunication.createMany({
        data: communications.map((item) => {
          const communicationDate = toOptionalDate(item.communicationDate);
          const createdAt = toOptionalDate(item.createdAt);
          const updatedAt = toOptionalDate(item.updatedAt);

          return {
            ...(item.id ? { id: item.id } : {}),
            projectId: targetProject.id,
            kind: CommunicationKind.communication,
            title: item.title,
            bodyJson: (item.body ?? emptyDoc) as Prisma.InputJsonValue,
            status: item.status,
            ...(communicationDate ? { communicationDate } : {}),
            ...(createdAt ? { createdAt } : {}),
            ...(updatedAt ? { updatedAt } : {}),
          };
        }),
      });
    }
  });

  console.log(
    `[local-import] imported ${communications.length} communications into ${targetProject.slug} (${targetProject.name}).`
  );
}

main()
  .catch((error) => {
    console.error("[local-import] communications import failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });