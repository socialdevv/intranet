import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check } from "lucide-react";
import TipTapRenderer from "@/components/knowledge/tiptap-renderer";
import { extractPlainText, copyToClipboard } from "@/lib/utils";
import {
  extractCopyablePlainText,
  buildSelectionClipboardPayload,
} from "@/lib/knowledge/no-copy-inline";
import type { TextTemplate } from "@/lib/types/domain";

// ── Section with copy ─────────────────────────────────────────────────────────

function PreviewSection({ heading, doc, copyLabel, accentColor }: {
  heading: string;
  doc: unknown;
  copyLabel: string;
  accentColor: string;
}) {
  const [copied, setCopied] = useState(false);

  const hasContent = Boolean(
    doc &&
    typeof doc === "object" &&
    Array.isArray((doc as { content?: unknown[] }).content) &&
    (doc as { content: unknown[] }).content.length > 0 &&
    extractPlainText(doc).trim().length > 0
  );

  const handleCopy = useCallback(async () => {
    await copyToClipboard(extractCopyablePlainText(doc).trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [doc]);

  function handleSelectionCopy(e: React.ClipboardEvent<HTMLDivElement>) {
    const payload = buildSelectionClipboardPayload(window.getSelection(), e.currentTarget);
    if (!payload) return;
    e.clipboardData.setData("text/plain", payload.text);
    e.clipboardData.setData("text/html", payload.html);
    e.preventDefault();
  }

  return (
    <div>
      <div className={`mb-2.5 flex items-center justify-between border-b pb-2 ${accentColor === "blue" ? "border-[#dbeafe]" : "border-[#fde68a]"}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${accentColor === "blue" ? "text-[#1d4f91]" : "text-[#92400e]"}`}>
          {heading}
        </span>
        {hasContent && (
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
              copied ? "bg-[#dcfce7] text-[#166534]" : "bg-[#1d4f91] text-white hover:bg-[#163d72]"
            }`}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? "Skopiowano!" : copyLabel}
          </button>
        )}
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {hasContent ? (
          <div className="prose-editor text-sm" onCopy={handleSelectionCopy}>
            <TipTapRenderer doc={doc} />
          </div>
        ) : (
          <p className="text-xs italic text-[#9ca3af]">Brak treści.</p>
        )}
      </div>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface Props {
  template: TextTemplate;
  onClose: () => void;
}

export default function TemplatePreviewModal({ template, onClose }: Props) {
  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Podgląd szablonu: ${template.title}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-[#dde5ee] bg-white shadow-2xl max-h-[90vh] dark:border-[#334155] dark:bg-[#1e293b] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#f1f5f9] px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-snug text-[#0f172a] dark:text-[#f1f5f9]">
              {template.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-[#9ca3af] transition hover:bg-[#f1f5f9] hover:text-[#374151] dark:text-[#64748b] dark:hover:bg-[#263347] dark:hover:text-[#cbd5e1]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <PreviewSection
            heading="Szablon"
            doc={template.body}
            copyLabel="Kopiuj szablon"
            accentColor="blue"
          />
          <PreviewSection
            heading="Przykład poprawnego wypełnienia"
            doc={template.example}
            copyLabel="Kopiuj przykład"
            accentColor="amber"
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#f1f5f9] px-5 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-[#e5e7eb] px-4 text-xs font-medium text-[#374151] transition hover:bg-[#f8fafc] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
