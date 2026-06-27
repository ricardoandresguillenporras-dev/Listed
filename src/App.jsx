import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { App as CapApp } from "@capacitor/app";
import { useSupabaseSync } from "./hooks/useSupabaseSync";
import { currentSyncId, isHouseholdCode, createHouseholdCode, joinHousehold, leaveHousehold } from "./hooks/householdId";

// ── Theme wallpaper backgrounds — gingham + daisy pattern per theme ──
import bgGreen from "./assets/bg-green.webp";
import bgPink from "./assets/bg-pink.webp";
import bgPurple from "./assets/bg-purple.webp";

// ── 🔊 Sound Engine (Web Audio API — 100% copyright-free synthesized sounds) ──
// All sounds are generated algorithmically; no audio files, no licensing issues.
function createAudioCtx() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
}

// Shared lazy context — created on first user gesture
let _actx = null;
function getCtx() {
  if (!_actx) _actx = createAudioCtx();
  if (_actx && _actx.state === "suspended") _actx.resume();
  return _actx;
}

// Low-level helpers
function playTone(ctx, { freq = 440, type = "sine", gain = 0.18, start = 0, dur = 0.12, attack = 0.008, decay = 0.06, detune = 0 }) {
  const now = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  osc.detune.setValueAtTime(detune, now);
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(gain, now + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
  osc.connect(env); env.connect(ctx.destination);
  osc.start(now); osc.stop(now + dur);
}

function playNoise(ctx, { gain = 0.06, start = 0, dur = 0.08, freq = 800, q = 0.8 }) {
  const now = ctx.currentTime + start;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const flt = ctx.createBiquadFilter();
  flt.type = "bandpass"; flt.frequency.value = freq; flt.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, now);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(flt); flt.connect(env); env.connect(ctx.destination);
  src.start(now); src.stop(now + dur);
}

// ── Named sound effects ───────────────────────────────────────────────────────
const Sounds = {
  // ✅ Item checked into bag — satisfying upward "ding" with sparkle
  checkItem() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 523,  type: "triangle", gain: 0.22, dur: 0.18, decay: 0.12 });
    playTone(ctx, { freq: 784,  type: "triangle", gain: 0.14, start: 0.06, dur: 0.18, decay: 0.14 });
    playTone(ctx, { freq: 1047, type: "sine",     gain: 0.09, start: 0.12, dur: 0.22, decay: 0.18 });
  },
  // ↩️ Item unchecked — soft descending "pop"
  uncheckItem() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 660,  type: "triangle", gain: 0.14, dur: 0.12, decay: 0.10 });
    playTone(ctx, { freq: 440,  type: "sine",     gain: 0.09, start: 0.05, dur: 0.14, decay: 0.12 });
  },
  // ➕ Item added to list — cheerful "blip"
  addItem() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 698,  type: "sine",     gain: 0.16, dur: 0.10, decay: 0.08 });
    playTone(ctx, { freq: 880,  type: "triangle", gain: 0.10, start: 0.05, dur: 0.14, decay: 0.10 });
  },
  // 🗑️ Item deleted — soft downward "whomp"
  deleteItem() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 300,  type: "sine",     gain: 0.15, dur: 0.14, decay: 0.12 });
    playTone(ctx, { freq: 180,  type: "triangle", gain: 0.09, start: 0.04, dur: 0.18, decay: 0.16 });
    playNoise(ctx, { gain: 0.04, freq: 250, dur: 0.10 });
  },
  // 🛍️ Checkout / close session — festive ascending fanfare
  checkout() {
    const ctx = getCtx(); if (!ctx) return;
    const melody = [523, 659, 784, 1047];
    melody.forEach((f, i) => playTone(ctx, { freq: f, type: "triangle", gain: 0.18 - i * 0.02, start: i * 0.09, dur: 0.20, decay: 0.18, attack: 0.010 }));
    // sparkle on top
    playTone(ctx, { freq: 1568, type: "sine", gain: 0.09, start: 0.35, dur: 0.24, decay: 0.22 });
    playTone(ctx, { freq: 2093, type: "sine", gain: 0.06, start: 0.44, dur: 0.28, decay: 0.26 });
  },
  // 📋 List created — warm "open" chord
  createList() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 392,  type: "triangle", gain: 0.16, dur: 0.20, decay: 0.18 });
    playTone(ctx, { freq: 523,  type: "triangle", gain: 0.12, start: 0.04, dur: 0.20, decay: 0.18 });
    playTone(ctx, { freq: 659,  type: "sine",     gain: 0.08, start: 0.08, dur: 0.24, decay: 0.22 });
  },
  // 🔢 Qty change — subtle "tick"
  qtyChange() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 1200, type: "sine",     gain: 0.10, dur: 0.06, decay: 0.05 });
    playNoise(ctx, { gain: 0.03, freq: 2400, q: 0.5, dur: 0.04 });
  },
  // 🔔 Budget over-limit — urgent warning buzz
  budgetAlert() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 220,  type: "sawtooth", gain: 0.12, dur: 0.14, decay: 0.10 });
    playTone(ctx, { freq: 185,  type: "sawtooth", gain: 0.10, start: 0.08, dur: 0.14, decay: 0.10 });
  },
  // 🎯 Theme toggle — playful "swish"
  themeToggle() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 880,  type: "sine", gain: 0.12, dur: 0.10, decay: 0.08, detune: 0 });
    playTone(ctx, { freq: 1047, type: "sine", gain: 0.09, start: 0.05, dur: 0.12, decay: 0.10, detune: 200 });
  },
  // ↩️ Navigation back — soft "swoosh"
  navBack() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 600,  type: "sine",     gain: 0.10, dur: 0.09, decay: 0.07 });
    playTone(ctx, { freq: 400,  type: "triangle", gain: 0.07, start: 0.04, dur: 0.11, decay: 0.10 });
  },
  // 💾 Save/confirm — clean double-tick
  save() {
    const ctx = getCtx(); if (!ctx) return;
    playTone(ctx, { freq: 784,  type: "triangle", gain: 0.14, dur: 0.08, decay: 0.06 });
    playTone(ctx, { freq: 1047, type: "triangle", gain: 0.10, start: 0.07, dur: 0.10, decay: 0.09 });
  },
};

// ── ✨ Animation Utilities ─────────────────────────────────────────────────────

// Confetti burst — fires mini colored squares from a position
function spawnConfetti(x, y, count = 18, colors = ["#4ADE80","#FCD34D","#F472B6","#60A5FA","#A78BFA","#FB923C"]) {
  const container = document.getElementById("sl-confetti-root");
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = (Math.random() * 360) * (Math.PI / 180);
    const speed = 60 + Math.random() * 90;
    const dx = Math.cos(angle) * speed;
    const dy = Math.sin(angle) * speed - 40;
    const size = 5 + Math.random() * 6;
    const rot  = Math.random() * 720 - 360;
    el.style.cssText = `
      position:absolute;left:${x}px;top:${y}px;
      width:${size}px;height:${size}px;
      background:${color};border-radius:${Math.random()>0.5?'50%':'2px'};
      pointer-events:none;z-index:9999;
      animation:slConfetti .9s cubic-bezier(.22,.61,.36,1) forwards;
      --dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;
      animation-delay:${Math.random()*0.08}s;
    `;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}

// Floating emoji particle — drifts upward and fades
function spawnEmojiParticle(x, y, emoji) {
  const container = document.getElementById("sl-confetti-root");
  if (!container) return;
  const el = document.createElement("div");
  const dx = (Math.random() - 0.5) * 40;
  el.style.cssText = `
    position:absolute;left:${x - 16}px;top:${y - 16}px;
    font-size:28px;pointer-events:none;z-index:9999;
    animation:slEmojiFloat .85s cubic-bezier(.22,.61,.36,1) forwards;
    --dx:${dx}px;
    user-select:none;
  `;
  el.textContent = emoji;
  container.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// Ripple effect on a DOM element
function ripple(e, color = "rgba(255,255,255,0.35)") {
  const el = e.currentTarget || e.target;
  const rect = el.getBoundingClientRect();
  const x = (e.clientX || e.touches?.[0]?.clientX || rect.left + rect.width/2) - rect.left;
  const y = (e.clientY || e.touches?.[0]?.clientY || rect.top + rect.height/2) - rect.top;
  const r = document.createElement("span");
  const size = Math.max(rect.width, rect.height) * 2;
  r.style.cssText = `
    position:absolute;left:${x - size/2}px;top:${y - size/2}px;
    width:${size}px;height:${size}px;border-radius:50%;
    background:${color};pointer-events:none;z-index:10;
    animation:slRipple .55s ease-out forwards;
  `;
  el.style.position = el.style.position || "relative";
  el.style.overflow = "hidden";
  el.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// Big checkout celebration — many confetti + sparkles
function celebrateCheckout(colors) {
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight * 0.55;
  spawnConfetti(cx, cy, 55, colors);
  // 3 waves
  setTimeout(() => spawnConfetti(cx - 60, cy + 20, 22, colors), 120);
  setTimeout(() => spawnConfetti(cx + 60, cy + 20, 22, colors), 200);
}

// ── CR Preset Prices (₡) ─────────────────────────────────────────────────────
// Precios aproximados en supermercados de Costa Rica (colones), 2025
const CR_PRICES = {
  // Lácteos
  "Leche":              1250,  // 1L Dos Pinos
  "Huevos":             2800,  // cartón 12
  "Queso Mozarela":     3200,  // 250g
  "Queso Turrialba":    4500,  // 400g
  "Crema":              1400,  // 200g Dos Pinos
  "Yogur":              1100,  // 200g
  "Mantequilla":        2400,  // 200g
  "Natilla":            1800,  // 400g
  // Frutas y Verduras
  "Manzanas":           2200,  // kg
  "Plátanos":            800,  // kg
  "Tomates":            1100,  // kg
  "Aguacate":           1800,  // kg
  "Espinacas":          1200,  // bolsa
  "Brócoli":            1500,  // unidad
  "Zanahorias":          900,  // kg
  "Limones":             700,  // bolsa
  "Papaya":             1200,  // kg
  "Piña":               1500,  // unidad
  "Chayote":             600,  // kg
  "Yuca":                800,  // kg
  "Papa":                950,  // kg
  "Cebolla":            1200,  // kg
  "Chile dulce":        2200,  // kg
  "Culantro":            500,  // bolsa
  "Ajo":                1800,  // 100g
  // Despensa
  "Miel":               3500,  // 350g
  "Aceite de Oliva":    5800,  // 500ml
  "Aceite vegetal":     2200,  // 1L
  "Arroz":              1600,  // kg
  "Pasta":              1200,  // 500g
  "Harina":              950,  // kg
  "Sal":                 600,  // kg
  "Azúcar":             1100,  // kg
  "Frijoles":           1800,  // kg
  "Atún":               1400,  // lata 165g
  "Mayonesa":           2100,  // 400g
  "Salsa de tomate":    1300,  // 400g
  "Vinagre":             900,  // 500ml
  "Consomé":             800,  // sobres
  "Aceite de coco":     6500,  // 500ml
  // Carnes
  "Pollo":              3200,  // kg
  "Carne molida":       5500,  // kg
  "Salmón":             8500,  // 300g
  "Jamón":              2800,  // 200g
  "Chorizo":            3200,  // 400g
  "Pescado":            4500,  // kg
  "Costillas":          5800,  // kg
  "Salchichas":         2600,  // 450g
  // Panadería
  "Pan":                1800,  // barra
  "Pan integral":       2200,  // barra
  "Tortillas":          1400,  // paq 12
  "Galletas":           1600,  // paq
  // Bebidas
  "Café":               3800,  // 500g
  "Jugo de naranja":    2100,  // 1L
  "Agua mineral":        800,  // 1.5L
  "Refresco":           1500,  // 2L
  "Cerveza":            1200,  // unidad
  "Leche de avena":     3200,  // 1L
  // Higiene
  "Shampoo":            3200,  // 400ml
  "Jabón":               900,  // unidad
  "Papel de baño":      4500,  // paq 4
  "Pasta de dientes":   2200,  // 150g
  "Desodorante":        3800,  // unidad
  // Limpieza
  "Cloro":              1800,  // 1L
  "Detergente":         3400,  // 1kg
  "Suavizante":         3200,  // 1L
  "Esponja":             800,  // unidad
  "Bolsas de basura":   1600,  // paq
};

// ── Data ─────────────────────────────────────────────────────────────────────
const PRESET_ITEMS = [
  // Lácteos
  { name: "Leche",            category: "Lácteos",           emoji: "🥛" },
  { name: "Huevos",           category: "Lácteos",           emoji: "🥚" },
  { name: "Queso Mozarela",   category: "Lácteos",           emoji: "🧀" },
  { name: "Queso Turrialba",  category: "Lácteos",           emoji: "🧀" },
  { name: "Crema",            category: "Lácteos",           emoji: "🥛" },
  { name: "Yogur",            category: "Lácteos",           emoji: "🫙" },
  { name: "Mantequilla",      category: "Lácteos",           emoji: "🧈" },
  { name: "Natilla",          category: "Lácteos",           emoji: "🥣" },
  // Frutas y Verduras
  { name: "Manzanas",         category: "Frutas y Verduras", emoji: "🍎" },
  { name: "Plátanos",         category: "Frutas y Verduras", emoji: "🍌" },
  { name: "Tomates",          category: "Frutas y Verduras", emoji: "🍅" },
  { name: "Aguacate",         category: "Frutas y Verduras", emoji: "🥑" },
  { name: "Espinacas",        category: "Frutas y Verduras", emoji: "🥬" },
  { name: "Brócoli",          category: "Frutas y Verduras", emoji: "🥦" },
  { name: "Zanahorias",       category: "Frutas y Verduras", emoji: "🥕" },
  { name: "Limones",          category: "Frutas y Verduras", emoji: "🍋" },
  { name: "Papaya",           category: "Frutas y Verduras", emoji: "🍈" },
  { name: "Piña",             category: "Frutas y Verduras", emoji: "🍍" },
  { name: "Chayote",          category: "Frutas y Verduras", emoji: "🥒" },
  { name: "Yuca",             category: "Frutas y Verduras", emoji: "🌿" },
  { name: "Papa",             category: "Frutas y Verduras", emoji: "🥔" },
  { name: "Cebolla",          category: "Frutas y Verduras", emoji: "🧅" },
  { name: "Chile dulce",      category: "Frutas y Verduras", emoji: "🫑" },
  { name: "Culantro",         category: "Frutas y Verduras", emoji: "🌿" },
  { name: "Ajo",              category: "Frutas y Verduras", emoji: "🧄" },
  // Despensa
  { name: "Miel",             category: "Despensa",          emoji: "🍯" },
  { name: "Aceite de Oliva",  category: "Despensa",          emoji: "🫙" },
  { name: "Aceite vegetal",   category: "Despensa",          emoji: "🫙" },
  { name: "Arroz",            category: "Despensa",          emoji: "🍚" },
  { name: "Pasta",            category: "Despensa",          emoji: "🍝" },
  { name: "Harina",           category: "Despensa",          emoji: "🌾" },
  { name: "Sal",              category: "Despensa",          emoji: "🧂" },
  { name: "Azúcar",           category: "Despensa",          emoji: "🍬" },
  { name: "Frijoles",         category: "Despensa",          emoji: "🫘" },
  { name: "Atún",             category: "Despensa",          emoji: "🐟" },
  { name: "Mayonesa",         category: "Despensa",          emoji: "🥣" },
  { name: "Salsa de tomate",  category: "Despensa",          emoji: "🍅" },
  { name: "Vinagre",          category: "Despensa",          emoji: "🫙" },
  { name: "Consomé",          category: "Despensa",          emoji: "🧆" },
  { name: "Aceite de coco",   category: "Despensa",          emoji: "🥥" },
  // Carnes
  { name: "Pollo",            category: "Carnes",            emoji: "🍗" },
  { name: "Carne molida",     category: "Carnes",            emoji: "🥩" },
  { name: "Salmón",           category: "Carnes",            emoji: "🐟" },
  { name: "Jamón",            category: "Carnes",            emoji: "🥓" },
  { name: "Chorizo",          category: "Carnes",            emoji: "🌭" },
  { name: "Pescado",          category: "Carnes",            emoji: "🐠" },
  { name: "Costillas",        category: "Carnes",            emoji: "🥩" },
  { name: "Salchichas",       category: "Carnes",            emoji: "🌭" },
  // Panadería
  { name: "Pan",              category: "Panadería",         emoji: "🍞" },
  { name: "Pan integral",     category: "Panadería",         emoji: "🍞" },
  { name: "Tortillas",        category: "Panadería",         emoji: "🫓" },
  { name: "Galletas",         category: "Panadería",         emoji: "🍪" },
  // Bebidas
  { name: "Café",             category: "Bebidas",           emoji: "☕" },
  { name: "Jugo de naranja",  category: "Bebidas",           emoji: "🍊" },
  { name: "Agua mineral",     category: "Bebidas",           emoji: "💧" },
  { name: "Refresco",         category: "Bebidas",           emoji: "🥤" },
  { name: "Cerveza",          category: "Bebidas",           emoji: "🍺" },
  { name: "Leche de avena",   category: "Bebidas",           emoji: "🌾" },
  // Higiene
  { name: "Shampoo",          category: "Higiene",           emoji: "🧴" },
  { name: "Jabón",            category: "Higiene",           emoji: "🧼" },
  { name: "Papel de baño",    category: "Higiene",           emoji: "🧻" },
  { name: "Pasta de dientes", category: "Higiene",           emoji: "🪥" },
  { name: "Desodorante",      category: "Higiene",           emoji: "🧴" },
  // Limpieza
  { name: "Cloro",            category: "Limpieza",          emoji: "🧹" },
  { name: "Detergente",       category: "Limpieza",          emoji: "🫧" },
  { name: "Suavizante",       category: "Limpieza",          emoji: "🫧" },
  { name: "Esponja",          category: "Limpieza",          emoji: "🧽" },
  { name: "Bolsas de basura", category: "Limpieza",          emoji: "🗑️" },
];

const CATEGORIES = [...new Set(PRESET_ITEMS.map((i) => i.category))];
const CAT_COLORS = {
  Lácteos: "#4ADE80", "Frutas y Verduras": "#4ADE80", Despensa: "#fcd34d",
  Carnes: "#fca5a5", Panadería: "#fdba74", Bebidas: "#D4B8F0",
  Higiene: "#f0abfc", Limpieza: "#6ee7b7",
};

const UNITS = ["pza", "kg", "g", "L", "ml", "paq", "cja"];
const HOLD_MS = 1000;
const genId = () => Math.random().toString(36).substr(2, 9);
const totalCost = (items) => items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (it.qty || 1), 0);
// Item lifecycle stage: "inventory" (not yet selected) → "shopping" (in Lista de Compras) → "cart" (En el Carrito de Compras).
// Falls back to the legacy boolean `checked` field for lists saved before this version.
const stageOf = (it) => it.stage || (it.checked ? "cart" : "inventory");
const isInCart = (it) => stageOf(it) === "cart";
// Formats an amount >= 1000 as "Xk" or "X.Xk" without misleading rounding —
// e.g. 5000 -> "5k", 1500 -> "1.5k" (not "2k"), 12345 -> "12.3k".
const formatK = (n) => {
  const v = n / 1000;
  const rounded = Math.round(v * 10) / 10; // one decimal of precision
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
};
// Strips accents/tildes, commas, extra spaces — makes search accent- and punctuation-insensitive
const normalizeSearch = (str) =>
  str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[,\s]+/g, " ").trim().toLowerCase();

// ── Stable default for useSupabaseSync — defined once at module level so
// the object identity never changes between renders (avoids spurious effect triggers).
const DEFAULT_LISTS = [{ id: "default", name: "Casa", items: [], createdAt: Date.now() }];

