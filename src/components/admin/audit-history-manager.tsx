import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Eye,
  Filter,
  Layers3,
  LoaderCircle,
  RefreshCcw,
  UserCircle2,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import {
  getProjectAuditHistory,
  type ProjectAuditHistoryItem,
} from "@/lib/api/project-audit";
import { auditEntryHasFieldDiff } from "@/lib/audit/audit-field-changes";
import AuditEntryFieldChanges from "@/components/admin/audit-entry-field-changes";

type ServerFilters = {
  actionType: "create" | "update" | "delete" | "";
  moduleKey: string;
  entityType: string;
};

type ClientFilters = {
  areaKey: "all" | "content" | "configuration" | "system" | "global";
  query: string;
};

const ACTION_BADGE_CLASS: Record<ProjectAuditHistoryItem["actionType"], string> = {
  create:
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] dark:border-[#14532d] dark:bg-[#0f2416] dark:text-[#86efac]",
  update:
    "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4f91] dark:border-[#1e3a5f] dark:bg-[#0f2340] dark:text-[#93c5fd]",
  delete:
    "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#2a1111] dark:text-[#fca5a5]",
};

const ACTION_OPTIONS: Array<{ value: ServerFilters["actionType"]; label: string }> = [
  { value: "", label: "Wszystkie akcje" },
  { value: "create", label: "Utworzenia" },
  { value: "update", label: "Zmiany" },
  { value: "delete", label: "Usunięcia" },
];

const AREA_OPTIONS: Array<{ value: ClientFilters["areaKey"]; label: string }> = [
  { value: "all", label: "Wszystkie obszary" },
  { value: "content", label: "Treść" },
  { value: "configuration", label: "Konfiguracja" },
  { value: "system", label: "System" },
  { value: "global", label: "Globalne" },
];

