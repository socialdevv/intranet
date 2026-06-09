import { readFile } from "node:fs/promises";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
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

const legacyLinkSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  url: z.string().min(1),
  description: z.string().optional().default(""),
  icon: z.string().min(1).default("link"),
  openInNewTab: z.boolean().optional(),
  isInternal: z.boolean().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
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
  links: z.array(legacyLinkSchema).optional(),
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

async function main() {
  const legacyData = await loadLegacyDataFile();
  const targetProjectSlug = resolveTargetProjectSlug(legacyData);
  const sourceAppName = legacyData.meta?.appName?.trim() ?? null;
  const sourceProjectDisplayName = legacyData.system?.deployment?.projectDisplayName?.trim() ?? null;
  const sourceProjectCode = legacyData.system?.deployment?.projectCode?.trim() ?? null;
  const links = [...(legacyData.links ?? [])].sort((left, right) => left.sortOrder - right.sortOrder);

  console.log("[local-import] legacy file:", LEGACY_JSON_PATH.pathname);
  console.log("[local-import] source appName:", sourceAppName ?? "<missing>");
  console.log("[local-import] source deployment:", sourceProjectDisplayName ?? "<missing>", sourceProjectCode ?? "<missing>");
  console.log("[local-import] target project slug:", targetProjectSlug);
  console.log("[local-import] links found:", links.length);
  console.log(
    "[local-import] sample titles:",
    links.slice(0, 5).map((item) => item.title).join(" | ") || "<none>"
  );

  if (!APPLY_IMPORT) {
    console.log("[local-import] dry-run only. Re-run with --apply to replace project_links rows.");
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
    await transaction.projectLink.deleteMany({
      where: {
        projectId: targetProject.id,
      },
    });

    if (links.length > 0) {
      await transaction.projectLink.createMany({
        data: links.map((item) => ({
          projectId: targetProject.id,
          title: item.title,
          url: item.url,
          description: item.description ?? "",
          icon: item.icon,
          sortOrder: item.sortOrder,
          openInNewTab: item.openInNewTab ?? !item.isInternal,
          isInternal: item.isInternal ?? false,
        })),
      });
    }
  });

  console.log(
    `[local-import] imported ${links.length} links into ${targetProject.slug} (${targetProject.name}).`
  );
}

main()
  .catch((error) => {
    console.error("[local-import] links import failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });