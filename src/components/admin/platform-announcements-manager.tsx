import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import RichEditor from "@/components/editor/rich-editor";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { useCurrentTime } from "@/hooks/useCurrentTime";
import {
  createPlatformAnnouncement,
  deletePlatformAnnouncement,
  fetchPlatformAnnouncements,
  updatePlatformAnnouncement,
  adaptPlatformAnnouncement,
} from "@/lib/api/platform-announcements";
import {
  getAnnouncementWindowStatus,
  parseLocalDateTimeInputToIso,
  toLocalDateTimeInputValue,
  type AnnouncementWindowStatus,
} from "@/lib/announcements/visibility";
import { coerceTipTapDoc, plainTextToTipTapDoc, type TipTapDoc } from "@/lib/knowledge/content-doc";
import { extractPlainText } from "@/lib/utils";
import type { Announcement, AnnouncementColor } from "@/lib/types/domain";

const COLOR_OPTIONS: { value: AnnouncementColor; label: string }[] = [
  { value: "red", label: "Czerwony" },
  { value: "orange", label: "Pomarańczowy" },
  { value: "green", label: "Zielony" },
  { value: "blue", label: "Niebieski" },
];

const COLOR_BADGE: Record<AnnouncementColor, string> = {
  red: "border-[#fecaca] bg-[#fef2f2] text-[#dc2626] dark:border-[#7f1d1d]/40 dark:bg-[#1a0808] dark:text-[#f87171]",
  orange:
    "border-[#fed7aa] bg-[#fff7ed] text-[#ea580c] dark:border-[#7c2d12]/40 dark:bg-[#1a0a00] dark:text-[#fb923c]",
  green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#2563eb] dark:border-[#1e3a5f]/60 dark:bg-[#0f2340] dark:text-[#60a5fa]",
};

const WINDOW_STATUS_LABEL: Record<AnnouncementWindowStatus, string> = {
  scheduled: "Okno: zaplanowane",
  active: "Okno: aktywne",
  expired: "Okno: wygasłe",
};

const WINDOW_STATUS_BADGE: Record<AnnouncementWindowStatus, string> = {
  scheduled:
    "border-[#c7d2fe] bg-[#eef2ff] text-[#4338ca] dark:border-[#312e81]/50 dark:bg-[#111433] dark:text-[#a5b4fc]",
  active:
    "border-[#bbf7d0] bg-[#f0fdf4] text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]",
  expired:
    "border-[#fecaca] bg-[#fff1f2] text-[#dc2626] dark:border-[#7f1d1d]/40 dark:bg-[#2b0f14] dark:text-[#f87171]",
};

type FormState = {
  title: string;
  body: TipTapDoc;
  color: AnnouncementColor;
  active: boolean;
  useVisibilityWindow: boolean;
  visibleFromInput: string;
  visibleUntilInput: string;
};

type FormSubmitState = {
  title: string;
  body: TipTapDoc;
  color: AnnouncementColor;
  active: boolean;
  visibleFrom?: string;
  visibleUntil?: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  body: plainTextToTipTapDoc(""),
  color: "blue",
  active: true,
  useVisibilityWindow: false,
  visibleFromInput: "",
  visibleUntilInput: "",
};

