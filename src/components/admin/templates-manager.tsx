import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, Plus } from "lucide-react";
import { useData } from "@/contexts/data-context";
import { adminTemplateEditorPath } from "@/lib/routes";

const CHANNEL_ORDER = ["email", "zgloszenie"] as const;

const CHANNEL_LABEL: Record<(typeof CHANNEL_ORDER)[number], string> = {
  email: "E-mail",
  zgloszenie: "Zgłoszenie",
};

export default function TemplatesManager() {
  const { templates, templatesModule } = useData();
  const canReorder = templatesModule.canReorder && templatesModule.canWrite && !templatesModule.isMutating;

  const sortedTemplates = [...templates].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "pl")
  );

  const groupedTemplates = CHANNEL_ORDER.map((channel) => ({
    channel,
    templates: sortedTemplates.filter((template) => template.channel === channel),
  })).filter((group) => group.templates.length > 0);

  function moveWithinChannel(channel: (typeof CHANNEL_ORDER)[number], index: number, direction: -1 | 1) {
    if (!canReorder) return;

    const channelTemplates = sortedTemplates.filter((template) => template.channel === channel);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= channelTemplates.length) return;

    const swappedInChannel = [...channelTemplates];
    [swappedInChannel[index], swappedInChannel[targetIndex]] = [
      swappedInChannel[targetIndex],
      swappedInChannel[index],
    ];

    // Keep cross-channel positions intact and only update order among templates from the chosen channel.
    let channelCursor = 0;
    const merged = sortedTemplates.map((template) => {
      if (template.channel !== channel) return template;
      const nextTemplate = swappedInChannel[channelCursor];
      channelCursor += 1;
      return nextTemplate;
    });

    templatesModule.reorderTemplates(merged);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f1f5f9]">Szablony</h3>
          <p className="mt-0.5 text-xs text-[#64748b] dark:text-[#94a3b8]">
            Zarządzaj kolejnością wyświetlania szablonów.
          </p>
        </div>
        <Link
          to={adminTemplateEditorPath("nowy")}
          aria-disabled={!templatesModule.canWrite}
          className={`inline-flex items-center gap-1.5 rounded-lg bg-[#1d4f91] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1a4580] ${
            templatesModule.canWrite ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <Plus size={14} />
          Nowy szablon
        </Link>
      </div>

      {!templatesModule.canReorder && (
        <div className="rounded-xl border border-[#d9e2ec] bg-[#f8fafc] px-4 py-3 text-xs text-[#64748b] dark:border-[#334155] dark:bg-[#1a2535] dark:text-[#94a3b8]">
          Zmiana kolejności jest tymczasowo niedostępna. Dodawanie, edycja i usuwanie działają normalnie.
        </div>
      )}

      {sortedTemplates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#d1d9e0] bg-[#f8fafc] py-14 text-center dark:border-[#334155] dark:bg-[#1a2535]">
          <p className="text-sm text-[#6b7280] dark:text-[#94a3b8]">Brak szablonów.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedTemplates.map((group) => (
            <div
              key={group.channel}
              className="overflow-hidden rounded-xl border border-[#dde5ee] bg-white dark:border-[#1e3a5f] dark:bg-[#0d1b2e]"
            >
              <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-2.5 dark:border-[#1e293b]">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b] dark:text-[#94a3b8]">
                  {CHANNEL_LABEL[group.channel]}
                </p>
                <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#64748b] dark:bg-[#1e293b] dark:text-[#94a3b8]">
                  {group.templates.length}
                </span>
              </div>

              <div className="divide-y divide-[#f1f5f9] dark:divide-[#1e293b]">
                {group.templates.map((template, index) => {
                  const canMoveUp = index > 0;
                  const canMoveDown = index < group.templates.length - 1;

                  return (
                    <div key={template.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveWithinChannel(group.channel, index, -1)}
                          disabled={!canMoveUp || !canReorder}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                          aria-label="Przesuń szablon wyżej"
                          title="Przesuń wyżej"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveWithinChannel(group.channel, index, 1)}
                          disabled={!canMoveDown || !canReorder}
                          className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#e5e7eb] text-[#94a3b8] transition hover:bg-[#f1f5f9] disabled:cursor-not-allowed disabled:opacity-25 dark:border-[#334155] dark:hover:bg-[#1e293b]"
                          aria-label="Przesuń szablon niżej"
                          title="Przesuń niżej"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#0f172a] dark:text-[#f1f5f9]">
                          {template.title}
                        </p>
                      </div>

                      <Link
                        to={adminTemplateEditorPath(template.id)}
                        className="shrink-0 rounded-lg border border-[#d9e2ec] bg-white px-2.5 py-1.5 text-xs font-medium text-[#374151] transition hover:border-[#94a3b8] dark:border-[#334155] dark:bg-[#263347] dark:text-[#cbd5e1]"
                      >
                        Edytuj
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
