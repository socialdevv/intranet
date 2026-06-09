import { Mail, Ticket } from "lucide-react";
import type { TemplateChannel } from "@/lib/types/domain";

// ── Shared channel metadata ───────────────────────────────────────────────────

export const CHANNEL_META: Record<TemplateChannel, { label: string; bg: string; text: string }> = {
  email: {
    label: "E-mail",
    bg: "bg-[#e9f2ff] dark:bg-[#1d4f91]/20",
    text: "text-[#1d4f91] dark:text-[#60a5fa]",
  },
  zgloszenie: {
    label: "Zgłoszenie",
    bg: "bg-[#fef3c7] dark:bg-[#92400e]/20",
    text: "text-[#92400e] dark:text-[#fbbf24]",
  },
};

const CHANNEL_ICONS: Record<TemplateChannel, { sm: React.ReactNode; xs: React.ReactNode }> = {
  email:      { sm: <Mail size={11} />, xs: <Mail size={10} /> },
  zgloszenie: { sm: <Ticket size={11} />, xs: <Ticket size={10} /> },
};

// ── Full-size channel badge (11 px icon) ──────────────────────────────────────

export function ChannelBadge({ channel }: { channel: TemplateChannel }) {
  const m = CHANNEL_META[channel] ?? CHANNEL_META.email;
  const icon = (CHANNEL_ICONS[channel] ?? CHANNEL_ICONS.email).sm;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.bg} ${m.text}`}
    >
      {icon}
      {m.label}
    </span>
  );
}

// ── Mini channel badge (10 px icon, compact) ──────────────────────────────────

export function ChannelBadgeMini({ channel }: { channel: TemplateChannel }) {
  const m = CHANNEL_META[channel] ?? CHANNEL_META.email;
  const icon = (CHANNEL_ICONS[channel] ?? CHANNEL_ICONS.email).xs;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${m.bg} ${m.text}`}
    >
      {icon}
      {m.label}
    </span>
  );
}
