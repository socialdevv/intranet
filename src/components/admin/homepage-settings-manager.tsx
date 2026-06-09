import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, LayoutDashboard } from "lucide-react";
import {
  MODULE_DEFINITIONS,
  QUICK_ACCESS_MAX_TILES,
  countActiveQuickAccessTiles,
  resolveQuickAccessOrder,
} from "@/lib/config/modules";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { buildVisibleQuickAccessItems } from "@/lib/project/project-home-sections";
import { ROUTES } from "@/lib/routes";
import type { AppModuleKey } from "@/lib/types/domain";

const MODULE_LABEL_BY_KEY = new Map(
  MODULE_DEFINITIONS.map((moduleDef) => [moduleDef.key, moduleDef.label])
);

export default function HomepageSettingsManager() {
  const { enabledModules, moduleSettings, navOrder, setModuleSettings } = useData();
  const { resolveHref } = useProjectRouting();
  const { push: pushToast } = useToast();

  const homeSectionsEnabled = Boolean(enabledModules.homeSections);
  const homepage = moduleSettings.homeSections.homepage;
  const quickAccessOrder = useMemo(
    () => resolveQuickAccessOrder(moduleSettings, navOrder),
    [moduleSettings, navOrder]
  );
  const activeTileCount = useMemo(
    () => countActiveQuickAccessTiles(enabledModules, moduleSettings),
    [enabledModules, moduleSettings]
  );
  const visibleQuickAccessPreview = useMemo(
    () => buildVisibleQuickAccessItems(enabledModules, moduleSettings, navOrder),
    [enabledModules, moduleSettings, navOrder]
  );
  const atTileLimit = activeTileCount >= QUICK_ACCESS_MAX_TILES;

  async function updateHomepage(partial: Partial<typeof homepage>) {
    await setModuleSettings("homeSections", {
      homepage: {
        ...homepage,
        ...partial,
      },
    });
  }

  async function persistQuickAccessOrder(nextOrder: AppModuleKey[]) {
    await updateHomepage({ quickAccessOrder: nextOrder });
  }

  function moveModule(moduleKey: AppModuleKey, direction: -1 | 1) {
    const currentIndex = quickAccessOrder.indexOf(moduleKey);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= quickAccessOrder.length) {
      return;
    }

    const nextOrder = [...quickAccessOrder];
    [nextOrder[currentIndex], nextOrder[targetIndex]] = [
      nextOrder[targetIndex],
      nextOrder[currentIndex],
    ];

    void persistQuickAccessOrder(nextOrder);
  }

  async function updateQuickAccessCard(
    moduleKey: AppModuleKey,
    partial: { visible?: boolean; title?: string; description?: string }
  ) {
    if (partial.visible === true && atTileLimit) {
      const settings = moduleSettings[moduleKey];
      const alreadyVisible = "homepageCard" in settings && settings.homepageCard.visible;

      if (!alreadyVisible) {
        pushToast(
          "error",
          `Możesz włączyć maksymalnie ${QUICK_ACCESS_MAX_TILES} kafelków szybkiego dostępu. Wyłącz inny kafelek, aby dodać ten moduł.`
        );
        return;
      }
    }

    const settings = moduleSettings[moduleKey];
    if (!("homepageCard" in settings)) {
      return;
    }

    await setModuleSettings(moduleKey, {
      ...settings,
      homepageCard: {
        ...settings.homepageCard,
        ...partial,
      },
    });
  }

  return (
    <section className="rounded-2xl border border-[#dbe4f0] bg-linear-to-br from-white via-[#f8fbff] to-[#eef5ff] p-5 shadow-sm dark:border-[#223147] dark:from-[#0f172a] dark:via-[#111b2e] dark:to-[#10223d]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5b7fb0] dark:text-[#7aa2d8]">
            <LayoutDashboard size={14} />
            Układ strony głównej
          </p>
          <h2 className="mt-2 text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Widoczność sekcji pulpitu
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-[#64748b] dark:text-[#94a3b8]">
            Ustal, które bloki pojawiają się na pulpicie projektu. Puste sekcje (bez treści) i tak nie
            są wyświetlane użytkownikom.
          </p>
        </div>
        <p className="rounded-lg border border-[#dbe4f0] bg-white/80 px-3 py-2 text-xs text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
          Kafelki na pulpicie:{" "}
          <span className="font-semibold text-[#1d4f91] dark:text-[#93c5fd]">
            {visibleQuickAccessPreview.length}/{QUICK_ACCESS_MAX_TILES}
          </span>
        </p>
      </div>

      {!homeSectionsEnabled ? (
        <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e] dark:border-[#78350f] dark:bg-[#2b2110] dark:text-[#fde68a]">
          Moduł{" "}
          <span className="font-semibold">Sekcje strony głównej</span> jest wyłączony — włącz go w{" "}
          <Link
            to={resolveHref(`${ROUTES.admin}?area=configuration&panel=moduly`)}
            className="font-semibold underline"
          >
            Konfiguracji modułów
          </Link>
          , aby sterować widocznością sekcji pulpitu.
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dde5ee] bg-white/90 p-3 dark:border-[#334155] dark:bg-[#0f172a]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1]"
            checked={homepage.showQuickAccess}
            disabled={!homeSectionsEnabled}
            onChange={(event) => void updateHomepage({ showQuickAccess: event.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Szybki dostęp
            </span>
            <span className="mt-0.5 block text-xs text-[#64748b] dark:text-[#94a3b8]">
              Do {QUICK_ACCESS_MAX_TILES} kafelków modułów z bocznego menu projektu.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dde5ee] bg-white/90 p-3 dark:border-[#334155] dark:bg-[#0f172a]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1]"
            checked={homepage.showSpotlights}
            disabled={!homeSectionsEnabled}
            onChange={(event) => void updateHomepage({ showSpotlights: event.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Ważne tematy
            </span>
            <span className="mt-0.5 block text-xs text-[#64748b] dark:text-[#94a3b8]">
              Wyróżnione artykuły — konfiguruj listę poniżej.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#dde5ee] bg-white/90 p-3 dark:border-[#334155] dark:bg-[#0f172a]">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-[#cbd5e1]"
            checked={homepage.showQuickLinks}
            disabled={!homeSectionsEnabled}
            onChange={(event) => void updateHomepage({ showQuickLinks: event.target.checked })}
          />
          <span>
            <span className="block text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Szybkie linki
            </span>
            <span className="mt-0.5 block text-xs text-[#64748b] dark:text-[#94a3b8]">
              Skróty operacyjne — konfiguruj listę poniżej.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6 border-t border-[#dbe4f0] pt-5 dark:border-[#334155]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
              Kafelki szybkiego dostępu
            </h3>
            <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              Wybierz moduły z bocznego menu projektu (maks. {QUICK_ACCESS_MAX_TILES} aktywnych),
              ustaw kolejność i opcjonalnie nadpisz tytuł oraz opis.
            </p>
          </div>
          <p
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              atTileLimit
                ? "border border-[#fde68a] bg-[#fffbeb] text-[#92400e] dark:border-[#78350f] dark:bg-[#2b2110] dark:text-[#fde68a]"
                : "border border-[#dbe4f0] bg-white/80 text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]"
            }`}
          >
            Aktywne: {activeTileCount}/{QUICK_ACCESS_MAX_TILES}
          </p>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-[#dde5ee] dark:border-[#334155]">
          <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#e5e7eb] bg-[#f8fafc] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:border-[#334155] dark:bg-[#0b1220] dark:text-[#94a3b8]">
                <th className="px-3 py-2">Kolejność</th>
                <th className="px-3 py-2">Moduł</th>
                <th className="px-3 py-2">Na pulpicie</th>
                <th className="px-3 py-2">Tytuł kafelka</th>
                <th className="px-3 py-2">Opis kafelka</th>
              </tr>
            </thead>
            <tbody>
              {quickAccessOrder.map((moduleKey, index) => {
                const moduleEnabled = Boolean(enabledModules[moduleKey]);
                const settings = moduleSettings[moduleKey];
                const cardSettings = "homepageCard" in settings ? settings.homepageCard : null;
                const isVisible = Boolean(cardSettings?.visible);
                const disableEnable =
                  !moduleEnabled ||
                  !homeSectionsEnabled ||
                  !homepage.showQuickAccess ||
                  (atTileLimit && !isVisible);

                return (
                  <tr
                    key={moduleKey}
                    className="border-b border-[#f1f5f9] last:border-b-0 dark:border-[#1e293b]"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={index === 0 || !homeSectionsEnabled}
                          onClick={() => moveModule(moduleKey, -1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#dde5ee] text-[#64748b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                          aria-label={`Przesuń ${MODULE_LABEL_BY_KEY.get(moduleKey)} wyżej`}
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={index === quickAccessOrder.length - 1 || !homeSectionsEnabled}
                          onClick={() => moveModule(moduleKey, 1)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#dde5ee] text-[#64748b] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                          aria-label={`Przesuń ${MODULE_LABEL_BY_KEY.get(moduleKey)} niżej`}
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                        {MODULE_LABEL_BY_KEY.get(moduleKey)}
                      </p>
                      {!moduleEnabled ? (
                        <p className="mt-0.5 text-[10px] text-[#b45309] dark:text-[#fbbf24]">
                          Moduł wyłączony — niedostępny na pulpicie
                        </p>
                      ) : isVisible && visibleQuickAccessPreview.some((item) => item.moduleKey === moduleKey) ? (
                        <p className="mt-0.5 text-[10px] text-[#166534] dark:text-[#86efac]">
                          Widoczny na pulpicie
                        </p>
                      ) : isVisible ? (
                        <p className="mt-0.5 text-[10px] text-[#b45309] dark:text-[#fbbf24]">
                          Włączony, ale poza limitem {QUICK_ACCESS_MAX_TILES} kafelków
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-[#cbd5e1]"
                        checked={isVisible}
                        disabled={disableEnable}
                        onChange={(event) =>
                          void updateQuickAccessCard(moduleKey, {
                            visible: event.target.checked,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={cardSettings?.title ?? ""}
                        disabled={!moduleEnabled || !homeSectionsEnabled || !homepage.showQuickAccess || !isVisible}
                        onChange={(event) =>
                          void updateQuickAccessCard(moduleKey, { title: event.target.value })
                        }
                        className="h-8 w-full min-w-[8rem] rounded-lg border border-[#dde5ee] bg-white px-2 text-xs dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="text"
                        value={cardSettings?.description ?? ""}
                        disabled={!moduleEnabled || !homeSectionsEnabled || !homepage.showQuickAccess || !isVisible}
                        onChange={(event) =>
                          void updateQuickAccessCard(moduleKey, {
                            description: event.target.value,
                          })
                        }
                        className="h-8 w-full min-w-[12rem] rounded-lg border border-[#dde5ee] bg-white px-2 text-xs dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
