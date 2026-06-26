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

// Tiempo entre cada consulta de "¿hay algo nuevo?" por tabla.
const POLL_INTERVAL_MS = 6000;

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
//   5. Polling: cada POLL_INTERVAL_MS este dispositivo pregunta "¿hay algo
//      nuevo?" con un select normal — NO usa el servicio Realtime de Supabase
//      (sin conexión WebSocket persistente), así que no cuenta contra esa
//      cuota. A cambio, los cambios de otros dispositivos tardan hasta
//      POLL_INTERVAL_MS en aparecer, en vez de ser instantáneos.
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
  const lastWriteAt  = useRef(0); // para ignorar el propio polling justo después de escribir

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

  // ── Polling: preguntar periódicamente si OTRO dispositivo cambió la fila ───
  // Usa select normal (REST), no Realtime — cero conexiones WebSocket, cero
  // uso de la cuota de Realtime de Supabase.
  useEffect(() => {
    let cancelled = false;
    const poll = setInterval(async () => {
      if (cancelled || !hasMounted.current) return;
      // Si este mismo dispositivo acaba de escribir hace poco, nos saltamos
      // este ciclo — evita pisar una edición local muy reciente con el eco
      // de nuestra propia escritura, o una carrera contra el siguiente cambio
      // que el usuario ya esté haciendo.
      if (Date.now() - lastWriteAt.current < POLL_INTERVAL_MS) return;

      const remote = await cloudRead(table);
      if (cancelled || remote === null) return;

      // Comparación simple por contenido — solo actualiza el estado si la
      // data remota es realmente distinta de lo que ya tenemos, para no
      // forzar re-renders ni animaciones innecesarias cada 6 segundos.
      const remoteStr = JSON.stringify(remote);
      const localStr  = JSON.stringify(latestValue.current);
      if (remoteStr !== localStr) setValue(remote);
    }, POLL_INTERVAL_MS);

    return () => { cancelled = true; clearInterval(poll); };
  }, [table, setValue]);
}

