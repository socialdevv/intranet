import { useState } from "react";
import {
  GripVertical,
  Plus,
  Trash2,
  ExternalLink,
  Pencil,
  Check,
} from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { PRESET_ICONS, resolveIcon } from "@/lib/utils/link-icons";
import { useDragSort } from "@/hooks/useDragSort";
import type { HomeQuickLink } from "@/lib/types/domain";

type QuickLinkFormState = {
  label: string;
  url: string;
  icon: string;
  openInNewTab: boolean;
  isInternal: boolean;
};

const BLANK_FORM: QuickLinkFormState = {
  label: "",
  url: "",
  icon: "link",
  openInNewTab: true,
  isInternal: false,
};

function QuickLinkForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
  busy = false,
}: {
  form: QuickLinkFormState;
  setForm: (f: QuickLinkFormState) => void;
  onSubmit: () => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
}) {
  const canSubmit = !busy && form.label.trim() && form.url.trim();
  return (
    <div className="mb-4 space-y-2 rounded-xl border border-[#c3d6ea] bg-[#f8fafd] p-3 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8]">
            Etykieta
          </label>
          <input
            autoFocus
            type="text"
            disabled={busy}
            placeholder="np. Panel CRM"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="h-8 w-full rounded-lg border border-[#dde5ee] bg-white px-2 text-xs placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-1 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8]">
            URL / ścieżka
          </label>
          <input
            type="text"
            disabled={busy}
            placeholder="https://… lub /ścieżka"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="h-8 w-full rounded-lg border border-[#dde5ee] bg-white px-2 text-xs placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-1 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-[#64748b] dark:text-[#94a3b8]">
          Ikona
        </label>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#dde5ee] bg-white text-[#375a7f] dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#93c5fd]">
            {resolveIcon(form.icon)}
          </span>
          <select
            disabled={busy}
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className="h-8 flex-1 rounded-lg border border-[#dde5ee] bg-white px-2 text-xs text-[#374151] focus:border-[#1d4f91] focus:outline-none focus:ring-1 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
          >
            {PRESET_ICONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#4b5563] dark:text-[#94a3b8]">
          <input
            type="checkbox"
            disabled={busy}
            checked={form.isInternal}
            onChange={(e) => setForm({ ...form, isInternal: e.target.checked })}
            className="rounded"
          />
          Link wewnętrzny (aplikacja)
        </label>
        {!form.isInternal && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#4b5563] dark:text-[#94a3b8]">
            <input
              type="checkbox"
              disabled={busy}
              checked={form.openInNewTab}
              onChange={(e) => setForm({ ...form, openInNewTab: e.target.checked })}
              className="rounded"
            />
            Otwórz w nowej karcie
          </label>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void onSubmit();
          }}
          className="inline-flex items-center gap-1 rounded-lg bg-[#1d4f91] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-[#1a4580] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Check size={12} />
          {submitLabel}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="inline-flex items-center gap-1 rounded-lg border border-[#dde5ee] px-3 py-1.5 text-xs text-[#64748b] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

export default function QuickLinksManager() {
  const { homeQuickLinks, quickLinksModule } = useData();
  const { push: pushToast } = useToast();

  const {
    isLoading,
    isMutating,
    error,
    canWrite,
    canReorder,
    addQuickLink,
    editQuickLink,
    removeQuickLink,
    reorderQuickLinks,
  } = quickLinksModule;

  const sorted = [...homeQuickLinks].sort((a, b) => a.sortOrder - b.sortOrder);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<QuickLinkFormState>(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QuickLinkFormState>(BLANK_FORM);

  const { overIdx, onDragStart, onDragOver, onDrop, onDragEnd } =
    useDragSort<HomeQuickLink>(sorted, reorderQuickLinks);

  async function submitAdd() {
    if (!form.label.trim() || !form.url.trim()) return;
    try {
      await addQuickLink({
        label: form.label.trim(),
        url: form.url.trim(),
        icon: form.icon,
        openInNewTab: form.openInNewTab,
        isInternal: form.isInternal,
      });

      setForm(BLANK_FORM);
      setAddOpen(false);
      pushToast("success", "Szybki link został dodany.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się dodać szybkiego linku."
      );
    }
  }

  function startEdit(link: HomeQuickLink) {
    setEditingId(link.id);
    setEditForm({
      label: link.label,
      url: link.url,
      icon: link.icon,
      openInNewTab: link.openInNewTab ?? true,
      isInternal: link.isInternal ?? false,
    });
  }

  async function commitEdit(id: string) {
    if (!editForm.label.trim() || !editForm.url.trim()) return;

    try {
      await editQuickLink(id, {
        label: editForm.label.trim(),
        url: editForm.url.trim(),
        icon: editForm.icon,
        openInNewTab: editForm.openInNewTab,
        isInternal: editForm.isInternal,
      });

      setEditingId(null);
      pushToast("success", "Szybki link został zaktualizowany.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się zaktualizować szybkiego linku."
      );
    }
  }

  async function removeLink(id: string) {
    try {
      await removeQuickLink(id);
      pushToast("success", "Szybki link został usunięty.");
    } catch (caught) {
      pushToast(
        "error",
        caught instanceof Error ? caught.message : "Nie udało się usunąć szybkiego linku."
      );
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Szybkie linki
          </h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Skróty do codziennych zasobów.
            {canReorder ? " Przeciągnij, aby zmienić kolejność." : null}
          </p>
        </div>
        {(
          <button
            type="button"
            disabled={!canWrite || isMutating}
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-3 py-2 text-xs font-medium text-white transition hover:bg-[#1a4580] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={13} />
            Dodaj link
          </button>
        )}
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-xs text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
          {error}
        </div>
      ) : null}

      {/* Add form */}
      {addOpen && (
        <QuickLinkForm
          form={form}
          setForm={setForm}
          onSubmit={submitAdd}
          onCancel={() => { setAddOpen(false); setForm(BLANK_FORM); }}
          submitLabel="Dodaj"
          busy={isMutating}
        />
      )}

      {/* List */}
      {isLoading && sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-10 text-center dark:border-[#334155] dark:bg-[#1a2535]">
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Ładowanie szybkich linków…</p>
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-10 text-center dark:border-[#334155] dark:bg-[#1a2535]">
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak szybkich linków.</p>
          <p className="mt-1 text-xs text-[#9ca3af] dark:text-[#475569]">Kliknij „Dodaj link”, aby dodać pierwszy.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((link, idx) => (
            <div key={link.id}>
              {editingId === link.id ? (
                <div className="rounded-xl border border-[#c3d6ea] bg-[#f8fafd] p-3 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
                  <QuickLinkForm
                    form={editForm}
                    setForm={setEditForm}
                    onSubmit={() => commitEdit(link.id)}
                    onCancel={() => setEditingId(null)}
                    submitLabel="Zapisz"
                    busy={isMutating}
                  />
                </div>
              ) : (
                <div
                  draggable={canReorder && !isMutating}
                  onDragStart={() => {
                    if (!canReorder || isMutating) return;
                    onDragStart(idx);
                  }}
                  onDragOver={(e) => {
                    if (!canReorder || isMutating) return;
                    onDragOver(e, idx);
                  }}
                  onDrop={(e) => {
                    if (!canReorder || isMutating) return;
                    onDrop(e, idx);
                  }}
                  onDragEnd={() => {
                    if (!canReorder || isMutating) return;
                    onDragEnd();
                  }}
                  className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition dark:bg-[#0d1b2e] ${
                    overIdx === idx
                      ? "border-[#1d4f91] dark:border-[#2563eb]"
                      : "border-[#dde5ee] dark:border-[#1e3a5f]"
                  }`}
                >
                  <GripVertical
                    size={14}
                    className={`shrink-0 text-[#c0cdd8] dark:text-[#334155] ${
                      canReorder && !isMutating ? "cursor-grab" : "cursor-not-allowed opacity-50"
                    }`}
                  />
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f9] text-[#375a7f] dark:bg-[#1e293b] dark:text-[#93c5fd]">
                    {resolveIcon(link.icon)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                      {link.label}
                    </p>
                    <p className="truncate text-[10px] text-[#9ca3af]">{link.url}</p>
                  </div>
                  {link.openInNewTab && !link.isInternal && (
                    <ExternalLink size={11} className="shrink-0 text-[#c0cdd8] dark:text-[#334155]" />
                  )}
                  <button
                    type="button"
                    title="Edytuj"
                    disabled={isMutating}
                    onClick={() => startEdit(link)}
                    className="shrink-0 text-[#c0cdd8] transition hover:text-[#64748b] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#334155] dark:hover:text-[#94a3b8]"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    title="Usuń"
                    disabled={isMutating}
                    onClick={() => {
                      void removeLink(link.id);
                    }}
                    className="shrink-0 text-[#fca5a5] transition hover:text-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#7f1d1d] dark:hover:text-[#f87171]"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
