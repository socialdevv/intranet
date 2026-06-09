import { useState, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import {
  Trash2,
  AlignLeft,
  AlignRight,
  Pencil,
  Check,
  X,
  Image as ImageIcon,
} from "lucide-react";
import MediaUploadDropzone from "@/components/editor/media-upload-dropzone";
import { normalizeMediaSrc } from "@/lib/media/assets";

type Layout = "image-left" | "image-right";

const WIDTH_OPTIONS = ["33%", "50%", "66%"] as const;

export default function ImageTextNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const src = (node.attrs.src as string) ?? "";
  const alt = (node.attrs.alt as string) ?? "";
  const layout = (node.attrs.layout as Layout) ?? "image-left";
  const imageWidth = (node.attrs.imageWidth as string) ?? "40%";

  const [editing, setEditing] = useState(false);

  // Width draft: holds the in-progress slider/input value so the image does not
  // re-render on every drag step. Node attr is only written on pointer release
  // or manual input commit.
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const parsedImageWidth = parseInt(imageWidth, 10) || 40;
  const displayVal = widthDraft !== null ? widthDraft : String(parsedImageWidth);

  // Clear draft if the attribute changes externally (preset click, undo, etc.)
  useEffect(() => { setWidthDraft(null); }, [imageWidth]);

  function commitWidthDraft() {
    const n = Math.min(100, Math.max(1, parseInt(widthDraft ?? String(parsedImageWidth), 10) || 1));
    updateAttributes({ imageWidth: `${n}%` });
    setWidthDraft(null);
  }
  const [editSrc, setEditSrc] = useState("");
  const [editAlt, setEditAlt] = useState("");

  const resolvedSrc = normalizeMediaSrc(src);
  const isImageLeft = layout === "image-left";

  function openEdit() {
    setEditSrc(src);
    setEditAlt(alt);
    setEditing(true);
  }

  function commitEdit() {
    const normalizedSrc = normalizeMediaSrc(editSrc || src);
    if (!normalizedSrc) {
      return;
    }

    updateAttributes({ src: normalizedSrc, alt: editAlt.trim() });
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  const imagePanel = (
    <div
      contentEditable={false}
      className="group/img min-w-5 shrink-0 select-none"
      style={{ width: imageWidth }}
    >
      {/* Image or placeholder */}
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className="block w-full rounded-lg border border-[#e5e7eb] object-contain"
        />
      ) : (
        <div
          className="flex aspect-video w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[#d1d5db] bg-[#f8fafc] text-[#9ca3af]"
          onMouseDown={(e) => {
            e.preventDefault();
            openEdit();
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <ImageIcon size={24} />
            <span className="text-xs">Kliknij, aby dodać obraz</span>
          </div>
        </div>
      )}

      {/* Edit panel */}
      {editing && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-[#e5e7eb] bg-white p-2 shadow">
          <MediaUploadDropzone
            mediaKind="image"
            title="Podmień obraz"
            helperText="Przeciągnij, wklej albo wybierz obraz z dysku"
            actionLabel="Wybierz obraz"
            currentSrc={normalizeMediaSrc(editSrc || src) || undefined}
            onUploaded={({ src: uploadedSrc, suggestedAlt }) => {
              setEditSrc(uploadedSrc);
              if (!editAlt.trim()) {
                setEditAlt(suggestedAlt);
              }
            }}
          />
          <input
            type="text"
            placeholder="Opis alternatywny (alt)…"
            value={editAlt}
            onChange={(e) => setEditAlt(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") cancelEdit();
            }}
            className="h-7 w-full rounded-md border border-[#d1d5db] px-2 text-xs outline-none focus:border-[#1d4f91]"
          />
          <div className="flex gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={commitEdit}
              className="flex items-center gap-1 rounded-lg bg-[#1d4f91] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#1a4580]"
            >
              <Check size={10} /> Zapisz
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="flex items-center gap-1 rounded-lg border border-[#e5e7eb] px-2.5 py-1 text-[11px] text-[#64748b] hover:bg-[#f8fafc]"
            >
              <X size={10} /> Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Controls — visible on hover */}
      {!editing && (
        <div className="mt-1.5 space-y-1 opacity-0 transition-opacity group-hover/img:opacity-100">
          {/* Row 1: layout + presets + actions */}
          <div className="flex items-center justify-between gap-1">
            {/* Layout flip */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => updateAttributes({ layout: "image-left" })}
                title="Obraz po lewej"
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  layout === "image-left"
                    ? "bg-[#1d4f91] text-white"
                    : "text-[#6b7280] hover:bg-[#f1f5f9] hover:text-[#374151]"
                }`}
              >
                <AlignLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => updateAttributes({ layout: "image-right" })}
                title="Obraz po prawej"
                className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                  layout === "image-right"
                    ? "bg-[#1d4f91] text-white"
                    : "text-[#6b7280] hover:bg-[#f1f5f9] hover:text-[#374151]"
                }`}
              >
                <AlignRight size={12} />
              </button>
            </div>

            {/* Width presets */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
              {WIDTH_OPTIONS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => { setWidthDraft(null); updateAttributes({ imageWidth: w }); }}
                  className={`h-6 rounded-md px-1.5 text-[10px] font-semibold transition ${
                    imageWidth === w
                      ? "bg-[#1d4f91] text-white"
                      : "text-[#6b7280] hover:bg-[#f1f5f9] hover:text-[#374151]"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>

            {/* Edit + delete */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={openEdit}
                title="Edytuj obraz"
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f1f5f9] hover:text-[#1d4f91]"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={() => deleteNode()}
                title="Usuń blok"
                className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 size={11} />
              </button>
            </div>
          </div>

          {/* Row 2: precise width slider + editable input */}
          <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1.5 shadow-sm">
            <span className="shrink-0 text-[10px] text-[#9ca3af]">Szerokość</span>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={parseInt(displayVal, 10) || 1}
              onChange={(e) => setWidthDraft(e.target.value)}
              onPointerUp={() => commitWidthDraft()}
              className="h-1.5 flex-1 accent-[#1d4f91]"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={displayVal}
              onChange={(e) => setWidthDraft(e.target.value)}
              onBlur={() => commitWidthDraft()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") { e.preventDefault(); commitWidthDraft(); }
              }}
              className="w-10 shrink-0 rounded border border-[#e5e7eb] bg-transparent text-right text-[10px] font-semibold text-[#374151] outline-none focus:border-[#1d4f91] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="shrink-0 text-[10px] text-[#9ca3af]">%</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <NodeViewWrapper>
      <div
        className={[
          "my-4 flex items-start gap-4 rounded-xl border bg-white p-3",
          selected
            ? "border-[#1d4f91] ring-2 ring-[#1d4f91]/20"
            : "border-[#e5e7eb]",
        ].join(" ")}
      >
        {isImageLeft ? (
          <>
            {imagePanel}
            <div className="min-w-0 flex-1">
              <NodeViewContent className="outline-none" />
            </div>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <NodeViewContent className="outline-none" />
            </div>
            {imagePanel}
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}
