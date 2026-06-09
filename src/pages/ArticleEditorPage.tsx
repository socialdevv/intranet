import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Navigate,
  Link,
} from "react-router-dom";
import AppShell from "@/components/layout/app-shell";
import PersistenceStateBanner from "@/components/admin/persistence-state-banner";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { canEditContent } from "@/lib/auth/authorization";
import { ROUTES, knowledgeArticlePath } from "@/lib/routes";
import { generateId, isBlank, isValidHttpUrl, slugify } from "@/lib/utils";
import type { DocSection } from "@/lib/types/domain";
import RichEditor, { EMPTY_DOC } from "@/components/editor/rich-editor";
import MatrixPicker from "@/components/admin/matrix-picker";
import { Trash2, ChevronUp, ChevronDown, ChevronsUpDown, Minus } from "lucide-react";
import { sectionToTipTapDoc, type TipTapDoc } from "@/lib/knowledge/content-doc";
import { stableSerialize, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

// ── Section draft type ────────────────────────────────────────────────────────

type SectionDraft = {
  id: string;
  title: string;
  tags: string;
  content: TipTapDoc;
  collapsible: boolean;
  showSeparator: boolean;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArticleEditorPage() {
  const { articleId } = useParams<{ articleId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pages, categories, matrix, communications, templates, addPage, updatePage, deletePage } = useData();

  const isNew = articleId === "nowy";
  const existing = isNew ? null : pages.find((p) => p.id === articleId);
  const prefilledCategoryId = searchParams.get("categoryId") ?? "";

  // ─ Form state ─
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [tags, setTags] = useState("");
  const [globalMatrixLinkIds, setGlobalMatrixLinkIds] = useState<string[]>([]);
  const [externalSourceUrl, setExternalSourceUrl] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>([
    {
      id: generateId("section"),
      title: "",
      tags: "",
      content: EMPTY_DOC,
      collapsible: false,
      showSeparator: true,
    },
  ]);
  const [sectionSearch, setSectionSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initialSnapshot = useMemo(
    () =>
      stableSerialize({
        title: existing?.title ?? "",
        summary: existing?.summary ?? "",
        slug: existing?.slug ?? "",
        categoryId: existing?.categoryId ?? prefilledCategoryId,
        tags: existing?.tags.join(", ") ?? "",
        globalMatrixLinkIds: existing?.globalMatrixLinkIds ?? [],
        externalSourceUrl: existing?.externalSourceUrl ?? "",
        sectionSearch: existing?.sectionSearch ?? false,
        sections:
          existing?.sections.length && existing.sections.length > 0
            ? existing.sections.map((s) => ({
                title: s.title,
                tags: (s.tags ?? []).join(", "),
                content: sectionToTipTapDoc(s),
                collapsible: s.collapsible ?? false,
                showSeparator: s.showSeparator !== false,
              }))
            : [{ title: "", tags: "", content: EMPTY_DOC, collapsible: false, showSeparator: true }],
      }),
    [existing?.id, prefilledCategoryId],
  );

  const currentSnapshot = useMemo(
    () =>
      stableSerialize({
        title,
        summary,
        slug,
        categoryId,
        tags,
        globalMatrixLinkIds,
        externalSourceUrl,
        sectionSearch,
        sections: sections.map((s) => ({
          title: s.title,
          tags: s.tags,
          content: s.content,
          collapsible: s.collapsible,
          showSeparator: s.showSeparator,
        })),
      }),
    [
      title,
      summary,
      slug,
      categoryId,
      tags,
      globalMatrixLinkIds,
      externalSourceUrl,
      sectionSearch,
      sections,
    ],
  );

  const hasUnsavedChanges = currentSnapshot !== initialSnapshot;
  const { allowNextNavigation } = useUnsavedChangesGuard({
    hasUnsavedChanges,
    isSaving: saving,
  });

  // Initialise from existing article (or pre-fill category from query param)
  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSummary(existing.summary);
      setSlug(existing.slug);
      setSlugManual(true);
      setCategoryId(existing.categoryId);
      setTags(existing.tags.join(", "));
      setGlobalMatrixLinkIds(existing.globalMatrixLinkIds ?? []);
      setExternalSourceUrl(existing.externalSourceUrl ?? "");
      setSectionSearch(existing.sectionSearch ?? false);
      setSections(
        existing.sections.length > 0
          ? existing.sections.map((s) => ({
              id: s.id,
              title: s.title,
                tags: (s.tags ?? []).join(", "),
              content: sectionToTipTapDoc(s),
              collapsible: s.collapsible ?? false,
              showSeparator: s.showSeparator !== false,
            }))
            : [
                {
                  id: generateId("section"),
                  title: "",
                  tags: "",
                  content: EMPTY_DOC,
                  collapsible: false,
                  showSeparator: true,
                },
              ]
      );
    } else if (isNew) {
      setCategoryId(prefilledCategoryId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, isNew, prefilledCategoryId]);

  if (!user) return <Navigate to={ROUTES.home} replace />;
  if (!canEditContent(user)) return <Navigate to={ROUTES.home} replace />;

  function handleTitleChange(v: string) {
    setTitle(v);
    if (!slugManual) setSlug(slugify(v));
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      {
        id: generateId("section"),
        title: "",
        tags: "",
        content: EMPTY_DOC,
        collapsible: false,
        showSeparator: true,
      },
    ]);
  }

  function removeSection(idx: number) {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveSection(idx: number, dir: "up" | "down") {
    setSections((prev) => {
      const next = [...prev];
      const target = dir === "up" ? idx - 1 : idx + 1;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function updateSection(idx: number, patch: Partial<SectionDraft>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError("");

    const normalizedTitle = title.trim();
    const normalizedSlug = slug.trim();
    const normalizedExternalSourceUrl = externalSourceUrl.trim();

    if (isBlank(normalizedTitle)) { setError("Pole „Tytuł artykułu” jest wymagane."); return; }
    if (isBlank(normalizedSlug)) { setError("Pole „Slug” jest wymagane."); return; }
    if (/\s/.test(normalizedSlug)) { setError("Slug nie może zawierać spacji."); return; }
    if (!categoryId) { setError("Wybierz kategorię artykułu."); return; }
    if (normalizedExternalSourceUrl && !isValidHttpUrl(normalizedExternalSourceUrl)) {
      setError("Link do pełnej bazy wiedzy musi zaczynać się od http:// lub https://.");
      return;
    }

    setSaving(true);
    try {
      const category = categories.find((c) => c.id === categoryId);
      const now = new Date().toISOString();
      const docSections: DocSection[] = sections
        .filter((s) => s.title.trim() || s.content.content.length > 0 || s.tags.trim())
        .map((s) => {
          const sectionTags = s.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

          return {
            id: s.id,
            title: s.title.trim() || "Sekcja",
            tags: sectionTags.length > 0 ? sectionTags : undefined,
            jsonContent: s.content,
            collapsible: s.collapsible,
            showSeparator: s.showSeparator,
          };
        });
      const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);

      if (isNew) {
        const newPage = await addPage({
          categoryId,
          category: category?.slug ?? "",
          categoryDisplayName: category?.name,
          slug: normalizedSlug,
          title: normalizedTitle,
          summary: summary.trim(),
          updatedAt: now,
          tags: tagList,
          hiddenTags: [],
          matrixLinkId: null,
          globalMatrixLinkIds,
          externalSourceUrl: normalizedExternalSourceUrl || undefined,
          sectionSearch,
          quickActions: [],
          sections: docSections,
        });
        allowNextNavigation();
        navigate(knowledgeArticlePath(newPage.category, newPage.slug), { replace: true });
      } else if (existing) {
        await updatePage({
          ...existing,
          categoryId,
          category: category?.slug ?? existing.category,
          categoryDisplayName: category?.name ?? existing.categoryDisplayName,
          slug: normalizedSlug,
          title: normalizedTitle,
          summary: summary.trim(),
          updatedAt: now,
          tags: tagList,
          matrixLinkId: existing.matrixLinkId ?? null,
          globalMatrixLinkIds,
          externalSourceUrl: normalizedExternalSourceUrl || undefined,
          sectionSearch,
          sections: docSections,
        });
        allowNextNavigation();
        navigate(knowledgeArticlePath(category?.slug ?? existing.category, normalizedSlug), {
          replace: true,
        });
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Nie udało się zapisać artykułu bazy wiedzy."
      );
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "h-10 w-full rounded-lg border border-[#d1d5db] px-3 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20 disabled:opacity-50";

  const backHref =
    isNew
      ? ROUTES.admin
      : existing
      ? knowledgeArticlePath(existing.category, existing.slug)
      : ROUTES.admin;

  return (
    <AppShell currentUser={user}>
      <div className="mx-auto w-full max-w-352 pb-10">
        <header className="mb-6 space-y-2 border-b border-[#e5e7eb] pb-4">
          <Link to={backHref} className="inline-flex text-sm text-[#64748b] hover:text-[#1d4f91]">
            ← Wstecz
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#0f172a]">
              {isNew ? "Nowy artykuł" : "Edycja artykułu"}
            </h1>
            <p className="mt-1 text-sm text-[#64748b]">
              Treść artykułu edytujesz po lewej, a metadane i publikację kontrolujesz w panelu bocznym.
            </p>
          </div>
        </header>

        <PersistenceStateBanner className="mb-5" />

        <form onSubmit={handleSubmit} noValidate>
          {/* ── 2-column layout ── */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">

            {/* ── Left / Main writing area ── */}
            <div className="min-w-0 flex-1 space-y-5">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
                Główna treść artykułu
              </p>

              {/* Article title */}
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Tytuł artykułu"
                className="w-full border-0 border-b-2 border-[#e5e7eb] bg-transparent pb-2 text-2xl font-bold text-[#0f172a] outline-none placeholder:text-[#c7cdd4] focus:border-[#1d4f91]"
              />

              {/* Sections */}
              <div className="space-y-6">
                {sections.map((section, idx) => (
                  <div key={section.id} className="rounded-2xl border border-[#dde5ee] bg-white shadow-sm">
                    {/* Section header bar */}
                    <div className="flex items-center justify-between gap-2 border-b border-[#eef0f4] px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
                          Sekcja {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateSection(idx, { collapsible: !section.collapsible })}
                          title={section.collapsible ? "Sekcja zwijana — kliknij aby wyłączyć" : "Kliknij aby sekcja była domyślnie zwinięta"}
                          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${
                            section.collapsible
                              ? "bg-[#dbeafe] text-[#1d4f91]"
                              : "text-[#c0c8d5] hover:bg-[#f1f5f9] hover:text-[#64748b]"
                          }`}
                        >
                          <ChevronsUpDown size={11} />
                          {section.collapsible ? "Zwijana" : "Zwykła"}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSection(idx, { showSeparator: !section.showSeparator })}
                          title={section.showSeparator ? "Separator przed sekcją włączony — kliknij aby ukryć" : "Separator przed sekcją wyłączony — kliknij aby pokazać"}
                          className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${
                            section.showSeparator
                              ? "bg-[#f1f5f9] text-[#64748b]"
                              : "text-[#c0c8d5] hover:bg-[#f1f5f9] hover:text-[#64748b]"
                          }`}
                        >
                          <Minus size={11} />
                          {section.showSeparator ? "Separator" : "Bez separatora"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        {sections.length > 1 && (
                          <>
                            <button
                              type="button"
                              onClick={() => moveSection(idx, "up")}
                              disabled={idx === 0}
                              title="Przesuń sekcję wyżej"
                              className="rounded p-1 text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSection(idx, "down")}
                              disabled={idx === sections.length - 1}
                              title="Przesuń sekcję niżej"
                              className="rounded p-1 text-[#94a3b8] transition hover:bg-[#f1f5f9] hover:text-[#374151] disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <ChevronDown size={14} />
                            </button>
                            <span className="mx-1 inline-block h-4 w-px bg-[#e5e7eb]" aria-hidden />
                            <button
                              type="button"
                              onClick={() => removeSection(idx)}
                              className="rounded px-2 py-1 text-xs text-[#ef4444] transition hover:bg-red-50 hover:text-red-600"
                            >
                              Usuń sekcję
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-4 pt-3 space-y-3">
                      {/* Section title – large, prominent */}
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(idx, { title: e.target.value })}
                        placeholder="Tytuł sekcji (opcjonalny)"
                        className="w-full border-0 border-b-2 border-[#e5e7eb] bg-transparent pb-2 text-2xl font-bold text-[#111827] outline-none placeholder:font-normal placeholder:text-[#c7cdd4] focus:border-[#1d4f91]"
                      />

                      {/* Section tags */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-[#374151]">
                          Tagi sekcji <span className="font-normal text-[#9ca3af]">(oddziel przecinkiem)</span>
                        </label>
                        <input
                          type="text"
                          value={section.tags}
                          onChange={(e) => updateSection(idx, { tags: e.target.value })}
                          placeholder="np. reklamacja, priorytet, pv"
                          className={inputCls}
                        />
                      </div>

                      {/* Rich editor */}
                      <RichEditor
                        content={section.content}
                        onChange={(doc) => updateSection(idx, { content: doc })}
                        placeholder="Wpisz treść sekcji…"
                        minHeight="480px"
                        matrixEntries={matrix}
                  sectionLinks
                  pages={pages.map((p) => ({
                    id: p.id,
                    title: p.title,
                    slug: p.slug,
                    category: p.category,
                    categoryId: p.categoryId,
                    categoryDisplayName: categories.find((c) => c.id === p.categoryId)?.name,
                    sections: (p.sections ?? []).map((section) => ({
                      id: section.id,
                      title: section.title,
                    })),
                  }))}
                  categories={categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                    parentId: c.parentId,
                  }))}
                  communications={communications.map((k) => ({ id: k.id, title: k.title }))}
                  templates={templates.map((t) => ({ id: t.id, title: t.title, channel: t.channel }))}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSection}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#c9d6e3] py-3 text-sm font-medium text-[#64748b] transition hover:border-[#1d4f91] hover:text-[#1d4f91]"
                >
                  + Dodaj sekcję
                </button>
              </div>
            </div>

            {/* ── Right / Metadata sidebar ── */}
            <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-4 lg:w-72 xl:w-80">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
                Publikacja i ustawienia
              </p>

              {/* Save action card */}
              <div className="rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
                  Akcje artykułu
                </p>
                {error && (
                  <p role="alert" className="mb-3 rounded-lg bg-[#fee2e2] px-3 py-2 text-xs font-medium text-[#b91c1c]">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className={[
                    "h-10 w-full rounded-lg text-sm font-medium transition",
                    saving
                      ? "cursor-not-allowed bg-[#93c5fd] text-white"
                      : "bg-[#1d4f91] text-white hover:bg-[#1a4580]",
                  ].join(" ")}
                >
                  {saving ? "Zapisywanie…" : isNew ? "Utwórz artykuł" : "Zapisz zmiany"}
                </button>
                <Link
                  to={backHref}
                  className="mt-2 flex h-9 w-full items-center justify-center rounded-lg border border-[#e5e7eb] text-sm text-[#64748b] transition hover:border-[#1d4f91] hover:text-[#1d4f91]"
                >
                  Anuluj
                </Link>
                {/* Delete — only for existing articles */}
                {!isNew && existing && (
                  <div className="mt-3 border-t border-[#f1f5f9] pt-3">
                    {confirmDelete ? (
                      <div className="space-y-1.5">
                        <p className="text-center text-xs text-[#ef4444]">
                          Usunąć ten artykuł? Nie można cofnąć.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deletePage(existing.id);
                              allowNextNavigation();
                              navigate(ROUTES.admin + "?tab=artykuly", { replace: true });
                            } catch (caught) {
                              setError(
                                caught instanceof Error
                                  ? caught.message
                                  : "Nie udało się usunąć artykułu bazy wiedzy."
                              );
                            }
                          }}
                          className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#dc2626] text-xs font-medium text-white transition hover:bg-[#b91c1c]"
                        >
                          <Trash2 size={12} />
                          Tak, usuń artykuł
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex h-8 w-full items-center justify-center rounded-lg border border-[#e5e7eb] text-xs text-[#64748b] transition hover:bg-[#f8fafc]"
                        >
                          Anuluj
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#fecaca] bg-[#fff5f5] text-xs font-medium text-[#dc2626] transition hover:bg-[#fee2e2]"
                      >
                        <Trash2 size={12} />
                        Usuń artykuł
                      </button>
                    )}
                  </div>
                )}              </div>

              {/* Metadata card */}
              <div className="rounded-2xl border border-[#dde5ee] bg-white p-4 shadow-sm space-y-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#94a3b8]">
                  Właściwości artykułu
                </p>

                {/* Category */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Kategoria *</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— wybierz kategorię —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Slug */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Slug *</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    placeholder="slug-artykulu"
                    className={`${inputCls} font-mono text-xs`}
                  />
                </div>

                {/* Summary */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">Streszczenie</label>
                  <textarea
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Krótki opis artykułu…"
                    rows={3}
                    className="w-full resize-y rounded-lg border border-[#d1d5db] px-3 py-2 text-sm text-[#111827] outline-none transition focus:border-[#1d4f91] focus:ring-2 focus:ring-[#1d4f91]/20"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">
                    Tagi <span className="font-normal text-[#9ca3af]">(oddziel przecinkiem)</span>
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="tag1, tag2, tag3"
                    className={inputCls}
                  />
                </div>

                {/* Global matrix links — multi-select, shown in side panel */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">
                    Procedury macierzy{" "}
                    <span className="font-normal text-[#9ca3af]">(panel boczny)</span>
                  </label>
                  <MatrixPicker
                    matrix={matrix}
                    selectedIds={globalMatrixLinkIds}
                    onChange={setGlobalMatrixLinkIds}
                    placeholder="+ Dodaj procedurę"
                  />
                  <p className="mt-1 text-[11px] text-[#9ca3af]">
                    Widoczne w panelu bocznym artykułu na pulpicie.
                  </p>
                </div>

                {/* Section search */}
                <div className="flex items-start gap-3">
                  <button
                    id="section-search-toggle"
                    type="button"
                    role="switch"
                    aria-checked={sectionSearch}
                    onClick={() => setSectionSearch((v) => !v)}
                    className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4f91]/50 ${
                      sectionSearch
                        ? "border-[#1d4f91] bg-[#1d4f91]"
                        : "border-[#d1d5db] bg-[#f3f4f6]"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${
                        sectionSearch ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <label
                    htmlFor="section-search-toggle"
                    className="cursor-pointer select-none"
                  >
                    <span className="block text-xs font-medium text-[#374151]">
                      Wyszukiwarka sekcji
                    </span>
                    <span className="block text-[11px] text-[#9ca3af]">
                      Pokazuje pole wyszukiwania sekcji na stronie artykułu.
                    </span>
                  </label>
                </div>

                {/* External knowledge-base link */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#374151]">
                    Link do pełnej bazy wiedzy
                    <span className="ml-1 font-normal text-[#9ca3af]">(opcjonalny)</span>
                  </label>
                  <input
                    type="url"
                    value={externalSourceUrl}
                    onChange={(e) => setExternalSourceUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputCls}
                  />
                  <p className="mt-1 text-[11px] text-[#9ca3af]">
                    Wyświetlony jako ikona przy tytule artykułu. Otwiera się w nowej karcie.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
