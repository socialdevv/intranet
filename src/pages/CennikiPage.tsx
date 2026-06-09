import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, Archive, CheckCircle2 } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import CennikSectionTable from "@/components/cenniki/CennikSectionTable";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { adminCennikEditorPath } from "@/lib/routes";
import type { Cennik } from "@/lib/types/domain";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Cennik["status"] }) {
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-semibold text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]">
        <Archive size={10} />
        Archiwum
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#166534] dark:bg-[#14532d]/30 dark:text-[#4ade80]">
      <CheckCircle2 size={10} />
      Aktywny
    </span>
  );
}

function formatEffectiveDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Cennik card (list item) ───────────────────────────────────────────────────

function CennikCard({
  cennik,
  selected,
  onClick,
}: {
  cennik: Cennik;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#b6c6d8] bg-[#f4f8fc] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-[#1d4f91]/60 dark:bg-[#0f2340]"
          : "border-[#e5e7eb] bg-white hover:border-[#ccd7e4] hover:bg-[#fbfdff] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:bg-[#0f2340]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge status={cennik.status} />
        <span className="text-[11px] text-[#94a3b8]">
          od {formatEffectiveDate(cennik.effectiveFrom)}
        </span>
      </div>
      <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0f172a] dark:text-[#e2e8f0]">
        {cennik.title}
      </h3>
      {cennik.subtitle && (
        <p className="mt-0.5 text-xs text-[#6b7280] dark:text-[#94a3b8]">{cennik.subtitle}</p>
      )}
      {cennik.provider && (
        <p className="mt-1 text-[11px] text-[#94a3b8]">{cennik.provider}</p>
      )}
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function CennikDetail({
  cennik,
  isAdmin,
  onEdit,
  onDelete,
}: {
  cennik: Cennik;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="rounded-2xl border border-[#dde5ee] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
      {/* Header */}
      <div className="border-b border-[#edf2f7] px-6 py-5 dark:border-[#1e293b]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge status={cennik.status} />
          {cennik.provider && (
            <span className="text-xs text-[#94a3b8]">{cennik.provider}</span>
          )}
          <span className="ml-auto text-xs text-[#94a3b8]">
            Obowiązuje od: {formatEffectiveDate(cennik.effectiveFrom)}
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
          {cennik.title}
        </h2>
        {cennik.subtitle && (
          <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">{cennik.subtitle}</p>
        )}
      </div>

      {/* Sections */}
      <div className="px-6 py-5">
        {cennik.sections.length === 0 ? (
          <p className="text-xs italic text-[#9ca3af]">Brak sekcji cennika.</p>
        ) : (
          cennik.sections.map((section) => (
            <CennikSectionTable key={section.id} section={section} />
          ))
        )}

        {/* Global footnotes */}
        {cennik.footnotes && cennik.footnotes.length > 0 && (
          <div className="mt-4 rounded-lg bg-[#f8fafc] px-4 py-3 dark:bg-[#111827]">
            <p className="mb-1.5 text-xs font-semibold text-[#374151] dark:text-[#cbd5e1]">Uwagi ogólne:</p>
            <ul className="space-y-0.5">
              {cennik.footnotes.map((fn, i) => (
                <li key={i} className="text-xs text-[#6b7280] dark:text-[#94a3b8]">
                  • {fn}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-t border-[#edf2f7] px-6 py-3 dark:border-[#1e293b]">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#1d4f91] hover:text-[#1d4f91] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:border-[#60a5fa] dark:hover:text-[#60a5fa]"
          >
            <Pencil size={13} />
            Edytuj
          </button>
          {confirmDelete ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-[#dc2626] dark:text-[#f87171]">Na pewno usunąć?</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg bg-[#dc2626] px-3 py-2 text-xs font-semibold text-white hover:bg-[#b91c1c]"
              >
                Usuń
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-[#d1d5db] px-3 py-2 text-xs font-medium text-[#374151] hover:bg-[#f9fafb] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
              >
                Anuluj
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#fee2e2] bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#dc2626] transition hover:bg-[#fee2e2] dark:border-[#7f1d1d]/40 dark:bg-[#1a0808] dark:text-[#f87171] dark:hover:bg-[#2d0f0f]"
            >
              <Trash2 size={13} />
              Usuń
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "archived";

export default function CennikiPage() {
  const { user } = useAuth();
  const { cenniki, cennikiModule } = useData();
  const { push: pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("id");
  const isAdmin = canEditContent(user);
  const {
    source,
    isLoading,
    isMutating,
    error: moduleError,
    canWrite,
    removeCennik,
  } = cennikiModule;
  const apiMode = source === "api";

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(linkedId ? "all" : "active");
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);
  const [actionError, setActionError] = useState("");

  // React to same-route deep-link changes from global search
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setSelectedId(id);
      setStatusFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sorted = useMemo(
    () =>
      [...cenniki.documents].sort(
        (a, b) =>
          new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
      ),
    [cenniki]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (
        q &&
        !c.title.toLowerCase().includes(q) &&
        !(c.subtitle ?? "").toLowerCase().includes(q) &&
        !(c.provider ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [sorted, query, statusFilter]);

  const selected = useMemo(
    () => filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  async function handleDelete() {
    if (!selected) return;

    if (apiMode && !canWrite) {
      setActionError(moduleError ?? "Backend modułu cenników nie jest jeszcze gotowy do zapisu.");
      return;
    }

    setActionError("");

    try {
      await removeCennik(selected.id);
      setSelectedId(null);
      pushToast(
        "success",
        source === "api" ? "Cennik został usunięty z backendu." : "Cennik został usunięty."
      );
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Nie udało się usunąć cennika.");
    }
  }

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj cenników…">
      <section className="mx-auto w-full max-w-304 pb-10">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Cenniki
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Tabele cenowe taryf energetycznych.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(adminCennikEditorPath("nowy"))}
              disabled={apiMode && (!canWrite || isMutating)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:cursor-not-allowed disabled:bg-[#8aa7cf] disabled:shadow-none"
            >
              <Plus size={15} />
              Nowy cennik
            </button>
          )}
        </div>

        {(actionError || moduleError) && (
          <p role="alert" className="mb-4 rounded-lg bg-[#fee2e2] px-4 py-2.5 text-sm font-medium text-[#dc2626]">
            {actionError || moduleError}
          </p>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            className="relative flex-1"
            style={{ minWidth: "180px", maxWidth: "340px" }}
          >
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj cenników…"
              className="w-full rounded-xl border border-[#d1d5db] bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[#9ca3af] focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/15 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white p-1 dark:border-[#1e293b] dark:bg-[#1a2535]">
            {(["active", "all", "archived"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  statusFilter === s
                    ? "bg-[#1d4f91] text-white shadow-sm"
                    : "text-[#6b7280] hover:bg-[#f1f5f9] dark:text-[#94a3b8] dark:hover:bg-[#263347]"
                }`}
              >
                {s === "active" ? "Aktywne" : s === "archived" ? "Archiwum" : "Wszystkie"}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#94a3b8]">{filtered.length} cenników</span>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* List */}
          <div className="space-y-2">
            {apiMode && isLoading && cenniki.documents.length === 0 ? (
              <div className="rounded-xl border border-[#dde5ee] bg-white p-8 text-center text-sm text-[#64748b] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#94a3b8]">
                Ładowanie cenników z backendu…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dde5ee] bg-white p-8 text-center text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Brak cenników.
              </div>
            ) : (
              filtered.map((c) => (
                <CennikCard
                  key={c.id}
                  cennik={c}
                  selected={selected?.id === c.id}
                  onClick={() => setSelectedId(c.id)}
                />
              ))
            )}
          </div>

          {/* Detail */}
          <div>
            {selected ? (
              <CennikDetail
                cennik={selected}
                isAdmin={isAdmin}
                onEdit={() => navigate(adminCennikEditorPath(selected.id))}
                onDelete={handleDelete}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#dde5ee] bg-white text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Wybierz cennik z listy.
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

