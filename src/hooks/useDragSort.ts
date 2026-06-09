import { useRef, useState } from "react";

/**
 * Generic drag-sort hook for ordered lists.
 * Calls `onReorder` with the reordered array after a successful drop.
 */
export function useDragSort<T extends { id: string }>(
  items: T[],
  onReorder: (reordered: T[]) => void | Promise<void>
) {
  const dragIdx = useRef<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setOverIdx(idx);
  }

  function onDrop(e: React.DragEvent, idx: number) {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) {
      dragIdx.current = null;
      setOverIdx(null);
      return;
    }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    void Promise.resolve(onReorder(next)).catch((error) => {
      console.error("Drag reorder failed", error);
    });
    dragIdx.current = null;
    setOverIdx(null);
  }

  function onDragEnd() {
    dragIdx.current = null;
    setOverIdx(null);
  }

  return { overIdx, onDragStart, onDragOver, onDrop, onDragEnd };
}
