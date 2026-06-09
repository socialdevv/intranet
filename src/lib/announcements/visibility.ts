import type { Announcement } from "@/lib/types/domain";

export type AnnouncementWindowStatus = "scheduled" | "active" | "expired";

function parseIsoDateTime(value: string | undefined): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getAnnouncementWindowStatus(
  announcement: Pick<Announcement, "visibleFrom" | "visibleUntil">,
  now: Date = new Date()
): AnnouncementWindowStatus {
  const from = parseIsoDateTime(announcement.visibleFrom);
  const until = parseIsoDateTime(announcement.visibleUntil);
  const nowMs = now.getTime();

  if (from && nowMs < from.getTime()) {
    return "scheduled";
  }

  if (until && nowMs > until.getTime()) {
    return "expired";
  }

  return "active";
}

export function isAnnouncementVisibleNow(
  announcement: Pick<Announcement, "active" | "visibleFrom" | "visibleUntil">,
  now: Date = new Date()
): boolean {
  return announcement.active && getAnnouncementWindowStatus(announcement, now) === "active";
}

export function toLocalDateTimeInputValue(value: string | undefined): string {
  const parsed = parseIsoDateTime(value);
  if (!parsed) return "";

  const pad = (part: number): string => part.toString().padStart(2, "0");

  const year = parsed.getFullYear();
  const month = pad(parsed.getMonth() + 1);
  const day = pad(parsed.getDate());
  const hour = pad(parsed.getHours());
  const minute = pad(parsed.getMinutes());

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function parseLocalDateTimeInputToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}
