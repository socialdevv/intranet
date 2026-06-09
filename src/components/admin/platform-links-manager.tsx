import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import {
  adaptPlatformLink,
  createPlatformLink,
  deletePlatformLink,
  fetchPlatformLinks,
  updatePlatformLink,
} from "@/lib/api/platform-links";
import { PRESET_ICONS, resolveIcon } from "@/lib/utils/link-icons";
import { isBlank, isValidHttpUrl, isValidInternalPath } from "@/lib/utils";
import type { LinkItem } from "@/lib/types/domain";

type FormState = {
  title: string;
  url: string;
  description: string;
  icon: string;
  openInNewTab: boolean;
  isInternal: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  url: "",
  description: "",
  icon: "link",
  openInNewTab: true,
  isInternal: false,
};

function toFormState(item: LinkItem): FormState {
  return {
    title: item.title,
    url: item.url,
    description: item.description,
    icon: item.icon,
    openInNewTab: item.openInNewTab,
    isInternal: item.isInternal,
  };
}

function PlatformLinkForm({
  initial,
  onSave,
  onCancel,
  busy,
  isNew,
}: {
  initial: FormState;
  onSave: (payload: FormState) => void | Promise<void>;
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
    const url = form.url.trim();
    const description = form.description.trim();

    if (isBlank(title)) {
      setError("Pole „Tytuł” jest wymagane.");
      return;
    }

    if (isBlank(url)) {
      setError("Pole „URL / ścieżka” jest wymagane.");
      return;
    }

    if (form.isInternal) {
      if (!isValidInternalPath(url)) {
        setError("Link wewnętrzny musi zaczynać się od „/” i nie może zawierać spacji.");
        return;
      }
    } else if (!isValidHttpUrl(url)) {
      setError("Dla linku zewnętrznego podaj pełny adres URL zaczynający się od http:// lub https://.");
      return;
    }

    void onSave({
      title,
      url,
      description,
      icon: form.icon,
      openInNewTab: form.isInternal ? false : form.openInNewTab,
      isInternal: form.isInternal,
    });
  }

  return (
    <div className="rounded-3xl border border-[#dbe5f0] bg-[#f8fbff] p-5 dark:border-[#1e3a5f] dark:bg-[#0b1b30]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
            {isNew ? "Nowy link globalny" : "Edytuj link globalny"}
          </h3>
          <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Linki trafiają bezpośrednio do globalnej sekcji homepage i nie są powiązane z pojedynczym projektem.
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

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
              placeholder="np. Helpdesk, CRM, portal firmowy"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              URL / ścieżka
            </label>
            <input
              className={fieldCls}
              disabled={busy}
              value={form.url}
              onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
              placeholder="https://… lub /wewnetrzna-sciezka"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              Opis
            </label>
            <textarea
              className={`${fieldCls} min-h-28 resize-y`}
              disabled={busy}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Krótki opis celu tego skrótu na stronie głównej"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[#374151] dark:text-[#94a3b8]">
              Ikona
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-[#dbe5f0] bg-white px-3 py-3 dark:border-[#334155] dark:bg-[#0f172a]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fb] text-[#1d4f91] dark:bg-[#102846] dark:text-[#93c5fd]">
                {resolveIcon(form.icon)}
              </span>
              <select
                className={fieldCls}
                disabled={busy}
                value={form.icon}
                onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
              >
                {PRESET_ICONS.map((icon) => (
                  <option key={icon.value} value={icon.value}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-2xl border border-[#dbe5f0] bg-white px-3 py-3 text-sm text-[#374151] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
            <input
              type="checkbox"
              className="rounded"
              checked={form.isInternal}
              disabled={busy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isInternal: event.target.checked,
                  openInNewTab: event.target.checked ? false : current.openInNewTab,
                }))
              }
            />
            Link wewnętrzny aplikacji
          </label>

          {!form.isInternal && (
            <label className="flex items-center gap-2 rounded-2xl border border-[#dbe5f0] bg-white px-3 py-3 text-sm text-[#374151] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#cbd5e1]">
              <input
                type="checkbox"
                className="rounded"
                checked={form.openInNewTab}
                disabled={busy}
                onChange={(event) =>
                  setForm((current) => ({ ...current, openInNewTab: event.target.checked }))
                }
              />
              Otwórz w nowej karcie
            </label>
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
          {isNew ? "Dodaj link" : "Zapisz zmiany"}
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

export default function PlatformLinksManager() {
  const { reloadData } = useData();
  const { push: pushToast } = useToast();
  const [items, setItems] = useState<LinkItem[]>([]);
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

  const loadLinks = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError("");

    try {
      const payload = await fetchPlatformLinks(signal);
      setItems(payload.data.items.map(adaptPlatformLink));
    } catch (caught) {
      if (signal?.aborted) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Nie udało się pobrać linków globalnych.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadLinks(controller.signal);
    return () => controller.abort();
  }, [loadLinks]);

  async function refreshAfterWrite(successMessage: string) {
    const [reloadResult] = await Promise.all([reloadData(), loadLinks()]);
    if (!reloadResult.ok) {
      pushToast("error", reloadResult.error ?? "Nie udało się odświeżyć danych po zapisie.");
    }
    pushToast("success", successMessage);
  }

  async function handleCreate(payload: FormState) {
    setIsMutating(true);
    try {
      await createPlatformLink(payload);
      setFormMode("idle");
      await refreshAfterWrite("Link globalny został zapisany.");
    } catch (caught) {
      pushToast("error", caught instanceof Error ? caught.message : "Nie udało się zapisać linku globalnego.");
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(payload: FormState) {
    if (!editingId) {
      return;
    }

    setIsMutating(true);
    try {
      await updatePlatformLink(editingId, payload);
      setFormMode("idle");
      setEditingId(null);
      await refreshAfterWrite("Link globalny został zaktualizowany.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się zaktualizować linku globalnego."
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
      await deletePlatformLink(id);
      if (editingId === id) {
        setEditingId(null);
        setFormMode("idle");
      }
      setPendingDeleteId(null);
      await refreshAfterWrite("Link globalny został usunięty.");
    } catch (caught) {
      pushToast("error", caught instanceof Error ? caught.message : "Nie udało się usunąć linku globalnego.");
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">Linki globalne</h2>
          <p className="mt-1 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Skróty z tej listy zasilają tylko globalną stronę główną i pozostają oddzielone od linków projektowych.
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
          Dodaj link
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
          {error}
        </div>
      )}

      {formMode === "create" && (
        <PlatformLinkForm
          key="create"
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setFormMode("idle")}
          busy={isMutating}
          isNew
        />
      )}

      {formMode === "edit" && editingItem && (
        <PlatformLinkForm
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
          Ładowanie linków globalnych…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dbe5f0] bg-[#f8fbff] px-4 py-12 text-center text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
          Brak linków globalnych. Dodaj pierwszy skrót, aby sekcja homepage zaczęła renderować realne odnośniki.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const deletePending = pendingDeleteId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-3xl border border-[#dde5ee] bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef4fb] text-[#1d4f91] dark:bg-[#102846] dark:text-[#93c5fd]">
                      {resolveIcon(item.icon)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                          {item.title}
                        </h3>
                        {item.isInternal && (
                          <span className="rounded-full border border-[#c7d2fe] bg-[#eef2ff] px-2.5 py-1 text-[11px] font-semibold text-[#4338ca] dark:border-[#312e81]/50 dark:bg-[#111433] dark:text-[#a5b4fc]">
                            Wewnętrzny
                          </span>
                        )}
                        {item.openInNewTab && !item.isInternal && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2.5 py-1 text-[11px] font-semibold text-[#16a34a] dark:border-[#14532d]/40 dark:bg-[#0a1f0a] dark:text-[#4ade80]">
                            <ExternalLink size={11} />
                            Nowa karta
                          </span>
                        )}
                      </div>
                      <p className="mt-1 break-all text-xs text-[#94a3b8]">{item.url}</p>
                      <p className="mt-2 text-sm leading-6 text-[#64748b] dark:text-[#cbd5e1]">
                        {item.description || "Brak opisu. Na homepage zostanie pokazany sam tytuł i ikona."}
                      </p>
                    </div>
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