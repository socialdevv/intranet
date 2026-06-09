import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Paperclip, X, Check, AlertCircle } from "lucide-react";
import type { Editor } from "@tiptap/react";
import MediaUploadDropzone from "@/components/editor/media-upload-dropzone";
import { normalizeMediaSrc } from "@/lib/media/assets";

interface Props {
  editor: Editor;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function suggestFileLabelFromSrc(src: string): string {
  const normalized = normalizeMediaSrc(src);

  if (!normalized) {
    return "";
  }

  try {
    const url = normalized.startsWith("http://") || normalized.startsWith("https://")
      ? new URL(normalized)
      : new URL(normalized, window.location.origin);
    const segment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    return decodeURIComponent(segment);
  } catch {
    const segment = normalized.split("/").filter(Boolean).at(-1) ?? "";
    return decodeURIComponent(segment);
  }
}

export default function FilePicker({ editor, onClose, anchorRef }: Props) {
  const [src, setSrc] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; maxH: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onDown(event: MouseEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      if (anchorRef.current?.contains(event.target as Node)) return;
      onClose();
    }

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [anchorRef, onClose]);

  function insert() {
    const normalizedSrc = normalizeMediaSrc(src);

    if (!normalizedSrc) {
      setError("Najpierw wyślij plik albo podaj jego URL.");
      return;
    }

    const resolvedLabel = label.trim() || suggestFileLabelFromSrc(normalizedSrc) || "Pobierz plik";

    editor
      .chain()
      .focus()
      .insertContent({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: resolvedLabel,
            marks: [{ type: "link", attrs: { href: normalizedSrc } }],
          },
        ],
      })
      .run();

    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") insert();
    if (event.key === "Escape") onClose();
  }

  const normalizedSrc = normalizeMediaSrc(src);
  const inputCls = "ui-input h-9 text-xs text-[#374151] placeholder-[#9ca3af]";

  if (!pos) return null;

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: pos.top, left: pos.left, maxHeight: pos.maxH }}
      className="ui-menu-surface fixed z-200 flex w-76 flex-col overflow-hidden"
      onKeyDown={onKeyDown}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-[#f1f5f9] px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#374151]">
          <Paperclip size={13} />
          Wstaw plik
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
            mediaKind="file"
            title="Upload pliku"
            helperText="Wybierz plik z dysku, przeciągnij go tutaj albo wklej"
            actionLabel="Wybierz plik"
            currentSrc={normalizedSrc || undefined}
            onUploaded={({ src: uploadedSrc, file }) => {
              setSrc(uploadedSrc);
              setError("");
              if (!label.trim()) {
                setLabel(file.name);
              }
            }}
          />

          {error && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-red-500">
              <AlertCircle size={10} />
              {error}
            </p>
          )}

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              URL pliku (opcjonalnie)
            </label>
            <input
              autoFocus
              type="text"
              value={src}
              onChange={(event) => {
                setSrc(event.target.value);
                setError("");
              }}
              placeholder="https://…/dokument.pdf"
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-[#9ca3af]">
              Możesz wkleić zewnętrzny URL, ale pliki projektowe powinny trafiać przez upload.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              Tekst linku
            </label>
            <input
              type="text"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="np. Regulamin promocji.pdf"
              className={inputCls}
            />
            <p className="mt-1 text-[10px] text-[#9ca3af]">
              Po wstawieniu plik pojawi się w treści jako link do pobrania.
            </p>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-[#f1f5f9] p-3">
        <button
          type="button"
          onClick={insert}
          disabled={!normalizedSrc}
          className="ui-btn ui-btn-primary h-8 w-full text-xs disabled:opacity-50"
        >
          <Check size={12} />
          Wstaw plik
        </button>
      </div>
    </div>,
    document.body
  );
}