// ── Styles (theme-aware) ──────────────────────────────────────────────────────
const makeStyles = (theme) => ({
  app: {
    maxWidth: 430, margin: "0 auto", height: "100svh",
    background: "transparent", display: "flex", flexDirection: "column",
    fontFamily: "'Outfit', 'Segoe UI', sans-serif",
    color: theme.isDark ? theme.textPrimary : "#1A2118",
    isolation: "isolate", overflow: "hidden",
  },
  header: {
    display: "flex", alignItems: "center", padding: "14px 16px 12px",
    background: theme.isDark
      ? "rgba(17,0,26,0.92)"
      : "#EDE7D8", borderBottom: theme.isDark
      ? "1px solid rgba(91,26,142,0.28)"
      : "1px solid rgba(255,255,255,0.65)",
    boxShadow: theme.isDark
      ? "0 1px 12px rgba(0,0,0,0.3)"
      : "0 1px 12px rgba(80,60,20,0.06)",
    gap: 10,
    position: "sticky", top: 0, zIndex: 10,
  },
  body: { flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", paddingBottom: "calc(var(--bottombar-h, 64px) + 72px)" },
  // bottomBar height is exposed as --bottombar-h (see :root injection below) so
  // the FAB above it can derive its offset from the bar's real height instead of
  // a hardcoded magic number that breaks the moment padding/content changes.
  bottomBar: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: 430, maxWidth: "100%", boxSizing: "border-box",
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
    background: theme.isDark
      ? "rgba(17,0,26,0.95)"
      : "rgba(255,255,255,0.70)", borderTop: theme.isDark
      ? "1px solid rgba(91,26,142,0.28)"
      : "1px solid rgba(255,255,255,0.65)",
    boxShadow: theme.isDark
      ? "0 -1px 12px rgba(0,0,0,0.3)"
      : "0 -1px 12px rgba(80,60,20,0.06)",
    display: "flex", alignItems: "center",
    padding: "10px 14px", gap: 10, zIndex: 20,
  },
  fab: {
    // Use className="wc-fab" instead; this keeps the ref for legacy inline fallback
    position: "fixed", bottom: "calc(var(--bottombar-h, 64px) + 10px)", left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(145deg,var(--accent),var(--accentDark))", color: "#FFFFFF",
    border: "none", borderRadius: 28, padding: "13px 32px",
    fontSize: 15, fontWeight: 800, cursor: "pointer", zIndex: 21,
    boxShadow: "0 6px 24px rgba(var(--accent-rgb,94,171,47),0.40)",
    transition: "transform 0.20s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.20s ease",
    letterSpacing: "0.02em", overflow: "hidden", fontFamily: "inherit",
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// 🎨 EMOJI ICON SYSTEM — zero-weight, instant render, universally cute
// ══════════════════════════════════════════════════════════════════════════════

const CAT_ICONS = {
  "Lácteos":           "🥛",
  "Frutas y Verduras": "🥦",
  "Despensa":          "🫙",
  "Carnes":            "🍗",
  "Panadería":         "🍞",
  "Bebidas":           "☕",
  "Higiene":           "🧴",
  "Limpieza":          "🧹",
  "Todos":             "🛒",
};

const ITEM_ICONS = {
  // Frutas y Verduras
  "Manzanas":         "🍎",
  "Plátanos":         "🍌",
  "Tomates":          "🍅",
  "Aguacate":         "🥑",
  "Espinacas":        "🥬",
  "Brócoli":          "🥦",
  "Zanahorias":       "🥕",
  "Limones":          "🍋",
  "Papaya":           "🍈",
  "Piña":             "🍍",
  "Cebolla":          "🧅",
  "Chile dulce":      "🫑",
  "Culantro":         "🌿",
  "Yuca":             "🌿",
  "Chayote":          "🥒",
  "Papa":             "🥔",
  "Ajo":              "🧄",
  "Manzanas rojas":   "🍎",
  // Lácteos
  "Leche":            "🥛",
  "Huevos":           "🥚",
  "Queso Mozarela":   "🧀",
  "Queso Turrialba":  "🧀",
  "Mantequilla":      "🧈",
  "Yogur":            "🫙",
  "Crema":            "🥛",
  "Natilla":          "🥣",
  // Carnes
  "Pollo":            "🍗",
  "Salmón":           "🐟",
  "Pescado":          "🐟",
  "Atún":             "🐟",
  "Jamón":            "🥩",
  "Carne molida":     "🥩",
  "Costillas":        "🥩",
  "Chorizo":          "🌭",
  "Salchichas":       "🌭",
  // Panadería
  "Pan":              "🍞",
  "Pan integral":     "🍞",
  "Galletas":         "🍪",
  "Tortillas":        "🫓",
  // Despensa
  "Miel":             "🍯",
  "Aceite de Oliva":  "🫒",
  "Aceite vegetal":   "🫙",
  "Aceite de coco":   "🥥",
  "Arroz":            "🍚",
  "Pasta":            "🍝",
  "Harina":           "🌾",
  "Sal":              "🧂",
  "Azúcar":           "🍬",
  "Frijoles":         "🫘",
  "Salsa de tomate":  "🍅",
  "Mayonesa":         "🫙",
  "Vinagre":          "🫙",
  "Consomé":          "🧆",
  // Bebidas
  "Café":             "☕",
  "Jugo de naranja":  "🍊",
  "Agua mineral":     "💧",
  "Refresco":         "🥤",
  "Cerveza":          "🍺",
  "Leche de avena":   "🌾",
  // Higiene
  "Shampoo":          "🧴",
  "Jabón":            "🧼",
  "Desodorante":      "🧴",
  "Pasta de dientes": "🪥",
  "Papel de baño":    "🧻",
  // Limpieza
  "Detergente":       "🫧",
  "Suavizante":       "🫧",
  "Cloro":            "🧪",
  "Esponja":          "🧽",
  "Bolsas de basura": "🗑️",
};

// ── Auto-icon guesser for freely-typed custom item names ───────────────────
// Builds a normalized lookup once, then on every keystroke tries (in order):
//   1) exact match against known item names (accent/case-insensitive)
//   2) a known item name that starts with what's typed (e.g. "manz" → "Manzanas")
//   3) a known item name contained in what's typed, or vice versa (e.g.
//      "leche deslactosada" → "Leche", "tomate cherry" → "Tomates")
// Falls back to null when nothing reasonable matches, so the caller can decide
// whether to keep the current emoji or use a generic default.
const NORMALIZED_ITEM_ICONS = Object.entries(ITEM_ICONS).map(([name, emoji]) => ({
  name, emoji, norm: normalizeSearch(name),
}));

const guessEmojiForName = (rawName) => {
  const q = normalizeSearch(rawName || "");
  if (!q) return null;

  // 1) Exact match
  const exact = NORMALIZED_ITEM_ICONS.find(it => it.norm === q);
  if (exact) return exact.emoji;

  // 2) Prefix match — typing "manz" should already suggest "🍎" for "Manzanas"
  const prefixMatches = NORMALIZED_ITEM_ICONS.filter(it => it.norm.startsWith(q) || q.startsWith(it.norm));
  if (prefixMatches.length) {
    // Prefer the closest length match (shortest difference) for the tightest fit
    prefixMatches.sort((a, b) => Math.abs(a.norm.length - q.length) - Math.abs(b.norm.length - q.length));
    return prefixMatches[0].emoji;
  }

  // 3) Substring match either direction — catches "tomate cherry", "leche 2%", etc.
  const subMatches = NORMALIZED_ITEM_ICONS.filter(it => it.norm.includes(q) || q.includes(it.norm));
  if (subMatches.length) {
    subMatches.sort((a, b) => Math.abs(a.norm.length - q.length) - Math.abs(b.norm.length - q.length));
    return subMatches[0].emoji;
  }

  return null;
};


// ── useDragToDismiss ──────────────────────────────────────────────────────────
// Drag-to-close behavior for bottom sheets (ProfileModal, ContextMenu, EditModal).
// The drag handle/header renders a "grab bar" already — this hook is what makes
// it actually do something. Drag down past ~22% of the sheet's own height (or
// flick fast enough) closes it with a smooth slide-down exit; otherwise it
// springs back to rest. Returns props for the *handle* element only (not the
// whole sheet) so it never competes with a scrollable body inside the sheet.
function useDragToDismiss(onClose) {
  const sheetRef   = useRef(null);
  const startY     = useRef(0);
  const startT     = useRef(0);
  const dragging   = useRef(false);
  const [closing, setClosing] = useState(false);
  const [mouseDragActive, setMouseDragActive] = useState(false);

  const getY = (e) => (e.touches ? e.touches[0].clientY : e.clientY);

  // Single exit path — used by drag release AND by any explicit close
  // (Cancel button, backdrop tap, Save button) so every way of closing
  // the sheet gets the same slide-down instead of drag being the only
  // animated one. Pass an `after` callback when the close should commit
  // something (e.g. Save) instead of just calling onClose.
  const requestClose = useCallback((after) => {
    if (closing) return;
    setClosing(true);
    if (sheetRef.current) {
      sheetRef.current.style.transition = "transform .2s cubic-bezier(.22,1,.36,1)";
      sheetRef.current.style.transform = "translate3d(0,100%,0)";
    }
    setTimeout(() => (after ? after() : onClose?.()), 200);
  }, [closing, onClose]);

  const resolveDrag = useCallback((dy, dt) => {
    if (!sheetRef.current) return;
    const velocity = dy / Math.max(1, dt); // px/ms
    const sheetH = sheetRef.current.offsetHeight || 1;
    const passedThreshold = dy > sheetH * 0.22 || velocity > 0.6;

    if (passedThreshold && dy > 0) {
      requestClose();
    } else {
      sheetRef.current.style.transition = "transform .22s cubic-bezier(.22,1,.36,1)";
      sheetRef.current.style.transform = "translate3d(0,0,0)";
    }
  }, [requestClose]);

  // Touch: the browser keeps dispatching touchmove/touchend to the same
  // target even if the finger moves off the small handle, so these can be
  // plain handlers wired directly via handleProps.
  const onTouchMove = useCallback((e) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = getY(e) - startY.current;
    if (dy <= 0) { sheetRef.current.style.transform = "translate3d(0,0,0)"; return; }
    sheetRef.current.style.transform = `translate3d(0,${dy}px,0)`;
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = getY(e.changedTouches ? { touches: e.changedTouches } : e) - startY.current;
    resolveDrag(dy, Date.now() - startT.current);
  }, [resolveDrag]);

  // Mouse: dragging off a small handle is normal, so movement/release must
  // be tracked on `document`, not the handle. Declared as an effect keyed
  // on `mouseDragActive` (mount/unmount listeners) instead of refs that
  // self-reference their own removal — React's hooks linter (React 19)
  // disallows writing/reading ref.current during render, which the old
  // "ref that always points at the latest callback" pattern required.
  useEffect(() => {
    if (!mouseDragActive) return;
    const handleMove = (e) => {
      if (!sheetRef.current) return;
      const dy = e.clientY - startY.current;
      sheetRef.current.style.transform = dy > 0 ? `translate3d(0,${dy}px,0)` : "translate3d(0,0,0)";
    };
    const handleUp = (e) => {
      setMouseDragActive(false);
      dragging.current = false;
      resolveDrag(e.clientY - startY.current, Date.now() - startT.current);
    };
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [mouseDragActive, resolveDrag]);

  const onStart = useCallback((e) => {
    if (closing) return;
    dragging.current = true;
    startY.current = getY(e);
    startT.current = Date.now();
    if (sheetRef.current) sheetRef.current.style.transition = "none";
    if (e.type === "mousedown") setMouseDragActive(true);
  }, [closing]);

  const handleProps = {
    onTouchStart: onStart, onTouchMove, onTouchEnd,
    onMouseDown:  onStart,
  };

  return { sheetRef, handleProps, closing, requestClose };
}

// Visual "grab bar" — renders the pill AND wires up the drag gesture passed in.
// Kept as its own component so every sheet gets the same hit target/cursor.
function SheetHandle({ handleProps, color }) {
  return (
    <div
      {...handleProps}
      style={{ display:"flex", justifyContent:"center", padding:"10px 0 8px", cursor:"grab", touchAction:"none" }}>
      <div style={{ width:36, height:4, borderRadius:99, background: color || "color-mix(in srgb, var(--accent) 18%, white)" }} />
    </div>
  );
}

// Renders the best emoji for an item — specific item first, then category fallback, then item emoji
function ItemIcon({ name, category, emoji, size=32, emojiSize=24 }) {
  const icon = ITEM_ICONS[name] || CAT_ICONS[category] || emoji;
  return <span style={{ fontSize:emojiSize, width:size, textAlign:"center", lineHeight:1, flexShrink:0, display:"inline-block" }}>{icon}</span>;
}


// ── Swipe Tab Container — deslizar de lado a lado entre Inicio y Estadísticas ──
const TAB_ORDER = ["lists", "stats"];
const TAB_W = 100 / TAB_ORDER.length; // cada pantalla ocupa 50% de la tira de 200%

const SwipeTabContainer = ({ tab, onTabChange, children }) => {
  const tabIdx = Math.max(0, TAB_ORDER.indexOf(tab));
  const containerRef = useRef(null);
  const startX = useRef(null);
  const startY = useRef(null);
  const dx = useRef(0);
  // null = sin decidir, true = horizontal, false = vertical
  const direction = useRef(null);
  const dragging  = useRef(false);

  /* translateX de la tira: cada paso mueve un ancho de pantalla (= TAB_W%) */
  const baseTranslate = (idx, extraPx = 0) =>
    `translateX(calc(${idx * -TAB_W}% + ${extraPx}px))`;

  const applyTranslate = useCallback((extraPx = 0, animated = false) => {
    const el = containerRef.current;
    if (!el) return;
    el.style.transition = animated ? "transform 0.32s cubic-bezier(.22,1,.36,1)" : "none";
    el.style.transform = baseTranslate(tabIdx, extraPx);
  }, [tabIdx]); // baseTranslate es una función pura de tabIdx — seguro inline

  // Resetear por completo el estado de arrastre — se usa tanto al terminar un
  // gesto normalmente como al cancelarlo (touch interrumpido, cambio de tab
  // desde afuera, etc.) para que dragging.current NUNCA quede atascado en true.
  const resetDragState = useCallback(() => {
    dragging.current = false;
    startX.current = null;
    startY.current = null;
    dx.current = 0;
    direction.current = null;
  }, []);

  // Centrar en la posición correcta cada vez que cambia el tab (tap en BottomNav, etc.)
  // Si había un arrastre en curso cuando el tab cambió desde afuera (p.ej. el
  // usuario tocó "Estadísticas" o "Perfil" mientras el dedo seguía en pantalla
  // de un swipe anterior), cancelamos ese arrastre primero — así nunca hay dos
  // escritores compitiendo por el mismo style.transform, que era lo que dejaba
  // el carrusel congelado mostrando contenido de otra pestaña.
  useEffect(() => {
    resetDragState();
    applyTranslate(0, true);
  }, [tab, applyTranslate, resetDragState]);

  const startDrag = (clientX, clientY) => {
    startX.current = clientX;
    startY.current = clientY;
    dx.current = 0;
    direction.current = null;
    dragging.current = true;
    applyTranslate(0, false); // congelar, sin transición CSS durante el arrastre
  };

  const moveDrag = (clientX, clientY, evt) => {
    if (!dragging.current || startX.current === null) return;
    const moveX = clientX - startX.current;
    const moveY = clientY - startY.current;

    // Bloquear el eje en el primer movimiento decisivo (> 8px en cualquier eje)
    if (direction.current === null && (Math.abs(moveX) > 8 || Math.abs(moveY) > 8)) {
      direction.current = Math.abs(moveX) >= Math.abs(moveY) ? "h" : "v";
    }
    if (direction.current !== "h") return; // scroll vertical — no interferir

    if (evt?.cancelable) evt.preventDefault(); // evitar scroll de página al deslizar tabs

    // Rubber-band en los bordes
    const atLeft  = tabIdx === 0 && moveX > 0;
    const atRight = tabIdx === TAB_ORDER.length - 1 && moveX < 0;
    dx.current = (atLeft || atRight) ? moveX * 0.18 : moveX;

    applyTranslate(dx.current, false);
  };

  const endDrag = () => {
    if (!dragging.current) return;
    const wasHorizontal = direction.current === "h";
    const finalDx = dx.current;
    const finalIdx = tabIdx;
    // Limpiar el estado ANTES de decidir si cambiamos de tab — así, incluso si
    // onTabChange dispara un re-render síncrono que desmonta/remonta este nodo,
    // el estado de arrastre ya quedó limpio y no hay forma de que quede atascado.
    resetDragState();

    if (!wasHorizontal) return;

    const THRESHOLD = window.innerWidth * 0.28;
    if      (finalDx < -THRESHOLD && finalIdx < TAB_ORDER.length - 1) onTabChange(TAB_ORDER[finalIdx + 1]);
    else if (finalDx >  THRESHOLD && finalIdx > 0)                     onTabChange(TAB_ORDER[finalIdx - 1]);
    else                                                                  applyTranslate(0, true);
  };

  // Touch (móvil)
  const onTouchStart  = (e) => startDrag(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove   = (e) => moveDrag(e.touches[0].clientX, e.touches[0].clientY, e);
  const onTouchEnd    = endDrag;
  // onTouchCancel: el sistema puede cancelar el touch a medio gesto (llamada
  // entrante, gesto del sistema, cambio de foco) sin disparar touchend nunca.
  // Sin este handler, dragging.current se quedaba en true para siempre y los
  // toques siguientes dejaban de mover el carrusel — la app "se congelaba".
  const onTouchCancel = resetDragState;

  // Mouse (escritorio / preview) — mismo gesto con botón izquierdo
  const onMouseDown = (e) => startDrag(e.clientX, e.clientY);
  const onMouseMove  = (e) => moveDrag(e.clientX, e.clientY, e);
  const onMouseUp    = endDrag;
  const onMouseLeave = () => { if (dragging.current) endDrag(); };

  return (
    <div style={{ flex:1, minHeight:0, overflow:"hidden", position:"relative", display:"flex", flexDirection:"column" }}>
      <div
        ref={containerRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{
          display:"flex",
          flexDirection:"row",
          width:`${TAB_ORDER.length * 100}%`,  // 200vw total
          height:"100%",
          transform: baseTranslate(tabIdx),
          willChange:"transform",
          backfaceVisibility:"hidden",
          WebkitBackfaceVisibility:"hidden",
          transformStyle:"preserve-3d",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ onNewList, onStats, onProfile, active, theme = {} }) {
  const isDark = theme.isDark;
  const [pressed, setPressed] = useState(null);
  const tabs = [
    { key:"home",    emoji:"🏠",   label:"Inicio",        onClick:onNewList },
    { key:"stats",   emoji:"📊",   label:"Estadísticas",  onClick:onStats   },
    { key:"profile", emoji:"👤",   label:"Perfil",        onClick:onProfile },
  ];
  const navBg = theme.navBg || (isDark ? "#111111" : "#FCFAF6");
  const borderColor = isDark ? `rgba(${theme.accentRgb||"98,121,200"},0.22)` : "rgba(255,255,255,0.75)";
  return (
    <div style={{
      position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
      width:430, maxWidth:"100%",
      background: navBg, borderTop:`1.5px solid ${borderColor}`,
      boxShadow: isDark ? "0 -6px 32px rgba(0,0,0,0.40)" : "0 -4px 32px rgba(80,60,20,0.10)",
      display:"flex", alignItems:"center",
      paddingBottom:"env(safe-area-inset-bottom,8px)", paddingTop:8, zIndex:20,
    }}>
      {/* Center FAB for new list */}
      {tabs.map(({ key, emoji, label, onClick }) => {
        const on = active === key;
        const isFab = key === "home";
        const isPressed = pressed === key;
        return (
          <button key={key} onClick={() => { onClick(); }}
            onMouseDown={() => setPressed(key)} onMouseUp={() => setPressed(null)}
            onTouchStart={() => setPressed(key)} onTouchEnd={() => setPressed(null)}
            className="nav-tab"
            style={{
              flex:1, display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", background:"none", border:"none",
              cursor:"pointer", padding:"4px 0 3px", gap:4,
              WebkitTapHighlightColor:"transparent",
            }}>
            <div style={{
              width: isFab ? 56 : 44,
              height: isFab ? 48 : 36,
              borderRadius: isFab ? 18 : 12,
              background: isFab
                ? `linear-gradient(145deg,${theme.accent},${theme.accentDark})`
                : on ? theme.soft : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all .22s cubic-bezier(0.34,1.4,0.64,1)",
              transform: isPressed ? "scale(0.88)" : on && !isFab ? "scale(1.04)" : "scale(1)",
              boxShadow: isFab
                ? `0 6px 20px rgba(${theme.accentRgb||"94,171,47"},0.38)`
                : on ? `0 2px 10px rgba(${theme.accentRgb||"94,171,47"},0.18)` : "none",
            }}>
              <span style={{ fontSize: isFab ? 22 : 18, lineHeight:1, filter: !isFab && !on ? "grayscale(0.5) opacity(0.55)" : "none", transition:"filter .18s" }}>{emoji}</span>
            </div>
            <span style={{
              fontSize: 10, letterSpacing:".02em",
              fontWeight: (isFab || on) ? 800 : 500,
              color: isFab ? theme.accentDark : on ? theme.accentDark : isDark ? `rgba(${theme.accentRgb||"98,121,200"},0.5)` : "#BDB0A4",
              transition:"color .18s",
            }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Top Tabs (Pinterest style) ────────────────────────────────────────────────
function TopTabs({ tabs, active, onChange, theme = {} }) {
  const isDark = theme.isDark;
  return (
    <div style={{ display:"flex", borderBottom:`1px solid ${isDark ? "rgba(91,26,142,0.28)" : "rgba(0,0,0,0.07)"}`, background: isDark ? "rgba(17,0,26,0.95)" : "rgba(255,255,255,0.95)", paddingLeft:4, overflowX:"auto", scrollbarWidth:"none" }}>
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            background:"none", border:"none", cursor:"pointer",
            padding:"14px 18px 12px", fontSize:14, fontWeight: on ? 800 : 500,
            color: on ? "var(--accent)" : isDark ? "#B06BE0" : "#D4B8F0",
            position:"relative", transition:"color .15s", whiteSpace:"nowrap", flexShrink:0,
          }}>
            {tab.label}
            {on && <span style={{ position:"absolute", bottom:0, left:14, right:14, height:2.5, background:"var(--accent)", borderRadius:2, display:"block", animation:"underlineIn .2s ease", transformOrigin:"left" }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── Profile Modal ─────────────────────────────────────────────────────────────
const CURRENCIES = [
  { code:"CRC", symbol:"₡", label:"Colón costarricense", flag:"🇨🇷" },
  { code:"USD", symbol:"$", label:"Dólar (USD)",          flag:"🇺🇸" },
  { code:"EUR", symbol:"€", label:"Euro",                 flag:"🇪🇺" },
  { code:"MXN", symbol:"$", label:"Peso mexicano",        flag:"🇲🇽" },
];

function ProfileModal({ profile, settings, history, onClose, onSaveProfile, onSaveSettings, initialTab }) {
  const [name,   setName]   = useState(profile.name);
  const [budget, setBudget] = useState(profile.budget);
  const [currency, setCurrency] = useState(settings.currencyCode);
  const [tab, setTab] = useState(initialTab || "profile");
  const DEFAULT_AMTS = [5000,10000,20000,30000,50000,75000,100000];
  const [quickAmts, setQuickAmts] = useState(() => {
    try { const s = localStorage.getItem("sl5_quickAmts"); return s ? JSON.parse(s) : DEFAULT_AMTS; } catch { return DEFAULT_AMTS; }
  });
  const [addingAmt, setAddingAmt] = useState(false);
  const [newAmt, setNewAmt]       = useState("");
  const sym = CURRENCIES.find(c=>c.code===(currency||"CRC"))?.symbol||"₡";

  // ── Hogar compartido — estado local de la UI ───────────────────────────────
  const [householdJoinCode, setHouseholdJoinCode] = useState("");
  const [householdMsg, setHouseholdMsg] = useState(null); // {type:'ok'|'err', text}
  const householdActive = isHouseholdCode();
  const currentCode = currentSyncId();

  const { sheetRef, handleProps, closing, requestClose } = useDragToDismiss(onClose);

  const saveAmts = (amts) => { setQuickAmts(amts); try { localStorage.setItem("sl5_quickAmts", JSON.stringify(amts)); } catch {} };
  const removeAmt = (amt) => saveAmts(quickAmts.filter(a => a !== amt));
  const confirmAmt = () => {
    const n = parseInt(newAmt);
    if (!n || n <= 0 || quickAmts.includes(n)) { setNewAmt(""); setAddingAmt(false); return; }
    const sorted = [...quickAmts, n].sort((a,b) => a-b);
    saveAmts(sorted); setNewAmt(""); setAddingAmt(false);
  };

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:70,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        background: closing ? "rgba(0,0,0,0)" : "rgba(20,14,6,0.52)",
        backdropFilter: closing ? "blur(0px)" : "blur(4px)",
        WebkitBackdropFilter: closing ? "blur(0px)" : "blur(4px)",
        transition: "background .20s ease, backdrop-filter .20s ease",
      }}
      onClick={(e) => e.target===e.currentTarget && requestClose()}>
      <div ref={sheetRef} className="wc-sheet" style={{ width:"100%", maxWidth:430, animation: closing ? "none" : "slideUp .28s cubic-bezier(.34,1.2,.64,1)", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", fontFamily:"'Outfit', 'Segoe UI', sans-serif" }}>
        <SheetHandle handleProps={handleProps} />
        <div style={{ display:"flex", alignItems:"center", padding:"16px 20px 0", justifyContent:"space-between" }}>
          <div style={{ width:44, height:44, borderRadius:14, background:"var(--soft)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <span style={{ fontSize:22, lineHeight:1 }}>👤</span>
          </div>
          <div style={{ flex:1, marginLeft:14 }}>
            <div style={{ fontSize:17, fontWeight:800, color:"var(--textPrimary)" }}>{profile.name||"Mi Perfil"}</div>
            <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:1 }}>Configuración personal</div>
          </div>
          <button onClick={requestClose} style={{ background:"color-mix(in srgb, var(--accent) 10%, var(--cardBg))", border:"none", color:"var(--textMuted)", width:32, height:32, borderRadius:"50%", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .12s" }}
            onMouseEnter={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 18%, white)"}
            onMouseLeave={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 10%, var(--cardBg))"}>✕</button>
        </div>
        <TopTabs tabs={[{id:"profile",label:"Perfil"},{id:"budget",label:"💰 Presupuesto"},{id:"currency",label:"Moneda"},{id:"household",label:"🏡 Hogar"}]} active={tab} onChange={setTab} theme={{isDark: false}} />
        <div style={{ overflowY:"auto", flex:1, padding: tab==="history" ? 0 : 20 }}>
          {tab==="history" && <StatsView history={history} budget={profile.budget} sym={sym} />}
          {tab==="profile" && <>
            <EditLabel>Nombre</EditLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llaman?" style={editInputStyle} />
          </>}
          {tab==="budget" && <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:42, height:42, borderRadius:14, background:"var(--soft)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>💰</div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"var(--textPrimary)" }}>Presupuesto de compras</div>
                <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:2 }}>¿Cuánto querés gastar por visita?</div>
              </div>
            </div>

            {/* Big number input */}
            <div style={{ background:"var(--cardBg,#FBF9F5)", borderRadius:"var(--radius-md,16px)", padding:"16px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, border:"1.5px solid var(--border)", transition:"border-color .2s, box-shadow .2s" }}
              onFocus={(e) => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(var(--accent-rgb),0.12)"; }}
              onBlur={(e) =>  { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.boxShadow="none"; }}>
              <span style={{ color:"var(--accent)", fontWeight:900, fontSize:24 }}>{sym}</span>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                style={{ flex:1, background:"none", border:"none", color:"var(--textPrimary)", fontSize:28, fontWeight:800, outline:"none", width:"100%", fontFamily:"inherit" }} />
              {budget && <button onClick={() => setBudget("")}
                style={{ background:"color-mix(in srgb, var(--accent) 10%, var(--cardBg))", border:"none", color:"var(--textMuted)", width:28, height:28, borderRadius:"50%", fontSize:13, cursor:"pointer", flexShrink:0 }}>✕</button>}
            </div>

            {/* Quick-pick chips — editables */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:"var(--textMuted)", fontWeight:700, letterSpacing:.5, marginBottom:10, textTransform:"uppercase", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>Montos rápidos</span>
                <span style={{ fontSize:10, color:"var(--textMuted)", fontWeight:400, textTransform:"none", opacity:0.7 }}>Mantén para eliminar</span>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                {quickAmts.map(amt => (
                  <button key={amt} onClick={() => setBudget(String(amt))}
                    onContextMenu={(e) => { e.preventDefault(); removeAmt(amt); }}
                    style={{ background:budget===String(amt)?"var(--accent)":"rgba(0,0,0,0.05)", border:"1.5px solid", borderColor:budget===String(amt)?"var(--accent)":"transparent", borderRadius:20, padding:"7px 15px", color:budget===String(amt)?"#FFFFFF":"#8A8075", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s", position:"relative" }}>
                    {sym}{amt>=1000 ? formatK(amt) : amt}
                  </button>
                ))}
                {/* Botón para agregar monto */}
                {addingAmt ? (
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input autoFocus type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") confirmAmt(); if(e.key==="Escape") { setAddingAmt(false); setNewAmt(""); } }}
                      placeholder="ej. 15000"
                      style={{ width:90, background:"#FEFCF9", border:"1.5px solid var(--accent)", borderRadius:20, padding:"7px 10px", color:"#2C2318", fontSize:13, outline:"none", textAlign:"center" }} />
                    <button onClick={confirmAmt} style={{ background:"var(--accent)", border:"none", borderRadius:"50%", width:28, height:28, color:"#111", fontSize:16, fontWeight:900, cursor:"pointer" }}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingAmt(true)}
                    style={{ background:"none", border:"1.5px dashed #C8BDB0", borderRadius:20, padding:"7px 14px", color:"#A09585", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.color="var(--accent)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#C8BDB0"; e.currentTarget.style.color="#9E9285"; }}>
                    + Agregar
                  </button>
                )}
              </div>
            </div>

            {/* Info callout */}
            <div style={{ background:"var(--soft)", borderRadius:"var(--radius-md,16px)", padding:"12px 16px", border:"1px solid var(--border)", display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
              <p style={{ fontSize:12, color:"#8A8075", lineHeight:1.65, margin:0, fontWeight:500 }}>
                Con presupuesto activo, la bolsita 🛍 en el header se convierte en un card que al tocar muestra cuánto te queda libre o si te pasaste.
              </p>
            </div>
          </>}
          {tab==="currency" && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CURRENCIES.map((c) => (
                <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  background:c.code===currency?"var(--tagBg)":"color-mix(in srgb, var(--accent) 4%, var(--cardBg))",
                  border:`1.5px solid ${c.code===currency?"var(--accent)":"transparent"}`,
                  borderRadius:"var(--radius-md,16px)", cursor:"pointer", color:"var(--textPrimary)", textAlign:"left",
                  transition:"background .12s ease, border-color .12s ease",
                }}>
                  <span style={{ fontSize:22 }}>{c.flag}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"var(--textPrimary)" }}>{c.label}</div>
                    <div style={{ fontSize:12, color:"var(--textMuted)" }}>{c.code} · {c.symbol}</div>
                  </div>
                  {c.code===currency && <span style={{ color:"var(--accent)", fontWeight:900, fontSize:16 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
          {tab==="household" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontSize:13, color:"var(--textMuted)", lineHeight:1.5 }}>
                Comparte tus listas con tu familia o roommates sin necesidad de
                cuentas ni contraseñas. Cualquiera con el código puede ver y
                editar la misma información — útil para un hogar, no para datos
                que necesiten quedar privados.
              </div>

              {householdActive ? (
                <>
                  <div style={{ background:"var(--tagBg)", border:"1.5px solid var(--accent)", borderRadius:"var(--radius-md,16px)", padding:"16px", textAlign:"center" }}>
                    <div style={{ fontSize:11, color:"var(--textMuted)", fontWeight:700, letterSpacing:".04em", textTransform:"uppercase", marginBottom:6 }}>Código de tu hogar</div>
                    <div style={{ fontSize:24, fontWeight:900, color:"var(--accentDark)", letterSpacing:".05em", fontFamily:"monospace" }}>{currentCode}</div>
                    <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:8 }}>Comparte este código para que otros se unan</div>
                  </div>
                  <button onClick={() => {
                      if (navigator.share) { navigator.share({ text: `Únete a mi hogar en Listed con este código: ${currentCode}` }).catch(()=>{}); }
                      else if (navigator.clipboard) { navigator.clipboard.writeText(currentCode).catch(()=>{}); setHouseholdMsg({type:"ok", text:"Código copiado"}); }
                    }}
                    style={{ background:"color-mix(in srgb, var(--accent) 10%, var(--cardBg))", border:"1.5px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"12px", color:"var(--textPrimary)", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    📋 Compartir código
                  </button>
                  <button onClick={() => {
                      if (!window.confirm("¿Salir de este hogar compartido? Tu dispositivo dejará de sincronizar con los demás y empezará una lista propia vacía. La data del hogar sigue intacta para los demás miembros.")) return;
                      leaveHousehold();
                      window.location.reload();
                    }}
                    style={{ background:"transparent", border:"1.5px solid #E08A8A", borderRadius:"var(--radius-md,16px)", padding:"12px", color:"#C0392B", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    Salir del hogar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => {
                      const code = createHouseholdCode();
                      setHouseholdMsg({type:"ok", text:`Hogar creado: ${code}. La app se va a recargar.`});
                      setTimeout(() => window.location.reload(), 1200);
                    }}
                    style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:"var(--radius-md,16px)", padding:"14px", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(var(--accent-rgb),0.35)" }}>
                    🏡 Crear código de hogar
                  </button>

                  <div style={{ display:"flex", alignItems:"center", gap:10, margin:"4px 0" }}>
                    <div style={{ flex:1, height:1, background:"var(--border)" }} />
                    <span style={{ fontSize:11, color:"var(--textMuted)", fontWeight:700 }}>O</span>
                    <div style={{ flex:1, height:1, background:"var(--border)" }} />
                  </div>

                  <div>
                    <EditLabel>Unirme a un hogar existente</EditLabel>
                    <div style={{ display:"flex", gap:8 }}>
                      <input value={householdJoinCode} onChange={(e) => setHouseholdJoinCode(e.target.value)}
                        placeholder="CASA-7F3K" style={{ ...editInputStyle, flex:1, fontFamily:"monospace", textTransform:"uppercase" }} />
                      <button onClick={() => {
                          if (!householdJoinCode.trim()) return;
                          const ok = joinHousehold(householdJoinCode);
                          if (ok) { setHouseholdMsg({type:"ok", text:"Unido. La app se va a recargar."}); setTimeout(() => window.location.reload(), 1000); }
                        }}
                        style={{ background:"var(--accent)", border:"none", borderRadius:"var(--radius-sm,10px)", padding:"0 18px", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>
                        Unirme
                      </button>
                    </div>
                  </div>
                </>
              )}

              {householdMsg && (
                <div style={{ fontSize:13, fontWeight:600, color: householdMsg.type==="ok" ? "var(--accentDark)" : "#C0392B", textAlign:"center" }}>
                  {householdMsg.text}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding:"16px 20px 28px", display:"flex", gap:10 }}>
          <button onClick={requestClose} style={{ flex:1, background:"color-mix(in srgb, var(--accent) 8%, var(--cardBg))", border:"1px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"var(--textMuted)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"background .12s ease" }}
            onMouseEnter={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 14%, var(--cardBg))"}
            onMouseLeave={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 8%, var(--cardBg))"}>Cancelar</button>
          <button onClick={() => { Sounds.save(); onSaveProfile({ name, budget }); onSaveSettings({ currencyCode:currency }); requestClose(); }}
            style={{ flex:2, background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(var(--accent-rgb),0.35)", transition:"transform .14s var(--ease-spring), box-shadow .14s ease" }}
            onMouseDown={e=>e.currentTarget.style.transform="scale(.96)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
            onTouchStart={e=>e.currentTarget.style.transform="scale(.96)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit helpers ──────────────────────────────────────────────────────────────
const editInputStyle = { width:"100%", background:"var(--cardBg,#FBF9F5)", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm,10px)", padding:"11px 12px", color:"var(--textPrimary)", fontSize:15, outline:"none", boxSizing:"border-box", transition:"border-color .15s ease, box-shadow .15s ease", fontFamily:"inherit" };
const qtyEditBtn = { background:"var(--soft,#EEEAE2)", border:"1px solid var(--border)", color:"var(--textPrimary,#2C2318)", width:40, height:40, borderRadius:"var(--radius-sm,10px)", fontSize:20, cursor:"pointer", transition:"background .12s ease" };
function EditLabel({ children }) {
  return <label style={{ display:"block", fontSize:11, color:"var(--textMuted)", fontWeight:700, marginBottom:4, marginTop:14, textTransform:"uppercase", letterSpacing:1 }}>{children}</label>;
}

// ── ContextMenu ───────────────────────────────────────────────────────────────
function ContextMenu({ item, onClose, onDelete, onDuplicate, onEdit, onChangeEmoji, sym }) {
  const subtotal = (parseFloat(item.price)||0)*(item.qty||1);
  const { sheetRef, handleProps, closing, requestClose } = useDragToDismiss(onClose);
  const [pickingEmoji, setPickingEmoji] = useState(false);

  const handlePick = (em) => {
    onChangeEmoji(em);
    setPickingEmoji(false);
  };

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:50,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        background: closing ? "rgba(0,0,0,0)" : "rgba(20,14,6,0.52)",
        backdropFilter: closing ? "blur(0px)" : "blur(4px)",
        WebkitBackdropFilter: closing ? "blur(0px)" : "blur(4px)",
        transition: "background .20s ease, backdrop-filter .20s ease",
      }}
      onClick={(e) => e.target===e.currentTarget && requestClose()}>
      <div ref={sheetRef} className="wc-context-menu" style={{ width:"100%", maxWidth:430, paddingBottom:20, overflow:"hidden", animation: closing ? "none" : undefined }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 20px 14px", borderBottom:"1px solid color-mix(in srgb, var(--accent) 12%, var(--cardBg))" }}>
          {/* Ícono actual — tocar abre el selector de íconos en el mismo panel */}
          <button onClick={() => setPickingEmoji(v => !v)}
            style={{ background: pickingEmoji ? "color-mix(in srgb, var(--accent) 16%, var(--cardBg))" : "transparent", border: pickingEmoji ? "2px solid var(--accent)" : "2px solid transparent", borderRadius:14, padding:2, cursor:"pointer", display:"flex", lineHeight:0, transition:"background .15s, border-color .15s" }}>
            <span style={{ fontSize:28 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={40} emojiSize={28}/></span>
          </button>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--textPrimary)" }}>{item.name}</div>
            <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:2 }}>
              {pickingEmoji ? "Elige un nuevo ícono" : `${item.qty||1} ${item.unit||"pza"}${item.price?` · ${sym}${Math.round(subtotal).toLocaleString()}`:""}`}
            </div>
          </div>
          {/* drag handle — actually draggable now, not just decorative */}
          <div {...handleProps} style={{ flex:1, display:"flex", justifyContent:"center", cursor:"grab", touchAction:"none", padding:"6px 0" }}>
            <div style={{ width:36, height:4, borderRadius:99, background:"color-mix(in srgb, var(--accent) 20%, white)", marginBottom:2 }} />
          </div>
        </div>

        {/* ── El panel se transforma: grilla de íconos en vez de las opciones,
               transición suave de cross-fade, sin tapar toda la pantalla ── */}
        <div style={{ position:"relative", minHeight: pickingEmoji ? "auto" : undefined }}>
          <div style={{
            display:"flex", flexDirection:"column", gap:2, padding:"8px 12px",
            opacity: pickingEmoji ? 0 : 1,
            transform: pickingEmoji ? "translateY(-6px)" : "translateY(0)",
            transition:"opacity .18s ease, transform .18s ease",
            pointerEvents: pickingEmoji ? "none" : "auto",
            // position:absolute mientras está oculto — así no reserva espacio
            // y la grilla de íconos puede ocupar ese hueco en vez de quedar
            // empujada hacia abajo con un vacío arriba.
            position: pickingEmoji ? "absolute" : "static",
            top: 0, left: 0, right: 0,
            visibility: pickingEmoji ? "hidden" : "visible",
          }}>
            <CtxBtn icon="✏️" onClick={onEdit}>Editar artículo</CtxBtn>
            <CtxBtn icon="📋" onClick={onDuplicate}>Duplicar</CtxBtn>
            <div style={{ height:1, background:"color-mix(in srgb, var(--accent) 10%, var(--cardBg))", margin:"4px 8px" }} />
            <CtxBtn icon="🗑" danger onClick={onDelete}>Eliminar</CtxBtn>
            <div style={{ height:1, background:"color-mix(in srgb, var(--accent) 10%, var(--cardBg))", margin:"4px 8px" }} />
            <CtxBtn icon="✕" muted onClick={requestClose}>Cancelar selección</CtxBtn>
          </div>

          {pickingEmoji && (
            <div style={{
              padding:"4px 14px 14px",
              animation:"fadeIn .18s ease",
            }}>
              <div style={{
                display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8,
                maxHeight:"50vh", overflowY:"auto", padding:"6px 2px",
              }}>
                {EMOJI_PALETTE.map((em, i) => (
                  <button key={`${em}-${i}`} onClick={() => handlePick(em)}
                    style={{ aspectRatio:"1", background: em===item.emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 6%, var(--cardBg))", border: em===item.emoji ? "2px solid var(--accentDark)" : "2px solid transparent", borderRadius:12, fontSize:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .1s, background .1s" }}
                    onTouchStart={e => e.currentTarget.style.transform="scale(1.15)"}
                    onTouchEnd={e   => e.currentTarget.style.transform="scale(1)"}
                    onMouseEnter={e => e.currentTarget.style.background = em===item.emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 14%, var(--cardBg))"}
                    onMouseLeave={e => e.currentTarget.style.background = em===item.emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 6%, var(--cardBg))"}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function CtxBtn({ icon, children, onClick, danger, muted }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 12px", background:"none", border:"none", borderRadius:12, color:danger?"#EF4444":muted?"var(--textMuted)":"var(--textPrimary)", fontSize:muted?13:15, fontWeight:muted?400:600, cursor:"pointer", width:"100%", textAlign:"left", transition:"background .12s ease" }}
      onMouseEnter={e => !muted && (e.currentTarget.style.background = danger ? "#FCE8E8" : "color-mix(in srgb, var(--accent) 7%, var(--cardBg))")}
      onMouseLeave={e => e.currentTarget.style.background="none"}
      onTouchStart={e => e.currentTarget.style.background = danger ? "#FCE8E8" : "color-mix(in srgb, var(--accent) 7%, var(--cardBg))"}
      onTouchEnd={e   => e.currentTarget.style.background="none"}>
      <span style={{ fontSize:18, width:24, textAlign:"center" }}>{icon}</span>{children}
    </button>
  );
}

// ── EditModal ─────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSave, sym }) {
  const [name,  setName]  = useState(item.name);
  const [price, setPrice] = useState(item.price||"");
  const [qty,   setQty]   = useState(item.qty||1);
  const [unit,  setUnit]  = useState(item.unit||"pza");
  const [note,  setNote]  = useState(item.note||"");
  const [emoji, setEmoji] = useState(item.emoji);
  const [pickingEmoji, setPickingEmoji] = useState(false);
  const subtotal = (parseFloat(price)||0)*qty;
  const presetPrice = CR_PRICES[item.name];
  const { sheetRef, handleProps, closing, requestClose } = useDragToDismiss(onClose);

  return (
    <div
      style={{
        position:"fixed", inset:0, zIndex:60,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        background: closing ? "rgba(0,0,0,0)" : "rgba(20,14,6,0.52)",
        backdropFilter: closing ? "blur(0px)" : "blur(4px)",
        WebkitBackdropFilter: closing ? "blur(0px)" : "blur(4px)",
        transition: "background .20s ease, backdrop-filter .20s ease",
      }}
      onClick={(e) => e.target===e.currentTarget && requestClose()}>
      <div ref={sheetRef} className="wc-sheet" style={{ width:"100%", maxWidth:430, padding:20, animation: closing ? "none" : "slideUp .22s ease", maxHeight:"85vh", overflowY:"auto" }}>
        <div {...handleProps} style={{ display:"flex", justifyContent:"center", padding:"0 0 14px", margin:"-20px -20px 0", cursor:"grab", touchAction:"none" }}>
          <div style={{ width:36, height:4, borderRadius:99, background:"color-mix(in srgb, var(--accent) 20%, white)", marginTop:8 }} />
        </div>
        <div style={{ fontSize:16, fontWeight:800, marginBottom: pickingEmoji ? 10 : 16, display:"flex", alignItems:"center", gap:10, color:"var(--textPrimary)" }}>
          <button onClick={() => setPickingEmoji(v => !v)}
            style={{ background: pickingEmoji ? "color-mix(in srgb, var(--accent) 16%, var(--cardBg))" : "transparent", border: pickingEmoji ? "2px solid var(--accent)" : "2px solid transparent", borderRadius:14, padding:2, cursor:"pointer", display:"flex", lineHeight:0, transition:"background .15s, border-color .15s", flexShrink:0 }}>
            <span style={{ fontSize:28 }}><ItemIcon name={item.name} category={item.category} emoji={emoji} size={40} emojiSize={28}/></span>
          </button>
          {pickingEmoji ? "Elige un nuevo ícono" : "Editar artículo"}
        </div>

        {pickingEmoji && (
          <div style={{ marginBottom:16, animation:"fadeIn .18s ease" }}>
            <div style={{
              display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8,
              maxHeight:"38vh", overflowY:"auto", padding:"6px 2px",
            }}>
              {EMOJI_PALETTE.map((em, i) => (
                <button key={`${em}-${i}`} onClick={() => { setEmoji(em); setPickingEmoji(false); }}
                  style={{ aspectRatio:"1", background: em===emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 6%, var(--cardBg))", border: em===emoji ? "2px solid var(--accentDark)" : "2px solid transparent", borderRadius:12, fontSize:24, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .1s, background .1s" }}
                  onTouchStart={e => e.currentTarget.style.transform="scale(1.15)"}
                  onTouchEnd={e   => e.currentTarget.style.transform="scale(1)"}
                  onMouseEnter={e => e.currentTarget.style.background = em===emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 14%, var(--cardBg))"}
                  onMouseLeave={e => e.currentTarget.style.background = em===emoji ? "var(--accent)" : "color-mix(in srgb, var(--accent) 6%, var(--cardBg))"}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}
        <EditLabel>Nombre</EditLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={editInputStyle} />
        <EditLabel>Precio por unidad</EditLabel>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
          <span style={{ color:"var(--accent)", fontSize:16, fontWeight:800 }}>{sym}</span>
          <input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...editInputStyle, flex:1 }} />
        </div>
        {/* Preset price hint */}
        {presetPrice && !price && (
          <button onClick={() => setPrice(String(presetPrice))}
            style={{ marginTop:6, background:"var(--soft)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm,10px)", padding:"6px 12px", color:"var(--accent)", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, animation:"fadeIn .25s ease" }}>
            <span style={{ fontSize:14 }}>💡</span>
            Precio típico en CR: {sym}{presetPrice.toLocaleString()} — usar este
          </button>
        )}
        <EditLabel>Cantidad</EditLabel>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:4 }}>
          <button style={qtyEditBtn} onClick={() => setQty(q => Math.max(1,q-1))}>−</button>
          <span style={{ fontSize:18, fontWeight:800, minWidth:36, textAlign:"center", lineHeight:"40px" }}>{qty}</span>
          <button style={qtyEditBtn} onClick={() => setQty(q => q+1)}>+</button>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ background:"#EEEAE2", border:"1px solid var(--border)", borderRadius:"var(--radius-sm,10px)", color:"#1A2118", padding:"0 10px", fontSize:14, height:40, fontFamily:"inherit" }}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <EditLabel>Nota (opcional)</EditLabel>
        <input placeholder="ej. Sin azúcar, marca X..." value={note} onChange={(e) => setNote(e.target.value)} style={editInputStyle} />
        {price && (
          <div style={{ marginTop:16, background:"var(--soft)", borderRadius:"var(--radius-md,16px)", padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid var(--border)" }}>
            <span style={{ color:"var(--accentDark)", fontSize:13, fontWeight:600 }}>Subtotal</span>
            <span style={{ color:"var(--accent)", fontSize:20, fontWeight:800 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <button onClick={requestClose} style={{ flex:1, background:"color-mix(in srgb, var(--accent) 8%, var(--cardBg))", border:"1px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"var(--textMuted)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"background .12s ease" }}
            onMouseEnter={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 14%, var(--cardBg))"}
            onMouseLeave={e=>e.currentTarget.style.background="color-mix(in srgb, var(--accent) 8%, var(--cardBg))"}>Cancelar</button>
          <button onClick={() => { Sounds.save(); requestClose(() => onSave({ ...item, name, price, qty, unit, note, emoji })); }}
            style={{ flex:2, background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(var(--accent-rgb),0.32)", transition:"transform .14s var(--ease-spring), box-shadow .14s ease" }}
            onMouseDown={e=>e.currentTarget.style.transform="scale(.96)"}
            onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
            onTouchStart={e=>e.currentTarget.style.transform="scale(.96)"}
            onTouchEnd={e=>e.currentTarget.style.transform="scale(1)"}>
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SwipeItem ─────────────────────────────────────────────────────────────────
const SwipeItem = memo(function SwipeItem({ item, onToggle, onQtyMinus, onQtyPlus, onDelete, onContextMenu, editingPriceId, tempPrice, setTempPrice, setEditingPriceId, savePrice, sym }) {
  // item.stage: "inventory" | "shopping" | "cart"
  // Swiping left always means "remove from this sub-list":
  //   - in inventory     → actually delete the item
  //   - in shopping/cart → demote back to inventory (never deleted)
  const stage = item.stage || "inventory";
  const rowRef   = useRef(null);
  const wrapRef  = useRef(null);
  const swipeState = useRef({ startX:0, startY:0, curX:0, dragging:false, hasMoved:false, axis:null, holdTimer:null });
  // Pending-uncheck animation state — brief exit before toggling
  const [exiting, setExiting] = useState(false);
  const qty = item.qty||1;
  const subtotal = (parseFloat(item.price)||0)*qty;
  const isEditingPrice = editingPriceId===item.id;

  const startHold = useCallback(() => {
    const s = swipeState.current;
    s.holdTimer = setTimeout(() => {
      if (s.hasMoved) return;
      if (navigator.vibrate) navigator.vibrate(25);
      rowRef.current?.classList.add("holding");
      setTimeout(() => { rowRef.current?.classList.remove("holding"); onContextMenu(item.id); }, 120);
    }, HOLD_MS);
  }, [item.id, onContextMenu]);

  const cancelHold = useCallback(() => {
    const s = swipeState.current;
    if (s.holdTimer) { clearTimeout(s.holdTimer); s.holdTimer = null; }
    rowRef.current?.classList.remove("holding");
  }, []);

  const onStart = useCallback((e) => {
    if (e.target.closest("button")||e.target.closest("input")) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const s = swipeState.current;
    s.startX=cx; s.startY=cy; s.curX=0; s.dragging=true; s.hasMoved=false; s.axis=null;
    if (rowRef.current) rowRef.current.style.transition="none";
    startHold();
  }, [startHold]);

  const onMove = useCallback((e) => {
    const s = swipeState.current;
    if (!s.dragging) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = cx - s.startX;
    const dy = cy - s.startY;

    // Direction lock: decide once movement is big enough whether this is a
    // horizontal swipe (handled by us) or a vertical scroll (let browser handle it).
    if (s.axis === null) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      }
    }

    if (s.axis === "y") {
      // Vertical scroll in progress — release control entirely, don't drag the row.
      s.dragging = false;
      cancelHold();
      return;
    }

    if (s.axis !== "x") return; // not yet decided, mouse/touch hasn't moved enough

    s.curX=dx;
    if (!s.hasMoved) { s.hasMoved=true; cancelHold(); }
    if (rowRef.current) rowRef.current.style.transform=`translate3d(${dx}px,0,0)`;
    // GPU-composited opacity transition for swipe indicators
    const bgL = wrapRef.current?.querySelector(".sl-bg-left");
    const bgR = wrapRef.current?.querySelector(".sl-bg-right");
    if (bgL&&bgR) {
      bgL.style.opacity = dx < -20 ? Math.min(1, (Math.abs(dx)-20)/52) : "0";
      bgR.style.opacity = dx >  20 ? Math.min(1, (dx-20)/52)           : "0";
    }
    if (e.cancelable) e.preventDefault();
  }, [cancelHold]);

  const onEnd = useCallback(() => {
    const s = swipeState.current;
    if (!s.dragging) return;
    s.dragging=false; cancelHold();
    if (rowRef.current) rowRef.current.style.transition="transform .22s ease";
    const bgL = wrapRef.current?.querySelector(".sl-bg-left");
    const bgR = wrapRef.current?.querySelector(".sl-bg-right");
    const THRESHOLD=72;
    if (s.hasMoved) {
      if (s.curX < -THRESHOLD) {
        Sounds.deleteItem();
        if (rowRef.current) rowRef.current.style.transform="translate3d(-110%,0,0)";
        setTimeout(() => onDelete(item.id, stage), 220);
      } else if (s.curX > THRESHOLD) {
        Sounds.checkItem();
        onToggle(item.id, true);
        if (rowRef.current) rowRef.current.style.transform="translate3d(0,0,0)";
        if (bgL) bgL.style.opacity="0"; if (bgR) bgR.style.opacity="0";
      } else {
        if (rowRef.current) rowRef.current.style.transform="translate3d(0,0,0)";
        if (bgL) bgL.style.opacity="0"; if (bgR) bgR.style.opacity="0";
      }
    } else {
      if (rowRef.current) rowRef.current.style.transform="translate3d(0,0,0)";
      if (bgL) bgL.style.opacity="0"; if (bgR) bgR.style.opacity="0";
    }
  }, [cancelHold, item.id, onDelete, onToggle]);

  // Smooth uncheck: brief exit animation before the state flip
  const handleUncheck = useCallback((e) => {
    if (e) e.stopPropagation();
    Sounds.uncheckItem();
    setExiting(true);
    setTimeout(() => { setExiting(false); onToggle(item.id); }, 160);
  }, [item.id, onToggle]);

  // Smooth check: brief scale-out before state flip
  const handleCheck = useCallback((e) => {
    if (e) e.stopPropagation();
    Sounds.checkItem();
    const r = e?.currentTarget?.getBoundingClientRect();
    if (r) { spawnConfetti(r.left+r.width/2,r.top+r.height/2,14); spawnEmojiParticle(r.left+r.width/2,r.top,item.emoji); }
    setExiting(true);
    setTimeout(() => { setExiting(false); onToggle(item.id); }, 160);
  }, [item.id, item.emoji, onToggle]);

  // ── Cart item: in-the-bag style ─────────────────────────────────────────────
  if (stage === "cart") {
    return (
      <div ref={wrapRef} style={{ position:"relative", overflow:"hidden", animation: exiting ? "slCheckExit .16s ease forwards" : "slItemBounceIn .38s cubic-bezier(.34,1.56,.64,1) both", contain:"layout style paint", willChange:"transform" }}>
        <div className="sl-bg-left" style={{ position:"absolute", inset:0, background:"#FDF1D6", opacity:0, display:"flex", alignItems:"center", justifyContent:"flex-end", paddingRight:22, fontSize:14, fontWeight:700, color:"#B45309", gap:8, transition:"opacity .12s ease" }}>↩ A inventario</div>
        <div ref={rowRef}
          style={{ display:"flex", alignItems:"center", padding:"10px 14px", gap:10, background:"color-mix(in srgb, var(--accent) 7%, var(--cardBg))", position:"relative", touchAction:"pan-y", userSelect:"none", borderBottom:"1px solid #EFEAE0", cursor:"pointer", willChange:"transform" }}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onClick={(e) => { if (!swipeState.current.hasMoved) handleUncheck(e); }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

          {/* soft left accent bar */}
          <div style={{ position:"absolute", left:0, top:6, bottom:6, width:3, borderRadius:3, background:"var(--accent)", opacity:.45 }} />

          {/* check circle – soft green, tappable to send back to Lista de Compras */}
          <button onClick={handleUncheck}
            style={{ width:28, height:28, borderRadius:"50%", border:"2px solid var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"var(--accent)", color:"#fff", fontSize:13, fontWeight:900, transition:"transform .15s ease", animation:"slCheckPop .3s cubic-bezier(.34,1.56,.64,1)" }}
            onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.88)"; }}
            onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; }}
            onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.88)"; }}
            onTouchEnd={(e)   => { e.currentTarget.style.transform="scale(1)"; }}>
            ✓
          </button>

          {/* emoji – slightly dimmed */}
          <span style={{ fontSize:22, width:30, textAlign:"center", flexShrink:0, opacity:.6 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={30} emojiSize={20}/></span>

          {/* name + price – no strikethrough, just softened */}
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"var(--textPrimary)", opacity:.9 }}>{item.name}</span>
            {item.price && (
              <span style={{ fontSize:11, color:"var(--accent)", fontWeight:600 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
            )}
          </div>

          {/* 🛍 in-bag chip */}
          <span style={{ fontSize:13, animation:"bagSlide .3s ease", flexShrink:0 }}>🛍</span>
        </div>
      </div>
    );
  }

  // ── Shopping-list item: "in lista de compras" style ────────────────────────
  if (stage === "shopping") {
    return (
      <div ref={wrapRef} className="item-stagger" style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #EFEAE0", animation: exiting ? "slCheckExit .16s ease forwards" : "slItemSpring .30s var(--ease-spring) both", contain:"layout style paint", willChange:"transform" }}>
        <div className="sl-bg-left"  style={{ position:"absolute", inset:0, background:"#FDF1D6", opacity:0, display:"flex", alignItems:"center", justifyContent:"flex-end",  paddingRight:22, fontSize:14, fontWeight:700, color:"#B45309", gap:8, transition:"opacity .12s ease" }}>↩ A inventario</div>
        <div className="sl-bg-right" style={{ position:"absolute", inset:0, background:"#DCEFF9", opacity:0, display:"flex", alignItems:"center", justifyContent:"flex-start", paddingLeft:22, fontSize:14, fontWeight:700, color:"#0369A1", gap:8, transition:"opacity .12s ease" }}>🛍 Al carrito</div>
        <div ref={rowRef}
          style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10, background:"#F3FAFE", position:"relative", touchAction:"pan-y", userSelect:"none", transition:"background .15s", cursor:"pointer", willChange:"transform" }}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onClick={(e) => { if (!swipeState.current.hasMoved && !e.target.closest("button") && !e.target.closest("input")) handleCheck(e); }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

          <button onClick={handleCheck}
            style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #7DD3FC", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"transparent", fontSize:14, fontWeight:"bold", transition:"border-color .2s, transform .15s" }}
            onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#0369A1"; }}
            onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="#7DD3FC"; }}
            onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#0369A1"; }}
            onTouchEnd={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="#7DD3FC"; }}>
          </button>

          <span style={{ fontSize:22, width:30, textAlign:"center", flexShrink:0 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={30} emojiSize={22}/></span>

          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"var(--textPrimary)" }}>{item.name}</span>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:3 }}>
              {isEditingPrice ? (
                <input autoFocus type="number" placeholder="0" value={tempPrice}
                  onChange={(e) => setTempPrice(e.target.value)}
                  onBlur={() => savePrice(item.id)}
                  onKeyDown={(e) => e.key==="Enter" && savePrice(item.id)}
                  style={{ background:"#FFFFFF", border:"1.5px solid #0369A1", borderRadius:"var(--radius-sm,10px)", color:"#0369A1", fontSize:13, width:80, padding:"2px 6px", textAlign:"right", outline:"none" }} />
              ) : (
                <button onClick={(e) => { e.stopPropagation(); setEditingPriceId(item.id); setTempPrice(item.price||""); }}
                  style={{ background:"none", border:"none", color:item.price?"#0369A1":"#AAA", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline dotted" }}>
                  {item.price ? `${sym}${Math.round(subtotal).toLocaleString()}` : "+ precio"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Inventory item ──────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="item-stagger" style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #EFEAE0", animation: exiting ? "slCheckExit .16s ease forwards" : "slItemSpring .30s var(--ease-spring) both", contain:"layout style paint", willChange:"transform" }}>
      <div className="sl-bg-left"  style={{ position:"absolute", inset:0, background:"#FBDADA", opacity:0, display:"flex", alignItems:"center", justifyContent:"flex-end",  paddingRight:22, fontSize:14, fontWeight:700, color:"#EF4444", gap:8, transition:"opacity .12s ease" }}>🗑 Eliminar</div>
      <div className="sl-bg-right" style={{ position:"absolute", inset:0, background:"color-mix(in srgb, var(--accent) 13%, var(--cardBg))", opacity:0, display:"flex", alignItems:"center", justifyContent:"flex-start", paddingLeft:22, fontSize:14, fontWeight:700, color:"var(--accentDark)", gap:8, transition:"opacity .12s ease" }}>✓ Seleccionar</div>
      <div ref={rowRef}
        style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10, background:"#FEFCF9", position:"relative", touchAction:"pan-y", userSelect:"none", transition:"background .15s", cursor:"pointer", willChange:"transform" }}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onClick={(e) => { if (!swipeState.current.hasMoved && !e.target.closest("button") && !e.target.closest("input")) handleCheck(e); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

        <button onClick={handleCheck}
          style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #D8D2C6", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"transparent", fontSize:14, fontWeight:"bold", transition:"border-color .2s, transform .15s" }}
          onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="var(--accent)"; }}
          onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="rgba(0,0,0,0.18)"; }}
          onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="var(--accent)"; }}
          onTouchEnd={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="rgba(0,0,0,0.18)"; }}>
        </button>

        <span style={{ fontSize:22, width:30, textAlign:"center", flexShrink:0 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={30} emojiSize={22}/></span>

        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:3 }}>
            {isEditingPrice ? (
              <input autoFocus type="number" placeholder="0" value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onBlur={() => savePrice(item.id)}
                onKeyDown={(e) => e.key==="Enter" && savePrice(item.id)}
                style={{ background:"var(--soft)", border:"1.5px solid var(--accent)", borderRadius:"var(--radius-sm,10px)", color:"var(--accentDark)", fontSize:13, width:80, padding:"2px 6px", textAlign:"right", outline:"none" }} />
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setEditingPriceId(item.id); setTempPrice(item.price||""); }}
                style={{ background:"none", border:"none", color:item.price?"var(--accent)":"#AAA", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline dotted" }}>
                {item.price ? `${sym}${Math.round(subtotal).toLocaleString()}` : "+ precio"}
              </button>
            )}
            {item.note && <span style={{ background:"var(--soft)", borderRadius:6, padding:"1px 8px", fontSize:11, color:"var(--accentDark)", border:"1px solid var(--border)" }}>📝 {item.note}</span>}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
          {qty===1 ? (
            <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDelete(item.id, stage); }}
              style={{ background:"#FCE5E5", border:"none", color:"#EF4444", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyMinus(item.id); }}
              style={{ background:"#EEEAE2", border:"1px solid var(--border)", color:"#1A2118", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
          )}
          <span style={{ fontSize:14, fontWeight:800, minWidth:22, textAlign:"center" }}>{qty}</span>
          <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyPlus(item.id); }}
            style={{ background:"#EEEAE2", border:"1px solid var(--border)", color:"#1A2118", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        </div>
      </div>
    </div>
  );
});



// ── Quick name suggestions for new lists ─────────────────────────────────────
const LIST_SUGGESTIONS = ["🏠 Casa","🛒 Semana","🎉 Fiesta","💪 Gym","🍳 Desayuno","🌮 Cena","🧹 Limpieza","🎂 Cumple","📦 Mes","🐾 Mascotas"];

// ── ListCard — memoized so it only re-renders when its own list changes ───────
const ListCard = memo(function ListCard({ list, idx, card, theme, sym, onOpenList, onDeleteList }) {
  const { done, total, cost, pct } = useMemo(() => {
    const done  = list.items.filter(isInCart).length;
    const total = list.items.length;
    // Price shown on the home card mirrors "en lista de compras" inside ListView:
    // only items still in the shopping stage (not yet in the cart, not just inventory).
    const cost  = totalCost(list.items.filter(it => stageOf(it) === "shopping"));
    const pct   = total > 0 ? (done / total) * 100 : 0;
    return { done, total, cost, pct };
  }, [list.items]);

  return (
    <div key={list.id} onClick={() => onOpenList(list.id)}
      className="list-card pressable"
      style={{ ...card, margin:"0 16px 10px", padding:"18px 20px 16px", cursor:"pointer", animation:`slItemSpring .30s var(--ease-spring) ${idx*.06}s both`, transition:"transform 0.25s var(--ease-spring), box-shadow 0.25s ease", contain:"layout style paint" }}
      onMouseMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top)  / r.height - 0.5;
        el.style.transform = `perspective(600px) rotateX(${-y*6}deg) rotateY(${x*6}deg) translateY(-3px) scale(1.012)`;
        el.style.boxShadow = theme.isDark
          ? `${-x*8}px ${-y*8+8}px 28px rgba(0,0,0,0.42)`
          : `${-x*8}px ${-y*8+8}px 24px rgba(0,0,0,0.10)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.transform = "";
        el.style.boxShadow = "";
      }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: total>0 ? 12 : 0 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:800, color: theme.isDark ? "#FFFFFF" : "#1A2118", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", lineHeight:1.3 }}>{list.name}</div>
          <div style={{ fontSize:12, color: theme.isDark ? "#D4B8F0" : "#9E9285", marginTop:3, fontWeight:500 }}>
            {total > 0 ? `${total} artículo${total!==1?"s":""} · ${done} en bolsa` : "Vacía — toca para añadir"}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:12 }}>
          {cost > 0 && (
            <span style={{ fontSize:13, fontWeight:800, color: theme.isDark ? "#D4B8F0" : theme.tagColor, background: theme.tagBg, borderRadius:"var(--radius-sm)", padding:"4px 10px" }}>
              {sym}{Math.round(cost).toLocaleString()}
            </span>
          )}
          <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDeleteList(list.id); }}
            style={{ background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border:"none", color: theme.isDark ? "#B06BE0" : "#C4B9AF", fontSize:13, cursor:"pointer", width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background .12s" }}>✕</button>
        </div>
      </div>
      {total > 0 && (
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div className="wc-progress-track" style={{ flex:1 }}>
            <div className="wc-progress-fill" style={{ width:`${pct}%` }} />
          </div>
          <span style={{ fontSize:11, color: theme.isDark ? "#B06BE0" : "#B0A898", fontWeight:700, flexShrink:0 }}>{done}/{total}</span>
        </div>
      )}
    </div>
  );
});

// ── ListsView ─────────────────────────────────────────────────────────────────
function ListsView({ lists, onOpenList, onDeleteList, onCreateList, sym, history, budget, themeName, theme }) {
  const [newName, setNewName] = useState("");
  const inputRef = useRef(null);

  const handleCreate = (name) => {
    const n = (name || newName).trim();
    if (!n) return;
    Sounds.createList();
    onCreateList(n);
    setNewName("");
  };

  const card = useMemo(() => ({
    background: theme.isDark
      ? "rgba(45,10,72,0.92)"
      : "rgba(255,255,255,0.94)",
    borderRadius: 22,
    border: theme.isDark
      ? "1px solid rgba(91,26,142,0.28)"
      : `1px solid ${theme.border}`,
    boxShadow: theme.isDark
      ? "0 4px 20px rgba(0,0,0,0.35)"
      : `0 3px 16px rgba(0,0,0,0.06)`,
  }), [theme]);

  return (
    <>
      {/* ── Compact Hero Banner — glass, glow, no patterns ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "0 0 26px 26px",
        background: themeName === "moon"
          ? "linear-gradient(160deg, #25083F 0%, #3D1465 100%)"
          : themeName === "pink"
          ? "linear-gradient(160deg, #fff0f6 0%, #fce7f3 60%, #fdf2f8 100%)"
          : "linear-gradient(160deg, #f0fdf4 0%, #dcfce7 60%, #ecfdf5 100%)",
        boxShadow: themeName === "moon"
          ? "0 6px 28px rgba(91,26,142,0.35), 0 1px 0 rgba(139,63,200,0.20)"
          : themeName === "pink"
          ? "0 6px 24px rgba(236,72,153,0.12), 0 1px 0 rgba(249,168,212,0.30)"
          : "0 6px 24px rgba(22,163,74,0.10), 0 1px 0 rgba(134,239,172,0.30)",
      }}>

        {/* Soft orb — top right */}
        <div style={{
          position:"absolute", top:-28, right:-28,
          width:110, height:110, borderRadius:"50%",
          background: themeName === "moon"
            ? "radial-gradient(circle, rgba(139,63,200,0.35) 0%, transparent 70%)"
            : themeName === "pink"
            ? "radial-gradient(circle, rgba(244,114,182,0.28) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(74,222,128,0.28) 0%, transparent 70%)",
          pointerEvents:"none",
          animation:"orbFloat 8s ease-in-out infinite",
          willChange:"transform",
        }} />

        {/* Soft orb — bottom left */}
        <div style={{
          position:"absolute", bottom:-22, left:-18,
          width:80, height:80, borderRadius:"50%",
          background: themeName === "moon"
            ? "radial-gradient(circle, rgba(139,63,200,0.28) 0%, transparent 70%)"
            : themeName === "pink"
            ? "radial-gradient(circle, rgba(251,113,133,0.18) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(52,211,153,0.20) 0%, transparent 70%)",
          pointerEvents:"none",
          animation:"orbFloat 10s ease-in-out infinite reverse",
          willChange:"transform",
        }} />

        {/* Glass shimmer sweep */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          background: themeName === "moon"
            ? "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%)"
            : themeName === "pink"
            ? "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.72) 48%, rgba(255,200,230,0.45) 52%, transparent 72%)"
            : "linear-gradient(105deg, transparent 25%, rgba(255,255,255,0.72) 48%, rgba(200,255,220,0.45) 52%, transparent 72%)",
        }} />

        {/* Moon stars */}
        {themeName === "moon" && (
          <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
            {[{t:"22%",l:"18%",s:1.5},{t:"50%",l:"62%",s:2},{t:"28%",l:"78%",s:1},{t:"68%",l:"28%",s:1.5},{t:"14%",l:"48%",s:1}].map((st,i) => (
              <div key={i} style={{
                position:"absolute", top:st.t, left:st.l,
                width:st.s, height:st.s, borderRadius:"50%",
                background:"#FEFCF9",
                boxShadow:`0 0 ${st.s*4}px rgba(255,255,255,0.55)`,
                animation:`starTwinkle ${2+i*0.4}s ease-in-out infinite`,
              }} />
            ))}
          </div>
        )}

        {/* ── Content row ── */}
        <div style={{
          position:"relative", zIndex:2,
          display:"flex", alignItems:"center", gap:12,
          padding:"13px 16px 12px",
        }}>

          {/* Emoji badge — frosted glass */}
          <div style={{
            width:40, height:40, borderRadius:14, flexShrink:0,
            background: themeName === "moon"
              ? "rgba(91,26,142,0.35)"
              : "rgba(255,255,255,0.85)",
            border:`1.5px solid ${
              themeName === "moon" ? "rgba(139,63,200,0.40)"
              : themeName === "pink" ? "rgba(244,114,182,0.28)"
              : "rgba(74,222,128,0.30)"
            }`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:19,
            boxShadow: themeName === "moon"
              ? "0 2px 10px rgba(91,26,142,0.35)"
              : "0 2px 10px rgba(0,0,0,0.06)",
            animation:"badgePop .4s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            {themeName === "moon" ? "⚽" : themeName === "pink" ? "🌸" : "🌿"}
          </div>

          {/* Text */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:15, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.2,
              color: themeName === "moon" ? "#FFFFFF" : themeName === "pink" ? "#9d174d" : "#14532D",
              animation:"fadeSlideIn .35s ease both",
            }}>
              {lists.length === 0 ? "¡Hola! 👋" : `${lists.length} lista${lists.length!==1?"s":""}`}
              {lists.length > 0 && (() => {
                const totalItems = lists.reduce((s,l)=>s+l.items.length,0);
                const checked    = lists.reduce((s,l)=>s+l.items.filter(isInCart).length,0);
                return totalItems > 0
                  ? <span style={{ fontWeight:500, fontSize:11.5, marginLeft:7, opacity:0.62 }}>· {totalItems} art{checked>0?` · ${checked} ✓`:""}</span>
                  : null;
              })()}
            </div>
            <div style={{
              fontSize:11, fontWeight:500, marginTop:2,
              color: themeName === "moon" ? "rgba(212,184,240,0.80)" : themeName === "pink" ? "rgba(157,23,77,0.52)" : "rgba(20,83,45,0.52)",
              animation:"fadeSlideIn .35s .05s ease both",
            }}>
              {lists.length === 0 ? "Crea tu primera lista 🛒" : "Toca una para comprar"}
            </div>
          </div>

          {/* Cart pill — frosted glass */}
          <div style={{
            display:"flex", alignItems:"center", gap:5,
            background: themeName === "moon"
              ? "rgba(91,26,142,0.35)"
              : "rgba(255,255,255,0.85)",
            border:`1px solid ${
              themeName === "moon" ? "rgba(139,63,200,0.35)"
              : themeName === "pink" ? "rgba(244,114,182,0.25)"
              : "rgba(74,222,128,0.25)"
            }`,
            borderRadius:22, padding:"5px 12px 5px 9px",
            boxShadow: themeName === "moon"
              ? "0 2px 10px rgba(91,26,142,0.28)"
              : "0 2px 10px rgba(0,0,0,0.05)",
            animation:"badgePop .4s .08s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            <span style={{ fontSize:15 }}>🛒</span>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.02em",
              color: themeName === "moon" ? "#D4B8F0" : themeName === "pink" ? "#be185d" : "#166534",
            }}>Lista</span>
          </div>
        </div>

        {/* Hairline glow divider */}
        <div style={{
          height:1,
          background: themeName === "moon"
            ? "linear-gradient(90deg, transparent, rgba(139,63,200,0.40), transparent)"
            : themeName === "pink"
            ? "linear-gradient(90deg, transparent, rgba(244,114,182,0.30), transparent)"
            : "linear-gradient(90deg, transparent, rgba(74,222,128,0.30), transparent)",
        }} />
      </div>

      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"16px 0 8px" }}>

        {/* ── Existing lists ── */}
        {lists.map((list, idx) => (
          <ListCard key={list.id} list={list} idx={idx} card={card} theme={theme} sym={sym} onOpenList={onOpenList} onDeleteList={onDeleteList} />
        ))}

        {/* ── Create new list — always visible, no modal ── */}
        <div style={{ ...card, margin:"0 16px 16px", padding:"20px 20px 16px", border: theme.isDark ? "1.5px dashed rgba(139,63,200,0.40)" : `1.5px dashed ${theme.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color: theme.isDark ? "#D4B8F0" : theme.tagColor, marginBottom:12, letterSpacing:".01em" }}>✨ Nueva lista</div>

          {/* Big input */}
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
            <input
              id="nueva-lista-input"
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleCreate()}
              placeholder="¿Cómo se llama?"
              style={{ flex:1, minWidth:0, background: theme.isDark ? "rgba(45,10,72,0.75)" : "rgba(255,255,255,0.7)", border: theme.isDark ? "1.5px solid rgba(139,63,200,0.35)" : `1.5px solid ${theme.border}`, borderRadius:14, padding:"13px 16px", color: theme.isDark ? "#FFFFFF" : "#1A2118", fontSize:16, fontWeight:600, outline:"none", boxSizing:"border-box", transition:"border-color .15s" }}
              onFocus={e  => e.target.style.borderColor="var(--accent)"}
              onBlur={e   => e.target.style.borderColor= theme.isDark ? "rgba(139,63,200,0.35)" : theme.border}
            />
            <button
              onClick={(e) => { ripple(e,"rgba(255,255,255,0.3)"); handleCreate(); }}
              style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:14, width:52, height:52, fontSize:26, color:"#fff", fontWeight:900, cursor:"pointer", flexShrink:0, boxShadow:`0 3px 12px ${theme.pillBorder}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              +
            </button>
          </div>

          {/* Quick suggestion chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {LIST_SUGGESTIONS.map(s => (
              <button key={s} onClick={() => handleCreate(s)}
                style={{ background: theme.tagBg, border:`1px solid ${theme.pillBorder}`, borderRadius:20, padding:"6px 13px", fontSize:13, fontWeight:600, color: theme.tagColor, cursor:"pointer", transition:"background .12s" }}
                onMouseEnter={e => e.currentTarget.style.background=theme.pillBg}
                onMouseLeave={e => e.currentTarget.style.background=theme.tagBg}
                onTouchStart={e => e.currentTarget.style.background=theme.pillBg}
                onTouchEnd={e   => e.currentTarget.style.background=theme.tagBg}>
                {s}
              </button>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

// ── ListView ──────────────────────────────────────────────────────────────────
function ListView({ list, onBack, onUpdateItem, onDeleteItem, onGoAdd, sym, budget, onOpenProfile, onSaveBudget, onCloseSession, theme = {} }) {
  const Sth = useMemo(() => makeStyles(theme), [theme]);
  const [searchQuery,    setSearchQuery]   = useState("");
  const [showCart,       setShowCart]      = useState(true);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice,      setTempPrice]     = useState("");
  const [contextItemId,  setContextItemId] = useState(null);
  const [editingItem,    setEditingItem]   = useState(null);
  const [budgetFlipped,  setBudgetFlipped]  = useState(false);
  const [showShopping,   setShowShopping]   = useState(true);
  const [showInventory,  setShowInventory]  = useState(true);
  const [editingBudget,  setEditingBudget]  = useState(false);
  const [budgetDraft,    setBudgetDraft]    = useState(budget || "");
  const holdTimerRef = useRef(null);
  const budgetNum    = parseFloat(budget) || 0;

  const savePrice = useCallback((id) => { onUpdateItem(id, it => ({ ...it, price:tempPrice })); setEditingPriceId(null); }, [onUpdateItem, tempPrice]);

  // Stable callbacks — defined once so memo(SwipeItem) can bail out on unchanged items
  // Tap advances an item one stage forward: inventory → shopping → cart.
  // From the cart, tapping again sends it back one stage (to shopping) — toggle behavior only at that final stage.
  const handleToggle = useCallback((id) => onUpdateItem(id, it => {
    const stage = stageOf(it);
    if (stage === "inventory") return { ...it, stage:"shopping" };
    if (stage === "shopping")  return { ...it, stage:"cart" };
    return { ...it, stage:"shopping" }; // cart → shopping
  }), [onUpdateItem]);
  // Swipe-left "remove": from inventory it's a real delete; from shopping/cart it demotes back to inventory.
  const handleSwipeRemove = useCallback((id, stage) => {
    if (stage === "inventory") onDeleteItem(id);
    else onUpdateItem(id, it => ({ ...it, stage:"inventory" }));
  }, [onDeleteItem, onUpdateItem]);
  const handleQtyMinus = useCallback((id) => onUpdateItem(id, it => ({ ...it, qty:Math.max(1,(it.qty||1)-1) })), [onUpdateItem]);
  const handleQtyPlus  = useCallback((id) => onUpdateItem(id, it => ({ ...it, qty:(it.qty||1)+1 })), [onUpdateItem]);

  const { all, inventory, shopping, cart, done, tot, inBagCost, shoppingCost, remaining, overBudget, budgetPct } = useMemo(() => {
    const all       = searchQuery ? list.items.filter(i => normalizeSearch(i.name).includes(normalizeSearch(searchQuery))) : list.items;
    const inventory = all.filter(i => stageOf(i) === "inventory");
    const shopping  = all.filter(i => stageOf(i) === "shopping");
    const cart      = all.filter(i => stageOf(i) === "cart");
    const done      = list.items.filter(i => stageOf(i) === "cart").length;
    const tot       = list.items.length;
    // "libre" = presupuesto menos SOLO lo que ya está en el carrito
    const inBagCost    = totalCost(list.items.filter(i => stageOf(i) === "cart"));
    const shoppingCost = totalCost(list.items.filter(i => stageOf(i) === "shopping"));
    const remaining  = budgetNum - inBagCost;
    const overBudget = budgetNum > 0 && remaining < 0;
    const budgetPct  = budgetNum > 0 ? (inBagCost / budgetNum) * 100 : 0;
    return { all, inventory, shopping, cart, done, tot, inBagCost, shoppingCost, remaining, overBudget, budgetPct };
  }, [list.items, searchQuery, budgetNum]);

  // 🔔 Budget alert sound — fires once when going over
  const wasOverBudget = useRef(false);
  useEffect(() => {
    if (overBudget && !wasOverBudget.current) Sounds.budgetAlert();
    wasOverBudget.current = overBudget;
  }, [overBudget]);

  // Hold 0.75s en el card de presupuesto para editar inline
  const onBudgetPointerDown = () => {
    holdTimerRef.current = setTimeout(() => {
      if (navigator.vibrate) navigator.vibrate(30);
      setBudgetDraft(budget || "");
      setEditingBudget(true);
      setBudgetFlipped(false);
    }, 750);
  };
  const onBudgetPointerUp = () => {
    clearTimeout(holdTimerRef.current);
  };
  const confirmBudgetEdit = () => {
    onSaveBudget(budgetDraft);
    setEditingBudget(false);
  };

  const contextItem = contextItemId ? list.items.find(i => i.id===contextItemId) : null;

  return (
    <>
      <div className="view-enter-fwd" style={{ display:"flex", flexDirection:"column", height:"100svh", overflow:"hidden" }}>
      <div style={Sth.header}>
        <button onClick={() => { Sounds.navBack(); onBack(); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", padding:"4px 8px 4px 0", display:"flex", alignItems:"center", gap:5, borderRadius:10, transition:"opacity .15s" }} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <span style={{ fontSize:20, lineHeight:1, color:"var(--accent)" }}>‹</span>
        </button>
        <span style={{ flex:1, fontWeight:800, fontSize:18, color: theme.isDark ? "#FFFFFF" : "#1A2118" }}>{list.name}</span>
        <span style={{ background: theme.isDark ? "rgba(91,26,142,0.28)" : "var(--soft)", borderRadius:"var(--radius-sm,10px)", padding:"3px 10px", fontSize:13, color: theme.isDark ? "#D4B8F0" : "var(--accentDark)", fontWeight:600, marginRight:4 }}>{done}/{tot}</span>

        {/* ── Budget flip card en el header ── */}
        {editingBudget ? (
          <div style={{ display:"flex", alignItems:"center", gap:4, background: theme.isDark ? "rgba(91,26,142,0.28)" : "var(--soft)", border:"1.5px solid var(--accent)", borderRadius:22, padding:"0 10px", height:38, animation:"fadeIn .15s ease" }}>
            <span style={{ color:"var(--accentDark)", fontWeight:900, fontSize:14 }}>{sym}</span>
            <input autoFocus type="number" value={budgetDraft}
              onChange={e => setBudgetDraft(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") confirmBudgetEdit(); if(e.key==="Escape") setEditingBudget(false); }}
              onBlur={confirmBudgetEdit}
              style={{ width:52, background:"none", border:"none", color: theme.isDark ? "#FFFFFF" : "#2C2318", fontSize:14, fontWeight:800, outline:"none", textAlign:"right" }}
              placeholder="0" />
          </div>
        ) : (
          <div className={`flip-card${budgetFlipped ? " flipped" : ""}`}
            style={{ width:84, height:38 }}
            onClick={() => { if(budgetNum > 0) setBudgetFlipped(v => !v); else onOpenProfile(); }}
            onPointerDown={onBudgetPointerDown}
            onPointerUp={onBudgetPointerUp}
            onPointerLeave={onBudgetPointerUp}
            title={budgetNum > 0 ? "Toca para ver libre · Mantén para editar" : "Configurar presupuesto"}>
            <div className="flip-card-inner">
              <div className="flip-card-front" style={{ flexDirection:"row", alignItems:"center", gap:5, padding:"0 10px" }}>
                <span style={{ fontSize:16 }}>🛍</span>
                <div style={{ lineHeight:1.2 }}>
                  <span style={{ fontSize:8, color:"var(--accentDark)", display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700 }}>
                    {budgetNum > 0 ? "presup." : "bolsa"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color:"var(--accentDark)" }}>
                    {budgetNum > 0 ? `${sym}${budgetNum >= 1000 ? formatK(budgetNum) : budgetNum}` : `${sym}${Math.round(inBagCost).toLocaleString()}`}
                  </span>
                </div>
              </div>
              <div className={`flip-card-back${overBudget ? " over" : ""}`} style={{ flexDirection:"row", alignItems:"center", gap:5, padding:"0 10px" }}>
                <span style={{ fontSize:16 }}>{overBudget ? "🚨" : "✅"}</span>
                <div style={{ lineHeight:1.2 }}>
                  <span style={{ fontSize:8, display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700, color: overBudget ? "#fca5a5" : "#4ADE80" }}>
                    {overBudget ? "excedido" : "libre"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color: overBudget ? "#f87171" : "var(--accent)" }}>
                    {remaining < 0 ? "-" : ""}{sym}{Math.abs(Math.round(remaining)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {tot>0 && (
        <div style={{ height:5, background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.07)", overflow:"hidden" }}>
          <div style={{ height:"100%", background: budgetNum>0
            ? overBudget
              ? "linear-gradient(90deg,#EF4444,#B91C1C)"
              : `linear-gradient(90deg,#38bdf8,#0ea5e9)`
            : "linear-gradient(90deg,var(--accent),var(--accentDark))",
            borderRadius:"0 2px 2px 0", width:`${budgetNum>0 ? Math.min(budgetPct,100) : tot?(done/tot)*100:0}%`,
            transition:"width .55s cubic-bezier(.4,0,.2,1)",
            boxShadow:"0 0 8px rgba(var(--accent-rgb),0.45)",
          }} />
        </div>
      )}

      <div style={Sth.body}>
        {list.items.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🛒</div>
            <div style={{ fontSize:18, fontWeight:700, color: theme.isDark ? "#FFFFFF" : "#2C2318", marginBottom:6 }}>Tu lista está vacía</div>
            <div style={{ fontSize:13, color: theme.isDark ? "#D4B8F0" : "#9E9285" }}>Toca + Añadir para agregar artículos</div>
          </div>
        )}
        {searchQuery && all.length===0 && <div style={{ fontSize:13, color: theme.isDark ? "#D4B8F0" : "#9E9285", padding:20, textAlign:"center" }}>Sin resultados para "{searchQuery}"</div>}

        {/* ── Inventario: header colapsable ── */}
        {inventory.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"8px 16px 6px", borderBottom: theme.isDark ? "1px solid #1E293B" : "1px solid #F0F2EF" }}>
            <button onClick={() => setShowInventory(v => !v)}
              style={{ background:"none", border:"none", color: theme.isDark ? "#D4B8F0" : "#7A6E5F", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0, fontWeight:700 }}>
              <span style={{ fontSize:11, transition:"transform .2s", display:"inline-block", transform: showInventory ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              <span>Inventario</span>
              <span style={{ background: theme.isDark ? "rgba(45,10,72,0.85)" : "#EDE8DF", borderRadius:10, padding:"1px 8px", fontSize:11, color: theme.isDark ? "#D4B8F0" : "#8A8075", fontWeight:600 }}>{inventory.length}</span>
            </button>
          </div>
        )}

        {showInventory && inventory.map(item => (
          <SwipeItem key={item.id} item={item}
            onToggle={handleToggle}
            onQtyMinus={handleQtyMinus}
            onQtyPlus={handleQtyPlus}
            onDelete={handleSwipeRemove} onContextMenu={setContextItemId}
            editingPriceId={editingPriceId} tempPrice={tempPrice}
            setTempPrice={setTempPrice} setEditingPriceId={setEditingPriceId} savePrice={savePrice}
            sym={sym} />
        ))}

        {/* ── Lista de Compras: header colapsable, con subtotal propio ── */}
        {shopping.length>0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"9px 12px 9px 16px", borderTop:"1px solid #DCEFF9", background:"#EAF5FB", gap:8 }}>
            <button onClick={() => setShowShopping(v => !v)}
              style={{ background:"none", border:"none", color:"#0369A1", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0, fontWeight:700, flex:1, minWidth:0 }}>
              <span style={{ fontSize:10, transition:"transform .2s", display:"inline-block", transform: showShopping ? "rotate(0deg)" : "rotate(-90deg)", opacity:.7 }}>▼</span>
              <span style={{ fontSize:15, lineHeight:1 }}>📝</span>
              <span style={{ fontSize:13, color:"#2C2318", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {shopping.length === 1 ? "1 en lista de compras" : `${shopping.length} en lista de compras`}
              </span>
              {shoppingCost > 0 && (
                <span style={{ fontSize:12, color:"#0369A1", fontWeight:800, background:"#FFFFFF", borderRadius:"var(--radius-sm,10px)", padding:"1px 7px", marginLeft:2, flexShrink:0 }}>
                  {sym}{Math.round(shoppingCost).toLocaleString()}
                </span>
              )}
            </button>
          </div>
        )}

        {showShopping && shopping.map(item => (
          <SwipeItem key={item.id} item={item}
            onToggle={handleToggle}
            onQtyMinus={handleQtyMinus}
            onQtyPlus={handleQtyPlus}
            onDelete={handleSwipeRemove} onContextMenu={setContextItemId}
            editingPriceId={editingPriceId} tempPrice={tempPrice}
            setTempPrice={setTempPrice} setEditingPriceId={setEditingPriceId} savePrice={savePrice}
            sym={sym} />
        ))}

        {/* ── En el Carrito de Compras: header colapsable, con subtotal propio ── */}
        {cart.length>0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"9px 12px 9px 16px", borderTop:"1px solid #DCF4DE", background:"#ECF6ED", gap:8 }}>
            {/* Collapse toggle + label */}
            <button onClick={() => setShowCart(v => !v)}
              style={{ background:"none", border:"none", color:"var(--accentDark)", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0, fontWeight:700, flex:1, minWidth:0 }}>
              <span style={{ fontSize:10, transition:"transform .2s", display:"inline-block", transform: showCart ? "rotate(0deg)" : "rotate(-90deg)", opacity:.7 }}>▼</span>
              <span style={{ fontSize:15, lineHeight:1 }}>🛍</span>
              <span style={{ fontSize:13, color:"#2C2318", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {cart.length === 1 ? "1 en el carrito" : `${cart.length} en el carrito`}
              </span>
              {inBagCost > 0 && (
                <span style={{ fontSize:12, color:"var(--accentDark)", fontWeight:800, background:"var(--soft)", borderRadius:"var(--radius-sm,10px)", padding:"1px 7px", marginLeft:2, flexShrink:0 }}>
                  {sym}{Math.round(inBagCost).toLocaleString()}
                </span>
              )}
            </button>

            {/* ── Chip "Cerrar compra" ── */}
            <button
              onClick={(e) => { Sounds.checkout(); const colors=["#22C55E","#4ADE80","#FCD34D","#60A5FA","#F472B6","#A78BFA"]; celebrateCheckout(colors); ripple(e); onCloseSession({ total: inBagCost, items: list.items.filter(isInCart), listName: list.name, date: Date.now(), itemCount: done }); }}
              style={{
                display:"flex", alignItems:"center", gap:5,
                background:"linear-gradient(135deg,#22C55E 0%,#15803D 100%)",
                color:"#FFFFFF", border:"none", borderRadius:100,
                padding:"6px 13px 6px 10px",
                fontSize:12, fontWeight:800, letterSpacing:".01em",
                cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
                boxShadow:"0 2px 8px rgba(22,163,74,.30)",
                animation:"chipIn .35s cubic-bezier(.34,1.56,.64,1) both",
                transition:"transform .14s var(--ease-spring), box-shadow .14s ease",
                fontFamily:"inherit",
              }}
              onMouseDown={e  => { e.currentTarget.style.transform="scale(.92)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(22,163,74,.20)"; }}
              onMouseUp={e    => { e.currentTarget.style.transform="scale(1)";   e.currentTarget.style.boxShadow="0 2px 8px rgba(22,163,74,.30)"; }}
              onTouchStart={e => { e.currentTarget.style.transform="scale(.92)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(22,163,74,.20)"; }}
              onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)";   e.currentTarget.style.boxShadow="0 2px 8px rgba(22,163,74,.30)"; }}
            >
              <span style={{ width:16, height:16, borderRadius:"50%", background:"#FFFFFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, lineHeight:1, flexShrink:0 }}>✓</span>
              Cerrar compra
            </button>
          </div>
        )}

        {showCart && cart.map(item => (
          <SwipeItem key={item.id} item={item}
            onToggle={handleToggle}
            onQtyMinus={handleQtyMinus}
            onQtyPlus={handleQtyPlus}
            onDelete={handleSwipeRemove} onContextMenu={setContextItemId}
            editingPriceId={editingPriceId} tempPrice={tempPrice}
            setTempPrice={setTempPrice} setEditingPriceId={setEditingPriceId} savePrice={savePrice}
            sym={sym} />
        ))}
      </div>
      </div>

      {/* FABs */}
      <button className="wc-fab" onClick={(e) => { ripple(e, "rgba(255,255,255,0.3)"); onGoAdd(); }}>+ Añadir</button>

      <div style={Sth.bottomBar}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color: theme.isDark ? "#B06BE0" : "#9E9285", fontSize:16, pointerEvents:"none" }}>🔍</span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en lista..."
            style={{ width:"100%", background: theme.isDark ? "rgba(45,10,72,0.85)" : "rgba(255,255,255,0.80)", border: theme.isDark ? "1px solid #334155" : `1px solid ${theme?.border||"#D8DDD6"}`, borderRadius:22, padding:"9px 16px 9px 36px", color: theme.isDark ? "#FFFFFF" : "#2C2318", fontSize:14, outline:"none", boxSizing:"border-box" }} />
        </div>
      </div>



      {contextItem && (
        <ContextMenu item={contextItem} sym={sym}
          onClose={() => setContextItemId(null)}
          onDelete={() => { onDeleteItem(contextItem.id); setContextItemId(null); }}
          onDuplicate={() => { const copy={...contextItem,id:genId(),name:contextItem.name+" (copia)"}; onUpdateItem(null,null,copy); setContextItemId(null); }}
          onEdit={() => { setEditingItem({...contextItem}); setContextItemId(null); }}
          onChangeEmoji={(em) => onUpdateItem(contextItem.id, it => ({ ...it, emoji:em }))} />
      )}
      {editingItem && (
        <EditModal item={editingItem} sym={sym}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => { onUpdateItem(updated.id,()=>updated); setEditingItem(null); }} />
      )}
    </>
  );
}

// ── Emoji palette for custom items ───────────────────────────────────────────
const EMOJI_PALETTE = [
  // Frutas & verduras
  "🍎","🍊","🍋","🍇","🍓","🫐","🍑","🥝","🍍","🥭","🍈","🍒","🍅","🫒","🥑","🥦","🥬","🥕","🧅","🧄","🌽","🫑","🥔","🍠","🫚",
  // Lácteos y proteínas
  "🥛","🧀","🥚","🍗","🥩","🐟","🥓","🌭","🍖","🦐","🦑","🥟","🧆",
  // Panadería & cereales
  "🍞","🥐","🥖","🫓","🧇","🥞","🍪","🎂","🍰","🥧","🫘","🌾","🍚","🍝",
  // Bebidas
  "☕","🧃","🥤","🍵","🧋","🍺","🍷","🥂","💧","🧉","🫖",
  // Condimentos & despensa
  "🍯","🧂","🫙","🫕","🥣","🧈","🥫","🍿","🫙",
  // Higiene & limpieza
  "🧴","🧼","🧻","🪥","🧽","🪣","🫧","🧹","🪒","💊","🩺",
  // Varios & hogar
  "🛒","🛍","📦","🎁","🌿","🌸","⭐","✨","🔥","💡","🏠","🍴","🥄","🔪",
];

// ── AddItemsView ──────────────────────────────────────────────────────────────
function AddItemsView({ list, onBack, onAddItem, sym, theme = {} }) {
  const Sth = useMemo(() => makeStyles(theme), [theme]);
  const [search,       setSearch]      = useState("");
  const [category,     setCategory]    = useState("Todos");
  const [customEmoji,  setCustomEmoji] = useState("🛒");
  const [customName,   setCustomName]  = useState("");
  const [customPrice,  setCustomPrice] = useState(""); // precio del artículo personalizado, antes de agregarlo
  const [customDestination, setCustomDestination] = useState("shopping"); // "shopping" | "inventory"
  const [emojiAutoPicked, setEmojiAutoPicked] = useState(false); // true = current emoji came from auto-guess, not a manual tap
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Precios editados a mano por el usuario para artículos del catálogo (antes de
  // agregarlos) — clave: nombre del artículo, valor: precio en texto. Se usa en
  // vez del precio típico de CR_PRICES cuando el usuario lo modifica aquí mismo.
  const [priceOverrides, setPriceOverrides] = useState({});
  const [editingPresetPrice, setEditingPresetPrice] = useState(null); // nombre del preset cuyo precio se está editando
  const [tempPresetPrice,    setTempPresetPrice]    = useState("");

  const savePresetPrice = useCallback((name) => {
    setPriceOverrides(prev => ({ ...prev, [name]: tempPresetPrice }));
    setEditingPresetPrice(null);
  }, [tempPresetPrice]);

  const addedNames = useMemo(() => new Set(list.items.map(it => it.name)), [list.items]);
  const filtered = useMemo(() => PRESET_ITEMS.filter(p => {
    const inCat    = category==="Todos" || p.category===category;
    const inSearch = normalizeSearch(p.name).includes(normalizeSearch(search));
    return inCat && inSearch && !addedNames.has(p.name);
  }), [category, search, addedNames]);

  const addPreset = (p, e) => { Sounds.addItem(); if(e){ const r=e.currentTarget.getBoundingClientRect(); spawnEmojiParticle(r.left+r.width/2, r.top, p.emoji); ripple(e,"color-mix(in srgb, var(--accent) 18%, white)"); } const priceToUse = priceOverrides[p.name] !== undefined ? priceOverrides[p.name] : String(CR_PRICES[p.name]||""); onAddItem({ id:genId(), name:p.name, emoji:p.emoji, category:p.category, stage: customDestination === "shopping" ? "shopping" : "inventory", checked:false, price:priceToUse, qty:1, unit:"pza", note:"" }); };

  // Auto-select an icon as the user types, unless they've manually chosen one from the palette
  const handleCustomNameChange = (val) => {
    setCustomName(val);
    if (!emojiAutoPicked) {
      const guess = guessEmojiForName(val);
      setCustomEmoji(guess || "🛒");
    } else if (!val.trim()) {
      // Cleared the field — release the manual pin so auto-guessing resumes next time
      setEmojiAutoPicked(false);
      setCustomEmoji("🛒");
    }
  };

  const handleManualEmojiPick = (em) => {
    setCustomEmoji(em);
    setEmojiAutoPicked(true);
    setShowEmojiPicker(false);
  };

  const addCustom = (e) => {
    if (!customName.trim()) return;
    Sounds.addItem();
    if(e){ const r=e.currentTarget.getBoundingClientRect(); spawnEmojiParticle(r.left+r.width/2, r.top, customEmoji); ripple(e,"rgba(255,255,255,0.3)"); }
    onAddItem({ id:genId(), name:customName.trim(), emoji:customEmoji, category:"Otros", stage: customDestination === "shopping" ? "shopping" : "inventory", checked:false, price:customPrice, qty:1, unit:"pza", note:"" });
    setCustomName(""); setCustomEmoji("🛒"); setEmojiAutoPicked(false); setCustomPrice(""); setCustomDestination("shopping"); setShowEmojiPicker(false);
  };

  return (
    <>
      <div className="view-enter-fwd" style={{ display:"flex", flexDirection:"column", height:"100svh", overflow:"hidden" }}>
      {/* ── Header ── */}
      <div style={{
        display:"flex", alignItems:"center",
        padding:"14px 16px 13px",
        gap:10,
        position:"sticky", top:0, zIndex:10,
        background: theme.isDark
          ? "rgba(12,18,38,0.75)"
          : "rgba(255,255,255,0.58)",
        backdropFilter: "blur(22px) saturate(1.8)",
        WebkitBackdropFilter: "blur(22px) saturate(1.8)",
        borderBottom: theme.isDark
          ? "1px solid rgba(255,255,255,0.07)"
          : "1px solid rgba(255,255,255,0.80)",
        boxShadow: theme.isDark
          ? "0 2px 24px rgba(0,0,0,0.28)"
          : "0 2px 16px rgba(80,60,20,0.07)",
      }}>
        {/* Back chevron — soft pill, no flash */}
        <button
          onClick={() => { Sounds.navBack(); onBack(); }}
          style={{
            background: theme.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            border:"none",
            color:"var(--accent)",
            cursor:"pointer",
            width:34, height:34,
            display:"flex", alignItems:"center", justifyContent:"center",
            borderRadius:10,
            fontSize:20, lineHeight:1,
            flexShrink:0,
            transition:"background .18s ease, transform .16s cubic-bezier(0.34,1.4,0.64,1)",
          }}
          onMouseEnter={e => e.currentTarget.style.background = theme.isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.09)"}
          onMouseLeave={e => e.currentTarget.style.background = theme.isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)"}
          onMouseDown={e  => e.currentTarget.style.transform = "scale(0.88)"}
          onMouseUp={e    => e.currentTarget.style.transform = "scale(1)"}
          onTouchStart={e => e.currentTarget.style.transform = "scale(0.88)"}
          onTouchEnd={e   => e.currentTarget.style.transform = "scale(1)"}
        >‹</button>

        {/* Title + emoji badge */}
        <div style={{ flex:1, display:"flex", alignItems:"center", gap:8, minWidth:0 }}>
          <span style={{ fontSize:18, lineHeight:1 }}>🛍️</span>
          <span style={{
            fontWeight:800, fontSize:17,
            color: theme.isDark ? "#FFFFFF" : "#1A2118",
            letterSpacing:"-0.01em",
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
          }}>Agregar artículos</span>
        </div>

        {/* Done button — accent pill, smooth press */}
        <button
          onClick={() => { Sounds.save(); onBack(); }}
          style={{
            background:"linear-gradient(135deg,var(--accent),var(--accentDark))",
            border:"none", borderRadius:20,
            padding:"7px 16px",
            color:"#fff", fontSize:13, fontWeight:800,
            cursor:"pointer", flexShrink:0,
            boxShadow:"0 2px 10px rgba(var(--accent-rgb,22,163,74),0.34)",
            transition:"transform .16s cubic-bezier(0.34,1.4,0.64,1), box-shadow .16s ease",
            letterSpacing:"0.01em",
          }}
          onMouseDown={e  => { e.currentTarget.style.transform="scale(0.93)"; e.currentTarget.style.boxShadow="0 1px 4px rgba(var(--accent-rgb,22,163,74),0.22)"; }}
          onMouseUp={e    => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow="0 2px 10px rgba(var(--accent-rgb,22,163,74),0.34)"; }}
          onTouchStart={e => { e.currentTarget.style.transform="scale(0.93)"; e.currentTarget.style.boxShadow="0 1px 4px rgba(var(--accent-rgb,22,163,74),0.22)"; }}
          onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow="0 2px 10px rgba(var(--accent-rgb,22,163,74),0.34)"; }}
        >Listo ✓</button>
      </div>

      {/* ── Custom item row ── */}
      <div style={{
        flexShrink:0,
        padding:"14px 16px 14px",
        borderBottom: theme.isDark
          ? "1px solid rgba(255,255,255,0.07)"
          : "1px solid rgba(255,255,255,0.60)",
        background: theme.isDark
          ? "rgba(37,8,63,0.70)"
          : "rgba(255,255,255,0.52)",
        backdropFilter: "blur(14px) saturate(1.5)",
        WebkitBackdropFilter: "blur(14px) saturate(1.5)",
      }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9E9285", letterSpacing:".06em", textTransform:"uppercase", marginBottom:10 }}>Artículo personalizado</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Big emoji button */}
          <button onClick={() => setShowEmojiPicker(v => !v)}
            style={{ width:52, height:52, background: showEmojiPicker ? "var(--accent)" : "#EDE8DF", border: showEmojiPicker ? "2px solid var(--accentDark)" : "2px solid transparent", borderRadius:16, fontSize:26, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", boxShadow: showEmojiPicker ? "0 2px 12px rgba(var(--accent-rgb,34,197,94),0.28)" : "none" }}>
            {customEmoji}
          </button>
          <input value={customName} onChange={e => handleCustomNameChange(e.target.value)} onKeyDown={e => e.key==="Enter" && addCustom()}
            placeholder="Nombre del artículo..."
            style={{ flex:1, background:"#FEFCF9", border:"1.5px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 14px", color:"#1A2118", fontSize:15, fontWeight:600, outline:"none", transition:"border-color .15s, box-shadow .15s", fontFamily:"inherit" }}
            onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--soft)"; }}
            onBlur={e  => e.target.style.borderColor="#D8DDD6"} />
          <button onClick={(e) => addCustom(e)}
            style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:14, width:52, height:52, fontSize:26, color:"#fff", fontWeight:900, cursor:"pointer", flexShrink:0, boxShadow:"0 2px 10px rgba(22,163,74,0.30)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            +
          </button>
        </div>

        {/* ── Precio del artículo personalizado — opcional, antes de agregarlo ── */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:10 }}>
          <span style={{ color:"var(--accent)", fontSize:14, fontWeight:800, flexShrink:0 }}>{sym}</span>
          <input type="number" inputMode="decimal" placeholder="Precio (opcional)" value={customPrice}
            onChange={e => setCustomPrice(e.target.value)}
            onKeyDown={e => e.key==="Enter" && addCustom()}
            style={{ flex:1, background:"#FEFCF9", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm,10px)", padding:"9px 12px", color:"#1A2118", fontSize:14, fontWeight:600, outline:"none", transition:"border-color .15s, box-shadow .15s", fontFamily:"inherit" }}
            onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--soft)"; }}
            onBlur={e  => { e.target.style.borderColor="#D8DDD6"; e.target.style.boxShadow="none"; }} />
        </div>

        {/* ── Destino del artículo: Lista de Compras o Inventario ── */}
        <div style={{ marginTop:10, position:"relative" }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#9E9285", letterSpacing:".06em", textTransform:"uppercase", marginBottom:6 }}>Agregar a</div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { value:"shopping", label:"Lista de compras", icon:"🛒" },
              { value:"inventory", label:"Inventario", icon:"📦" },
            ].map(opt => {
              const isActive = customDestination === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setCustomDestination(opt.value)}
                  style={{
                    flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:6,
                    padding:"9px 10px",
                    background: isActive
                      ? "linear-gradient(135deg,var(--accent),var(--accentDark))"
                      : (theme.isDark ? "rgba(45,10,72,0.55)" : "#F0EDE7"),
                    border: isActive ? "2px solid var(--accentDark)" : "2px solid transparent",
                    borderRadius:12,
                    color: isActive ? "#fff" : (theme.isDark ? "#D4B8F0" : "#6B5E52"),
                    fontSize:13, fontWeight:700, cursor:"pointer",
                    boxShadow: isActive ? "0 2px 10px rgba(var(--accent-rgb,34,197,94),0.30)" : "none",
                    transition:"all .18s cubic-bezier(0.34,1.2,0.64,1)",
                    fontFamily:"inherit",
                    letterSpacing:"0.01em",
                  }}
                  onMouseDown={e => { e.currentTarget.style.transform="scale(0.96)"; }}
                  onMouseUp={e   => { e.currentTarget.style.transform="scale(1)"; }}
                  onTouchStart={e => { e.currentTarget.style.transform="scale(0.96)"; }}
                  onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
                >
                  <span style={{ fontSize:15 }}>{opt.icon}</span>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Emoji palette (slides open) ── */}
        {showEmojiPicker && (
          <div style={{ marginTop:12, background:"#FEFCF9", border:"1px solid #E8E2D8", borderRadius:16, padding:"12px 10px", animation:"fadeIn .15s ease" }}>
            <div style={{ fontSize:10, color:"#B0A898", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", marginBottom:8, paddingLeft:2 }}>Elige un ícono</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {EMOJI_PALETTE.map(em => (
                <button key={em} onClick={() => handleManualEmojiPick(em)}
                  style={{ width:40, height:40, background: em===customEmoji ? "var(--accent)" : "rgba(0,0,0,0.04)", border: em===customEmoji ? "2px solid var(--accentDark)" : "2px solid transparent", borderRadius:10, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .1s, background .1s", flexShrink:0 }}
                  onTouchStart={e => e.currentTarget.style.transform="scale(1.2)"}
                  onTouchEnd={e   => e.currentTarget.style.transform="scale(1)"}
                  onMouseEnter={e => e.currentTarget.style.background = em===customEmoji ? "var(--accent)" : "rgba(34,197,94,0.14)"}
                  onMouseLeave={e => e.currentTarget.style.background = em===customEmoji ? "var(--accent)" : "rgba(0,0,0,0.04)"}>
                  {em}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div style={{
        flexShrink:0,
        padding:"10px 16px 6px",
        background: theme.isDark
          ? "rgba(37,8,63,0.60)"
          : "rgba(255,255,255,0.30)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍  Buscar artículo..."
          style={{
            width:"100%",
            background: theme.isDark ? "rgba(37,8,63,0.78)" : "rgba(255,255,255,0.82)",
            border: `1.5px solid ${theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.90)"}`,
            borderRadius:99,
            padding:"11px 18px",
            color: theme.isDark ? "#FFFFFF" : "#1A2118",
            fontSize:14, fontWeight:500, outline:"none", boxSizing:"border-box",
            transition:"border-color .15s, box-shadow .15s",
            boxShadow: theme.isDark
              ? "0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.05)"
              : "0 2px 12px rgba(80,60,20,0.08), inset 0 1px 0 rgba(255,255,255,0.90)",
          }}
          onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow=`0 0 0 3px rgba(var(--accent-rgb),0.18), 0 2px 12px rgba(80,60,20,0.08)`; }}
          onBlur={e  => { e.target.style.borderColor=theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.90)"; e.target.style.boxShadow=theme.isDark ? "0 2px 12px rgba(0,0,0,0.25)" : "0 2px 12px rgba(80,60,20,0.08)"; }} />
      </div>

      {/* ── Category chips ── */}
      <div style={{
        flexShrink:0, display:"flex", overflowX:"auto", gap:7,
        padding:"6px 16px 10px",
        scrollbarWidth:"none",
        background: theme.isDark
          ? "rgba(37,8,63,0.55)"
          : "rgba(255,255,255,0.26)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        borderBottom: theme.isDark
          ? "1px solid rgba(255,255,255,0.05)"
          : "1px solid rgba(255,255,255,0.55)",
      }}>
        {["Todos",...CATEGORIES].map(cat => {
          const catEmoji = CAT_ICONS[cat];
          return (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{ borderRadius:99, border:"none", padding:"5px 12px 5px 6px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, display:"flex", alignItems:"center", gap:5,
              background: category===cat ? "var(--accent)" : theme.isDark ? "color-mix(in srgb, white 7%, var(--cardBg))" : theme.tagBg,
              color: category===cat ? "#fff" : theme.isDark ? "#D4B8F0" : theme.tagColor,
              transition:"background .12s, color .12s, transform .1s",
              boxShadow: category===cat ? `0 2px 10px ${theme.pillBorder}` : "none",
            }}
            onMouseEnter={e => { if(category!==cat) e.currentTarget.style.background=theme.isDark ? "color-mix(in srgb, white 12%, var(--cardBg))" : theme.pillBg; }}
            onMouseLeave={e => { if(category!==cat) e.currentTarget.style.background=theme.isDark ? "color-mix(in srgb, white 7%, var(--cardBg))" : theme.tagBg; }}>
            {catEmoji && <span style={{ fontSize:14, lineHeight:1 }}>{catEmoji}</span>}
            {cat}
          </button>
          );
        })}
      </div>

      {/* ── Preset items list ── */}
      <div style={{
        flex:1, minHeight:0, overflowY:"auto", paddingBottom:24,
        padding:"10px 12px 24px",
        display:"flex", flexDirection:"column", gap:6,
        background: "transparent",
      }}>
        {filtered.length===0 ? (
          <div style={{
            fontSize:14, color: theme.isDark ? "#B06BE0" : "#B0A898",
            padding:"32px 20px", textAlign:"center",
            background: theme.isDark ? "rgba(37,8,63,0.65)" : "rgba(255,255,255,0.52)",
            backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
            borderRadius:20,
            border: theme.isDark ? "1px solid rgba(255,255,255,0.07)" : "1px solid rgba(255,255,255,0.75)",
            marginTop:8,
          }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
            No hay más artículos aquí
          </div>
        ) : (
          filtered.map(p => {
            const crp = CR_PRICES[p.name];
            const overridden = priceOverrides[p.name];
            const displayPrice = overridden !== undefined ? overridden : crp;
            const isEditingThisPrice = editingPresetPrice === p.name;

            // Per-theme card tint — blends naturally with the wallpaper instead of clashing
            const cardBg    = theme.isDark ? "rgba(22,30,70,0.64)"   : theme.accentRgb === "212,96,122" ? "rgba(255,248,251,0.68)" : "rgba(253,250,243,0.68)";
            const cardBgHov = theme.isDark ? "rgba(34,46,98,0.76)"   : theme.accentRgb === "212,96,122" ? "rgba(255,252,254,0.85)" : "rgba(255,253,248,0.86)";
            const cardBorder= theme.isDark ? "rgba(255,255,255,0.07)" : theme.accentRgb === "212,96,122" ? "rgba(244,179,196,0.55)" : "rgba(199,228,138,0.55)";
            const iconBg    = theme.isDark ? "rgba(255,255,255,0.06)" : `rgba(var(--accent-rgb),0.09)`;
            const priceBg   = theme.isDark ? "rgba(var(--accent-rgb),0.16)" : `rgba(var(--accent-rgb),0.10)`;

            return (
              <div key={p.name}
                className="preset-item-btn"
                role="button" tabIndex={0}
                onClick={(e) => { if (!e.target.closest("button") && !e.target.closest("input")) addPreset(p,e); }}
                onKeyDown={(e) => { if (e.key==="Enter") addPreset(p,e); }}
                style={{
                  width:"100%", display:"flex", alignItems:"center", gap:12,
                  padding:"10px 12px 10px 10px",
                  background: cardBg,
                  backdropFilter: "blur(14px) saturate(1.5)",
                  WebkitBackdropFilter: "blur(14px) saturate(1.5)",
                  border: `1px solid ${cardBorder}`,
                  borderRadius:18,
                  boxShadow: theme.isDark
                    ? "0 1px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : "0 1px 6px rgba(80,60,20,0.05), inset 0 1px 0 rgba(255,255,255,0.80)",
                  cursor:"pointer", color: theme.isDark ? "#FFFFFF" : theme.textPrimary,
                  textAlign:"left",
                  transition:"background .13s ease, transform .12s cubic-bezier(0.34,1.3,0.64,1), box-shadow .13s ease",
                  boxSizing:"border-box",
                }}
                onMouseEnter={e => { e.currentTarget.style.background=cardBgHov; e.currentTarget.style.boxShadow=theme.isDark?"0 4px 18px rgba(0,0,0,0.30)":"0 4px 16px rgba(80,60,20,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.background=cardBg;    e.currentTarget.style.boxShadow=theme.isDark?"0 1px 8px rgba(0,0,0,0.20)":"0 1px 6px rgba(80,60,20,0.05)"; }}
                onTouchStart={e => { e.currentTarget.style.background=cardBgHov; e.currentTarget.style.transform="scale(0.982)"; }}
                onTouchEnd={e   => { e.currentTarget.style.background=cardBg;    e.currentTarget.style.transform="scale(1)"; }}
              >
                {/* Emoji in a soft themed bubble */}
                <div style={{
                  width:40, height:40, borderRadius:12, flexShrink:0,
                  background: iconBg,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, lineHeight:1,
                  border: `1px solid ${cardBorder}`,
                }}>
                  {ITEM_ICONS[p.name] || CAT_ICONS[p.category] || p.emoji}
                </div>

                {/* Name + category */}
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontSize:14, fontWeight:700, letterSpacing:"-0.01em", color: theme.isDark ? "#FFFFFF" : theme.textPrimary }}>{p.name}</span>
                  <span style={{ fontSize:11, color:"var(--accent)", fontWeight:600, opacity:0.80, letterSpacing:"0.01em" }}>{p.category}</span>
                </div>

                {/* Price badge / editable input */}
                {isEditingThisPrice ? (
                  <input autoFocus type="number" inputMode="decimal" placeholder="0" value={tempPresetPrice}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setTempPresetPrice(e.target.value)}
                    onBlur={() => savePresetPrice(p.name)}
                    onKeyDown={e => e.key==="Enter" && savePresetPrice(p.name)}
                    style={{ width:76, background: theme.isDark ? "#2D0A48" : "#FEFCF9", border:"1.5px solid var(--accent)", borderRadius:10, color:"var(--accentDark)", fontSize:12, fontWeight:800, padding:"4px 8px", textAlign:"right", outline:"none", flexShrink:0 }} />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingPresetPrice(p.name); setTempPresetPrice(overridden !== undefined ? overridden : (crp ? String(crp) : "")); }}
                    style={{
                      fontSize:11, fontWeight:800,
                      color: theme.isDark ? "#D4B8F0" : theme.tagColor,
                      background: priceBg,
                      border: `1px solid ${cardBorder}`,
                      borderRadius:10, padding:"4px 9px",
                      flexShrink:0, cursor:"pointer", fontFamily:"inherit",
                      letterSpacing:"0.01em",
                      transition:"background .12s ease",
                    }}>
                    {displayPrice ? `${sym}${Math.round(displayPrice).toLocaleString()}` : "+ precio"}
                  </button>
                )}

                {/* Add button */}
                <button
                  onClick={(e) => addPreset(p,e)}
                  style={{
                    background:"linear-gradient(135deg,var(--accent),var(--accentDark))",
                    color:"#fff", width:32, height:32,
                    borderRadius:10,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:20, fontWeight:900, flexShrink:0,
                    boxShadow:`0 2px 8px rgba(var(--accent-rgb),0.34)`,
                    border:"none", cursor:"pointer",
                    transition:"transform .14s cubic-bezier(0.34,1.4,0.64,1), box-shadow .14s ease",
                  }}
                  onMouseDown={e  => { e.currentTarget.style.transform="scale(0.88)"; e.currentTarget.style.boxShadow=`0 1px 4px rgba(var(--accent-rgb),0.20)`; }}
                  onMouseUp={e    => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow=`0 2px 8px rgba(var(--accent-rgb),0.34)`; }}
                  onTouchStart={e => { e.currentTarget.style.transform="scale(0.88)"; e.currentTarget.style.boxShadow=`0 1px 4px rgba(var(--accent-rgb),0.20)`; }}
                  onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)";    e.currentTarget.style.boxShadow=`0 2px 8px rgba(var(--accent-rgb),0.34)`; }}
                >+</button>
              </div>
            );
          })
        )}
      </div>
      </div>
    </>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
const LS = { get:(k,d) => { try { const s=localStorage.getItem(k); return s?JSON.parse(s):d; } catch { return d; } }, set:(k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} } };

// ─────────────────────────────────────────────────────────────────────────────
// StatsView — SuperLista  (drop-in replacement)
// Requiere: React (useState, useMemo), CAT_COLORS definido en el mismo archivo
// Props: history, budget, sym
// ─────────────────────────────────────────────────────────────────────────────

// ── Helpers locales ───────────────────────────────────────────────────────────
// Guards against historical sessions where .total is missing, undefined, or a
// string — without this, reduce/map over s.total can silently produce NaN.
const safeTotal = (s) => parseFloat(s?.total) || 0;
const fmtAmt = (n, sym) =>
  n >= 1000 ? `${sym}${formatK(n)}` : `${sym}${Math.round(n).toLocaleString()}`;
const fmtDate = (d) =>
  new Date(d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
const fmtShortDate = (d) =>
  new Date(d).toLocaleDateString("es-CR", { day: "numeric", month: "short" });

// ── Donut SVG ─────────────────────────────────────────────────────────────────
function DonutChart({ slices, size = 120, stroke = 22 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2, cy = size / 2;
  let acc = 0;
  const total = slices.reduce((s, x) => s + x.value, 0);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", flexShrink: 0 }}>
      {/* track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="color-mix(in srgb, var(--accent) 14%, var(--cardBg))" strokeWidth={stroke} />
      {slices.map((sl, i) => {
        const pct = sl.value / total;
        const dash = pct * circ;
        const gap  = circ - dash;
        const off  = -acc * circ;
        acc += pct;
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={sl.color} strokeWidth={stroke}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={off}
            strokeLinecap="butt"
            style={{ transition: "stroke-dasharray .6s ease, stroke-dashoffset .6s ease" }}
          />
        );
      })}
    </svg>
  );
}

// ── BarChart proporcional con fechas ──────────────────────────────────────────
function BarChart({ sessions, sym, maxBars = 10 }) {
  const bars = sessions.slice(-maxBars);
  const maxVal = Math.max(...bars.map((s) => safeTotal(s)), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80, paddingBottom: 20, position: "relative" }}>
      {bars.map((s, i) => {
        const pct = (safeTotal(s) / maxVal) * 100;
        const isLast = i === bars.length - 1;
        return (
          <div key={s.date + i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
            <div
              title={`${fmtShortDate(s.date)}: ${fmtAmt(safeTotal(s), sym)}`}
              style={{
                width: "100%",
                height: `${pct}%`,
                minHeight: 4,
                borderRadius: "4px 4px 0 0",
                background: isLast
                  ? "linear-gradient(180deg,var(--accent),var(--accentDark))"
                  : "linear-gradient(180deg,rgba(var(--accent-rgb),0.20),rgba(var(--accent-rgb),0.10))",
                border: isLast ? "none" : "1px solid rgba(var(--accent-rgb),0.14)",
                transition: "height .5s cubic-bezier(.4,0,.2,1)",
                cursor: "default",
                boxShadow: isLast ? "0 4px 12px rgba(var(--accent-rgb),.28)" : "none",
              }}
            />
            <span style={{
              position: "absolute", bottom: 0,
              fontSize: 9, color: isLast ? "var(--accent)" : "#888",
              fontWeight: isLast ? 700 : 400,
              whiteSpace: "nowrap",
              letterSpacing: "-.3px",
            }}>
              {fmtShortDate(s.date)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Insight automático ────────────────────────────────────────────────────────
function genInsight({ sessions, budgetNum, sym, period }) {
  if (!sessions.length) return null;
  const totals = sessions.map((s) => safeTotal(s));
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const last = totals[totals.length - 1];
  // Net change across the last 3 sessions. The reducer telescopes:
  // i=1: 0 + (b1-b0) = b1-b0 ; i=2: (b1-b0) + (b2-b1) = b2-b0
  // → result is simply last3[2] - last3[0]. Verified correct, not a bug.
  const trend = totals.length >= 3
    ? totals.slice(-3).reduce((a, b, i, arr) => i === 0 ? 0 : a + (b - arr[i - 1]), 0)
    : 0;

  // artículo más frecuente
  const freq = {};
  sessions.forEach((s) =>
    (s.items || []).forEach((it) => {
      freq[it.name] = (freq[it.name] || 0) + (it.qty || 1);
    })
  );
  const topItem = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];

  const daySpread = sessions.length >= 2
    ? Math.round((new Date(sessions[sessions.length - 1].date) - new Date(sessions[0].date)) / 86400000)
    : 0;
  const freq_per_week = daySpread > 0 ? (sessions.length / (daySpread / 7)).toFixed(1) : null;

  if (budgetNum > 0 && sessions.length > 0) {
    const total = totals.reduce((a, b) => a + b, 0);
    // budgetNum is a per-session (per shopping trip) budget, not a weekly amount —
    // so the cap for this period is "what you'd have spent if every trip you actually
    // took stayed within budget", i.e. budget × number of sessions in the period.
    const cap = budgetNum * sessions.length;
    if (total > cap * 0.9)
      return { icon: "🔥", text: `Cerca del tope: llevás ${fmtAmt(total, sym)} de ${fmtAmt(cap, sym)} en el período.`, color: "#f87171" };
  }
  if (trend > avg * 0.15)
    return { icon: "📈", text: `Tus últimas 3 compras muestran un alza. Considerá revisar el presupuesto.`, color: "#fb923c" };
  if (trend < -avg * 0.15)
    return { icon: "📉", text: `Tus últimas 3 compras están bajando. ¡Buen control del gasto!`, color: "var(--accent)" };
  if (topItem && topItem[1] >= 3)
    return { icon: "🔁", text: `"${topItem[0]}" aparece ${topItem[1]}× en este período — tu ítem más recurrente.`, color: "#D4B8F0" };
  if (freq_per_week && parseFloat(freq_per_week) >= 2)
    return { icon: "🛒", text: `Comprás unas ${freq_per_week}× por semana. Agrupar visitas puede ahorrarte tiempo y plata.`, color: "#fcd34d" };
  if (last > avg * 1.3)
    return { icon: "💸", text: `Última compra fue un ${Math.round(((last - avg) / avg) * 100)}% más cara que tu promedio.`, color: "#fb923c" };
  return { icon: "✅", text: `Gasto estable. Ticket promedio: ${fmtAmt(avg, sym)}.`, color: "#4ADE80" };
}

// ── WeekComparison ────────────────────────────────────────────────────────────
function WeekComparison({ history, sym }) {
  const now = new Date();
  const startOfWeek = (offset = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() - offset * 7);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const w0start = startOfWeek(0);
  const w1start = startOfWeek(1);
  const w2start = startOfWeek(2);

  const weekTotal = (from, to) =>
    history
      .filter((s) => { const d = new Date(s.date); return d >= from && d < to; })
      .reduce((a, s) => a + safeTotal(s), 0);

  const thisW = weekTotal(w0start, new Date(w0start.getTime() + 7 * 86400000));
  const lastW = weekTotal(w1start, w0start);
  const prevW = weekTotal(w2start, w1start);
  const maxW = Math.max(thisW, lastW, prevW, 1);

  const bars = [
    { label: "Hace 2 sem", val: prevW, color: "color-mix(in srgb, var(--accent) 12%, var(--cardBg))" },
    { label: "Sem pasada", val: lastW, color: "color-mix(in srgb, var(--accent) 22%, var(--cardBg))" },
    { label: "Esta sem", val: thisW, color: "var(--accent)" },
  ];

  const delta = lastW > 0 ? (((thisW - lastW) / lastW) * 100).toFixed(0) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 60, marginBottom: 8 }}>
        {bars.map((b, i) => {
          const h = Math.max(4, (b.val / maxW) * 60);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: i === 2 ? "var(--accent)" : "#888", fontWeight: i === 2 ? 700 : 400 }}>
                {b.val > 0 ? fmtAmt(b.val, sym) : "—"}
              </span>
              <div style={{
                width: "100%", height: h, borderRadius: "4px 4px 0 0",
                background: i === 2 ? "linear-gradient(180deg,var(--accent),var(--accentDark))" : b.color,
                transition: "height .5s ease",
              }} />
              <span style={{ fontSize: 9, color: i === 2 ? "#22C55E" : "#444", textAlign: "center", lineHeight: 1.2 }}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
      {delta !== null && (
        <div style={{ fontSize: 11, color: parseFloat(delta) > 0 ? "#EF4444" : "var(--accent)", fontWeight: 700, textAlign: "center" }}>
          {parseFloat(delta) > 0 ? `▲ ${delta}% vs sem. pasada` : `▼ ${Math.abs(parseFloat(delta))}% vs sem. pasada`}
        </div>
      )}
    </div>
  );
}

// ── StreakBadge ───────────────────────────────────────────────────────────────
function StreakBadge({ history }) {
  // Streak = semanas consecutivas con al menos 1 compra
  const getWeekKey = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    date.setDate(date.getDate() - day);
    return `${date.getFullYear()}-W${Math.floor(date.getDate() / 7)}`;
  };
  const weeks = new Set(history.map((s) => getWeekKey(s.date)));
  // count consecutive weeks back from now
  let streak = 0;
  const now = new Date();
  for (let i = 0; i < 52; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    if (weeks.has(getWeekKey(d.toISOString()))) streak++;
    else if (i > 0) break;
  }

  const color = streak >= 8 ? "#f59e0b" : streak >= 4 ? "#a78bfa" : streak >= 2 ? "#22C55E" : "#555";
  const emoji = streak >= 8 ? "🔥" : streak >= 4 ? "⚡" : streak >= 2 ? "✅" : "💤";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: `${color}22`,
        border: `2px solid ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 24, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>
          {streak} <span style={{ fontSize: 13, fontWeight: 600, color: "var(--textMuted)" }}>sem</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--textMuted)", marginTop: 2 }}>
          {streak === 0 ? "Sin compras recientes" : streak === 1 ? "Racha iniciada" : `Racha activa`}
        </div>
      </div>
    </div>
  );
}

// ── MostExpensive ─────────────────────────────────────────────────────────────
function MostExpensiveItem({ sessions, sym }) {
  let best = null;
  sessions.forEach((s) =>
    (s.items || []).forEach((it) => {
      const cost = (parseFloat(it.price) || 0) * (it.qty || 1);
      if (!best || cost > best.cost) best = { name: it.name, cost, emoji: it.emoji || "🛒", date: s.date };
    })
  );
  if (!best) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 28 }}>{best.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--textPrimary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {best.name}
        </div>
        <div style={{ fontSize: 11, color: "var(--textMuted)" }}>{fmtShortDate(best.date)}</div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#fb923c", flexShrink: 0 }}>
        {fmtAmt(best.cost, sym)}
      </div>
    </div>
  );
}

// ── MAIN StatsView ─────────────────────────────────────────────────────────────
function StatsView({ history, budget, sym }) {
  const [period, setPeriod] = useState("month"); // "month" | "q3" | "all"
  const budgetNum = parseFloat(budget) || 0;
  const now = new Date();

  // ── Filter sessions by period ──
  const sessions = useMemo(() => {
    if (period === "all") return history;
    const cutoff = new Date();
    if (period === "month") cutoff.setDate(1), cutoff.setHours(0, 0, 0, 0);
    if (period === "q3") { cutoff.setMonth(cutoff.getMonth() - 3); cutoff.setHours(0, 0, 0, 0); }
    return history.filter((s) => new Date(s.date) >= cutoff);
  }, [history, period]);

  // ── Derived metrics ──
  const total = useMemo(() => sessions.reduce((a, s) => a + safeTotal(s), 0), [sessions]);
  const avgTicket = sessions.length > 0 ? total / sessions.length : 0;

  // prev-period delta (solo para "month")
  const prevTotal = useMemo(() => {
    if (period !== "month") return null;
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pmEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    return history
      .filter((s) => { const d = new Date(s.date); return d >= pm && d < pmEnd; })
      .reduce((a, s) => a + safeTotal(s), 0);
  }, [history, period]);

  const delta = prevTotal != null && prevTotal > 0
    ? (((total - prevTotal) / prevTotal) * 100).toFixed(0)
    : null;

  // category totals
  const catTotals = useMemo(() => {
    const map = {};
    sessions.forEach((s) =>
      (s.items || []).forEach((it) => {
        const cat = it.category || "Otros";
        map[cat] = (map[cat] || 0) + (parseFloat(it.price) || 0) * (it.qty || 1);
      })
    );
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  // donut slices
  const donutSlices = catTotals.slice(0, 6).map(([cat, val]) => ({
    label: cat,
    value: val,
    color: CAT_COLORS[cat] || "#aaa",
  }));

  const insight = useMemo(() => genInsight({ sessions, budgetNum, sym, period }), [sessions, budgetNum, sym, period]);

  // Budget % — budgetNum is a per-session (per shopping trip) budget, so the cap
  // for a period is budget × number of trips actually taken in that period, not
  // a weeks-in-month/quarter multiplier (that wrongly treated it as a weekly amount).
  const budgetCap = (period === "month" || period === "q3") && sessions.length > 0
    ? budgetNum * sessions.length
    : null;
  const budgetPct = budgetCap && budgetCap > 0 ? Math.min((total / budgetCap) * 100, 100) : 0;

  // ── Empty state ──
  if (history.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "80px 20px" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--textPrimary)", marginBottom: 8 }}>Sin datos aún</div>
        <div style={{ fontSize: 13, color: "var(--textMuted)", lineHeight: 1.7 }}>
          Completá una compra marcando artículos<br />y tocando "Cerrar compra".
        </div>
      </div>
    );
  }

  // ── UI ──
  const cardStyle = {
    background: "var(--cardBg)",
    border: "1px solid var(--cardBorder)",
    borderRadius: 18,
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)", };
  const labelStyle = {
    fontSize: 10,
    color: "var(--textMuted)",
    fontWeight: 700,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  };

  const periodLabels = { month: "Este mes", q3: "Últimos 3 meses", all: "Todo el tiempo" };

  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Stats page header — vive dentro de StatsView (igual que el hero banner vive
          dentro de ListsView) para que ambas pantallas tengan la misma estructura
          al deslizar entre ellas. Mismo aspecto visual de siempre, solo reubicado. */}
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        padding:"16px 16px 12px",
        background:"var(--headerBg)", borderBottom:"1px solid var(--cardBorder)",
        boxShadow:"0 2px 16px rgba(0,0,0,0.05)",
        flexShrink:0,
      }}>
        <div style={{ width:40, height:40, borderRadius:14, background:"var(--soft)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:22, lineHeight:1 }}>📊</span>
        </div>
        <div>
          <div style={{ fontSize:17, fontWeight:800, color:"var(--textPrimary)", letterSpacing:"-0.01em" }}>Estadísticas</div>
          <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:1 }}>Tus hábitos de compra</div>
        </div>
      </div>

      {/* ── Área con scroll propio — igual patrón que el cuerpo de ListsView ── */}
      <div style={{ flex:1, minHeight:0, overflowY:"auto", padding:"0 0 calc(var(--bottombar-h, 64px) + 16px)" }}>

      {/* ── Period tabs ── */}
      <div style={{
        display: "flex", gap: 0, background: "var(--headerBg)", borderBottom: "1px solid var(--cardBorder)",
        position: "sticky", top: 0, zIndex: 5,
      }}>
        {[["month", "Este mes"], ["q3", "3 meses"], ["all", "Todo"]].map(([id, label]) => {
          const on = period === id;
          return (
            <button key={id} onClick={() => setPeriod(id)} style={{
              flex: 1, background: "none", border: "none",
              color: on ? "var(--accent)" : "var(--textMuted)", fontWeight: on ? 800 : 500,
              fontSize: 13, padding: "13px 4px", cursor: "pointer",
              position: "relative", transition: "color .15s ease",
              fontFamily: "inherit",
            }}>
              {label}
              {on && (
                <span style={{
                  position: "absolute", bottom: 0, left: "20%", right: "20%",
                  height: 2.5, background: "var(--accent)", borderRadius: 2, display: "block",
                  animation: "underlineIn .22s ease",
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── KPI hero row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...cardStyle, gridColumn: "1 / -1", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, var(--cardBg)), color-mix(in srgb, var(--accent) 5%, var(--cardBg)))", border: "1.5px solid color-mix(in srgb, var(--accent) 22%, var(--cardBorder))" }}>
            <div style={labelStyle}>Gastado · {periodLabels[period]}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "var(--accent)", lineHeight: 1, letterSpacing: -1 }}>
              {fmtAmt(total, sym)}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--textMuted)" }}>
                {sessions.length} compra{sessions.length !== 1 ? "s" : ""}
              </span>
              {avgTicket > 0 && (
                <span style={{ fontSize: 12, color: "var(--textMuted)" }}>
                  Ticket prom. <span style={{ color: "var(--accent)", fontWeight: 700 }}>{fmtAmt(avgTicket, sym)}</span>
                </span>
              )}
              {delta !== null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(delta) > 0 ? "#EF4444" : "var(--accent)" }}>
                  {parseFloat(delta) > 0 ? `▲ ${delta}%` : `▼ ${Math.abs(parseFloat(delta))}%`} vs mes ant.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Budget bar (if set) ── */}
        {budgetCap > 0 && (
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={labelStyle}>Presupuesto</div>
              <span style={{
                fontSize: 13, fontWeight: 800,
                color: budgetPct >= 100 ? "#f87171" : budgetPct >= 80 ? "#fb923c" : "#22C55E",
              }}>
                {Math.round(budgetPct)}%
              </span>
            </div>
            <div style={{ height: 6, background: "color-mix(in srgb, var(--accent) 12%, var(--cardBg))", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${budgetPct}%`,
                background: budgetPct >= 100 ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : budgetPct >= 80 ? "linear-gradient(90deg,#f59e0b,#d97706)"
                  : "linear-gradient(90deg,var(--accent),var(--accentDark))",
                transition: "width .6s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "var(--textMuted)" }}>
                {total < budgetCap
                  ? `${fmtAmt(budgetCap - total, sym)} disponible`
                  : `${fmtAmt(total - budgetCap, sym)} excedido`}
              </span>
              <span style={{ fontSize: 10, color: "var(--textMuted)" }}>de {fmtAmt(budgetCap, sym)}</span>
            </div>
          </div>
        )}

        {/* ── Bar chart con fechas ── */}
        {sessions.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Historial de compras</div>
            <BarChart sessions={sessions} sym={sym} maxBars={12} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "var(--textMuted)" }}>
                {sessions.length > 0 ? fmtShortDate(sessions[0].date) : ""}
              </span>
              <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>
                {sessions.length > 0 ? fmtShortDate(sessions[sessions.length - 1].date) : ""}
              </span>
            </div>
          </div>
        )}

        {/* ── Donut categorías ── */}
        {donutSlices.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Gasto por categoría</div>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <DonutChart slices={donutSlices} size={110} stroke={20} />
                <div style={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexDirection: "column",
                }}>
                  <span style={{ fontSize: 10, color: "var(--textMuted)", fontWeight: 700, letterSpacing: 0.5 }}>
                    TOP
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 900, color: donutSlices[0]?.color || "#fff" }}>
                    {donutSlices[0]?.label?.split(" ")[0] || ""}
                  </span>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {donutSlices.map((sl) => {
                  const pct = ((sl.value / total) * 100).toFixed(0);
                  return (
                    <div key={sl.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: 2,
                        background: sl.color, flexShrink: 0,
                      }} />
                      <span style={{ flex: 1, fontSize: 11, color: "var(--textMuted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {sl.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: sl.color, flexShrink: 0 }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Streak + Artículo más caro ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={cardStyle}>
            <div style={labelStyle}>Racha semanal</div>
            <StreakBadge history={history} />
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>Ítem más caro</div>
            <MostExpensiveItem sessions={sessions} sym={sym} />
          </div>
        </div>

        {/* ── Comparativo semanal ── */}
        <div style={cardStyle}>
          <div style={labelStyle}>Comparativo semanal</div>
          <WeekComparison history={history} sym={sym} />
        </div>

        {/* ── Insight automático ── */}
        {insight && (
          <div style={{
            ...cardStyle,
            background: `${insight.color}0d`,
            border: `1px solid ${insight.color}30`,
          }}>
            <div style={labelStyle}>Insight</div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: 24, lineHeight: 1.2, flexShrink: 0 }}>{insight.icon}</span>
              <p style={{ fontSize: 13, color: "var(--textPrimary)", lineHeight: 1.6, margin: 0 }}>
                {insight.text}
              </p>
            </div>
          </div>
        )}

        {/* ── Historial lista ── */}
        {sessions.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Registro de compras</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 6 }}>
              {[...sessions].reverse().slice(0, 12).map((s, i, arr) => (
                <div key={s.date + i} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid var(--border)` : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--textPrimary)" }}>
                      {s.listName || "Compra"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--textMuted)", marginTop: 1 }}>
                      {fmtDate(s.date)} · {s.itemCount || (s.items?.length) || 0} art.
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 900, color: "var(--accent)",
                    background: "color-mix(in srgb, var(--accent) 10%, var(--cardBg))", borderRadius: 8,
                    padding: "2px 8px",
                  }}>
                    {fmtAmt(safeTotal(s), sym)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}


// ── Theme tokens ──────────────────────────────────────────────────────────────
// Green: Pistachio palette  |  Pink: Blush/petal palette  |  Moon: Saprissa purple palette
const THEMES = {
  green: {
    // Pistachio cream palette
    checkerBg:   "#F5EFE4",          // Almond Beige — warm paper base
    checker:     "#C7E48A",          // Young Pistachio — gingham tile
    accent:      "#5EAB2F",          // Pistachio Green — primary action
    accentDark:  "#6D8F3A",          // Olive Pistachio — deep accent
    accentLight: "#A7D45A",          // Spring Pistachio — hover/highlight
    soft:        "#EDF7D8",          // Very light pistachio wash
    border:      "#C7E48A",          // Young Pistachio border
    surface:     "#F8F3E9", // Almond Beige surface
    cardBg:      "#FDFAF3",
    cardBorder:  "#CFE8A8",
    tagBg:       "#E3F0D3",
    tagColor:    "#3D6B1E",
    pillBg:      "#E3EFC4",
    pillBorder:  "#A9CB6E",
    ginghamTile: "#BEDD79", // gingham band color
    ginghamBg:   "#F5EFE4",
    daisyColor:  "white",
    dashColor:   "#EDE7D8",
    textPrimary: "#2C2010",
    textMuted:   "#6B5A3A",
    headerBg:    "#F6F1E6",
    navBg:       "#F5EFE3",
    sheetBg:     "#FAF6EE",
    label:       "🌿",
    isDark:      false,
    // Colors for inline styles that can't use CSS vars
    accentRgb:   "94,171,47",
  },
  pink: {
    // Blush / petal palette
    checkerBg:   "#FFF5F7",          // Marshmallow White
    checker:     "#F5B8C8",          // Ballet Slipper Pink — gingham tile
    accent:      "#D4607A",          // Sakura Pink — primary action
    accentDark:  "#B03060",          // deeper rose
    accentLight: "#F0A0B8",          // Petal Pink highlight
    soft:        "#FDEEF3",          // Cotton Candy wash
    border:      "#F0B8CA",          // Baby Pink border
    surface:     "#FFF6F8",
    cardBg:      "#FFFAFC",
    cardBorder:  "#F6D3DE",
    tagBg:       "#F8E3E8",
    tagColor:    "#8A2040",
    pillBg:      "#F8DCE5",
    pillBorder:  "#E4A2B5",
    ginghamTile: "#F0A0B8", // Blush Pink band
    ginghamBg:   "#FFF5F7",
    daisyColor:  "white",
    dashColor:   "#FCE9EE",
    textPrimary: "#2A1520",
    textMuted:   "#7A4558",
    headerBg:    "#FFF5F7",
    navBg:       "#FFF4F6",
    sheetBg:     "#FFF8FB",
    label:       "🌸",
    isDark:      false,
    accentRgb:   "212,96,122",
  },
  moon: {
    // ── Saprissa palette ──────────────────────────────────────────────
    // Morado domina todo. Blanco puro + negro profundo como únicos apoyos.
    checkerBg:   "#25083F",          // Morado Profundo — base absoluta
    checker:     "#3D1465",          // Morado Oscuro — tile de patrón
    accent:      "#8B3FC8",          // Morado Saprissa — acción principal
    accentDark:  "#5B1A8E",          // Morado Principal — acento profundo
    accentLight: "#B06BE0",          // Morado Claro — hover / highlight
    soft:        "#2D0E50",          // Superficie morada oscura
    border:      "#5B1A8E",          // Borde morado principal
    surface:     "#3D1465",
    cardBg:      "#2D0A48",
    cardBorder:  "#5B1A8E",
    tagBg:       "#3D1465",
    tagColor:    "#F0E6FF",          // Lavanda muy claro — texto sobre morado
    pillBg:      "#3D1465",
    pillBorder:  "#8B3FC8",
    ginghamTile: "#3D1465",
    ginghamBg:   "#25083F",
    daisyColor:  "%23E8D5FF",        // Lavanda (URL encoded) — pétalo sobre fondo oscuro
    dashColor:   "#3D1465",
    textPrimary: "#FFFFFF",          // Blanco puro — máximo contraste
    textMuted:   "#D4B8F0",          // Lavanda suave — texto secundario
    headerBg:    "#111111",          // Negro profundo — cabecera
    navBg:       "#111111",          // Negro profundo — nav inferior
    sheetBg:     "#1A0030",          // Morado casi negro — sheets
    label:       "⚽",
    isDark:      true,
    accentRgb:   "139,63,200",
  },
};

// ── Static CSS — injected into <head> once, never re-diffed by React ────────
const SUPERLISTA_STATIC_CSS = `
/* ── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
input, select, button { font-family: inherit; }
::-webkit-scrollbar { width: 0; }

/* ── Design tokens ─────────────────────────────────────────────────── */
:root {
  --font-hand:  'Outfit', 'Segoe UI', sans-serif;
  --font-body:  'Outfit', 'Segoe UI', sans-serif;
  --font-serif: 'Outfit', 'Segoe UI', sans-serif;
  --radius-sm:  8px;
  --radius-md:  14px;
  --radius-lg:  20px;
  --radius-xl:  26px;
  --ease-spring: cubic-bezier(0.34,1.4,0.64,1);
  --ease-out:    cubic-bezier(0.22,1,0.36,1);
  /* Set dynamically below */
  --accent:      #5EAB2F;
  --accentDark:  #6D8F3A;
  --accentLight: #A7D45A;
  --soft:        #EDF7D8;
  --border:      #C7E48A;
  --cardBg:      #FDFAF3;
  --cardBorder:  #CFE8A8;
  --textPrimary: #2C2010;
  --textMuted:   #6B5A3A;
  --navBg:       #F5EFE3;
  --headerBg:    #F6F1E6;
  --sheetBg:     #FAF6EE;
  --pillBg:      #E3EFC4;
  --pillBorder:  #A9CB6E;
  --tagBg:       #E3F0D3;
  --tagColor:    #3D6B1E;
  --accent-rgb:  94,171,47;
}

/* ══════════════════════════════════════════════════════════════════════
   GINGHAM BACKGROUNDS — wallpaper image per theme, set via CSS variable
   so it changes instantly on theme switch. data-theme is set on <html>,
   so :root vars cascade down to body.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Background token defaults: 🌿 Pistachio ───────────────────────── */
:root {
  --bg-base:       #F1E6D5;  /* Almond Beige */
  --bg-wallpaper:  url("${bgGreen}");
  --bg-band:       rgba(167,212,90,0.38);   /* Young Pistachio gingham */
  --bg-seam:       rgba(255,255,255,0.65);  /* white stitched seam */
  --bg-bloom1:     rgba(241,230,213,0.75);  /* Warm Ivory top-right */
  --bg-bloom2:     rgba(221,177,142,0.25);  /* Sandstone Peach bottom-left */
  --bg-bloom1-pos: 68% 6%;
  --bg-bloom2-pos: 8% 94%;
  /* daisy SVG — pistachio: white petals, Honey Gold center */
  --bg-daisy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cg transform='translate(40,40) rotate(22)'%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(0)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(40)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(80)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(120)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(160)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(200)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(240)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(280)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFEF5' opacity='0.95' transform='rotate(320)'/%3E%3Ccircle cx='0' cy='0' r='7' fill='%23D99B42'/%3E%3Ccircle cx='0' cy='0' r='4' fill='%23B67856' opacity='0.5'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── Background token overrides: 🌸 Sakura ─────────────────────────── */
[data-theme="pink"] {
  --bg-base:       #FFF5F7;  /* Marshmallow White */
  --bg-wallpaper:  url("${bgPink}");
  --bg-band:       rgba(240,160,184,0.38);  /* Ballet Slipper Pink gingham */
  --bg-seam:       rgba(255,255,255,0.72);  /* white stitched seam */
  --bg-bloom1:     rgba(255,240,248,0.80);  /* Powder Pink top-right */
  --bg-bloom2:     rgba(255,220,235,0.40);  /* Cotton Candy bottom-left */
  --bg-bloom1-pos: 72% 4%;
  --bg-bloom2-pos: 5% 96%;
  /* daisy SVG — sakura: white petals, Rosewater center */
  --bg-daisy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cg transform='translate(40,40) rotate(-14)'%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(0)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(40)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(80)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(120)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(160)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(200)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(240)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(280)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(320)'/%3E%3Ccircle cx='0' cy='0' r='7' fill='%23F0A0B8'/%3E%3Ccircle cx='0' cy='0' r='4' fill='%23D4607A' opacity='0.50'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── Background token overrides: ⚽ Saprissa ────────────────────────── */
[data-theme="moon"] {
  --bg-base:       #25083F;  /* Morado Profundo — base Saprissa */
  --bg-wallpaper:  url("${bgPurple}");
  --bg-band:       rgba(91,26,142,0.35);    /* Morado Principal gingham */
  --bg-seam:       rgba(255,255,255,0.08);  /* Seam blanco muy sutil */
  --bg-bloom1:     rgba(37,8,63,0.92);      /* Morado profundo arriba */
  --bg-bloom2:     rgba(139,63,200,0.12);   /* Glow morado abajo */
  --bg-bloom1-pos: 75% 5%;
  --bg-bloom2-pos: 12% 92%;
  /* Geometric SVG — Saprissa: rectángulos morados, no daisies */
  --bg-daisy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Crect x='32' y='32' width='16' height='16' fill='%238B3FC8' opacity='0.18' rx='2'/%3E%3Crect x='28' y='28' width='24' height='24' fill='none' stroke='%235B1A8E' stroke-width='1.5' opacity='0.25' rx='3'/%3E%3C/svg%3E");
}

/* ── SINGLE body rule — reads vars, works for ALL three themes ──────── */
body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  color: var(--textPrimary);
  height: 100%;
  overflow: hidden;
  background-color: var(--bg-base);
  background-image: var(--bg-wallpaper);
  background-size: cover;
  background-position: top center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  transition: background-color 0.55s ease, background-image 0.55s ease;
}

/* Saprissa — overlay morado profundo sobre el wallpaper para
   mantener el texto blanco legible y reforzar la identidad cromática. */
[data-theme="moon"] body {
  color: #FFFFFF;
  background-image:
    linear-gradient(rgba(17,0,34,0.82), rgba(37,8,63,0.88)),
    var(--bg-wallpaper);
}

/* ══════════════════════════════════════════════════════════════════════
   SURFACE COMPONENTS — theme-aware cards, inputs, buttons
   ══════════════════════════════════════════════════════════════════════ */

/* ── Cards ─────────────────────────────────────────────────────────── */
.wc-card, .list-card {
  background: var(--cardBg);
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--cardBorder);
  box-shadow:
    0 2px 16px rgba(0,0,0,0.06),
    0 1px 3px  rgba(0,0,0,0.04);
  position:relative; overflow:hidden;
  transition: transform 0.22s var(--ease-spring), box-shadow 0.22s var(--ease-out);
}

.wc-card::before, .list-card::before {
  content:'';
  position:absolute; top:0; left:0; right:0; height:2.5px;
  background: linear-gradient(90deg, var(--accent), transparent 80%);
  opacity:0.55; border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.list-card { margin:8px 16px; padding:16px 18px; animation: cardIn 0.38s var(--ease-spring) both; }
.list-card:active { transform:scale(0.975); box-shadow:0 1px 8px rgba(0,0,0,0.05); }

/* ── Saprissa card overrides */
[data-theme="moon"] .wc-card,
[data-theme="moon"] .list-card {
  background: var(--cardBg);
  border-color: var(--cardBorder);
  box-shadow:
    0 4px 28px rgba(91,26,142,0.40),
    0 1px 4px  rgba(0,0,0,0.40);
}

/* ── Item rows ─────────────────────────────────────────────────────── */
.wc-item-row {
  border-radius: var(--radius-md);
  padding: 10px 12px; margin: 4px 0;
  background: #FDFBF8;
  border: 1px solid #EFEAE0;
  transition: background 0.15s ease, transform 0.12s ease;
  animation: itemIn 0.28s var(--ease-spring) both;
}

.wc-item-row:active { transform:scale(0.997); }

[data-theme="moon"] .wc-item-row {
  background: #2D0A48;
  border-color: #5B1A8E;
}

/* ── Buttons ────────────────────────────────────────────────────────── */
.wc-btn-primary {
  font-family:var(--font-body); font-weight:800; font-size:15px;
  border:none; border-radius:var(--radius-md); padding:13px 20px;
  cursor:pointer;
  background: linear-gradient(145deg, var(--accent), var(--accentDark));
  color:white;
  box-shadow:
    0 5px 18px rgba(var(--accent-rgb),0.32);
  transition: transform 0.16s var(--ease-spring), box-shadow 0.16s ease;
  position:relative; overflow:hidden;
}
.wc-btn-primary:active { transform:scale(0.94); }

.wc-btn-ghost {
  font-family:var(--font-body); font-weight:600; font-size:14px;
  border: 1.5px solid var(--border); border-radius:var(--radius-md);
  padding:11px 18px; cursor:pointer;
  background:var(--wc-paper, #FCFAF6); color:var(--textMuted);
  transition: all 0.15s ease;
}
.wc-btn-ghost:active { background:#FFFFFF; transform:scale(0.97); }

[data-theme="moon"] .wc-btn-ghost {
  background: #3D1465;
  border-color: #8B3FC8;
  color: #D4B8F0;
}

/* ── Inputs ─────────────────────────────────────────────────────────── */
.wc-input {
  font-family:var(--font-body); font-size:15px; width:100%;
  padding:12px 14px; border-radius:var(--radius-md);
  border: 1.5px solid var(--border);
  background: #FCFAF6; color:var(--textPrimary);
  outline:none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.04);
}
.wc-input:focus {
  border-color: var(--accent);
  background: #FFFFFF;
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb),0.14), inset 0 1px 3px rgba(0,0,0,0.03);
}
.wc-input::placeholder { color:var(--textMuted); font-style:italic; opacity:0.7; }

[data-theme="moon"] .wc-input {
  background: #3D1465; border-color: #8B3FC8; color:#FFFFFF;
}
[data-theme="moon"] .wc-input:focus { background:#4A1A78; }
[data-theme="moon"] .wc-input::placeholder { color:#8B3FC8; }

/* ── Header / Nav bars ─────────────────────────────────────────────── */
.wc-header {
  display:flex; align-items:center;
  padding:14px 16px 12px;
  background: var(--headerBg);
  border-bottom:1px solid var(--cardBorder);
  box-shadow: 0 2px 16px rgba(0,0,0,0.05);
  position:sticky; top:0; z-index:10; gap:10px;
}

.wc-bottom-nav {
  position:fixed; bottom:0; left:50%; transform:translateX(-50%);
  width:430px; max-width:100%;
  background:var(--navBg);
  border-top:1.5px solid var(--cardBorder);
  box-shadow: 0 -4px 28px rgba(0,0,0,0.08);
  display:flex; align-items:center;
  padding-bottom:env(safe-area-inset-bottom,8px); padding-top:8px; z-index:20;
}

[data-theme="moon"] .wc-header,
[data-theme="moon"] .wc-bottom-nav { border-color:#5B1A8E; }

/* ── Bottom Sheet / Modal ─────────────────────────────────────────── */
.wc-sheet {
  background:var(--sheetBg);
  border-radius:28px 28px 0 0;
  border:1px solid #EFE6D6; border-bottom:none;
  box-shadow: 0 -10px 48px rgba(0,0,0,0.12);
}

[data-theme="moon"] .wc-sheet {
  background:#1A0030;
  border-color:#5B1A8E;
  box-shadow:0 -10px 48px rgba(0,0,0,0.60);
}

/* ── Chips / Tags ──────────────────────────────────────────────────── */
.wc-chip {
  display:inline-flex; align-items:center; gap:5px;
  padding:5px 12px; border-radius:20px;
  font-size:12px; font-weight:700; cursor:pointer;
  border:1.5px solid transparent;
  transition: all 0.18s var(--ease-spring); font-family:var(--font-body);
  letter-spacing:0.01em;
  animation: chipIn 0.28s var(--ease-spring) both;
}
.wc-chip.active {
  box-shadow:0 2px 10px rgba(var(--accent-rgb),0.25);
}

.wc-badge {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:20px; height:20px; border-radius:10px; padding:0 6px;
  font-size:11px; font-weight:900; font-family:var(--font-body);
  background:var(--accent); color:white;
  box-shadow:0 2px 8px rgba(var(--accent-rgb),0.35);
  animation: badgePop 0.32s var(--ease-spring) both;
}

.wc-tag {
  display:inline-flex; align-items:center; padding:3px 9px; border-radius:12px;
  font-size:11px; font-weight:700; font-family:var(--font-body); letter-spacing:0.03em;
  background:var(--tagBg); color:var(--tagColor); border:1px solid color-mix(in srgb, var(--accent) 20%, var(--tagBg));
}

/* ── Progress bar ──────────────────────────────────────────────────── */
.wc-progress-track {
  height:7px; border-radius:10px;
  background:#E4D7C0; overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,0.08);
}
[data-theme="moon"] .wc-progress-track { background:#2A3450; }

.wc-progress-fill {
  height:100%; border-radius:10px;
  background:linear-gradient(90deg,var(--accent),var(--accentDark));
  transition:width 0.45s var(--ease-out);
  box-shadow:0 1px 6px rgba(var(--accent-rgb),0.42);
  position:relative; overflow:hidden;
}

/* ── Flip card ─────────────────────────────────────────────────────── */
.flip-card { position:relative; cursor:pointer; perspective:700px; flex-shrink:0; }
.flip-card-inner { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .45s cubic-bezier(.4,0,.2,1); }
.flip-card.flipped .flip-card-inner { transform:rotateY(180deg); }
.flip-card-front, .flip-card-back {
  position:absolute; inset:0; border-radius:22px; padding:7px 14px;
  display:flex; flex-direction:column; justify-content:center;
  backface-visibility:hidden; -webkit-backface-visibility:hidden;
}
.flip-card-front { background:var(--soft); border:1px solid var(--border); }
.flip-card-back  { background:var(--soft); border:1px solid var(--border); transform:rotateY(180deg); }
.flip-card-back.over { background:#FEF2F2; border-color:#FECACA; animation:pulseRed 2s infinite; }

/* ── Typography ────────────────────────────────────────────────────── */
.wc-label-hand  { font-family:var(--font-hand); font-size:16px; color:var(--textMuted); line-height:1.3; }
.wc-section-title { font-family:var(--font-body); font-size:11px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:var(--textMuted); }
.wc-app-title   { font-family:var(--font-serif); font-style:italic; font-weight:600; letter-spacing:-0.01em; }
.wc-price       { font-family:var(--font-hand); font-size:17px; font-weight:700; color:var(--accentDark); }
.wc-view-title  { font-family:var(--font-serif); font-style:italic; font-weight:600; font-size:22px; color:var(--textPrimary); letter-spacing:-0.02em; }

/* ── Misc helpers ─────────────────────────────────────────────────── */
.wc-divider {
  height:1px;
  background:linear-gradient(90deg, transparent 0%, var(--border) 30%, var(--border) 70%, transparent 100%);
  opacity:0.50; margin:4px 0;
}
.wc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 24px 40px; gap:16px; text-align:center; }
.wc-empty-icon { font-size:64px; animation:petalFloat 3s ease-in-out infinite; }
.wc-empty-title { font-family:var(--font-hand); font-size:24px; color:var(--textMuted); font-weight:600; }
.wc-empty-sub   { font-size:14px; color:var(--textMuted); opacity:0.7; line-height:1.6; max-width:220px; }
.crayon-grain   { position:fixed; inset:0; z-index:0; pointer-events:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23g)' opacity='0.042'/%3E%3C/svg%3E"); background-size:320px 320px; }
.wc-context-menu { background:var(--sheetBg); border-radius:28px 28px 0 0; border:1px solid #EFE6D6; box-shadow:0 -8px 40px rgba(0,0,0,0.12); animation:slideUp .22s var(--ease-out); }

/* ══════════════════════════════════════════════════════════════════════
   PROFESSIONAL ANIMATIONS
   ══════════════════════════════════════════════════════════════════════ */

/* Entry animations */
@keyframes cardIn {
  0%   { opacity:0; transform:translateY(20px) scale(0.96); }
  60%  { opacity:1; transform:translateY(-3px) scale(1.005); }
  100% { opacity:1; transform:translateY(0) scale(1); }
}

@keyframes itemIn {
  0%   { opacity:0; transform:translateX(-10px) scale(0.98); }
  70%  { transform:translateX(2px) scale(1.003); }
  100% { opacity:1; transform:translateX(0) scale(1); }
}

@keyframes slideUp {
  0%   { opacity:0; transform:translate3d(0,32px,0) scale(0.98); }
  55%  { opacity:1; transform:translate3d(0,-4px,0) scale(1.005); }
  75%  { transform:translate3d(0,2px,0) scale(0.999); }
  100% { opacity:1; transform:translate3d(0,0,0) scale(1); }
}

/* Brief opacity/scale exit before check-state flip (GPU-only props) */
@keyframes slCheckExit {
  0%   { opacity:1; transform:scale(1); }
  60%  { opacity:0.5; transform:scale(0.97); }
  100% { opacity:0; transform:scale(0.94); }
}

@keyframes chipIn {
  0%   { opacity:0; transform:scale(0.70) translateX(10px); }
  65%  { transform:scale(1.06) translateX(-1px); }
  100% { opacity:1; transform:scale(1) translateX(0); }
}

@keyframes badgePop {
  0%   { opacity:0; transform:scale(0.5) rotate(-12deg); }
  70%  { transform:scale(1.15) rotate(4deg); }
  100% { opacity:1; transform:scale(1) rotate(0deg); }
}

@keyframes fadeIn {
  from { opacity:0; } to { opacity:1; }
}

/* Micro-interactions */
@keyframes shimmer {
  0%       { transform:translateX(-120%); }
  55%,100% { transform:translateX(180%); }
}

@keyframes checkBounce {
  0%   { transform:scale(0.6) rotate(-8deg); }
  50%  { transform:scale(1.18) rotate(4deg); }
  75%  { transform:scale(0.92) rotate(-2deg); }
  100% { transform:scale(1) rotate(0deg); }
}

@keyframes petalFloat {
  0%,100% { transform:translateY(0) rotate(0deg); }
  33%     { transform:translateY(-6px) rotate(3deg); }
  66%     { transform:translateY(-3px) rotate(-2deg); }
}

@keyframes pulseRed {
  0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0); }
  50%     { box-shadow:0 0 0 5px rgba(239,68,68,0.18); }
}

@keyframes themeFlip {
  0%   { transform:scale(1) rotate(0deg); }
  40%  { transform:scale(0.80) rotate(180deg); }
  100% { transform:scale(1) rotate(360deg); }
}

@keyframes underlineIn {
  from { transform:scaleX(0); transform-origin:left; }
  to   { transform:scaleX(1); }
}

@keyframes softPop {
  0%   { transform:scale(1); }
  45%  { transform:scale(1.10); }
  100% { transform:scale(1); }
}

@keyframes bagSlide {
  from { opacity:0; transform:translateX(8px); }
  to   { opacity:1; transform:translateX(0); }
}

@keyframes budgetIn {
  0%   { opacity:0; transform:translateY(8px) scale(0.97); }
  100% { opacity:1; transform:translateY(0) scale(1); }
}

@keyframes orbFloat {
  0%,100% { transform:translate(0,0) scale(1); }
  50%     { transform:translate(5px,-6px) scale(1.06); }
}

@keyframes starTwinkle {
  0%,100% { opacity:0.8; transform:scale(1); }
  50%     { opacity:0.25; transform:scale(0.55); }
}

@keyframes fadeSlideIn {
  from { opacity:0; transform:translateY(5px); }
  to   { opacity:1; transform:translateY(0); }
}

/* ══════════════════════════════════════════════════════════════════════
   NEW ANIMATION KEYFRAMES v4 — confetti, ripple, particles, springy FAB
   ══════════════════════════════════════════════════════════════════════ */

/* Confetti square flies outward and fades */
@keyframes slConfetti {
  0%   { transform:translate(0,0) rotate(0deg) scale(1); opacity:1; }
  80%  { opacity:0.9; }
  100% { transform:translate(var(--dx),calc(var(--dy) + 60px)) rotate(var(--rot)) scale(0.4); opacity:0; }
}

/* Floating emoji particle drifts up */
@keyframes slEmojiFloat {
  0%   { transform:translate(0,0) scale(0.6); opacity:1; }
  60%  { opacity:1; transform:translate(var(--dx),-55px) scale(1.15); }
  100% { transform:translate(var(--dx),-90px) scale(0.8); opacity:0; }
}

/* Button ripple */
@keyframes slRipple {
  0%   { transform:scale(0); opacity:0.6; }
  100% { transform:scale(1);  opacity:0; }
}

/* Checkbox check pop with sparkle */
@keyframes slCheckPop {
  0%   { transform:scale(0) rotate(-20deg); opacity:0; }
  55%  { transform:scale(1.30) rotate(8deg); opacity:1; }
  75%  { transform:scale(0.88) rotate(-3deg); }
  100% { transform:scale(1) rotate(0deg); opacity:1; }
}

/* Item exits left (delete) with rubber-band stretch */
@keyframes slDeleteSlide {
  0%   { transform:translateX(0) scaleX(1); opacity:1; }
  20%  { transform:translateX(-8px) scaleX(1.04); opacity:1; }
  100% { transform:translateX(-110%) scaleX(0.7); opacity:0; }
}

/* Item exit slide right (uncheck from bag) */
@keyframes slUncheckSlide {
  0%   { transform:translateX(0); opacity:1; }
  100% { transform:translateX(6px); opacity:1; }
}

/* FAB heartbeat / breathe */
@keyframes slFabBreath {
  0%,100% { box-shadow:0 6px 24px rgba(var(--accent-rgb),0.42),0 2px 6px rgba(0,0,0,0.12); }
  50%     { box-shadow:0 8px 32px rgba(var(--accent-rgb),0.62),0 2px 6px rgba(0,0,0,0.12); }
}

/* Theme switch radial reveal */
@keyframes slThemeReveal {
  0%   { clip-path:circle(0% at 90% 90%); }
  100% { clip-path:circle(150% at 90% 90%); }
}

/* Stat card count-up number flash */
@keyframes slNumFlash {
  0%   { transform:translateY(6px) scale(0.88); opacity:0; }
  60%  { transform:translateY(-2px) scale(1.06); opacity:1; }
  100% { transform:translateY(0) scale(1); opacity:1; }
}

/* Item row entrance with spring */
@keyframes slItemSpring {
  0%   { opacity:0; transform:translateX(-14px) scale(0.97); }
  55%  { transform:translateX(3px) scale(1.01); }
  80%  { transform:translateX(-1px) scale(0.998); }
  100% { opacity:1; transform:translateX(0) scale(1); }
}

/* List card magnetic hover lift */
@keyframes slCardLift {
  0%   { transform:translateY(0) scale(1); }
  100% { transform:translateY(-4px) scale(1.012); }
}

/* Gentle bounce for newly added items */
@keyframes slItemBounceIn {
  0%   { opacity:0; transform:translateY(-10px) scale(0.92); }
  50%  { transform:translateY(4px) scale(1.03); }
  75%  { transform:translateY(-2px) scale(0.99); }
  100% { opacity:1; transform:translateY(0) scale(1); }
}

/* Progress glow pulse */
@keyframes slProgressGlow {
  0%,100% { box-shadow:0 0 6px rgba(var(--accent-rgb),0.35); }
  50%     { box-shadow:0 0 18px rgba(var(--accent-rgb),0.70); }
}

/* ── View transitions — GPU-layered translate3d ─────────────────────── */
@keyframes viewEnterFwd {
  from { opacity:0; transform:translate3d(26px,0,0); }
  to   { opacity:1; transform:translate3d(0,0,0); }
}
@keyframes viewEnterBack {
  from { opacity:0; transform:translate3d(-26px,0,0); }
  to   { opacity:1; transform:translate3d(0,0,0); }
}
.view-enter-fwd  {
  animation: viewEnterFwd  0.30s var(--ease-out) both;
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.view-enter-back {
  animation: viewEnterBack 0.30s var(--ease-out) both;
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

/* ── Exit toast entrance ────────────────────────────────────────────── */
@keyframes slExitToast {
  0%   { opacity:0; transform:translateX(-50%) translateY(14px) scale(0.90); }
  60%  { transform:translateX(-50%) translateY(-3px) scale(1.03); }
  100% { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}

/* ── Exit toast countdown bar (burns down in 2 s matching the timer) ── */
@keyframes slExitProgress {
  0%   { width: 100%; }
  100% { width: 0%; }
}

/* ── Accessibility & global polish ─────────────────────────────────── */
html {
  scroll-behavior: smooth;
  height: 100%;
  overflow: hidden;
}
*, *::before, *::after { -webkit-tap-highlight-color: transparent; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ── FAB enhanced ─────────────────────────────────────────────────── */
/* bottom offset derives from --bottombar-h (set at runtime, see :root
   injection) so the FAB always clears the bottom bar regardless of its
   actual rendered height — no more guessing a magic pixel value. */
.wc-fab {
  position:fixed; bottom:calc(var(--bottombar-h, 64px) + 10px); left:50%; transform:translateX(-50%);
  background:linear-gradient(145deg, var(--accent), var(--accentDark));
  color:#fff; border:none; border-radius:28px;
  padding:13px 32px; font-size:15px; font-weight:800;
  cursor:pointer; z-index:21; font-family:var(--font-body);
  box-shadow:
    0 6px 24px rgba(var(--accent-rgb),0.42),
    0 2px 6px  rgba(0,0,0,0.12);
  transition:transform 0.20s var(--ease-spring), box-shadow 0.20s ease;
  overflow:hidden; letter-spacing:0.02em;
}
/* heartbeat breathe */
.wc-fab { animation: slFabBreath 2.6s ease-in-out infinite; }
.wc-fab:hover:not(:active),
.wc-fab:active { animation: none; }
.wc-fab:hover:not(:active) {
  transform:translateX(-50%) translateY(-2px);
  box-shadow:
    0 10px 30px rgba(var(--accent-rgb),0.52),
    0 2px 8px rgba(0,0,0,0.14);
}
.wc-fab:active {
  transform:translateX(-50%) scale(0.93) !important;
  box-shadow:0 3px 10px rgba(var(--accent-rgb),0.30) !important;
  transition-duration:0.08s !important;
}

/* ── Global button active press ────────────────────────────────────── */
button { transition:transform 0.15s var(--ease-spring), box-shadow 0.15s ease, background 0.15s ease, color 0.15s ease; }

/* Pressable card active state */
.pressable:active { transform:scale(0.975) !important; transition-duration:0.08s !important; }

/* ── List card hover lift ───────────────────────────────────────────── */
.list-card:hover:not(:active) {
  transform:translateY(-2px) scale(1.004);
  box-shadow:0 8px 28px rgba(0,0,0,0.09);
}
.list-card:active {
  transform:scale(0.974) !important;
  box-shadow:0 1px 6px rgba(0,0,0,0.05) !important;
  transition-duration:0.08s !important;
}

/* ── Staggered list-item entry ──────────────────────────────────────── */
.item-stagger:nth-child(1)  { animation-delay:0.00s; }
.item-stagger:nth-child(2)  { animation-delay:0.03s; }
.item-stagger:nth-child(3)  { animation-delay:0.06s; }
.item-stagger:nth-child(4)  { animation-delay:0.09s; }
.item-stagger:nth-child(5)  { animation-delay:0.12s; }
.item-stagger:nth-child(6)  { animation-delay:0.15s; }
.item-stagger:nth-child(7)  { animation-delay:0.17s; }
.item-stagger:nth-child(8)  { animation-delay:0.19s; }
.item-stagger:nth-child(n+9){ animation-delay:0.21s; }

/* ── Chip hover ─────────────────────────────────────────────────────── */
.wc-chip:hover { transform:translateY(-1px) scale(1.04); }

/* ── Nav tab press ──────────────────────────────────────────────────── */
.nav-tab:active > div { transform:scale(0.87) !important; transition-duration:0.08s !important; }

/* ── Smooth section separator ───────────────────────────────────────── */
.section-sep {
  height:1px;
  background:linear-gradient(90deg,transparent,var(--border) 20%,var(--border) 80%,transparent);
  opacity:0.50; margin:0;
}

/* ── Preset item row tap flash ──────────────────────────────────────── */
.preset-item-btn:active { background:var(--tagBg) !important; transition-duration:0.06s !important; }

/* ── Search input polish ────────────────────────────────────────────── */
.wc-search-wrap { position:relative; }
.wc-search-wrap .icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); pointer-events:none; color:var(--textMuted); opacity:0.6; }
`;

export default function SuperLista() {
  const [lists,       setLists]       = useState(() => LS.get("sl5_lists",   [{ id:"default", name:"Casa", items:[], createdAt:Date.now() }]));
  const [settings,    setSettings]    = useState(() => { const s = LS.get("sl5_settings", { currencyCode:"CRC" }); return { ...s, currencyCode: s.currencyCode || "CRC" }; });
  const [profile,     setProfile]     = useState(() => LS.get("sl5_profile", { name:"", budget:"" }));
  const [history,     setHistory]     = useState(() => LS.get("sl5_history", []));
  const [activeListId, setActiveListId] = useState(null);
  const [view,        setView]        = useState("lists");
  const [navActive,   setNavActive]   = useState("home");
  const [showProfile, setShowProfile] = useState(false);
  const [profileTab,  setProfileTab]  = useState("profile");
  const [themeName,   setThemeName]   = useState(() => LS.get("sl5_theme", "green"));
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimer = useRef(null);

  // Inject static CSS into <head> once on mount (avoids React diffing ~700 lines of CSS every render)
  useEffect(() => {
    if (document.getElementById("sl-static-css")) return;
    const el = document.createElement("style");
    el.id = "sl-static-css";
    el.textContent = SUPERLISTA_STATIC_CSS;
    document.head.appendChild(el);
  }, []);

    const listsWriteTimer = useRef(null);
  useEffect(() => {
    // Debounce — checked items fire many rapid state updates; batch the write
    clearTimeout(listsWriteTimer.current);
    listsWriteTimer.current = setTimeout(() => LS.set("sl5_lists", lists), 400);
    return () => clearTimeout(listsWriteTimer.current);
  }, [lists]);
  useEffect(() => { LS.set("sl5_settings", settings); }, [settings]);
  useEffect(() => { LS.set("sl5_profile",  profile);  }, [profile]);
  useEffect(() => { LS.set("sl5_history",  history);  }, [history]);
  useEffect(() => { LS.set("sl5_theme",    themeName); }, [themeName]);

  // ── Supabase cloud sync — mirrors every LS write to the cloud ─────────────
  // localStorage stays as the instant read/write cache; Supabase is the
  // persistent layer that survives app reinstalls. Si el dispositivo está
  // unido a un código de hogar (ver hooks/householdId.js), esto también
  // sincroniza con los demás dispositivos del hogar vía polling cada pocos
  // segundos (no Realtime, para evitar cualquier costo de conexión WebSocket
  // con varios usuarios activos).
  useSupabaseSync("sl_lists",    lists,    setLists,    DEFAULT_LISTS);
  useSupabaseSync("sl_profile",  profile,  setProfile,  { name:"", budget:"" });
  useSupabaseSync("sl_settings", settings, setSettings, { currencyCode:"CRC" });
  useSupabaseSync("sl_history",  history,  setHistory,  []);
  // Outfit se carga localmente vía @font-face en index.css (el único CSS que
  // este proyecto realmente importa) — no se necesitan fuentes externas.

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
    return () => document.documentElement.removeAttribute("data-theme");
  }, [themeName]);

  // ── Android hardware back-button handler (Capacitor) ─────────────────────
  // Capacitor's WebView intercepts the hardware back press before the browser
  // ever sees it, so pushState/popstate never fires. We use @capacitor/app's
  // backButton event instead, which gives us full control.
  //
  // Strategy:
  //   • SINGLE listener registered here. capacitorBack.js is a no-op — two
  //     listeners racing each other was the root cause of instant-minimize.
  //   • All nav state is read from navStateRef so the closure is never stale.
  //   • At root: first press → toast; second press within 2 s → exitApp().
  //   • Cleanup stores the resolved PluginListenerHandle synchronously via
  //     a ref, avoiding a .then() race on unmount.

  const navStateRef   = useRef({ view: "lists", showProfile: false });
  const listenerRef   = useRef(null); // stores the resolved PluginListenerHandle

  // Keep the ref in sync with state (no re-render cost)
  useEffect(() => { navStateRef.current = { view, showProfile }; }, [view, showProfile]);

  useEffect(() => {
    // addListener returns a Promise<PluginListenerHandle> — resolve it once
    // and store it so cleanup never races against an unresolved Promise.
    CapApp.addListener("backButton", () => {
      const { view: currentView, showProfile: currentShowProfile } = navStateRef.current;

      // 1. Profile modal open → close it
      if (currentShowProfile) {
        Sounds.navBack();
        setShowProfile(false);
        setNavActive("");
        setProfileTab("profile");
        return;
      }

      // 2. addItems → list
      if (currentView === "addItems") {
        Sounds.navBack();
        setView("list");
        return;
      }

      // 3. list detail → lists home
      if (currentView === "list") {
        Sounds.navBack();
        setView("lists");
        setActiveListId(null);
        return;
      }

      // 4. stats → lists home
      if (currentView === "stats") {
        Sounds.navBack();
        setNavActive("home");
        setView("lists");
        return;
      }

      // 5. Already at root — "press twice to exit" pattern
      if (exitToastTimer.current) {
        // Second press within 2 s → exit cleanly
        clearTimeout(exitToastTimer.current);
        exitToastTimer.current = null;
        setShowExitToast(false);
        CapApp.exitApp();   // exitApp, not minimizeApp — user explicitly wants out
        return;
      }

      // First press at root → show toast, do nothing else
      setShowExitToast(true);
      exitToastTimer.current = setTimeout(() => {
        setShowExitToast(false);
        exitToastTimer.current = null;
      }, 2000); // 2 s window — standard Android "double-back to exit" timing
    }).then(handle => {
      listenerRef.current = handle; // store once resolved
    });

    return () => {
      // Remove listener using the stored handle (no .then() race on teardown)
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
      if (exitToastTimer.current) {
        clearTimeout(exitToastTimer.current);
        exitToastTimer.current = null;
      }
    };
  }, []); // empty deps: register once on mount, read state via ref

  const theme = useMemo(() => THEMES[themeName], [themeName]);

  // Inject dynamic CSS vars into <head> — keyed on theme so it only runs when
  // the theme actually changes, never on unrelated state updates (lists, view, etc.).
  // NOTA: este efecto debe vivir después de `const theme` — antes estaba ~150
  // líneas arriba, ejecutándose antes de que `theme` existiera en este scope,
  // lo cual causaba un ReferenceError (temporal dead zone) y dejaba la pantalla
  // en negro al entrar a la app.
  useEffect(() => {
    let el = document.getElementById("sl-theme-vars");
    if (!el) {
      el = document.createElement("style");
      el.id = "sl-theme-vars";
      document.head.appendChild(el);
    }
    el.textContent = `
      :root {
        --accent:      ${theme.accent};
        --accentDark:  ${theme.accentDark};
        --accentLight: ${theme.accentLight || theme.accent};
        --soft:        ${theme.soft};
        --border:      ${theme.border};
        --cardBg:      ${theme.cardBg};
        --cardBorder:  ${theme.cardBorder};
        --textPrimary: ${theme.textPrimary};
        --textMuted:   ${theme.textMuted};
        --navBg:       ${theme.navBg};
        --headerBg:    ${theme.headerBg};
        --sheetBg:     ${theme.sheetBg};
        --pillBg:      ${theme.pillBg};
        --pillBorder:  ${theme.pillBorder};
        --tagBg:       ${theme.tagBg};
        --tagColor:    ${theme.tagColor};
        --accent-rgb:  ${theme.accentRgb || "94,171,47"};
        --bottombar-h: calc(64px + env(safe-area-inset-bottom, 0px));
      }
      .flip-card-front { background:${theme.soft}; border:1px solid ${theme.border}; }
      .flip-card-back  { background:${theme.soft}; border:1px solid ${theme.border}; transform:rotateY(180deg); }
    `;
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setThemeName(t => t === "green" ? "pink" : t === "pink" ? "moon" : "green");
  }, []);

  const activeList = useMemo(() => lists.find(l => l.id===activeListId), [lists, activeListId]);
  const sym = useMemo(() => settings.currencyCode==="CRC" ? "₡" : settings.currencyCode==="EUR" ? "€" : settings.currencyCode==="GBP" ? "£" : "$", [settings.currencyCode]);
  const Sd = useMemo(() => makeStyles(theme), [theme]); // memoized — only recomputes on theme change

  const updateItem = useCallback((id, fn, newItem) => setLists(prev => prev.map(l =>
    l.id===activeListId ? { ...l, items: newItem ? [...l.items,newItem] : id ? l.items.map(it=>it.id===id?fn(it):it) : l.items } : l
  )), [activeListId]);
  const deleteItem = useCallback((id) => setLists(prev => prev.map(l => l.id===activeListId ? { ...l, items:l.items.filter(it=>it.id!==id) } : l)), [activeListId]);
  const addItem    = useCallback((item) => setLists(prev => prev.map(l => l.id===activeListId ? { ...l, items:[...l.items,item] } : l)), [activeListId]);

  const closeSession = useCallback((session) => {
    setHistory(prev => [...prev, session]);
    // "Cerrar compra" empties the cart: only items that were in the cart return to Inventario.
    // Items still sitting in Lista de Compras (never added to the cart) are left untouched.
    setLists(prev => prev.map(l => l.id===activeListId
      ? { ...l, items: l.items.map(it => isInCart(it) ? { ...it, stage:"inventory", checked:false } : it) }
      : l
    ));
  }, [activeListId]);

  const handleOpenList   = useCallback((id) => { setActiveListId(id); setView("list"); }, []);
  const handleDeleteList = useCallback((id) => setLists(prev => prev.filter(l => l.id !== id)), []);
  const handleCreateList = useCallback((name) => {
    const nl = { id:genId(), name, items:[], createdAt:Date.now() };
    setLists(prev => [...prev, nl]);
    setActiveListId(nl.id);
    setView("list");
  }, []);
  const handleBack       = useCallback(() => { setView("lists"); setActiveListId(null); }, []);
  const handleGoAdd      = useCallback(() => setView("addItems"), []);
  const handleGoBack     = useCallback(() => setView("list"), []);
  const handleOpenProfile = useCallback(() => { setProfileTab("budget"); setShowProfile(true); }, []);
  const handleSaveBudget  = useCallback((val) => setProfile(p => ({ ...p, budget: val })), []);

  return (
    <>
      {/* ── Confetti / particle root — fixed overlay, pointer-events:none ── */}
      <div id="sl-confetti-root" style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none", overflow:"hidden" }} />

      {/* CSS vars injected via useEffect below — no JSX style tag needed here */}



      {/* ── Theme toggle pill ── */}
      <button
        onClick={(e) => { Sounds.themeToggle(); ripple(e, "rgba(255,255,255,0.4)"); toggleTheme(); }}
        title={themeName === "green" ? "Cambiar a rosa 🌸" : themeName === "pink" ? "Cambiar a Saprissa ⚽" : "Cambiar a verde 🌿"}
        style={{
          position:"fixed", bottom:90, right:16, zIndex:50,
          background: themeName === "green"
            ? "linear-gradient(135deg,#f9a8d4,#ec4899)"
            : themeName === "pink"
            ? "linear-gradient(135deg,#8B3FC8,#5B1A8E)"
            : "linear-gradient(135deg,#86efac,#22c55e)",
          border:"none", borderRadius:100,
          width:44, height:44,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:20, cursor:"pointer",
          boxShadow:"0 3px 12px rgba(0,0,0,.15)",
          transition:"background .4s ease, transform .18s cubic-bezier(0.34,1.4,0.64,1)",
        }}
        onMouseDown={e  => { e.currentTarget.style.transform="scale(.86)"; }}
        onMouseUp={e    => { e.currentTarget.style.transform="scale(1)"; }}
        onTouchStart={e => { e.currentTarget.style.transform="scale(.86)"; }}
        onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
      >
        {themeName === "green" ? "🌸" : themeName === "pink" ? "⚽" : "🌿"}
      </button>
      <div style={Sd.app}>
        {(view==="lists" || view==="stats") && (
          <SwipeTabContainer tab={view} onTabChange={(t) => { setNavActive(t==="stats" ? "stats" : "home"); setView(t); }}>
            <div style={{ width:`${TAB_W}%`, height:"100%", flexShrink:0, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <ListsView lists={lists} sym={sym} history={history} budget={profile.budget} themeName={themeName} theme={theme}
                onOpenList={handleOpenList}
                onDeleteList={handleDeleteList}
                onCreateList={handleCreateList} />
            </div>
            <div style={{ width:`${TAB_W}%`, height:"100%", flexShrink:0, minHeight:0, display:"flex", flexDirection:"column", overflow:"hidden" }}>
              <StatsView history={history} budget={profile.budget} sym={sym} />
            </div>
          </SwipeTabContainer>
        )}
        {view==="list" && activeList && (
          <div key="list">
          <ListView list={activeList} sym={sym} budget={profile.budget} theme={theme}
            onBack={handleBack}
            onUpdateItem={updateItem} onDeleteItem={deleteItem} onGoAdd={handleGoAdd}
            onOpenProfile={handleOpenProfile}
            onSaveBudget={handleSaveBudget}
            onCloseSession={closeSession} />
          </div>
        )}
        {view==="addItems" && activeList && (
          <div key="addItems">
          <AddItemsView list={activeList} sym={sym} theme={theme} onBack={handleGoBack} onAddItem={addItem} />
          </div>
        )}
      </div>

      {(view==="lists" || view==="stats") && (
        <BottomNav active={navActive} theme={theme}
          onNewList={() => { setNavActive("home"); setView("lists"); document.getElementById("nueva-lista-input")?.focus(); }}
          onStats={() => { setNavActive("stats"); setView("stats"); }}
          onProfile={() => { setNavActive("profile"); setProfileTab("profile"); setShowProfile(true); }} />
      )}

      {showProfile && (
        <ProfileModal profile={profile} settings={settings} history={history}
          initialTab={profileTab}
          onClose={() => { setShowProfile(false); setNavActive(""); setProfileTab("profile"); }}
          onSaveProfile={(p) => setProfile(p)}
          onSaveSettings={(s) => setSettings(s)} />
      )}

      {/* ── Android back-button exit toast ── */}
      {showExitToast && (
        <div style={{
          position: "fixed",
          bottom: 100,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 99999,
          background: "#1E140A", color: "#fff",
          padding: "10px 20px 8px",
          borderRadius: 18,
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "var(--font-body)",
          letterSpacing: "0.01em",
          boxShadow: "0 8px 32px rgba(0,0,0,0.32)",
          whiteSpace: "nowrap",
          animation: "slExitToast 0.28s cubic-bezier(0.34,1.4,0.64,1) both",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 7,
          pointerEvents: "none",
          minWidth: 220,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17 }}>👋</span>
            Presiona atrás de nuevo para salir
          </div>
          {/* Progress bar burns down over 2 s to show the exit window closing */}
          <div style={{
            width: "100%", height: 3, borderRadius: 3,
            background: "#3A2E1C",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%", borderRadius: 3,
              background: "#E8DCC8",
              animation: "slExitProgress 2s linear forwards",
            }} />
          </div>
        </div>
      )}
    </>
  );
}
