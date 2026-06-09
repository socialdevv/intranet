import { useEffect, useMemo, useState } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Table2, ListTree } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import PersistenceStateBanner from "@/components/admin/persistence-state-banner";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditContent } from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";
import { generateId, isBlank } from "@/lib/utils";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import type {
  CennikSection,
  CennikTableSection,
  CennikChargesSection,
  CennikColumn,
  CennikRow,
  CennikChargeItem,
  CennikChargeVariant,
} from "@/lib/types/domain";

// ── Style constants ─────────────────────────────────────────────

const fieldCls =
  "w-full rounded-xl border border-[#d9e2ec] bg-white px-3 py-2.5 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20";

const smallInputCls =
  "w-full rounded-lg border border-[#d9e2ec] bg-white px-2 py-1.5 text-xs text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-1 focus:ring-[#1d4f91]/20";

const labelCls = "mb-1.5 block text-xs font-semibold text-[#374151]";

const iconBtnCls =
  "flex items-center justify-center rounded-lg p-1.5 text-[#9ca3af] transition hover:bg-[#f1f5f9] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-30";

const addRowBtnCls =
  "flex items-center gap-1 rounded-lg border border-dashed border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] transition hover:border-[#1d4f91] hover:text-[#1d4f91]";

// ── Table section editor ───────────────────────────────────────────────

