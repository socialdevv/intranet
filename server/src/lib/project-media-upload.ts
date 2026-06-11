import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { MultipartFile } from "@fastify/multipart";
import {
  MediaKind,
  ProjectRole,
  type PrismaClient,
} from "@prisma/client";
import { z } from "zod";
import type { AppEnv } from "../config/env.js";
import type { ResolvedUser } from "./platform-bootstrap.js";
import {
  AUDIT_ACTION_TYPES,
  AUDIT_ENTITY_TYPES,
  recordAuditLogBestEffort,
} from "./audit-log.js";
import {
  countProjectVideoUploadTierUsage,
  createUploadTierCapacityError,
  resolvePerKindMaxBytes,
  VIDEO_SMALL_TIER_MAX_BYTES,
  validateIncomingVideoUploadCapacity,
} from "./project-upload-capacity.js";
import {
  resolveAbsoluteMediaPath,
  resolveStoredMediaPath,
} from "./media-storage.js";

const uploadRequestSchema = z
  .object({
    projectSlug: z.string().trim().min(1).max(191).optional(),
    projectId: z.string().uuid("Project id must be a valid UUID.").optional(),
    mediaKind: z.nativeEnum(MediaKind),
    sizeBytes: z.coerce.number().int().positive().optional(),
  })
  .refine((value) => Boolean(value.projectSlug || value.projectId), {
    message: "Either projectSlug or projectId is required.",
    path: ["projectSlug"],
  });

const DEFAULT_UPLOAD_POLICIES: Record<
  MediaKind,
  { maxBytes: bigint; allowedMimePatterns: string[] }
> = {
  image: {
    maxBytes: BigInt(5 * 1024 * 1024),
    allowedMimePatterns: ["image/*"],
  },
  file: {
    maxBytes: BigInt(10 * 1024 * 1024),
    allowedMimePatterns: ["application/*", "text/*"],
  },
  video: {
    maxBytes: BigInt(300 * 1024 * 1024),
    allowedMimePatterns: ["video/*"],
  },
};

const MIME_EXTENSION_FALLBACKS: Record<string, string> = {
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "application/pdf": ".pdf",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

type ProjectRef = {
  id: string;
  slug: string;
  code: string;
  name: string;
};

type ProjectUploadSuccess = {
  ok: true;
  data: {
    project: ProjectRef;
    file: {
      mediaKind: MediaKind;
      url: string;
      path: string;
      mimeType: string;
      sizeBytes: number;
      originalFilename: string;
      storedFilename: string;
    };
  };
};

type ProjectUploadFailure =
  | {
      ok: false;
      reason: "validation";
      message: string;
    }
  | {
      ok: false;
      reason: "not_found" | "locked" | "forbidden";
      message: string;
    }
  | {
      ok: false;
      reason: "too_large" | "capacity_exceeded";
      message: string;
      maxBytes?: number;
    }
  | {
      ok: false;
      reason: "unsupported_media_type";
      message: string;
      allowedMimePatterns: string[];
    };

function canUploadProjectFiles(role: ProjectRole | null): boolean {
  return role === ProjectRole.project_admin || role === ProjectRole.content_manager;
}

function extractMultipartFieldValue(input: unknown): string | undefined {
  if (typeof input === "string") {
    const normalized = input.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (!input || typeof input !== "object") {
    return undefined;
  }

  if (
    "value" in input &&
    typeof (input as { value?: unknown }).value === "string"
  ) {
    const normalized = (input as { value: string }).value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function matchesMimePattern(mimeType: string, pattern: string): boolean {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  const normalizedPattern = pattern.trim().toLowerCase();

  if (!normalizedMimeType || !normalizedPattern) {
    return false;
  }

  if (normalizedPattern === "*/*") {
    return true;
  }

  if (normalizedPattern.endsWith("/*")) {
    const prefix = normalizedPattern.slice(0, normalizedPattern.length - 1);
    return normalizedMimeType.startsWith(prefix);
  }

  return normalizedMimeType === normalizedPattern;
}

function sanitizeBaseFilename(input: string, fallback: string): string {
  const normalized = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");

  const trimmed = normalized.slice(0, 80).replace(/^[._-]+|[._-]+$/g, "");
  return trimmed || fallback;
}

function resolveStoredExtension(
  originalFilename: string,
  mimeType: string,
  mediaKind: MediaKind
): string {
  const directExtension = path.extname(originalFilename).trim().toLowerCase();
  if (/^\.[a-z0-9]{1,10}$/.test(directExtension)) {
    return directExtension;
  }

  const mimeFallback = MIME_EXTENSION_FALLBACKS[mimeType.trim().toLowerCase()];
  if (mimeFallback) {
    return mimeFallback;
  }

  if (mediaKind === MediaKind.image) {
    return ".img";
  }

  if (mediaKind === MediaKind.video) {
    return ".video";
  }

  return ".bin";
}

function buildStoredFilename(
  originalFilename: string,
  mimeType: string,
  mediaKind: MediaKind
): string {
  const extension = resolveStoredExtension(originalFilename, mimeType, mediaKind);
  const baseName = sanitizeBaseFilename(path.basename(originalFilename, path.extname(originalFilename)), mediaKind);
  return `${baseName}_${randomUUID()}${extension}`;
}

type UploadStreamGuardOptions = {
  mediaKind: MediaKind;
  maxBytes: number;
  videoTierCounts?: Awaited<ReturnType<typeof countProjectVideoUploadTierUsage>>;
};

function createUploadStreamGuard(options: UploadStreamGuardOptions) {
  let totalBytes = 0;
  let largeVideoTierValidated = false;

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > options.maxBytes) {
        callback(createUploadTierCapacityError("FILE_TOO_LARGE"));
        return;
      }

      if (
        options.mediaKind === MediaKind.video &&
        options.videoTierCounts &&
        !largeVideoTierValidated &&
        totalBytes > VIDEO_SMALL_TIER_MAX_BYTES
      ) {
        largeVideoTierValidated = true;

        const capacity = validateIncomingVideoUploadCapacity({
          counts: options.videoTierCounts,
          incomingSizeBytes: totalBytes,
          videoMaxBytes: options.maxBytes,
        });

        if (!capacity.ok) {
          const tierError = createUploadTierCapacityError("TIER_CAPACITY_EXCEEDED");
          tierError.message = capacity.message;
          callback(tierError);
          return;
        }
      }

      callback(null, chunk);
    },
  });

  return {
    transform,
    getBytes: () => totalBytes,
    finalize: () => {
      if (totalBytes <= 0) {
        throw createUploadTierCapacityError("EMPTY_FILE");
      }

      if (options.mediaKind === MediaKind.video && options.videoTierCounts) {
        const capacity = validateIncomingVideoUploadCapacity({
          counts: options.videoTierCounts,
          incomingSizeBytes: totalBytes,
          videoMaxBytes: options.maxBytes,
        });

        if (!capacity.ok) {
          const tierError = createUploadTierCapacityError("TIER_CAPACITY_EXCEEDED");
          tierError.message = capacity.message;
          throw tierError;
        }
      }

      return totalBytes;
    },
  };
}

