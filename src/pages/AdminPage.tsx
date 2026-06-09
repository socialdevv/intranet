import { Navigate, useSearchParams } from "react-router-dom";
import {
  BookOpen,
  AlertTriangle,
  History,
  Home,
  Network,
  Link,
  FileText,
  Contact,
  MessageSquareQuote,
  Bell,
  Lightbulb,
  Layers,
  ServerCog,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import KnowledgeContentManager from "@/components/admin/knowledge-content-manager";
import AuditHistoryManager from "@/components/admin/audit-history-manager";
import TemplatesManager from "@/components/admin/templates-manager";
import MatrixEntryList from "@/components/admin/matrix-entry-list";
import LinksManager from "@/components/admin/links-manager";
import FormsManager from "@/components/admin/forms-manager";
import HomeSectionManager from "@/components/admin/home-section-manager";
import ContactList from "@/components/admin/contact-list";
import PhraseList from "@/components/admin/phrase-list";
import AnnouncementsManager from "@/components/admin/announcements-manager";
import LeadManager from "@/components/admin/lead-manager";
import ModulesManager from "@/components/admin/modules-manager";
import SystemSettingsManager from "@/components/admin/system-settings-manager";
import IntegrityManager from "@/components/admin/integrity-manager";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import {
  canAccessAdminArea,
  canAccessAdminPanel,
  canAccessAdminPanelById,
  resolveAdminAreaForPanel,
  type AdminAreaId,
  type AdminPanelId,
} from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";

type AreaMeta = {
  id: AdminAreaId;
  label: string;
  description: string;
  icon: LucideIcon;
};

type PanelMeta = {
  id: AdminPanelId;
  area: AdminAreaId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const AREAS: AreaMeta[] = [
  {
    id: "content",
    label: "Treść",
    description: "Redakcja i utrzymanie zasobów wiedzy.",
    icon: BookOpen,
  },
  {
    id: "configuration",
    label: "Konfiguracja modułów",
    description: "Widoczność, kolejność i ustawienia modułów projektu.",
    icon: Layers,
  },
  {
    id: "system",
    label: "System",
    description: "Identyfikacja projektu, historia zmian i diagnostyka.",
    icon: ServerCog,
  },
];

const PANELS: PanelMeta[] = [
  {
    id: "wiedza",
    area: "content",
    label: "Baza wiedzy",
    description: "Artykuły, kategorie i kolejność wiedzy w jednym widoku roboczym.",
    icon: BookOpen,
  },
  {
    id: "historia",
    area: "system",
    label: "Historia zmian",
    description: "Chronologiczny dziennik zmian projektu z filtrowaniem po akcji, module i typie encji.",
    icon: History,
  },
  {
    id: "szablony",
    area: "content",
    label: "Szablony",
    description: "Kolejność i utrzymanie szablonów wiadomości.",
    icon: MessageSquareQuote,
  },
  {
    id: "startowa",
    area: "content",
    label: "Strona główna",
    description: "Układ pulpitu, kafelki szybkiego dostępu, ważne tematy i szybkie linki.",
    icon: Home,
  },
  {
    id: "linki",
    area: "content",
    label: "Linki",
    description: "Biblioteka linków operacyjnych.",
    icon: Link,
  },
  {
    id: "formularze",
    area: "content",
    label: "Formularze",
    description: "Definicje formularzy i podgląd przesłanych zgłoszeń.",
    icon: FileText,
  },
  {
    id: "kontakty",
    area: "content",
    label: "Kontakty",
    description: "Dane kontaktowe i grupy kontaktowe.",
    icon: Contact,
  },
  {
    id: "zwroty",
    area: "content",
    label: "Zwroty",
    description: "Gotowe frazy dla konsultantów.",
    icon: MessageSquareQuote,
  },
  {
    id: "ogloszenia",
    area: "content",
    label: "Ogłoszenia",
    description: "Komunikaty globalne w interfejsie.",
    icon: Bell,
  },
  {
    id: "moduly",
    area: "configuration",
    label: "Moduły",
    description: "Włączanie, widoczność, kolejność i ustawienia modułów.",
    icon: Layers,
  },
  {
    id: "macierz",
    area: "content",
    label: "Macierz",
    description: "Wpisy decyzyjne, reguły routingu oraz kolejność kategorii i wpisów.",
    icon: Network,
  },
  {
    id: "lead",
    area: "content",
    label: "Kwalifikacja leada",
    description: "Pytania, reguły i wyniki kwalifikacji.",
    icon: Lightbulb,
  },
  {
    id: "tozsamosc",
    area: "system",
    label: "Projekt",
    description: "Kod, nazwa i identyfikacja bieżącego wdrożenia.",
    icon: Settings,
  },
  {
    id: "integrity",
    area: "system",
    label: "Integralność",
    description: "Diagnostyka spójności treści, referencji i konfiguracji.",
    icon: AlertTriangle,
  },
];

const DEFAULT_PANEL: AdminPanelId = "wiedza";

const LEGACY_PANEL_ALIASES: Partial<Record<string, AdminPanelId>> = {
  artykuly: "wiedza",
  kategorie: "wiedza",
  kolejnosc: "wiedza",
};

function isAdminAreaId(value: string | null): value is AdminAreaId {
  return value === "content" || value === "configuration" || value === "system";
}

function isAdminPanelId(value: string | null): value is AdminPanelId {
  return value === "wiedza" || value === "historia" || value === "szablony" || value === "startowa" ||
    value === "linki" || value === "formularze" || value === "kontakty" || value === "zwroty" || value === "ogloszenia" ||
    value === "moduly" ||
    value === "macierz" || value === "lead" || value === "tozsamosc" || value === "integrity";
}

function normalizeAdminPanelId(value: string | null): AdminPanelId | null {
  if (!value) {
    return null;
  }

  return LEGACY_PANEL_ALIASES[value] ?? (isAdminPanelId(value) ? value : null);
}

export default function AdminPage() {
  const { user } = useAuth();
  const { projectBootstrapState } = useData();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canAccessAdminPanel(user)) return <Navigate to={ROUTES.home} replace />;

  function canAccessVisiblePanel(panelId: AdminPanelId): boolean {
    if (!canAccessAdminPanelById(user, panelId)) {
      return false;
    }

    if (panelId !== "historia") {
      return true;
    }

    return (
      projectBootstrapState.mode === "api" &&
      projectBootstrapState.status === "ready" &&
      projectBootstrapState.preview.capabilities.project.canViewAudit
    );
  }

  const visibleAreas = AREAS.filter((area) => canAccessAdminArea(user, area.id));
  const visiblePanelsAll = PANELS.filter((panel) => canAccessVisiblePanel(panel.id));

  if (visiblePanelsAll.length === 0) {
    return <Navigate to={ROUTES.home} replace />;
  }

  const requestedPanel = searchParams.get("panel") ?? searchParams.get("tab");
  const requestedPanelId = normalizeAdminPanelId(requestedPanel);
  const activePanelMeta =
    (requestedPanelId ? visiblePanelsAll.find((panel) => panel.id === requestedPanelId) : undefined) ??
    visiblePanelsAll.find((panel) => panel.id === DEFAULT_PANEL) ??
    visiblePanelsAll[0];

  const rawArea = searchParams.get("area");
  const requestedArea = isAdminAreaId(rawArea) ? rawArea : null;
  const activeArea: AdminAreaId = requestedPanel
    ? resolveAdminAreaForPanel(activePanelMeta.id)
    : requestedArea && canAccessAdminArea(user, requestedArea)
    ? requestedArea
    : resolveAdminAreaForPanel(activePanelMeta.id);

  const visiblePanels = visiblePanelsAll.filter((panel) => panel.area === activeArea);
  const activeAreaMeta = AREAS.find((area) => area.id === activeArea);
  const ActivePanelIcon = activePanelMeta.icon;

  function setActivePanel(panelId: AdminPanelId) {
    const panel = PANELS.find((row) => row.id === panelId);
    if (!panel) return;
    if (!canAccessVisiblePanel(panel.id)) return;
    const next = new URLSearchParams(searchParams);
    next.set("area", panel.area);
    next.set("panel", panel.id);
    // Backward-compatible deep-link support for existing links.
    next.set("tab", panel.id);
    setSearchParams(next);
  }

  function setActiveArea(areaId: AdminAreaId) {
    if (!canAccessAdminArea(user, areaId)) return;
    const firstPanel = visiblePanelsAll.find((panel) => panel.area === areaId);
    if (!firstPanel) return;
    setActivePanel(firstPanel.id);
  }

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-7xl pb-10">
        <div className="rounded-2xl border border-[#dbe4f0] bg-linear-to-br from-white via-[#f8fbff] to-[#eef5ff] p-5 shadow-sm dark:border-[#223147] dark:bg-linear-to-br dark:from-[#0f172a] dark:via-[#111b2e] dark:to-[#10223d] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7fb0] dark:text-[#7aa2d8]">
                Centrum zarządzania
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
                Panel administracyjny
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-[#5f6f86] dark:text-[#9fb3cc]">
                Panel został uproszczony do trzech realnych obszarów: treści, konfiguracji modułów
                i ustawień systemowych projektu.
              </p>
            </div>

            <div className="rounded-xl border border-[#d8e2f0] bg-white/70 px-3 py-2 text-right shadow-sm backdrop-blur dark:border-[#2b3a54] dark:bg-[#0f172a]/70">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7f9c] dark:text-[#94a3b8]">
                Aktywna sekcja
              </p>
              <p className="mt-0.5 text-sm font-semibold text-[#1d4f91] dark:text-[#93c5fd]">
                {activePanelMeta.label}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {visibleAreas.map((area) => {
              const Icon = area.icon;
              const active = area.id === activeArea;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setActiveArea(area.id)}
                  className={[
                    "rounded-xl border px-3 py-3 text-left transition",
                    active
                      ? "border-[#1d4f91] bg-[#1d4f91] text-white shadow-sm"
                      : "border-[#d8e2f0] bg-white/85 text-[#44566f] hover:bg-[#eef4fd] dark:border-[#2b3a54] dark:bg-[#0b1220]/65 dark:text-[#9fb3cc] dark:hover:bg-[#152338]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={active ? "text-white" : "text-[#6f86a4] dark:text-[#8fa1ba]"} />
                    <p className="text-sm font-semibold">{area.label}</p>
                  </div>
                  <p className={[
                    "mt-1 text-xs leading-relaxed",
                    active ? "text-white/85" : "text-[#6b7f9c] dark:text-[#8ea1bb]",
                  ].join(" ")}>
                    {area.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[#d8e2f0] bg-white/80 p-2 shadow-inner backdrop-blur dark:border-[#2b3a54] dark:bg-[#0b1220]/60">
            <div className="flex flex-wrap gap-2" aria-label="Podsekcje panelu administracyjnego">
              {visiblePanels.map((panel) => {
                const Icon = panel.icon;
                const active = panel.id === activePanelMeta.id;
                return (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setActivePanel(panel.id)}
                    className={[
                      "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-3.5",
                      active
                        ? "bg-[#1d4f91] text-white shadow-sm ring-1 ring-[#1a4580]"
                        : "text-[#56657b] hover:bg-[#eef4fd] hover:text-[#21324a] dark:text-[#a6b4c7] dark:hover:bg-[#1c2a40] dark:hover:text-[#d5e0ef]",
                    ].join(" ")}
                  >
                    <Icon size={14} className={active ? "text-white" : "text-[#7b8da6] group-hover:text-current dark:text-[#8fa1ba]"} />
                    <span className="leading-none">{panel.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 px-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
              {activePanelMeta.description}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-[#e5e7eb] bg-white p-4 shadow-sm dark:border-[#1f2937] dark:bg-[#111827] sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[#e5e7eb] pb-4 dark:border-[#1f2937]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e9f2ff] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
                <ActivePanelIcon size={16} />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b] dark:text-[#94a3b8]">
                  Aktywny moduł administracyjny
                </p>
                <h2 className="mt-0.5 text-base font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                  {activePanelMeta.label}
                </h2>
                <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
                  {activePanelMeta.description}
                </p>
              </div>
            </div>
            {activeAreaMeta ? (
              <span className="inline-flex items-center rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                Obszar: {activeAreaMeta.label}
              </span>
            ) : null}
          </div>

          {activePanelMeta.id === "wiedza" && <KnowledgeContentManager />}
          {activePanelMeta.id === "historia" && <AuditHistoryManager />}
          {activePanelMeta.id === "szablony" && <TemplatesManager />}
          {activePanelMeta.id === "macierz" && <MatrixEntryList />}
          {activePanelMeta.id === "linki" && <LinksManager />}
          {activePanelMeta.id === "formularze" && <FormsManager />}
          {activePanelMeta.id === "kontakty" && <ContactList />}
          {activePanelMeta.id === "zwroty" && <PhraseList />}
          {activePanelMeta.id === "ogloszenia" && <AnnouncementsManager />}
          {activePanelMeta.id === "lead" && <LeadManager />}
          {activePanelMeta.id === "startowa" && <HomeSectionManager />}
          {activePanelMeta.id === "moduly" && <ModulesManager />}
          {activePanelMeta.id === "tozsamosc" && <SystemSettingsManager />}
          {activePanelMeta.id === "integrity" && <IntegrityManager />}
        </div>
      </section>
    </AppShell>
  );
}