function TableSectionEditor({
  section,
  onChange,
}: {
  section: CennikTableSection;
  onChange: (s: CennikTableSection) => void;
}) {
  function addColumn() {
    const key = `col_${Date.now()}`;
    const newCols: CennikColumn[] = [...section.columns, { key, label: "" }];
    const newRows: CennikRow[] = section.rows.map((r) => ({
      ...r,
      values: { ...r.values, [key]: "" },
    }));
    onChange({ ...section, columns: newCols, rows: newRows });
  }

  function removeColumn(colKey: string) {
    const newCols = section.columns.filter((c) => c.key !== colKey);
    const newRows = section.rows.map((r) => {
      const values = { ...r.values };
      delete values[colKey];
      return { ...r, values };
    });
    onChange({ ...section, columns: newCols, rows: newRows });
  }

  function setColumnLabel(colKey: string, label: string) {
    onChange({
      ...section,
      columns: section.columns.map((c) => (c.key === colKey ? { ...c, label } : c)),
    });
  }

  function addRow() {
    const values: Record<string, string> = {};
    for (const col of section.columns) values[col.key] = "";
    const newRow: CennikRow = { id: generateId("row"), label: "", values };
    onChange({ ...section, rows: [...section.rows, newRow] });
  }

  function removeRow(id: string) {
    onChange({ ...section, rows: section.rows.filter((r) => r.id !== id) });
  }

  function setRowField(id: string, field: keyof CennikRow, val: string) {
    onChange({
      ...section,
      rows: section.rows.map((r) =>
        r.id === id ? { ...r, [field]: val } : r
      ),
    });
  }

  function setRowValue(id: string, colKey: string, val: string) {
    onChange({
      ...section,
      rows: section.rows.map((r) =>
        r.id === id ? { ...r, values: { ...r.values, [colKey]: val } } : r
      ),
    });
  }

  function moveRow(id: string, dir: "up" | "down") {
    const idx = section.rows.findIndex((r) => r.id === id);
    if (idx === -1) return;
    const ni = dir === "up" ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= section.rows.length) return;
    const rows = [...section.rows];
    [rows[idx], rows[ni]] = [rows[ni], rows[idx]];
    onChange({ ...section, rows });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label className={labelCls}>Tytuł sekcji</label>
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="np. Opłata dystrybucyjna zmienna"
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Jednostka</label>
          <input
            value={section.unit}
            onChange={(e) => onChange({ ...section, unit: e.target.value })}
            placeholder="np. zł/kWh"
            className={fieldCls}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Opis (opcjonalnie)</label>
        <input
          value={section.description ?? ""}
          onChange={(e) =>
            onChange({ ...section, description: e.target.value || undefined })
          }
          placeholder="Krótki opis…"
          className={fieldCls}
        />
      </div>

      <div>
        <label className={labelCls}>Kolumny</label>
        <div className="flex flex-wrap gap-2">
          {section.columns.map((col) => (
            <div
              key={col.key}
              className="flex items-center gap-1 rounded-lg border border-[#e2e8f0] bg-[#f8fafc] px-1.5 py-1"
            >
              <input
                value={col.label}
                onChange={(e) => setColumnLabel(col.key, e.target.value)}
                placeholder="Nazwa kolumny"
                className="w-28 rounded bg-transparent px-1 py-0 text-xs text-[#0f172a] placeholder:text-[#9ca3af] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeColumn(col.key)}
                className="flex items-center justify-center rounded p-0.5 text-[#9ca3af] hover:bg-[#fee2e2] hover:text-[#dc2626] transition"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
          <button type="button" onClick={addColumn} className={addRowBtnCls}>
            <Plus size={11} />
            Dodaj kolumnę
          </button>
        </div>
      </div>

      {section.rows.length === 0 && section.columns.length === 0 ? (
        <p className="text-xs italic text-[#9ca3af]">
          Dodaj kolumny, a następnie wiersze.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#e2e8f0]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#f8fafc]">
                <th className="border-b border-r border-[#e2e8f0] px-3 py-2 text-left font-semibold text-[#374151]" style={{ minWidth: "160px" }}>
                  Nazwa
                </th>
                <th className="border-b border-r border-[#e2e8f0] px-2 py-2 text-left font-semibold text-[#374151]" style={{ minWidth: "70px" }}>
                  Symbol
                </th>
                {section.columns.map((col) => (
                  <th
                    key={col.key}
                    className="border-b border-r border-[#e2e8f0] px-3 py-2 text-right font-semibold text-[#374151] whitespace-nowrap"
                    style={{ minWidth: "90px" }}
                  >
                    {col.label || "?"}
                  </th>
                ))}
                <th className="border-b border-[#e2e8f0] px-2 py-2 text-center font-semibold text-[#374151]" style={{ minWidth: "76px" }}>
                  Akcje
                </th>
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, ri) => (
                <tr key={row.id} className={ri % 2 === 0 ? "bg-white" : "bg-[#fafbfc]"}>
                  <td className="border-b border-r border-[#e2e8f0] px-2 py-1.5">
                    <input
                      value={row.label}
                      onChange={(e) => setRowField(row.id, "label", e.target.value)}
                      placeholder="Nazwa opłaty…"
                      className={smallInputCls}
                    />
                  </td>
                  <td className="border-b border-r border-[#e2e8f0] px-2 py-1.5">
                    <input
                      value={row.symbol ?? ""}
                      onChange={(e) => setRowField(row.id, "symbol", e.target.value)}
                      placeholder="–"
                      className={smallInputCls}
                    />
                  </td>
                  {section.columns.map((col) => (
                    <td key={col.key} className="border-b border-r border-[#e2e8f0] px-2 py-1.5">
                      <input
                        value={row.values[col.key] ?? ""}
                        onChange={(e) => setRowValue(row.id, col.key, e.target.value)}
                        placeholder="—"
                        className={`${smallInputCls} text-right font-mono`}
                      />
                    </td>
                  ))}
                  <td className="border-b border-[#e2e8f0] px-2 py-1.5">
                    <div className="flex items-center justify-center gap-0.5">
                      <button type="button" onClick={() => moveRow(row.id, "up")} disabled={ri === 0} className={iconBtnCls}>
                        <ChevronUp size={12} />
                      </button>
                      <button type="button" onClick={() => moveRow(row.id, "down")} disabled={ri === section.rows.length - 1} className={iconBtnCls}>
                        <ChevronDown size={12} />
                      </button>
                      <button type="button" onClick={() => removeRow(row.id)} className={`${iconBtnCls} hover:bg-[#fee2e2] hover:text-[#dc2626]`}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.columns.length > 0 && (
        <button type="button" onClick={addRow} className={addRowBtnCls}>
          <Plus size={11} />
          Dodaj wiersz
        </button>
      )}

      <div>
        <label className={labelCls}>Uwagi (jedna per linia, opcjonalnie)</label>
        <textarea
          value={(section.footnotes ?? []).join("\n")}
          onChange={(e) =>
            onChange({
              ...section,
              footnotes: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
          rows={2}
          placeholder="np. Strefa szczytowa: 7:00–13:00 oraz 15:00–22:00 w dni robocze."
          className={`${fieldCls} resize-y`}
        />
      </div>
    </div>
  );
}

// ── Charges section editor ────────────────────────────────────────────────────

function ChargeVariantRow({
  variant,
  onChange,
  onRemove,
  isOnly,
}: {
  variant: CennikChargeVariant;
  onChange: (v: CennikChargeVariant) => void;
  onRemove: () => void;
  isOnly: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
      <input
        value={variant.conditions}
        onChange={(e) => onChange({ ...variant, conditions: e.target.value })}
        placeholder="np. G11, 1-fazowy"
        className={smallInputCls}
      />
      <input
        value={variant.value}
        onChange={(e) => onChange({ ...variant, value: e.target.value })}
        placeholder="np. 5,21"
        className={`${smallInputCls} text-right font-mono`}
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={isOnly}
        className={`${iconBtnCls} hover:bg-[#fee2e2] hover:text-[#dc2626]`}
        title="Usuń wariant"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function ChargeItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: CennikChargeItem;
  onChange: (i: CennikChargeItem) => void;
  onRemove: () => void;
}) {
  function addVariant() {
    const v: CennikChargeVariant = {
      id: generateId("v"),
      conditions: "",
      value: "",
    };
    onChange({ ...item, variants: [...item.variants, v] });
  }

  function removeVariant(vid: string) {
    onChange({ ...item, variants: item.variants.filter((v) => v.id !== vid) });
  }

  function updateVariant(updated: CennikChargeVariant) {
    onChange({
      ...item,
      variants: item.variants.map((v) => (v.id === updated.id ? updated : v)),
    });
  }

  return (
    <div className="rounded-xl border border-[#e2e8f0] bg-white p-4">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
          <div>
            <label className={labelCls}>Nazwa opłaty</label>
            <input
              value={item.name}
              onChange={(e) => onChange({ ...item, name: e.target.value })}
              placeholder="np. Opłata stała sieciowa"
              className={smallInputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Jednostka</label>
            <input
              value={item.unit}
              onChange={(e) => onChange({ ...item, unit: e.target.value })}
              placeholder="np. zł/miesiąc"
              className={smallInputCls}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={`${iconBtnCls} mt-6 hover:bg-[#fee2e2] hover:text-[#dc2626] shrink-0`}
          title="Usuń opłatę"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="space-y-2 pl-0">
        <div className="grid grid-cols-[1fr_120px_auto] gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#94a3b8]">
          <span>Warunki (taryfa / faza / przedział)</span>
          <span className="text-right">Wartość</span>
          <span />
        </div>
        {item.variants.map((v) => (
          <ChargeVariantRow
            key={v.id}
            variant={v}
            onChange={updateVariant}
            onRemove={() => removeVariant(v.id)}
            isOnly={item.variants.length === 1}
          />
        ))}
        <button type="button" onClick={addVariant} className={addRowBtnCls}>
          <Plus size={11} />
          Dodaj wariant
        </button>
      </div>
    </div>
  );
}

function ChargesSectionEditor({
  section,
  onChange,
}: {
  section: CennikChargesSection;
  onChange: (s: CennikChargesSection) => void;
}) {
  function addItem() {
    const item: CennikChargeItem = {
      id: generateId("charge"),
      name: "",
      unit: "zł/miesiąc",
      variants: [{ id: generateId("v"), conditions: "", value: "" }],
    };
    onChange({ ...section, items: [...section.items, item] });
  }

  function removeItem(id: string) {
    onChange({ ...section, items: section.items.filter((i) => i.id !== id) });
  }

  function updateItem(updated: CennikChargeItem) {
    onChange({
      ...section,
      items: section.items.map((i) => (i.id === updated.id ? updated : i)),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className={labelCls}>Tytuł sekcji</label>
          <input
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            placeholder="np. Opłaty dystrybucyjne stałe"
            className={fieldCls}
          />
        </div>
        <div>
          <label className={labelCls}>Opis (opcjonalnie)</label>
          <input
            value={section.description ?? ""}
            onChange={(e) =>
              onChange({ ...section, description: e.target.value || undefined })
            }
            placeholder="Krótki opis…"
            className={fieldCls}
          />
        </div>
      </div>

      <div className="space-y-3">
        {section.items.length === 0 ? (
          <p className="text-xs italic text-[#9ca3af]">Dodaj pierwszą opłatę.</p>
        ) : (
          section.items.map((item) => (
            <ChargeItemCard
              key={item.id}
              item={item}
              onChange={updateItem}
              onRemove={() => removeItem(item.id)}
            />
          ))
        )}
        <button type="button" onClick={addItem} className={addRowBtnCls}>
          <Plus size={11} />
          Dodaj opłatę
        </button>
      </div>

      <div>
        <label className={labelCls}>Uwagi (jedna per linia, opcjonalnie)</label>
        <textarea
          value={(section.footnotes ?? []).join("\n")}
          onChange={(e) =>
            onChange({
              ...section,
              footnotes: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
          rows={2}
          placeholder="np. Opłaty dotyczą strefy rozliczeniowej grupy G."
          className={`${fieldCls} resize-y`}
        />
      </div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────────────

function SectionWrapper({
  section,
  index,
  total,
  onChange,
  onDelete,
  onMove,
}: {
  section: CennikSection;
  index: number;
  total: number;
  onChange: (s: CennikSection) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const isTable = section.type === "table";

  return (
    <div className="rounded-xl border border-[#dde5ee] bg-[#fafbfc] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            isTable
              ? "bg-[#eff6ff] text-[#1d4f91]"
              : "bg-[#fef3c7] text-[#92400e]"
          }`}
        >
          {isTable ? <Table2 size={11} /> : <ListTree size={11} />}
          {isTable ? "Tabela cenowa" : "Opłaty wariantowe"}
        </span>
        <span className="text-xs text-[#94a3b8]">Sekcja {index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => onMove("up")} disabled={index === 0} className={iconBtnCls} title="W górę">
            <ChevronUp size={14} />
          </button>
          <button type="button" onClick={() => onMove("down")} disabled={index === total - 1} className={iconBtnCls} title="W dół">
            <ChevronDown size={14} />
          </button>
          <button type="button" onClick={onDelete} className={`${iconBtnCls} hover:bg-[#fee2e2] hover:text-[#dc2626]`} title="Usuń sekcję">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isTable ? (
        <TableSectionEditor
          section={section as CennikTableSection}
          onChange={(s) => onChange(s)}
        />
      ) : (
        <ChargesSectionEditor
          section={section as CennikChargesSection}
          onChange={(s) => onChange(s)}
        />
      )}
    </div>
  );
}

// ── Main editor page ─────────────────────────────────────────────────────────────────

export default function CennikiEditorPage() {
  const { cennikId } = useParams<{ cennikId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cenniki, cennikiModule } = useData();
  const { push: pushToast } = useToast();
  const {
    source,
    isLoading: isCennikiLoading,
    isMutating,
    error: moduleError,
    canWrite,
    createCennik,
    editCennik,
  } = cennikiModule;
  const apiMode = source === "api";

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  const isNew = cennikId === "nowy";
  const existing = isNew ? null : cenniki.documents.find((c) => c.id === cennikId);

  if (!isNew && apiMode && isCennikiLoading && !existing) {
    return (
      <AppShell currentUser={user}>
        <section className="mx-auto w-full max-w-240 pb-12">
          <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.cenniki)}
                className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
              >
                <ArrowLeft size={16} />
                Cenniki
              </button>
            </div>
          </header>

          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86]">
            Ładowanie cennika z backendu…
          </div>
        </section>
      </AppShell>
    );
  }

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.cenniki} replace />;
  }

  const [title, setTitle] = useState(existing?.title ?? "");
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? "");
  const [provider, setProvider] = useState(existing?.provider ?? "");
  const [effectiveFrom, setEffectiveFrom] = useState(
    existing?.effectiveFrom?.slice(0, 10) ?? ""
  );
  const [status, setStatus] = useState<"active" | "archived">(
    existing?.status ?? "active"
  );
  const [globalFootnotes, setGlobalFootnotes] = useState(
    (existing?.footnotes ?? []).join("\n")
  );
  const [sections, setSections] = useState<CennikSection[]>(
    existing?.sections ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pageTitle = isNew ? "Nowy cennik" : "Edytuj cennik";

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        subtitle: existing?.subtitle ?? "",
        provider: existing?.provider ?? "",
        effectiveFrom: existing?.effectiveFrom?.slice(0, 10) ?? "",
        status: existing?.status ?? "active",
        globalFootnotes: (existing?.footnotes ?? []).join("\n"),
        sections: existing?.sections ?? [],
      }),
    [existing?.id],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        subtitle,
        provider,
        effectiveFrom,
        status,
        globalFootnotes,
        sections,
      }),
    [title, subtitle, provider, effectiveFrom, status, globalFootnotes, sections],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving || isMutating,
  });

  useEffect(() => {
    setTitle(existing?.title ?? "");
    setSubtitle(existing?.subtitle ?? "");
    setProvider(existing?.provider ?? "");
    setEffectiveFrom(existing?.effectiveFrom?.slice(0, 10) ?? "");
    setStatus(existing?.status ?? "active");
    setGlobalFootnotes((existing?.footnotes ?? []).join("\n"));
    setSections(existing?.sections ?? []);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cennikId]);

  function addTableSection() {
    const s: CennikTableSection = {
      type: "table",
      id: generateId("sec"),
      title: "",
      unit: "zł/kWh",
      columns: [],
      rows: [],
    };
    setSections((prev) => [...prev, s]);
  }

  function addChargesSection() {
    const s: CennikChargesSection = {
      type: "charges",
      id: generateId("sec"),
      title: "",
      items: [],
    };
    setSections((prev) => [...prev, s]);
  }

  function updateSection(id: string, updated: CennikSection) {
    setSections((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function moveSection(id: string, dir: "up" | "down") {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const ni = dir === "up" ? idx - 1 : idx + 1;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || isMutating) return;
    setError("");

    if (apiMode && !canWrite) {
      setError(moduleError ?? "Backend modułu cenników nie jest jeszcze gotowy do zapisu.");
      return;
    }

    if (isBlank(title)) { setError("Pole „Tytuł” jest wymagane."); return; }
    if (!effectiveFrom) { setError("Pole „Obowiązuje od” jest wymagane."); return; }
    if (sections.length === 0) {
      setError("Dodaj co najmniej jedną sekcję cennika przed zapisem.");
      return;
    }
    if (sections.some((s) => isBlank(s.title))) {
      setError("Każda sekcja cennika musi mieć tytuł.");
      return;
    }

    setSaving(true);

    try {
      const footnotesArr = globalFootnotes
        .split("\n").map((l) => l.trim()).filter(Boolean);

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        provider: provider.trim() || null,
        effectiveFrom,
        status,
        footnotes: footnotesArr,
        sections,
      };

      if (isNew) {
        await createCennik(payload);
        pushToast(
          "success",
          source === "api" ? "Cennik został zapisany w backendzie." : "Cennik został dodany."
        );
      } else if (existing) {
        await editCennik(existing.id, payload);
        pushToast(
          "success",
          source === "api" ? "Cennik został zaktualizowany w backendzie." : "Cennik został zaktualizowany."
        );
      }
      allowNextNavigation();
      navigate(ROUTES.cenniki);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się zapisać cennika.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell currentUser={user}>
      <section className="mx-auto w-full max-w-240 pb-12">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.cenniki)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#64748b] transition hover:text-[#1d4f91]"
            >
              <ArrowLeft size={16} />
              Cenniki
            </button>
            <span className="text-[#d1d5db]">/</span>
            <span className="text-sm font-medium text-[#0f172a]">{pageTitle}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Uporządkuj dane źródłowe i sekcje tabel, aby cennik był czytelny oraz łatwy do aktualizacji.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-xl border border-[#dde5ee] bg-white p-5">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-[#374151]">
              Informacje o cenniku
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Tytuł <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="np. Tauron Dystrybucja — Opłaty dystrybucyjne"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Podtytuł</label>
                <input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="np. Taryfa G11, G12, G12w"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Dostawca / wystawca</label>
                <input
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="np. Tauron Dystrybucja S.A."
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Obowiązuje od <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select
                  value={status}
                  onChange={(e) =>
                    setStatus(e.target.value as "active" | "archived")
                  }
                  className={fieldCls}
                >
                  <option value="active">Aktywny</option>
                  <option value="archived">Archiwum</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Uwagi ogólne (opcjonalnie, jedna per linia)
                </label>
                <textarea
                  value={globalFootnotes}
                  onChange={(e) => setGlobalFootnotes(e.target.value)}
                  rows={2}
                  placeholder="np. Ceny netto, bez podatku VAT (23%)."
                  className={`${fieldCls} resize-y`}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#374151]">
                Sekcje ({sections.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={addTableSection}
                  className="flex items-center gap-1.5 rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#1d4f91] hover:text-[#1d4f91]"
                >
                  <Table2 size={13} />
                  Tabela cenowa
                </button>
                <button
                  type="button"
                  onClick={addChargesSection}
                  className="flex items-center gap-1.5 rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-xs font-medium text-[#374151] transition hover:border-[#1d4f91] hover:text-[#1d4f91]"
                >
                  <ListTree size={13} />
                  Opłaty wariantowe
                </button>
              </div>
            </div>

            {sections.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#dde5ee] bg-white px-6 py-10 text-center">
                <p className="text-sm text-[#9ca3af]">Brak sekcji.</p>
                <p className="mt-1 text-xs text-[#b0b8c4]">
                  Dodaj <strong>Tabelę cenową</strong> dla standardowych cen taryf,<br />
                  lub <strong>Opłaty wariantowe</strong> dla opłat stałych zależnych od taryfy/fazy.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {sections.map((s, i) => (
                  <SectionWrapper
                    key={s.id}
                    section={s}
                    index={i}
                    total={sections.length}
                    onChange={(updated) => updateSection(s.id, updated)}
                    onDelete={() => removeSection(s.id)}
                    onMove={(dir) => moveSection(s.id, dir)}
                  />
                ))}
              </div>
            )}
          </div>

          {(error || moduleError) && (
            <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-2.5 text-sm font-medium text-[#dc2626]">
              {error || moduleError}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
            <p className="text-xs text-[#94a3b8]">Najpierw uzupełnij sekcje, potem zapisz cały dokument.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.cenniki)}
                className="rounded-xl border border-[#d1d5db] bg-white px-5 py-2.5 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving || isMutating || (apiMode && !canWrite)}
                className="rounded-xl bg-[#1d4f91] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163d72] disabled:opacity-50"
              >
                {saving ? "Zapisywanie…" : isNew ? "Dodaj cennik" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