async function writeMultipartFileToDisk(
  file: MultipartFile,
  absoluteTargetPath: string,
  options: UploadStreamGuardOptions
): Promise<number> {
  await mkdir(path.dirname(absoluteTargetPath), { recursive: true });

  const streamGuard = createUploadStreamGuard(options);

  try {
    await pipeline(
      file.file,
      streamGuard.transform,
      createWriteStream(absoluteTargetPath, { flags: "wx" })
    );

    return streamGuard.finalize();
  } catch (error) {
    await unlink(absoluteTargetPath).catch(() => undefined);
    throw error;
  }
}

async function resolveUploadPolicy(
  prisma: PrismaClient,
  projectId: string,
  mediaKind: MediaKind
) {
  const [projectPolicy, globalPolicy] = await Promise.all([
    prisma.uploadPolicy.findFirst({
      where: {
        projectId,
        mediaKind,
      },
      select: {
        maxBytes: true,
        allowedMimePatterns: true,
      },
    }),
    prisma.uploadPolicy.findFirst({
      where: {
        projectId: null,
        mediaKind,
      },
      select: {
        maxBytes: true,
        allowedMimePatterns: true,
      },
    }),
  ]);

  return projectPolicy ?? globalPolicy ?? DEFAULT_UPLOAD_POLICIES[mediaKind];
}

