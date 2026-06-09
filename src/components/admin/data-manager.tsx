import { useMemo, useRef, type ReactNode } from "react";
import { HardDrive, PackageOpen, AlertTriangle, Database, RefreshCw, Upload, Download } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";

export default function DataManager() {
  const {
    exportData,
    importData,
    clearLocalOverrides,
    localOverrideActive,
    storedLocalOverrideAvailable,
    dataStorageMode,
    appBuildVersion,
    currentSchemaVersion,
    dataSchemaVersion,
    lastLoadDiagnostics,
    lastImportDiagnostics,
    lastExportDiagnostics,
    persistenceState,
  } = useData();
  const { push: toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestedExportFilename = useMemo(() => "altcloud-data.json", []);

  const loadSourceLabel = useMemo(() => {
    if (!lastLoadDiagnostics) return "Nieustalone";
    if (lastLoadDiagnostics.source === "local-override") return "lokalne nadpisania (localStorage)";
    if (lastLoadDiagnostics.source === "bundled-default") return "plik domyślny (altcloud-data.json)";
    if (lastLoadDiagnostics.source === "api") return "API-assisted";
    return "awaryjne puste dane (fallback)";
  }, [lastLoadDiagnostics]);

  const persistenceStatusLabel = useMemo(() => {
    if (persistenceState.status === "saving") return "zapisywanie";
    if (persistenceState.status === "saved") return "zapisano";
    if (persistenceState.status === "unsaved") return "zmiany oczekujące";
    if (persistenceState.status === "failed") return "błąd zapisu";
    return "bez zmian";
  }, [persistenceState.status]);

  const localOverrideStatus = useMemo(() => {
    if (localOverrideActive) {
      return {
        value: "aktywne",
        hint: "Pracujesz na localStorage",
      };
    }

    if (persistenceState.appDataLocalStorageSuppressed && storedLocalOverrideAvailable) {
      return {
        value: "zignorowane",
        hint: "Tryb API ignoruje zapisane nadpisania localStorage",
      };
    }

    if (persistenceState.appDataLocalStorageSuppressed) {
      return {
        value: "wyłączone",
        hint: "Tryb API ignoruje localStorage dla danych aplikacji",
      };
    }

    return {
      value: "nieaktywne",
      hint: "Pracujesz na danych domyślnych",
    };
  }, [localOverrideActive, persistenceState.appDataLocalStorageSuppressed, storedLocalOverrideAvailable]);

  const persistenceHint = useMemo(() => {
    if (persistenceState.appDataLocalStorageSuppressed) {
      return storedLocalOverrideAvailable
        ? "Tryb API ignoruje zapisane nadpisania app data w localStorage. Zmiany legacy pozostają tylko w bieżącej sesji, a backend-backed slice'y zapisują się osobno."
        : "Tryb API wyłączył persystencję app data do localStorage. Zmiany legacy pozostają tylko w bieżącej sesji, a backend-backed slice'y zapisują się osobno.";
    }

    const modeHint =
      persistenceState.saveCapability === "not-configured"
        ? "Zapis API nie jest skonfigurowany. Aplikacja działa w trybie lokalnym."
        : persistenceState.fallbackModeActive
          ? "Aktywny tryb lokalny (fallback)."
          : "Bezpośredni zapis API jest gotowy.";

    if (persistenceState.status === "failed" && persistenceState.lastError) {
      return `${modeHint} • ${persistenceState.lastError} • Spróbuj ponownie.`;
    }

    if (persistenceState.status === "saved" && persistenceState.lastSavedAt) {
      return `${modeHint} • Ostatni zapis: ${formatDate(persistenceState.lastSavedAt)}`;
    }

    if (persistenceState.status === "saving") {
      return `${modeHint} • Trwa zapis zmian. Nie zamykaj strony.`;
    }

    if (persistenceState.status === "unsaved") {
      return `${modeHint} • Zmiany czekają w kolejce zapisu.`;
    }

    return modeHint;
  }, [persistenceState, storedLocalOverrideAvailable]);

  // ── Export ────────────────────────────────────────────────────────────────

  function handleExport() {
    const diagnostics = exportData(suggestedExportFilename);
    toast(
      "success",
      `Eksport zakończony: ${diagnostics.filename} (schema v${diagnostics.schemaVersion}, ${diagnostics.counts.pages} artykułów). Zachowaj plik jako kopię zapasową.`
    );
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleImportClick() {
    fileRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") {
        toast("error", "Nie udało się odczytać pliku. Wybierz poprawny plik JSON i spróbuj ponownie.");
        return;
      }
      const result = importData(text);
      if (result.ok) {
        const { diagnostics } = result;
        if (diagnostics?.ok && (diagnostics.migratedSchema || diagnostics.normalized)) {
          toast(
            "info",
            `Import zakończony z dostosowaniem danych do schema v${diagnostics.outputSchemaVersion} (${diagnostics.notes.length} zmian). Sprawdź notatki w statusie importu.`
          );
        } else {
          toast("success", "Import zakończony. Dane zostały zastąpione zawartością wskazanego pliku.");
        }
      } else {
        toast("error", `${result.error ?? "Import nie powiódł się."} Sprawdź format JSON i spróbuj ponownie.`);
      }
    };
    reader.onerror = () => toast("error", "Błąd odczytu pliku. Sprawdź czy plik nie jest uszkodzony i spróbuj ponownie.");
    reader.readAsText(file);
  }

  // ── Clear local overrides ──────────────────────────────────────────────────

  function handleClearOverrides() {
    if (
      !window.confirm(
        "Czy na pewno chcesz usunąć lokalne nadpisania?\n\nNadpisania zostaną usunięte z localStorage. Bieżący stan aplikacji pozostanie bez zmian do czasu odświeżenia strony.\nPo odświeżeniu aplikacja załaduje dane z pliku domyślnego (altcloud-data.json)."
      )
    ) {
      return;
    }
    clearLocalOverrides();
    toast("success", "Nadpisania lokalne usunięte. Odśwież stronę, aby wczytać dane z pliku domyślnego.");
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <InfoCard
          icon={<Database size={14} className="text-[#1d4f91]" />}
          label="Wersja aplikacji"
          value={appBuildVersion ? `v${appBuildVersion}` : "nieoznaczona"}
          hint="Podgląd builda wdrożenia"
        />
        <InfoCard
          icon={<RefreshCw size={14} className="text-[#2563eb]" />}
          label="Schemat docelowy"
          value={`v${currentSchemaVersion}`}
          hint={`Załadowane dane: ${dataSchemaVersion !== null ? `v${dataSchemaVersion}` : "brak"}`}
        />
        <InfoCard
          icon={<HardDrive size={14} className="text-[#0f766e]" />}
          label="Tryb storage"
          value={dataStorageMode === "api-assisted" ? "api-assisted" : "file-local"}
          hint={`Źródło: ${loadSourceLabel}`}
        />
        <InfoCard
          icon={<PackageOpen size={14} className="text-[#15803d]" />}
          label="Nadpisania lokalne"
          value={localOverrideStatus.value}
          hint={localOverrideStatus.hint}
        />
        <InfoCard
          icon={<RefreshCw size={14} className="text-[#7c3aed]" />}
          label="Stan zapisu"
          value={persistenceStatusLabel}
          hint={persistenceHint}
        />
      </div>

      {/* ── Data source status banner ────────────────────────────────────── */}
      <div
        className={[
          "flex items-start gap-3 rounded-xl border p-4",
          localOverrideActive
            ? "border-[#fde68a] bg-[#fffbeb]"
            : persistenceState.appDataLocalStorageSuppressed
              ? "border-[#bfdbfe] bg-[#eff6ff]"
            : "border-[#bbf7d0] bg-[#f0fdf4]",
        ].join(" ")}
      >
        {localOverrideActive ? (
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#d97706]" />
        ) : persistenceState.appDataLocalStorageSuppressed ? (
          <Database size={16} className="mt-0.5 shrink-0 text-[#2563eb]" />
        ) : (
          <PackageOpen size={16} className="mt-0.5 shrink-0 text-[#16a34a]" />
        )}
        <div className="min-w-0">
          <p
            className={[
              "text-sm font-semibold",
              localOverrideActive
                ? "text-[#92400e]"
                : persistenceState.appDataLocalStorageSuppressed
                  ? "text-[#1d4f91]"
                  : "text-[#15803d]",
            ].join(" ")}
          >
            {localOverrideActive
              ? "Aktywne nadpisania lokalne (localStorage)"
              : persistenceState.appDataLocalStorageSuppressed
                ? storedLocalOverrideAvailable
                  ? "LocalStorage app data są zapisane, ale zignorowane"
                  : "LocalStorage app data są wyłączone w trybie API"
              : "Dane z pliku domyślnego"}
          </p>
          <p
            className={[
              "mt-0.5 text-xs leading-5",
              localOverrideActive
                ? "text-[#b45309]"
                : persistenceState.appDataLocalStorageSuppressed
                  ? "text-[#1d4f91]"
                  : "text-[#166534]",
            ].join(" ")}
          >
            {localOverrideActive
              ? "Aplikacja korzysta z danych zapisanych w localStorage. Zmiany wprowadzone w pliku altcloud-data.json nie będą widoczne dopóki nie wyczyścisz nadpisań i nie odświeżysz strony."
              : persistenceState.appDataLocalStorageSuppressed
                ? storedLocalOverrideAvailable
                  ? "Tryb development API ignoruje zapisane app data w localStorage, aby nie mieszać ich z backend-backed slice'ami. Możesz usunąć ten klucz bez wpływu na bieżący stan strony."
                  : "Tryb development API ignoruje localStorage dla danych aplikacji. Bazą pozostają dane domyślne/bundled oraz backend-backed slice'y działające osobno."
              : "Aplikacja korzysta z pliku altcloud-data.json. Zmiany w tym pliku będą widoczne po odświeżeniu strony."}
          </p>
          {lastLoadDiagnostics && (lastLoadDiagnostics.migratedSchema || lastLoadDiagnostics.normalized || lastLoadDiagnostics.fallbackFromApi) ? (
            <p className="mt-1.5 text-xs text-[#7c2d12] dark:text-[#fdba74]">
              Ostatnie ładowanie zawierało migrację/normalizację. Sprawdź szczegóły w sekcji statusu poniżej.
            </p>
          ) : null}
        </div>
      </div>

      {/* ── Lifecycle status ─────────────────────────────────────────────── */}
      <div className="ui-panel p-5">
        <h2 className="text-base font-semibold text-[#0f172a]">Status cyklu danych</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Widoczność wersji i migracji dla aktualnego wdrożenia lokalnego.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <StatusBlock
            title="Ostatnie ładowanie danych"
            rows={[
              { label: "Czas", value: lastLoadDiagnostics ? formatDate(lastLoadDiagnostics.at) : "brak" },
              { label: "Źródło", value: loadSourceLabel },
              {
                label: "Migracja schematu",
                value: lastLoadDiagnostics?.migratedSchema ? "tak" : "nie",
              },
              {
                label: "Normalizacja",
                value: lastLoadDiagnostics?.normalized ? "tak" : "nie",
              },
              {
                label: "Schema input -> output",
                value: lastLoadDiagnostics
                  ? `${lastLoadDiagnostics.inputSchemaVersion ?? "brak"} -> ${lastLoadDiagnostics.outputSchemaVersion}`
                  : "brak",
              },
            ]}
            notes={lastLoadDiagnostics?.notes ?? []}
          />

          <StatusBlock
            title="Ostatni import"
            rows={[
              { label: "Czas", value: lastImportDiagnostics ? formatDate(lastImportDiagnostics.at) : "brak" },
              {
                label: "Wynik",
                value:
                  !lastImportDiagnostics
                    ? "brak"
                    : lastImportDiagnostics.ok
                    ? "poprawny"
                    : "błąd walidacji",
              },
              {
                label: "Wersja wykryta",
                value:
                  lastImportDiagnostics && lastImportDiagnostics.rawSchemaVersion !== null
                    ? `v${lastImportDiagnostics.rawSchemaVersion}`
                    : "brak",
              },
              {
                label: "Migracja/normalizacja",
                value:
                  lastImportDiagnostics && lastImportDiagnostics.ok
                    ? lastImportDiagnostics.migratedSchema || lastImportDiagnostics.normalized
                      ? "tak"
                      : "nie"
                    : "n/d",
              },
            ]}
            notes={
              !lastImportDiagnostics
                ? []
                : lastImportDiagnostics.ok
                ? lastImportDiagnostics.notes
                : [lastImportDiagnostics.error]
            }
          />

          <StatusBlock
            title="Stan persystencji"
            rows={[
              { label: "Status", value: persistenceStatusLabel },
              {
                label: "Zmiany oczekujące",
                value: persistenceState.hasPendingChanges ? "tak" : "nie",
              },
              {
                label: "Tryb zapisu",
                value: persistenceState.storageMode,
              },
              {
                label: "Zapis API skonfigurowany",
                value: persistenceState.saveCapability === "configured" ? "tak" : "nie",
              },
              {
                label: "Bezpośredni zapis API",
                value: persistenceState.directApiSaveReady ? "tak" : "nie",
              },
              {
                label: "Fallback aktywny",
                value: persistenceState.fallbackModeActive ? "tak" : "nie",
              },
              {
                label: "Ostatnio zapisano przez",
                value:
                  persistenceState.lastPersistedVia === "memory"
                    ? "pamięć sesji"
                    : persistenceState.lastPersistedVia ?? "brak",
              },
            ]}
            notes={[
              ...(persistenceState.lastWarning ? [persistenceState.lastWarning] : []),
              ...(persistenceState.lastError ? [persistenceState.lastError] : []),
            ]}
          />
        </div>

        {lastExportDiagnostics ? (
          <div className="ui-panel-soft mt-3 px-3 py-2 text-xs text-[#475569]">
            Ostatni eksport: {formatDate(lastExportDiagnostics.at)} • {lastExportDiagnostics.filename}
            {" "}• schema v{lastExportDiagnostics.schemaVersion} • pages: {lastExportDiagnostics.counts.pages}
          </div>
        ) : null}
      </div>

      {/* ── Actions ──────────────────────────────────────────────────────── */}
      <div className="ui-panel p-5">
        <div className="mb-1 flex items-center gap-2">
          <HardDrive size={15} className="text-[#64748b]" />
          <h2 className="text-base font-semibold text-[#0f172a]">Zarządzanie danymi</h2>
        </div>
        <p className="mb-4 text-sm text-[#64748b]">
          Eksportuj aktualne dane do pliku JSON, importuj je z zewnętrznego pliku lub wróć do danych
          domyślnych.
        </p>
        <p className="mb-3 text-xs text-[#64748b]">
          Rekomendowana nazwa eksportu dla tego wdrożenia: <span className="font-semibold">{suggestedExportFilename}</span>
        </p>

        <div className="flex flex-wrap gap-3">
          {/* Export */}
          <button
            type="button"
            onClick={handleExport}
            className="ui-btn ui-btn-neutral ui-btn-md"
          >
            <Download size={14} />
            Eksportuj JSON
          </button>

          {/* Import */}
          <button
            type="button"
            onClick={handleImportClick}
            className="ui-btn ui-btn-neutral ui-btn-md"
          >
            <Upload size={14} />
            Importuj JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Clear overrides */}
          <button
            type="button"
            onClick={handleClearOverrides}
            disabled={!localOverrideActive && !storedLocalOverrideAvailable}
            className={[
              "ui-btn ui-btn-md",
              localOverrideActive || storedLocalOverrideAvailable
                ? "ui-btn-danger"
                : "border border-[#e5e7eb] bg-[#f9fafb] text-[#9ca3af]",
            ].join(" ")}
          >
            Wyczyść nadpisania lokalne
          </button>
        </div>

        <p className="mt-3 text-xs text-[#94a3b8]">
          Import pozostaje kompatybilny wstecznie. Dane starszych wersji są migrowane do bieżącego
          schematu i raportowane w statusie importu.
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pl-PL");
}

function InfoCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="ui-panel p-3.5">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">{label}</p>
      </div>
      <p className="mt-1 text-sm font-semibold text-[#0f172a]">{value}</p>
      <p className="mt-0.5 text-[11px] text-[#64748b]">{hint}</p>
    </div>
  );
}

function StatusBlock({
  title,
  rows,
  notes,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
  notes: string[];
}) {
  return (
    <section className="ui-panel-soft p-3">
      <h3 className="text-sm font-semibold text-[#0f172a]">{title}</h3>
      <div className="mt-2 space-y-1 text-xs text-[#475569]">
        {rows.map((row) => (
          <p key={`${title}-${row.label}`}>
            <span className="font-medium text-[#334155]">{row.label}:</span> {row.value}
          </p>
        ))}
      </div>
      {notes.length > 0 ? (
        <div className="ui-panel mt-2 space-y-1 rounded-md px-2 py-1.5 text-[11px] text-[#475569]">
          {notes.map((note, index) => (
            <p key={`${title}-note-${index}`}>- {note}</p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
