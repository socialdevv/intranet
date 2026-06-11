import { useMemo } from "react";
import { Database, Download, RefreshCw } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";

export default function DataManager() {
  const {
    exportData,
    reloadData,
    appBuildVersion,
    currentSchemaVersion,
    dataSchemaVersion,
    lastExportDiagnostics,
    persistenceState,
  } = useData();
  const { push: toast } = useToast();

  const suggestedExportFilename = useMemo(() => "intranet-export.json", []);

  function handleExport() {
    const diagnostics = exportData(suggestedExportFilename);
    toast(
      "success",
      `Wyeksportowano migawkę runtime do pliku ${diagnostics.filename}.`,
      4200
    );
  }

  async function handleReload() {
    const result = await reloadData();
    if (result.ok) {
      toast("success", "Odświeżono dane z backendu.", 3600);
      return;
    }

    toast("error", result.error ?? "Nie udało się odświeżyć danych.", 5200);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
          <Database size={16} />
          Źródło danych
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Wszystkie dane biznesowe są ładowane wyłącznie z API backendu (PostgreSQL). Frontend
          przechowuje je tylko w pamięci React na potrzeby UI i wyszukiwania po stronie klienta.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-muted)]">Upload API</dt>
            <dd className="font-medium text-[var(--text)]">
              {persistenceState.uploadCapability === "configured" ? "skonfigurowany" : "brak konfiguracji"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Endpoint uploadu</dt>
            <dd className="font-medium text-[var(--text)]">
              {persistenceState.uploadEndpoint ?? "niedostępny"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Wersja aplikacji</dt>
            <dd className="font-medium text-[var(--text)]">{appBuildVersion ?? "nieznana"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Schema runtime</dt>
            <dd className="font-medium text-[var(--text)]">
              {dataSchemaVersion ?? currentSchemaVersion}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
        >
          <Download size={16} />
          Eksportuj migawkę runtime
        </button>
        <button
          type="button"
          onClick={() => void handleReload()}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-muted)]"
        >
          <RefreshCw size={16} />
          Odśwież z API
        </button>
      </div>

      {lastExportDiagnostics ? (
        <p className="text-xs text-[var(--text-muted)]">
          Ostatni eksport: {lastExportDiagnostics.filename} ({formatDate(lastExportDiagnostics.at)})
        </p>
      ) : null}
    </div>
  );
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString("pl-PL");
  } catch {
    return value;
  }
}
