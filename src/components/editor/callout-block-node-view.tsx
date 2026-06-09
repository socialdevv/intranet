import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Trash2, Info, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CalloutVariant = "info" | "warning" | "critical" | "success";

const VARIANT_CONFIG: Record<
  CalloutVariant,
  { border: string; bg: string; headerBg: string; iconColor: string; label: string; Icon: LucideIcon }
> = {
  info:     { border: "#2563eb", bg: "#dbeafe", headerBg: "#bfdbfe", iconColor: "#1d4ed8", label: "Info",         Icon: Info },
  warning:  { border: "#d97706", bg: "#fef3c7", headerBg: "#fde68a", iconColor: "#92400e", label: "Ostrzeżenie", Icon: AlertTriangle },
  critical: { border: "#dc2626", bg: "#fee2e2", headerBg: "#fecaca", iconColor: "#991b1b", label: "Krytyczne",   Icon: XCircle },
  success:  { border: "#16a34a", bg: "#dcfce7", headerBg: "#bbf7d0", iconColor: "#166534", label: "Sukces",       Icon: CheckCircle2 },
};

const VARIANT_LIST = (Object.entries(VARIANT_CONFIG) as [CalloutVariant, typeof VARIANT_CONFIG[CalloutVariant]][]).map(
  ([value, cfg]) => ({ value, color: cfg.border, label: cfg.label })
);

export default function CalloutBlockNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const variant = (node.attrs.variant as CalloutVariant) ?? "info";
  const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.info;
  const Icon = cfg.Icon;

  return (
    <NodeViewWrapper>
      <div
        className={[
          "my-4 overflow-hidden rounded-xl",
          selected ? "ring-2 ring-[#1d4f91]/30" : "",
        ].join(" ")}
        style={{
          borderLeft: `5px solid ${cfg.border}`,
          backgroundColor: cfg.bg,
          boxShadow: `inset 0 0 0 1px ${cfg.border}22`,
        }}
      >
        {/* Header: icon + label + variant switcher + delete */}
        <div
          className="flex items-center gap-2 px-3 py-1.5"
          style={{ backgroundColor: `${cfg.headerBg}aa` }}
        >
          <Icon size={13} style={{ color: cfg.iconColor, flexShrink: 0 }} />
          <span
            className="text-[11px] font-semibold tracking-wide"
            style={{ color: cfg.iconColor }}
          >
            {cfg.label}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {VARIANT_LIST.map((v) => (
              <button
                key={v.value}
                type="button"
                title={v.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  updateAttributes({ variant: v.value });
                }}
                className={[
                  "h-3 w-3 rounded-full border-2 transition",
                  variant === v.value
                    ? "scale-125 border-white shadow"
                    : "border-transparent opacity-40 hover:opacity-80",
                ].join(" ")}
                style={{ backgroundColor: v.color }}
              />
            ))}
            <span className="mx-1 inline-block h-3.5 w-px bg-black/15" aria-hidden />
            <button
              type="button"
              title="Usuń blok wyróżniony"
              onMouseDown={(e) => {
                e.preventDefault();
                deleteNode();
              }}
              className="rounded p-0.5 text-[#9ca3af] transition hover:bg-black/10 hover:text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* Editable content */}
        <div className="px-4 py-3">
          <NodeViewContent className="outline-none" />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
