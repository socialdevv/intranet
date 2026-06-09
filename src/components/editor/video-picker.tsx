import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Film, X, Check, AlertCircle, Loader2 } from "lucide-react";
import type { Editor } from "@tiptap/react";
import MediaUploadDropzone from "@/components/editor/media-upload-dropzone";
import { normalizeMediaSrc } from "@/lib/media/assets";

interface Props {
  editor: Editor;
  onClose: () => void;
  /** Ref to the toolbar button — used to anchor the popover position. */
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

type PreviewState = "idle" | "loading" | "ok" | "error";

/**
 * Compact floating panel for inserting a videoBlock node.
 * Mirrors the ImagePicker pattern — rendered via a portal so it escapes
 * any overflow/transform context.
 */
export default function VideoPicker({ editor, onClose, anchorRef }: Props) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Keep popup anchored while scrolling/resizing and flip above when needed.
  useEffect(() => {
    const panelW = 308;
    const margin = 8;

    function recompute() {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const left = Math.max(margin, Math.min(rect.left, window.innerWidth - panelW - margin));
      const spaceBelow = window.innerHeight - rect.bottom - margin;
      const spaceAbove = rect.top - margin;

      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        const top = rect.bottom + 6;
        const maxH = Math.max(180, window.innerHeight - top - margin);
        setPos({ top, left, maxH });
      } else {
        const maxH = Math.max(180, Math.min(spaceAbove - 6, 440));
        const top = Math.max(margin, rect.top - maxH - 6);
        setPos({ top, left, maxH });
      }
    }

    recompute();
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

  const normalizedSrc = normalizeMediaSrc(src);

  useEffect(() => {
    if (!normalizedSrc.trim()) {
      setPreviewState("idle");
      return;
    }
    setPreviewState("loading");
  }, [normalizedSrc]);

  function insert() {
    const trimmed = normalizedSrc.trim();
    if (!trimmed) {
      setError("Najpierw wyślij plik wideo albo podaj zewnętrzny URL.");
      return;
    }
    if (previewState === "error") {
      setError("Podgląd wideo nie działa. Sprawdź ścieżkę lub URL.");
      return;
    }
    editor.chain().focus().insertContent({
      type: "videoBlock",
      attrs: { src: trimmed, width: "100%", align: "center" },
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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
          <Film size={13} />
          Wstaw wideo
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ui-btn-icon size-5 border-transparent bg-transparent text-[#9ca3af] hover:text-[#374151]"
        >
          <X size={12} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2.5 p-3">
          <MediaUploadDropzone
            mediaKind="video"
            title="Upload wideo"
            helperText="Wybierz wideo z dysku, przeciągnij je tutaj albo wklej"
            actionLabel="Wybierz wideo"
            currentSrc={normalizedSrc || undefined}
            onUploaded={({ src: uploadedSrc }) => {
              setSrc(uploadedSrc);
              setError("");
            }}
          />

          {/* External URL input */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              Zewnętrzny URL wideo (opcjonalnie)
            </label>
            <input
              autoFocus
              type="text"
              value={src}
              onChange={(e) => { setSrc(e.target.value); setError(""); }}
              placeholder="https://…/film.mp4"
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-[#9ca3af]">
              Dla materiałów projektowych używaj uploadu. URL zostaw jako opcję dla zewnętrznych źródeł.
            </p>
            {error && (
              <p className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
                <AlertCircle size={10} />
                {error}
              </p>
            )}
          </div>

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
                  <span>Nie można załadować wideo</span>
                  <span className="text-[10px] text-[#9ca3af]">Sprawdź ścieżkę lub URL</span>
                </div>
              )}
              <video
                key={normalizedSrc}
                src={normalizedSrc}
                controls
                preload="metadata"
                className={`max-h-40 w-full bg-black ${previewState === "ok" ? "" : "hidden"}`}
                onLoadedData={() => setPreviewState("ok")}
                onError={() => setPreviewState("error")}
              />
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-[#f1f5f9] p-3">
        <button
          type="button"
          onClick={insert}
          disabled={!normalizedSrc.trim() || previewState === "loading"}
          className="ui-btn ui-btn-primary h-8 w-full text-xs disabled:opacity-50"
        >
          <Check size={12} />
          Wstaw wideo
        </button>
      </div>
    </div>,
    document.body
  );
}