function formatAuditDay(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatAuditTimestamp(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function stringifyMetadata(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditHistoryManager() {
  const { projectBootstrapState } = useData();
  const [serverFilters, setServerFilters] = useState<ServerFilters>({
    actionType: "",
    moduleKey: "",
    entityType: "",
  });
  const [clientFilters, setClientFilters] = useState<ClientFilters>({
    areaKey: "all",
    query: "",
  });
  const [items, setItems] = useState<ProjectAuditHistoryItem[]>([]);
  const [nextBeforeId, setNextBeforeId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const projectSlug =
    projectBootstrapState.status === "ready" ? projectBootstrapState.preview.project.slug : null;
  const projectName =
    projectBootstrapState.status === "ready" ? projectBootstrapState.preview.project.name : null;
  const canViewAudit =
    projectBootstrapState.status === "ready"
      ? projectBootstrapState.preview.capabilities.project.canViewAudit
      : false;

  async function loadAuditHistory(options?: { append?: boolean; beforeId?: string | null }) {
    if (!projectSlug) {
      return;
    }

    const append = options?.append ?? false;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    setError("");

    try {
      const response = await getProjectAuditHistory(projectSlug, {
        limit: 50,
        beforeId: options?.beforeId ?? null,
        actionType: serverFilters.actionType || null,
        moduleKey: serverFilters.moduleKey || null,
        entityType: serverFilters.entityType || null,
      });

      setItems((current) =>
        append ? [...current, ...response.data.items] : response.data.items
      );
      setHasMore(response.data.pageInfo.hasMore);
      setNextBeforeId(response.data.pageInfo.nextBeforeId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się pobrać historii zmian projektu."
      );
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!projectSlug || !canViewAudit) {
      return;
    }

    void loadAuditHistory({ append: false, beforeId: null });
  }, [projectSlug, canViewAudit, serverFilters.actionType, serverFilters.entityType, serverFilters.moduleKey]);

  const moduleOptions = useMemo(() => {
    const values = new Map<string, string>();

    for (const item of items) {
      if (item.moduleKey) {
        values.set(item.moduleKey, item.moduleLabel);
      }
    }

    if (serverFilters.moduleKey && !values.has(serverFilters.moduleKey)) {
      values.set(serverFilters.moduleKey, serverFilters.moduleKey);
    }

    return [{ value: "", label: "Wszystkie moduły" }, ...[...values.entries()].map(([value, label]) => ({ value, label }))];
  }, [items, serverFilters.moduleKey]);

  const entityOptions = useMemo(() => {
    const values = new Map<string, string>();

    for (const item of items) {
      values.set(item.entityType, item.entityLabel);
    }

    if (serverFilters.entityType && !values.has(serverFilters.entityType)) {
      values.set(serverFilters.entityType, serverFilters.entityType);
    }

    return [{ value: "", label: "Wszystkie typy zmian" }, ...[...values.entries()].map(([value, label]) => ({ value, label }))];
  }, [items, serverFilters.entityType]);

  const filteredItems = useMemo(() => {
    const query = clientFilters.query.trim().toLowerCase();

    return items.filter((item) => {
      if (clientFilters.areaKey !== "all" && item.areaKey !== clientFilters.areaKey) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        item.summary,
        item.entityLabel,
        item.entityTitle ?? "",
        item.moduleLabel,
        item.areaLabel,
        item.actor.displayName ?? "",
        item.actor.email ?? "",
        item.changedFields.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [clientFilters.areaKey, clientFilters.query, items]);

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, ProjectAuditHistoryItem[]>();

    for (const item of filteredItems) {
      const key = item.occurredAt.slice(0, 10);
      const bucket = grouped.get(key);

      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    return [...grouped.entries()];
  }, [filteredItems]);

  if (projectBootstrapState.mode !== "api") {
    return (
      <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-5 text-sm text-[#64748b] dark:border-[#223147] dark:bg-[#0f172a] dark:text-[#94a3b8]">
        Historia zmian jest dostępna tylko w projektach z zapisem na serwerze.
      </div>
    );
  }

  if (projectBootstrapState.status === "loading") {
    return (
      <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-5 text-sm text-[#64748b] dark:border-[#223147] dark:bg-[#0f172a] dark:text-[#94a3b8]">
        Trwa ładowanie kontekstu projektu potrzebnego do pobrania historii zmian.
      </div>
    );
  }

  if (projectBootstrapState.status === "failed") {
    return (
      <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-5 text-sm text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1111] dark:text-[#fca5a5]">
        Nie udało się wczytać historii zmian: {projectBootstrapState.error}
      </div>
    );
  }

  if (!canViewAudit) {
    return (
      <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-5 text-sm text-[#64748b] dark:border-[#223147] dark:bg-[#0f172a] dark:text-[#94a3b8]">
        Bieżąca rola projektu nie ma jeszcze wglądu w historię zmian tego wdrożenia.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_320px]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-[#dbe4f0] bg-linear-to-br from-white via-[#f8fbff] to-[#eef5ff] p-5 shadow-sm dark:border-[#223147] dark:bg-linear-to-br dark:from-[#0f172a] dark:via-[#111b2e] dark:to-[#10223d]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5b7fb0] dark:text-[#7aa2d8]">
                Historia zmian
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
                Historia zmian projektu{projectName ? `: ${projectName}` : ""}
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#5f6f86] dark:text-[#9fb3cc]">
                Przeglądaj kto, co i kiedy zmienił w tym projekcie — z podziałem na obszary i moduły.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadAuditHistory({ append: false, beforeId: null })}
              disabled={isLoading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 text-sm font-medium text-[#374151] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:bg-[#111827] dark:text-[#e2e8f0] dark:hover:bg-[#162033]"
            >
              {isLoading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Odśwież
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Akcja
              </span>
              <select
                value={serverFilters.actionType}
                onChange={(event) =>
                  setServerFilters((current) => ({ ...current, actionType: event.target.value as ServerFilters["actionType"] }))
                }
                className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
              >
                {ACTION_OPTIONS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Moduł
              </span>
              <select
                value={serverFilters.moduleKey}
                onChange={(event) =>
                  setServerFilters((current) => ({ ...current, moduleKey: event.target.value }))
                }
                className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
              >
                {moduleOptions.map((option) => (
                  <option key={option.value || option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Typ encji
              </span>
              <select
                value={serverFilters.entityType}
                onChange={(event) =>
                  setServerFilters((current) => ({ ...current, entityType: event.target.value }))
                }
                className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
              >
                {entityOptions.map((option) => (
                  <option key={option.value || option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Obszar / wyszukiwanie
              </span>
              <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2">
                <select
                  value={clientFilters.areaKey}
                  onChange={(event) =>
                    setClientFilters((current) => ({ ...current, areaKey: event.target.value as ClientFilters["areaKey"] }))
                  }
                  className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
                >
                  {AREA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={clientFilters.query}
                  onChange={(event) =>
                    setClientFilters((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="Szukaj po osobie, encji, polu…"
                  className="h-10 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#f1f5f9]"
                />
              </div>
            </label>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#991b1b] dark:border-[#7f1d1d] dark:bg-[#2a1111] dark:text-[#fca5a5]">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] p-5 text-sm text-[#64748b] dark:border-[#223147] dark:bg-[#0f172a] dark:text-[#94a3b8]">
            Trwa pobieranie historii zmian projektu.
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] p-8 text-center text-sm text-[#6b7280] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
            Brak wpisów pasujących do bieżących filtrów.
          </div>
        ) : (
          <div className="space-y-5">
            {groupedItems.map(([dayKey, dayItems]) => (
              <section key={dayKey} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f6f86] dark:text-[#9fb3cc]">
                  <Clock3 size={13} />
                  {formatAuditDay(dayItems[0].occurredAt)}
                </div>

                <div className="space-y-3">
                  {dayItems.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm dark:border-[#1f2937] dark:bg-[#111827]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                ACTION_BADGE_CLASS[item.actionType],
                              ].join(" ")}
                            >
                              {item.actionLabel}
                            </span>
                            <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                              {item.areaLabel}
                            </span>
                            <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                              {item.moduleLabel}
                            </span>
                            <span className="rounded-full border border-[#dbe4f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-medium text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
                              {item.entityLabel}
                            </span>
                          </div>

                          <p className="mt-3 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                            {item.summary}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#64748b] dark:text-[#94a3b8]">
                            <span className="inline-flex items-center gap-1">
                              <UserCircle2 size={13} />
                              {item.actor.displayName ?? item.actor.email ?? "System"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Clock3 size={13} />
                              {formatAuditTimestamp(item.occurredAt)}
                            </span>
                            {item.actor.email ? <span>{item.actor.email}</span> : null}
                          </div>

                          <AuditEntryFieldChanges item={item} />
                          {!auditEntryHasFieldDiff(item) && item.changedFields.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {item.changedFields.map((fieldName) => (
                                <span
                                  key={fieldName}
                                  className="rounded-full border border-[#dbe4f0] bg-white px-2 py-0.5 text-[11px] text-[#475569] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]"
                                >
                                  {fieldName}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>

                        <div className="shrink-0 text-right text-[11px] text-[#64748b] dark:text-[#94a3b8]">
                          <p>ID wpisu: {item.id}</p>
                          {item.entityId ? <p>ID encji: {item.entityId}</p> : null}
                        </div>
                      </div>

                      <details className="mt-4 rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-4 py-3 dark:border-[#334155] dark:bg-[#0f172a]">
                        <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-widest text-[#5f6f86] dark:text-[#9fb3cc]">
                          Szczegóły wpisu
                        </summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
                          <div className="space-y-1 text-xs text-[#475569] dark:text-[#cbd5e1]">
                            <p><span className="font-semibold">Encja:</span> {item.entityLabel}</p>
                            <p><span className="font-semibold">Obszar:</span> {item.areaLabel}</p>
                            <p><span className="font-semibold">Moduł:</span> {item.moduleLabel}</p>
                            {item.entityTitle ? <p><span className="font-semibold">Tytuł / nazwa:</span> {item.entityTitle}</p> : null}
                            {item.project.name ? <p><span className="font-semibold">Projekt:</span> {item.project.name}</p> : null}
                          </div>
                          <div className="rounded-lg border border-[#dde5ee] bg-white p-3 dark:border-[#1f2937] dark:bg-[#111827]">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                              <Eye size={12} />
                              Surowe dane audit
                            </div>
                            <pre className="max-h-72 overflow-auto whitespace-pre-wrap wrap-break-word text-[11px] leading-relaxed text-[#334155] dark:text-[#cbd5e1]">
                              {stringifyMetadata(item.metadata)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {hasMore ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => void loadAuditHistory({ append: true, beforeId: nextBeforeId })}
              disabled={isLoadingMore || !nextBeforeId}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#d1d5db] bg-white px-4 text-sm font-medium text-[#374151] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:bg-[#111827] dark:text-[#e2e8f0] dark:hover:bg-[#162033]"
            >
              {isLoadingMore ? <LoaderCircle size={14} className="animate-spin" /> : <Activity size={14} />}
              Załaduj starsze wpisy
            </button>
          </div>
        ) : null}
      </div>

      <aside className="rounded-2xl border border-[#dde5ee] bg-white p-5 shadow-sm dark:border-[#1f2937] dark:bg-[#111827]">
        <div className="mb-3 flex items-center gap-2">
          <Layers3 size={15} className="text-[#64748b] dark:text-[#94a3b8]" />
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Jak korzystać z widoku
          </h3>
        </div>

        <div className="space-y-3 text-xs leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
          <p>
            Wpisy są grupowane według dnia.
          </p>
          <p>
            Filtry akcji, modułu i typu encji pobierają kolejne strony wyników. Filtr obszaru i wyszukiwanie działają na załadowanej liście.
          </p>
          <p>
            Przy zmianach (update) widoczna jest tabela przed/po dla pól z metadanych auditowych. Starsze wpisy bez zapisanego stanu „przed” pokazują wyłącznie wartość po zmianie.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-[#e2e8f0] bg-[#f8fbff] px-4 py-3 text-xs text-[#5f6f86] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#9fb3cc]">
          <div className="flex items-center gap-2 font-medium">
            <Filter size={13} />
            Załadowane wpisy po filtrach: {items.length}
          </div>
          <p className="mt-2 leading-relaxed">
            Jeśli szukasz starszej zmiany poza bieżącą stroną, użyj przycisku „Załaduj starsze wpisy”, a następnie zawęź wynik lokalnym wyszukiwaniem.
          </p>
        </div>
      </aside>
    </div>
  );
}