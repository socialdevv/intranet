import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, Layers, ToggleLeft, ToggleRight } from "lucide-react";
import { DEFAULT_NAV_ORDER, MODULE_DEFINITIONS } from "@/lib/config/modules";
import { useData } from "@/contexts/data-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { ROUTES } from "@/lib/routes";

export default function ModulesManager() {
  const { navOrder, enabledModules, moduleSettings, setNavOrder, setModuleEnabled, setModuleSettings } = useData();
  const { resolveHref } = useProjectRouting();
  const homepageAdminHref = resolveHref(`${ROUTES.admin}?area=content&panel=startowa`);
  const [expandedModuleKeys, setExpandedModuleKeys] = useState<Record<string, boolean>>({});

  const enabledCount = MODULE_DEFINITIONS.filter((m) => enabledModules[m.key]).length;
  const orderedModules = useMemo(() => {
    const navModuleMap = new Map(
      MODULE_DEFINITIONS.filter((moduleDef) => moduleDef.navKey).map((moduleDef) => [moduleDef.navKey as string, moduleDef])
    );
    const orderedNavigationModules = navOrder
      .filter((navKey) => navKey !== "home")
      .map((navKey) => navModuleMap.get(navKey) ?? null)
      .filter((moduleDef): moduleDef is (typeof MODULE_DEFINITIONS)[number] => moduleDef !== null);
    const orderedModuleKeys = new Set(orderedNavigationModules.map((moduleDef) => moduleDef.key));

    return [
      ...orderedNavigationModules,
      ...MODULE_DEFINITIONS.filter((moduleDef) => !orderedModuleKeys.has(moduleDef.key)),
    ];
  }, [navOrder]);

  const toggleExpanded = (moduleKey: string) => {
    setExpandedModuleKeys((prev) => ({
      ...prev,
      [moduleKey]: !prev[moduleKey],
    }));
  };

  const inputClassName =
    "w-full rounded-md border border-[#dbe4ef] bg-white px-2.5 py-1.5 text-xs text-[#0f172a] shadow-sm outline-none transition focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:text-[#e2e8f0]";

  const settingsCardClassName =
    "mt-3 rounded-lg border border-[#e6edf5] bg-[#f8fbff] p-3 dark:border-[#1f334d] dark:bg-[#0b1a2c]";

  function moveNavModule(navKey: string, direction: -1 | 1) {
    const currentIndex = navOrder.indexOf(navKey);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex <= 0 || targetIndex >= navOrder.length) {
      return;
    }

    const next = [...navOrder];
    [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
    void setNavOrder(next);
  }

  function resetNavigationOrder() {
    void setNavOrder([...DEFAULT_NAV_ORDER]);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-[#dde5ee] bg-white dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#edf1f5] px-5 py-4 dark:border-[#1e293b]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
              Konfiguracja modułów
            </p>
            <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              Kolejność odpowiada bieżącemu układowi menu projektu, a ustawienia pozostają przy każdym module.
            </p>
          </div>
          <button
            type="button"
            onClick={resetNavigationOrder}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] px-3 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Przywróć domyślną kolejność
          </button>
        </div>

        <div className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
          {orderedModules.map((moduleDef) => {
            const enabled = enabledModules[moduleDef.key];
            const settings = moduleSettings[moduleDef.key];
            const canConfigure =
              moduleDef.supports.navigation ||
              moduleDef.supports.homepageCard ||
              moduleDef.supports.customSettings !== "none";
            const isExpanded = expandedModuleKeys[moduleDef.key] ?? false;
            const navIndex = moduleDef.navKey ? navOrder.indexOf(moduleDef.navKey) : -1;
            const navigationVisible =
              moduleDef.supports.navigation && settings && "navigation" in settings
                ? settings.navigation.visible
                : false;

            return (
              <div key={moduleDef.key} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void setModuleEnabled(moduleDef.key, !enabled);
                    }}
                    aria-pressed={enabled}
                    className="mt-0.5 inline-flex shrink-0 items-center rounded-md text-[#1d4f91] transition hover:text-[#163d72] dark:text-[#60a5fa] dark:hover:text-[#93c5fd]"
                  >
                    {enabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                        {moduleDef.label}
                      </p>
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          enabled
                            ? "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d]/30 dark:text-[#4ade80]"
                            : "bg-[#fee2e2] text-[#b91c1c] dark:bg-[#7f1d1d]/30 dark:text-[#f87171]",
                        ].join(" ")}
                      >
                        {enabled ? "Włączony" : "Wyłączony"}
                      </span>

                      {moduleDef.navKey ? (
                        <span className="rounded-full border border-[#d7e2ef] bg-[#f8fbff] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#5f6f86] dark:border-[#1f334d] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                          Menu #{navIndex > 0 ? navIndex : "-"}
                        </span>
                      ) : (
                        <span className="rounded-full border border-[#e5e7eb] bg-[#f8fafc] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
                          Poza nawigacją
                        </span>
                      )}

                      {moduleDef.supports.navigation && settings && "navigation" in settings ? (
                        <span className="rounded-full border border-[#d7e2ef] bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-[#5f6f86] dark:border-[#1f334d] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                          {navigationVisible ? "Widoczny w menu" : "Ukryty w menu"}
                        </span>
                      ) : null}

                      {canConfigure ? (
                        <button
                          type="button"
                          onClick={() => toggleExpanded(moduleDef.key)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#d7e2ef] bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#1d4f91] transition hover:bg-[#eff6ff] dark:border-[#1f334d] dark:bg-[#0f172a] dark:text-[#93c5fd] dark:hover:bg-[#0d223d]"
                        >
                          Ustawienia
                          <ChevronDown
                            size={12}
                            className={isExpanded ? "rotate-180 transition" : "transition"}
                          />
                        </button>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
                      {moduleDef.description}
                    </p>
                  </div>

                  {moduleDef.navKey ? (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveNavModule(moduleDef.navKey as string, -1)}
                        disabled={navIndex <= 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                        aria-label="Przesuń moduł wyżej"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNavModule(moduleDef.navKey as string, 1)}
                        disabled={navIndex < 1 || navIndex >= navOrder.length - 1}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#e5e7eb] text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
                        aria-label="Przesuń moduł niżej"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  ) : null}
                </div>

                {canConfigure && isExpanded ? (
                  <div className={settingsCardClassName}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {moduleDef.supports.navigation && settings && "navigation" in settings ? (
                        <>
                          <label className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#cbd5e1]">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[#cbd5e1]"
                              checked={settings.navigation.visible}
                              onChange={(e) =>
                                void setModuleSettings(moduleDef.key, {
                                  ...settings,
                                  navigation: {
                                    ...settings.navigation,
                                    visible: e.target.checked,
                                  },
                                })
                              }
                            />
                            Pokazuj w nawigacji
                          </label>

                          <label className="space-y-1 text-xs text-[#475569] dark:text-[#94a3b8]">
                            <span>Etykieta w nawigacji</span>
                            <input
                              type="text"
                              value={settings.navigation.label}
                              onChange={(e) =>
                                void setModuleSettings(moduleDef.key, {
                                  ...settings,
                                  navigation: {
                                    ...settings.navigation,
                                    label: e.target.value,
                                  },
                                })
                              }
                              className={inputClassName}
                            />
                          </label>
                        </>
                      ) : null}

                      {moduleDef.supports.homepageCard && settings && "homepageCard" in settings ? (
                        <p className="text-xs text-[#64748b] sm:col-span-2 dark:text-[#94a3b8]">
                          Kafelek szybkiego dostępu konfigurujesz w panelu{" "}
                          <Link to={homepageAdminHref} className="font-semibold text-[#1d4f91] underline dark:text-[#93c5fd]">
                            Strona główna
                          </Link>
                          .
                        </p>
                      ) : null}

                      {moduleDef.supports.customSettings === "homeSections" ? (
                        <p className="text-xs text-[#64748b] sm:col-span-2 dark:text-[#94a3b8]">
                          Widoczność sekcji pulpitu i kafelki szybkiego dostępu ustawiasz w panelu{" "}
                          <Link to={homepageAdminHref} className="font-semibold text-[#1d4f91] underline dark:text-[#93c5fd]">
                            Strona główna
                          </Link>
                          .
                        </p>
                      ) : null}

                      {moduleDef.supports.customSettings === "lead" ? (
                        <>
                          <label className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#cbd5e1]">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[#cbd5e1]"
                              checked={moduleSettings.lead.widget.enabledInShell}
                              onChange={(e) =>
                                void setModuleSettings("lead", {
                                  widget: {
                                    ...moduleSettings.lead.widget,
                                    enabledInShell: e.target.checked,
                                  },
                                })
                              }
                            />
                            Pokazuj widget w aplikacji
                          </label>

                          <label className="space-y-1 text-xs text-[#475569] dark:text-[#94a3b8]">
                            <span>Tytuł widgetu</span>
                            <input
                              type="text"
                              value={moduleSettings.lead.widget.title}
                              onChange={(e) =>
                                void setModuleSettings("lead", {
                                  widget: {
                                    ...moduleSettings.lead.widget,
                                    title: e.target.value,
                                  },
                                })
                              }
                              className={inputClassName}
                            />
                          </label>
                        </>
                      ) : null}

                      {moduleDef.supports.customSettings === "announcements" ? (
                        <>
                          <label className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#cbd5e1]">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[#cbd5e1]"
                              checked={moduleSettings.announcements.surfaces.showTopbarPills}
                              onChange={(e) =>
                                void setModuleSettings("announcements", {
                                  surfaces: {
                                    ...moduleSettings.announcements.surfaces,
                                    showTopbarPills: e.target.checked,
                                  },
                                })
                              }
                            />
                            Pokazuj paski w topbarze
                          </label>

                          <label className="flex items-center gap-2 text-xs text-[#334155] dark:text-[#cbd5e1]">
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 rounded border-[#cbd5e1]"
                              checked={moduleSettings.announcements.surfaces.showHomePills}
                              onChange={(e) =>
                                void setModuleSettings("announcements", {
                                  surfaces: {
                                    ...moduleSettings.announcements.surfaces,
                                    showHomePills: e.target.checked,
                                  },
                                })
                              }
                            />
                            Pokazuj paski na stronie głównej
                          </label>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="mb-3 flex items-center gap-2">
          <Layers size={15} className="text-[#64748b] dark:text-[#94a3b8]" />
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Konfiguracja modułów
          </h3>
        </div>
        <div className="space-y-3 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
          <p>
            Moduły są uporządkowane tak, jak pojawiają się w menu projektu, więc widoczność i kolejność są zarządzane w jednym miejscu.
          </p>
          <p>
            Dodatkowe ustawienia pozostają przypięte do konkretnego modułu: etykiet, kart strony głównej i zachowania interfejsu.
          </p>
          <p>
            Po ponownym włączeniu modułu zachowana zostaje poprzednia konfiguracja ustawień i danych.
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-xs font-medium text-[#334155] dark:border-[#1e293b] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
          Aktywne moduły: {enabledCount} / {MODULE_DEFINITIONS.length}
        </div>
        <div className="mt-2 rounded-lg border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2 text-xs font-medium text-[#334155] dark:border-[#1e293b] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
          Moduły w menu: {navOrder.length - 1}
        </div>
      </aside>
    </div>
  );
}