function formatVisibilityDateTime(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toFormState(item: Announcement): FormState {
  return {
    title: item.title,
    body: coerceTipTapDoc(item.body),
    color: item.color,
    active: item.active,
    useVisibilityWindow: Boolean(item.visibleFrom || item.visibleUntil),
    visibleFromInput: toLocalDateTimeInputValue(item.visibleFrom),
    visibleUntilInput: toLocalDateTimeInputValue(item.visibleUntil),
  };
}

function AnnouncementForm({
  initial,
  onSave,
  onCancel,
  busy,
  isNew,
}: {
  initial: FormState;
  onSave: (payload: FormSubmitState) => void | Promise<void>;
  onCancel: () => void;
  busy: boolean;
  isNew: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    setForm(initial);
    setError("");
  }, [initial]);

  const fieldCls =
    "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]";

  function submit() {
    setError("");

    const title = form.title.trim();
    if (!title) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }

    if (!form.useVisibilityWindow) {
      void onSave({
        title,
        body: form.body,
        color: form.color,
        active: form.active,
      });
      return;
    }

    const visibleFromRaw = form.visibleFromInput.trim();
    const visibleUntilRaw = form.visibleUntilInput.trim();
    const visibleFrom = visibleFromRaw ? parseLocalDateTimeInputToIso(visibleFromRaw) : null;
    const visibleUntil = visibleUntilRaw ? parseLocalDateTimeInputToIso(visibleUntilRaw) : null;

    if (visibleFromRaw && !visibleFrom) {
      setError("Podaj poprawną datę aktywacji.");
      return;
    }

    if (visibleUntilRaw && !visibleUntil) {
      setError("Podaj poprawną datę dezaktywacji.");
      return;
    }

    if (visibleFrom && visibleUntil && new Date(visibleUntil).getTime() < new Date(visibleFrom).getTime()) {
      setError("Data dezaktywacji nie może być wcześniejsza niż data aktywacji.");
      return;
    }

    void onSave({
      title,
      body: form.body,
      color: form.color,
      active: form.active,
      visibleFrom: visibleFrom ?? undefined,
      visibleUntil: visibleUntil ?? undefined,
    });
  }

  return (
    <div className="rounded-3xl border border-[#dbe5f0] bg-[#f8fbff] p-5 dark:border-[#1e3a5f] dark:bg-[#0b1b30]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            {isNew ? "Nowe ogłoszenie globalne" : "Edytuj ogłoszenie globalne"}
          </h3>
          <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Ogłoszenie pojawi się na globalnej stronie startowej intranetu.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#dbe5f0] text-[#64748b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#0f172a]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              Tytuł
            </label>
            <input
              autoFocus
              className={fieldCls}
              disabled={busy}
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="np. Zmiana godzin wsparcia lub ważny komunikat operacyjny"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              Treść
            </label>
            <RichEditor
              content={form.body}
              onChange={(body) => setForm((current) => ({ ...current, body }))}
              placeholder="Wprowadź treść ogłoszenia globalnego…"
              minHeight="260px"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              Kolor akcentu
            </label>
            <select
              className={fieldCls}
              disabled={busy}
              value={form.color}
              onChange={(event) =>
                setForm((current) => ({ ...current, color: event.target.value as AnnouncementColor }))
              }
            >
              {COLOR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-2xl border border-[#dbe5f0] bg-white px-3 py-3 text-sm text-[#374151] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
            <input
              type="checkbox"
              className="rounded"
              checked={form.active}
              disabled={busy}
              onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
            />
            Aktywne ogłoszenie
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-[#dbe5f0] bg-white px-3 py-3 text-sm text-[#374151] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
            <input
              type="checkbox"
              className="rounded"
              checked={form.useVisibilityWindow}
              disabled={busy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  useVisibilityWindow: event.target.checked,
                  visibleFromInput: event.target.checked ? current.visibleFromInput : "",
                  visibleUntilInput: event.target.checked ? current.visibleUntilInput : "",
                }))
              }
            />
            Ogranicz okno widoczności
          </label>

          {form.useVisibilityWindow && (
            <div className="space-y-3 rounded-2xl border border-[#dbe5f0] bg-white p-3 dark:border-[#334155] dark:bg-[#0f172a]">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
                  Aktywuj od
                </label>
                <input
                  type="datetime-local"
                  className={fieldCls}
                  disabled={busy}
                  value={form.visibleFromInput}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, visibleFromInput: event.target.value }))
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
                  Ukryj po
                </label>
                <input
                  type="datetime-local"
                  className={fieldCls}
                  disabled={busy}
                  value={form.visibleUntilInput}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, visibleUntilInput: event.target.value }))
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check size={15} />
          {isNew ? "Dodaj ogłoszenie" : "Zapisz zmiany"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl border border-[#dbe5f0] px-4 py-2 text-sm font-medium text-[#475569] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:text-[#cbd5e1] dark:hover:bg-[#0f172a]"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

export default function PlatformAnnouncementsManager() {
  const { reloadData } = useData();
  const { push: pushToast } = useToast();
  const now = useCurrentTime();
  const [items, setItems] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<"idle" | "create" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items]
  );

  const loadAnnouncements = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");

    try {
      const payload = await fetchPlatformAnnouncements(signal);
      setItems(payload.data.items.map(adaptPlatformAnnouncement));
    } catch (caught) {
      if (signal?.aborted) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać ogłoszeń globalnych.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadAnnouncements(controller.signal);
    return () => controller.abort();
  }, [loadAnnouncements]);

  async function refreshAfterWrite(successMessage: string) {
    const [reloadResult] = await Promise.all([reloadData(), loadAnnouncements()]);
    if (!reloadResult.ok) {
      pushToast("error", reloadResult.error ?? "Nie udało się odświeżyć danych po zapisie.");
    }
    pushToast("success", successMessage);
  }

  async function handleCreate(payload: FormSubmitState) {
    setIsMutating(true);
    try {
      await createPlatformAnnouncement({
        title: payload.title,
        body: payload.body,
        description: extractPlainText(payload.body).trim(),
        color: payload.color,
        active: payload.active,
        visibleFrom: payload.visibleFrom ?? null,
        visibleUntil: payload.visibleUntil ?? null,
      });
      setFormMode("idle");
      await refreshAfterWrite("Ogłoszenie globalne zostało zapisane.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się zapisać ogłoszenia globalnego."
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(payload: FormSubmitState) {
    if (!editingId) {
      return;
    }

    setIsMutating(true);
    try {
      await updatePlatformAnnouncement(editingId, {
        title: payload.title,
        body: payload.body,
        description: extractPlainText(payload.body).trim(),
        color: payload.color,
        active: payload.active,
        visibleFrom: payload.visibleFrom ?? null,
        visibleUntil: payload.visibleUntil ?? null,
      });
      setFormMode("idle");
      setEditingId(null);
      await refreshAfterWrite("Ogłoszenie globalne zostało zaktualizowane.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się zaktualizować ogłoszenia globalnego."
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete(id: string) {
    if (pendingDeleteId !== id) {
      setPendingDeleteId(id);
      return;
    }

    setIsMutating(true);
    try {
      await deletePlatformAnnouncement(id);
      if (editingId === id) {
        setEditingId(null);
        setFormMode("idle");
      }
      setPendingDeleteId(null);
      await refreshAfterWrite("Ogłoszenie globalne zostało usunięte.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się usunąć ogłoszenia globalnego."
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            Ogłoszenia globalne
          </h2>
          <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Ten moduł zarządza wyłącznie platformową warstwą homepage. Nie zapisuje danych projektowych.
          </p>
        </div>
        <button
          type="button"
          disabled={isMutating}
          onClick={() => {
            setFormMode("create");
            setEditingId(null);
            setPendingDeleteId(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={15} />
          Dodaj ogłoszenie
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
          {error}
        </div>
      )}

      {formMode === "create" && (
        <AnnouncementForm
          key="create"
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setFormMode("idle")}
          busy={isMutating}
          isNew
        />
      )}

      {formMode === "edit" && editingItem && (
        <AnnouncementForm
          key={editingItem.id}
          initial={toFormState(editingItem)}
          onSave={handleUpdate}
          onCancel={() => {
            setEditingId(null);
            setFormMode("idle");
          }}
          busy={isMutating}
          isNew={false}
        />
      )}

      {isLoading && items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dbe5f0] bg-[#f8fbff] px-4 py-12 text-center text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
          Ładowanie ogłoszeń globalnych…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dbe5f0] bg-[#f8fbff] px-4 py-12 text-center text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
          Brak ogłoszeń globalnych. Dodaj pierwszą pozycję, aby homepage zaczął renderować realną treść.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const windowStatus = getAnnouncementWindowStatus(item, now);
            const visibleFromLabel = formatVisibilityDateTime(item.visibleFrom);
            const visibleUntilLabel = formatVisibilityDateTime(item.visibleUntil);
            const deletePending = pendingDeleteId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-3xl border border-[#dde5ee] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${COLOR_BADGE[item.color]}`}>
                        {COLOR_OPTIONS.find((option) => option.value === item.color)?.label ?? item.color}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${WINDOW_STATUS_BADGE[windowStatus]}`}>
                        {WINDOW_STATUS_LABEL[windowStatus]}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#dbe5f0] bg-[#f8fbff] px-2.5 py-1 text-[11px] font-semibold text-[#475569] dark:border-[#334155] dark:bg-[#0b1b30] dark:text-[#cbd5e1]">
                        {item.active ? <Eye size={12} /> : <EyeOff size={12} />}
                        {item.active ? "Aktywne" : "Wyłączone"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                      {item.title}
                    </h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#64748b] dark:text-[#cbd5e1]">
                      {item.description || "Brak skrótu tekstowego. Na homepage będzie dostępna pełna treść rich text."}
                    </p>
                    {(visibleFromLabel || visibleUntilLabel) && (
                      <p className="mt-3 text-xs text-[#94a3b8]">
                        {visibleFromLabel ? `Od: ${visibleFromLabel}` : "Od: bez ograniczenia"}
                        {" · "}
                        {visibleUntilLabel ? `Do: ${visibleUntilLabel}` : "Do: bez ograniczenia"}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        setEditingId(item.id);
                        setFormMode("edit");
                        setPendingDeleteId(null);
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-[#dbe5f0] px-3 py-2 text-sm font-medium text-[#475569] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:text-[#cbd5e1] dark:hover:bg-[#0b1b30]"
                    >
                      <Pencil size={14} />
                      Edytuj
                    </button>
                    {deletePending ? (
                      <>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => {
                            void handleDelete(item.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#dc2626] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#b91c1c] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 size={14} />
                          Potwierdź
                        </button>
                        <button
                          type="button"
                          disabled={isMutating}
                          onClick={() => setPendingDeleteId(null)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#dbe5f0] px-3 py-2 text-sm font-medium text-[#475569] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#334155] dark:text-[#cbd5e1] dark:hover:bg-[#0b1b30]"
                        >
                          Anuluj
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => {
                          void handleDelete(item.id);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-[#fecaca] px-3 py-2 text-sm font-medium text-[#dc2626] transition hover:bg-[#fef2f2] disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#7f1d1d] dark:text-[#f87171] dark:hover:bg-[#1f0b12]"
                      >
                        <Trash2 size={14} />
                        Usuń
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}