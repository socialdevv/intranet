import { useRef, useState } from "react";
import { AlertCircle, Loader2, UploadCloud } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { useMediaUpload } from "@/hooks/useMediaUpload";
import {
  DEFAULT_MEDIA_FOLDERS,
  suggestAltFromFilename,
  type MediaAssetKind,
} from "@/lib/media/assets";
import {
  buildWrongMediaKindMessage,
  localizeUploadErrorMessage,
} from "@/lib/media/upload-messages";
import {
  describeUploadLimitForKind,
  validateClientUploadSize,
} from "@/lib/media/upload-policy";
import type { MediaUploadResult } from "@/lib/media/upload";

type UploadTone = "success" | "info" | "error";

const ACCEPT_BY_KIND: Record<MediaAssetKind, string> = {
  image: "image/*",
  video: "video/*",
  file: "*/*",
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

function resolveUploadFailureTone(result: MediaUploadResult & { ok: false }): UploadTone {
  if (result.code === "not-configured" || result.code === "network") {
    return "info";
  }

  return "error";
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

  function reportLocalError(message: string) {
    setNotice(message);
    setNoticeTone("error");
    toast("error", message, 4200);
  }

  function suppressEnterFromFileDialog() {
    const suppressEnter = (keydownEvent: KeyboardEvent) => {
      if (keydownEvent.key !== "Enter") {
        return;
      }

      keydownEvent.preventDefault();
      keydownEvent.stopPropagation();
      window.removeEventListener("keydown", suppressEnter, true);
    };

    window.addEventListener("keydown", suppressEnter, true);
    window.setTimeout(() => {
      window.removeEventListener("keydown", suppressEnter, true);
    }, 500);
  }

  async function handleFile(file: File) {
    const sizeValidation = validateClientUploadSize(file.size, mediaKind);
    if (!sizeValidation.ok) {
      reportLocalError(sizeValidation.message);
      return;
    }

    if (!fileMatchesKind(file, mediaKind)) {
      reportLocalError(buildWrongMediaKindMessage(mediaKind));
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
        const message = localizeUploadErrorMessage(result.message, {
          mediaKind,
          apiErrorCode: result.apiErrorCode,
        });
        const tone = resolveUploadFailureTone(result);
        setNotice(message);
        setNoticeTone(tone);
        toast(tone, message, 5200);
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
      toast("success", "Przesłanie zakończone powodzeniem.", 3200);
    } catch (error) {
      const message = localizeUploadErrorMessage(
        error instanceof Error ? error.message : "",
        { mediaKind }
      );
      setNotice(message);
      setNoticeTone("error");
      toast("error", message, 5200);
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
    event.preventDefault();
    event.stopPropagation();

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

    void handleFile(pastedFile);
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    event.preventDefault();
    event.stopPropagation();

    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) {
      return;
    }

    suppressEnterFromFileDialog();
    void handleFile(selectedFile);
  }

  function handleChooseFileClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    fileInputRef.current?.click();
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
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
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
              {helperText} • {describeUploadLimitForKind(mediaKind)}
            </p>
          </div>
          <button
            type="button"
            form=""
            onClick={handleChooseFileClick}
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
        onChange={handleFileInputChange}
        onClick={(event) => {
          event.stopPropagation();
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
