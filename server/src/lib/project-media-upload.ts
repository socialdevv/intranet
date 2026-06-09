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
  resolveAbsoluteMediaPath,
  resolveStoredMediaPath,
} from "./media-storage.js";

const uploadRequestSchema = z.object({
  projectSlug: z.string().trim().min(1, "Project slug is required.").max(191),
  mediaKind: z.nativeEnum(MediaKind),
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
    maxBytes: BigInt(500 * 1024 * 1024),
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
      reason: "too_large";
      message: string;
      maxBytes: number;
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

function createByteLimitTransform(maxBytes: number) {
  let totalBytes = 0;

  const transform = new Transform({
    transform(chunk, _encoding, callback) {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        const error = new Error(`Uploaded file exceeds the maximum size of ${maxBytes} bytes.`) as NodeJS.ErrnoException;
        error.code = "FILE_TOO_LARGE";
        callback(error);
        return;
      }

      callback(null, chunk);
    },
  });

  return {
    transform,
    getBytes: () => totalBytes,
  };
}

async function writeMultipartFileToDisk(
  file: MultipartFile,
  absoluteTargetPath: string,
  maxBytes: number
): Promise<number> {
  await mkdir(path.dirname(absoluteTargetPath), { recursive: true });

  const byteLimit = createByteLimitTransform(maxBytes);

  try {
    await pipeline(
      file.file,
      byteLimit.transform,
      createWriteStream(absoluteTargetPath, { flags: "wx" })
    );

    const sizeBytes = byteLimit.getBytes();
    if (sizeBytes <= 0) {
      const error = new Error("Uploaded file is empty.") as NodeJS.ErrnoException;
      error.code = "EMPTY_FILE";
      throw error;
    }

    return sizeBytes;
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
    mediaKind: extractMultipartFieldValue(file.fields.kind),
  });

  if (!parsedInput.success) {
    return {
      ok: false,
      reason: "validation",
      message: parsedInput.error.issues[0]?.message ?? "Upload request is invalid.",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
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
  const maxBytes = Number(policy.maxBytes);
  const allowedMimePatterns = policy.allowedMimePatterns;
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
    const sizeBytes = await writeMultipartFileToDisk(file, absoluteTargetPath, maxBytes);

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
    if ((error as NodeJS.ErrnoException).code === "FILE_TOO_LARGE") {
      return {
        ok: false,
        reason: "too_large",
        message: `Uploaded file exceeds the ${maxBytes}-byte limit for ${mediaKind} uploads.`,
        maxBytes,
      };
    }

    if ((error as NodeJS.ErrnoException).code === "EMPTY_FILE") {
      return {
        ok: false,
        reason: "validation",
        message: "Uploaded file is empty.",
      };
    }

    throw error;
  }
}