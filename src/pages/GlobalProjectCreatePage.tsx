import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { FolderPlus, ShieldCheck } from "lucide-react";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { usePlatformBootstrapPreview } from "@/hooks/usePlatformBootstrapPreview";
import { canAccessAdminPanel } from "@/lib/auth/authorization";
import { canCreateProjects } from "@/lib/access/project-access";
import { createPlatformProject } from "@/lib/api/platform-projects";
import { projectPath, ROUTES } from "@/lib/routes";

function normalizeSlugInput(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeCodeInput(value: string): string {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function validateCreateProjectInput(input: {
  name: string;
  slug: string;
  code: string;
}): string | null {
  if (input.name.length < 2) {
    return "Nazwa projektu musi mieć co najmniej 2 znaki.";
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug)) {
    return "Slug może zawierać tylko małe litery, cyfry i pojedyncze myślniki.";
  }
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(input.code)) {
    return "Kod może zawierać tylko wielkie litery, cyfry, kropki, podkreślenia i myślniki.";
  }
  return null;
}

export default function GlobalProjectCreatePage() {
  const { user } = useAuth();
  const { reloadData } = useData();
  const platformBootstrap = usePlatformBootstrapPreview();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!user || !canAccessAdminPanel(user)) {
    return <Navigate to={ROUTES.home} replace />;
  }

  if (
    platformBootstrap.status === "ready" &&
    !canCreateProjects(platformBootstrap.preview.currentUser.globalRole)
  ) {
    return <Navigate to={ROUTES.admin} replace />;
  }

  function fillFromName(): void {
    setSlug(normalizeSlugInput(name));
    setCode(normalizeCodeInput(name));
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedInput = {
      name: name.trim(),
      slug: normalizeSlugInput(slug),
      code: normalizeCodeInput(code),
    };

    const validationError = validateCreateProjectInput(normalizedInput);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const payload = await createPlatformProject(normalizedInput);
      await reloadData();
      navigate(projectPath(payload.data.project.slug));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nie udało się utworzyć projektu.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell currentUser={user} navigationMode="global" searchPlaceholder="Szukaj w administracji globalnej…">
      <section className="mx-auto w-full max-w-4xl pb-8">
        <div className="rounded-[2rem] border border-[#dbe5f0] bg-[linear-gradient(135deg,#f8fbff_0%,#eef4fb_45%,#ffffff_100%)] px-6 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.07)] dark:border-[#1e3a5f] dark:bg-[linear-gradient(135deg,#0f2340_0%,#102846_45%,#0f172a_100%)] sm:px-8 lg:px-10">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#bfdbfe] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#1d4f91] backdrop-blur dark:border-[#31537a] dark:bg-[#0b1b30]/80 dark:text-[#93c5fd]">
            <FolderPlus size={12} />
            Utwórz projekt
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#0f172a] dark:text-[#f8fafc] sm:text-4xl">
            Utwórz nowy projekt
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#475569] dark:text-[#cbd5e1]">
            Formularz tworzy projekt przez API platformy i od razu inicjalizuje podstawową konfigurację, aby projekt był dostępny natychmiast po zapisie.
          </p>
        </div>

        <form
          onSubmit={handleCreateProject}
          className="mt-8 space-y-5 rounded-3xl border border-[#dde5ee] bg-white p-6 shadow-[0_12px_36px_rgba(15,23,42,0.05)] dark:border-[#1e3a5f] dark:bg-[#0f172a] dark:shadow-none"
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
            <ShieldCheck size={13} className="text-[#1d4f91] dark:text-[#93c5fd]" />
            Tylko Super Admin
          </div>

          <label className="block space-y-1">
            <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Nazwa projektu</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="ui-input"
              placeholder="np. Projekt Alfa — Dział Obsługi"
              maxLength={120}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Slug projektu</span>
              <input
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                onBlur={(event) => setSlug(normalizeSlugInput(event.target.value))}
                className="ui-input"
                placeholder="np. projekt-alfa"
                maxLength={80}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs text-[#64748b] dark:text-[#94a3b8]">Kod projektu</span>
              <input
                type="text"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onBlur={(event) => setCode(normalizeCodeInput(event.target.value))}
                className="ui-input"
                placeholder="np. ALFA-OBS"
                maxLength={64}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={fillFromName}
              className="rounded-xl border border-[#dbe4f0] bg-white px-3 py-2 text-sm font-medium text-[#1d4f91] hover:border-[#bfd3ea] hover:bg-[#f8fbff] dark:border-[#31537a] dark:bg-[#102846] dark:text-[#93c5fd]"
            >
              Uzupełnij slug i kod z nazwy
            </button>
            <span className="text-xs text-[#94a3b8]">
              Po utworzeniu nastąpi przekierowanie do nowego projektu.
            </span>
          </div>

          {error ? (
            <p className="rounded-xl border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#1f0b12] dark:text-[#fda4af]">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1d4f91] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163d73] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#2563eb] dark:hover:bg-[#1d4ed8]"
            >
              {isSaving ? "Tworzenie…" : "Utwórz projekt"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}