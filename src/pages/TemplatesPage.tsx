import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Plus,
  Check,
  Copy,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import { ChannelBadge } from "@/components/templates/channel-badge";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { adminTemplateEditorPath } from "@/lib/routes";
import { extractPlainText, copyToClipboard } from "@/lib/utils";
import {
  extractCopyablePlainText,
  buildSelectionClipboardPayload,
} from "@/lib/knowledge/no-copy-inline";
import type { TextTemplate, TemplateChannel } from "@/lib/types/domain";

// ── Copy button (reusable) ────────────────────────────────────────────────────

function CopyButton({
  doc,
  label,
  successMessage,
}: {
  doc: unknown;
  label: string;
  successMessage: string;
}) {
  const [copied, setCopied] = useState(false);
  const { push: pushToast } = useToast();

  const handleClick = useCallback(async () => {
    await copyToClipboard(extractCopyablePlainText(doc).trim());
    setCopied(true);
    pushToast("success", successMessage);
    setTimeout(() => setCopied(false), 2200);
  }, [doc, successMessage, pushToast]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        copied
          ? "bg-[#dcfce7] text-[#166534] dark:bg-[#14532d]/30 dark:text-[#4ade80]"
          : "bg-[#1d4f91] text-white hover:bg-[#163d72]"
      }`}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Skopiowano!" : label}
    </button>
  );
}

// ── Template card (list item) ─────────────────────────────────────────────────

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: TextTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  const bodyPreview = extractPlainText(template.body).trim().slice(0, 140);

  return (
    <button
      type="button"
      id={`tpl-${template.id}`}
      onClick={onClick}
      className={`w-full scroll-mt-4 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-[#b6c6d8] bg-[#f4f8fc] shadow-[0_8px_24px_rgba(15,23,42,0.06)] dark:border-[#1d4f91]/60 dark:bg-[#0f2340]"
          : "border-[#e5e7eb] bg-white hover:border-[#ccd7e4] hover:bg-[#fbfdff] dark:border-[#1e3a5f] dark:bg-[#0d1b2e] dark:hover:border-[#2d4a6a] dark:hover:bg-[#0f2340]"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <ChannelBadge channel={template.channel} />
      </div>
      <h3 className="mb-1.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#0f172a] dark:text-[#e2e8f0]">
        {template.title}
      </h3>
      {bodyPreview && (
        <p className="line-clamp-2 text-xs text-[#6b7280] dark:text-[#94a3b8]">
          {bodyPreview}{bodyPreview.length === 140 ? "…" : ""}
        </p>
      )}
    </button>
  );
}

// ── Template section block (Szablon / Przykład) ───────────────────────────────

