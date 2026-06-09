import type { AppData } from "@/lib/types/domain";

export type ModuleDataSource = "api" | "legacy";
export type ProjectModuleDeps = {
  activeProjectSlug: string;
  apiMode: boolean;
  apiRuntimeRefreshKey: number;
  legacyData: AppData;
  setLegacyData: (next: AppData) => void;
};
