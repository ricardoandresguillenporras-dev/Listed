import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ── Device ID ─────────────────────────────────────────────────────────────────
// Generated once per device, stored in localStorage forever.
// This is the anonymous identity that ties all cloud rows to this device.
function getDeviceId() {
  const KEY = 'sl5_device_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export const DEVICE_ID = getDeviceId();

// ── Low-level helpers ─────────────────────────────────────────────────────────

// Upsert a single row in `table` for this device.
async function cloudWrite(table, data) {
  const { error } = await supabase
    .from(table)
    .upsert({ device_id: DEVICE_ID, data }, { onConflict: 'device_id' })
    .select();
  if (error) console.warn(`[Supabase] write ${table}:`, error.message);
}

// Read the row for this device from `table`. Returns null on miss/error.
async function cloudRead(table) {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('device_id', DEVICE_ID)
    .maybeSingle();
  if (error) { console.warn(`[Supabase] read ${table}:`, error.message); return null; }
  return data?.data ?? null;
}

// ── useSupabaseSync ───────────────────────────────────────────────────────────
// Drop-in layer over an existing React state value.
//
// Usage (in SuperLista):
//   useSupabaseSync('sl_lists', lists, setLists, defaultLists);
//
// Behaviour:
//   1. On mount: load from Supabase; if found, overwrite local state + LS cache.
//   2. On every state change: debounced write to Supabase (400 ms, same cadence
//      as the existing LS debounce so they stay in sync).
//   3. Writes are fire-and-forget; failures are logged but never crash the app.
//   4. Works offline — LS is still written first, cloud syncs when available.

export function useSupabaseSync(table, value, setValue, defaultValue) {
  const hasMounted   = useRef(false);
  const writeTimer   = useRef(null);
  const latestValue  = useRef(value);

  // Keep ref current so the debounced write always serialises the latest value.
  useEffect(() => { latestValue.current = value; }, [value]);

  // ── Mount: pull from cloud ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await cloudRead(table);
      if (cancelled) return;
      if (remote !== null) {
        setValue(remote);
      }
      hasMounted.current = true;
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once

  // ── State change: debounced cloud write ────────────────────────────────────
  const debouncedWrite = useCallback(() => {
    if (!hasMounted.current) return; // don't write before the initial load resolves
    clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      cloudWrite(table, latestValue.current);
    }, 400);
  }, [table]);

  useEffect(() => {
    debouncedWrite();
    return () => clearTimeout(writeTimer.current);
  }, [value, debouncedWrite]);
}