function TemplateSection({
  heading,
  doc,
  copyLabel,
  copySuccessMessage,
  accent,
}: {
  heading: string;
  doc: unknown;
  copyLabel: string;
  copySuccessMessage: string;
  accent: "blue" | "amber";
}) {
  const hasContent = Boolean(
    doc &&
    typeof doc === "object" &&
    Array.isArray((doc as { content?: unknown[] }).content) &&
    (doc as { content: unknown[] }).content.length > 0 &&
    extractPlainText(doc).trim().length > 0
  );

  const headingColor =
    accent === "blue" ? "text-[#1d4f91] dark:text-[#60a5fa]" : "text-[#92400e] dark:text-[#fbbf24]";
  const dividerColor =
    accent === "blue" ? "border-[#dbeafe] dark:border-[#1e3a5f]" : "border-[#fde68a] dark:border-[#78350f]/30";

  function handleCopy(e: React.ClipboardEvent<HTMLDivElement>) {
    const payload = buildSelectionClipboardPayload(window.getSelection(), e.currentTarget);
    if (!payload) return;
    e.clipboardData.setData("text/plain", payload.text);
    e.clipboardData.setData("text/html", payload.html);
    e.preventDefault();
  }

  return (
    <div>
      <div className={`mb-3 flex items-center justify-between border-b pb-2 ${dividerColor}`}>
        <span className={`text-xs font-bold uppercase tracking-wider ${headingColor}`}>
          {heading}
        </span>
        {hasContent && (
          <CopyButton doc={doc} label={copyLabel} successMessage={copySuccessMessage} />
        )}
      </div>
      <div className="max-h-100 overflow-y-auto">
        {hasContent ? (
          <div className="prose-editor select-none text-sm" onCopy={handleCopy}>
            <TipTapRenderer doc={doc} />
          </div>
        ) : (
          <p className="text-xs italic text-[#9ca3af]">Brak treści.</p>
        )}
      </div>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function TemplateDetailPanel({
  template,
  canManage,
  actionsDisabled,
  onEdit,
  onDelete,
}: {
  template: TextTemplate;
  canManage: boolean;
  actionsDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void | Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [template.id]);

  return (
    <div className="rounded-2xl border border-[#dde5ee] bg-white shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0f1e33]">
      {/* Header */}
      <div className="border-b border-[#edf2f7] px-6 py-5 dark:border-[#1e293b]">
        <div className="mb-2">
          <ChannelBadge channel={template.channel} />
        </div>
        <h2 className="text-xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9]">
          {template.title}
        </h2>
      </div>

      {/* Szablon + Przykład sections */}
      <div className="space-y-6 px-6 py-5">
        <TemplateSection
          heading="Szablon"
          doc={template.body}
          copyLabel="Kopiuj szablon"
          copySuccessMessage="Szablon skopiowany do schowka."
          accent="blue"
        />
        <TemplateSection
          heading="Przykład poprawnego wypełnienia"
          doc={template.example}
          copyLabel="Kopiuj przykład"
          copySuccessMessage="Przykład skopiowany do schowka."
          accent="amber"
        />
      </div>

      {/* Admin actions */}
      {canManage && (
        <div className="flex items-center gap-2 border-t border-[#edf2f7] px-6 py-3 dark:border-[#1e293b]">
          <button
            type="button"
            onClick={onEdit}
            disabled={actionsDisabled}
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
              onClick={() => setConfirmDelete(true)}
              disabled={actionsDisabled}
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

const CHANNEL_LABELS: Record<TemplateChannel, string> = {
  email: "E-mail",
  zgloszenie: "Zgłoszenie",
};

const CHANNEL_OPTIONS: Array<{ value: TemplateChannel | ""; label: string }> = [
  { value: "", label: "Wszystkie kanały" },
  { value: "email", label: "E-mail" },
  { value: "zgloszenie", label: "Zgłoszenie" },
];

const fieldCls =
  "h-10 w-full rounded-xl border border-[#d9e2ec] bg-white px-3 text-sm text-[#374151] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9]";

export default function TemplatesPage() {
  const { user } = useAuth();
  const { templates, templatesModule } = useData();
  const { push: pushToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = canEditContent(user);
  const canManageTemplates = isAdmin && templatesModule.canWrite;

  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterChannel, setFilterChannel] = useState<TemplateChannel | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("template")
  );
  const [collapsedChannels, setCollapsedChannels] = useState<Set<string>>(new Set());

  const toggleChannel = useCallback((ch: string) => {
    setCollapsedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  }, []);

  const initialParam = useRef(searchParams.get("template"));

  // 140 ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery.trim().toLowerCase()), 140);
    return () => clearTimeout(t);
  }, [rawQuery]);

  // Sync URL param (skip redundant clears — avoids hash-router flicker on mount)
  useEffect(() => {
    const currentParam = searchParams.get("template");

    if (selectedId) {
      if (currentParam !== selectedId) {
        setSearchParams({ template: selectedId }, { replace: true });
      }
      return;
    }

    if (currentParam) {
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, selectedId, setSearchParams]);

  // Scroll selected card into view on first load from URL
  useEffect(() => {
    if (!initialParam.current) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`tpl-${initialParam.current}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to same-route deep-link changes from global search
  useEffect(() => {
    const paramId = searchParams.get("template");
    if (paramId && paramId !== selectedId) {
      setSelectedId(paramId);
      requestAnimationFrame(() => {
        document
          .getElementById(`tpl-${paramId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    let list = [...templates].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pl")
    );
    if (filterChannel) list = list.filter((t) => t.channel === filterChannel);
    if (debouncedQuery) {
      list = list.filter((t) => t.title.toLowerCase().includes(debouncedQuery));
    }
    return list;
  }, [templates, filterChannel, debouncedQuery]);

  const groupedByChannel = useMemo(() => {
    const map = new Map<TemplateChannel, TextTemplate[]>();
    for (const tpl of filtered) {
      const bucket = map.get(tpl.channel) ?? [];
      bucket.push(tpl);
      map.set(tpl.channel, bucket);
    }
    return (["zgloszenie", "email"] as TemplateChannel[])
      .map((ch) => [ch, map.get(ch) ?? []] as [TemplateChannel, TextTemplate[]])
      .filter(([, tpls]) => tpls.length > 0);
  }, [filtered]);

  const selectedTemplate = useMemo(
    () => filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId]
  );

  // Auto-select first visible when filter removes current selection
  useEffect(() => {
    if (selectedId && !filtered.find((t) => t.id === selectedId)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
  }, [filtered, selectedId]);

  const handleDelete = useCallback(async () => {
    if (!selectedTemplate || !canManageTemplates || templatesModule.isMutating) return;

    const nextId = filtered.find((t) => t.id !== selectedTemplate.id)?.id ?? null;

    try {
      await templatesModule.removeTemplate(selectedTemplate.id);
      setSelectedId(nextId);
      pushToast("success", "Szablon został usunięty.");
    } catch (caught) {
      pushToast("error", caught instanceof Error ? caught.message : "Nie udało się usunąć szablonu.");
    }
  }, [canManageTemplates, filtered, pushToast, selectedTemplate, templatesModule]);

  const isEmpty = templates.length === 0;
  const noResults = !isEmpty && filtered.length === 0;

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj szablonów…">
      <section className="mx-auto w-full max-w-304 pb-10">
        {/* Page header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
              Szablony
            </h1>
            <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Szablony wiadomości do szybkiego kopiowania i reużycia.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate(adminTemplateEditorPath("nowy"))}
              disabled={!canManageTemplates || templatesModule.isMutating}
              className="flex items-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Nowy szablon
            </button>
          )}
        </div>

        {templatesModule.error && (
          <div className="mb-5 rounded-2xl border border-[#fee2e2] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d]/50 dark:bg-[#2a0f12] dark:text-[#fca5a5]">
            {templatesModule.error}
          </div>
        )}

        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-50 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
            />
            <input
              type="search"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Szukaj po tytule…"
              className="h-10 w-full rounded-xl border border-[#d9e2ec] bg-white pl-9 pr-3 text-sm text-[#374151] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:bg-[#1e293b] dark:border-[#334155] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
            />
          </div>

          <div className="relative">
            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value as TemplateChannel | "")}
              className={`${fieldCls} w-auto min-w-40 appearance-none pr-8`}
            >
              {CHANNEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#9ca3af]"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          {debouncedQuery && (
            <span className="text-xs text-[#9ca3af]">
              {filtered.length} {filtered.length === 1 ? "wynik" : "wyników"}
            </span>
          )}
        </div>

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-dashed border-[#d9e2ec] bg-white py-20 text-center dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
            <p className="text-sm font-medium text-[#6b7280] dark:text-[#94a3b8]">Brak szablonów.</p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate(adminTemplateEditorPath("nowy"))}
                disabled={!canManageTemplates || templatesModule.isMutating}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163d72] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={15} />
                Dodaj pierwszy szablon
              </button>
            )}
          </div>
        )}

        {/* No-results state */}
        {noResults && (
          <div className="rounded-2xl border border-[#e5e7eb] bg-white py-16 text-center dark:border-[#1e293b] dark:bg-[#111827]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak wyników dla podanych filtrów.</p>
            <button
              type="button"
              onClick={() => {
                setRawQuery("");
                setFilterChannel("");
              }}
              className="mt-3 text-sm font-medium text-[#1d4f91] hover:underline"
            >
              Wyczyść filtry
            </button>
          </div>
        )}

        {/* Two-column main layout */}
        {!isEmpty && !noResults && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            {/* Card list */}
            <div className="space-y-6">
              {groupedByChannel.map(([channel, tpls]) => (
                <div key={channel}>
                  <button
                    type="button"
                    onClick={() => toggleChannel(channel)}
                    className="mb-2.5 flex w-full items-center gap-2 text-left"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
                      {CHANNEL_LABELS[channel]}
                    </span>
                    <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]">
                      {tpls.length}
                    </span>
                    <span className="ml-auto text-[#94a3b8]">
                      {collapsedChannels.has(channel) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </span>
                  </button>
                  {!collapsedChannels.has(channel) && (
                    <div className="space-y-2.5">
                      {tpls.map((tpl) => (
                        <TemplateCard
                          key={tpl.id}
                          template={tpl}
                          selected={selectedTemplate?.id === tpl.id}
                          onClick={() => setSelectedId(tpl.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Detail panel — sticky on xl */}
            {selectedTemplate && (
              <div className="xl:sticky xl:top-20 xl:self-start">
                <TemplateDetailPanel
                  template={selectedTemplate}
                  canManage={canManageTemplates}
                  actionsDisabled={templatesModule.isMutating}
                  onEdit={() => navigate(adminTemplateEditorPath(selectedTemplate.id))}
                  onDelete={handleDelete}
                />
              </div>
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
