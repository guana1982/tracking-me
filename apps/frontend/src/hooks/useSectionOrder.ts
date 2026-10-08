import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

/**
 * Order of the sections in a diary rail, remembered per user and per device.
 *
 * Local rather than server-side on purpose: it is a layout preference, and a
 * phone and a desktop legitimately want different ones. Keyed by user id so a
 * shared browser does not hand one person's layout to another.
 */
export function useSectionOrder(railKey: string, defaults: readonly string[]) {
  const userId = useAuthStore((state) => state.user?.id ?? 'anon');
  const storageKey = `diary-order:${railKey}:${userId}`;

  const [order, setOrder] = useState<string[]>(() => reconcile(read(storageKey), defaults));

  // The key changes when the user does; re-read instead of keeping the old one
  useEffect(() => {
    setOrder(reconcile(read(storageKey), defaults));
    // defaults is a module-level constant in every call site
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback(
    (next: string[]) => {
      setOrder(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // A full or blocked storage costs the preference, never the feature
      }
    },
    [storageKey]
  );

  /** Moves one step up (-1) or down (+1), for touch and keyboard */
  const move = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = order.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= order.length) return;
      const next = [...order];
      [next[from], next[to]] = [next[to], next[from]];
      persist(next);
    },
    [order, persist]
  );

  /** Drops `dragId` onto the place currently held by `targetId` */
  const moveTo = useCallback(
    (dragId: string, targetId: string) => {
      if (dragId === targetId) return;
      const from = order.indexOf(dragId);
      const to = order.indexOf(targetId);
      if (from < 0 || to < 0) return;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, dragId);
      persist(next);
    },
    [order, persist]
  );

  const reset = useCallback(() => {
    persist([...defaults]);
  }, [defaults, persist]);

  const isCustom = order.join('|') !== [...defaults].join('|');

  return { order, move, moveTo, reset, isCustom };
}

function read(storageKey: string): string[] | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

/**
 * A saved order is a preference, not a whitelist: sections added since it was
 * saved are appended rather than lost, and sections that no longer exist are
 * dropped. Without this, shipping a new card would hide it from anyone who had
 * ever reordered.
 */
function reconcile(saved: string[] | null, defaults: readonly string[]): string[] {
  if (!saved) return [...defaults];
  const known = saved.filter((id) => defaults.includes(id));
  const added = defaults.filter((id) => !known.includes(id));
  return [...known, ...added];
}
