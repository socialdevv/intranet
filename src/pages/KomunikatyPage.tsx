import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, Archive, Megaphone } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { adminKomunikatyEditorPath } from "@/lib/routes";
import { extractPlainText } from "@/lib/utils";
import type { CommunicationMessage, KomunikatStatus } from "@/lib/types/domain";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: KomunikatStatus }) {
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
      <Megaphone size={10} />
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

/**
 * Returns the display date for a komunikat.
 * Uses the explicit communicationDate when available;
 * falls back to updatedAt for items created before this field was added.
 */
function resolveDisplayDate(k: CommunicationMessage): string {
  return k.communicationDate ?? k.updatedAt;
}

// ── Komunikat card ────────────────────────────────────────────────────────────

function KomunikatCard({
  komunikat,
  selected,
  onClick,
}: {
  komunikat: CommunicationMessage;
  selected: boolean;
  onClick: () => void;
}) {
  const bodyPreview = extractPlainText(komunikat.body).trim().slice(0, 130);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full scroll-mt-4 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#b6c6d8] bg-[#f4f8fc] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-[#1d4f91]/60 dark:bg-[#0f2340]"
          : "border-[#e5e7eb] bg-white hover:border-[#ccd7e4] hover:bg-[#fbfdff] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:bg-[#0f2340]"
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge status={komunikat.status} />
        <span className="text-[11px] text-[#94a3b8]">{formatDate(resolveDisplayDate(komunikat))}</span>
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0f172a] dark:text-[#e2e8f0]">
        {komunikat.title}
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

function KomunikatDetailPanel({
  komunikat,
  isAdmin,
  actionsDisabled,
  onEdit,
  onDelete,
}: {
  komunikat: CommunicationMessage;
  isAdmin: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [komunikat.id]);

  const hasBody = Boolean(
    komunikat.body &&
    typeof komunikat.body === "object" &&
    Array.isArray((komunikat.body as { content?: unknown[] }).content) &&
    (komunikat.body as { content: unknown[] }).content.length > 0 &&
    extractPlainText(komunikat.body).trim().length > 0
  );

  return (
    <div className="rounded-2xl border border-[#dde5ee] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
      {/* Header */}
      <div className="border-b border-[#edf2f7] px-6 py-5 dark:border-[#1e293b]">
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={komunikat.status} />
          <span className="text-xs text-[#94a3b8]">
            Data komunikatu: {formatDate(resolveDisplayDate(komunikat))}
          </span>
        </div>
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
          {komunikat.title}
        </h2>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        {hasBody ? (
          <div className="prose-editor text-sm">
            <TipTapRenderer doc={komunikat.body} />
          </div>
        ) : (
          <p className="text-xs italic text-[#9ca3af]">Brak treści.</p>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-2 border-t border-[#edf2f7] px-6 py-3 dark:border-[#1e293b]">
          <button
            type="button"
            onClick={onEdit}
            disabled={actionsDisabled}
            className="flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#1d4f91] hover:text-[#1d4f91] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#94a3b8] dark:hover:border-[#60a5fa] dark:hover:text-[#60a5fa]"
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
                className="rounded-lg bg-[#dc2626] px-3 py-2 text-xs font-semibold text-white hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-50"
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
              disabled={actionsDisabled}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#fee2e2] bg-[#fff5f5] px-3 py-2 text-xs font-medium text-[#dc2626] transition hover:bg-[#fee2e2] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#7f1d1d]/40 dark:bg-[#1a0808] dark:text-[#f87171] dark:hover:bg-[#2d0f0f]"
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

export default function KomunikatyPage() {
  const { user } = useAuth();
  const { communications, communicationsModule } = useData();
  const { push: pushToast } = useToast();
  const navigate = useNavigate();
  const isAdmin = canEditContent(user);
  const canManageCommunications = isAdmin && communicationsModule.canWrite;
  const apiMode = communicationsModule.source === "api";

  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("id");
  const [query, setQuery] = useState("");
  // When navigating here from a link targeting a specific komunikat, show all
  // statuses so the target is visible even if archived.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(linkedId ? "all" : "active");
  const [selectedId, setSelectedId] = useState<string | null>(linkedId);

  // React to same-route deep-link changes from global search
  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      setSelectedId(id);
      setStatusFilter("all");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sort newest first
  const sorted = useMemo(
    () => [...communications].sort(
      (a, b) => new Date(resolveDisplayDate(b)).getTime() - new Date(resolveDisplayDate(a)).getTime()
    ),
    [communications]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((k) => {
      if (statusFilter !== "all" && k.status !== statusFilter) return false;
      if (q && !k.title.toLowerCase().includes(q) && !extractPlainText(k.body).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [sorted, query, statusFilter]);

  const selected = useMemo(
    () => filtered.find((k) => k.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  async function handleDelete() {
    if (!selected) return;

    const nextId = filtered.find((item) => item.id !== selected.id)?.id ?? null;

    try {
      await communicationsModule.removeCommunication(selected.id);
      setSelectedId(nextId);
      pushToast("success", "Komunikat został usunięty.");
    } catch (caught) {
      pushToast("error", caught instanceof Error ? caught.message : "Nie udało się usunąć komunikatu.");
    }
  }

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj komunikatów…">
      <section className="mx-auto w-full max-w-304 pb-10">
        {/* Page header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Komunikaty
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Ogłoszenia i komunikaty wewnętrzne.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(adminKomunikatyEditorPath("nowy"))}
              disabled={!canManageCommunications || communicationsModule.isMutating}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} />
              Nowy komunikat
            </button>
          )}
        </div>

        {communicationsModule.error && (
          <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d]/50 dark:bg-[#1a0808] dark:text-[#fca5a5]">
            {communicationsModule.error}
          </div>
        )}

        {apiMode && communicationsModule.isLoading && communications.length === 0 && (
          <div className="mb-4 rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86]">
            Ładowanie komunikatów z backendu…
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
              placeholder="Szukaj komunikatów…"
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
          <span className="text-xs text-[#94a3b8]">{filtered.length} komunikatów</span>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* List */}
          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dde5ee] bg-white p-8 text-center text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Brak komunikatów.
              </div>
            ) : (
              filtered.map((k) => (
                <KomunikatCard
                  key={k.id}
                  komunikat={k}
                  selected={selected?.id === k.id}
                  onClick={() => setSelectedId(k.id)}
                />
              ))
            )}
          </div>

          {/* Detail panel */}
          <div>
            {selected ? (
              <KomunikatDetailPanel
                komunikat={selected}
                isAdmin={isAdmin}
                actionsDisabled={!canManageCommunications || communicationsModule.isMutating}
                onEdit={() => navigate(adminKomunikatyEditorPath(selected.id))}
                onDelete={() => {
                  if (communicationsModule.isMutating) return;
                  void handleDelete();
                }}
              />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#dde5ee] bg-white text-sm text-[#9ca3af] dark:border-[#1e293b] dark:bg-[#111827] dark:text-[#475569]">
                Wybierz komunikat z listy.
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
