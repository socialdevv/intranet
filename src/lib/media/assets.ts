export type MediaAssetKind = "image" | "video" | "file";

export type MediaAssetSource =
  | "deployment-public"
  | "api-upload"
  | "external-url"
  | "data-uri"
  | "blob-uri"
  | "unknown";

export type MediaAssetRef = {
  kind: MediaAssetKind;
  src: string;
  source: MediaAssetSource;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  alt?: string;
  title?: string;
};

export const DEFAULT_MEDIA_FOLDERS: Record<MediaAssetKind, string> = {
  image: "photos",
  video: "videos",
  file: "files",
};

/**
 * Normalize media src so it works with Vite base="./" and deployment-local static files.
 * Keeps absolute URLs/data/blob untouched and rewrites leading "/path" to "path".
 */
export function normalizeMediaSrc(raw: string): string {
  const s = raw.trim();
  if (!s) return s;
  if (/^(https?:|data:|blob:|\/\/)/.test(s)) return s;
  if (s.startsWith("/")) return s.slice(1);
  return s;
}

export function detectMediaAssetSource(src: string): MediaAssetSource {
  const normalized = normalizeMediaSrc(src);
  if (!normalized) return "unknown";
  if (/^https?:\/\//.test(normalized) || normalized.startsWith("//")) {
    return "external-url";
  }
  if (normalized.startsWith("data:")) return "data-uri";
  if (normalized.startsWith("blob:")) return "blob-uri";
  if (/^uploads\//.test(normalized)) return "api-upload";
  if (/^[^:]+\//.test(normalized) || normalized.startsWith(".")) return "deployment-public";
  return "deployment-public";
}

export function createMediaAssetRef(input: {
  kind: MediaAssetKind;
  src: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  alt?: string;
  title?: string;
}): MediaAssetRef {
  const normalizedSrc = normalizeMediaSrc(input.src);
  return {
    kind: input.kind,
    src: normalizedSrc,
    source: detectMediaAssetSource(normalizedSrc),
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    alt: input.alt,
    title: input.title,
  };
}

export function suggestAltFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "");
  return base.replace(/[._-]+/g, " ").trim();
}
