import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Navigate, useNavigate } from "react-router-dom";
import { Plus, Trash2, ArrowLeft, ArrowRight, Search, X, ChevronUp, ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import PersistenceStateBanner from "@/components/admin/persistence-state-banner";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { useToast } from "@/contexts/toast-context";
import { canEditRules } from "@/lib/auth/authorization";
import { ROUTES } from "@/lib/routes";
import { ChannelBadgeMini } from "@/components/templates/channel-badge";
import type { MatrixCondition, MatrixCriterion, TextTemplate } from "@/lib/types/domain";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

// ── Empty defaults ────────────────────────────────────────────────────────────
const EMPTY_CONDITION: MatrixCondition = { department: "", criteria: [] };
const EMPTY_CRITERION: MatrixCriterion = { field: "", value: "" };

// ── Template picker ───────────────────────────────────────────────────────────
function TemplatePicker({
  selectedIds,
  onChange,
  templates,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  templates: TextTemplate[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return templates.filter(
      (t) =>
        !selectedIds.includes(t.id) &&
        (q === "" || t.title.toLowerCase().includes(q))
    );
  }, [templates, selectedIds, query]);

  const selected = useMemo(
    () => templates.filter((t) => selectedIds.includes(t.id)),
    [templates, selectedIds]
  );

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((i) => i !== id)
        : [...selectedIds, id]
    );
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-1.5 rounded-lg border border-[#c7d2fe] bg-[#eef2ff] py-1 pl-2.5 pr-1.5 text-xs font-medium text-[#3730a3]"
            >
              <ChannelBadgeMini channel={t.channel} />
              <span className="max-w-40 truncate">{t.title}</span>
              <button
                type="button"
                onClick={() => toggle(t.id)}
                aria-label={`Usuń ${t.title}`}
                className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#6366f1] hover:bg-[#c7d2fe] hover:text-[#3730a3]"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search + dropdown */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={templates.length === 0 ? "Brak dostępnych szablonów" : "Szukaj szablonu po tytule…"}
            disabled={templates.length === 0}
            className="h-9 w-full rounded-lg border border-[#d1d5db] bg-white pl-8 pr-3 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        {open && filtered.length > 0 && (
          <ul className="absolute left-0 top-full z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-[#d1d5db] bg-white py-1 shadow-lg">
            {filtered.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggle(t.id);
                    setQuery("");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-[#0f172a] hover:bg-[#f0f5ff]"
                >
                  <ChannelBadgeMini channel={t.channel} />
                  <span className="flex-1 truncate">{t.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && query && (
          <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2.5 shadow-lg">
            <p className="text-xs text-[#9ca3af]">Brak wyników dla „{query}".</p>
          </div>
        )}
      </div>
      {selected.length === 0 && templates.length > 0 && (
        <p className="text-[11px] text-[#9ca3af]">Wyszukaj i wybierz szablony do powiązania z tym wpisem macierzy.</p>
      )}
    </div>
  );
}

// ── Combo input with suggestions ────────────────────────────────────────────────────────

function ComboInput({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = options.filter(
    (o) => o.toLowerCase().includes(value.toLowerCase()) && o.toLowerCase() !== value.toLowerCase()
  );

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-0.5 max-h-48 w-full overflow-y-auto rounded-lg border border-[#d1d5db] bg-white py-1 shadow-lg">
          {filtered.slice(0, 10).map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt);
                  setOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-[#0f172a] hover:bg-[#f0f5ff]"
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MatrixEditorPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const { user } = useAuth();
  const { matrix, templates, matrixModule } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const {
    source,
    isLoading: isMatrixLoading,
    isMutating,
    error: moduleError,
    canWrite,
    createEntry,
    editEntry,
  } = matrixModule;
  const apiMode = source === "api";

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditRules(user)) return <Navigate to={ROUTES.matrix} replace />;

  const isNew = entryId === "nowy";
  const existing = isNew ? null : matrix.find((m) => m.id === entryId);

  if (!isNew && apiMode && isMatrixLoading && !existing) {
    return (
      <AppShell currentUser={user}>
        <section className="mx-auto w-full max-w-240 pb-16">
          <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
            <button
              type="button"
              onClick={() => navigate(ROUTES.matrix)}
              className="inline-flex items-center gap-1.5 text-sm text-[#64748b] transition hover:text-[#0f172a]"
            >
              <ArrowLeft size={14} />
              Wróć
            </button>
          </header>

          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-4 py-8 text-sm text-[#5f6f86]">
            Ładowanie wpisu macierzy z backendu…
          </div>
        </section>
      </AppShell>
    );
  }

  if (!isNew && !existing) {
    return <Navigate to={ROUTES.matrix} replace />;
  }

  // ── Form state ──────────────────────────────────────────────────────────────
  const [category, setCategory] = useState(existing?.category ?? "");
  const [subcategory, setSubcategory] = useState(existing?.subcategory ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [slaDays, setSlaDays] = useState(String(existing?.slaDays ?? "7"));
  const [defaultDepartment, setDefaultDepartment] = useState(existing?.defaultDepartment ?? "");
  const [keywords, setKeywords] = useState((existing?.keywords ?? []).join(", "));
  const [instructions, setInstructions] = useState(existing?.instructions ?? "");
  const [additionalNotes, setAdditionalNotes] = useState(existing?.additionalNotes ?? "");
  const [linkedTemplateIds, setLinkedTemplateIds] = useState<string[]>(
    existing?.linkedTemplateIds ?? []
  );
  const [conditions, setConditions] = useState<MatrixCondition[]>(
    existing?.conditions ?? []
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pageTitle = isNew ? "Nowy wpis macierzy" : "Edytuj wpis macierzy";

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        category: existing?.category ?? "",
        subcategory: existing?.subcategory ?? "",
        description: existing?.description ?? "",
        slaDays: String(existing?.slaDays ?? "7"),
        defaultDepartment: existing?.defaultDepartment ?? "",
        keywords: (existing?.keywords ?? []).join(", "),
        instructions: existing?.instructions ?? "",
        additionalNotes: existing?.additionalNotes ?? "",
        linkedTemplateIds: existing?.linkedTemplateIds ?? [],
        conditions: existing?.conditions ?? [],
      }),
    [existing?.id],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        category,
        subcategory,
        description,
        slaDays,
        defaultDepartment,
        keywords,
        instructions,
        additionalNotes,
        linkedTemplateIds,
        conditions,
      }),
    [
      category,
      subcategory,
      description,
      slaDays,
      defaultDepartment,
      keywords,
      instructions,
      additionalNotes,
      linkedTemplateIds,
      conditions,
    ],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving || isMutating,
  });

  useEffect(() => {
    setCategory(existing?.category ?? "");
    setSubcategory(existing?.subcategory ?? "");
    setDescription(existing?.description ?? "");
    setSlaDays(String(existing?.slaDays ?? "7"));
    setDefaultDepartment(existing?.defaultDepartment ?? "");
    setKeywords((existing?.keywords ?? []).join(", "));
    setInstructions(existing?.instructions ?? "");
    setAdditionalNotes(existing?.additionalNotes ?? "");
    setLinkedTemplateIds(existing?.linkedTemplateIds ?? []);
    setConditions(existing?.conditions ?? []);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  // Suggestions derived from existing matrix data
  const categoryOptions = useMemo(
    () => [...new Set(matrix.map((m) => m.category).filter(Boolean))].sort(),
    [matrix]
  );
  const deptOptions = useMemo(
    () =>
      [
        ...new Set(
          [
            ...matrix.map((m) => m.defaultDepartment),
            ...matrix.flatMap((m) => m.conditions.map((c) => c.department)),
          ].filter(Boolean)
        ),
      ].sort(),
    [matrix]
  );
  const criterionFieldOptions = useMemo(
    () =>
      [
        ...new Set(
          matrix.flatMap((m) =>
            m.conditions.flatMap((c) => c.criteria.map((cr) => cr.field))
          )
        ),
      ]
        .filter(Boolean)
        .sort(),
    [matrix]
  );
  const criterionValuesByField = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const m of matrix) {
      for (const c of m.conditions) {
        for (const cr of c.criteria) {
          if (!cr.field || !cr.value) continue;
          if (!map.has(cr.field)) map.set(cr.field, new Set());
          map.get(cr.field)!.add(cr.value);
        }
      }
    }
    return map;
  }, [matrix]);

  // ── Condition CRUD ──────────────────────────────────────────────────────────
  function addCondition() {
    setConditions((prev) => [...prev, { ...EMPTY_CONDITION, criteria: [] }]);
  }

  function removeCondition(idx: number) {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveConditionUp(idx: number) {
    if (idx === 0) return;
    setConditions((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }

  function moveConditionDown(idx: number) {
    setConditions((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }

  function updateConditionDept(idx: number, dept: string) {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, department: dept } : c))
    );
  }

  function addCriterion(condIdx: number) {
    setConditions((prev) =>
      prev.map((c, i) =>
        i === condIdx ? { ...c, criteria: [...c.criteria, { ...EMPTY_CRITERION }] } : c
      )
    );
  }

  function removeCriterion(condIdx: number, crIdx: number) {
    setConditions((prev) =>
      prev.map((c, i) =>
        i === condIdx
          ? { ...c, criteria: c.criteria.filter((_, j) => j !== crIdx) }
          : c
      )
    );
  }

  function updateCriterion(
    condIdx: number,
    crIdx: number,
    field: keyof MatrixCriterion,
    value: string
  ) {
    setConditions((prev) =>
      prev.map((c, i) =>
        i === condIdx
          ? {
              ...c,
              criteria: c.criteria.map((cr, j) =>
                j === crIdx ? { ...cr, [field]: value } : cr
              ),
            }
          : c
      )
    );
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || isMutating) return;

    setError("");

    if (apiMode && !canWrite) {
      setError(moduleError ?? "Backend modułu macierzy nie jest jeszcze gotowy do zapisu.");
      return;
    }

    const normalizedConditions = conditions.map((condition) => ({
      ...condition,
      department: condition.department.trim(),
      criteria: condition.criteria.map((criterion) => ({
        field: criterion.field.trim(),
        value: criterion.value.trim(),
      })),
    }));

    const compactConditions = normalizedConditions
      .map((condition) => ({
        ...condition,
        criteria: condition.criteria.filter((criterion) => criterion.field && criterion.value),
      }))
      .filter((condition) => condition.department || condition.criteria.length > 0);

    const hasPartialCriterion = normalizedConditions.some((condition) =>
      condition.criteria.some((criterion) => Boolean(criterion.field) !== Boolean(criterion.value)),
    );
    if (hasPartialCriterion) {
      const msg = "Każde kryterium reguły musi mieć uzupełnione oba pola: „Pole” i „Wartość”.";
      setError(msg);
      push("error", msg);
      return;
    }

    const hasCriteriaWithoutDepartment = compactConditions.some(
      (condition) => condition.criteria.length > 0 && !condition.department,
    );
    if (hasCriteriaWithoutDepartment) {
      const msg = "Każda reguła z kryteriami musi mieć wskazany dział.";
      setError(msg);
      push("error", msg);
      return;
    }

    const parsedSla = parseInt(slaDays.trim(), 10);
    if (!category.trim() || !subcategory.trim() || !description.trim()) {
      const msg = "Wypełnij wymagane pola: kategoria, podkategoria, opis.";
      setError(msg);
      push("error", "Wypełnij wymagane pola: kategoria, podkategoria, opis.");
      return;
    }
    if (compactConditions.length === 0 && !defaultDepartment.trim()) {
      const msg =
        "Brak reguł kierowania. Podaj domyślny dział lub dodaj co najmniej jedną regułę.";
      setError(msg);
      push(
        "error",
        "Brak reguł kierowania — podaj domyślny dział lub dodaj co najmniej jedną regułę."
      );
      return;
    }
    if (isNaN(parsedSla) || parsedSla < 1) {
      const msg = "Czas realizacji musi być liczbą większą od 0.";
      setError(msg);
      push("error", "Czas realizacji musi być liczbą większą od 0.");
      return;
    }

    setSaving(true);

    const kwArray = keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    const payload = {
      category: category.trim(),
      subcategory: subcategory.trim(),
      description: description.trim(),
      slaDays: parsedSla,
      defaultDepartment: defaultDepartment.trim(),
      keywords: kwArray,
      instructions: instructions.trim(),
      additionalNotes: additionalNotes.trim(),
      linkedTemplateIds,
      conditions: compactConditions,
    };

    try {
      if (isNew) {
        await createEntry(payload);
        push(
          "success",
          source === "api" ? "Wpis macierzy został zapisany w backendzie." : "Wpis macierzy został dodany."
        );
      } else {
        await editEntry(existing!.id, payload);
        push(
          "success",
          source === "api" ? "Wpis macierzy został zaktualizowany w backendzie." : "Wpis macierzy został zaktualizowany."
        );
      }

      allowNextNavigation();
      navigate(ROUTES.matrix);
    } catch {
      const msg = "Nie udało się zapisać wpisu macierzy. Spróbuj ponownie.";
      setError(msg);
      push("error", msg);
    } finally {
      setSaving(false);
    }
  }

  const fieldCls =
    "w-full rounded-lg border border-[#d1d5db] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#1d4f91] focus:outline-none focus:ring-2 focus:ring-[#1d4f91]/20";

  return (
    <AppShell currentUser={user!}>
      <div className="mx-auto w-full max-w-240 pb-16">
        <header className="mb-6 space-y-3 border-b border-[#e5e7eb] pb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm text-[#64748b] transition hover:text-[#0f172a]"
          >
            <ArrowLeft size={14} />
            Wróć
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-[#0f172a]">{pageTitle}</h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Uzupełnij dane sprawy i reguły kierowania. Najpierw podstawowe pola, potem wyjątki i szablony pomocnicze.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic fields */}
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#374151]">Podstawowe informacje</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151]">
                  Kategoria <span className="text-[#dc2626]">*</span>
                </label>
                <ComboInput
                  value={category}
                  onChange={setCategory}
                  options={categoryOptions}
                  placeholder="np. Reklamacje"
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151]">
                  Podkategoria <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="np. Reklamacja produktu"
                  className={fieldCls}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#374151]">
                Opis <span className="text-[#dc2626]">*</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Krótki opis sytuacji, do której stosuje się ten wpis…"
                className={`${fieldCls} resize-y`}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151]">
                  Czas realizacji (dni) <span className="text-[#dc2626]">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={slaDays}
                  onChange={(e) => setSlaDays(e.target.value)}
                  className={fieldCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#374151]">
                  Domyślny dział
                  {conditions.length === 0 && (
                    <span className="text-[#dc2626]"> *</span>
                  )}
                </label>
                <ComboInput
                  value={defaultDepartment}
                  onChange={setDefaultDepartment}
                  options={deptOptions}
                  placeholder="np. Dział Obsługi Klienta"
                  className={fieldCls}
                />
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  {conditions.length === 0
                    ? "Wymagany gdy brak reguł kierowania."
                    : "Opcjonalny fallback widoczny obok reguł."}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#374151]">
                Słowa kluczowe{" "}
                <span className="font-normal text-[#9ca3af]">(oddzielone przecinkami)</span>
              </label>
              <input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="reklamacja, zwrot, uszkodzenie"
                className={fieldCls}
              />
            </div>
          </section>

          {/* Instructions & Notes */}
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-[#374151]">Instrukcja i uwagi</h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#374151]">
                Instrukcja obsługi
              </label>
              <textarea
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Opisz krok po kroku, jak postępować w tej sytuacji…"
                className={`${fieldCls} resize-y`}
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#374151]">
                Uwagi dodatkowe{" "}
                <span className="font-normal text-[#9ca3af]">(pojawią się jako ostrzeżenie)</span>
              </label>
              <textarea
                rows={3}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Ważne wyjątki, pułapki, terminy prawne…"
                className={`${fieldCls} resize-y`}
              />
            </div>
          </section>

          {/* Conditions */}
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#374151]">
                Reguły kierowania{" "}
                <span className="ml-1 rounded-full bg-[#f1f5f9] px-2 py-0.5 text-xs font-normal text-[#64748b]">
                  {conditions.length}
                </span>
              </h2>
              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1 rounded-lg border border-[#dde5ee] bg-white px-3 py-1.5 text-xs font-medium text-[#374151] transition hover:bg-[#f1f5f9]"
              >
                <Plus size={12} />
                Dodaj regułę
              </button>
            </div>

            {conditions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#e5e7eb] p-4 text-center text-xs text-[#9ca3af]">
                Brak reguł — wszystkie zgłoszenia trafią do domyślnego działu.
              </p>
            ) : (
              <div className="space-y-4">
                {conditions.map((cond, ci) => (
                  <div
                    key={ci}
                    className="rounded-lg border border-[#e5e7eb] bg-[#fafbfc] p-4"
                  >
                    {/* Card header */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#94a3b8]">
                        Reguła {ci + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveConditionUp(ci)}
                          disabled={ci === 0}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Przesuń regułę w górę"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveConditionDown(ci)}
                          disabled={ci === conditions.length - 1}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e7eb] bg-white text-[#64748b] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Przesuń regułę w dół"
                        >
                          <ChevronDown size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCondition(ci)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#fecaca] bg-[#fff5f5] text-[#dc2626] transition hover:bg-[#fee2e2]"
                          aria-label="Usuń regułę"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Criteria */}
                    <div className="mb-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#64748b]">
                        Jeśli warunki:
                      </p>
                      <div className="space-y-2">
                        {cond.criteria.map((cr, cri) => (
                          <div key={cri} className="flex items-center gap-2">
                            <ComboInput
                              value={cr.field}
                              onChange={(v) => updateCriterion(ci, cri, "field", v)}
                              options={criterionFieldOptions}
                              placeholder="pole (np. typ_klienta)"
                              className={`${fieldCls} flex-1`}
                            />
                            <span className="text-xs font-medium text-[#9ca3af]">=</span>
                            <ComboInput
                              value={cr.value}
                              onChange={(v) => updateCriterion(ci, cri, "value", v)}
                              options={[...(criterionValuesByField.get(cr.field) ?? [])].sort()}
                              placeholder="wartość (np. prosument)"
                              className={`${fieldCls} flex-1`}
                            />
                            <button
                              type="button"
                              onClick={() => removeCriterion(ci, cri)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e7eb] text-[#9ca3af] transition hover:border-[#fecaca] hover:text-[#dc2626]"
                              aria-label="Usuń kryterium"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {cond.criteria.length === 0 && (
                        <p className="mt-1 text-xs text-[#9ca3af]">
                          Bez kryteriów — reguła zawsze pasuje.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => addCriterion(ci)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#1d4f91] transition hover:underline"
                      >
                        <Plus size={11} />
                        Dodaj kryterium
                      </button>
                    </div>

                    {/* Result department */}
                    <div className="rounded-lg border border-[#c7d2fe] bg-[#eef2ff] p-3">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <ArrowRight size={12} className="text-[#4338ca]" />
                        <label className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#4338ca]">
                          Skieruj do działu
                        </label>
                      </div>
                      <ComboInput
                        value={cond.department}
                        onChange={(v) => updateConditionDept(ci, v)}
                        options={deptOptions}
                        placeholder="np. Dział Reklamacji"
                        className="w-full rounded-md border border-[#c7d2fe] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#b0bac9] focus:border-[#4338ca] focus:outline-none focus:ring-2 focus:ring-[#4338ca]/20"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Linked templates */}
          <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[#374151]">Powiązane szablony</h2>
              {linkedTemplateIds.length > 0 && (
                <span className="rounded-full bg-[#eef2ff] px-2 py-0.5 text-xs font-medium text-[#4338ca]">
                  {linkedTemplateIds.length}
                </span>
              )}
            </div>
            <TemplatePicker
              selectedIds={linkedTemplateIds}
              onChange={setLinkedTemplateIds}
              templates={templates}
            />
          </section>

          {(error || moduleError) ? (
            <p role="alert" className="rounded-lg bg-[#fee2e2] px-4 py-2.5 text-sm font-medium text-[#dc2626]">
              {error || moduleError}
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-[#e5e7eb] pt-4">
            <p className="text-xs text-[#94a3b8]">Po zapisaniu wpis będzie od razu widoczny w macierzy.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex h-10 items-center rounded-lg border border-[#e5e7eb] bg-white px-4 text-sm font-medium text-[#374151] transition hover:bg-[#f9fafb]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving || isMutating || (apiMode && !canWrite)}
                className="inline-flex h-10 items-center rounded-lg bg-[#1d4f91] px-5 text-sm font-medium text-white transition hover:bg-[#174080] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving || isMutating ? "Zapisywanie…" : isNew ? "Dodaj wpis" : "Zapisz zmiany"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
