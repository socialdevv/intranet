import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, Archive, Users } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { adminTematyOrgEditorPath } from "@/lib/routes";
import { extractPlainText } from "@/lib/utils";
import type { OrgEntry, OrgEntryStatus } from "@/lib/types/domain";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrgEntryStatus }) {
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11px] font-semibold text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]">
        <Archive size={10} />
        Archiwum
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#e0e7ff] px-2 py-0.5 text-[11px] font-semibold text-[#3730a3] dark:bg-[#312e81]/30 dark:text-[#a5b4fc]">
      <Users size={10} />
      Aktywny
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resolveDisplayDate(e: OrgEntry): string {
  return e.entryDate ?? e.updatedAt;
}

// ── Entry card ────────────────────────────────────────────────────────────────

function OrgEntryCard({
  entry,
  selected,
  onClick,
}: {
  entry: OrgEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const bodyPreview = extractPlainText(entry.body).trim().slice(0, 130);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full scroll-mt-4 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#b6c6d8] bg-[#f4f8fc] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-[#3730a3]/60 dark:bg-[#0f0f2e]"
          : "border-[#e5e7eb] bg-white hover:border-[#ccd7e4] hover:bg-[#fbfdff] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:bg-[#0f1e33]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge status={entry.status} />
        <span className="text-[11px] text-[#94a3b8]">{formatDate(resolveDisplayDate(entry))}</span>
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0f172a] dark:text-[#e2e8f0]">
        {entry.title}
      </h3>
      {bodyPreview && (
        <p className="line-clamp-2 text-xs text-[#6b7280] dark:text-[#94a3b8]">
          {bodyPreview}{bodyPreview.length === 130 ? "…" : ""}
        </p>
      )}
    </button>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function OrgEntryDetailPanel({
  entry,
  canManage,
  actionsDisabled,
  onEdit,
  onDelete,
}: {
  entry: OrgEntry;
  canManage: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [entry.id]);

  const hasBody = Boolean(
    entry.body &&
    typeof entry.body === "object" &&
    Array.isArray((entry.body as { content?: unknown[] }).content) &&
    (entry.body as { content: unknown[] }).content.length > 0 &&
    extractPlainText(entry.body).trim().length > 0
  );

  return (
    <div className="rounded-2xl border border-[#dde5ee] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
      {/* Header */}
      <div className="border-b border-[#edf2f7] px-6 py-5 dark:border-[#1e293b]">
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={entry.status} />
          <span className="text-xs text-[#94a3b8]">
            Data: {formatDate(resolveDisplayDate(entry))}
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
          {entry.title}
        </h2>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {hasBody ? (
          <div className="prose-editor text-sm">
            <TipTapRenderer doc={entry.body} />
          </div>
        ) : (
          <p className="text-xs italic text-[#9ca3af]">Brak treści.</p>
        )}
      </div>

      {/* Admin actions */}
      {canManage && (
        <div className="flex items-center gap-2 border-t border-[#edf2f7] px-6 py-3 dark:border-[#1e293b]">
          <button
            type="button"
            onClick={onEdit}
            disabled={actionsDisabled}
            className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#3730a3] hover:text-[#3730a3] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:border-[#818cf8] dark:hover:text-[#818cf8]"
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
                disabled={actionsDisabled}
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
              disabled={actionsDisabled}
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

export default function TematyOrganizacyjnePage() {
  const { user } = useAuth();
  const { orgEntries, importantTopicsModule } = useData();
  const { push: pushToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = canEditContent(user);
  const canManageTopics = isAdmin && importantTopicsModule.canWrite;

  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("id");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(linkedId ? "all" : "active");
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setSelectedId(id);
      setStatusFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const sorted = useMemo(
    () => [...orgEntries].sort(
      (a, b) => new Date(resolveDisplayDate(b)).getTime() - new Date(resolveDisplayDate(a)).getTime()
    ),
    [orgEntries]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((e) => {
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      if (q && !e.title.toLowerCase().includes(q) && !extractPlainText(e.body).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, query, statusFilter]);

  const selected = useMemo(
    () => filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  async function handleDelete() {
    if (!selected) return;

    if (!canManageTopics || importantTopicsModule.isMutating) {
      return;
    }

    try {
      await importantTopicsModule.removeTopic(selected.id);
      setSelectedId(null);
      pushToast("success", "Temat organizacyjny został usunięty.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się usunąć tematu organizacyjnego.",
        5200,
      );
    }
  }

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj tematów organizacyjnych…">
      <section className="mx-auto w-full max-w-304 pb-10">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Tematy organizacyjne
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Wewnętrzne tematy organizacyjne i zmiany.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(adminTematyOrgEditorPath("nowy"))}
              disabled={!importantTopicsModule.canWrite || importantTopicsModule.isMutating}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#3730a3] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2e2789] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={15} />
              Nowy temat
            </button>
          )}
        </div>

        {importantTopicsModule.source === "api" && importantTopicsModule.error && (
          <div className="mb-4 rounded-xl border border-[#fed7aa] bg-[#fff7ed] px-4 py-3 text-sm text-[#9a3412] dark:border-[#7c2d12] dark:bg-[#2a1305] dark:text-[#fdba74]">
            Nie udało się zsynchronizować tematów organizacyjnych z backendem. Wyświetlany jest bieżący fallback, a zapis pozostaje zablokowany do czasu odzyskania połączenia.
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1" style={{ minWidth: "180px", maxWidth: "340px" }}>
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj tematów…"
              className="w-full rounded-xl border border-[#d1d5db] bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[#9ca3af] focus:border-[#3730a3] focus:ring-2 focus:ring-[#3730a3]/15 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
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
                    ? "bg-[#3730a3] text-white shadow-sm"
                    : "text-[#6b7280] hover:bg-[#f1f5f9] dark:text-[#94a3b8] dark:hover:bg-[#263347]"
                }`}
              >
                {s === "active" ? "Aktywne" : s === "archived" ? "Archiwum" : "Wszystkie"}
              </button>
            ))}
          </div>
          <span className="text-xs text-[#94a3b8]">{filtered.length} tematów</span>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* List */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dde5ee] bg-white p-8 text-center text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Brak tematów organizacyjnych.
              </div>
            ) : (
              filtered.map((e) => (
                <OrgEntryCard
                  key={e.id}
                  entry={e}
                  selected={selected?.id === e.id}
                  onClick={() => setSelectedId(e.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          <div>
            {selected ? (
              <OrgEntryDetailPanel
                entry={selected}
                canManage={canManageTopics}
                actionsDisabled={importantTopicsModule.isMutating}
                onEdit={() => navigate(adminTematyOrgEditorPath(selected.id))}
                onDelete={() => {
                  void handleDelete();
                }}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#dde5ee] bg-white text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Wybierz temat z listy.
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
