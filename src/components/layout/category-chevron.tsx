export function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-90" : "rotate-0"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
