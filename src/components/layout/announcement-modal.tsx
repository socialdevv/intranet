import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import { extractPlainText } from "@/lib/utils";
import type { Announcement, AnnouncementColor } from "@/lib/types/domain";

// ── Color config ──────────────────────────────────────────────────────────────

const MODAL_COLOR: Record<AnnouncementColor, { header: string; pill: string; pillActive: string }> = {
  red: {
    header: "border-[#fecaca] bg-[#fef2f2] dark:border-[#7f1d1d]/40 dark:bg-[#1a0808]",
    pill: "border-[#fecaca] text-[#dc2626] hover:bg-[#fef2f2] dark:border-[#7f1d1d]/40 dark:text-[#f87171]",
    pillActive: "bg-[#dc2626] text-white border-[#dc2626]",
  },
  orange: {
    header: "border-[#fed7aa] bg-[#fff7ed] dark:border-[#7c2d12]/40 dark:bg-[#1a0a00]",
    pill: "border-[#fed7aa] text-[#ea580c] hover:bg-[#fff7ed] dark:border-[#7c2d12]/40 dark:text-[#fb923c]",
    pillActive: "bg-[#ea580c] text-white border-[#ea580c]",
  },
  green: {
    header: "border-[#bbf7d0] bg-[#f0fdf4] dark:border-[#14532d]/40 dark:bg-[#0a1f0a]",
    pill: "border-[#bbf7d0] text-[#16a34a] hover:bg-[#f0fdf4] dark:border-[#14532d]/40 dark:text-[#4ade80]",
    pillActive: "bg-[#16a34a] text-white border-[#16a34a]",
  },
  blue: {
    header: "border-[#bfdbfe] bg-[#eff6ff] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340]",
    pill: "border-[#bfdbfe] text-[#2563eb] hover:bg-[#eff6ff] dark:border-[#1e3a5f]/60 dark:text-[#60a5fa]",
    pillActive: "bg-[#2563eb] text-white border-[#2563eb]",
  },
};

// ── Props ─────────────────────────────────────────────────────────────────────

type AnnouncementModalProps = {
  announcements: Announcement[];
  initialId: string;
  onClose: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnnouncementModal({
  announcements,
  initialId,
  onClose,
}: AnnouncementModalProps) {
  const [activeId, setActiveId] = useState(initialId);
  const backdropRef = useRef<HTMLDivElement>(null);

  const current = announcements.find((a) => a.id === activeId) ?? announcements[0];
  const cfg = MODAL_COLOR[current?.color ?? "blue"];
  const multiple = announcements.length > 1;
  const hasRichBody = Boolean(current?.body && extractPlainText(current.body).trim().length > 0);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Trap focus
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  if (!current) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl border border-[#dde5ee] bg-white shadow-xl outline-none dark:border-[#1e293b] dark:bg-[#0f1e33] max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className={`flex items-start justify-between gap-3 rounded-t-xl border-b px-5 py-3.5 ${cfg.header}`}>
          <h2 className="text-base font-bold leading-snug text-[#0f172a] dark:text-[#f1f5f9]">
            {current.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6b7280] transition hover:bg-black/10 dark:text-[#94a3b8] dark:hover:bg-white/10"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-3.5">
          {hasRichBody ? (
            <div className="prose-editor text-sm">
              <TipTapRenderer doc={current.body} />
            </div>
          ) : current.description ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#374151] dark:text-[#cbd5e1]">
              {current.description}
            </p>
          ) : (
            <p className="text-sm italic text-[#9ca3af]">Brak szczegółowej treści.</p>
          )}
        </div>

        {/* Multi-announcement switcher */}
        {multiple && (
          <div className="border-t border-[#e5e7eb] px-5 py-3 dark:border-[#1e293b]">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#9ca3af]">
              Inne aktywne ogłoszenia
            </p>
            <div className="flex flex-wrap gap-1.5">
              {announcements.map((a) => {
                const c = MODAL_COLOR[a.color];
                const isActive = a.id === activeId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setActiveId(a.id)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                      isActive ? c.pillActive : `bg-white dark:bg-[#0f1e33] ${c.pill}`
                    }`}
                  >
                    {a.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
