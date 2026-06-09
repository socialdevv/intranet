import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { MatrixLinkNode } from "./matrix-link-extension";
import { SectionLinkNode } from "./section-link-extension";
import ImageBlockNode from "./image-block-extension";
import { CollapsibleBlockNode } from "./collapsible-block-extension";
import { CalloutBlockNode } from "./callout-block-extension";
import { ImageTextNode } from "./image-text-extension";
import VideoBlockNode from "./video-block-extension";
import { InternalLinkMark, type InternalLinkEntityType } from "./internal-link-mark";
import { NoCopyInlineMark } from "./no-copy-inline-mark";
import { BlockBoundaryFix } from "./block-boundary-fix";
import ImagePicker from "./image-picker";
import VideoPicker from "./video-picker";
import FilePicker from "./file-picker";
import { OrderedList } from "@tiptap/extension-list";
import TextAlign from "@tiptap/extension-text-align";
import {
  PlainTextPasteExtension,
  plainTextToNodes,
  sanitizePastedHtml,
} from "./rich-editor-paste";
import { ToolBtn, ToolbarGroup } from "./rich-editor-toolbar-primitives";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import { useToast, type ToastType } from "@/contexts/toast-context";
import type { MatrixDecision } from "@/lib/types/domain";
import type { TipTapDoc } from "@/lib/knowledge/content-doc";
import { buildSectionAnchorId } from "@/lib/knowledge/section-anchors";
import { knowledgeArticlePath, knowledgeCategoryPath } from "@/lib/routes";
import {
  collectClipboardImagePayload,
  resolveClipboardImageCandidate,
  type ClipboardImageCandidate,
} from "@/lib/media/paste";
import { buildSelectionClipboardPayload } from "@/lib/knowledge/no-copy-inline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  TextQuote,
  Code2,
  Minus,
  Palette,
  ChevronDown,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  Clipboard,
  ChevronsUpDown,
  Bell,
  Columns2,
  Film,
  Paperclip,
  IndentIncrease,
  IndentDecrease,
  Link2,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";

export const EMPTY_DOC: TipTapDoc = { type: "doc", content: [{ type: "paragraph" }] };

export interface RichEditorProps {
  content: TipTapDoc;
  onChange: (doc: TipTapDoc) => void;
  placeholder?: string;
  minHeight?: string;
  matrixEntries?: MatrixDecision[];
  /** Enable the embedded section-link block picker (URL / article / komunikat). */
  sectionLinks?: boolean;
  /** Article pages for the internal article picker — pass from ArticleEditorPage. */
  pages?: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    categoryId?: string;
    categoryDisplayName?: string;
    sections?: Array<{ id: string; title: string }>;
  }>;
  /** Knowledge categories used by internal-link picker (category / subcategory links). */
  categories?: Array<{ id: string; name: string; slug: string; parentId: string | null }>;
  /** Komunikaty for the komunikat picker — pass from ArticleEditorPage. */
  communications?: Array<{ id: string; title: string }>;
  /** Templates for the template-link picker — pass from ArticleEditorPage. */
  templates?: Array<{ id: string; title: string; channel: string }>;
  /** Enables inline "do not copy" fragments in the toolbar and content. */
  inlineNoCopy?: boolean;
}

type EditorCategoryOption = { id: string; name: string; slug: string; parentId: string | null };
type EditorPageOption = {
  id: string;
  title: string;
  slug: string;
  category: string;
  categoryId?: string;
  categoryDisplayName?: string;
  sections?: Array<{ id: string; title: string }>;
};
type ToolbarFeedback = {
  tone: ToastType;
  message: string;
};

// ── FontSize extension (via TextStyle global attribute) ───────────────────────

const FontSize = Extension.create({
  name: "fontSize",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || null,
            renderHTML: (attributes) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── Color palette ─────────────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { label: "Domyślny", value: null },
  { label: "Czarny", value: "#000000" },
  { label: "Ciemnoszary", value: "#374151" },
  { label: "Szary", value: "#6b7280" },
  { label: "Stalowy", value: "#475569" },
  { label: "Czerwony", value: "#dc2626" },
  { label: "Głęboka czerwień", value: "#991b1b" },
  { label: "Różany", value: "#f43f5e" },
  { label: "Fuksja", value: "#c026d3" },
  { label: "Różowy", value: "#f472b6" },
  { label: "Pomarańczowy", value: "#ea580c" },
  { label: "Żółty", value: "#eab308" },
  { label: "Złocisty", value: "#f59e0b" },
  { label: "Limonka", value: "#65a30d" },
  { label: "Jasnozielony", value: "#10b981" },
  { label: "Zielony", value: "#16a34a" },
  { label: "Turkusowy", value: "#0d9488" },
  { label: "Cyjan", value: "#06b6d4" },
  { label: "Morski", value: "#0369a1" },
  { label: "Jasnoniebieski", value: "#0ea5e9" },
  { label: "Niebieski", value: "#1d4f91" },
  { label: "Granat", value: "#1e3a5f" },
  { label: "Indygo", value: "#6366f1" },
  { label: "Fioletowy", value: "#7c3aed" },
  { label: "Lawendowy", value: "#a855f7" },
  { label: "Brąz", value: "#92400e" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px"];

// ── Extended ordered list (adds listType: decimal | lower-alpha) ──────────────

/**
 * Extends the base OrderedList with a `listType` attribute that controls
 * list-style-type (decimal / lower-alpha). The existing `start` attribute
 * for arbitrary-number lists is preserved from the parent.
 */
const ExtendedOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      listType: {
        default: "decimal",
        parseHTML: (element) => element.style.listStyleType || "decimal",
        renderHTML: (attributes) => {
          if (!attributes.listType || attributes.listType === "decimal") return {};
          return { style: `list-style-type: ${attributes.listType}` };
        },
      },
    };
  },
});

// ── Color picker ──────────────────────────────────────────────────────────────

function ColorPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentColor =
    (editor?.getAttributes("textStyle")?.color as string | undefined) ?? null;

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!editor) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Kolor tekstu"
        aria-label="Kolor tekstu"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex h-6 items-center gap-0.5 rounded-md px-1.5 transition",
          open ? "bg-[#1d4f91] text-white" : "text-[#5f6f86] hover:bg-[#e8eef5] hover:text-[#1f2937] dark:text-[#94a3b8] dark:hover:bg-[#1f2937] dark:hover:text-[#e2e8f0]",
        ].join(" ")}
      >
        <Palette size={13} />
        <span
          className="inline-block h-2 w-4 rounded-sm border border-black/10"
          style={{ backgroundColor: currentColor ?? "transparent" }}
        />
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-xl border border-[#dbe5ee] bg-white p-2.5 shadow-xl shadow-black/10 dark:border-[#334155] dark:bg-[#0b1220] dark:shadow-black/30">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748b] dark:text-[#94a3b8]">
            Kolor tekstu
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.label}
                type="button"
                title={sw.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (sw.value === null) {
                    editor.chain().focus().unsetColor().run();
                  } else {
                    editor.chain().focus().setColor(sw.value).run();
                  }
                  setOpen(false);
                }}
                className={[
                  "h-6 w-6 rounded-md border-2 transition",
                  currentColor === sw.value
                    ? "scale-110 border-[#1d4f91]"
                    : "border-transparent hover:border-[#475569]",
                ].join(" ")}
                style={sw.value ? { backgroundColor: sw.value } : { background: "#111827" }}
              >
                {sw.value === null && (
                  <span className="flex h-full items-center justify-center text-[8px] font-bold text-[#64748b]">
                    ✕
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Font size picker ──────────────────────────────────────────────────────────

function FontSizePicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;
  const current = (editor.getAttributes("textStyle")?.fontSize as string | undefined) ?? "";
  return (
    <select
      title="Rozmiar czcionki"
      value={current}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const size = e.target.value;
        if (!size) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor.chain().focus() as any).unsetFontSize().run();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (editor.chain().focus() as any).setFontSize(size).run();
        }
      }}
      className="h-6 rounded-md border border-[#dbe5ee] bg-white px-1 text-[11px] text-[#334155] outline-none hover:border-[#1d4f91] focus:border-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]"
    >
      <option value="">Rozmiar</option>
      {FONT_SIZES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function HeadingPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const currentHeadingLevel = editor.isActive("heading", { level: 1 })
    ? "h1"
    : editor.isActive("heading", { level: 2 })
    ? "h2"
    : editor.isActive("heading", { level: 3 })
    ? "h3"
    : "p";

  return (
    <select
      title="Styl akapitu"
      value={currentHeadingLevel}
      onMouseDown={(e) => e.stopPropagation()}
      onChange={(e) => {
        const style = e.target.value;
        if (style === "p") {
          editor.chain().focus().setParagraph().run();
          return;
        }
        const level: 1 | 2 | 3 = style === "h1" ? 1 : style === "h2" ? 2 : 3;
        editor.chain().focus().setHeading({ level }).run();
      }}
      className="h-6 rounded-md border border-[#dbe5ee] bg-white px-1 text-[11px] text-[#334155] outline-none hover:border-[#1d4f91] focus:border-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]"
    >
      <option value="p">Akapit</option>
      <option value="h1">Nagłówek 1</option>
      <option value="h2">Nagłówek 2</option>
      <option value="h3">Nagłówek 3</option>
    </select>
  );
}

// ── Portal anchor helper ──────────────────────────────────────────────────────

/** Compute a viewport-clamped position for a portal panel anchored below a button. */
function computePortalPos(
  btnEl: HTMLElement,
  panelWidth: number
): { top: number; left: number } {
  const { left: anchorLeft, bottom } = btnEl.getBoundingClientRect();
  let left = anchorLeft;
  if (left + panelWidth > window.innerWidth - 8) left = window.innerWidth - panelWidth - 8;
  return { top: bottom + 6, left: Math.max(4, left) };
}

// ── Callout picker ───────────────────────────────────────────────────────────

const CALLOUT_OPTIONS = [
  { value: "info",     color: "#3b82f6", label: "Info" },
  { value: "warning",  color: "#f59e0b", label: "Ostrzeżenie" },
  { value: "critical", color: "#ef4444", label: "Krytyczne" },
  { value: "success",  color: "#22c55e", label: "Sukces" },
] as const;

function CalloutPicker({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!editor) return null;

  function insert(variant: string) {
    editor!
      .chain()
      .focus()
      .insertContent({
        type: "calloutBlock",
        attrs: { variant },
        content: [{ type: "paragraph" }],
      })
      .run();
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Wstaw blok wyróżniony"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium transition",
          open ? "bg-[#1d4f91] text-white" : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
        ].join(" ")}
      >
        <Bell size={13} />
        <ChevronDown size={11} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-[#334155] bg-[#0b1220] shadow-xl shadow-black/30 py-1">
          {CALLOUT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insert(opt.value); }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-[#172033]"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: opt.color }}
              />
              <span className="text-[#cbd5e1]">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Image picker button ───────────────────────────────────────────────────────

function ImagePickerBtn({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!editor) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Wstaw obraz"
        aria-label="Wstaw obraz"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-md transition",
          open ? "bg-[#1d4f91] text-white" : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
        ].join(" ")}
      >
        <Image size={13} />
      </button>
      {open && <ImagePicker editor={editor} anchorRef={btnRef} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Video picker button ───────────────────────────────────────────────────────

function VideoPickerBtn({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!editor) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Wstaw wideo"
        aria-label="Wstaw wideo"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-md transition",
          open ? "bg-[#1d4f91] text-white" : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
        ].join(" ")}
      >
        <Film size={13} />
      </button>
      {open && <VideoPicker editor={editor} anchorRef={btnRef} onClose={() => setOpen(false)} />}
    </>
  );
}

function FilePickerBtn({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  if (!editor) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Wstaw plik do pobrania"
        aria-label="Wstaw plik do pobrania"
        onMouseDown={(e) => { e.preventDefault(); setOpen((v) => !v); }}
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded-md transition",
          open ? "bg-[#1d4f91] text-white" : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
        ].join(" ")}
      >
        <Paperclip size={13} />
      </button>
      {open && <FilePicker editor={editor} anchorRef={btnRef} onClose={() => setOpen(false)} />}
    </>
  );
}

