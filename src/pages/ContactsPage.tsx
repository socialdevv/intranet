import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Phone, Mail, MapPin, Copy, Check, Users, Globe, X, ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import type { ContactEntry, ContactGroup } from "@/lib/types/domain";

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyInline({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { push: toast } = useToast();

  const handleClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    toast("success", `Skopiowano: ${label}`);
    setTimeout(() => setCopied(false), 2000);
  }, [value, label, toast]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Kopiuj ${label}`}
      className="ml-1.5 inline-flex shrink-0 items-center rounded p-0.5 text-[#94a3b8] transition hover:text-[#1d4f91] dark:hover:text-[#60a5fa]"
    >
      {copied ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />}
    </button>
  );
}

// ── Single contact card ───────────────────────────────────────────────────────

// ── Structured detail modal ───────────────────────────────────────────────

function ContactDetailModal({ entry, onClose }: { entry: ContactEntry; onClose: () => void }) {
  const t = entry.detailTable!;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const validSections = (t.sections ?? []).filter((s) => (s.groups ?? []).length > 0);
  const sh = t.sectionHeader || "Sekcja";
  const ih = t.itemsHeader || "Pozycja";
  const ah = t.actionHeader || "Dzia\u0142anie";

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop — fixed so it always covers the viewport regardless of scroll position */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Content */}
      <div className="relative flex min-h-full items-start justify-center p-4 pt-12 sm:pt-16">
        <div className="relative z-10 mb-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-[#0f1e35]">
          {/* Header — sticky so it remains visible when the table is long */}
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 rounded-t-2xl border-b border-[#e5e7eb] bg-white px-6 py-4 dark:border-[#1e3a5f] dark:bg-[#0f1e35]">
            <div>
              <h2 className="text-base font-bold text-[#0f172a] dark:text-[#f1f5f9]">{entry.title}</h2>
              {t.title && (
                <p className="mt-0.5 text-sm text-[#64748b] dark:text-[#94a3b8]">{t.title}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#374151] dark:hover:bg-[#1e293b] dark:hover:text-[#f1f5f9]"
              aria-label="Zamknij"
            >
              <X size={18} />
            </button>
          </div>

          {/* Notes — above table */}
          {t.notes && (
            <div className="border-b border-[#e5e7eb] px-6 py-3 dark:border-[#1e3a5f]">
              <p className="text-xs text-[#6b7280] dark:text-[#94a3b8]">{t.notes}</p>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto p-6">
            {validSections.length === 0 ? (
              <p className="text-sm text-[#9ca3af]">Brak danych.</p>
            ) : (
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border border-[#e2e8f0] bg-[#f1f5f9] px-3 py-2.5 text-left text-xs font-semibold text-[#374151] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
                      {sh}
                    </th>
                    <th className="border border-[#e2e8f0] bg-[#f1f5f9] px-3 py-2.5 text-left text-xs font-semibold text-[#374151] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
                      {ih}
                    </th>
                    <th className="border border-[#e2e8f0] bg-[#f1f5f9] px-3 py-2.5 text-left text-xs font-semibold text-[#374151] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#cbd5e1]">
                      {ah}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {validSections.map((section) =>
                    section.groups.map((group, gIdx) => (
                      <tr
                        key={group.id}
                        className={gIdx % 2 === 0 ? "bg-white dark:bg-[#0d1b2e]" : "bg-[#f8fafc] dark:bg-[#0f2340]/40"}
                      >
                        {gIdx === 0 && (
                          <td
                            rowSpan={section.groups.length}
                            className="border border-[#e2e8f0] bg-[#edf3fa] px-3 py-2.5 align-middle text-sm font-semibold text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f2340] dark:text-[#60a5fa]"
                          >
                            {section.label}
                          </td>
                        )}
                        <td className="border border-[#e2e8f0] px-3 py-2 align-top whitespace-pre-wrap text-[#374151] dark:border-[#334155] dark:text-[#cbd5e1]">
                          {group.items}
                        </td>
                        <td className="border border-[#e2e8f0] px-3 py-2 align-top text-[#374151] dark:border-[#334155] dark:text-[#cbd5e1]">
                          {group.action}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Single contact card ───────────────────────────────────────────────

function ContactCard({ entry, linkedId }: { entry: ContactEntry; linkedId?: string | null }) {
  const isLinked = entry.id === linkedId;
  const hasDetail = (entry.detailTable?.sections?.length ?? 0) > 0;
  const [showModal, setShowModal] = useState(isLinked && hasDetail);
  const cardRef = useRef<HTMLDivElement>(null);

  // Sync modal open state when deep-link target changes (same-route navigation)
  useEffect(() => {
    if (isLinked && hasDetail) {
      setShowModal(true);
    } else if (!isLinked) {
      setShowModal(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinked]);

  // Scroll into view when this card becomes the deep-link target
  useEffect(() => {
    if (isLinked && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isLinked]);

  return (
    <>
      <div ref={cardRef} className="rounded-xl border border-[#e5e7eb] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="p-4">
          <p className="mb-0.5 text-[15px] font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            {entry.title}
          </p>
          {entry.description && (
            <p className="mb-3 text-xs text-[#64748b] dark:text-[#94a3b8]">{entry.description}</p>
          )}
          <div className="space-y-1.5">
            {entry.phone && (
              <div className="flex items-center gap-2">
                <Phone size={13} className="shrink-0 text-[#94a3b8]" />
                <span className="font-mono text-sm text-[#1d4f91] dark:text-[#60a5fa]">
                  {entry.phone}
                </span>
                <CopyInline value={entry.phone} label={entry.phone} />
              </div>
            )}
            {entry.email && (
              <div className="flex items-center gap-2">
                <Mail size={13} className="shrink-0 text-[#94a3b8]" />
                <span className="text-sm text-[#374151] dark:text-[#cbd5e1]">{entry.email}</span>
                <CopyInline value={entry.email} label={entry.email} />
              </div>
            )}
            {entry.address && (
              <div className="flex items-start gap-2">
                <MapPin size={13} className="mt-0.5 shrink-0 text-[#94a3b8]" />
                <span className="whitespace-pre-line text-sm text-[#374151] dark:text-[#cbd5e1]">
                  {entry.address}
                </span>
              </div>
            )}
          </div>
          {hasDetail && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#dde5ee] bg-[#f8fafc] px-3 py-1.5 text-xs font-medium text-[#1d4f91] transition hover:bg-[#edf3fa] dark:border-[#1e3a5f] dark:bg-[#0f2340] dark:text-[#60a5fa] dark:hover:bg-[#1a3a5c]"
            >
              Szczegóły →
            </button>
          )}
        </div>
      </div>
      {showModal && <ContactDetailModal entry={entry} onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Group section ─────────────────────────────────────────────────────────────

const GROUP_META: Record<ContactGroup, { label: string; Icon: typeof Users }> = {
  wewnetrzne: { label: "Wewnętrzne", Icon: Users },
  zewnetrzne: { label: "Zewnętrzne", Icon: Globe },
};

function ContactGroup({ group, entries, linkedId, collapsible }: { group: ContactGroup; entries: ContactEntry[]; linkedId?: string | null; collapsible?: boolean }) {
  const { label, Icon } = GROUP_META[group];

  const cards = (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map((e) => (
        <ContactCard key={e.id} entry={e} linkedId={linkedId} />
      ))}
    </div>
  );

  if (collapsible) {
    return (
      <details className="group">
        <summary className="mb-3 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <Icon size={15} className="text-[#1d4f91] dark:text-[#60a5fa]" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1d4f91] dark:text-[#60a5fa]">
            {label}
          </h2>
          <span className="rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
            {entries.length}
          </span>
          <ChevronDown size={15} className="ml-auto text-[#94a3b8] transition-transform duration-200 group-open:rotate-180" />
        </summary>
        {cards}
      </details>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon size={15} className="text-[#1d4f91] dark:text-[#60a5fa]" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1d4f91] dark:text-[#60a5fa]">
          {label}
        </h2>
        <span className="rounded-full bg-[#e9f2ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#60a5fa]">
          {entries.length}
        </span>
      </div>
      {cards}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { user } = useAuth();
  const { contacts } = useData();
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("contact");

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => a.sortOrder - b.sortOrder),
    [contacts]
  );

  const internal = useMemo(() => sorted.filter((c) => c.group === "wewnetrzne"), [sorted]);
  const external = useMemo(() => sorted.filter((c) => c.group === "zewnetrzne"), [sorted]);

  const isEmpty = sorted.length === 0;

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj…">
      <section className="mx-auto w-full max-w-[70rem] pb-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a] dark:text-[#f1f5f9] sm:text-3xl">
            Dane kontaktowe
          </h1>
          <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
            Kontakty wewnętrzne i zewnętrzne do codziennego użytku.
          </p>
        </div>

        {isEmpty ? (
          <div className="rounded-2xl border border-dashed border-[#d9e2ec] bg-white py-20 text-center dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
            <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">
              Brak danych kontaktowych. Administrator może je dodać w panelu administracyjnym.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {external.length > 0 && (
              <ContactGroup group="zewnetrzne" entries={external} linkedId={linkedId} />
            )}
            {internal.length > 0 && (
              <ContactGroup group="wewnetrzne" entries={internal} linkedId={linkedId} collapsible />
            )}
          </div>
        )}
      </section>
    </AppShell>
  );
}
