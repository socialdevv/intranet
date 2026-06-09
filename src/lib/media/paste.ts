import {
  DEFAULT_MEDIA_FOLDERS,
  normalizeMediaSrc,
  type MediaAssetKind,
} from "@/lib/media/assets";
import type {
  MediaUploadRequest,
  MediaUploadResult,
} from "@/lib/media/upload";

export type UploadAssetFn = (
  request: MediaUploadRequest
) => Promise<MediaUploadResult>;

export type ClipboardImageCandidate =
  | { type: "clipboard-file"; file: File }
  | { type: "html-image-src"; src: string };

export type ClipboardImagePayload = {
  candidates: ClipboardImageCandidate[];
  hasTextualContent: boolean;
};

export type ResolvedClipboardImage =
  | {
      ok: true;
      src: string;
      alt: string;
      via: "api-upload" | "data-uri-fallback" | "suggested-path" | "html-src";
      note?: string;
    }
  | {
      ok: false;
      note: string;
    };

function trimToSingleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function htmlHasTextContent(rawHtml: string): boolean {
  if (!rawHtml.trim()) return false;
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  doc.querySelectorAll("img").forEach((img) => img.remove());
  return trimToSingleLine(doc.body.textContent ?? "").length > 0;
}

function extractHtmlImageSources(rawHtml: string): string[] {
  if (!rawHtml.trim()) return [];
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const unique = new Set<string>();
  doc.querySelectorAll("img[src]").forEach((img) => {
    const src = img.getAttribute("src")?.trim();
    if (!src) return;
    unique.add(src);
  });
  return Array.from(unique);
}

function fileNameToAlt(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "");
  return base.replace(/[._-]+/g, " ").trim();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const { result } = reader;
      if (typeof result === "string" && result.startsWith("data:")) {
        resolve(result);
        return;
      }
      reject(new Error("Clipboard image could not be converted to data URI."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed."));
    reader.readAsDataURL(file);
  });
}

function buildSuggestedPath(kind: MediaAssetKind, fileName: string): string {
  return `${DEFAULT_MEDIA_FOLDERS[kind]}/${fileName}`;
}

export function collectClipboardImagePayload(
  clipboardData: DataTransfer | null
): ClipboardImagePayload {
  if (!clipboardData) {
    return { candidates: [], hasTextualContent: false };
  }

  const imageFiles: File[] = [];
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) imageFiles.push(file);
  }

  const rawHtml = clipboardData.getData("text/html") || "";
  const plainText = trimToSingleLine(clipboardData.getData("text/plain") || "");
  const hasTextualContent = plainText.length > 0 || htmlHasTextContent(rawHtml);

  const candidates: ClipboardImageCandidate[] = imageFiles.map((file) => ({
    type: "clipboard-file",
    file,
  }));

  // Avoid duplicate image insertions when clipboard already includes binary image files.
  if (imageFiles.length === 0) {
    for (const src of extractHtmlImageSources(rawHtml)) {
      candidates.push({ type: "html-image-src", src });
    }
  }

  return { candidates, hasTextualContent };
}

export async function resolveClipboardImageCandidate(
  candidate: ClipboardImageCandidate,
  uploadAsset: UploadAssetFn
): Promise<ResolvedClipboardImage> {
  if (candidate.type === "html-image-src") {
    const normalized = normalizeMediaSrc(candidate.src);
    if (!normalized) {
      return { ok: false, note: "Pominieto pusty obraz z HTML schowka." };
    }
    if (normalized.startsWith("blob:")) {
      return {
        ok: false,
        note:
          "Pominieto obraz blob: ze schowka HTML (zrodlo tymczasowe i niedostepne po wklejeniu).",
      };
    }
    return {
      ok: true,
      src: normalized,
      alt: "",
      via: "html-src",
    };
  }

  const { file } = candidate;
  const uploadResult = await uploadAsset({
    kind: "image",
    file,
    folder: DEFAULT_MEDIA_FOLDERS.image,
  });

  if (uploadResult.ok) {
    return {
      ok: true,
      src: normalizeMediaSrc(uploadResult.asset.src),
      alt: fileNameToAlt(file.name),
      via: "api-upload",
    };
  }

  try {
    const dataUrl = await fileToDataUrl(file);
    return {
      ok: true,
      src: dataUrl,
      alt: fileNameToAlt(file.name),
      via: "data-uri-fallback",
      note: `${uploadResult.message} Obraz został osadzony jako data URI (lokalny fallback).`,
    };
  } catch {
    const fallbackPath = uploadResult.suggestedPath || buildSuggestedPath("image", file.name);
    return {
      ok: true,
      src: normalizeMediaSrc(fallbackPath),
      alt: fileNameToAlt(file.name),
      via: "suggested-path",
      note: uploadResult.message,
    };
  }
}
