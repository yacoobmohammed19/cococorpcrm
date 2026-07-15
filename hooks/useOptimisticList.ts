"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { runAction } from "@/lib/action-utils";

type Toast = { success: (m: string) => void; error: (m: string) => void };
type Messages = { success: string; error?: string };
type Key = number | string;

/**
 * Optimistic list state for server-component-backed pages.
 *
 * The page (a server component) fetches rows and passes them as `initial`.
 * This hook mirrors them into local state so create/update/delete reflect in
 * the UI *immediately* — the modal can close and the row can appear without
 * waiting for the ~transatlantic round-trip to Supabase.
 *
 * Flow per mutation:
 *   1. Snapshot current state and apply the optimistic change right away.
 *   2. Fire the server action in the background (via runAction → toasts).
 *   3. On success, the action's revalidatePath streams fresh props; the effect
 *      below re-syncs `items` to the authoritative server data.
 *   4. On failure, roll back to the snapshot and show the error toast.
 *
 * Rows are identified by a key (number or string). By default that key is the
 * `id` field; pass `getKey` to key on a different field (e.g. `user_id` for
 * membership rows). For creates, pass a temporary key (e.g. `-Date.now()`); it
 * is replaced by the real row when revalidation lands.
 */
export function useOptimisticList<T>(
  initial: T[],
  toast: Toast,
  getKey: (item: T) => Key = item => (item as { id: Key }).id,
) {
  const [items, setItems] = useState<T[]>(initial);

  // Re-sync when the server sends fresh props (after a revalidatePath refresh).
  // React-recommended "adjust state during render" pattern — no effect needed, so
  // it can't trigger the cascading-render / set-state-in-effect lint rule. `initial`
  // only changes reference when the server component re-renders (navigation or
  // revalidation), never on a purely client-side optimistic update.
  const [prevInitial, setPrevInitial] = useState(initial);
  if (initial !== prevInitial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  // Always-fresh mirror so background rollbacks never read a stale snapshot.
  // Updated after commit (in an effect) rather than during render — `run` only
  // reads it from within async callbacks, where ref access is allowed.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const run = useCallback(
    async (
      apply: (prev: T[]) => T[],
      action: () => Promise<unknown>,
      messages: Messages,
    ): Promise<boolean> => {
      const snapshot = itemsRef.current;
      setItems(apply);
      const ok = await runAction(action, toast, messages.success, messages.error);
      if (!ok) setItems(snapshot); // roll back the optimistic change
      return ok;
    },
    [toast],
  );

  const add = useCallback(
    (item: T, action: () => Promise<unknown>, messages: Messages) =>
      run(prev => [item, ...prev], action, messages),
    [run],
  );

  const update = useCallback(
    (key: Key, patch: Partial<T>, action: () => Promise<unknown>, messages: Messages) =>
      run(prev => prev.map(x => (getKey(x) === key ? { ...x, ...patch } : x)), action, messages),
    [run, getKey],
  );

  const remove = useCallback(
    (key: Key, action: () => Promise<unknown>, messages: Messages) =>
      run(prev => prev.filter(x => getKey(x) !== key), action, messages),
    [run, getKey],
  );

  const removeMany = useCallback(
    (keys: Key[], action: () => Promise<unknown>, messages: Messages) => {
      const set = new Set(keys);
      return run(prev => prev.filter(x => !set.has(getKey(x))), action, messages);
    },
    [run, getKey],
  );

  return { items, add, update, remove, removeMany, setItems };
}
