import type { MediaAssetKind } from "@/lib/media/assets";

/** Mirrors server per-kind limits (`project-upload-capacity.ts`). */
export const UPLOAD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const UPLOAD_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const UPLOAD_VIDEO_MAX_BYTES = 300 * 1024 * 1024;

/** Tiered capacity applies to videos only. */
export const UPLOAD_VIDEO_SMALL_TIER_MAX_BYTES = 25 * 1024 * 1024;
export const UPLOAD_VIDEO_SMALL_TIER_MAX_COUNT = 10;
export const UPLOAD_VIDEO_LARGE_TIER_MAX_COUNT = 3;

export const UPLOAD_API_ERROR_CODES = {
  tooLarge: "UPLOAD_TOO_LARGE",
  capacityExceeded: "UPLOAD_CAPACITY_EXCEEDED",
} as const;

export type UploadApiErrorCode =
  (typeof UPLOAD_API_ERROR_CODES)[keyof typeof UPLOAD_API_ERROR_CODES];

const MAX_BYTES_BY_KIND: Record<MediaAssetKind, number> = {
  image: UPLOAD_IMAGE_MAX_BYTES,
  file: UPLOAD_FILE_MAX_BYTES,
  video: UPLOAD_VIDEO_MAX_BYTES,
};

const KIND_LIMIT_LABELS: Record<MediaAssetKind, string> = {
  image: "zdjęć",
  file: "dokumentów",
  video: "wideo",
};

export function formatUploadMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

export function resolvePerKindMaxBytes(mediaKind: MediaAssetKind): number {
  return MAX_BYTES_BY_KIND[mediaKind];
}

export function buildPerKindSizeLimitMessage(mediaKind: MediaAssetKind): string {
  return `Maksymalna wielkość pliku dla ${KIND_LIMIT_LABELS[mediaKind]} to ${formatUploadMegabytes(resolvePerKindMaxBytes(mediaKind))}.`;
}

export function describeUploadLimitForKind(mediaKind: MediaAssetKind): string {
  const maxLabel = `maks. ${formatUploadMegabytes(resolvePerKindMaxBytes(mediaKind))}`;

  if (mediaKind !== "video") {
    return maxLabel;
  }

  return `${maxLabel} • do ${formatUploadMegabytes(UPLOAD_VIDEO_SMALL_TIER_MAX_BYTES)}: max ${UPLOAD_VIDEO_SMALL_TIER_MAX_COUNT} wideo • większe: max ${UPLOAD_VIDEO_LARGE_TIER_MAX_COUNT} wideo`;
}

export function validateClientUploadSize(
  fileSize: number,
  mediaKind: MediaAssetKind
): { ok: true } | { ok: false; message: string } {
  if (fileSize <= 0) {
    return {
      ok: false,
      message: "Wybrany plik jest pusty.",
    };
  }

  const maxBytes = resolvePerKindMaxBytes(mediaKind);
  if (fileSize > maxBytes) {
    return {
      ok: false,
      message: buildPerKindSizeLimitMessage(mediaKind),
    };
  }

  return { ok: true };
}

export function isUploadPolicyApiErrorCode(
  code: string | null | undefined
): code is UploadApiErrorCode {
  return (
    code === UPLOAD_API_ERROR_CODES.tooLarge ||
    code === UPLOAD_API_ERROR_CODES.capacityExceeded
  );
}
