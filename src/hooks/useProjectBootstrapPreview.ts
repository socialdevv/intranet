import { useData, type ProjectBootstrapState } from "@/contexts/data-context";

export type ProjectBootstrapPreviewState = ProjectBootstrapState;

export function useProjectBootstrapPreview(
  _pathname: string
): ProjectBootstrapPreviewState {
  const { projectBootstrapState } = useData();
  return projectBootstrapState;
}