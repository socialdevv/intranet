import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MediaKind } from "@prisma/client";
import type { AppEnv } from "../config/env.js";

export const MEDIA_KIND_FOLDERS: Record<MediaKind, string> = {
  image: "photos",
  video: "videos",
  file: "files",
};

const REPO_ROOT = path.dirname(
  fileURLToPath(new URL("../../../package.json", import.meta.url))
);

function resolveMediaStorageRoot(env: AppEnv): string {
  const configuredRoot = env.MEDIA_STORAGE_ROOT?.trim();
  return configuredRoot ? path.resolve(configuredRoot) : path.join(REPO_ROOT, "runtime-media");
}

export function resolveMediaDiskDirectory(env: AppEnv, mediaKind: MediaKind): string {
  return path.join(resolveMediaStorageRoot(env), MEDIA_KIND_FOLDERS[mediaKind]);
}

export function resolveStoredMediaPath(
  mediaKind: MediaKind,
  projectSlug: string,
  storedFilename: string
): string {
  return path.posix.join(MEDIA_KIND_FOLDERS[mediaKind], projectSlug, storedFilename);
}

export function resolveAbsoluteMediaPath(env: AppEnv, relativePath: string): string {
  return path.join(resolveMediaStorageRoot(env), ...relativePath.split("/"));
}

export async function ensureMediaStorageDirectories(env: AppEnv): Promise<void> {
  await Promise.all(
    Object.values(MediaKind).map((mediaKind) =>
      mkdir(resolveMediaDiskDirectory(env, mediaKind), { recursive: true })
    )
  );
}