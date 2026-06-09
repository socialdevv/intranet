import { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import type { PhraseEntry } from "@/lib/types/domain";

// ── Style helpers ─────────────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded-lg border border-[#d1d5db] bg-white px-3 text-sm text-[#374151] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]";

const labelCls =
  "mb-1 block text-xs font-medium text-[#374151] dark:text-[#cbd5e1]";

// ── Draft type ────────────────────────────────────────────────────────────────

type Draft = { title: string; content: string; requiresConfirmation: boolean };

function blankDraft(): Draft {
  return { title: "", content: "", requiresConfirmation: false };
}

function draftFromEntry(e: PhraseEntry): Draft {
  return { title: e.title, content: e.content, requiresConfirmation: e.requiresConfirmation ?? false };
}

// ── Side-panel form ───────────────────────────────────────────────────────────

function PhraseForm({
  editing,
  onSave,
  onCancel,
  disabled,
}: {
  editing: PhraseEntry | null;
  onSave: (draft: Draft) => void | Promise<void>;
  onCancel: () => void;
  disabled: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(
    editing ? draftFromEntry(editing) : blankDraft()
  );
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) { setError("Tytu\u0142 jest wymagany."); return; }
    if (!draft.content.trim()) { setError("Tre\u015b\u0107 jest wymagana."); return; }
    onSave({ title: draft.title.trim(), content: draft.content.trim(), requiresConfirmation: draft.requiresConfirmation });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label className={labelCls}>Tytuł *</label>
        <input
          autoFocus
          type="text"
          disabled={disabled}
          value={draft.title}
          onChange={(e) => { setDraft((d) => ({ ...d, title: e.target.value })); setError(""); }}
          placeholder="np. Otwarcie eBOK — pierwsze logowanie"
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>Treść zwrotu *</label>
        <textarea
          disabled={disabled}
          value={draft.content}
          onChange={(e) => { setDraft((d) => ({ ...d, content: e.target.value })); setError(""); }}
          placeholder="Wpisz gotowy zwrot, który konsultant odczyta klientowi…"
          rows={8}
          className="w-full resize-y rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#374151] placeholder:text-[#b0bac9] outline-none focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 dark:border-[#334155] dark:bg-[#1e293b] dark:text-[#f1f5f9] dark:placeholder:text-[#475569]"
        />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 dark:border-[#78350f]/60 dark:bg-[#78350f]/20">
        <input
          id="requires-confirmation"
          type="checkbox"
          disabled={disabled}
          checked={draft.requiresConfirmation}
          onChange={(e) => setDraft((d) => ({ ...d, requiresConfirmation: e.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#d97706]"
        />
        <label htmlFor="requires-confirmation" className="cursor-pointer select-none text-xs leading-snug text-[#92400e] dark:text-[#fcd34d]">
          <span className="font-semibold">Wymagane potwierdzenie TAK / NIE</span>
          <br />
          <span className="opacity-80">Wyświetli ostrzeżenie konsultantowi, że klient musi jednoznacznie potwierdzić.</span>
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#ef4444]">{error}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={disabled}
          className="h-9 flex-1 rounded-lg bg-[#1d4f91] text-xs font-medium text-white transition hover:bg-[#1a4580]"
        >
          {editing ? "Zapisz zmiany" : "Dodaj zwrot"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="h-9 rounded-lg border border-[#d1d5db] px-4 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9] dark:border-[#334155] dark:text-[#94a3b8] dark:hover:bg-[#1e293b]"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

// ── Main admin component ──────────────────────────────────────────────────────

export default function PhraseList() {
  const { phrases, phrasesModule } = useData();
  const { push: toast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const sorted = [...phrases].sort((a, b) => a.sortOrder - b.sortOrder);
  const editing = editingId ? (phrases.find((p) => p.id === editingId) ?? null) : null;
  const canWrite = phrasesModule.canWrite && !phrasesModule.isMutating;
  const canReorder = phrasesModule.canReorder && canWrite;

  function startNew() {
    if (!phrasesModule.canWrite) return;
    setEditingId(null);
    setShowNew(true);
    setPendingDeleteId(null);
  }

  function startEdit(phrase: PhraseEntry) {
    if (!phrasesModule.canWrite) return;
    setEditingId(phrase.id);
    setShowNew(false);
    setPendingDeleteId(null);
  }

  function cancelForm() {
    setEditingId(null);
    setShowNew(false);
  }

  async function handleSave(draft: Draft) {
    try {
      if (editing) {
        await phrasesModule.editPhrase(editing.id, {
          title: draft.title,
          content: draft.content,
          requiresConfirmation: draft.requiresConfirmation,
        });
        toast("success", `Zwrot \u201e${draft.title}\u201d zaktualizowany.`);
      } else {
        await phrasesModule.createPhrase({
          title: draft.title,
          content: draft.content,
          requiresConfirmation: draft.requiresConfirmation,
        });
        toast("success", `Zwrot \u201e${draft.title}\u201d dodany.`);
      }

      cancelForm();
    } catch (caught) {
      toast("error", caught instanceof Error ? caught.message : "Nie udało się zapisać zwrotu.");
    }
  }

  function requestDelete(id: string) {
    if (editingId === id) cancelForm();
    setPendingDeleteId(id);
  }

  async function confirmDelete(phrase: PhraseEntry) {
    try {
      await phrasesModule.removePhrase(phrase.id);
      setPendingDeleteId(null);
      toast("success", `Zwrot \u201e${phrase.title}\u201d usuni\u0119ty.`);
    } catch (caught) {
      toast("error", caught instanceof Error ? caught.message : "Nie udało się usunąć zwrotu.");
    }
  }

  function move(idx: number, dir: -1 | 1) {
    if (!canReorder) return;

    const next = [...sorted];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    phrasesModule.reorderPhrases(next);
  }

  const panelTitle = editing ? "Edycja zwrotu" : "Nowy zwrot";
  const showPanel = showNew || !!editing;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* List */}
      <div className="rounded-xl border border-[#dde5ee] bg-white dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <div className="flex items-center justify-between border-b border-[#f1f5f9] px-5 py-4 dark:border-[#1e293b]">
          <div>
            <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Gotowe zwroty</h2>
            <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
              {phrases.length} {phrases.length === 1 ? "zwrot" : phrases.length <= 4 ? "zwroty" : "zwrot\u00f3w"}
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            disabled={!canWrite}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1d4f91] px-3 text-xs font-medium text-white transition hover:bg-[#1a4580] disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nowy zwrot
          </button>
        </div>

        {phrasesModule.error && (
          <div className="border-b border-[#f1f5f9] bg-[#fff5f5] px-5 py-3 text-xs text-[#b91c1c] dark:border-[#1e293b] dark:bg-[#2a0f12] dark:text-[#fca5a5]">
            {phrasesModule.error}
          </div>
        )}

        {!phrasesModule.canReorder && (
          <div className="border-b border-[#f1f5f9] bg-[#f8fafc] px-5 py-3 text-xs text-[#64748b] dark:border-[#1e293b] dark:bg-[#1a2535] dark:text-[#94a3b8]">
            Zmiana kolejności jest tymczasowo niedostępna. Dodawanie, edycja i usuwanie działają normalnie.
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[#9ca3af] dark:text-[#475569]">
          Brak zwrotów. Użyj formularza aby dodać pierwszy.
          </p>
        ) : (
          <div className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
            {sorted.map((phrase, idx) => (
              <div
                key={phrase.id}
                className={`flex items-center gap-3 px-5 py-3 transition ${
                  editingId === phrase.id ? "bg-[#f0f5ff] dark:bg-[#0f2340]" : "hover:bg-[#f8fafc] dark:hover:bg-[#111827]"
                }`}
              >
                {/* Reorder buttons */}
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || !canReorder}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                    aria-label="Przesuń w górę"
                  >
                    <ChevronUp size={10} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === sorted.length - 1 || !canReorder}
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                    aria-label="Przesuń w dół"
                  >
                    <ChevronDown size={10} />
                  </button>
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827] dark:text-[#f1f5f9]">
                    {phrase.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[#94a3b8]">
                    {phrase.content.length > 80 ? phrase.content.slice(0, 80) + "\u2026" : phrase.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  {pendingDeleteId === phrase.id ? (
                    <>
                      <span className="text-xs text-[#ef4444]">Usunąć?</span>
                      <button
                        type="button"
                        onClick={() => confirmDelete(phrase)}
                        disabled={!canWrite}
                        className="text-xs font-semibold text-[#ef4444] hover:underline"
                      >
                        Potwierdź
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteId(null)}
                        className="text-xs font-medium text-[#374151] hover:underline dark:text-[#94a3b8]"
                      >
                        Anuluj
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(phrase)}
                        disabled={!canWrite}
                        className="text-xs font-medium text-[#1d4f91] hover:underline dark:text-[#60a5fa]"
                      >
                        Edytuj
                      </button>
                      <button
                        type="button"
                        onClick={() => requestDelete(phrase.id)}
                        disabled={!canWrite}
                        className="text-xs font-medium text-[#ef4444] hover:underline"
                      >
                        Usuń
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form panel */}
      <div className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#1e3a5f] dark:bg-[#0d1b2e]">
        <h2 className="mb-4 text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          {showPanel ? panelTitle : "Nowy zwrot"}
        </h2>
        {showPanel ? (
          <PhraseForm
            key={editingId ?? "__new__"}
            editing={editing}
            onSave={handleSave}
            onCancel={cancelForm}
            disabled={!canWrite}
          />
        ) : (
          <p className="py-10 text-center text-sm text-[#94a3b8] dark:text-[#475569]">
            Wybierz zwrot z listy, aby go edytować, lub kliknij <strong>+ Nowy zwrot</strong>.
          </p>
        )}

      </div>
    </div>
  );
}