// ── Plain-text paste button ───────────────────────────────────────────────────

function PasteTextBtn({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  function pasteAsPlainText(text: string) {
    if (!text) return;
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    if (!normalized.includes("\n")) {
      // Single line — insert inline within the current paragraph, no wrapping
      editor!.chain().focus().insertContent(normalized).run();
    } else {
      // Multi-line — convert to proper block structure so paragraph breaks survive save
      editor!.chain().focus().insertContent(plainTextToNodes(normalized)).run();
    }
  }

  function handleClick() {
    // Primary path: Clipboard API
    if (navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((text) => { if (text) pasteAsPlainText(text); })
        .catch(() => fallbackPaste());
    } else {
      fallbackPaste();
    }
  }

  // Fallback: focus a hidden textarea and intercept the native paste event
  function fallbackPaste() {
    const ta = document.createElement("textarea");
    ta.style.cssText = "position:fixed;opacity:0;top:0;left:0;width:1px;height:1px";
    document.body.appendChild(ta);
    ta.focus();
    ta.addEventListener("paste", (e) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      document.body.removeChild(ta);
      if (text) pasteAsPlainText(text);
    }, { once: true });
    document.execCommand("paste");
  }

  return (
    <button
      type="button"
      title="Wklej jako czysty tekst (bez formatowania) — Ctrl+Shift+V"
      onMouseDown={(e) => {
        e.preventDefault();
        handleClick();
      }}
      className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs text-[#94a3b8] transition hover:bg-[#1f2937] hover:text-[#e2e8f0]"
    >
      <Clipboard size={12} />
      <span className="leading-none">TXT</span>
    </button>
  );
}

// ── Table context controls ────────────────────────────────────────────────────

function TableControls({ editor }: { editor: ReturnType<typeof useEditor> | null }) {
  if (!editor?.isActive("table")) return null;

  function tbtn(label: string, onClick: () => void, title: string, danger = false) {
    return (
      <button
        key={title}
        type="button"
        title={title}
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
        className={[
          "inline-flex h-6 items-center rounded px-2 text-[10px] font-medium transition",
          danger ? "text-red-600 hover:bg-red-50" : "text-[#374151] hover:bg-[#dce7f5]",
        ].join(" ")}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-t border-[#dce7f5] bg-[#f0f5ff] px-2 py-1">
      <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#1d4f91]">
        Tabela
      </span>
      {tbtn("+Wiersz ↑", () => editor.chain().focus().addRowBefore().run(), "Dodaj wiersz powyżej")}
      {tbtn("+Wiersz ↓", () => editor.chain().focus().addRowAfter().run(), "Dodaj wiersz poniżej")}
      {tbtn("−Wiersz", () => editor.chain().focus().deleteRow().run(), "Usuń wiersz", true)}
      <span className="mx-1 inline-block h-4 w-px bg-[#c3d6ea]" aria-hidden />
      {tbtn("+Kol ←", () => editor.chain().focus().addColumnBefore().run(), "Dodaj kolumnę po lewej")}
      {tbtn("+Kol →", () => editor.chain().focus().addColumnAfter().run(), "Dodaj kolumnę po prawej")}
      {tbtn("−Kol", () => editor.chain().focus().deleteColumn().run(), "Usuń kolumnę", true)}
      <span className="mx-1 inline-block h-4 w-px bg-[#c3d6ea]" aria-hidden />
      {tbtn("Usuń tabelę", () => editor.chain().focus().deleteTable().run(), "Usuń całą tabelę", true)}
    </div>
  );
}

type ReferenceTargetType =
  | "url"
  | "article"
  | "category"
  | "subcategory"
  | "komunikat"
  | "template"
  | "matrix";

type LinkPresentationMode = "inline" | "block";
type ArticleTargetMode = "article" | "section";

function ReferenceInsertMenu({
  editor,
  sectionLinks,
  categories,
  pages,
  communications,
  templates,
  matrixEntries,
  onApplied,
}: {
  editor: ReturnType<typeof useEditor>;
  sectionLinks: boolean;
  categories: EditorCategoryOption[];
  pages: EditorPageOption[];
  communications: Array<{ id: string; title: string }>;
  templates: Array<{ id: string; title: string; channel: string }>;
  matrixEntries: MatrixDecision[];
  onApplied?: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<ReferenceTargetType>("article");
  const [mode, setMode] = useState<LinkPresentationMode>("inline");
  const [articleTargetMode, setArticleTargetMode] = useState<ArticleTargetMode>("article");
  const [query, setQuery] = useState("");
  const [url, setUrl] = useState("https://");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    setPos(computePortalPos(btnRef.current, 392));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
      setError("");
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    setError("");
    if (targetType === "komunikat" || targetType === "template" || targetType === "matrix") {
      setMode("block");
      return;
    }
    if (!sectionLinks && mode === "block") {
      setMode("inline");
    }
  }, [targetType, sectionLinks, mode]);

  if (!editor) return null;

  const canUseBlockSectionLink = sectionLinks;
  const selectionText = (() => {
    const { selection, doc } = editor.state;
    if (selection.empty) return "";
    return doc.textBetween(selection.from, selection.to, " ").trim();
  })();

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const normalizedQuery = query.trim().toLowerCase();
  const topCategories = categories.filter((c) => c.parentId === null);
  const subcategories = categories.filter((c) => c.parentId !== null);

  const filteredArticles = normalizedQuery
    ? pages.filter((page) => {
        const categoryName =
          page.categoryDisplayName ??
          (page.categoryId ? categoryById.get(page.categoryId)?.name : undefined) ??
          page.category;
        return (
          page.title.toLowerCase().includes(normalizedQuery) ||
          categoryName.toLowerCase().includes(normalizedQuery)
        );
      })
    : pages;

  const filteredArticleSections = pages
    .flatMap((article) =>
      (article.sections ?? []).map((section) => {
        const categoryName =
          article.categoryDisplayName ??
          (article.categoryId ? categoryById.get(article.categoryId)?.name : undefined) ??
          article.category;
        return {
          article,
          section,
          categoryName,
        };
      })
    )
    .filter(({ article, section, categoryName }) => {
      if (!normalizedQuery) return true;
      return (
        article.title.toLowerCase().includes(normalizedQuery) ||
        section.title.toLowerCase().includes(normalizedQuery) ||
        categoryName.toLowerCase().includes(normalizedQuery)
      );
    });

  const filteredTopCategories = normalizedQuery
    ? topCategories.filter((cat) => cat.name.toLowerCase().includes(normalizedQuery))
    : topCategories;

  const filteredSubcategories = normalizedQuery
    ? subcategories.filter((cat) => {
        const parentName = cat.parentId ? categoryById.get(cat.parentId)?.name ?? "" : "";
        return (
          cat.name.toLowerCase().includes(normalizedQuery) ||
          parentName.toLowerCase().includes(normalizedQuery)
        );
      })
    : subcategories;

  const filteredKomunikaty = normalizedQuery
    ? communications.filter((k) => k.title.toLowerCase().includes(normalizedQuery))
    : communications;

  const filteredTemplates = normalizedQuery
    ? templates.filter(
        (t) =>
          t.title.toLowerCase().includes(normalizedQuery) ||
          t.channel.toLowerCase().includes(normalizedQuery)
      )
    : templates;

  const filteredMatrix = normalizedQuery
    ? matrixEntries.filter(
        (entry) =>
          entry.subcategory.toLowerCase().includes(normalizedQuery) ||
          entry.category.toLowerCase().includes(normalizedQuery) ||
          entry.description.toLowerCase().includes(normalizedQuery)
      )
    : matrixEntries;

  function closeMenu() {
    setOpen(false);
    setError("");
    setQuery("");
    setArticleTargetMode("article");
  }

  function insertExternalInline(href: string, textLabel: string) {
    if (editor.state.selection.empty) {
      editor
        .chain()
        .focus()
        .unsetMark("internalLink")
        .insertContent({
          type: "text",
          text: textLabel,
          marks: [{ type: "link", attrs: { href } }],
        })
        .run();
    } else {
      editor.chain().focus().unsetMark("internalLink").setLink({ href }).run();
    }
  }

  function insertInternalInline(target: {
    entityType: InternalLinkEntityType;
    entityId: string;
    labelValue: string;
    hrefSnapshot: string;
    sectionId?: string | null;
    sectionTitle?: string | null;
  }) {
    const { selection, doc } = editor.state;
    const selectedText = selection.empty
      ? ""
      : doc.textBetween(selection.from, selection.to, " ").trim();

    const attrs = {
      entityType: target.entityType,
      entityId: target.entityId,
      sectionId: target.sectionId ?? null,
      sectionTitle: target.sectionTitle ?? null,
      hrefSnapshot: target.hrefSnapshot,
      labelSnapshot: target.labelValue,
    };

    if (selection.empty) {
      editor
        .chain()
        .focus()
        .unsetLink()
        .insertContent({
          type: "text",
          text: selectedText || label.trim() || target.labelValue,
          marks: [{ type: "internalLink", attrs }],
        })
        .run();
    } else {
      editor.chain().focus().unsetLink().setMark("internalLink", attrs).run();
    }
  }

  function insertSectionLink(attrs: Record<string, unknown>) {
    editor.chain().focus().insertContent({ type: "sectionLink", attrs }).run();
  }

  function handleInsertUrl() {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://") {
      setError("Podaj poprawny URL.");
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      setError("Do linku zewnętrznego użyj https:// lub mailto:.");
      return;
    }

    const resolvedLabel = label.trim() || selectionText || trimmed;

    if (mode === "inline") {
      insertExternalInline(trimmed, resolvedLabel);
      onApplied?.(`Dodano link zewnętrzny: ${resolvedLabel}`);
      closeMenu();
      return;
    }

    if (!canUseBlockSectionLink) {
      setError("Ten edytor nie obsługuje bloków linków.");
      return;
    }

    insertSectionLink({
      linkType: "url",
      label: resolvedLabel,
      url: trimmed,
      articleId: null,
      articleSlug: null,
      articleCategorySlug: null,
      articleSectionId: null,
      articleSectionTitle: null,
      komunikatId: null,
      templateId: null,
      templateChannel: null,
    });
    onApplied?.(`Dodano blok linku zewnętrznego: ${resolvedLabel}`);
    closeMenu();
  }

  function handleInsertArticle(article: EditorPageOption) {
    const resolvedLabel = label.trim() || article.title;
    if (mode === "inline") {
      insertInternalInline({
        entityType: "article",
        entityId: article.id,
        labelValue: resolvedLabel,
        hrefSnapshot: knowledgeArticlePath(article.category, article.slug),
      });
      onApplied?.(`Dodano link do artykułu: ${resolvedLabel}`);
      closeMenu();
      return;
    }

    if (!canUseBlockSectionLink) {
      setError("Ten edytor nie obsługuje bloków linków.");
      return;
    }

    insertSectionLink({
      linkType: "article",
      label: resolvedLabel,
      url: null,
      articleId: article.id,
      articleSlug: article.slug,
      articleCategorySlug: article.category,
      articleSectionId: null,
      articleSectionTitle: null,
      komunikatId: null,
      templateId: null,
      templateChannel: null,
    });
    onApplied?.(`Dodano blok linku do artykułu: ${resolvedLabel}`);
    closeMenu();
  }

  function handleInsertArticleSection(article: EditorPageOption, section: { id: string; title: string }) {
    const sectionLabel = section.title.trim() || "Sekcja";
    const defaultLabel = `${article.title} - ${sectionLabel}`;
    const resolvedLabel = label.trim() || defaultLabel;
    const href = `${knowledgeArticlePath(article.category, article.slug)}#${buildSectionAnchorId(section.id)}`;

    if (mode === "inline") {
      insertInternalInline({
        entityType: "article",
        entityId: article.id,
        labelValue: resolvedLabel,
        hrefSnapshot: href,
        sectionId: section.id,
        sectionTitle: sectionLabel,
      });
      onApplied?.(`Dodano link do sekcji artykułu: ${resolvedLabel}`);
      closeMenu();
      return;
    }

    if (!canUseBlockSectionLink) {
      setError("Ten edytor nie obsługuje bloków linków.");
      return;
    }

    insertSectionLink({
      linkType: "article",
      label: resolvedLabel,
      url: null,
      articleId: article.id,
      articleSlug: article.slug,
      articleCategorySlug: article.category,
      articleSectionId: section.id,
      articleSectionTitle: sectionLabel,
      komunikatId: null,
      templateId: null,
      templateChannel: null,
    });
    onApplied?.(`Dodano blok linku do sekcji artykułu: ${resolvedLabel}`);
    closeMenu();
  }

  function handleInsertCategory(cat: EditorCategoryOption, entityType: InternalLinkEntityType) {
    const resolvedLabel = label.trim() || cat.name;

    if (mode === "block") {
      if (!canUseBlockSectionLink) {
        setError("Ten edytor nie obsługuje bloków linków.");
        return;
      }

      insertSectionLink({
        linkType: entityType,
        label: resolvedLabel,
        url: null,
        articleId: null,
        articleSlug: null,
        articleCategorySlug: cat.slug,
        komunikatId: null,
        templateId: null,
        templateChannel: null,
        categoryId: cat.id,
        categorySlug: cat.slug,
      });
      onApplied?.(
        `Dodano blok linku ${entityType === "subcategory" ? "do podkategorii" : "do kategorii"}: ${resolvedLabel}`
      );
      closeMenu();
      return;
    }

    insertInternalInline({
      entityType,
      entityId: cat.id,
      labelValue: resolvedLabel,
      hrefSnapshot: knowledgeCategoryPath(cat.slug),
    });
    onApplied?.(
      `Dodano link ${entityType === "subcategory" ? "do podkategorii" : "do kategorii"}: ${resolvedLabel}`
    );
    closeMenu();
  }

  function handleInsertKomunikat(kom: { id: string; title: string }) {
    const resolvedLabel = label.trim() || kom.title;
    insertSectionLink({
      linkType: "komunikat",
      label: resolvedLabel,
      url: null,
      articleId: null,
      articleSlug: null,
      articleCategorySlug: null,
      komunikatId: kom.id,
      templateId: null,
      templateChannel: null,
    });
    onApplied?.(`Dodano blok linku do komunikatu: ${resolvedLabel}`);
    closeMenu();
  }

  function handleInsertTemplate(tpl: { id: string; title: string; channel: string }) {
    const resolvedLabel = label.trim() || tpl.title;
    insertSectionLink({
      linkType: "template",
      label: resolvedLabel,
      url: null,
      articleId: null,
      articleSlug: null,
      articleCategorySlug: null,
      komunikatId: null,
      templateId: tpl.id,
      templateChannel: tpl.channel,
    });
    onApplied?.(`Dodano blok linku do szablonu: ${resolvedLabel}`);
    closeMenu();
  }

  function handleInsertMatrix(entry: MatrixDecision) {
    editor
      .chain()
      .focus()
      .insertContent({
        type: "matrixLink",
        attrs: {
          entryId: entry.id,
          entryTitle: entry.subcategory || entry.category,
          entryCategory: entry.category,
          entryDepartment: entry.defaultDepartment,
          entrySla: entry.slaDays,
        },
      })
      .run();
    onApplied?.(`Dodano odwołanie do macierzy: ${entry.subcategory || entry.category}`);
    closeMenu();
  }

  const targetBtnCls = (isActive: boolean) =>
    [
      "rounded-md border px-2 py-1 text-[11px] font-medium transition",
      isActive
        ? "border-[#1d4f91] bg-[#eff6ff] text-[#1d4f91] dark:bg-[#1d4f91]/25 dark:text-[#bfdbfe]"
        : "border-[#dbe5ee] bg-white text-[#475569] hover:border-[#1d4f91] hover:text-[#1d4f91] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8] dark:hover:text-[#bfdbfe]",
    ].join(" ");

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        title="Wstaw odwołanie"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        className={[
          "inline-flex h-6 items-center gap-1 rounded-md border border-[#dbe5ee] bg-white px-1.5 text-[10px] font-medium transition dark:border-[#334155] dark:bg-[#0f172a]",
          open ? "border-[#1d4f91] bg-[#eff6ff] text-[#1d4f91] dark:bg-[#1d4f91]/20 dark:text-[#bfdbfe]" : "text-[#475569] hover:border-[#1d4f91] hover:text-[#1d4f91] dark:text-[#94a3b8] dark:hover:text-[#bfdbfe]",
        ].join(" ")}
      >
        <Link2 size={12} />
        <span>Odwołanie</span>
        <ChevronDown size={10} />
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 392, zIndex: 9999 }}
          className="rounded-xl border border-[#dbe5ee] bg-white text-[#0f172a] shadow-xl shadow-black/10 dark:border-[#334155] dark:bg-[#0b1220] dark:text-[#e2e8f0] dark:shadow-black/40"
        >
          <div className="border-b border-[#e2e8f0] px-3 py-2 dark:border-[#233146]">
            <p className="text-xs font-semibold text-[#0f172a] dark:text-[#e2e8f0]">Wstaw odwołanie</p>
            <p className="mt-0.5 text-[11px] text-[#64748b] dark:text-[#94a3b8]">
              {selectionText
                ? `Zaznaczony tekst: "${selectionText}"`
                : "Brak zaznaczenia: zostanie użyta etykieta lub nazwa wybranego celu."}
            </p>
          </div>

          <div className="space-y-2.5 p-3">
            <div className="flex flex-wrap gap-1">
              {([
                ["url", "URL"],
                ["article", "Artykuł"],
                ["category", "Kategoria"],
                ["subcategory", "Podkategoria"],
                ["komunikat", "Komunikat"],
                ["template", "Szablon"],
                ["matrix", "Macierz"],
              ] as Array<[ReferenceTargetType, string]>).map(([type, lbl]) => (
                <button
                  key={type}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTargetType(type);
                    setArticleTargetMode("article");
                    setQuery("");
                    setError("");
                  }}
                  className={targetBtnCls(targetType === type)}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {(targetType === "url" || targetType === "article" || targetType === "category" || targetType === "subcategory") && (
              <div className="flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] p-1">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMode("inline");
                  }}
                  className={[
                    "h-6 rounded px-2 text-[11px] font-medium transition",
                    mode === "inline"
                      ? "bg-[#1d4f91] text-white"
                      : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
                  ].join(" ")}
                >
                  Inline
                </button>
                <button
                  type="button"
                  disabled={!canUseBlockSectionLink}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setMode("block");
                  }}
                  className={[
                    "h-6 rounded px-2 text-[11px] font-medium transition",
                    mode === "block"
                      ? "bg-[#1d4f91] text-white"
                      : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
                    !canUseBlockSectionLink ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  Blok linku
                </button>
              </div>
            )}

            {(targetType === "category" || targetType === "subcategory") && mode === "inline" && (
              <p className="text-[11px] text-[#94a3b8]">
                Kategorie i podkategorie są wstawiane jako linki wewnętrzne inline.
              </p>
            )}

            {(targetType === "category" || targetType === "subcategory") && mode === "block" && (
              <p className="text-[11px] text-[#94a3b8]">
                Kategorie i podkategorie są wstawiane jako bloki odwołań.
              </p>
            )}

            {(targetType === "komunikat" || targetType === "template" || targetType === "matrix") && (
              <p className="text-[11px] text-[#94a3b8]">
                Ten typ celu jest wstawiany jako blok odwołania.
              </p>
            )}

            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
                Etykieta (opcjonalna)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Domyślnie użyta będzie nazwa celu"
                className="h-8 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 text-xs text-[#e2e8f0] placeholder:text-[#64748b] outline-none focus:border-[#1d4f91]"
              />
            </div>

            {targetType !== "url" && (
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj celu…"
                className="h-8 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 text-xs text-[#e2e8f0] placeholder:text-[#64748b] outline-none focus:border-[#1d4f91]"
              />
            )}

            {targetType === "url" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError("");
                  }}
                  placeholder="https://..."
                  className="h-8 w-full rounded-lg border border-[#334155] bg-[#0f172a] px-2.5 text-xs text-[#e2e8f0] placeholder:text-[#64748b] outline-none focus:border-[#1d4f91]"
                />
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleInsertUrl();
                  }}
                  className="h-8 w-full rounded-lg bg-[#1d4f91] text-xs font-semibold text-white transition hover:bg-[#163d72]"
                >
                  Wstaw odwołanie
                </button>
              </div>
            )}

            {targetType === "article" && (
              <div className="mb-1 flex items-center gap-1 rounded-md border border-[#334155] bg-[#0f172a] p-1">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setArticleTargetMode("article");
                  }}
                  className={[
                    "h-6 rounded px-2 text-[11px] font-medium transition",
                    articleTargetMode === "article"
                      ? "bg-[#1d4f91] text-white"
                      : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
                  ].join(" ")}
                >
                  Cały artykuł
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setArticleTargetMode("section");
                  }}
                  className={[
                    "h-6 rounded px-2 text-[11px] font-medium transition",
                    articleTargetMode === "section"
                      ? "bg-[#1d4f91] text-white"
                      : "text-[#94a3b8] hover:bg-[#1f2937] hover:text-[#e2e8f0]",
                  ].join(" ")}
                >
                  Sekcja artykułu
                </button>
              </div>
            )}

            {targetType === "article" && articleTargetMode === "article" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredArticles.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak artykułów.</li>
                ) : (
                  filteredArticles.slice(0, 40).map((article) => {
                    const categoryName =
                      article.categoryDisplayName ??
                      (article.categoryId ? categoryById.get(article.categoryId)?.name : undefined) ??
                      article.category;
                    return (
                      <li key={article.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleInsertArticle(article);
                          }}
                          className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                        >
                          <span className="truncate text-xs font-medium text-[#e2e8f0]">{article.title}</span>
                          <span className="truncate text-[11px] text-[#94a3b8]">{categoryName}</span>
                          <span className="truncate text-[11px] text-[#64748b]">
                            {knowledgeArticlePath(article.category, article.slug)}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            )}

            {targetType === "article" && articleTargetMode === "section" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredArticleSections.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak sekcji artykułów.</li>
                ) : (
                  filteredArticleSections.slice(0, 60).map(({ article, section, categoryName }) => (
                    <li key={`${article.id}:${section.id}`}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertArticleSection(article, section);
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">{article.title}</span>
                        <span className="truncate text-[11px] text-[#bfdbfe]">{section.title || "Sekcja"}</span>
                        <span className="truncate text-[11px] text-[#94a3b8]">{categoryName}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {targetType === "category" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredTopCategories.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak kategorii.</li>
                ) : (
                  filteredTopCategories.slice(0, 40).map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertCategory(cat, "category");
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">{cat.name}</span>
                        <span className="truncate text-[11px] text-[#64748b]">{knowledgeCategoryPath(cat.slug)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {targetType === "subcategory" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredSubcategories.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak podkategorii.</li>
                ) : (
                  filteredSubcategories.slice(0, 40).map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertCategory(cat, "subcategory");
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">{cat.name}</span>
                        <span className="truncate text-[11px] text-[#94a3b8]">
                          {cat.parentId ? categoryById.get(cat.parentId)?.name ?? "" : ""}
                        </span>
                        <span className="truncate text-[11px] text-[#64748b]">{knowledgeCategoryPath(cat.slug)}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {targetType === "komunikat" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredKomunikaty.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak komunikatów.</li>
                ) : (
                  filteredKomunikaty.slice(0, 40).map((kom) => (
                    <li key={kom.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertKomunikat(kom);
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">{kom.title}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {targetType === "template" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredTemplates.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak szablonów.</li>
                ) : (
                  filteredTemplates.slice(0, 40).map((tpl) => (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertTemplate(tpl);
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">{tpl.title}</span>
                        <span className="truncate text-[11px] text-[#94a3b8]">{tpl.channel}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {targetType === "matrix" && (
              <ul className="max-h-44 overflow-y-auto rounded-lg border border-[#334155] bg-[#0f172a] py-1">
                {filteredMatrix.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-[#64748b]">Brak pozycji macierzy.</li>
                ) : (
                  filteredMatrix.slice(0, 40).map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleInsertMatrix(entry);
                        }}
                        className="flex w-full min-w-0 flex-col px-3 py-2 text-left hover:bg-[#172033]"
                      >
                        <span className="truncate text-xs font-medium text-[#e2e8f0]">
                          {entry.subcategory || entry.category}
                        </span>
                        <span className="truncate text-[11px] text-[#94a3b8]">
                          {entry.category} · SLA {entry.slaDays}d
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {error && <p className="text-[11px] text-[#f87171]">{error}</p>}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  matrixEntries,
  sectionLinks,
  categories,
  pages,
  communications,
  templates,
  inlineNoCopy,
  externalFeedback,
  selectionTick: _tick,
}: {
  editor: ReturnType<typeof useEditor>;
  matrixEntries: MatrixDecision[];
  sectionLinks: boolean;
  categories: EditorCategoryOption[];
  pages: EditorPageOption[];
  communications: Array<{ id: string; title: string }>;
  templates: Array<{ id: string; title: string; channel: string }>;
  inlineNoCopy: boolean;
  externalFeedback?: ToolbarFeedback | null;
  selectionTick?: number;
}) {
  if (!editor) return null;
  const [feedback, setFeedback] = useState<ToolbarFeedback | null>(null);
  const combinedFeedback = feedback ?? externalFeedback;

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return (
    <div className="sticky top-(--topbar-h,3.5rem) z-30 flex flex-wrap items-center gap-x-0.5 gap-y-0.5 border-b border-[#dbe5ee] bg-white/95 px-1.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.08)] backdrop-blur dark:border-[#1f2937] dark:bg-[#0b1220]/95 dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
      <ToolbarGroup label="Edycja">
        <ToolBtn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Cofnij (Ctrl+Z)"
        >
          <Undo2 size={13} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Ponów (Ctrl+Shift+Z)"
        >
          <Redo2 size={13} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          title="Wyczyść formatowanie"
        >
          <Eraser size={13} />
        </ToolBtn>
        <PasteTextBtn editor={editor} />
      </ToolbarGroup>

      <ToolbarGroup label="Format">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Pogrubienie (Ctrl+B)">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Kursywa (Ctrl+I)">
          <Italic size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Podkreślenie (Ctrl+U)">
          <UnderlineIcon size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Przekreślenie">
          <Strikethrough size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Kod inline">
          <Code size={13} />
        </ToolBtn>
        {inlineNoCopy && (
          <ToolBtn
            onClick={() => editor.chain().focus().toggleMark("noCopyInline").run()}
            active={editor.isActive("noCopyInline")}
            title="Fragment widoczny, ale pomijany przy kopiowaniu"
          >
            <span className="text-[9px] font-bold leading-none">NC</span>
          </ToolBtn>
        )}
        <ColorPicker editor={editor} />
        <FontSizePicker editor={editor} />
      </ToolbarGroup>

      <ToolbarGroup label="Struktura">
        <HeadingPicker editor={editor} />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista punktowana">
          <List size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList") && editor.getAttributes("orderedList").listType !== "lower-alpha"} title="Lista numerowana (1. 2. 3.)">
          <ListOrdered size={14} />
        </ToolBtn>
        <ToolBtn
          onClick={() => {
            const isAlpha = editor.isActive("orderedList") && editor.getAttributes("orderedList").listType === "lower-alpha";
            const isOrdered = editor.isActive("orderedList");
            if (isAlpha) {
              editor.chain().focus().toggleOrderedList().run();
            } else if (isOrdered) {
              editor.chain().focus().updateAttributes("orderedList", { listType: "lower-alpha" }).run();
            } else {
              editor.chain().focus().toggleOrderedList().run();
              editor.chain().focus().updateAttributes("orderedList", { listType: "lower-alpha" }).run();
            }
          }}
          active={editor.isActive("orderedList") && editor.getAttributes("orderedList").listType === "lower-alpha"}
          title="Lista alfabetyczna (a. b. c.)">
          <span className="text-[11px] font-bold leading-none">a·</span>
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!editor.can().sinkListItem("listItem")}
          title="Wcięcie (zagnieżdżenie) — Tab">
          <IndentIncrease size={14} />
        </ToolBtn>
        <ToolBtn
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!editor.can().liftListItem("listItem")}
          title="Cofnij wcięcie — Shift+Tab">
          <IndentDecrease size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Cytat">
          <TextQuote size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Blok kodu">
          <Code2 size={14} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Linia pozioma">
          <Minus size={14} />
        </ToolBtn>
      </ToolbarGroup>

      <ToolbarGroup label="Wstaw">
        <ReferenceInsertMenu
          editor={editor}
          sectionLinks={sectionLinks}
          categories={categories}
          pages={pages}
          communications={communications}
          templates={templates}
          matrixEntries={matrixEntries}
          onApplied={(message) => setFeedback({ tone: "info", message })}
        />
        <ImagePickerBtn editor={editor} />
        <VideoPickerBtn editor={editor} />
        <FilePickerBtn editor={editor} />
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          active={editor.isActive("table")}
          title="Wstaw tabelę (3×3 z nagłówkiem)"
        >
          <TableIcon size={13} />
        </ToolBtn>
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({
              type: "collapsibleBlock",
              attrs: { title: "" },
              content: [{ type: "paragraph" }],
            }).run()
          }
          active={editor.isActive("collapsibleBlock")}
          title="Wstaw blok rozwijany (FAQ)"
        >
          <ChevronsUpDown size={13} />
        </ToolBtn>
        <CalloutPicker editor={editor} />
        <ToolBtn
          onClick={() =>
            editor.chain().focus().insertContent({
              type: "imageSideBySide",
              attrs: { layout: "image-left", src: "", alt: "", imageWidth: "50%" },
              content: [{ type: "paragraph" }],
            }).run()
          }
          active={editor.isActive("imageSideBySide")}
          title="Wstaw blok obraz + tekst obok siebie"
        >
          <Columns2 size={13} />
        </ToolBtn>
      </ToolbarGroup>

      <ToolbarGroup label="Układ">
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Do lewej (Ctrl+Shift+L)">
          <AlignLeft size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Wyśrodkuj (Ctrl+Shift+E)">
          <AlignCenter size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Do prawej (Ctrl+Shift+R)">
          <AlignRight size={13} />
        </ToolBtn>
      </ToolbarGroup>

      {combinedFeedback && (
        <span
          className={[
            "ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            combinedFeedback.tone === "success"
              ? "bg-[#14532d]/35 text-[#86efac]"
              : combinedFeedback.tone === "error"
                ? "bg-[#7f1d1d]/40 text-[#fca5a5]"
                : "bg-[#1d4f91]/20 text-[#bfdbfe]",
          ].join(" ")}
        >
          {combinedFeedback.message}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RichEditor({
  content,
  onChange,
  placeholder = "Wpisz treść sekcji…",
  minHeight = "220px",
  matrixEntries = [],
  sectionLinks = false,
  categories = [],
  pages = [],
  communications = [],
  templates = [],
  inlineNoCopy = false,
}: RichEditorProps) {
  const [selectionTick, setSelectionTick] = useState(0);
  const [pasteFeedback, setPasteFeedback] = useState<ToolbarFeedback | null>(null);
  const { uploadAsset } = useMediaUpload();
  const { push: toast } = useToast();
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!pasteFeedback) return;
    const timeout = window.setTimeout(() => setPasteFeedback(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [pasteFeedback]);

  async function processPastedImageCandidates(candidates: ClipboardImageCandidate[]) {
    let insertedCount = 0;
    let apiUploadCount = 0;
    let fallbackCount = 0;
    const notes: string[] = [];

    for (const candidate of candidates) {
      const resolved = await resolveClipboardImageCandidate(candidate, uploadAsset);
      if (!resolved.ok) {
        notes.push(resolved.note);
        continue;
      }

      const activeEditor = editorRef.current;
      if (!activeEditor) break;

      activeEditor
        .chain()
        .focus()
        .insertContent({
          type: "imageBlock",
          attrs: {
            src: resolved.src,
            alt: resolved.alt,
            width: "100%",
            align: "center",
          },
        })
        .run();

      insertedCount += 1;
      if (resolved.via === "api-upload") {
        apiUploadCount += 1;
      } else {
        fallbackCount += 1;
      }
      if (resolved.note) notes.push(resolved.note);
    }

    if (insertedCount === 0) {
      if (notes[0]) {
        const tone: ToastType = notes[0].toLowerCase().startsWith("pominieto") ? "info" : "error";
        setPasteFeedback({ tone, message: notes[0] });
        toast(tone, notes[0], 5200);
      }
      return;
    }

    if (fallbackCount > 0) {
      const message =
        notes[0] ||
        `Wklejono ${insertedCount} obraz(y). ${fallbackCount} osadzono fallbackowo bez API uploadu.`;
      setPasteFeedback({ tone: "info", message });
      toast("info", message, 5200);
      return;
    }

    if (apiUploadCount > 0) {
      const message = `Wklejono ${insertedCount} obraz(y) przez upload API.`;
      setPasteFeedback({ tone: "success", message });
      toast("success", message, 3600);
      return;
    }

    setPasteFeedback({ tone: "info", message: `Wklejono ${insertedCount} obraz(y).` });
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, orderedList: false }),
      ExtendedOrderedList,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      InternalLinkMark,
      NoCopyInlineMark,
      Placeholder.configure({ placeholder }),
      TextStyle,
      Color,
      FontSize,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      MatrixLinkNode,
      SectionLinkNode,
      ImageBlockNode,
      CollapsibleBlockNode,
      CalloutBlockNode,
      ImageTextNode,
      VideoBlockNode,
      BlockBoundaryFix,
      PlainTextPasteExtension,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: content as object,
    onUpdate({ editor }) {
      onChange(editor.getJSON() as TipTapDoc);
      // Also refresh toolbar active states (undo/redo can change formatting
      // without triggering onSelectionUpdate)
      setSelectionTick((t) => t + 1);
    },
    onSelectionUpdate() {
      setSelectionTick((t) => t + 1);
    },
    editorProps: {
      attributes: {
        class: "prose-editor outline-none",
        style: `min-height: ${minHeight}; padding: 14px 16px;`,
      },
      handleDOMEvents: {
        copy: (view, event) => {
          if (!event.clipboardData) return false;
          const selection = "getSelection" in view.root ? view.root.getSelection() : window.getSelection();
          const payload = buildSelectionClipboardPayload(selection, view.dom as HTMLElement);
          if (!payload) return false;
          event.clipboardData.setData("text/plain", payload.text);
          event.clipboardData.setData("text/html", payload.html);
          event.preventDefault();
          return true;
        },
      },
      transformPastedHTML(html) {
        return sanitizePastedHtml(html);
      },
      handlePaste(_view, event) {
        const payload = collectClipboardImagePayload(event.clipboardData);
        if (payload.candidates.length === 0) return false;

        const process = () => {
          void processPastedImageCandidates(payload.candidates);
        };

        if (!payload.hasTextualContent) {
          event.preventDefault();
          process();
          return true;
        }

        // Mixed text + images: keep default text paste, then insert resolved images.
        window.setTimeout(process, 0);
        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  // Sync external content without firing onChange (e.g. loading existing article)
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    const incoming = JSON.stringify(content);
    if (current !== incoming) {
      editor.commands.setContent(content as object, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  return (
    <div className="overflow-clip rounded-xl border border-[#d1d5db] bg-white transition focus-within:border-[#1d4f91] focus-within:ring-2 focus-within:ring-[#1d4f91]/20">
      <Toolbar
        editor={editor}
        matrixEntries={matrixEntries}
        sectionLinks={sectionLinks}
        categories={categories}
        pages={pages}
        communications={communications}
        templates={templates}
        inlineNoCopy={inlineNoCopy}
        externalFeedback={pasteFeedback}
        selectionTick={selectionTick}
      />
      <TableControls editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
