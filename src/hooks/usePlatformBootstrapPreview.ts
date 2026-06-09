import { useData, type PlatformBootstrapState } from "@/contexts/data-context";

export type PlatformBootstrapPreviewState = PlatformBootstrapState;

export function usePlatformBootstrapPreview(): PlatformBootstrapPreviewState {
  const { platformBootstrapState } = useData();
  return platformBootstrapState;
}