import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useProjectRouting } from "@/hooks/useProjectRouting";
import { canEditContent } from "@/lib/auth/authorization";
import {
  adaptProjectForms,
  submitProjectForm,
  fetchProjectForms,
} from "@/lib/api/project-forms";
import { ROUTES } from "@/lib/routes";
import type { ProjectFormDefinition } from "@/lib/types/domain";

type SubmitState = "idle" | "submitting" | "submitted";

export default function FormsPage() {
  const { user } = useAuth();
  const { activeProjectSlug, resolveHref } = useProjectRouting();
  const [forms, setForms] = useState<ProjectFormDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError("");
    setSubmitState("idle");
    setSubmitMessage("");

    void fetchProjectForms(activeProjectSlug, { signal: controller.signal })
      .then((payload) => {
        const nextForms = adaptProjectForms(payload);
        setForms(nextForms);
        setSelectedFormId(nextForms[0]?.id ?? null);
        setAnswers({});
      })
      .catch((caught) => {
        if ((caught as Error).name === "AbortError") {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Nie udało się pobrać formularzy.");
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [activeProjectSlug]);

  const selectedForm = useMemo(
    () => forms.find((item) => item.id === selectedFormId) ?? null,
    [forms, selectedFormId]
  );
  const isAdmin = canEditContent(user);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedForm) {
      return;
    }

    try {
      setSubmitState("submitting");
      setError("");
      const payload = await submitProjectForm(activeProjectSlug, selectedForm.id, answers);
      setSubmitState("submitted");
      const createdAt = payload.data.submission.createdAt;
      setSubmitMessage(
        `Formularz został wysłany i zapisany ${new Date(createdAt).toLocaleString("pl-PL")}.`
      );
    } catch (caught) {
      setSubmitState("idle");
      setError(caught instanceof Error ? caught.message : "Nie udało się wysłać formularza.");
    }
  }

  function updateAnswer(fieldId: string, value: unknown) {
    setAnswers((current) => ({
      ...current,
      [fieldId]: value,
    }));
  }

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w całej bazie wiedzy…">
      <div className="mx-auto w-full max-w-280 pb-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9]">
              Formularze
            </h1>
            <p className="mt-0.5 text-sm text-[#64748b] dark:text-[#94a3b8]">
              Wypełnij i wyślij formularze przygotowane dla tego projektu.
            </p>
          </div>
          {isAdmin ? (
            <Link
              to={resolveHref(`${ROUTES.admin}?area=content&panel=formularze`)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#dbe4f0] bg-white px-3 py-2 text-sm font-medium text-[#1d4f91] transition hover:bg-[#f8fbff] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#93c5fd]"
            >
              Zarządzaj formularzami
            </Link>
          ) : null}
        </div>

        {error ? (
          <div className="mb-5 rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3 text-sm text-[#b91c1c] dark:border-[#7f1d1d] dark:bg-[#3b1313] dark:text-[#fecaca]">
            {error}
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-xl border border-[#dbe4f0] bg-[#f8fbff] px-5 py-10 text-center text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
            Ładowanie formularzy…
          </div>
        ) : forms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#dbe4f0] bg-[#f8fbff] px-5 py-10 text-center text-sm text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
            Brak aktywnych formularzy w tym projekcie.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <aside className="rounded-xl border border-[#dde5ee] bg-white p-3 dark:border-[#334155] dark:bg-[#111827]">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#64748b] dark:text-[#94a3b8]">
                Dostępne formularze
              </p>
              <div className="space-y-2">
                {forms.map((form) => {
                  const active = selectedFormId === form.id;
                  return (
                    <button
                      key={form.id}
                      type="button"
                      onClick={() => {
                        setSelectedFormId(form.id);
                        setAnswers({});
                        setSubmitState("idle");
                        setSubmitMessage("");
                      }}
                      className={[
                        "w-full rounded-lg border px-3 py-2 text-left transition",
                        active
                          ? "border-[#1d4f91] bg-[#eff6ff] text-[#1d4f91] dark:border-[#1e3a8a] dark:bg-[#0f1b3a] dark:text-[#bfdbfe]"
                          : "border-[#e2e8f0] bg-white text-[#334155] hover:bg-[#f8fbff] dark:border-[#1e293b] dark:bg-[#0f172a] dark:text-[#cbd5e1] dark:hover:bg-[#111b2e]",
                      ].join(" ")}
                    >
                      <p className="text-sm font-semibold">{form.title}</p>
                      {form.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs opacity-85">{form.description}</p>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="rounded-xl border border-[#dde5ee] bg-white p-5 dark:border-[#334155] dark:bg-[#111827]">
              {selectedForm ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
                      {selectedForm.title}
                    </h2>
                    {selectedForm.description ? (
                      <p className="mt-1 text-sm text-[#64748b] dark:text-[#94a3b8]">
                        {selectedForm.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    {selectedForm.fields.map((field) => (
                      <label key={field.id} className="block space-y-1.5">
                        <span className="text-sm font-medium text-[#334155] dark:text-[#cbd5e1]">
                          {field.label}
                          {field.required ? (
                            <span className="ml-1 text-[#dc2626]">*</span>
                          ) : null}
                        </span>

                        {field.type === "text" ? (
                          <input
                            type="text"
                            value={(answers[field.id] as string | undefined) ?? ""}
                            onChange={(event) => updateAnswer(field.id, event.target.value)}
                            placeholder={field.placeholder ?? ""}
                            className="ui-input"
                          />
                        ) : null}

                        {field.type === "textarea" ? (
                          <textarea
                            value={(answers[field.id] as string | undefined) ?? ""}
                            onChange={(event) => updateAnswer(field.id, event.target.value)}
                            placeholder={field.placeholder ?? ""}
                            rows={4}
                            className="ui-input min-h-24 py-2"
                          />
                        ) : null}

                        {field.type === "select" ? (
                          <select
                            value={(answers[field.id] as string | undefined) ?? ""}
                            onChange={(event) => updateAnswer(field.id, event.target.value)}
                            className="ui-input"
                          >
                            <option value="">Wybierz…</option>
                            {(field.options ?? []).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : null}

                        {field.type === "checkbox" ? (
                          <span className="inline-flex items-center gap-2 text-sm text-[#334155] dark:text-[#cbd5e1]">
                            <input
                              type="checkbox"
                              checked={Boolean(answers[field.id])}
                              onChange={(event) => updateAnswer(field.id, event.target.checked)}
                              className="h-4 w-4 rounded border-[#cbd5e1]"
                            />
                            Potwierdzam
                          </span>
                        ) : null}
                      </label>
                    ))}
                  </div>

                  {submitMessage ? (
                    <p className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-sm text-[#166534] dark:border-[#14532d] dark:bg-[#0f2416] dark:text-[#86efac]">
                      {submitMessage}
                    </p>
                  ) : null}

                  <div className="rounded-lg border border-[#dbe4f0] bg-[#f8fbff] px-3 py-2 text-xs text-[#64748b] dark:border-[#334155] dark:bg-[#0f172a] dark:text-[#94a3b8]">
                    Zgłoszenie zapisuje się w bazie projektu jako źródło danych. Integracja wysyłki
                    zewnętrznej nie jest jeszcze skonfigurowana.
                  </div>

                  <button
                    type="submit"
                    disabled={submitState === "submitting"}
                    className="ui-btn disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitState === "submitting" ? "Wysyłanie…" : "Wyślij formularz"}
                  </button>
                </form>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
