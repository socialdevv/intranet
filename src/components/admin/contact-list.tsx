import { useState, useCallback } from "react";
import { ChevronUp, ChevronDown, Plus, X } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import type { ContactEntry, ContactGroup, ContactDetailTable, ContactDetailGroup, ContactTableSection } from "@/lib/types/domain";

// ── Constants ─────────────────────────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: ContactGroup; label: string }[] = [
  { value: "wewnetrzne", label: "Wewnętrzne" },
  { value: "zewnetrzne", label: "Zewnętrzne" },
];

// ── Style helpers ─────────────────────────────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]";

const labelCls =
  "mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]";

// ── Types ────────────────────────────────────────────────────────────────────────────────────

type Draft = Omit<ContactEntry, "id" | "sortOrder">;

function blankDraft(): Draft {
  return { title: "", description: "", phone: "", email: "", address: "", group: "wewnetrzne", detailTable: undefined };
}

function draftFromEntry(e: ContactEntry): Draft {
  return { title: e.title, description: e.description, phone: e.phone, email: e.email, address: e.address ?? "", group: e.group, detailTable: e.detailTable };
}

// ── Detail table editor ──────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── GroupEditor: items textarea + shared action input ─────────────────────────

function GroupEditor({
  group,
  itemsHeader,
  actionHeader,
  onUpdateItems,
  onUpdateAction,
  onRemove,
}: {
  group: ContactDetailGroup;
  itemsHeader: string;
  actionHeader: string;
  onUpdateItems: (v: string) => void;
  onUpdateAction: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative rounded-lg border border-[#e5e7eb] bg-white p-2.5 dark:border-[#334155] dark:bg-[#1e293b]">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 rounded p-0.5 text-[#94a3b8] transition hover:text-[#ef4444]"
        aria-label="Usuń grupę"
      >
        <X size={11} />
      </button>
      <div className="grid grid-cols-2 gap-2 pr-5">
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-[#6b7280] dark:text-[#94a3b8]">
            {itemsHeader || "Pozycje"}
          </label>
          <textarea
            value={group.items}
            onChange={(e) => onUpdateItems(e.target.value)}
            placeholder={"np. Inowrocław\nChojnice\nNakło nad Notecią"}
            rows={3}
            className="w-full resize-y rounded border border-[#e5e7eb] bg-[#f8fafc] px-2 py-1.5 text-[11px] text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#0d1b2e] dark:text-[#f1f5f9]"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] font-medium text-[#6b7280] dark:text-[#94a3b8]">
            {actionHeader || "Działanie"}
          </label>
          <textarea
            value={group.action}
            onChange={(e) => onUpdateAction(e.target.value)}
            placeholder="np. Podajemy nr 52 582 27 13"
            rows={3}
            className="w-full resize-y rounded border border-[#e5e7eb] bg-[#f8fafc] px-2 py-1.5 text-[11px] text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#0d1b2e] dark:text-[#f1f5f9]"
          />
        </div>
      </div>
    </div>
  );
}

// ── SectionEditor: label + list of groups ─────────────────────────────────────

function SectionEditor({
  section,
  itemsHeader,
  actionHeader,
  onUpdateLabel,
  onAddGroup,
  onUpdateGroupItems,
  onUpdateGroupAction,
  onRemoveGroup,
  onRemove,
}: {
  section: ContactTableSection;
  itemsHeader: string;
  actionHeader: string;
  onUpdateLabel: (v: string) => void;
  onAddGroup: () => void;
  onUpdateGroupItems: (gId: string, v: string) => void;
  onUpdateGroupAction: (gId: string, v: string) => void;
  onRemoveGroup: (gId: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border border-[#e5e7eb] dark:border-[#334155]">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[#94a3b8] transition hover:text-[#374151] dark:hover:text-[#e2e8f0]"
        >
          <ChevronDown
            size={12}
            style={{ transform: open ? "" : "rotate(-90deg)", transition: "transform 0.15s" }}
          />
        </button>
        <input
          type="text"
          value={section.label}
          onChange={(e) => onUpdateLabel(e.target.value)}
          placeholder="Nazwa sekcji (np. OD Bydgoszcz)"
          className="flex-1 border-0 bg-transparent text-xs font-medium text-[#374151] outline-none placeholder:text-[#b0bac9] dark:text-[#f1f5f9]"
        />
        <span className="shrink-0 text-[10px] text-[#94a3b8]">{section.groups.length} gr.</span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-[#94a3b8] transition hover:text-[#ef4444]"
          aria-label="Usuń sekcję"
        >
          <X size={12} />
        </button>
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-[#f1f5f9] px-2.5 py-2 dark:border-[#1e293b]">
          {section.groups.map((g) => (
            <GroupEditor
              key={g.id}
              group={g}
              itemsHeader={itemsHeader}
              actionHeader={actionHeader}
              onUpdateItems={(v) => onUpdateGroupItems(g.id, v)}
              onUpdateAction={(v) => onUpdateGroupAction(g.id, v)}
              onRemove={() => onRemoveGroup(g.id)}
            />
          ))}
          <button
            type="button"
            onClick={onAddGroup}
            className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
          >
            <Plus size={10} /> Dodaj grupę
          </button>
        </div>
      )}
    </div>
  );
}

// ── DetailTableEditor ─────────────────────────────────────────────────────────

function DetailTableEditor({
  value,
  onChange,
}: {
  value: ContactDetailTable | undefined;
  onChange: (t: ContactDetailTable | undefined) => void;
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={() =>
          onChange({
            title: "",
            sectionHeader: "",
            itemsHeader: "",
            actionHeader: "",
            sections: [],
            notes: "",
          })
        }
        className="inline-flex items-center gap-1 text-xs font-medium text-[#1d4f91] transition hover:underline dark:text-[#60a5fa]"
      >
        <Plus size={12} /> Dodaj tabelę szczegółów
      </button>
    );
  }

  const t = value;
  function patch(partial: Partial<ContactDetailTable>) { onChange({ ...t, ...partial }); }

  function addSection() {
    patch({ sections: [...t.sections, { id: uid(), label: "", groups: [] }] });
  }
  function removeSection(id: string) {
    patch({ sections: t.sections.filter((s) => s.id !== id) });
  }
  function updateSectionLabel(id: string, v: string) {
    patch({ sections: t.sections.map((s) => (s.id === id ? { ...s, label: v } : s)) });
  }
  function addGroup(sId: string) {
    patch({
      sections: t.sections.map((s) =>
        s.id === sId ? { ...s, groups: [...s.groups, { id: uid(), items: "", action: "" }] } : s
      ),
    });
  }
  function removeGroup(sId: string, gId: string) {
    patch({
      sections: t.sections.map((s) =>
        s.id === sId ? { ...s, groups: s.groups.filter((g) => g.id !== gId) } : s
      ),
    });
  }
  function updateGroupItems(sId: string, gId: string, v: string) {
    patch({
      sections: t.sections.map((s) =>
        s.id === sId
          ? { ...s, groups: s.groups.map((g) => (g.id === gId ? { ...g, items: v } : g)) }
          : s
      ),
    });
  }
  function updateGroupAction(sId: string, gId: string, v: string) {
    patch({
      sections: t.sections.map((s) =>
        s.id === sId
          ? { ...s, groups: s.groups.map((g) => (g.id === gId ? { ...g, action: v } : g)) }
          : s
      ),
    });
  }

  const ih = t.itemsHeader || "Pozycja";
  const ah = t.actionHeader || "Działanie";

  return (
    <div className="space-y-3 rounded-lg border border-[#dde5ee] bg-[#f8fafc] p-3 dark:border-[#334155] dark:bg-[#111827]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#374151] dark:text-[#cbd5e1]">Tabela szczegółów</span>
        <button type="button" onClick={() => onChange(undefined)} className="text-[10px] text-[#ef4444] hover:underline">
          Usuń tabelę
        </button>
      </div>

      <div>
        <label className={labelCls}>Tytuł tabeli (opcjonalny)</label>
        <input
          type="text"
          value={t.title ?? ""}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="np. Kontakty według rejonu dystrybucji"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Uwagi / przypis (widoczne nad tabelą)</label>
        <textarea
          value={t.notes ?? ""}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="np. 1) numer czynny całą dobę"
          rows={2}
          className="w-full resize-none rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-xs text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
        />
      </div>

      <div>
        <label className={labelCls}>Nagłówki kolumn (opcjonalne)</label>
        <div className="grid grid-cols-3 gap-1.5">
          <input
            type="text"
            value={t.sectionHeader ?? ""}
            onChange={(e) => patch({ sectionHeader: e.target.value })}
            placeholder="Sekcja"
            className="h-8 rounded-lg border border-[#d1d5db] bg-white px-2 text-xs text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
          />
          <input
            type="text"
            value={t.itemsHeader ?? ""}
            onChange={(e) => patch({ itemsHeader: e.target.value })}
            placeholder="Pozycja"
            className="h-8 rounded-lg border border-[#d1d5db] bg-white px-2 text-xs text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
          />
          <input
            type="text"
            value={t.actionHeader ?? ""}
            onChange={(e) => patch({ actionHeader: e.target.value })}
            placeholder="Działanie"
            className="h-8 rounded-lg border border-[#d1d5db] bg-white px-2 text-xs text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9]"
          />
        </div>
        <p className="mt-1 text-[10px] text-[#94a3b8]">Sekcja · Pozycja/rejon · Działanie</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={labelCls}>Sekcje</label>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-0.5 rounded border border-[#d1d5db] px-1.5 py-0.5 text-[10px] font-medium text-[#374151] transition hover:bg-white dark:border-[#334155] dark:text-[#94a3b8]"
          >
            <Plus size={9} /> Sekcja
          </button>
        </div>
        {t.sections.length === 0 ? (
          <p className="text-[11px] text-[#9ca3af] dark:text-[#475569]">
            Brak sekcji. Kliknij „+ Sekcja" aby dodać pierwszą.
          </p>
        ) : (
          <div className="space-y-1.5">
            {t.sections.map((section) => (
              <SectionEditor
                key={section.id}
                section={section}
                itemsHeader={ih}
                actionHeader={ah}
                onUpdateLabel={(v) => updateSectionLabel(section.id, v)}
                onAddGroup={() => addGroup(section.id)}
                onUpdateGroupItems={(gId, v) => updateGroupItems(section.id, gId, v)}
                onUpdateGroupAction={(gId, v) => updateGroupAction(section.id, gId, v)}
                onRemoveGroup={(gId) => removeGroup(section.id, gId)}
                onRemove={() => removeSection(section.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Side-panel form ──────────────────────────────────────────────

function ContactForm({
  editing,
  onSave,
  onCancel,
  busy = false,
  disableSubmit = false,
}: {
  editing: ContactEntry | null;
  onSave: (draft: Draft) => void | Promise<void>;
  onCancel: () => void;
  busy?: boolean;
  disableSubmit?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(
    editing ? draftFromEntry(editing) : blankDraft()
  );

  function field<K extends keyof Draft>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setDraft((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    void onSave({
      ...draft,
      title: draft.title.trim(),
      description: draft.description?.trim() || "",
      phone: draft.phone?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      address: draft.address?.trim() || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label className={labelCls}>Nazwa / tytuł *</label>
        <input
          autoFocus
          type="text"
          value={draft.title}
          onChange={field("title")}
          placeholder="np. Dział wsparcia"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Opis / rola</label>
        <input
          type="text"
          value={draft.description ?? ""}
          onChange={field("description")}
          placeholder="np. Obsługa zgłoszeń klientów"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Telefon</label>
          <input
            type="text"
            value={draft.phone ?? ""}
            onChange={field("phone")}
            placeholder="np. +48 800 123 456"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>E-mail</label>
          <input
            type="email"
            value={draft.email ?? ""}
            onChange={field("email")}
            placeholder="np. wsparcie@firma.pl"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Adres korespondencyjny</label>
        <textarea
          value={draft.address ?? ""}
          onChange={field("address")}
          placeholder="np. ul. Elektryczna 10, 60-001 Poznań"
          rows={2}
          className="w-full resize-none rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
        />
      </div>

      <DetailTableEditor
        value={draft.detailTable}
        onChange={(t) => setDraft((d) => ({ ...d, detailTable: t }))}
      />

      <div>
        <label className={labelCls}>Grupa</label>
        <select value={draft.group} onChange={field("group")} className={inputCls}>
          {GROUP_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy || disableSubmit || !draft.title.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 text-sm font-medium text-white transition hover:bg-[#1a4580] disabled:opacity-40"
        >
          {editing ? "Zapisz zmiany" : "Dodaj kontakt"}
        </button>
        {editing && (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-[#d1d5db] px-3 text-sm text-[#6b7280] transition hover:bg-[#f9fafb] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
          >
            Anuluj
          </button>
        )}
      </div>
    </form>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────────────────────

export default function ContactList() {
  const { contacts, contactsModule } = useData();
  const { push: toast } = useToast();
  const {
    source,
    isLoading,
    isMutating,
    error: moduleError,
    canWrite,
    canReorder,
    createContact,
    editContact,
    removeContact,
    reorderContacts: applyContactOrder,
  } = contactsModule;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sorted = [...contacts].sort((a, b) => a.sortOrder - b.sortOrder);
  const editingEntry = editingId ? (contacts.find((c) => c.id === editingId) ?? null) : null;

  // ── Reorder ────────────────────────────────────────────────────────────────────────────────────

  const move = useCallback(
    (id: string, dir: -1 | 1) => {
      if (!canReorder) return;

      const list = [...sorted];
      const idx = list.findIndex((c) => c.id === id);
      const target = idx + dir;
      if (target < 0 || target >= list.length) return;
      [list[idx], list[target]] = [list[target], list[idx]];
      applyContactOrder(list);
    },
    [applyContactOrder, canReorder, sorted]
  );

  // ── Save handlers ─────────────────────────────────────────────────────────────────────────────

  const handleAdd = useCallback(
    async (draft: Draft) => {
      try {
        await createContact({
          title: draft.title,
          description: draft.description ?? "",
          phone: draft.phone ?? null,
          email: draft.email ?? null,
          address: draft.address ?? null,
          detailTable: draft.detailTable ?? null,
          group: draft.group,
        });
        toast("success", `Kontakt „${draft.title}” został dodany.`);
      } catch (caught) {
        toast(
          "error",
          caught instanceof Error
            ? caught.message
            : "Nie udało się dodać kontaktu. Sprawdź pola formularza i spróbuj ponownie."
        );
      }
    },
    [createContact, source, toast]
  );

  const handleUpdate = useCallback(
    async (draft: Draft) => {
      if (!editingEntry) return;

      try {
        await editContact(editingEntry.id, {
          title: draft.title,
          description: draft.description ?? "",
          phone: draft.phone ?? null,
          email: draft.email ?? null,
          address: draft.address ?? null,
          detailTable: draft.detailTable ?? null,
          group: draft.group,
        });
        setEditingId(null);
        toast("success", `Kontakt „${draft.title}” został zapisany.`);
      } catch (caught) {
        toast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się zapisać zmian kontaktu. Spróbuj ponownie."
        );
      }
    },
    [editContact, editingEntry, source, toast]
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      try {
        await removeContact(id);
        setPendingDeleteId(null);
        if (editingId === id) setEditingId(null);
        toast("success", `Kontakt „${title}” został usunięty.`);
      } catch (caught) {
        toast(
          "error",
          caught instanceof Error ? caught.message : "Nie udało się usunąć kontaktu. Spróbuj ponownie."
        );
      }
    },
    [editingId, removeContact, source, toast]
  );

  function startEdit(entry: ContactEntry) {
    setEditingId(entry.id);
    setPendingDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
      {/* Contact list */}
      <div className="overflow-hidden rounded-xl border border-[#dde5ee] dark:border-[#1e3a5f]">
        <div className="border-b border-[#f1f5f9] bg-[#f8fafc] px-5 py-4 dark:border-[#1e293b] dark:bg-[#111827]">
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
            Dane kontaktowe
          </h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            {contacts.length}{" "}
            {contacts.length === 1 ? "wpis" : "wpisów"}
            {canReorder ? " • kolejność można zmieniać przeciąganiem." : null}
          </p>
        </div>

        {moduleError && (
          <div className="border-b border-[#fecaca] bg-[#fff5f5] px-5 py-3 text-xs text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
            {moduleError}
          </div>
        )}

        {contacts.length === 0 && !isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-[#9ca3af] dark:text-[#64748b]">
            Brak kontaktów. Użyj formularza po prawej, aby dodać pierwszy wpis.
          </p>
        ) : isLoading ? (
          <p className="px-5 py-8 text-center text-sm text-[#64748b] dark:text-[#94a3b8]">
            Ładowanie kontaktów…
          </p>
        ) : (
          <div className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
            {sorted.map((entry, idx) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  editingId === entry.id
                    ? "bg-[#f0f6ff] dark:bg-[#0f2340]"
                    : "bg-white hover:bg-[#f8fafc] dark:bg-[#0d1b2e] dark:hover:bg-[#0f2340]"
                }`}
              >
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(entry.id, -1)}
                    disabled={idx === 0 || !canReorder || isMutating}
                    className="rounded p-0.5 text-[#94a3b8] transition hover:text-[#374151] disabled:opacity-25 dark:hover:text-[#e2e8f0]"
                    title="Przesuń wyżej"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(entry.id, 1)}
                    disabled={idx === sorted.length - 1 || !canReorder || isMutating}
                    className="rounded p-0.5 text-[#94a3b8] transition hover:text-[#374151] disabled:opacity-25 dark:hover:text-[#e2e8f0]"
                    title="Przesuń niżej"
                  >
                    <ChevronDown size={13} />
                  </button>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                    {entry.title}
                  </p>
                  {entry.description && (
                    <p className="truncate text-xs text-[#64748b] dark:text-[#94a3b8]">
                      {entry.description}
                    </p>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
                    {entry.phone && (
                      <span className="font-mono text-[#1d4f91] dark:text-[#60a5fa]">
                        {entry.phone}
                      </span>
                    )}
                    {entry.email && (
                      <span className="text-[#374151] dark:text-[#cbd5e1]">{entry.email}</span>
                    )}
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    entry.group === "wewnetrzne"
                      ? "bg-[#e9f2ff] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#60a5fa]"
                      : "bg-[#f0fdf4] text-[#15803d] dark:bg-[#14532d]/20 dark:text-[#4ade80]"
                  }`}
                >
                  {entry.group === "wewnetrzne" ? "Wewnętrzne" : "Zewnętrzne"}
                </span>

                <div className="shrink-0">
                  {pendingDeleteId === entry.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-[#dc2626] dark:text-[#f87171]">Usunąć ten kontakt?</span>
                      <button
                        type="button"
                        disabled={isMutating || !canWrite}
                        onClick={() => { void handleDelete(entry.id, entry.title); }}
                        className="text-xs font-semibold text-[#dc2626] hover:underline dark:text-[#f87171]"
                      >
                        Potwierdź
                      </button>
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => setPendingDeleteId(null)}
                        className="text-xs font-medium text-[#374151] hover:underline dark:text-[#94a3b8]"
                      >
                        Anuluj
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isMutating || !canWrite}
                        onClick={() => startEdit(entry)}
                        className="text-xs font-medium text-[#1d4f91] hover:underline disabled:opacity-40 dark:text-[#60a5fa]"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        disabled={isMutating || !canWrite}
                        onClick={() => setPendingDeleteId(entry.id)}
                        className="text-xs font-medium text-[#ef4444] hover:underline disabled:opacity-40 dark:text-[#f87171]"
                      >
                        Usuń
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form panel */}
      <div className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <h3 className="mb-4 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          {editingEntry ? "Edycja kontaktu" : "Nowy kontakt"}
        </h3>
        {/* key resets the form draft when switching between create / edit */}
        <ContactForm
          key={editingId ?? "__new__"}
          editing={editingEntry}
          onSave={editingEntry ? handleUpdate : handleAdd}
          onCancel={cancelEdit}
          busy={isMutating}
          disableSubmit={!canWrite}
        />
      </div>
    </div>
  );
}
