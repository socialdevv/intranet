import HomepageSettingsManager from "./homepage-settings-manager";
import SpotlightsManager from "./spotlights-manager";
import QuickLinksManager from "./quick-links-manager";

export default function HomeSectionManager() {
  return (
    <div className="space-y-10">
      <HomepageSettingsManager />

      <div className="border-t border-[#e5e7eb] pt-10 dark:border-[#1e293b]">
        <SpotlightsManager />
      </div>

      <div className="border-t border-[#e5e7eb] pt-10 dark:border-[#1e293b]">
        <QuickLinksManager />
      </div>
    </div>
  );
}
