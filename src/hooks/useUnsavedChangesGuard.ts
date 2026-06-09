import { useCallback, useContext, useEffect, useRef } from "react";
import { UNSAFE_NavigationContext as NavigationContext, useBeforeUnload } from "react-router-dom";

type UseUnsavedChangesGuardOptions = {
  hasUnsavedChanges: boolean;
  isSaving?: boolean;
  message?: string;
};

const DEFAULT_MESSAGE = "Masz niezapisane zmiany. Czy na pewno chcesz opuscic ten ekran?";

function sortForStableSerialize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortForStableSerialize);
  }

  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort()) {
      sorted[key] = sortForStableSerialize(input[key]);
    }
    return sorted;
  }

  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(sortForStableSerialize(value));
}

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  isSaving = false,
  message = DEFAULT_MESSAGE,
}: UseUnsavedChangesGuardOptions) {
  const bypassRef = useRef(false);
  const navigationContext = useContext(NavigationContext);

  const shouldBlockNavigation = useCallback(() => {
    return hasUnsavedChanges && !isSaving && !bypassRef.current;
  }, [hasUnsavedChanges, isSaving]);

  useEffect(() => {
    if (!shouldBlockNavigation()) {
      return;
    }

    const navigatorWithBlock = navigationContext.navigator as {
      block?: (callback: (tx: { retry: () => void }) => void) => () => void;
    };

    if (!navigatorWithBlock.block) {
      return;
    }

    let release: () => void = () => {};
    release = navigatorWithBlock.block((tx) => {
      if (!shouldBlockNavigation()) {
        release();
        tx.retry();
        return;
      }

      const confirmed = window.confirm(message);
      if (!confirmed) {
        return;
      }

      bypassRef.current = true;
      release();
      tx.retry();
      window.setTimeout(() => {
        bypassRef.current = false;
      }, 0);
    });

    return () => release();
  }, [message, navigationContext.navigator, shouldBlockNavigation]);

  useBeforeUnload(
    useCallback((event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges || isSaving || bypassRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }, [hasUnsavedChanges, isSaving]),
    { capture: true },
  );

  const allowNextNavigation = useCallback(() => {
    bypassRef.current = true;
    window.setTimeout(() => {
      bypassRef.current = false;
    }, 0);
  }, []);

  return { allowNextNavigation };
}
