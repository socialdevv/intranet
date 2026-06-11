import type { MediaAssetKind } from "@/lib/media/assets";
import {
  UPLOAD_API_ERROR_CODES,
  UPLOAD_VIDEO_LARGE_TIER_MAX_COUNT,
  UPLOAD_VIDEO_SMALL_TIER_MAX_BYTES,
  UPLOAD_VIDEO_SMALL_TIER_MAX_COUNT,
  buildPerKindSizeLimitMessage,
  formatUploadMegabytes,
} from "@/lib/media/upload-policy";

export { buildPerKindSizeLimitMessage };

const KIND_TYPE_LABELS: Record<MediaAssetKind, string> = {
  image: "zdjęcie",
  file: "dokument",
  video: "wideo",
};

export function buildWrongMediaKindMessage(mediaKind: MediaAssetKind): string {
  return `Wybrany plik nie jest prawidłowym typem (${KIND_TYPE_LABELS[mediaKind]}).`;
}

export function replaceByteCountsWithMegabytes(message: string): string {
  return message.replace(/(\d{4,})\s*-?\s*bajt(ów|y)?/gi, (_, rawBytes: string) =>
    formatUploadMegabytes(Number(rawBytes))
  ).replace(/(\d{4,})\s*-?\s*bytes?/gi, (_, rawBytes: string) =>
    formatUploadMegabytes(Number(rawBytes))
  );
}

function localizeCapacityExceededMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("small video")) {
    return `Projekt osiągnął limit ${UPLOAD_VIDEO_SMALL_TIER_MAX_COUNT} małych plików wideo (do ${formatUploadMegabytes(UPLOAD_VIDEO_SMALL_TIER_MAX_BYTES)}). Usuń istniejące wideo przed dodaniem kolejnego.`;
  }

  if (normalized.includes("large video")) {
    return `Projekt osiągnął limit ${UPLOAD_VIDEO_LARGE_TIER_MAX_COUNT} dużych plików wideo (powyżej ${formatUploadMegabytes(UPLOAD_VIDEO_SMALL_TIER_MAX_BYTES)}). Usuń istniejące wideo przed dodaniem kolejnego.`;
  }

  return replaceByteCountsWithMegabytes(message);
}

export function localizeUploadErrorMessage(
  message: string,
  options?: {
    mediaKind?: MediaAssetKind;
    apiErrorCode?: string | null;
  }
): string {
  const apiErrorCode = options?.apiErrorCode ?? null;

  if (apiErrorCode === UPLOAD_API_ERROR_CODES.tooLarge) {
    return options?.mediaKind
      ? buildPerKindSizeLimitMessage(options.mediaKind)
      : "Plik przekracza dopuszczalny rozmiar.";
  }

  if (apiErrorCode === UPLOAD_API_ERROR_CODES.capacityExceeded) {
    return localizeCapacityExceededMessage(message);
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return "Nie udało się przesłać pliku.";
  }

  const withMegabytes = replaceByteCountsWithMegabytes(trimmed);

  const englishToPolish: Array<[RegExp, string]> = [
    [/upload api is not configured/i, "API przesyłania plików nie jest skonfigurowane w tym wdrożeniu."],
    [/could not connect|nie udało się połączyć/i, "Nie udało się połączyć z API przesyłania plików. Spróbuj ponownie."],
    [/uploaded file is empty/i, "Wybrany plik jest pusty."],
    [/upload zakończony błędem http (\d+)/i, "Przesyłanie zakończyło się błędem HTTP $1."],
    [/invalid response/i, "Serwer zwrócił nieprawidłową odpowiedź po przesłaniu pliku."],
    [/exceeds the maximum size/i, "przekracza dopuszczalny rozmiar"],
    [/uploaded (image|file|video)/i, "Przesłany plik"],
  ];

  let localized = withMegabytes;
  for (const [pattern, replacement] of englishToPolish) {
    localized = localized.replace(pattern, replacement);
  }

  return localized;
}
