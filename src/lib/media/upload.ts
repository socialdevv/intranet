import type { UploadFileOptions, UploadFileResult } from "@/lib/data/access";
import type { UploadContractCode } from "@/lib/integration/contracts";
import {
  DEFAULT_MEDIA_FOLDERS,
  createMediaAssetRef,
  type MediaAssetKind,
  type MediaAssetRef,
} from "@/lib/media/assets";

export type MediaUploadRequest = {
  kind: MediaAssetKind;
  file: File;
  folder?: string;
  filename?: string;
};

export type MediaUploadResult =
  | {
      ok: true;
      via: "api";
      asset: MediaAssetRef;
    }
  | {
      ok: false;
      code: Exclude<UploadContractCode, "uploaded-api">;
      message: string;
      suggestedPath?: string;
    };

export type UploadMediaFunction = (
  file: File,
  options?: UploadFileOptions
) => Promise<UploadFileResult>;

function buildSuggestedPath(kind: MediaAssetKind, filename: string): string {
  const folder = DEFAULT_MEDIA_FOLDERS[kind];
  return `${folder}/${filename}`;
}

export async function uploadMediaAsset(
  request: MediaUploadRequest,
  uploadFile: UploadMediaFunction
): Promise<MediaUploadResult> {
  const resolvedFilename = request.filename?.trim() || request.file.name;
  const resolvedFolder = request.folder?.trim() || DEFAULT_MEDIA_FOLDERS[request.kind];

  const uploadResult = await uploadFile(request.file, {
    folder: resolvedFolder,
    filename: resolvedFilename,
    mediaKind: request.kind,
  });

  if (uploadResult.ok) {
    return {
      ok: true,
      via: "api",
      asset: createMediaAssetRef({
        kind: request.kind,
        src: uploadResult.url,
        filename: resolvedFilename,
        mimeType: request.file.type,
        sizeBytes: request.file.size,
      }),
    };
  }

  const suggestedPath = buildSuggestedPath(request.kind, resolvedFilename);

  if (uploadResult.code === "not-configured") {
    return {
      ok: false,
      code: uploadResult.code,
      message: "Upload API nie jest skonfigurowany w tym wdrożeniu.",
      suggestedPath,
    };
  }

  if (uploadResult.code === "network") {
    return {
      ok: false,
      code: uploadResult.code,
      message: "Nie udało się połączyć z upload API. Spróbuj ponownie.",
      suggestedPath,
    };
  }

  return {
    ok: false,
    code: uploadResult.code,
    message: uploadResult.error,
    suggestedPath,
  };
}
