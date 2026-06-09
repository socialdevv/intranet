import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Image, X, Check, AlertCircle, Loader2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { normalizeMediaSrc } from "@/lib/media/assets";
import MediaUploadDropzone from "@/components/editor/media-upload-dropzone";

interface Props {
  editor: Editor;
  onClose: () => void;
  /** Ref to the toolbar button — used to anchor the popover position. */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

type PreviewState = "idle" | "loading" | "ok" | "error";

/**
 * Compact floating panel for inserting an imageBlock node.
 * Rendered via a portal so it escapes any overflow/transform context.
 * Anchored below the toolbar button that triggered it.
 */
export default function ImagePicker({ editor, onClose, anchorRef }: Props) {
  const [src, setSrc] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Recompute position relative to the anchor button, tracking scroll and
  // resize so the popup stays anchored even when the page is scrolled.
  // Uses flip-up logic: if there is not enough space below the button,
  // the panel is shown above it instead.
  useEffect(() => {
    const panelW = 308; // w-76 = 19rem ≈ 304px; add a small buffer
    const margin = 8;

    function recompute() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - panelW - margin));
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        // Show below the button
        const top = rect.bottom + 6;
        const maxH = Math.max(180, window.innerHeight - top - margin);
        setPos({ top, left, maxH });
      } else {
        // Not enough space below — flip above the button
        const maxH = Math.max(180, Math.min(spaceAbove - 6, 440));
        const top = Math.max(margin, rect.top - maxH - 6);
        setPos({ top, left, maxH });
      }
    }

    recompute();

    // capture: true catches scroll events from any scrollable ancestor
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener("scroll", recompute, opts);
    window.addEventListener("resize", recompute);
    return () => {
      window.removeEventListener("scroll", recompute, opts);
      window.removeEventListener("resize", recompute);
    };
  }, [anchorRef]);

  // Click-outside closes the popover
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node)) return;
      if (anchorRef.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, anchorRef]);

  // Reset preview state whenever src changes
  useEffect(() => {
    const normalized = normalizeMediaSrc(src);
    if (!normalized) {
      setPreviewState("idle");
      return;
    }
    setPreviewState("loading");
  }, [src]);

  const normalizedSrc = normalizeMediaSrc(src);

  function insert() {
    if (!normalizedSrc) {
      setError("Najpierw wgraj obraz, który chcesz wstawić.");
      return;
    }
    if (previewState === "error") {
      setError("Obraz nie załadował się poprawnie. Sprawdź ścieżkę.");
      return;
    }
    editor.chain().focus().insertContent({
      type: "imageBlock",
      attrs: { src: normalizedSrc, alt: alt.trim(), width: "100%", align: "center" },
    }).run();
    onClose();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") insert();
    if (e.key === "Escape") onClose();
  }

  const inputCls =
    "ui-input h-9 text-xs text-[#374151] placeholder-[#9ca3af]";

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH }}
      className="ui-menu-surface fixed z-200 flex w-76 flex-col overflow-hidden"
      onKeyDown={onKeyDown}
    >
      {/* Header — always visible */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#f1f5f9] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
          <Image size={13} />
          Wstaw obraz
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ui-btn-icon size-5 border-transparent bg-transparent text-[#9ca3af] hover:text-[#374151]"
        >
          <X size={12} />
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2.5 p-3">
          <MediaUploadDropzone
            mediaKind="image"
            title="Upload obrazu"
            helperText="Wybierz obraz z dysku, przeciągnij go tutaj albo wklej"
            currentSrc={normalizedSrc || undefined}
            onUploaded={({ src: uploadedSrc, suggestedAlt }) => {
              setSrc(uploadedSrc);
              setError("");
              if (!alt.trim()) {
                setAlt(suggestedAlt);
              }
            }}
          />

          {error && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
              <AlertCircle size={10} />
              {error}
            </p>
          )}

          {/* Alt text */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              Tekst alternatywny (opcjonalny)
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Opis obrazu"
              className={inputCls}
            />
          </div>

          {/* Live preview */}
          {normalizedSrc && (
            <div className="overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]">
              {previewState === "loading" && (
                <div className="flex h-20 items-center justify-center gap-1.5 text-[11px] text-[#9ca3af]">
                  <Loader2 size={13} className="animate-spin" />
                  Ładowanie podglądu…
                </div>
              )}
              {previewState === "error" && (
                <div className="flex h-20 flex-col items-center justify-center gap-1 text-[11px] text-[#ef4444]">
                  <AlertCircle size={14} />
                  <span>Nie można załadować obrazu</span>
                  <span className="text-[10px] text-[#9ca3af]">Sprawdź ścieżkę lub URL</span>
                </div>
              )}
              <img
                key={normalizedSrc}
                src={normalizedSrc}
                alt={alt}
                className={`max-h-36 w-full object-contain ${previewState === "ok" ? "" : "hidden"}`}
                onLoad={() => setPreviewState("ok")}
                onError={() => setPreviewState("error")}
              />
            </div>
          )}
        </div>
      </div>

      {/* Insert button — always visible at the bottom, never scrolls away */}
      <div className="shrink-0 border-t border-[#f1f5f9] p-3">
        <button
          type="button"
          onClick={insert}
          disabled={previewState === "loading" || !normalizedSrc}
          className="ui-btn ui-btn-primary h-8 w-full text-xs disabled:opacity-50"
        >
          <Check size={12} />
          Wstaw obraz
        </button>
      </div>
    </div>,
    document.body
  );
}