export async function uploadProjectMediaAsset(
  prisma: PrismaClient,
  currentUser: ResolvedUser,
  env: AppEnv,
  file: MultipartFile
): Promise<ProjectUploadSuccess | ProjectUploadFailure> {
  const parsedInput = uploadRequestSchema.safeParse({
    projectSlug: extractMultipartFieldValue(file.fields.projectSlug),
    projectId: extractMultipartFieldValue(file.fields.projectId),
    mediaKind: extractMultipartFieldValue(file.fields.kind),
    sizeBytes: extractMultipartFieldValue(file.fields.sizeBytes),
  });

  if (!parsedInput.success) {
    return {
      ok: false,
      reason: "validation",
      message: parsedInput.error.issues[0]?.message ?? "Upload request is invalid.",
    };
  }

  const project = await prisma.project.findFirst({
    where: parsedInput.data.projectId
      ? {
          id: parsedInput.data.projectId,
          isActive: true,
        }
      : {
          slug: parsedInput.data.projectSlug,
          isActive: true,
        },
    select: {
      id: true,
      slug: true,
      code: true,
      name: true,
      memberships: {
        where: {
          userId: currentUser.id,
        },
        select: {
          effectiveRole: true,
        },
        take: 1,
      },
    },
  });

  if (!project) {
    return {
      ok: false,
      reason: "not_found",
      message: "Project was not found or is not active.",
    };
  }

  const effectiveRole = project.memberships[0]?.effectiveRole ?? null;

  if (!effectiveRole) {
    return {
      ok: false,
      reason: "locked",
      message: "Uploading project files requires an active project membership.",
    };
  }

  if (!canUploadProjectFiles(effectiveRole)) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Uploading project files requires content editing permissions.",
    };
  }

  const mediaKind = parsedInput.data.mediaKind;
  const policy = await resolveUploadPolicy(prisma, project.id, mediaKind);
  const globalMaxBytes = env.UPLOAD_MAX_FILE_SIZE_BYTES;
  const policyMaxBytes = Number(policy.maxBytes);
  const perKindMaxBytes = resolvePerKindMaxBytes(mediaKind, globalMaxBytes);
  const maxBytes = Math.min(policyMaxBytes, perKindMaxBytes);
  const allowedMimePatterns = policy.allowedMimePatterns;
  const videoTierCounts =
    mediaKind === MediaKind.video
      ? await countProjectVideoUploadTierUsage(prisma, project.id)
      : undefined;

  if (typeof parsedInput.data.sizeBytes === "number") {
    if (parsedInput.data.sizeBytes > maxBytes) {
      return {
        ok: false,
        reason: "too_large",
        message: `Uploaded ${mediaKind} exceeds the maximum size of ${maxBytes} bytes.`,
        maxBytes,
      };
    }

    if (mediaKind === MediaKind.video && videoTierCounts) {
      const declaredVideoCapacity = validateIncomingVideoUploadCapacity({
        counts: videoTierCounts,
        incomingSizeBytes: parsedInput.data.sizeBytes,
        videoMaxBytes: maxBytes,
      });

      if (!declaredVideoCapacity.ok) {
        return {
          ok: false,
          reason: "capacity_exceeded",
          message: declaredVideoCapacity.message,
          maxBytes,
        };
      }
    }
  }
  const mimeType = file.mimetype.trim().toLowerCase();
  const originalFilename = file.filename.trim();

  if (!originalFilename) {
    return {
      ok: false,
      reason: "validation",
      message: "Uploaded file name is missing.",
    };
  }

  if (!mimeType) {
    return {
      ok: false,
      reason: "unsupported_media_type",
      message: "Uploaded file MIME type is missing.",
      allowedMimePatterns,
    };
  }

  if (
    allowedMimePatterns.length > 0 &&
    !allowedMimePatterns.some((pattern) => matchesMimePattern(mimeType, pattern))
  ) {
    return {
      ok: false,
      reason: "unsupported_media_type",
      message: `Uploaded file type ${mimeType} is not allowed for ${mediaKind} uploads.`,
      allowedMimePatterns,
    };
  }

  const storedFilename = buildStoredFilename(originalFilename, mimeType, mediaKind);
  const storedPath = resolveStoredMediaPath(mediaKind, project.slug, storedFilename);
  const absoluteTargetPath = resolveAbsoluteMediaPath(env, storedPath);

  try {
    const sizeBytes = await writeMultipartFileToDisk(file, absoluteTargetPath, {
      mediaKind,
      maxBytes,
      videoTierCounts,
    });

    await recordAuditLogBestEffort(prisma, {
      actor: currentUser,
      project: {
        id: project.id,
        slug: project.slug,
        code: project.code,
        name: project.name,
      },
      entityType: AUDIT_ENTITY_TYPES.projectMediaUpload,
      entityId: storedPath,
      actionType: AUDIT_ACTION_TYPES.create,
      metadata: {
        mediaKind,
        storedPath,
        storedFilename,
        originalFilename,
        mimeType,
        sizeBytes,
      },
    });

    return {
      ok: true,
      data: {
        project: {
          id: project.id,
          slug: project.slug,
          code: project.code,
          name: project.name,
        },
        file: {
          mediaKind,
          url: storedPath,
          path: storedPath,
          mimeType,
          sizeBytes,
          originalFilename,
          storedFilename,
        },
      },
    };
  } catch (error) {
    const errorCode = (error as NodeJS.ErrnoException).code;

    if (errorCode === "FILE_TOO_LARGE") {
      return {
        ok: false,
        reason: "too_large",
        message: `Uploaded ${mediaKind} exceeds the maximum size of ${maxBytes} bytes.`,
        maxBytes,
      };
    }

    if (errorCode === "TIER_CAPACITY_EXCEEDED") {
      return {
        ok: false,
        reason: "capacity_exceeded",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Project upload capacity for this file size tier has been exceeded.",
      };
    }

    if (errorCode === "EMPTY_FILE") {
      return {
        ok: false,
        reason: "validation",
        message: "Uploaded file is empty.",
      };
    }

    throw error;
  }
}