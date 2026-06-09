import { useRef, useState } from "react";
import { AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import {
  DEFAULT_MEDIA_FOLDERS,
  suggestAltFromFilename,
  type MediaAssetKind,
} from "@/lib/media/assets";

type UploadTone = "success" | "info" | "error";

const ACCEPT_BY_KIND: Record<MediaAssetKind, string> = {
  image: "image/*",
  video: "video/*",
  file: "*/*",
};

const LIMIT_LABELS: Record<MediaAssetKind, string> = {
  image: "maks. 5 MB",
  video: "maks. 500 MB",
  file: "maks. 10 MB",
};

function fileMatchesKind(file: File, mediaKind: MediaAssetKind): boolean {
  if (!file.type) {
    return mediaKind === "file";
  }

  if (mediaKind === "image") {
    return file.type.startsWith("image/");
  }

  if (mediaKind === "video") {
    return file.type.startsWith("video/");
  }

  return true;
}

function toneClassName(tone: UploadTone): string {
  if (tone === "success") {
    return "text-[#166534]";
  }

  if (tone === "error") {
    return "text-[#b91c1c]";
  }

  return "text-[#475569]";
}

type Props = {
  mediaKind: MediaAssetKind;
  currentSrc?: string;
  title: string;
  helperText: string;
  actionLabel?: string;
  className?: string;
  onUploaded: (payload: {
    src: string;
    file: File;
    suggestedAlt: string;
  }) => void;
};

export default function MediaUploadDropzone({
  mediaKind,
  currentSrc,
  title,
  helperText,
  actionLabel = "Wybierz plik",
  className = "",
  onUploaded,
}: Props) {
  const { uploadAsset, uploadConfigured } = useMediaUpload();
  const { push: toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<UploadTone>("info");

  async function handleFile(file: File) {
    if (file.size <= 0) {
      setNotice("Wybrany plik jest pusty.");
      setNoticeTone("error");
      toast("error", "Wybrany plik jest pusty.", 4200);
      return;
    }

    if (!fileMatchesKind(file, mediaKind)) {
      setNotice(`Wybrany plik nie pasuje do typu ${mediaKind}.`);
      setNoticeTone("error");
      toast("error", "Wybierz poprawny typ pliku do uploadu.", 4200);
      return;
    }

    setIsUploading(true);
    setNotice("");
    setNoticeTone("info");

    try {
      const result = await uploadAsset({
        kind: mediaKind,
        file,
        folder: DEFAULT_MEDIA_FOLDERS[mediaKind],
      });

      if (!result.ok) {
        setNotice(result.message);
        setNoticeTone(result.code === "not-configured" || result.code === "network" ? "info" : "error");
        toast(
          result.code === "not-configured" || result.code === "network" ? "info" : "error",
          result.message,
          5200
        );
        return;
      }

      const suggestedAlt = suggestAltFromFilename(file.name);
      onUploaded({
        src: result.asset.src,
        file,
        suggestedAlt,
      });
      setNotice("Plik został wysłany i jest gotowy do użycia w treści artykułu.");
      setNoticeTone("success");
      toast("success", "Upload zakończony powodzeniem.", 3200);
    } catch {
      setNotice("Wystąpił nieoczekiwany błąd uploadu. Spróbuj ponownie.");
      setNoticeTone("error");
      toast("error", "Nie udało się wykonać uploadu pliku.", 5200);
    } finally {
      setIsUploading(false);
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(event.dataTransfer.files);
    const matchingFile = droppedFiles.find((file) => fileMatchesKind(file, mediaKind));

    if (!matchingFile) {
      setNotice("Przeciągnięty plik nie pasuje do oczekiwanego typu.");
      setNoticeTone("error");
      return;
    }

    void handleFile(matchingFile);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const items = Array.from(event.clipboardData.items);
    const pastedFiles = items
      .filter((item) => item.kind === "file")
      .flatMap((item) => {
        const file = item.getAsFile();
        return file ? [file] : [];
      });
    const pastedFile = pastedFiles.find((file) => fileMatchesKind(file, mediaKind));

    if (!pastedFile) {
      return;
    }

    event.preventDefault();
    void handleFile(pastedFile);
  }

  return (
    <div className={["rounded-lg border border-[#e5e7eb] bg-[#f8fafc] p-3", className].join(" ")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">{title}</p>
        <span className="text-[10px] text-[#94a3b8]">
          {uploadConfigured ? "API: aktywne" : "API: wymagane"}
        </span>
      </div>

      <div
        tabIndex={0}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }
          setDragActive(false);
        }}
        onDrop={handleDrop}
        onPaste={handlePaste}
        className={[
          "mt-2 rounded-lg border-2 border-dashed px-3 py-4 outline-none transition",
          dragActive
            ? "border-[#1d4f91] bg-[#eff6ff]"
            : "border-[#dbe4ee] bg-white hover:border-[#bfd0e3]",
        ].join(" ")}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <UploadCloud size={18} className="text-[#64748b]" />
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#374151]">
              Przeciągnij plik tutaj lub wklej go ze schowka
            </p>
            <p className="text-[10px] text-[#94a3b8]">
              {helperText} • {LIMIT_LABELS[mediaKind]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="ui-btn ui-btn-neutral h-8 px-3 text-[11px] font-medium disabled:opacity-50"
          >
            {isUploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />}
            {isUploading ? "Wysyłanie…" : actionLabel}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_BY_KIND[mediaKind]}
        className="hidden"
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          event.target.value = "";
          if (!selectedFile) {
            return;
          }
          void handleFile(selectedFile);
        }}
      />

      {currentSrc && (
        <p className="mt-2 break-all text-[10px] text-[#64748b]">
          Zapisana ścieżka: <span className="font-medium text-[#334155]">{currentSrc}</span>
        </p>
      )}

      {notice && (
        <p className={["mt-2 flex items-start gap-1 text-[10px]", toneClassName(noticeTone)].join(" ")}>
          {noticeTone === "error" ? <AlertCircle size={12} className="mt-0.5 shrink-0" /> : null}
          <span>{notice}</span>
        </p>
      )}
    </div>
  );
}