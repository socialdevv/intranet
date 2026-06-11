import { useCallback } from "react";
import { useData } from "@/contexts/data-context";
import {
  uploadMediaAsset,
  type MediaUploadRequest,
  type MediaUploadResult,
} from "@/lib/media/upload";

export function useMediaUpload() {
  const { uploadFile, persistenceState } = useData();

  const uploadAsset = useCallback(
    async (request: MediaUploadRequest): Promise<MediaUploadResult> => {
      return uploadMediaAsset(request, uploadFile);
    },
    [uploadFile]
  );

  return {
    uploadAsset,
    uploadConfigured: persistenceState.uploadCapability === "configured",
    uploadCapabilityReason: persistenceState.uploadCapabilityReason,
  };
}
