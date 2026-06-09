import { useState, useEffect } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { AlignLeft, AlignCenter, AlignRight, ChevronUp, ChevronDown, Trash2, Pencil, Check, X } from "lucide-react";
import MediaUploadDropzone from "@/components/editor/media-upload-dropzone";
import { normalizeMediaSrc } from "@/lib/media/assets";

type Width = string;
type Align = "left" | "center" | "right";

const WIDTH_OPTIONS = ["25%", "50%", "75%", "100%"];

/**
 * Editor-mode NodeView for imageBlock.
 * Shows the image with resize (width presets), align, move up/down, delete,
 * and an inline edit panel for changing src / alt after insertion.
 */
export default function ImageBlockNodeView({
  node,
  editor,
  getPos,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const { src, alt, width, align } = node.attrs as {
    src: string;
    alt: string;
    width: Width;
    align: Align;
  };

  const [editing, setEditing] = useState(false);
  const [editSrc, setEditSrc] = useState("");
  const [editAlt, setEditAlt] = useState("");

  // Width draft: holds the in-progress slider/input value so the image does not
  // re-render on every drag step. Node attr is only written on pointer release
  // or manual input commit.
  const [widthDraft, setWidthDraft] = useState<string | null>(null);
  const parsedWidth = parseInt(width, 10) || 100;
  const displayVal = widthDraft !== null ? widthDraft : String(parsedWidth);

  // Clear draft if the attribute changes externally (preset click, undo, etc.)
  useEffect(() => { setWidthDraft(null); }, [width]);

  function commitWidthDraft() {
    const n = Math.min(100, Math.max(1, parseInt(widthDraft ?? String(parsedWidth), 10) || 1));
    updateAttributes({ width: `${n}%` });
    setWidthDraft(null);
  }

  function openEdit() {
    setEditSrc(src);
    setEditAlt(alt || "");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function commitEdit() {
    const normalized = normalizeMediaSrc(editSrc || src);
    if (!normalized) return;
    updateAttributes({ src: normalized, alt: editAlt.trim() });
    setEditing(false);
  }

  function moveUp() {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (pos === undefined) return;
    const { doc, tr } = editor.state;
    const $pos = doc.resolve(pos);
    const prevNode = $pos.nodeBefore;
    if (!prevNode) return;
    const prevStart = pos - prevNode.nodeSize;
    editor.view.dispatch(tr.delete(pos, pos + node.nodeSize).insert(prevStart, node));
  }

  function moveDown() {
    if (typeof getPos !== "function") return;
    const pos = getPos();
    if (pos === undefined) return;
    const { doc, tr } = editor.state;
    const afterPos = pos + node.nodeSize;
    const $after = doc.resolve(afterPos);
    const nextNode = $after.nodeAfter;
    if (!nextNode) return;
    editor.view.dispatch(
      tr.delete(pos, pos + node.nodeSize).insert(pos + nextNode.nodeSize, node)
    );
  }

  const normalizedSrc = normalizeMediaSrc(src);
  const alignClass =
    align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";

  const inputCls =
    "h-7 w-full rounded border border-[#e5e7eb] bg-[#f8fafc] px-2 text-xs text-[#374151] outline-none focus:border-[#1d4f91]";

  return (
    <NodeViewWrapper>
      <div contentEditable={false} data-drag-handle className="group relative my-4 select-none">
        {/* Image */}
        <div
          style={{ width }}
          className={`${alignClass} min-w-5 overflow-hidden rounded-lg border border-[#e5e7eb] bg-[#f8fafc]`}
        >
          {normalizedSrc ? (
            <img
              src={normalizedSrc}
              alt={alt || ""}
              className="block w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).parentElement?.classList.add("img-error");
              }}
            />
          ) : (
            <div className="flex h-24 items-center justify-center text-xs text-[#9ca3af]">
              Brak obrazu
            </div>
          )}
        </div>

        {/* Inline edit panel */}
        {editing && (
          <div
            style={{ width }}
            className={`${alignClass} mt-2 rounded-xl border border-[#c3d6ea] bg-white p-3 shadow-md`}
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              Edytuj obraz
            </p>
            <div className="space-y-1.5">
              <MediaUploadDropzone
                mediaKind="image"
                title="Podmień obraz"
                helperText="Przeciągnij, wklej albo wybierz nowy plik obrazu"
                actionLabel="Wybierz obraz"
                currentSrc={normalizeMediaSrc(editSrc || src) || undefined}
                onUploaded={({ src: uploadedSrc, suggestedAlt }) => {
                  setEditSrc(uploadedSrc);
                  if (!editAlt.trim()) {
                    setEditAlt(suggestedAlt);
                  }
                }}
              />
              <div>
                <label className="mb-0.5 block text-[10px] text-[#9ca3af]">Tekst alternatywny</label>
                <input
                  type="text"
                  value={editAlt}
                  onChange={(e) => setEditAlt(e.target.value)}
                  placeholder="Opis obrazu"
                  className={inputCls}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                    if (e.key === "Escape") cancelEdit();
                  }}
                />
              </div>
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
          </div>
        )}

        {/* Controls — visible on hover */}
        {!editing && (
          <div
            style={{ width }}
            className={`${alignClass} mt-1.5 min-w-fit space-y-1 opacity-0 transition-opacity group-hover:opacity-100`}
          >
            {/* Row 1: align + presets + actions */}
            <div className="flex items-center justify-between gap-1">
              {/* Align buttons */}
              <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
                {(["left", "center", "right"] as Align[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => updateAttributes({ align: a })}
                    title={a === "left" ? "Do lewej" : a === "center" ? "Wyśrodkuj" : "Do prawej"}
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
                      align === a
                        ? "bg-[#1d4f91] text-white"
                        : "text-[#6b7280] hover:bg-[#f1f5f9] hover:text-[#374151]"
                    }`}
                  >
                    {a === "left" ? <AlignLeft size={12} /> : a === "center" ? <AlignCenter size={12} /> : <AlignRight size={12} />}
                  </button>
                ))}
              </div>

              {/* Width presets */}
              <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
                {WIDTH_OPTIONS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => { setWidthDraft(null); updateAttributes({ width: w }); }}
                    className={`h-6 rounded-md px-1.5 text-[10px] font-semibold transition ${
                      width === w
                        ? "bg-[#1d4f91] text-white"
                        : "text-[#6b7280] hover:bg-[#f1f5f9] hover:text-[#374151]"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>

              {/* Edit / Move / Delete */}
              <div className="flex items-center gap-0.5 rounded-lg border border-[#e5e7eb] bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={openEdit}
                  title="Edytuj ścieżkę / opis"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f1f5f9] hover:text-[#1d4f91]"
                >
                  <Pencil size={11} />
                </button>
                <button
                  type="button"
                  onClick={moveUp}
                  title="Przesuń w górę"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f1f5f9] hover:text-[#374151]"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={moveDown}
                  title="Przesuń w dół"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#f1f5f9] hover:text-[#374151]"
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteNode()}
                  title="Usuń"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-[#fee2e2] hover:text-[#dc2626]"
                >
                  <Trash2 size={12} />
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
    </NodeViewWrapper>
  );
}
