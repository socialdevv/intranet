import { AlertTriangle } from "lucide-react";
import { useData } from "@/contexts/data-context";

type Props = {
  className?: string;
};

export default function PersistenceStateBanner({ className = "" }: Props) {
  const { persistenceState } = useData();

  if (persistenceState.uploadCapability === "configured") {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e] dark:border-[#78350f] dark:bg-[#2b2110] dark:text-[#fde68a] ${className}`.trim()}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Upload plików nie jest skonfigurowany</p>
          <p className="mt-1 text-xs leading-5 opacity-90">
            Skonfiguruj endpoint API uploadu (`/api/v1/uploads`) lub ustaw `VITE_ALTCLOUD_API_BASE_URL` dla trybu cross-origin.
          </p>
        </div>
      </div>
    </div>
  );
}
