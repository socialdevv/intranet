import { useState } from "react";
import { Clock, GitBranch } from "lucide-react";
import MatrixPreviewModal from "@/components/knowledge/matrix-preview-modal";
import type { MatrixDecision } from "@/lib/types/domain";

interface Props {
  entry: MatrixDecision;
}

export default function MatrixLinkedBlock({ entry }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="my-6">
        {/* Section label — outside the card, matches sticky panel's outer heading */}
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <GitBranch size={11} className="shrink-0 text-[#1d4f91] dark:text-[#60a5fa]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[#1d4f91] dark:text-[#60a5fa]">
            Powiązana procedura macierzowa
          </span>
        </div>

        {/* Card button — identical to sticky panel card: same padding, same tokens, same layout */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full rounded-xl border border-[#c3d6ea] bg-[#eff6ff]/60 px-3 py-2.5 text-left transition hover:border-[#1d4f91]/50 hover:bg-[#eff6ff] hover:shadow-sm dark:border-[#1e3a5f] dark:bg-[#0f2340]/60 dark:hover:border-[#2563eb]/60 dark:hover:bg-[#0f2340]"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1d4f91]/70 dark:text-[#60a5fa]/70">
            {entry.category}
          </p>
          <p className="text-xs font-semibold leading-snug text-[#0f172a] dark:text-[#e2e8f0]">
            {entry.subcategory || entry.category}
          </p>
          {(entry.defaultDepartment || entry.slaDays != null) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-3">
              {entry.defaultDepartment && (
                <span className="text-[10px] text-[#64748b] dark:text-[#94a3b8]">
                  {entry.defaultDepartment}
                </span>
              )}
              {entry.slaDays != null && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1d4f91] dark:text-[#60a5fa]">
                  <Clock size={10} />
                  Czas realizacji: {entry.slaDays} {entry.slaDays === 1 ? "dzień" : "dni"}
                </span>
              )}
            </div>
          )}
        </button>
      </div>

      {modalOpen && (
        <MatrixPreviewModal entry={entry} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
