import type { Prisma, PrismaClient } from "@prisma/client";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
} from "./audit-log.js";

/** Per-kind absolute maximums (bytes). */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const FILE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 300 * 1024 * 1024;

/** Tiered capacity applies to videos only. */
export const VIDEO_SMALL_TIER_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_SMALL_TIER_MAX_COUNT = 10;
export const VIDEO_LARGE_TIER_MAX_COUNT = 3;

export type ProjectVideoUploadTierCounts = {
  smallVideoCount: number;
  largeVideoCount: number;
};

function readMetadataSizeBytes(metadata: Prisma.JsonValue | null): number {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }

  const sizeBytes = (metadata as Record<string, unknown>).sizeBytes;

  return typeof sizeBytes === "number" && Number.isFinite(sizeBytes) && sizeBytes > 0
    ? Math.trunc(sizeBytes)
    : 0;
}

function readMetadataMediaKind(metadata: Prisma.JsonValue | null): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const mediaKind = (metadata as Record<string, unknown>).mediaKind;

  return typeof mediaKind === "string" && mediaKind.trim() ? mediaKind.trim().toLowerCase() : null;
}

export async function countProjectVideoUploadTierUsage(
  prisma: PrismaClient,
  projectId: string
): Promise<ProjectVideoUploadTierCounts> {
  const rows = await prisma.auditLog.findMany({
    where: {
      projectId,
      entityType: AUDIT_ENTITY_TYPES.projectMediaUpload,
      actionType: AUDIT_ACTION_TYPES.create,
    },
    select: {
      metadataJson: true,
    },
  });

  let smallVideoCount = 0;
  let largeVideoCount = 0;

  for (const row of rows) {
    if (readMetadataMediaKind(row.metadataJson) !== "video") {
      continue;
    }

    const sizeBytes = readMetadataSizeBytes(row.metadataJson);

    if (sizeBytes <= VIDEO_SMALL_TIER_MAX_BYTES) {
      smallVideoCount += 1;
      continue;
    }

    largeVideoCount += 1;
  }

  return {
    smallVideoCount,
    largeVideoCount,
  };
}

export function classifyVideoUploadSizeTier(sizeBytes: number): "small" | "large" {
  return sizeBytes <= VIDEO_SMALL_TIER_MAX_BYTES ? "small" : "large";
}

export function resolvePerKindMaxBytes(
  mediaKind: "image" | "file" | "video",
  globalMaxBytes: number
): number {
  if (mediaKind === "image") {
    return IMAGE_MAX_BYTES;
  }

  if (mediaKind === "file") {
    return FILE_MAX_BYTES;
  }

  return Math.min(VIDEO_MAX_BYTES, globalMaxBytes);
}

export function validateIncomingVideoUploadCapacity(input: {
  counts: ProjectVideoUploadTierCounts;
  incomingSizeBytes: number;
  videoMaxBytes: number;
}):
  | { ok: true; tier: "small" | "large" }
  | { ok: false; message: string } {
  const { counts, incomingSizeBytes, videoMaxBytes } = input;

  if (incomingSizeBytes <= 0) {
    return {
      ok: false,
      message: "Uploaded file is empty.",
    };
  }

  if (incomingSizeBytes > videoMaxBytes) {
    return {
      ok: false,
      message: `Uploaded video exceeds the maximum size of ${videoMaxBytes} bytes (${formatMegabytes(videoMaxBytes)}).`,
    };
  }

  const tier = classifyVideoUploadSizeTier(incomingSizeBytes);

  if (tier === "small") {
    if (counts.smallVideoCount >= VIDEO_SMALL_TIER_MAX_COUNT) {
      return {
        ok: false,
        message: `Project already has the maximum of ${VIDEO_SMALL_TIER_MAX_COUNT} small videos (<= ${formatMegabytes(VIDEO_SMALL_TIER_MAX_BYTES)}). Delete an existing video upload before adding another small video.`,
      };
    }

    return { ok: true, tier };
  }

  if (counts.largeVideoCount >= VIDEO_LARGE_TIER_MAX_COUNT) {
    return {
      ok: false,
      message: `Project already has the maximum of ${VIDEO_LARGE_TIER_MAX_COUNT} large videos (> ${formatMegabytes(VIDEO_SMALL_TIER_MAX_BYTES)} and <= ${formatMegabytes(videoMaxBytes)}). Delete an existing video upload before adding another large video.`,
    };
  }

  return { ok: true, tier };
}

export function createUploadTierCapacityError(code: string): NodeJS.ErrnoException {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}
