import type { ReactNode } from "react";

type ToolBtnProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
};

export function ToolBtn({ onClick, active, disabled, title, children }: ToolBtnProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={[
        "inline-flex h-6 w-6 items-center justify-center rounded-md transition",
        active
          ? "bg-[#1d4f91] text-white shadow-[inset_0_0_0_1px_rgba(191,219,254,0.38)]"
          : "text-[#5f6f86] hover:bg-[#e8eef5] hover:text-[#1f2937] dark:text-[#94a3b8] dark:hover:bg-[#1f2937] dark:hover:text-[#e2e8f0]",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

type ToolbarGroupProps = {
  label: string;
  children: ReactNode;
};

export function ToolbarGroup({ label: _label, children }: ToolbarGroupProps) {
  return (
    <div className="mr-1 inline-flex flex-wrap items-center gap-0.5 border-r border-[#dbe5ee] pr-1 last:mr-0 last:border-r-0 last:pr-0 dark:border-[#233146]">
      {children}
    </div>
  );
}
