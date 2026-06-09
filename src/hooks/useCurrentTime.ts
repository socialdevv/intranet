import { useMemo, useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();

let nowMs = Date.now();
let intervalId: number | null = null;

export const CURRENT_TIME_TICK_INTERVAL_MS = 30_000;

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function refreshNow(): void {
  nowMs = Date.now();
  notify();
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "visible") {
    refreshNow();
  }
}

function handleWindowFocus(): void {
  refreshNow();
}

function startClock(): void {
  if (typeof window === "undefined" || intervalId !== null) return;

  intervalId = window.setInterval(() => {
    refreshNow();
  }, CURRENT_TIME_TICK_INTERVAL_MS);

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleWindowFocus);
}

function stopClock(): void {
  if (typeof window === "undefined") return;

  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }

  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleWindowFocus);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    refreshNow();
    startClock();
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopClock();
    }
  };
}

function getSnapshot(): number {
  return nowMs;
}

export function useCurrentTime(): Date {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => new Date(timestamp), [timestamp]);
}
