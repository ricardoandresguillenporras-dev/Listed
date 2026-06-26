// ── Household ID ────────────────────────────────────────────────────────────
// Identidad compartida para sincronizar varios dispositivos en la nube SIN
// pedir login. Por defecto cada dispositivo tiene su propio ID aleatorio
// (igual que antes), pero cualquiera puede "unirse" a un código de hogar
// compartido para que su dispositivo lea/escriba la misma fila en Supabase
// que el resto de su familia/roommates.
//
// IMPORTANTE — esto NO es seguridad real: cualquier persona que conozca el
// código puede leer y escribir esos datos desde cualquier lugar, sin ninguna
// verificación. Es una decisión consciente para evitar pedir login; está bien
// para una lista de compras, no para datos sensibles.

const KEY = 'sl5_device_id'; // se mantiene el mismo nombre de localStorage que
                              // ya existía, para no perder el ID de quien ya
                              // estaba usando la app antes de este cambio

const HOUSEHOLD_FLAG_KEY = 'sl5_is_household_code'; // 'true' si el ID actual
                              // es un código de hogar compartido (no el
                              // aleatorio original del dispositivo)

// Genera un código corto, fácil de leer y compartir en voz alta o por chat.
// Ej: "CASA-7F3K". No usa caracteres ambiguos (0/O, 1/I/L).
const SAFE_CHARS = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function randomCode(len = 4) {
  let out = "";
  for (let i = 0; i < len; i++) out += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  return out;
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// El ID que se usa AHORA MISMO para sincronizar (dispositivo propio, o código
// de hogar si el usuario se unió a uno). Se calcula una vez al cargar el
// módulo — si el usuario crea/se une a un hogar, hay que recargar la app
// (igual que cambiar de cuenta en cualquier app sin estado reactivo de auth).
export const SYNC_ID = getOrCreateDeviceId();

export function isHouseholdCode() {
  return localStorage.getItem(HOUSEHOLD_FLAG_KEY) === 'true';
}

// Genera un código de hogar nuevo a partir del ID actual del dispositivo —
// es decir, "convierte" este dispositivo en el primero del hogar, y el código
// resultante es lo que comparten los demás para unirse a la misma data.
// No crea una fila nueva: el dispositivo actual sigue siendo el dueño de su
// data existente, solo le pone una etiqueta legible.
export function createHouseholdCode() {
  const code = `CASA-${randomCode()}`;
  localStorage.setItem(KEY, code);
  localStorage.setItem(HOUSEHOLD_FLAG_KEY, 'true');
  return code;
}

// Une este dispositivo a un código de hogar existente — a partir de este
// momento, este dispositivo lee/escribe la misma fila que todos los demás
// que usen el mismo código. La data local actual de este dispositivo se
// PIERDE de la vista local (no se borra de Supabase, solo deja de mostrarse
// aquí) en cuanto la app recargue y jale la data del hogar.
export function joinHousehold(code) {
  const clean = code.trim().toUpperCase();
  if (!clean) return false;
  localStorage.setItem(KEY, clean);
  localStorage.setItem(HOUSEHOLD_FLAG_KEY, 'true');
  return true;
}

// Deja el hogar compartido y vuelve a un ID aleatorio propio de este
// dispositivo (data nueva, vacía — la del hogar se queda en Supabase intacta).
export function leaveHousehold() {
  localStorage.removeItem(HOUSEHOLD_FLAG_KEY);
  localStorage.setItem(KEY, crypto.randomUUID());
}

export function currentSyncId() {
  return localStorage.getItem(KEY);
}
