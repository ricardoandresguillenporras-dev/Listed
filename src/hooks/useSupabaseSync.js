import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { SYNC_ID } from './householdId';

// ── Low-level helpers ─────────────────────────────────────────────────────────
// NOTA: la columna en Supabase sigue llamándose `device_id` por compatibilidad
// con las tablas ya creadas — pero ahora puede contener un código de hogar
// compartido (ej. "CASA-7F3K") en vez de un UUID propio de un solo dispositivo.
// Varios dispositivos que usan el mismo valor aquí leen/escriben la misma fila.

// Upsert a single row in `table` for this device/household.
async function cloudWrite(table, data) {
  const { error } = await supabase
    .from(table)
    .upsert({ device_id: SYNC_ID, data }, { onConflict: 'device_id' })
    .select();
  if (error) console.warn(`[Supabase] write ${table}:`, error.message);
}

// Read the row for this device/household from `table`. Returns null on miss/error.
async function cloudRead(table) {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('device_id', SYNC_ID)
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
//   5. Realtime: se suscribe a cambios en la fila de este SYNC_ID — si otro
//      dispositivo (mismo código de hogar) escribe, este recibe el cambio al
//      instante sin necesidad de recargar la app. Esto es lo que hace que
//      varias personas vean la lista actualizada en vivo entre ellas.
//
// LIMITACIÓN CONOCIDA — sin merge fino: cada escritura sube el documento
// COMPLETO (todas las listas, todo el perfil, etc., según la tabla). Si dos
// personas editan al mismo tiempo en dispositivos distintos, la última
// escritura gana y puede pisar cambios de la otra persona que no se habían
// guardado aún. Para una lista de compras familiar esto es normalmente
// aceptable (los cambios son rápidos y se notan), pero no es un merge real
// campo por campo — es reemplazo total del documento.

export function useSupabaseSync(table, value, setValue, defaultValue) {
  const hasMounted   = useRef(false);
  const writeTimer   = useRef(null);
  const latestValue  = useRef(value);
  const lastWriteAt  = useRef(0); // para ignorar el eco de nuestra propia escritura via Realtime

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
      lastWriteAt.current = Date.now();
      cloudWrite(table, latestValue.current);
    }, 400);
  }, [table]);

  useEffect(() => {
    debouncedWrite();
    return () => clearTimeout(writeTimer.current);
  }, [value, debouncedWrite]);

  // ── Realtime: escuchar cambios de OTROS dispositivos en la misma fila ──────
  useEffect(() => {
    const channel = supabase
      .channel(`sync-${table}-${SYNC_ID}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table, filter: `device_id=eq.${SYNC_ID}` },
        (payload) => {
          // Ignorar el eco de nuestra propia escritura reciente (< 1.5s) — si no,
          // cada vez que este mismo dispositivo escribe, Realtime le devolvería
          // su propio cambio y forzaría un re-render innecesario (o, peor, una
          // carrera contra un cambio local más nuevo que el usuario ya hizo).
          if (Date.now() - lastWriteAt.current < 1500) return;
          const incoming = payload.new?.data;
          if (incoming !== undefined) setValue(incoming);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [table, setValue]);
}

