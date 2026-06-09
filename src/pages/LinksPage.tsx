import AppShell from "@/components/layout/app-shell";
import { useAuth } from "@/contexts/auth-context";
import { useData } from "@/contexts/data-context";
import { canEditContent } from "@/lib/auth/authorization";
import { adminLinkEditorPath } from "@/lib/routes";
import { resolveIcon } from "@/lib/utils/link-icons";
import type { LinkItem } from "@/lib/types/domain";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

export default function LinksPage() {
  const { user } = useAuth();
  const { links, linksModule } = useData();
  const { canWrite } = linksModule;
  const canEdit = canEditContent(user) && canWrite;
  const [searchParams] = useSearchParams();
  const linkedId = searchParams.get("link");

  const sorted = [...links].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!linkedId) return;
    requestAnimationFrame(() => {
      document.getElementById(`link-${linkedId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [linkedId]);

  return (
    <AppShell currentUser={user} searchPlaceholder="Szukaj w całej bazie wiedzy…">
      <div className="mx-auto w-full max-w-280 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0f172a] dark:text-[#f1f5f9]">
              Linki
            </h1>
            <p className="mt-0.5 text-sm text-[#64748b]">
              Przydatne linki do codziennej pracy.
            </p>
          </div>
          {canEdit && (
            <Link
              to={adminLinkEditorPath("nowy")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580]"
            >
              <PlusIcon />
              Dodaj link
            </Link>
          )}
        </div>

        {/* Links list */}
        {sorted.length === 0 ? (
          <EmptyState isAdmin={canEdit} />
        ) : (
          <div className="flex flex-col gap-2">
            {sorted.map((link) => (
              <LinkCard key={link.id} link={link} isAdmin={canEdit} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LinkCard({ link, isAdmin }: { link: LinkItem; isAdmin: boolean }) {
  const icon = resolveIcon(link.icon);
  const shouldOpenNewTab = !link.isInternal && link.openInNewTab;

  const content = (
    <div className="group flex items-center gap-4 rounded-xl border border-[#dde5ee] bg-white px-5 py-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition duration-150 hover:-translate-y-px hover:border-[#c4d0de] hover:shadow-[0_4px_16px_rgba(15,23,42,0.08)] dark:border-[#334155] dark:bg-[#1e293b] dark:hover:border-[#475569]">
      {/* Icon */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf3fa] text-[#1d4f91] transition group-hover:bg-[#e5eef9] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">
          {link.title}
        </p>
        {link.description && (
          <p className="mt-0.5 truncate text-xs text-[#64748b] dark:text-[#94a3b8]">
            {link.description}
          </p>
        )}
      </div>

      {/* External indicator + admin edit */}
      <div className="flex shrink-0 items-center gap-2">
        {!link.isInternal && (
          <ExternalLinkIcon className="size-3.5 text-[#94a3b8]" />
        )}
        {isAdmin && (
          <Link
            to={adminLinkEditorPath(link.id)}
            onClick={(e) => e.stopPropagation()}
            className="rounded p-1 text-[#94a3b8] opacity-0 transition hover:text-[#475569] group-hover:opacity-100 dark:hover:text-[#cbd5e1]"
            aria-label="Edytuj link"
          >
            <EditIcon />
          </Link>
        )}
        <ChevronRightIcon className="size-4 text-[#cbd5e1] transition group-hover:text-[#94a3b8] dark:text-[#334155]" />
      </div>
    </div>
  );

  if (link.isInternal) {
    return (
      <div id={`link-${link.id}`}>
        <Link to={link.url}>
          {content}
        </Link>
      </div>
    );
  }

  return (
    <div id={`link-${link.id}`}>
      <a
        href={link.url}
        target={shouldOpenNewTab ? "_blank" : "_self"}
        rel={shouldOpenNewTab ? "noopener noreferrer" : undefined}
      >
        {content}
      </a>
    </div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-20 text-center dark:border-[#334155] dark:bg-[#1a2535]">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3fa] text-[#1d4f91] dark:bg-[#1e3a5f] dark:text-[#93c5fd]">
        <LinkIcon className="size-7" />
      </div>
      <p className="text-base font-semibold text-[#374151] dark:text-[#e2e8f0]">
        Brak linków
      </p>
      <p className="mt-1 text-sm text-[#6b7280] dark:text-[#94a3b8]">
        {isAdmin
          ? "Dodaj pierwszy link, klikając przycisk powyżej."
          : "Żaden link nie został jeszcze dodany."}
      </p>
      {isAdmin && (
        <Link
          to={adminLinkEditorPath("nowy")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580]"
        >
          <PlusIcon />
          Dodaj link
        </Link>
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? "size-4"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
