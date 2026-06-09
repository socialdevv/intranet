/**
 * Predefined icon options for link items.
 * Each entry maps a user-facing label to:
 *   - `value`: the string stored in `LinkItem.icon`
 *   - `render`: a React element to display
 */

// ── Predefined icons ──────────────────────────────────────────────────────────

export type PresetIcon = {
  label: string;
  value: string;
};

export const PRESET_ICONS: PresetIcon[] = [
  { label: "Link / URL", value: "link" },
  { label: "Globus (strona www)", value: "globe" },
  { label: "Dokument", value: "file-text" },
  { label: "Książka", value: "book-open" },
  { label: "Baza wiedzy", value: "library" },
  { label: "Narzędzia", value: "wrench" },
  { label: "Ustawienia", value: "settings" },
  { label: "Skrzynka e-mail", value: "mail" },
  { label: "Telefon", value: "phone" },
  { label: "Mapa / lokalizacja", value: "map-pin" },
  { label: "Wykres / raporty", value: "bar-chart" },
  { label: "Formularz", value: "clipboard" },
  { label: "Użytkownik", value: "user" },
  { label: "Zespół", value: "users" },
  { label: "Tarcza (bezpieczeństwo)", value: "shield" },
  { label: "Klucz (hasła/dostępy)", value: "key" },
  { label: "Chmura", value: "cloud" },
  { label: "Dom / start", value: "home" },
  { label: "Gwiazdka (ulubione)", value: "star" },
  { label: "Dzwonek (powiadomienia)", value: "bell" },
  { label: "Koszyk", value: "shopping-cart" },
  { label: "Zegar", value: "clock" },
  { label: "Kalendarz", value: "calendar" },
  { label: "Wyszukiwarka", value: "search" },
  { label: "Pobieranie", value: "download" },
  // ── Extended set ──────────────────────────────────────────────────────
  { label: "Folder", value: "folder" },
  { label: "Wgrywanie (upload)", value: "upload" },
  { label: "Udostępnianie", value: "share" },
  { label: "Drukarka", value: "printer" },
  { label: "Monitor / ekran", value: "monitor" },
  { label: "Baza danych", value: "database" },
  { label: "Serwer", value: "server" },
  { label: "Blokada / dostęp", value: "lock" },
  { label: "Ostrzeżenie", value: "alert-triangle" },
  { label: "Informacja", value: "info" },
  { label: "Zatwierdzone", value: "check-circle" },
  { label: "Pomoc / FAQ", value: "help-circle" },
  { label: "Flaga / status", value: "flag" },
  { label: "Zakładka", value: "bookmark" },
  { label: "Etykieta / tag", value: "tag" },
  { label: "Wykres kołowy", value: "pie-chart" },
  { label: "Trend wzrostowy", value: "trending-up" },
  { label: "Błyskawica (szybkie akcje)", value: "zap" },
  { label: "Warstwy", value: "layers" },
  { label: "Wiadomość", value: "message-square" },
];

// ── SVG icon paths (lucide-style) ─────────────────────────────────────────────

const ICON_PATHS: Record<string, string> = {
  link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  "file-text": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  "book-open": "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
  library: "M4 19V7M4 7 8 3l4 4M8 3v16M12 19V7l4-4 4 4v12",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  "map-pin": "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 10m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  "bar-chart": "M18 20V10M12 20V4M6 20v-6",
  clipboard: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z",
  user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  key: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4",
  cloud: "M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z",
  home: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7M13.73 21a2 2 0 0 1-3.46 0",
  "shopping-cart": "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
  calendar: "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM16 1v4M8 1v4M3 9h18",
  search: "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  // ── Extended set ──────────────────────────────────────────────────────────
  folder: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
  printer: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  monitor: "M21 2H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM7 22h10M12 17v5",
  database: "M12 2C8.13 2 5 3.79 5 6s3.13 4 7 4 7-1.79 7-4-3.13-4-7-4zM5 6v6c0 2.21 3.13 4 7 4s7-1.79 7-4V6M5 12v6c0 2.21 3.13 4 7 4s7-1.79 7-4v-6",
  server: "M2 2h20v8H2zM2 14h20v8H2zM6 6h.01M6 18h.01",
  lock: "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4",
  "alert-triangle": "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8h.01M11 12h1v4h1",
  "check-circle": "M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3",
  "help-circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01",
  flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z",
  tag: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  "pie-chart": "M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z",
  "trending-up": "M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  zap: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  "message-square": "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Resolves a `LinkItem.icon` string to a renderable React element.
 *
 * Resolution order:
 *  1. Known preset icon name → inline SVG
 *  2. Single emoji / short non-whitespace string → renders as text
 *  3. Fallback → generic link icon
 */
export function resolveIcon(icon: string): React.ReactNode {
  const key = icon?.trim().toLowerCase() ?? "";
  const pathData = ICON_PATHS[key];

  if (pathData) {
    return (
      <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d={pathData} />
      </svg>
    );
  }

  // Emoji or custom short label
  if (icon && icon.trim().length > 0 && icon.trim().length <= 4) {
    return <span className="text-lg leading-none">{icon.trim()}</span>;
  }

  // Fallback: generic link icon
  return (
    <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
