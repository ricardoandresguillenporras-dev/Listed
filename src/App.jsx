import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  Carnes: "#fca5a5", Panadería: "#fdba74", Bebidas: "#a5b4fc",
  Higiene: "#f0abfc", Limpieza: "#6ee7b7",
};

const UNITS = ["pza", "kg", "g", "L", "ml", "paq", "cja"];
const HOLD_MS = 1000;
const genId = () => Math.random().toString(36).substr(2, 9);
const totalCost = (items) => items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (it.qty || 1), 0);

// ── Styles (theme-aware) ──────────────────────────────────────────────────────
const makeStyles = (theme) => ({
  app: {
    maxWidth: 430, margin: "0 auto", minHeight: "100vh",
    background: "transparent", display: "flex", flexDirection: "column",
    position: "relative", paddingBottom: 76,
    fontFamily: "'Nunito', 'DM Sans', 'Segoe UI', sans-serif",
    color: theme.isDark ? theme.textPrimary : "#1A2118",
  },
  header: {
    display: "flex", alignItems: "center", padding: "14px 16px 12px",
    background: theme.isDark
      ? "rgba(15,23,42,0.90)"
      : "rgba(255,255,255,0.60)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderBottom: theme.isDark
      ? "1px solid rgba(99,102,241,0.18)"
      : "1px solid rgba(255,255,255,0.65)",
    boxShadow: theme.isDark
      ? "0 1px 12px rgba(0,0,0,0.3)"
      : "0 1px 12px rgba(80,60,20,0.06)",
    gap: 10,
    position: "sticky", top: 0, zIndex: 10,
  },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  bottomBar: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: 430, maxWidth: "100%",
    background: theme.isDark
      ? "rgba(15,23,42,0.94)"
      : "rgba(255,255,255,0.70)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderTop: theme.isDark
      ? "1px solid rgba(99,102,241,0.18)"
      : "1px solid rgba(255,255,255,0.65)",
    boxShadow: theme.isDark
      ? "0 -1px 12px rgba(0,0,0,0.3)"
      : "0 -1px 12px rgba(80,60,20,0.06)",
    display: "flex", alignItems: "center",
    padding: "10px 14px", gap: 10, zIndex: 20,
  },
  fab: {
    // Use className="wc-fab" instead; this keeps the ref for legacy inline fallback
    position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(145deg,var(--accent),var(--accentDark))", color: "#FFFFFF",
    border: "none", borderRadius: 28, padding: "13px 32px",
    fontSize: 15, fontWeight: 800, cursor: "pointer", zIndex: 21,
    boxShadow: "0 6px 24px rgba(var(--accent-rgb,94,171,47),0.40), inset 0 1px 0 rgba(255,255,255,0.22)",
    transition: "transform 0.20s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.20s ease",
    letterSpacing: "0.02em", overflow: "hidden", fontFamily: "inherit",
  },
});

// ══════════════════════════════════════════════════════════════════════════════
// 🎨 WATERCOLOR ILLUSTRATED ICON SYSTEM
// Hand-painted SVG icons inspired by watercolor fruit/food illustration style.
// Each icon uses layered fills with soft gradients, highlight blobs, and
// cast shadows — mimicking the wet-on-wet watercolor technique in the refs.
// ══════════════════════════════════════════════════════════════════════════════

// Helper: shared defs injected once per SVG (radial gradients, filters)

// ══════════════════════════════════════════════════════════════════════════════
// 🎨 UNIFIED WATERCOLOR + CRAYON ICON SYSTEM  v4
// All icons use layered watercolor washes + chunky crayon-style outlines +
// soft highlights — consistent hand-painted aesthetic across the whole app.
// Sources: original App-icons, WatercolorIcons.jsx, reference image (foods)
// ══════════════════════════════════════════════════════════════════════════════

// Shared defs: paper noise filter + drop shadow (injected once per SVG)
const WcDefs = () => (
  <defs>
    <filter id="wc-paper" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" seed="2" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="grayNoise"/>
      <feBlend in="SourceGraphic" in2="grayNoise" mode="soft-light" result="blend"/>
      <feComposite in="blend" in2="SourceGraphic" operator="in"/>
    </filter>
    <filter id="wc-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="rgba(0,0,0,0.18)"/>
    </filter>
  </defs>
);

// ─────────────────────────────────────────────────────────────────────────────
// FRUITS & VEGETABLES
// ─────────────────────────────────────────────────────────────────────────────

const WcApple = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="33" rx="8" ry="2" fill="rgba(80,40,0,0.13)"/>
    <path d="M18 6c-7 0-12 5.5-12 13 0 7 4.5 13 12 13s12-6 12-13C30 11.5 25 6 18 6z" fill="#7DC563" stroke="#4A8A2A" strokeWidth="1.2"/>
    <path d="M14 8c-4 2.5-6 7-6 11 0 2 .4 4 1 5.5C11 17 14 10 22 8c-2-1-5-1.5-8 0z" fill="#B5E57A" opacity="0.7"/>
    <path d="M28 16c0 7-4 13-10 14.5C24 29 30 23 30 16c0-2-.3-3.8-.8-5.3.5 1.5.8 3.3.8 5.3z" fill="#4A9A3A" opacity="0.5"/>
    <ellipse cx="14" cy="11" rx="3" ry="2" fill="white" opacity="0.55" transform="rotate(-20 14 11)"/>
    <ellipse cx="12" cy="10" rx="1.2" ry="0.8" fill="white" opacity="0.8" transform="rotate(-20 12 10)"/>
    <path d="M18 6c0 0 1-3 3-4" stroke="#6B4226" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M19.5 3.5c1-1.5 3-2 4-1.5-1 1.5-3 2-4 1.5z" fill="#5AAB3A"/>
  </svg>
);

const WcOrange = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="33.5" rx="8" ry="2" fill="rgba(120,60,0,0.14)"/>
    <circle cx="18" cy="18" r="13" fill="#F5A623" stroke="#C07010" strokeWidth="1.2"/>
    <path d="M10 9c-3 3-4 7-3 11 1-4 4-8 8-10C13 9 11 9 10 9z" fill="#FDD07A" opacity="0.75"/>
    {[0,30,60,90,120,150].map(a=>{const r=(a*Math.PI)/180;return <line key={a} x1="18" y1="18" x2={18+12*Math.cos(r)} y2={18+12*Math.sin(r)} stroke="#E8892A" strokeWidth="0.6" opacity="0.5"/>;} )}
    <path d="M26 12c3 4 3 10 0 14-2 3-5 5-8 5 5-1 9-5 10-10 .5-3 0-6-2-9z" fill="#D4720F" opacity="0.35"/>
    <ellipse cx="13" cy="12" rx="3.5" ry="2.2" fill="white" opacity="0.55" transform="rotate(-25 13 12)"/>
    <ellipse cx="11.5" cy="11" rx="1.5" ry="1" fill="white" opacity="0.80" transform="rotate(-25 11.5 11)"/>
    <ellipse cx="18" cy="29" rx="2.5" ry="1.2" fill="#D4720F" opacity="0.4"/>
    <circle cx="18" cy="5.5" r="1.2" fill="#5C8A2A" stroke="#3A6010" strokeWidth="0.8"/>
  </svg>
);

const WcBanana = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="8" ry="2" fill="rgba(100,80,0,0.13)"/>
    <path d="M8 28c-1-8 2-16 8-20 4-2.5 8-2.5 10-1-3 1-6 4-8 9-2 5-2 10-1 13z" fill="#F5D020" stroke="#C0A010" strokeWidth="1.2"/>
    <path d="M10 26c0-6 2-12 6-16 2-2 4-3 6-3-2 1-4 4-5.5 8-1.5 4-2 9-1.5 12z" fill="#FFF09A" opacity="0.6"/>
    <path d="M16 8c4-2 8-1.5 10-.5-2 1-4 3-5 7 1-3 3-5 4-6-2-.5-5-.5-9 .5z" fill="#D4A820" opacity="0.40"/>
    <path d="M8 28c-1 2-.5 4 1 5" stroke="#8B6010" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M18 8c0 0 3-2.5 4-4" stroke="#8B6010" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M11 23c1-5 3-10 6-13" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.35"/>
    <ellipse cx="12" cy="19" rx="1.2" ry="2.5" fill="white" opacity="0.55" transform="rotate(-60 12 19)"/>
  </svg>
);

const WcCarrot = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="19" cy="34" rx="5" ry="1.5" fill="rgba(100,50,0,0.12)"/>
    <path d="M14 10c0 0 2-1 5 0l2 6-2 18-5-18z" fill="#F07820" stroke="#C05A10" strokeWidth="1.1"/>
    <path d="M14 10c0 0 1-1 3 0l1 5-1 12-3-17z" fill="#F8A84A" opacity="0.55"/>
    <path d="M19 10l2 6-2 18 1-18-1-6z" fill="#C05A10" opacity="0.30"/>
    <path d="M17 33c.5 2 .5 3 0 4" stroke="#C05A10" strokeWidth="0.9" strokeLinecap="round"/>
    {[14,19,24,28].map((y,i)=><path key={i} d={`M${14+i*.4} ${y}q2.5 1 ${5-i*.5} 0`} stroke="#D06A15" strokeWidth="0.7" fill="none" opacity="0.4"/>)}
    <path d="M15 12c0 6 1 14 1 20" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.30"/>
    <path d="M14 10c-1-3 0-6 2-8 1 2 1 5 0 8z" fill="#4DAA30"/>
    <path d="M16 10c1-4 3-6 5-7-1 2-2 5-1 7z" fill="#5CC040" opacity="0.85"/>
    <path d="M18 10c2-3 5-4 6-3-2 2-3 4-3 7z" fill="#4DAA30" opacity="0.7"/>
  </svg>
);

const WcLemon = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(100,100,0,0.12)"/>
    <path d="M6 18c0-7 5-13 12-13s12 6 12 13-5 13-12 13S6 25 6 18z" fill="#F5E020" stroke="#C0A800" strokeWidth="1.2"/>
    <path d="M10 10c-2 3-3 7-2 11 1-4 3-8 6-9-1-1-3-1-4-2z" fill="#FFF880" opacity="0.65"/>
    <path d="M27 13c2 4 2 9 0 13-2 3-5 5-9 5 5-1 9-5 10-10 .5-3 0-6-1-8z" fill="#C8B000" opacity="0.28"/>
    {[[13,15,.7],[18,12,.6],[22,18,.7],[15,22,.6],[20,24,.5],[10,20,.6]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} fill="#D4C000" opacity="0.5"/>)}
    <ellipse cx="13" cy="12" rx="3.5" ry="2.2" fill="white" opacity="0.55" transform="rotate(-25 13 12)"/>
    <ellipse cx="11.5" cy="11" rx="1.5" ry="1" fill="white" opacity="0.82" transform="rotate(-25 11.5 11)"/>
  </svg>
);

const WcTomato = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(120,0,0,0.12)"/>
    <circle cx="18" cy="20" r="13" fill="#E83030" stroke="#A01010" strokeWidth="1.2"/>
    <path d="M10 11c-3 3-4 8-3 12 1-4 4-8 8-9-1-1-3-2-5-3z" fill="#F87070" opacity="0.55"/>
    <path d="M28 16c2 4 1 10-2 13-2 2-5 3-8 3 5 0 9-4 10-9 .5-2.5 0-5-.5-7z" fill="#B01010" opacity="0.30"/>
    <ellipse cx="13" cy="13" rx="3.5" ry="2.2" fill="white" opacity="0.55" transform="rotate(-25 13 13)"/>
    <ellipse cx="11.5" cy="12" rx="1.5" ry="1" fill="white" opacity="0.82" transform="rotate(-25 11.5 12)"/>
    <path d="M18 7c-1 0-1.5.5-1.5 1.5h3C19.5 7.5 19 7 18 7z" fill="#3A8A20"/>
    <path d="M18 8.5c0-3-1-5-2-6 1 1 2 3 2 6z" fill="#4AAA28"/>
    <path d="M18 8.5c0-3 1-5 2-6-1 1-2 3-2 6z" fill="#4AAA28"/>
    <path d="M18 8.5c-2-2-4-2-5-1 1.5 1 3 1 5 1z" fill="#3A9020" opacity="0.8"/>
    <path d="M18 8.5c2-2 4-2 5-1-1.5 1-3 1-5 1z" fill="#3A9020" opacity="0.8"/>
    <path d="M18 7c0-2 .5-3 1-4" stroke="#4A6B20" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const WcBroccoli = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="5" ry="1.5" fill="rgba(20,60,0,0.13)"/>
    <rect x="15" y="22" width="6" height="11" rx="3" fill="#5A9A30" stroke="#3A7018" strokeWidth="1"/>
    <rect x="16" y="22" width="2.5" height="11" rx="1.2" fill="#7ABB50" opacity="0.5"/>
    {[{cx:18,cy:14,r:7,fill:"#2D7A20"},{cx:11,cy:19,r:5.5,fill:"#2D7A20"},{cx:25,cy:19,r:5.5,fill:"#2D7A20"},{cx:12,cy:14,r:5,fill:"#3A9028"},{cx:24,cy:14,r:5,fill:"#3A9028"}].map((f,i)=>(
      <g key={i}>
        <circle cx={f.cx} cy={f.cy} r={f.r} fill={f.fill} stroke="#1A5010" strokeWidth="0.8"/>
        <circle cx={f.cx-f.r*.3} cy={f.cy-f.r*.2} r={f.r*.35} fill="#4FB038" opacity="0.55"/>
        <circle cx={f.cx+f.r*.2} cy={f.cy-f.r*.3} r={f.r*.3} fill="#4FB038" opacity="0.45"/>
        <ellipse cx={f.cx-f.r*.25} cy={f.cy-f.r*.3} rx={f.r*.3} ry={f.r*.2} fill="white" opacity="0.28" transform={`rotate(-20 ${f.cx-f.r*.25} ${f.cy-f.r*.3})`}/>
      </g>
    ))}
    <ellipse cx="15" cy="10" rx="3" ry="2" fill="white" opacity="0.32" transform="rotate(-15 15 10)"/>
  </svg>
);

const WcAvocado = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="8" ry="2" fill="rgba(40,80,0,0.12)"/>
    <path d="M18 4c-4 0-8 4-9 10-1 7 2 16 9 18 7-2 10-11 9-18-1-6-5-10-9-10z" fill="#2D5A1B" stroke="#1A3A08" strokeWidth="1.3"/>
    <path d="M18 7c-3 0-6 3-7 8-1 5 1 12 7 14 6-2 8-9 7-14-1-5-4-8-7-8z" fill="#C8E06A"/>
    <path d="M15 10c-2 2-3 6-2 10 1-4 3-7 5-8-1-.5-2-1.5-3-2z" fill="#E8F090" opacity="0.6"/>
    <ellipse cx="18" cy="22" rx="5" ry="6" fill="#8B4513"/>
    <ellipse cx="17" cy="20.5" rx="2" ry="2.5" fill="#A0552A" opacity="0.6"/>
    <ellipse cx="16.5" cy="19.5" rx="1" ry="1.3" fill="#C87840" opacity="0.55"/>
    <path d="M18 4c0-1 .5-2.5 1-3" stroke="#4A6B20" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
);

const WcGrapes = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(80,20,80,0.14)"/>
    {[{cx:13,cy:25,r:6.5},{cx:23,cy:25,r:6.5},{cx:18,cy:20,r:6},{cx:12,cy:17,r:5.5},{cx:24,cy:17,r:5.5},{cx:18,cy:13,r:5}].map((g,i)=>(
      <g key={i}>
        <circle cx={g.cx} cy={g.cy} r={g.r} fill="#A855B5" stroke="#7C2E8E" strokeWidth="0.8"/>
        <circle cx={g.cx+g.r*0.3} cy={g.cy+g.r*0.3} r={g.r*0.55} fill="#7C2E8E" opacity="0.38"/>
        <ellipse cx={g.cx-g.r*0.28} cy={g.cy-g.r*0.28} rx={g.r*0.38} ry={g.r*0.28} fill="white" opacity="0.60" transform={`rotate(-30 ${g.cx-g.r*0.28} ${g.cy-g.r*0.28})`}/>
        <ellipse cx={g.cx-g.r*0.36} cy={g.cy-g.r*0.38} rx={g.r*0.18} ry={g.r*0.12} fill="white" opacity="0.85"/>
      </g>
    ))}
    <path d="M18 8c0 0 0-3 2-5" stroke="#8B6020" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M18 9c-2-1-3-2-2-4" stroke="#8B6020" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

const WcCherry = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="12" cy="33.5" rx="6" ry="1.5" fill="rgba(120,0,0,0.12)"/>
    <ellipse cx="24" cy="33.5" rx="6" ry="1.5" fill="rgba(120,0,0,0.12)"/>
    <path d="M12 25c0-8 6-12 12-16" stroke="#4A7C30" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M24 25c2-5 0-10-4-16" stroke="#4A7C30" strokeWidth="1.4" strokeLinecap="round"/>
    <path d="M18 11c1-3 4-4 6-3-1 3-4 4-6 3z" fill="#5AAB3A" opacity="0.9"/>
    {[[12,28,7],[24,28,7]].map(([cx,cy,r],i)=>(
      <g key={i}>
        <circle cx={cx} cy={cy} r={r} fill="#D92B3A" stroke="#901018" strokeWidth="0.9"/>
        <path d={`M${cx-r*.5} ${cy-r*.4}a${r*.6} ${r*.6} 0 0 1 ${r*.8} ${r*.2}`} fill="#F26070" opacity="0.45"/>
        <circle cx={cx+r*.3} cy={cy+r*.25} r={r*.55} fill="#A01520" opacity="0.28"/>
        <ellipse cx={cx-r*.28} cy={cy-r*.3} rx={r*.32} ry={r*.22} fill="white" opacity="0.62" transform={`rotate(-20 ${cx-r*.28} ${cy-r*.3})`}/>
        <ellipse cx={cx-r*.38} cy={cy-r*.4} rx={r*.14} ry={r*.1} fill="white" opacity="0.9"/>
      </g>
    ))}
  </svg>
);

const WcBlueberry = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(20,40,120,0.12)"/>
    {[{cx:11,cy:24,r:7},{cx:25,cy:24,r:7},{cx:18,cy:19,r:7},{cx:12,cy:15,r:6},{cx:24,cy:15,r:6}].map((b,i)=>(
      <g key={i}>
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="#3B4FA8" stroke="#1E2D7A" strokeWidth="0.8"/>
        <circle cx={b.cx+b.r*.3} cy={b.cy+b.r*.3} r={b.r*.5} fill="#1E2D7A" opacity="0.40"/>
        <path d={`M${b.cx-1} ${b.cy-b.r+1.5}q1-1.5 2 0`} stroke="#8FA8D8" strokeWidth="0.8" strokeLinecap="round" opacity="0.7"/>
        <ellipse cx={b.cx-b.r*.28} cy={b.cy-b.r*.28} rx={b.r*.32} ry={b.r*.22} fill="white" opacity="0.50" transform={`rotate(-30 ${b.cx-b.r*.28} ${b.cy-b.r*.28})`}/>
        <ellipse cx={b.cx-b.r*.38} cy={b.cy-b.r*.38} rx={b.r*.15} ry={b.r*.1} fill="white" opacity="0.82"/>
      </g>
    ))}
    <path d="M18 9c1-3 4-3 5-2-1 3-4 3-5 2z" fill="#5AAB3A" opacity="0.85"/>
    <path d="M18 9c-1-3-4-3-5-2 1 3 4 3 5 2z" fill="#5AAB3A" opacity="0.65"/>
  </svg>
);

const WcPear = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(80,80,0,0.13)"/>
    <path d="M18 10c-3 0-5 2-5 5 0 1 .2 2 .5 3-3 2-5.5 5-5.5 9 0 5.5 4.5 8 10 8s10-2.5 10-8c0-4-2.5-7-5.5-9 .3-1 .5-2 .5-3 0-3-2-5-5-5z" fill="#D4E840" stroke="#A0B010" strokeWidth="1.2"/>
    <path d="M13 20c-2 2-3 5-2.5 8 1-3 3-6 6-8z" fill="#E89050" opacity="0.35"/>
    <path d="M24 22c2 3 2 8-1 11-2 2-5 3-5 3 4 0 8-4 8-9 0-2-.8-4-2-5z" fill="#8A9010" opacity="0.28"/>
    <ellipse cx="14" cy="17" rx="3" ry="2" fill="white" opacity="0.58" transform="rotate(-25 14 17)"/>
    <path d="M18 10c.5-3 2-5 3-6" stroke="#6B4226" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M19.5 6c1.5-2 4-2.5 5-1.5-1 2-4 2.5-5 1.5z" fill="#4A9A3A" opacity="0.85"/>
  </svg>
);

const WcHerb = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <path d="M18 32c0-10 0-18 0-24" stroke="#4A8A28" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M18 28c-4-6-6-10-4-16" stroke="#4A8A28" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M18 26c4-6 6-10 4-16" stroke="#5AA030" strokeWidth="1.2" strokeLinecap="round"/>
    {[{d:"M14 20c-5-1-7-4-6-8 2 3 5 6 6 8z",fill:"#4AAA28"},{d:"M15 15c-4-2-6-5-5-9 2 3 4 6 5 9z",fill:"#5CBB38"},{d:"M14 25c-4-1-6-3-5-7 2 2 4 5 5 7z",fill:"#3A9A20"}].map((l,i)=><path key={i} d={l.d} fill={l.fill} opacity={0.85-i*.05}/>)}
    {[{d:"M22 20c5-1 7-4 6-8-2 3-5 6-6 8z",fill:"#4AAA28"},{d:"M21 15c4-2 6-5 5-9-2 3-4 6-5 9z",fill:"#5CBB38"},{d:"M22 25c4-1 6-3 5-7-2 2-4 5-5 7z",fill:"#3A9A20"}].map((l,i)=><path key={i} d={l.d} fill={l.fill} opacity={0.8-i*.05}/>)}
    <path d="M18 8c-2-3-1-5 0-6 1 1 2 3 0 6z" fill="#68CC40"/>
    <path d="M16 10c-3-2-4-5-2-7 1 2 2 5 2 7z" fill="#5CBB38" opacity="0.85"/>
    <path d="M20 10c3-2 4-5 2-7-1 2-2 5-2 7z" fill="#5CBB38" opacity="0.85"/>
    <ellipse cx="18" cy="33" rx="3" ry="1" fill="rgba(60,80,20,0.20)"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// DAIRY & PROTEINS
// ─────────────────────────────────────────────────────────────────────────────

const WcMilk = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="8" ry="2" fill="rgba(0,0,0,0.10)"/>
    <rect x="9" y="13" width="18" height="19" rx="2" fill="#EAF4FF" stroke="#A0C8F0" strokeWidth="1.2"/>
    <path d="M9 13L14 5h8l5 8z" fill="#D8ECFF" stroke="#A0C8F0" strokeWidth="1"/>
    <path d="M14 5l4 8-4 0z" fill="#C2DCEF" opacity="0.7"/>
    <path d="M22 5l-4 8 4 0z" fill="#B0CDE0" opacity="0.5"/>
    <rect x="11" y="16" width="14" height="10" rx="1.5" fill="#A8D4F5" opacity="0.55"/>
    <path d="M11 22q3.5-3 7 0t7 0" stroke="white" strokeWidth="1.2" fill="none" opacity="0.7"/>
    <rect x="10" y="13" width="2.5" height="19" rx="1" fill="white" opacity="0.40"/>
    <rect x="25" y="14" width="2" height="18" rx="1" fill="#C0D8F0" opacity="0.5"/>
    <circle cx="18" cy="20" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="18" cy="20" r="1.5" fill="#78B8E8" opacity="0.6"/>
  </svg>
);

const WcEgg = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="7" ry="1.8" fill="rgba(0,0,0,0.10)"/>
    <path d="M18 5c-6 0-10 6-10 13 0 8 4.5 14 10 14s10-6 10-14C28 11 24 5 18 5z" fill="#FFF8F0" stroke="#E0C090" strokeWidth="1.2"/>
    <path d="M13 9c-3 3-4 8-3 12 1-4 3-8 6-10-1-.5-2-1.5-3-2z" fill="#FFF0DC" opacity="0.7"/>
    <path d="M24 11c2 3 2.5 8 1 13 2-4 2-10 0-13z" fill="#E8C8A0" opacity="0.30"/>
    <ellipse cx="14" cy="11" rx="3" ry="2.2" fill="white" opacity="0.75" transform="rotate(-20 14 11)"/>
    <ellipse cx="12.5" cy="10" rx="1.3" ry="0.9" fill="white" opacity="0.95" transform="rotate(-20 12.5 10)"/>
  </svg>
);

const WcChicken = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(80,30,0,0.13)"/>
    <rect x="16" y="25" width="4" height="8" rx="2" fill="#F5E8C0" stroke="#C0A870" strokeWidth="1"/>
    <ellipse cx="18" cy="33" rx="3.5" ry="2" fill="#ECD8A8"/>
    <path d="M10 20c0-7 3-12 8-12s8 5 8 12c0 5-2 8-8 8s-8-3-8-8z" fill="#E8A040" stroke="#A06010" strokeWidth="1.2"/>
    <path d="M13 11c-2 3-3 7-2 11 1-4 3-8 5-9-1-.5-2-1.5-3-2z" fill="#F0C060" opacity="0.55"/>
    <path d="M24 18c1 4 0 8-3 10 3-2 4-6 3-10z" fill="#C06A10" opacity="0.30"/>
    <path d="M13 18c2-2 5-2 7 0" stroke="#A04A10" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    <path d="M12 22c2-2 6-2 8 0" stroke="#A04A10" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    <ellipse cx="14" cy="14" rx="3" ry="2" fill="white" opacity="0.38" transform="rotate(-20 14 14)"/>
  </svg>
);

const WcFish = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="17" cy="34" rx="9" ry="2" fill="rgba(0,80,120,0.10)"/>
    <path d="M28 16l5-5-1 5 1 5z" fill="#4A90C8" stroke="#2A60A8" strokeWidth="1"/>
    <ellipse cx="16" cy="18" rx="13" ry="8" fill="#5BA8D8" stroke="#2A70B8" strokeWidth="1.2"/>
    <ellipse cx="16" cy="20" rx="10" ry="5" fill="#A8D4F0" opacity="0.5"/>
    {[[10,15],[14,13],[18,14],[12,18],[16,17],[10,20]].map(([x,y],i)=><path key={i} d={`M${x} ${y}a2 1.5 0 0 1 4 0`} stroke="#3A80B8" strokeWidth="0.6" fill="none" opacity="0.4"/>)}
    <path d="M12 11c2-3 6-4 10-3l-2 4c-3-1-6-1-8-1z" fill="#4A90C8" opacity="0.75"/>
    <circle cx="5" cy="17" r="2.5" fill="#1A3A5A"/>
    <circle cx="5" cy="17" r="1.5" fill="white"/>
    <circle cx="4.5" cy="16.5" r="0.6" fill="#0A1A2A"/>
    <circle cx="4.2" cy="16.2" r="0.25" fill="white"/>
    <ellipse cx="14" cy="14" rx="3.5" ry="2" fill="white" opacity="0.40" transform="rotate(-20 14 14)"/>
  </svg>
);

const WcMeat = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="17" cy="34" rx="10" ry="2" fill="rgba(80,20,0,0.13)"/>
    <path d="M5 22c0-6 4-10 10-11 4-1 8 0 11 3 3 3 3 7 1 10-2 3-6 5-11 5-5 0-11-2-11-7z" fill="#C84040" stroke="#901010" strokeWidth="1.2"/>
    <path d="M10 18c2-1 5 0 7 2-2-1-5-2-7-2z" fill="#F8E0D0" opacity="0.55"/>
    <path d="M15 15c2 0 5 1 6 3-2-1-4-2-6-3z" fill="#F8E0D0" opacity="0.45"/>
    <path d="M8 23c3 0 6 1 8 3-2-1-5-2-8-3z" fill="#F8E0D0" opacity="0.40"/>
    <path d="M8 18c-1 3 0 7 2 9-1-3-1-6 0-9z" fill="#E86060" opacity="0.45"/>
    <path d="M22 18c2 3 1 8-2 11 2-3 2-8 0-11z" fill="#901818" opacity="0.28"/>
    <rect x="22" y="12" width="10" height="5" rx="2.5" fill="#F5EED8"/>
    <ellipse cx="22" cy="14.5" rx="3" ry="3.5" fill="#F0E8CC"/>
    <ellipse cx="32" cy="14.5" rx="3" ry="3.5" fill="#F0E8CC"/>
    <rect x="22" y="13" width="10" height="3" fill="#F8F0E0"/>
    <ellipse cx="22" cy="13" rx="1.5" ry="1" fill="white" opacity="0.50"/>
    <ellipse cx="11" cy="17" rx="3.5" ry="2" fill="white" opacity="0.28" transform="rotate(-20 11 17)"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// BAKERY & PANTRY
// ─────────────────────────────────────────────────────────────────────────────

const WcBread = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="11" ry="2" fill="rgba(100,50,0,0.13)"/>
    <path d="M6 20c0-6 5.4-10 12-10s12 4 12 10v10a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill="#D4892A" stroke="#8B5010" strokeWidth="1.3"/>
    <path d="M8 20c1-5 4-8 10-8s9 3 10 8" fill="#E8A84A"/>
    <path d="M10 18c2-3 5-4 8-4s6 1 8 4" stroke="#B8720A" strokeWidth="0.8" fill="none" opacity="0.5"/>
    <path d="M26 21v9H8v-9c4 3 14 3 18 0z" fill="#B8720A" opacity="0.25"/>
    <ellipse cx="15" cy="15" rx="4" ry="2.5" fill="white" opacity="0.35" transform="rotate(-15 15 15)"/>
    <ellipse cx="13.5" cy="14" rx="1.8" ry="1.1" fill="white" opacity="0.55" transform="rotate(-15 13.5 14)"/>
    {[[16,17],[20,15],[18,19]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="1" ry="0.5" fill="#F0C870" opacity="0.7" transform={`rotate(${i*30} ${x} ${y})`}/>)}
  </svg>
);

const WcCookie = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(80,40,0,0.12)"/>
    <path d="M6 18c0-7 5.4-12 12-12 6.6 0 12 5 12 12 0 7-5.4 12.5-12 12.5S6 25 6 18z" fill="#D4882A" stroke="#8B5010" strokeWidth="1.2"/>
    <path d="M9 11c-2 3-3 7-2 11 1-4 3-7 7-9-2-.5-4-1.5-5-2z" fill="#E8A84A" opacity="0.65"/>
    <path d="M28 13c2 4 1.5 10-1 13-2 3-5 4.5-9 4.5 5 0 9-3.5 10-8 .5-2.5 0-6-2-9.5z" fill="#A06010" opacity="0.28"/>
    {[[14,14],[21,13],[18,20],[12,22],[23,21],[16,28],[22,27]].map(([x,y],i)=>(
      <g key={i}><ellipse cx={x} cy={y} rx="2" ry="1.5" fill="#3A1A08" transform={`rotate(${i*25} ${x} ${y})`}/><ellipse cx={x-.5} cy={y-.5} rx=".7" ry=".5" fill="#6B3A1A" opacity="0.5" transform={`rotate(${i*25} ${x-.5} ${y-.5})`}/></g>
    ))}
    <ellipse cx="13" cy="12" rx="3.5" ry="2" fill="white" opacity="0.30" transform="rotate(-20 13 12)"/>
    <ellipse cx="11.5" cy="11" rx="1.5" ry="1" fill="white" opacity="0.55" transform="rotate(-20 11.5 11)"/>
  </svg>
);

const WcJar = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(100,60,0,0.12)"/>
    <rect x="11" y="9" width="14" height="5" rx="2.5" fill="#C8A030" stroke="#8B6810" strokeWidth="1.2"/>
    <ellipse cx="18" cy="9" rx="7" ry="2" fill="#D8B040" stroke="#8B6810" strokeWidth="1"/>
    <path d="M12 14h12l-1 17a2 2 0 01-2 2H15a2 2 0 01-2-2z" fill="#FFF8E8" stroke="#D0B870" strokeWidth="1.1"/>
    <path d="M13 18h10l-1 12H14z" fill="#F5C840" opacity="0.65"/>
    <rect x="13.5" y="15" width="2.5" height="15" rx="1.2" fill="white" opacity="0.40"/>
    <path d="M18 22l2-1.5v3L18 25l-2-1.5v-3z" stroke="#E0A020" strokeWidth="0.7" fill="none" opacity="0.5"/>
  </svg>
);

const WcSalt = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.08)"/>
    <path d="M12 15l-1 16a2 2 0 002 2h10a2 2 0 002-2l-1-16z" fill="#F5F5F0" stroke="#C8C8C0" strokeWidth="1.1"/>
    <path d="M23 16l-1 15h1l1-15z" fill="#D8D8D0" opacity="0.5"/>
    <rect x="12.5" y="16" width="2.5" height="14" rx="1.2" fill="white" opacity="0.7"/>
    <rect x="14" y="10" width="8" height="6" rx="2" fill="#E8E8E0" stroke="#C0C0B8" strokeWidth="1"/>
    <rect x="15" y="7" width="6" height="5" rx="2" fill="#C0C0B8" stroke="#A0A0A0" strokeWidth="0.8"/>
    <ellipse cx="18" cy="7" rx="3" ry="1.2" fill="#D0D0C8"/>
    {[[16,9],[18,8],[20,9]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r=".55" fill="#888880" opacity="0.6"/>)}
    <rect x="12" y="20" width="12" height="6" rx="1" fill="#E0E8FF" opacity="0.5"/>
    {[[15,23],[18,25],[21,22],[17,21]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r=".8" fill="white" opacity="0.8"/>)}
  </svg>
);

const WcBeans = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(40,10,0,0.13)"/>
    {[{cx:12,cy:20,rx:6,ry:4,rot:-30},{cx:22,cy:18,rx:6,ry:4,rot:20},{cx:18,cy:27,rx:6,ry:4,rot:5},{cx:10,cy:28,rx:5.5,ry:3.5,rot:-15},{cx:25,cy:26,rx:5.5,ry:3.5,rot:35}].map((b,i)=>(
      <g key={i} transform={`rotate(${b.rot} ${b.cx} ${b.cy})`}>
        <ellipse cx={b.cx} cy={b.cy} rx={b.rx} ry={b.ry} fill="#5C1A0A" stroke="#3A0A04" strokeWidth="0.8"/>
        <path d={`M${b.cx-b.rx*.5} ${b.cy}q${b.rx*.1}-${b.ry*.6} ${b.rx*.6} 0`} stroke="#8B3A20" strokeWidth="0.8" fill="none" opacity="0.6"/>
        <ellipse cx={b.cx-b.rx*.25} cy={b.cy-b.ry*.3} rx={b.rx*.35} ry={b.ry*.28} fill="white" opacity="0.28"/>
      </g>
    ))}
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// BEVERAGES
// ─────────────────────────────────────────────────────────────────────────────

const WcCoffee = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(0,0,0,0.10)"/>
    <ellipse cx="18" cy="32" rx="10" ry="2.5" fill="#D4B896" stroke="#A08060" strokeWidth="1"/>
    <path d="M9 17l2 12h14l2-12z" fill="#C8A070" stroke="#8B6030" strokeWidth="1.2"/>
    <ellipse cx="18" cy="17" rx="9" ry="3" fill="#B08050" stroke="#7A5020" strokeWidth="1.1"/>
    <ellipse cx="18" cy="17" rx="7.5" ry="2.5" fill="#4A2810"/>
    <ellipse cx="16" cy="16.5" rx="3" ry="1.5" fill="#C8A070" opacity="0.55" transform="rotate(-10 16 16.5)"/>
    <ellipse cx="20" cy="17.5" rx="1.8" ry="1" fill="#C8A070" opacity="0.40"/>
    <path d="M27 19c2 0 3 1.5 3 3s-1 3-3 3" stroke="#C8A070" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M14 13c0-2 1-3 0-5" stroke="#B0A898" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    <path d="M18 12c0-2 1-2.5 0-4.5" stroke="#B0A898" strokeWidth="1.1" strokeLinecap="round" opacity="0.45"/>
    <path d="M22 13c0-2 1-3 0-5" stroke="#B0A898" strokeWidth="1.1" strokeLinecap="round" opacity="0.40"/>
    <path d="M10 19l1 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
  </svg>
);

const WcLatte = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="11" ry="2" fill="rgba(0,0,0,0.10)"/>
    <ellipse cx="18" cy="33" rx="11" ry="2.5" fill="#D4B896" stroke="#A08060" strokeWidth="1"/>
    <path d="M8 20l2 11h16l2-11z" fill="#CC3020" stroke="#8A1A10" strokeWidth="1.4"/>
    <path d="M9 20l1 9h4l-2-9z" fill="#E84030" opacity="0.4"/>
    <ellipse cx="18" cy="20" rx="10" ry="3.5" fill="#AA2818" stroke="#6A1008" strokeWidth="1.3"/>
    <ellipse cx="18" cy="20" rx="8.5" ry="2.8" fill="#3A1A08"/>
    <ellipse cx="18" cy="18" rx="8" ry="5" fill="white" stroke="#D8D0C0" strokeWidth="0.9"/>
    <ellipse cx="18" cy="16" rx="6" ry="4" fill="white"/>
    <ellipse cx="18" cy="14" rx="4.5" ry="3" fill="white"/>
    <ellipse cx="18" cy="12" rx="3" ry="2.2" fill="white"/>
    <ellipse cx="18" cy="10.5" rx="2" ry="1.5" fill="white" stroke="#D8D0C0" strokeWidth="0.7"/>
    <path d="M14 17 q2-1 4 0 q2 1 3-1" stroke="#A05020" strokeWidth="1.1" fill="none" strokeLinecap="round"/>
    {[[16,15],[20,14],[18,19],[22,18]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.6" fill="#6B3010" opacity="0.7"/>)}
    <path d="M28 22c3 0 4.5 2 4.5 4s-1.5 4-4.5 4" stroke="#AA2818" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <ellipse cx="15" cy="11" rx="2" ry="1.2" fill="white" opacity="0.9"/>
  </svg>
);

const WcJuiceGlass = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(120,60,0,0.12)"/>
    <path d="M10 12l2 19a2 2 0 002 2h8a2 2 0 002-2l2-19z" fill="#FFF8F0" stroke="#E8D8C0" strokeWidth="1.1"/>
    <path d="M11 18l1.5 15a2 2 0 002 2h7a2 2 0 002-2L25 18z" fill="#F5A020" opacity="0.80"/>
    <ellipse cx="18" cy="18" rx="7" ry="2" fill="#FFC040" opacity="0.75"/>
    {[150,180,210].map(a=>{const r=(a*Math.PI)/180;return <line key={a} x1="18" y1="18" x2={18+5*Math.cos(r)} y2={18+2*Math.sin(r)} stroke="#E88020" strokeWidth="0.6" opacity="0.6"/>;} )}
    <ellipse cx="18" cy="12" rx="8" ry="2.5" fill="#F0E8D8" stroke="#D8C8A8" strokeWidth="0.8"/>
    <rect x="11" y="13" width="2" height="17" rx="1" fill="white" opacity="0.35"/>
    <rect x="23" y="6" width="2" height="16" rx="1" fill="#F06020" opacity="0.8"/>
    <rect x="23" y="6" width="1" height="16" rx="0.5" fill="#FFB060" opacity="0.5"/>
    {[[15,16,1.2],[19,15.5,1],[22,16.5,0.9]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.7-i*.1}/>)}
  </svg>
);

const WcWaterBottle = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="7" ry="2" fill="rgba(0,60,120,0.10)"/>
    <path d="M12 16l-1 15a2 2 0 002 2h10a2 2 0 002-2l-1-15z" fill="#D0EEFF" stroke="#80B8E8" strokeWidth="1.1"/>
    <path d="M12.5 22l-.5 9a2 2 0 002 2h8a2 2 0 002-2l-.5-9z" fill="#80C8F8" opacity="0.65"/>
    <path d="M12.5 22q2.5 2 5.5 0t5.5 0" stroke="#50A8E0" strokeWidth="0.8" fill="none" opacity="0.7"/>
    <rect x="14" y="10" width="8" height="7" rx="2" fill="#C0DEFF" stroke="#80B8E8" strokeWidth="1"/>
    <rect x="15" y="7" width="6" height="5" rx="2" fill="#2090D8" stroke="#1070B0" strokeWidth="0.9"/>
    <ellipse cx="18" cy="7" rx="3" ry="1.2" fill="#40A8F0"/>
    <rect x="12" y="18" width="12" height="5" rx="1.5" fill="white" opacity="0.6"/>
    <path d="M13.5 20.5h9" stroke="#90C0E8" strokeWidth="0.7" opacity="0.7"/>
    <rect x="13" y="16.5" width="2" height="15" rx="1" fill="white" opacity="0.40"/>
    {[[17,26,.8],[20,28,.6],[15,29,.7]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.6-i*.1}/>)}
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// NEW — COZY FOOD ICONS (from reference image: autumn warm foods)
// ─────────────────────────────────────────────────────────────────────────────

const WcSoup = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2.2" fill="rgba(100,50,0,0.14)"/>
    <path d="M6 17c0 7 5.4 14 12 14s12-7 12-14z" fill="#8B4A1A" stroke="#5C2A08" strokeWidth="1.4" strokeLinejoin="round"/>
    <ellipse cx="18" cy="17" rx="12" ry="4" fill="#A05A28" stroke="#5C2A08" strokeWidth="1.4"/>
    <ellipse cx="18" cy="17" rx="10" ry="3" fill="#C4711A"/>
    <circle cx="13" cy="16.5" r="2.2" fill="#E8932A" stroke="#B05010" strokeWidth="0.8"/>
    <circle cx="21" cy="17" r="1.8" fill="#D44A1A" stroke="#A02808" strokeWidth="0.7"/>
    <circle cx="17" cy="15.5" r="1.5" fill="#5A9A30" stroke="#3A6A18" strokeWidth="0.7"/>
    <circle cx="23" cy="15.8" r="1.3" fill="#E8C030" stroke="#A88010" strokeWidth="0.6"/>
    <path d="M14 12q1-2 0-4" stroke="#C0B0A0" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7"/>
    <path d="M18 11q1-2.5 0-5" stroke="#C0B0A0" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.6"/>
    <path d="M22 12q1-2 0-4" stroke="#C0B0A0" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.55"/>
    <ellipse cx="12" cy="16" rx="2.5" ry="1.2" fill="white" opacity="0.25" transform="rotate(-15 12 16)"/>
  </svg>
);

const WcMushroom = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="1.8" fill="rgba(80,40,0,0.12)"/>
    <rect x="9" y="22" width="6" height="10" rx="3" fill="#EDE0C0" stroke="#B0A070" strokeWidth="1.2"/>
    <path d="M7 22c0-6 4-9 8-9s8 3 8 9z" fill="#6B3A1A" stroke="#3A1A08" strokeWidth="1.4"/>
    <path d="M9 22c1-5 3-8 7-8 1 0 2 .2 3 .5-3-1-7 2-8 7.5z" fill="#8B5A30" opacity="0.6"/>
    <ellipse cx="12" cy="14.5" rx="2.8" ry="1.5" fill="white" opacity="0.30" transform="rotate(-20 12 14.5)"/>
    <rect x="20" y="24" width="5" height="8" rx="2.5" fill="#EDE0C0" stroke="#B0A070" strokeWidth="1.1"/>
    <path d="M18 24c0-5 3-7.5 6.5-7.5S31 19 31 24z" fill="#5A3010" stroke="#2A1008" strokeWidth="1.3"/>
    <path d="M20 24c1-4 2-6.5 4.5-6.5l1 .2c-2.5-.5-5 2-5.5 6.3z" fill="#7A4A20" opacity="0.5"/>
    <ellipse cx="22" cy="17.5" rx="2.2" ry="1.2" fill="white" opacity="0.25" transform="rotate(-15 22 17.5)"/>
    <circle cx="11" cy="18" r="1" fill="#C8A070" opacity="0.7"/>
    <circle cx="14" cy="20" r="0.8" fill="#C8A070" opacity="0.6"/>
    <circle cx="24" cy="20" r="0.9" fill="#C8A070" opacity="0.6"/>
  </svg>
);

const WcPie = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="11" ry="2" fill="rgba(120,60,0,0.14)"/>
    <path d="M5 22h26v7a3 3 0 01-3 3H8a3 3 0 01-3-3z" fill="#D4892A" stroke="#8B5010" strokeWidth="1.3"/>
    <path d="M6 22h24v5a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill="#E8B040"/>
    <ellipse cx="18" cy="22" rx="13" ry="4.5" fill="#C8782A" stroke="#7A4008" strokeWidth="1.4"/>
    {[-6,-3,0,3,6].map((x,i)=><line key={i} x1={18+x} y1="18" x2={18+x} y2="26" stroke="#A05A18" strokeWidth="0.9" opacity="0.6"/>)}
    {[-2,1,4].map((y,i)=><line key={i} x1="7" y1={22+y} x2="29" y2={22+y} stroke="#A05A18" strokeWidth="0.9" opacity="0.5"/>)}
    <path d="M18 22c0 0-3-3-2-7 1-4 4-5 4-5s3 1 4 5c1 4-2 7-2 7" fill="white" stroke="#D0C8B8" strokeWidth="0.8"/>
    <ellipse cx="18" cy="18" rx="4" ry="6" fill="white" stroke="#D0C8B8" strokeWidth="1"/>
    <ellipse cx="18" cy="16" rx="3" ry="4" fill="white"/>
    <path d="M16 14 q2-3 4 0 q-1 2-2 2 q-1 0-2-2z" fill="white" stroke="#D0C8B8" strokeWidth="0.7"/>
    <ellipse cx="16.5" cy="17" rx="1.5" ry="2.5" fill="white" opacity="0.8"/>
    <circle cx="18" cy="9.5" r="2.5" fill="#FF7A30" stroke="#C04A10" strokeWidth="0.9"/>
    <path d="M16.5 7.5 q1.5-1.5 3 0" fill="#5A9A30" stroke="#3A6A18" strokeWidth="0.7"/>
  </svg>
);

const WcSandwich = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="12" ry="1.8" fill="rgba(100,60,0,0.13)"/>
    <path d="M5 28h26l-1 4a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill="#E8C060" stroke="#A08020" strokeWidth="1.3"/>
    <path d="M5 27q2-2 4 0t4 0t4 0t4 0t4 0t4 0" fill="#5AAB30" stroke="#3A7A18" strokeWidth="1.1" strokeLinecap="round"/>
    <rect x="6" y="23" width="24" height="4" rx="1" fill="#F5D030" stroke="#B09010" strokeWidth="1"/>
    <path d="M7 23l2 2M13 23l2 2M19 23l2 2M25 23l2 2" stroke="#D4A800" strokeWidth="0.6" opacity="0.6"/>
    <path d="M6 20h24v3H6z" fill="#D93020" stroke="#901808" strokeWidth="1" rx="1"/>
    <path d="M5 20c0-6 6-10 13-10s13 4 13 10z" fill="#E8C060" stroke="#A08020" strokeWidth="1.4"/>
    <path d="M7 20c1-5 4-8 11-8 2 0 4 .3 6 .9-4-2-11-.5-14 7.1z" fill="#F0D880" opacity="0.55"/>
    <line x1="18" y1="4" x2="18" y2="22" stroke="#8B6020" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="18" cy="4" r="2" fill="#E83030" stroke="#901010" strokeWidth="0.8"/>
    <ellipse cx="13" cy="12" rx="3.5" ry="2" fill="white" opacity="0.30" transform="rotate(-20 13 12)"/>
  </svg>
);

const WcApplePie = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="12" ry="2" fill="rgba(120,60,0,0.14)"/>
    <ellipse cx="18" cy="30" rx="13" ry="4" fill="#E8D0A0" stroke="#B09060" strokeWidth="1.3"/>
    <path d="M5 20v10c0 2 6 4 13 4s13-2 13-4V20z" fill="#D4892A" stroke="#8B5010" strokeWidth="1.2"/>
    <ellipse cx="18" cy="20" rx="13" ry="5" fill="#C8782A" stroke="#7A4008" strokeWidth="1.4"/>
    {[-7,-4,-1,2,5,8].map((x,i)=><line key={`v${i}`} x1={18+x} y1="16" x2={18+x} y2="25" stroke="#A05A18" strokeWidth="1" strokeLinecap="round" opacity="0.55"/>)}
    {[0,2,4].map((y,i)=><line key={`h${i}`} x1="7" y1={19+y} x2="29" y2={19+y} stroke="#A05A18" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>)}
    <ellipse cx="18" cy="20" rx="11" ry="3.5" fill="#F5C040" opacity="0.3"/>
    <ellipse cx="13" cy="18" rx="3.5" ry="1.8" fill="white" opacity="0.25" transform="rotate(-15 13 18)"/>
    <ellipse cx="18" cy="20" rx="1" ry="0.5" fill="#8B4A10" opacity="0.7"/>
    <ellipse cx="14" cy="21" rx="0.8" ry="0.4" fill="#8B4A10" opacity="0.6"/>
    <ellipse cx="22" cy="20.5" rx="0.8" ry="0.4" fill="#8B4A10" opacity="0.6"/>
  </svg>
);

const WcHotCider = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="7" ry="1.8" fill="rgba(120,60,0,0.14)"/>
    <path d="M11 8h14l-2 18H13z" fill="#E8921A" stroke="#A05810" strokeWidth="1.3"/>
    <path d="M11 8 q7-2 14 0" fill="#F5B040" opacity="0.5"/>
    <rect x="15" y="26" width="6" height="5" rx="1.5" fill="#D8A060" stroke="#A07030" strokeWidth="1.1"/>
    <ellipse cx="18" cy="31" rx="7" ry="2.5" fill="#C89050" stroke="#A07030" strokeWidth="1.1"/>
    <ellipse cx="18" cy="9" rx="7" ry="2.5" fill="#D06A10"/>
    <rect x="21" y="3" width="2.5" height="12" rx="1.2" fill="#8B4A1A" stroke="#5C2A08" strokeWidth="0.9" transform="rotate(12 22 9)"/>
    <rect x="23" y="2" width="2" height="11" rx="1" fill="#A05A20" stroke="#5C2A08" strokeWidth="0.8" transform="rotate(18 24 8)"/>
    <path d="M13 9l-2 16h4z" fill="#F5A820" opacity="0.3"/>
    <ellipse cx="14" cy="12" rx="2.5" ry="4" fill="white" opacity="0.22" transform="rotate(-10 14 12)"/>
    <circle cx="16" cy="9.5" r="1.2" fill="#F5C840" opacity="0.6"/>
    <circle cx="20" cy="9" r="0.9" fill="#F5C840" opacity="0.5"/>
    <path d="M15 5 q1-2 0-4" stroke="#C0A880" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.6"/>
    <path d="M21 4 q1-2 0-3.5" stroke="#C0A880" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5"/>
  </svg>
);

const WcJuicePitcher = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="17" cy="34.5" rx="9" ry="1.8" fill="rgba(200,100,0,0.13)"/>
    <path d="M9 10q-1 8 0 18c0 4 3.5 6 8 6s8-2 8-6q1-10 0-18z" fill="#F5C030" stroke="#C09010" strokeWidth="1.4"/>
    <path d="M9 10c0-2 2-4 8-4s8 2 8 4" fill="#F5D860" stroke="#C09010" strokeWidth="1.3"/>
    <ellipse cx="17" cy="10" rx="8" ry="3" fill="#F5D860" stroke="#C09010" strokeWidth="1.2"/>
    <ellipse cx="17" cy="7.5" rx="4" ry="1.5" fill="#C89050" stroke="#8B5020" strokeWidth="1"/>
    <rect x="15" y="4" width="4" height="4" rx="1.5" fill="#D4A060" stroke="#8B5020" strokeWidth="1"/>
    <path d="M25 14c4 0 5 3 5 6s-1 6-5 6" stroke="#C09010" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    <path d="M10 11q7-1.5 14 0" fill="#F5A820" opacity="0.4"/>
    <ellipse cx="12" cy="20" rx="2" ry="7" fill="white" opacity="0.22" transform="rotate(-5 12 20)"/>
    <ellipse cx="12" cy="14" rx="1.5" ry="3" fill="white" opacity="0.45"/>
    {[[16,18],[19,22],[15,26],[20,15]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="0.8" ry="0.4" fill="#C07010" opacity="0.5" transform={`rotate(${i*30} ${x} ${y})`}/>)}
    <rect x="19" y="2" width="2" height="16" rx="1" fill="white" stroke="#E8A090" strokeWidth="0.8"/>
    <path d="M19 3 l8-1" stroke="#E84040" strokeWidth="1" strokeLinecap="round"/>
    <path d="M19 5 l8-1" stroke="#E84040" strokeWidth="1" strokeLinecap="round"/>
    <path d="M19 7 l8-1" stroke="#E84040" strokeWidth="1" strokeLinecap="round"/>
  </svg>
);

const WcTeaGlass = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="16" cy="34.5" rx="9" ry="1.8" fill="rgba(80,40,0,0.12)"/>
    <path d="M7 9h18l-2 23a2 2 0 01-2 2H11a2 2 0 01-2-2z" fill="#C87820" stroke="#8B5010" strokeWidth="1.3"/>
    <path d="M8 10h16l-1.5 21H9.5z" fill="#E8A020" opacity="0.7"/>
    <ellipse cx="16" cy="9.5" rx="9" ry="3" fill="#D4902A" stroke="#8B5010" strokeWidth="1.2"/>
    <ellipse cx="9.5" cy="20" rx="2" ry="8" fill="white" opacity="0.22" transform="rotate(-5 9.5 20)"/>
    <ellipse cx="9" cy="14" rx="1.5" ry="3.5" fill="white" opacity="0.40"/>
    {[[14,26],[18,30]].map(([x,y],fi)=>(
      <g key={fi}>
        {[0,45,90,135].map(angle=>{const rad=angle*Math.PI/180;return <ellipse key={angle} cx={x+2.5*Math.cos(rad)} cy={y+2.5*Math.sin(rad)} rx="1.2" ry="0.7" fill="white" stroke="#D0C8A0" strokeWidth="0.5" transform={`rotate(${angle} ${x+2.5*Math.cos(rad)} ${y+2.5*Math.sin(rad)})`}/>;} )}
        <circle cx={x} cy={y} r="1.2" fill="#F5D030" stroke="#C0A010" strokeWidth="0.5"/>
      </g>
    ))}
    <path d="M10 11 q6-1 12 0" fill="#F5C040" opacity="0.5"/>
  </svg>
);

const WcCasserole = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="13" ry="2" fill="rgba(100,60,0,0.13)"/>
    <path d="M4 22h28v6a3 3 0 01-3 3H7a3 3 0 01-3-3z" fill="#F0D890" stroke="#C0A830" strokeWidth="1.3"/>
    <ellipse cx="18" cy="22" rx="14" ry="4.5" fill="#D4A830" stroke="#9A7818" strokeWidth="1.4"/>
    <path d="M6 22q3-2 6 0t6 0t6 0t6 0" stroke="#B08820" strokeWidth="0.9" fill="none" opacity="0.6"/>
    <path d="M7 20q3-1 5 0t5 0t5 0t6 0" stroke="#B08820" strokeWidth="0.8" fill="none" opacity="0.5"/>
    <circle cx="12" cy="22" r="2" fill="#C04020" stroke="#8A2010" strokeWidth="0.8" opacity="0.8"/>
    <circle cx="18" cy="21.5" r="1.8" fill="#5A9020" stroke="#3A6010" strokeWidth="0.7" opacity="0.8"/>
    <circle cx="24" cy="22" r="1.5" fill="#C8A030" stroke="#907010" strokeWidth="0.7" opacity="0.8"/>
    <path d="M4 24c-2 0-3.5 1-3.5 2s1.5 2 3.5 2" stroke="#C0A830" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <path d="M32 24c2 0 3.5 1 3.5 2s-1.5 2-3.5 2" stroke="#C0A830" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <ellipse cx="11" cy="21" rx="3" ry="1.2" fill="white" opacity="0.25" transform="rotate(-15 11 21)"/>
  </svg>
);

const WcHoneyBottle = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="15" cy="34.5" rx="8" ry="1.8" fill="rgba(150,80,0,0.13)"/>
    <path d="M8 18q-1 6 0 12c0 3 3 5 7 5s7-2 7-5q1-6 0-12z" fill="#F5A020" stroke="#C07010" strokeWidth="1.4"/>
    <path d="M8 18c0-3 1.5-5 7-5s7 2 7 5" fill="#F5C040" stroke="#C07010" strokeWidth="1.2"/>
    <ellipse cx="15" cy="18" rx="7" ry="2.5" fill="#F5C040" stroke="#C07010" strokeWidth="1.1"/>
    <rect x="12" y="9" width="6" height="10" rx="2" fill="#F0B830" stroke="#C07010" strokeWidth="1.1"/>
    <rect x="13" y="6" width="4" height="4.5" rx="1.5" fill="#C89050" stroke="#8B5A20" strokeWidth="1"/>
    <ellipse cx="15" cy="6" rx="2.5" ry="1.2" fill="#D4A060" stroke="#8B5A20" strokeWidth="0.9"/>
    <path d="M9 19q6-1 12 0" fill="#F5C840" opacity="0.5"/>
    <ellipse cx="15" cy="26" rx="5" ry="3" fill="#E89020" opacity="0.35"/>
    <ellipse cx="10" cy="24" rx="1.8" ry="5" fill="white" opacity="0.28" transform="rotate(-8 10 24)"/>
    <ellipse cx="10" cy="19" rx="1.5" ry="2.5" fill="white" opacity="0.40"/>
    <path d="M24 24l1 8h5l1-8z" fill="#F5E8D0" stroke="#D0B890" strokeWidth="1"/>
    <ellipse cx="27" cy="24" rx="3" ry="1.2" fill="#E8D8B0" stroke="#D0B890" strokeWidth="0.9"/>
    <ellipse cx="27" cy="24.5" rx="2.2" ry="0.8" fill="#F5C030" opacity="0.7"/>
    <path d="M25.5 25 q1.5-1 3 0" fill="#F5D020" stroke="#C0A010" strokeWidth="0.6" opacity="0.8"/>
  </svg>
);

const WcCheesecake = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="12" ry="2" fill="rgba(120,80,0,0.13)"/>
    <path d="M5 30h26v3a2 2 0 01-2 2H7a2 2 0 01-2-2z" fill="#C8892A" stroke="#8B5A10" strokeWidth="1.2"/>
    <path d="M5 14l13-10 13 10v16H5z" fill="#F5E8C0" stroke="#C0A050" strokeWidth="1.4"/>
    <path d="M6 14l12-9 1 1-11 8z" fill="white" opacity="0.35"/>
    <path d="M8 16 q5 2 10 0 q3 2 8 0" stroke="#E83020" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
    <path d="M7 20 q5 3 11 1 q4 2 9 0" stroke="#E83020" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.7"/>
    <path d="M6 24 q6 2 12 0 q4 2 9 1" stroke="#D42810" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.6"/>
    <ellipse cx="11" cy="18" rx="3.5" ry="6" fill="white" opacity="0.25" transform="rotate(-5 11 18)"/>
    <ellipse cx="18" cy="14" rx="8" ry="1.5" fill="white" opacity="0.40"/>
  </svg>
);

const WcEggnog = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="10" ry="1.8" fill="rgba(0,0,0,0.10)"/>
    <path d="M8 14l2 18h16l2-18z" fill="#F5E8C0" stroke="#D0B880" strokeWidth="1.3"/>
    <ellipse cx="18" cy="14.5" rx="10" ry="3" fill="#E8D090" stroke="#C0A050" strokeWidth="1.2"/>
    <path d="M9 15 q9-1.5 18 0" fill="#F5ECD0" opacity="0.6"/>
    <path d="M10 13 q4-3 8 0 q4-3 8 0" fill="white" stroke="#E8E0D0" strokeWidth="0.8" opacity="0.9"/>
    <path d="M11 12 q3.5-2 7 0 q3.5-2 7 0" fill="white" opacity="0.7"/>
    <rect x="21" y="6" width="2.5" height="13" rx="1.2" fill="#8B4A1A" stroke="#5C2A08" strokeWidth="0.9" transform="rotate(15 22 12)"/>
    <line x1="21.5" y1="7" x2="23.5" y2="18" stroke="#6B3010" strokeWidth="0.5" opacity="0.6" strokeLinecap="round"/>
    {[[14,18],[17,22],[21,19],[15,25]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1" fill="white" opacity={0.5-i*0.07}/>)}
    <ellipse cx="11" cy="20" rx="2" ry="6" fill="white" opacity="0.25" transform="rotate(-5 11 20)"/>
    <ellipse cx="11" cy="15" rx="1.8" ry="2.5" fill="white" opacity="0.45"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// HYGIENE & CLEANING
// ─────────────────────────────────────────────────────────────────────────────

const WcSoap = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="7" ry="2" fill="rgba(200,100,200,0.12)"/>
    <rect x="11" y="12" width="14" height="20" rx="3" fill="#E8A0D8" stroke="#C060B0" strokeWidth="1.2"/>
    <rect x="15" y="7" width="6" height="7" rx="2" fill="#D070C0" stroke="#A040A0" strokeWidth="1"/>
    <rect x="17" y="4" width="2" height="5" rx="1" fill="#C050A8" stroke="#8030A0" strokeWidth="0.9"/>
    <ellipse cx="18" cy="4" rx="2.5" ry="1.5" fill="#A040A0"/>
    <rect x="13" y="17" width="10" height="8" rx="2" fill="white" opacity="0.55"/>
    <rect x="12" y="13" width="2.5" height="18" rx="1.2" fill="white" opacity="0.35"/>
    {[[22,9,1.5],[24,13,1],[23,7,1]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} fill="white" opacity={0.65-i*.1}/>)}
  </svg>
);

const WcToiletPaper = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(0,0,0,0.08)"/>
    <ellipse cx="18" cy="20" rx="12" ry="13" fill="#F8F5EE" stroke="#D8D0C8" strokeWidth="1.2"/>
    <path d="M28 16c1 4 0 9-3 12 2-3 3-8 2-12z" fill="#DDD8CE" opacity="0.4"/>
    <ellipse cx="18" cy="20" rx="5" ry="5.5" fill="#EDE8DF"/>
    <ellipse cx="18" cy="20" rx="3.5" ry="4" fill="#D8D2C8" opacity="0.7"/>
    {[13,17,21,25,29].map((y,i)=><path key={i} d={`M${7+i*.3} ${y}q5.5 1.5 ${(11-i*.3)*2} 0`} stroke="#E0D8CC" strokeWidth="0.7" fill="none" opacity="0.6"/>)}
    {[[12,15],[18,13],[24,16],[10,21],[26,22],[14,27],[22,28]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r=".6" fill="#D0C8BC" opacity="0.5"/>)}
    <ellipse cx="12" cy="12" rx="2.5" ry="1.5" fill="white" opacity="0.40" transform="rotate(-25 12 12)"/>
    <path d="M18 33c0 1.5-1.5 2-1.5 0l1.5-3 1.5 3c0 2-1.5 1.5-1.5 0z" fill="#F8F5EE" stroke="#E0D8CC" strokeWidth="0.5"/>
  </svg>
);

const WcBroom = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <line x1="24" y1="4" x2="12" y2="28" stroke="#B0895A" strokeWidth="2.8" strokeLinecap="round"/>
    <path d="M7 26c1-2 3-3 6-1l-1 5c-3 1-5 0-5-2z" fill="#78C8E8" stroke="#3090B0" strokeWidth="1.1"/>
    <path d="M11 24c2-1 4-.5 5 1l-2 5c-2 0-3-1-3-2z" fill="#50B8DC" stroke="#3090B0" strokeWidth="1"/>
    <path d="M14 25c2 0 4 1 4.5 3l-2 4c-2 0-3-1-3-3z" fill="#78C8E8" stroke="#3090B0" strokeWidth="1"/>
    {[8,11,14,17].map(x=><line key={x} x1={x} y1="27" x2={x-1} y2="32" stroke="#3090B0" strokeWidth="1.1" strokeLinecap="round" opacity="0.5"/>)}
  </svg>
);


// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED ICON SET — Dairy, Produce, Pantry, Beverages, Hygiene
// ─────────────────────────────────────────────────────────────────────────────

const WcCheese = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="19" cy="34" rx="12" ry="2" fill="rgba(120,80,0,0.13)"/>
    <path d="M4 16L18 7l14 9v14a2 2 0 01-2 2H6a2 2 0 01-2-2z" fill="#F5D04A" stroke="#C09010" strokeWidth="1.3"/>
    <path d="M4 16L18 7l14 9" fill="#F0C030" stroke="#C09010" strokeWidth="1.1"/>
    <path d="M28 16v14a1 1 0 01-1 1h3a2 2 0 002-2V16z" fill="#C09010" opacity="0.22"/>
    {[[11,22,3.2],[19,26,2.6],[15,30,2]].map(([cx,cy,r],i)=>(
      <circle key={i} cx={cx} cy={cy} r={r} fill="#E0A820" opacity="0.65" stroke="#C09010" strokeWidth="0.6"/>
    ))}
    <ellipse cx="10" cy="17" rx="3.5" ry="2" fill="white" opacity="0.35" transform="rotate(-15 10 17)"/>
    <ellipse cx="8.5" cy="16" rx="1.5" ry="1" fill="white" opacity="0.55" transform="rotate(-15 8.5 16)"/>
  </svg>
);

const WcButter = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="12" ry="2" fill="rgba(120,100,0,0.12)"/>
    <path d="M6 20h24v8a2 2 0 01-2 2H8a2 2 0 01-2-2z" fill="#F5D87A" stroke="#C0A020" strokeWidth="1.2"/>
    <path d="M6 13h24v8H6z" fill="#FFEE88" stroke="#C0A020" strokeWidth="1.2"/>
    <path d="M6 13v8l-2 2V15z" fill="#E8D060" opacity="0.55"/>
    <path d="M6 13l2-6h20l2 6z" fill="#E8E8D0" stroke="#C0C090" strokeWidth="1"/>
    <path d="M10 13l-1-4M18 13v-5M26 13l1-4" stroke="#B0B080" strokeWidth="0.7" strokeLinecap="round" opacity="0.55"/>
    <rect x="7.5" y="14" width="3" height="7" rx="1.5" fill="white" opacity="0.28"/>
    <rect x="7.5" y="14" width="3" height="3" rx="1" fill="white" opacity="0.48"/>
  </svg>
);

const WcYogurt = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="9" ry="1.8" fill="rgba(0,0,0,0.10)"/>
    <path d="M10 13l2 19a2 2 0 002 2h8a2 2 0 002-2l2-19z" fill="#FFF8F5" stroke="#E0C8C0" strokeWidth="1.2"/>
    <path d="M11.5 14l1.5 17h10l1.5-17z" fill="#F0E8E0" opacity="0.45"/>
    <ellipse cx="18" cy="13" rx="8" ry="2.5" fill="#F8F5F0" stroke="#D8C8C0" strokeWidth="1.2"/>
    <path d="M24 11 q2-1 4 1l-1 2-4-1z" fill="#E8D8D0" stroke="#C0B0A8" strokeWidth="0.8"/>
    <path d="M13 12.5 q5-2 10 0" stroke="#F08080" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.65"/>
    <ellipse cx="18" cy="12.5" rx="2.5" ry="1.5" fill="#FF8080" opacity="0.50"/>
    <rect x="11.5" y="15" width="2.5" height="15" rx="1.2" fill="white" opacity="0.33"/>
    <rect x="12" y="15" width="2" height="5" rx="1" fill="white" opacity="0.48"/>
  </svg>
);

const WcPineapple = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="8" ry="1.8" fill="rgba(120,80,0,0.12)"/>
    <path d="M10 16c0-7 4-11 8-11s8 4 8 11c0 8-3 13-8 13s-8-5-8-13z" fill="#F5C030" stroke="#C08010" strokeWidth="1.2"/>
    {[[14,15],[18,14],[22,15],[12,19],[16,18],[20,18],[24,19],[13,23],[17,22],[21,22],[25,23],[15,27],[19,27]].map(([cx,cy],i)=>(
      <path key={i} d={`M${cx-1.5} ${cy} l1.5-2 1.5 2-1.5 2z`} fill="#C08010" opacity="0.20" stroke="#C08010" strokeWidth="0.3"/>
    ))}
    <path d="M23 16c1 4 1 9-1 13-2 3-3 4-3 4 4-2 6-7 6-13 0-2-.8-3-2-4z" fill="#C08010" opacity="0.22"/>
    <path d="M12 19c0-5 2-8 4-9" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.32"/>
    {[
      {d:"M18 5c-1-3-3-4-2-6 1 2 3 3 2 6z",f:"#3A9028"},
      {d:"M18 5c1-3 3-4 2-6-1 2-3 3-2 6z",f:"#4AAA30"},
      {d:"M18 5c-3-2-5-1-5 1 2-1 4-1 5-1z",f:"#3A9028"},
      {d:"M18 5c3-2 5-1 5 1-2-1-4-1-5-1z",f:"#3A9028"},
      {d:"M18 6c-2-2-2-5 0-6 0 2 0 4 0 6z",f:"#5ABB38"},
    ].map((l,i)=><path key={i} d={l.d} fill={l.f} opacity={0.88-i*0.04}/>)}
  </svg>
);

const WcPasta = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="11" ry="2" fill="rgba(100,60,0,0.13)"/>
    <path d="M5 22h26l-3 10a2 2 0 01-2 2H10a2 2 0 01-2-2z" fill="#F5E8D0" stroke="#C0A070" strokeWidth="1.3"/>
    <ellipse cx="18" cy="22" rx="13" ry="4" fill="#E8D4B0" stroke="#C0A070" strokeWidth="1.2"/>
    <ellipse cx="18" cy="21" rx="11" ry="3.5" fill="#F5D48A"/>
    <path d="M7 20 q4-3 8 0 q4 3 8 0 q4-3 6 0" stroke="#D4A010" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity="0.75"/>
    <path d="M8 22 q4-3 8 0 q4 3 8 0 q3-2 6 0" stroke="#C8920A" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.65"/>
    <path d="M9 18.5 q4-2.5 7 0 q4 2.5 8 0 q3-2 5 0" stroke="#E0B820" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.60"/>
    <ellipse cx="15" cy="20" rx="3" ry="2" fill="#D44030" opacity="0.60"/>
    <ellipse cx="22" cy="21.5" rx="2.5" ry="1.8" fill="#E04838" opacity="0.50"/>
    <ellipse cx="9.5" cy="22" rx="2" ry="1" fill="white" opacity="0.28"/>
  </svg>
);

const WcBottleOil = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="8" ry="1.8" fill="rgba(60,80,0,0.12)"/>
    <path d="M12 18l-2 13a2 2 0 002 2h12a2 2 0 002-2l-2-13z" fill="#C8D840" stroke="#8A9A10" strokeWidth="1.2"/>
    <path d="M13 19l-1.5 11h13l-1.5-11z" fill="#D4E840" opacity="0.55"/>
    <rect x="14" y="11" width="8" height="8" rx="1.5" fill="#B8C830" stroke="#8A9A10" strokeWidth="1"/>
    <rect x="15.5" y="7" width="5" height="5" rx="1" fill="#A0B020" stroke="#6A7810" strokeWidth="1"/>
    <ellipse cx="18" cy="7" rx="3" ry="1.2" fill="#8A9A10" stroke="#5A6808" strokeWidth="0.9"/>
    <rect x="13" y="21" width="10" height="7" rx="1.5" fill="white" opacity="0.60"/>
    <ellipse cx="18" cy="24" rx="3.5" ry="1.5" fill="#7AA020" opacity="0.55"/>
    <rect x="13" y="19" width="2.5" height="12" rx="1.2" fill="white" opacity="0.28"/>
    <rect x="13.5" y="19" width="2" height="5" rx="1" fill="white" opacity="0.42"/>
  </svg>
);

const WcRiceBowl = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="11" ry="2" fill="rgba(0,0,0,0.10)"/>
    <path d="M5 22h26l-3 10a2 2 0 01-2 2H10a2 2 0 01-2-2z" fill="#F8F0E0" stroke="#D0C0A0" strokeWidth="1.2"/>
    <ellipse cx="18" cy="22" rx="13" ry="4" fill="#EEE4D0" stroke="#D0C0A0" strokeWidth="1.2"/>
    <ellipse cx="18" cy="21" rx="11" ry="3.5" fill="#FFFDF8"/>
    {[[11,21],[14,19],[17,20],[20,19],[23,21],[12,23],[16,22],[20,22],[24,22],[13,20]].map(([x,y],i)=>(
      <ellipse key={i} cx={x} cy={y} rx="1.3" ry="0.7" fill="#E8E0D0" stroke="rgba(180,160,120,0.35)" strokeWidth="0.35" transform={`rotate(${i*22} ${x} ${y})`}/>
    ))}
    <path d="M14 16c0-2 .8-3 0-4.5" stroke="#D0C8B8" strokeWidth="1.1" strokeLinecap="round" opacity="0.35"/>
    <path d="M18 15.5c0-2 .8-3 0-5" stroke="#D0C8B8" strokeWidth="1.1" strokeLinecap="round" opacity="0.30"/>
    <path d="M22 16c0-2 .8-3 0-4.5" stroke="#D0C8B8" strokeWidth="1.1" strokeLinecap="round" opacity="0.25"/>
    <ellipse cx="9.5" cy="22" rx="2" ry="1" fill="white" opacity="0.33"/>
  </svg>
);

const WcBeer = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="16" cy="34.5" rx="9" ry="1.8" fill="rgba(80,40,0,0.13)"/>
    <path d="M7 16l1 16a2 2 0 002 2h12a2 2 0 002-2l1-16z" fill="#F5C030" stroke="#C08010" strokeWidth="1.3"/>
    <path d="M24 20c2.5 0 4.5 1.5 4.5 4s-2 4-4.5 4" stroke="#C08010" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M8 20l0.8 12a1 1 0 001 0.9h10.4a1 1 0 001-0.9l0.8-12z" fill="#E8A020" opacity="0.50"/>
    <ellipse cx="16" cy="16" rx="9" ry="3.5" fill="white" stroke="#E0D8C0" strokeWidth="1"/>
    <ellipse cx="13" cy="14.5" rx="3.5" ry="2" fill="white"/>
    <ellipse cx="18" cy="13.5" rx="3" ry="2.2" fill="white"/>
    <ellipse cx="22" cy="14.5" rx="2.5" ry="1.8" fill="white"/>
    {[[11,23],[15,26],[19,24],[13,28]].map(([x,y],i)=>(
      <circle key={i} cx={x} cy={y} r="0.8" fill="white" opacity={0.48-i*0.06}/>
    ))}
    <rect x="8.5" y="17" width="2.5" height="13" rx="1.2" fill="white" opacity="0.26"/>
    <rect x="9" y="17" width="2" height="5" rx="1" fill="white" opacity="0.40"/>
  </svg>
);

const WcToothbrush = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <rect x="2" y="19.5" width="7" height="21" rx="3.5" fill="#4A90E8" stroke="#2A60B8" strokeWidth="1.2" transform="rotate(-42 8 22)"/>
    <rect x="2" y="19.5" width="2.5" height="21" rx="1.2" fill="white" opacity="0.28" transform="rotate(-42 8 22)"/>
    <rect x="17.5" y="4" width="12" height="7" rx="3" fill="#D0E8FF" stroke="#80B0E0" strokeWidth="1.1" transform="rotate(-42 18 7)"/>
    {[0,1,2,3].map(i => {
      const bx = 20 + i * 2.8;
      const by = 11.5 - i * 2.8;
      return (
        <g key={i} transform={`rotate(-42 ${bx} ${by})`}>
          <rect x={bx-0.6} y={by-3.5} width="1.2" height="4" rx="0.6" fill="#60A0F0" opacity="0.80"/>
        </g>
      );
    })}
    <ellipse cx="29" cy="3" rx="4.5" ry="2.5" fill="#80E0A0" stroke="#40B060" strokeWidth="0.9" transform="rotate(-42 28 5)"/>
    <ellipse cx="29" cy="3" rx="2" ry="1.2" fill="white" opacity="0.45" transform="rotate(-42 28 5)"/>
  </svg>
);

const WcDetergent = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="10" ry="1.8" fill="rgba(0,100,200,0.12)"/>
    <path d="M9 16l-1 15a2 2 0 002 2h16a2 2 0 002-2l-1-15z" fill="#60B8F0" stroke="#2880C0" strokeWidth="1.2"/>
    <rect x="13" y="10" width="10" height="7" rx="2" fill="#50A8E0" stroke="#2880C0" strokeWidth="1"/>
    <rect x="14.5" y="6" width="7" height="5" rx="2" fill="#E04030" stroke="#A01810" strokeWidth="1"/>
    <ellipse cx="18" cy="6" rx="4" ry="1.5" fill="#C83020" stroke="#A01810" strokeWidth="0.9"/>
    <rect x="10" y="18" width="16" height="10" rx="2" fill="white" opacity="0.60"/>
    <ellipse cx="18" cy="20.5" rx="5" ry="2" fill="#2880C0" opacity="0.50"/>
    <line x1="11" y1="24" x2="25" y2="24" stroke="#60A8E8" strokeWidth="0.6" opacity="0.55"/>
    {[[23,13],[25,11],[26,14]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={1+i*.25} fill="white" opacity={0.50-i*.08}/>)}
    <rect x="10" y="17" width="2.5" height="14" rx="1.2" fill="white" opacity="0.28"/>
    <rect x="10.5" y="17" width="2" height="5" rx="1" fill="white" opacity="0.42"/>
  </svg>
);

const WcSponge = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="12" ry="2" fill="rgba(0,0,0,0.10)"/>
    <rect x="5" y="16" width="26" height="16" rx="5" fill="#F5D030" stroke="#C0A010" strokeWidth="1.3"/>
    <rect x="5" y="16" width="26" height="7" rx="5" fill="#E0C028" stroke="#C0A010" strokeWidth="1"/>
    {[[10,19],[14,23],[18,20],[22,24],[26,19],[12,26],[20,27],[24,25],[8,25]].map(([x,y],i)=>(
      <ellipse key={i} cx={x} cy={y} rx="2" ry="1.5" fill="rgba(0,0,0,0.12)" transform={`rotate(${i*20} ${x} ${y})`}/>
    ))}
    <rect x="6" y="17" width="3.5" height="14" rx="1.7" fill="white" opacity="0.28"/>
    <rect x="6.5" y="17" width="3" height="6" rx="1.5" fill="white" opacity="0.40"/>
    <rect x="5" y="22" width="26" height="2" rx="0" fill="#D4A810" opacity="0.30"/>
  </svg>
);

const WcSpinach = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(20,60,0,0.13)"/>
    {[
      {d:"M18 28c-5-4-10-8-9-16 2 4 6 10 9 16z", fill:"#2D7A20"},
      {d:"M18 28c5-4 10-8 9-16-2 4-6 10-9 16z", fill:"#2D8A20"},
      {d:"M18 28c-4-6-8-14-5-20 1 5 4 13 5 20z", fill:"#3A9028"},
      {d:"M18 28c4-6 8-14 5-20-1 5-4 13-5 20z", fill:"#3A9028"},
      {d:"M18 28c-2-7-4-16 0-22 0 6 2 15 0 22z", fill:"#4AAA30"},
    ].map((l,i)=><path key={i} d={l.d} fill={l.fill} opacity={0.88-i*0.04}/>)}
    {[{d:"M14 20c-2 1-5 0-5-2 2 1 4 1 5 2z"},{d:"M18 16c-1 2-4 2-5 1 2 0 4 0 5-1z"},{d:"M22 20c2 1 5 0 5-2-2 1-4 1-5 2z"}].map((l,i)=>(
      <path key={i} d={l.d} fill="white" opacity="0.25"/>
    ))}
    <path d="M18 28c0-8 0-18 0-24" stroke="#1A5A10" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
  </svg>
);

const WcPepper = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34.5" rx="8" ry="1.8" fill="rgba(180,20,0,0.12)"/>
    <path d="M18 8c0 0 2-2 4-1-1 2-3 2-4 1z" fill="#4AAA28"/>
    <path d="M18 8c0 0-2-2-4-1 1 2 3 2 4 1z" fill="#3A9020" opacity="0.9"/>
    <path d="M18 8c0-2 1-4 2-5-1 1-2 3-2 5z" stroke="#4A8A20" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
    <path d="M11 12c-3 2-5 6-5 11 0 7 5 12 12 12s12-5 12-12c0-5-2-9-5-11" fill="#E84020" stroke="#A01808" strokeWidth="1.2"/>
    <path d="M13 13c-2 3-3 7-2 11 1-4 3-7 5-9z" fill="#F87050" opacity="0.45"/>
    <path d="M24 15c2 3 2 9-1 13-1 2-3 3-5 3 4-1 7-5 7-10 0-2-.4-4-1-6z" fill="#A01808" opacity="0.25"/>
    <path d="M10 14c0 0 2-2 8-2s8 2 8 2" stroke="#C83010" strokeWidth="0.9" fill="none" opacity="0.4"/>
    <ellipse cx="13.5" cy="14" rx="3" ry="2" fill="white" opacity="0.32" transform="rotate(-20 13.5 14)"/>
    <ellipse cx="12" cy="13" rx="1.3" ry="0.9" fill="white" opacity="0.55" transform="rotate(-20 12 13)"/>
  </svg>
);

const WcOnion = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="9" ry="2" fill="rgba(80,20,80,0.12)"/>
    <path d="M18 10c-6 0-10 5.5-10 12 0 7 4 11 10 11s10-4 10-11C28 15.5 24 10 18 10z" fill="#D090E8" stroke="#8040A0" strokeWidth="1.2"/>
    <path d="M12 13c-3 3-4 7-3 12 1-5 3-9 5-11z" fill="#E8B0F0" opacity="0.5"/>
    <path d="M26 16c2 4 1.5 10-2 13 2-3 2.5-9 1-13z" fill="#8040A0" opacity="0.22"/>
    {[{rx:6,ry:3.5,y:14},{rx:8,ry:4,y:18},{rx:9,ry:4.5,y:22}].map((e,i)=>(
      <ellipse key={i} cx="18" cy={e.y} rx={e.rx} ry={e.ry} stroke="#9050B0" strokeWidth="0.7" fill="none" opacity="0.30"/>
    ))}
    <ellipse cx="13" cy="13.5" rx="3" ry="2" fill="white" opacity="0.35" transform="rotate(-20 13 13.5)"/>
    <ellipse cx="11.5" cy="12.5" rx="1.3" ry="0.9" fill="white" opacity="0.55" transform="rotate(-20 11.5 12.5)"/>
    <path d="M16 10c0-3 1-5 2-7" stroke="#4A7820" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M18 3c1-2 3-2.5 4-1-1 2-3 2.5-4 1z" fill="#5A9A28" opacity="0.85"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────────────────────
// UI / CART ICONS
// ─────────────────────────────────────────────────────────────────────────────

const WcCart = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <circle cx="13" cy="30" r="2.5" fill="#8B6020" stroke="#6B4010" strokeWidth="0.9"/>
    <circle cx="25" cy="30" r="2.5" fill="#8B6020" stroke="#6B4010" strokeWidth="0.9"/>
    <path d="M5 10h3l4 14h12l3-10H11" fill="none" stroke="#5AAB3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="17" cy="18" r="2.5" fill="#F5A623" opacity="0.85"/>
    <circle cx="22" cy="19" r="2" fill="#D92B3A" opacity="0.75"/>
    <ellipse cx="19" cy="16" rx="2.5" ry="2" fill="#4A9A3A" opacity="0.7"/>
    <path d="M2 7h4" stroke="#5AAB3A" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

const WcBag = ({ size=36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
    <ellipse cx="18" cy="34" rx="10" ry="2" fill="rgba(0,0,0,0.10)"/>
    <path d="M8 16l2 16h16l2-16z" fill="#F5E8C0" stroke="#C8A030" strokeWidth="1.2"/>
    <path d="M13 16v-4a5 5 0 0110 0v4" stroke="#C8A030" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
    <line x1="8" y1="16" x2="28" y2="16" stroke="#C8A030" strokeWidth="1.6" strokeLinecap="round"/>
    <circle cx="15" cy="13" r="2" fill="#5AAB3A" opacity="0.7"/>
    <circle cx="21" cy="12.5" r="1.8" fill="#D92B3A" opacity="0.7"/>
    <rect x="9" y="17" width="2.5" height="14" rx="1.2" fill="white" opacity="0.30"/>
  </svg>
);

// ══════════════════════════════════════════════════════════════════════════════
// ICON MAPS — fully expanded with all available watercolor icons
// ══════════════════════════════════════════════════════════════════════════════

const CAT_ICONS = {
  "Lácteos":          (s) => <WcMilk size={s}/>,
  "Frutas y Verduras":(s) => <WcApple size={s}/>,
  "Despensa":         (s) => <WcJar size={s}/>,
  "Carnes":           (s) => <WcChicken size={s}/>,
  "Panadería":        (s) => <WcBread size={s}/>,
  "Bebidas":          (s) => <WcLatte size={s}/>,
  "Higiene":          (s) => <WcSoap size={s}/>,
  "Limpieza":         (s) => <WcBroom size={s}/>,
  "Todos":            (s) => <WcCart size={s}/>,
};

const ITEM_ICONS = {
  // Frutas y Verduras
  "Manzanas":         (s) => <WcApple size={s}/>,
  "Plátanos":         (s) => <WcBanana size={s}/>,
  "Tomates":          (s) => <WcTomato size={s}/>,
  "Aguacate":         (s) => <WcAvocado size={s}/>,
  "Espinacas":        (s) => <WcSpinach size={s}/>,
  "Brócoli":          (s) => <WcBroccoli size={s}/>,
  "Zanahorias":       (s) => <WcCarrot size={s}/>,
  "Limones":          (s) => <WcLemon size={s}/>,
  "Papaya":           (s) => <WcOrange size={s}/>,
  "Piña":             (s) => <WcPineapple size={s}/>,
  "Cebolla":          (s) => <WcOnion size={s}/>,
  "Chile dulce":      (s) => <WcPepper size={s}/>,
  "Culantro":         (s) => <WcHerb size={s}/>,
  "Yuca":             (s) => <WcHerb size={s}/>,
  // Lácteos
  "Leche":            (s) => <WcMilk size={s}/>,
  "Huevos":           (s) => <WcEgg size={s}/>,
  "Queso Mozarela":   (s) => <WcCheese size={s}/>,
  "Queso Turrialba":  (s) => <WcCheese size={s}/>,
  "Mantequilla":      (s) => <WcButter size={s}/>,
  "Yogur":            (s) => <WcYogurt size={s}/>,
  "Crema":            (s) => <WcYogurt size={s}/>,
  "Natilla":          (s) => <WcYogurt size={s}/>,
  // Carnes
  "Pollo":            (s) => <WcChicken size={s}/>,
  "Salmón":           (s) => <WcFish size={s}/>,
  "Pescado":          (s) => <WcFish size={s}/>,
  "Atún":             (s) => <WcFish size={s}/>,
  "Jamón":            (s) => <WcMeat size={s}/>,
  "Carne molida":     (s) => <WcMeat size={s}/>,
  "Costillas":        (s) => <WcMeat size={s}/>,
  "Chorizo":          (s) => <WcMeat size={s}/>,
  "Salchichas":       (s) => <WcMeat size={s}/>,
  // Panadería
  "Pan":              (s) => <WcBread size={s}/>,
  "Pan integral":     (s) => <WcBread size={s}/>,
  "Galletas":         (s) => <WcCookie size={s}/>,
  "Tortillas":        (s) => <WcApplePie size={s}/>,
  // Despensa
  "Miel":             (s) => <WcHoneyBottle size={s}/>,
  "Aceite de Oliva":  (s) => <WcBottleOil size={s}/>,
  "Aceite vegetal":   (s) => <WcBottleOil size={s}/>,
  "Aceite de coco":   (s) => <WcBottleOil size={s}/>,
  "Arroz":            (s) => <WcRiceBowl size={s}/>,
  "Pasta":            (s) => <WcPasta size={s}/>,
  "Sal":              (s) => <WcSalt size={s}/>,
  "Frijoles":         (s) => <WcBeans size={s}/>,
  "Salsa de tomate":  (s) => <WcTomato size={s}/>,
  // Bebidas
  "Café":             (s) => <WcCoffee size={s}/>,
  "Jugo de naranja":  (s) => <WcJuiceGlass size={s}/>,
  "Agua mineral":     (s) => <WcWaterBottle size={s}/>,
  "Refresco":         (s) => <WcJuicePitcher size={s}/>,
  "Cerveza":          (s) => <WcBeer size={s}/>,
  "Leche de avena":   (s) => <WcEggnog size={s}/>,
  // Higiene
  "Shampoo":          (s) => <WcSoap size={s}/>,
  "Jabón":            (s) => <WcSoap size={s}/>,
  "Desodorante":      (s) => <WcSoap size={s}/>,
  "Pasta de dientes": (s) => <WcToothbrush size={s}/>,
  "Papel de baño":    (s) => <WcToiletPaper size={s}/>,
  // Limpieza
  "Detergente":       (s) => <WcDetergent size={s}/>,
  "Suavizante":       (s) => <WcDetergent size={s}/>,
  "Esponja":          (s) => <WcSponge size={s}/>,
};

// Helper: renders the best icon for an item — watercolor if available, else emoji
function ItemIcon({ name, category, emoji, size=32, emojiSize=24 }) {
  const WcComp = ITEM_ICONS[name] || null;
  if (WcComp) {
    return <span style={{width:size,height:size,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{WcComp(size)}</span>;
  }
  const CatComp = CAT_ICONS[category] || null;
  if (CatComp) {
    return <span style={{width:size,height:size,display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{CatComp(size)}</span>;
  }
  return <span style={{fontSize:emojiSize,width:size,textAlign:"center",lineHeight:1,flexShrink:0}}>{emoji}</span>;
}

// ── SVG Icon Library — Navigation & action icons (kept as clean stroked SVGs) ─
// ── Icons (Lucide React) ─────────────────────────────────────────────────────
import {
  Home         as IconHome,
  User         as IconPerson,
  Plus         as IconPlus,
  History      as IconHistory,
  ShoppingBag  as IconBag,
  Check        as IconCheck,
  Trash2       as IconTrash,
  Pencil       as IconEdit,
  X            as IconX,
  ChevronLeft  as IconChevronLeft,
  ChevronDown  as IconChevronDown,
  Search       as IconSearch,
  Star         as IconStar,
  Sparkles     as IconSpark,
  Wallet       as IconWallet,
  List         as IconList,
  Grid2x2      as IconGrid,
  ArrowUp      as IconArrowUp,
  Minus        as IconMinus,
  Tag          as IconTag,
  Camera       as IconCamera,
  Settings     as IconSettings,
  BarChart2    as IconChart,
} from "lucide-react";

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ onNewList, onStats, onProfile, active, theme = {} }) {
  const isDark = theme.isDark;
  const [pressed, setPressed] = useState(null);
  const tabs = [
    { key:"home",    Icon:IconHome,    label:"Inicio",   onClick:onNewList },
    { key:"stats",   Icon:IconChart,   label:"Estadísticas", onClick:onStats   },
    { key:"profile", Icon:IconPerson,  label:"Perfil",   onClick:onProfile },
  ];
  const navBg = theme.navBg || (isDark ? "rgba(21,26,53,0.96)" : "rgba(255,252,248,0.94)");
  const borderColor = isDark ? `rgba(${theme.accentRgb||"98,121,200"},0.22)` : "rgba(255,255,255,0.75)";
  return (
    <div style={{
      position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
      width:430, maxWidth:"100%",
      background: navBg,
      backdropFilter:"blur(32px) saturate(180%)", WebkitBackdropFilter:"blur(32px) saturate(180%)",
      borderTop:`1.5px solid ${borderColor}`,
      boxShadow: isDark ? "0 -6px 32px rgba(0,0,0,0.40)" : "0 -4px 32px rgba(80,60,20,0.10)",
      display:"flex", alignItems:"center",
      paddingBottom:"env(safe-area-inset-bottom,8px)", paddingTop:8, zIndex:20,
    }}>
      {/* Center FAB for new list */}
      {tabs.map(({ key, Icon, label, onClick }) => {
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
                ? `0 6px 20px rgba(${theme.accentRgb||"94,171,47"},0.38), inset 0 1px 0 rgba(255,255,255,0.28)`
                : on ? `0 2px 10px rgba(${theme.accentRgb||"94,171,47"},0.18)` : "none",
            }}>
              <Icon size={isFab ? 22 : 19} strokeWidth={isFab ? 2.5 : on ? 2.5 : 1.8}
                color={isFab ? "#fff" : on ? theme.accentDark : isDark ? `rgba(${theme.accentRgb||"98,121,200"},0.45)` : "#BDB0A4"} />
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
    <div style={{ display:"flex", borderBottom:`1px solid ${isDark ? "rgba(99,102,241,0.18)" : "rgba(0,0,0,0.07)"}`, background: isDark ? "rgba(15,23,42,0.95)" : "rgba(255,255,255,0.95)", paddingLeft:4, overflowX:"auto", scrollbarWidth:"none" }}>
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            background:"none", border:"none", cursor:"pointer",
            padding:"14px 18px 12px", fontSize:14, fontWeight: on ? 800 : 500,
            color: on ? "var(--accent)" : isDark ? "#64748B" : "#94A3B8",
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

  const saveAmts = (amts) => { setQuickAmts(amts); try { localStorage.setItem("sl5_quickAmts", JSON.stringify(amts)); } catch {} };
  const removeAmt = (amt) => saveAmts(quickAmts.filter(a => a !== amt));
  const confirmAmt = () => {
    const n = parseInt(newAmt);
    if (!n || n <= 0 || quickAmts.includes(n)) { setNewAmt(""); setAddingAmt(false); return; }
    const sorted = [...quickAmts, n].sort((a,b) => a-b);
    saveAmts(sorted); setNewAmt(""); setAddingAmt(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.32)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:70, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div className="wc-sheet" style={{ width:"100%", maxWidth:430, animation:"slideUp .28s cubic-bezier(.34,1.2,.64,1)", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"center", padding:"12px 0 0" }}><div style={{ width:36, height:4, borderRadius:99, background:"rgba(var(--accent-rgb),0.18)" }} /></div>
        <div style={{ display:"flex", alignItems:"center", padding:"16px 20px 0", justifyContent:"space-between" }}>
          <div style={{ width:44, height:44, borderRadius:14, background:"var(--soft)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconPerson size={24} color="var(--accent)" />
          </div>
          <div style={{ flex:1, marginLeft:14 }}>
            <div style={{ fontSize:17, fontWeight:800, color:"var(--textPrimary)" }}>{profile.name||"Mi Perfil"}</div>
            <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:1 }}>Configuración personal</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(var(--accent-rgb),0.10)", border:"none", color:"var(--textMuted)", width:32, height:32, borderRadius:"50%", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .12s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.18)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.10)"}>✕</button>
        </div>
        <TopTabs tabs={[{id:"profile",label:"Perfil"},{id:"budget",label:"💰 Presupuesto"},{id:"currency",label:"Moneda"}]} active={tab} onChange={setTab} theme={{isDark: false}} />
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
            <div style={{ background:"rgba(255,255,255,0.55)", borderRadius:"var(--radius-md,16px)", padding:"16px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, border:"1.5px solid var(--border)", transition:"border-color .2s, box-shadow .2s" }}
              onFocus={(e) => { e.currentTarget.style.borderColor="var(--accent)"; e.currentTarget.style.boxShadow="0 0 0 3px rgba(var(--accent-rgb),0.12)"; }}
              onBlur={(e) =>  { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.boxShadow="none"; }}>
              <span style={{ color:"var(--accent)", fontWeight:900, fontSize:24 }}>{sym}</span>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                style={{ flex:1, background:"none", border:"none", color:"var(--textPrimary)", fontSize:28, fontWeight:800, outline:"none", width:"100%", fontFamily:"inherit" }} />
              {budget && <button onClick={() => setBudget("")}
                style={{ background:"rgba(var(--accent-rgb),0.10)", border:"none", color:"var(--textMuted)", width:28, height:28, borderRadius:"50%", fontSize:13, cursor:"pointer", flexShrink:0 }}>✕</button>}
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
                    {sym}{amt>=1000 ? `${(amt/1000).toFixed(0)}k` : amt}
                  </button>
                ))}
                {/* Botón para agregar monto */}
                {addingAmt ? (
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input autoFocus type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") confirmAmt(); if(e.key==="Escape") { setAddingAmt(false); setNewAmt(""); } }}
                      placeholder="ej. 15000"
                      style={{ width:90, background:"rgba(255,255,255,0.8)", border:"1.5px solid var(--accent)", borderRadius:20, padding:"7px 10px", color:"#2C2318", fontSize:13, outline:"none", textAlign:"center" }} />
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
                  background:c.code===currency?"var(--tagBg)":"rgba(var(--accent-rgb),0.04)",
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
        </div>
        <div style={{ padding:"16px 20px 28px", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:"rgba(var(--accent-rgb),0.08)", border:"1px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"var(--textMuted)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"background .12s ease" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.14)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.08)"}>Cancelar</button>
          <button onClick={() => { Sounds.save(); onSaveProfile({ name, budget }); onSaveSettings({ currencyCode:currency }); onClose(); }}
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
const editInputStyle = { width:"100%", background:"rgba(255,255,255,0.60)", border:"1.5px solid var(--border)", borderRadius:"var(--radius-sm,10px)", padding:"11px 12px", color:"var(--textPrimary)", fontSize:15, outline:"none", boxSizing:"border-box", transition:"border-color .15s ease, box-shadow .15s ease", fontFamily:"inherit" };
const qtyEditBtn = { background:"rgba(0,0,0,0.05)", border:"1px solid var(--border)", color:"var(--textPrimary,#2C2318)", width:40, height:40, borderRadius:"var(--radius-sm,10px)", fontSize:20, cursor:"pointer", transition:"background .12s ease" };
function EditLabel({ children }) {
  return <label style={{ display:"block", fontSize:11, color:"var(--textMuted)", fontWeight:700, marginBottom:4, marginTop:14, textTransform:"uppercase", letterSpacing:1 }}>{children}</label>;
}

// ── ContextMenu ───────────────────────────────────────────────────────────────
function ContextMenu({ item, onClose, onDelete, onDuplicate, onEdit, sym }) {
  const subtotal = (parseFloat(item.price)||0)*(item.qty||1);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div className="wc-context-menu" style={{ width:"100%", maxWidth:430, paddingBottom:20, overflow:"hidden" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 20px 14px", borderBottom:"1px solid rgba(var(--accent-rgb),0.12)" }}>
          <span style={{ fontSize:28 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={40} emojiSize={28}/></span>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:"var(--textPrimary)" }}>{item.name}</div>
            <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:2 }}>{item.qty||1} {item.unit||"pza"}{item.price?` · ${sym}${Math.round(subtotal).toLocaleString()}`:""}</div>
          </div>
          {/* drag handle */}
          <div style={{ flex:1, display:"flex", justifyContent:"center" }}>
            <div style={{ width:36, height:4, borderRadius:99, background:"rgba(var(--accent-rgb),0.20)", marginBottom:2 }} />
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"8px 12px" }}>
          <CtxBtn icon="✏️" onClick={onEdit}>Editar artículo</CtxBtn>
          <CtxBtn icon="📋" onClick={onDuplicate}>Duplicar</CtxBtn>
          <div style={{ height:1, background:"rgba(var(--accent-rgb),0.10)", margin:"4px 8px" }} />
          <CtxBtn icon="🗑" danger onClick={onDelete}>Eliminar</CtxBtn>
          <div style={{ height:1, background:"rgba(var(--accent-rgb),0.10)", margin:"4px 8px" }} />
          <CtxBtn icon="✕" muted onClick={onClose}>Cancelar selección</CtxBtn>
        </div>
      </div>
    </div>
  );
}
function CtxBtn({ icon, children, onClick, danger, muted }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 12px", background:"none", border:"none", borderRadius:12, color:danger?"#EF4444":muted?"var(--textMuted)":"var(--textPrimary)", fontSize:muted?13:15, fontWeight:muted?400:600, cursor:"pointer", width:"100%", textAlign:"left", transition:"background .12s ease" }}
      onMouseEnter={e => !muted && (e.currentTarget.style.background = danger ? "rgba(239,68,68,0.07)" : "rgba(var(--accent-rgb),0.07)")}
      onMouseLeave={e => e.currentTarget.style.background="none"}
      onTouchStart={e => e.currentTarget.style.background = danger ? "rgba(239,68,68,0.07)" : "rgba(var(--accent-rgb),0.07)"}
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
  const subtotal = (parseFloat(price)||0)*qty;
  const presetPrice = CR_PRICES[item.name];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)", zIndex:60, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div className="wc-sheet" style={{ width:"100%", maxWidth:430, padding:20, animation:"slideUp .22s ease", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, borderRadius:99, background:"rgba(var(--accent-rgb),0.20)", margin:"0 auto 18px" }} />
        <div style={{ fontSize:16, fontWeight:800, marginBottom:16, display:"flex", alignItems:"center", gap:10, color:"var(--textPrimary)" }}>
          <span style={{ fontSize:28 }}><ItemIcon name={item.name} category={item.category} emoji={item.emoji} size={40} emojiSize={28}/></span> Editar artículo
        </div>
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
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ background:"rgba(0,0,0,0.05)", border:"1px solid var(--border)", borderRadius:"var(--radius-sm,10px)", color:"#1A2118", padding:"0 10px", fontSize:14, height:40, fontFamily:"inherit" }}>
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
          <button onClick={onClose} style={{ flex:1, background:"rgba(var(--accent-rgb),0.08)", border:"1px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 12px", color:"var(--textMuted)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"inherit", transition:"background .12s ease" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.14)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(var(--accent-rgb),0.08)"}>Cancelar</button>
          <button onClick={() => { Sounds.save(); onSave({ ...item, name, price, qty, unit, note }); }}
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
function SwipeItem({ item, onToggle, onQtyMinus, onQtyPlus, onDelete, onContextMenu, editingPriceId, tempPrice, setTempPrice, setEditingPriceId, savePrice, sym }) {
  const rowRef   = useRef(null);
  const wrapRef  = useRef(null);
  const swipeState = useRef({ startX:0, curX:0, dragging:false, hasMoved:false, holdTimer:null });
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
    const s = swipeState.current;
    s.startX=cx; s.curX=0; s.dragging=true; s.hasMoved=false;
    if (rowRef.current) rowRef.current.style.transition="none";
    startHold();
  }, [startHold]);

  const onMove = useCallback((e) => {
    const s = swipeState.current;
    if (!s.dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - s.startX;
    s.curX=x;
    if (Math.abs(x)>8) { s.hasMoved=true; cancelHold(); }
    if (rowRef.current) rowRef.current.style.transform=`translateX(${x}px)`;
    const bgL = wrapRef.current?.querySelector(".sl-bg-left");
    const bgR = wrapRef.current?.querySelector(".sl-bg-right");
    if (bgL&&bgR) { bgL.style.display=x<-20?"flex":"none"; bgR.style.display=x>20?"flex":"none"; }
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
        if (rowRef.current) rowRef.current.style.transform="translateX(-110%)";
        setTimeout(() => onDelete(item.id), 220);
      } else if (s.curX > THRESHOLD) {
        Sounds.checkItem();
        onToggle(item.id, true);
        if (rowRef.current) rowRef.current.style.transform="translateX(0)";
        if (bgL) bgL.style.display="none"; if (bgR) bgR.style.display="none";
      } else {
        if (rowRef.current) rowRef.current.style.transform="translateX(0)";
        if (bgL) bgL.style.display="none"; if (bgR) bgR.style.display="none";
      }
    } else {
      if (rowRef.current) rowRef.current.style.transform="translateX(0)";
      if (bgL) bgL.style.display="none"; if (bgR) bgR.style.display="none";
    }
  }, [cancelHold, item.id, onDelete, onToggle]);

  // ── Checked item: in-the-bag style ──────────────────────────────────────
  if (item.checked) {
    return (
      <div ref={wrapRef} style={{ position:"relative", overflow:"hidden", animation:"slItemBounceIn .38s cubic-bezier(.34,1.56,.64,1) both" }}>
        <div className="sl-bg-left" style={{ position:"absolute", inset:0, background:"rgba(239,68,68,0.12)", display:"none", alignItems:"center", justifyContent:"flex-end", paddingRight:22, fontSize:14, fontWeight:700, color:"#EF4444", gap:8 }}>🗑 Eliminar</div>
        <div ref={rowRef}
          style={{ display:"flex", alignItems:"center", padding:"10px 14px", gap:10, background:"rgba(var(--accent-rgb,91,173,114),0.07)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", position:"relative", touchAction:"pan-y", userSelect:"none", borderBottom:"1px solid rgba(0,0,0,0.04)", cursor:"pointer" }}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onClick={(e) => { if (!swipeState.current.hasMoved) { Sounds.uncheckItem(); onToggle(item.id); } }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

          {/* soft left accent bar */}
          <div style={{ position:"absolute", left:0, top:6, bottom:6, width:3, borderRadius:3, background:"var(--accent)", opacity:.45 }} />

          {/* check circle – soft green, tappable to uncheck */}
          <button onClick={(e) => { e.stopPropagation(); Sounds.uncheckItem(); onToggle(item.id); }}
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
            <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"var(--accentDark)", opacity:.9 }}>{item.name}</span>
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

  // ── Unchecked item (original) ─────────────────────────────────────────────
  return (
    <div ref={wrapRef} className="item-stagger" style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid rgba(0,0,0,0.04)", animation:"slItemSpring .30s var(--ease-spring) both" }}>
      <div className="sl-bg-left"  style={{ position:"absolute", inset:0, background:"rgba(239,68,68,0.12)", display:"none", alignItems:"center", justifyContent:"flex-end",  paddingRight:22, fontSize:14, fontWeight:700, color:"#EF4444", gap:8, transition:"opacity .15s" }}>🗑 Eliminar</div>
      <div className="sl-bg-right" style={{ position:"absolute", inset:0, background:"rgba(var(--accent-rgb),0.13)", display:"none", alignItems:"center", justifyContent:"flex-start", paddingLeft:22, fontSize:14, fontWeight:700, color:"var(--accentDark)", gap:8, transition:"opacity .15s" }}>✓ Seleccionar</div>
      <div ref={rowRef}
        style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10, background:"rgba(255,255,255,0.82)", position:"relative", touchAction:"pan-y", userSelect:"none", transition:"background .15s", cursor:"pointer" }}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onClick={(e) => { if (!swipeState.current.hasMoved && !e.target.closest("button") && !e.target.closest("input")) { Sounds.checkItem(); onToggle(item.id); } }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

        <button onClick={(e) => { e.stopPropagation(); Sounds.checkItem(); const r=e.currentTarget.getBoundingClientRect(); spawnConfetti(r.left+r.width/2,r.top+r.height/2,14); spawnEmojiParticle(r.left+r.width/2,r.top,item.emoji); onToggle(item.id); }}
          style={{ width:28, height:28, borderRadius:"50%", border:"2px solid rgba(0,0,0,0.18)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"transparent", fontSize:14, fontWeight:"bold", transition:"border-color .2s, transform .15s" }}
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
            <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDelete(item.id); }}
              style={{ background:"rgba(239,68,68,0.08)", border:"none", color:"#EF4444", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyMinus(item.id); }}
              style={{ background:"rgba(0,0,0,0.05)", border:"1px solid var(--border)", color:"#1A2118", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
          )}
          <span style={{ fontSize:14, fontWeight:800, minWidth:22, textAlign:"center" }}>{qty}</span>
          <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyPlus(item.id); }}
            style={{ background:"rgba(0,0,0,0.05)", border:"1px solid var(--border)", color:"#1A2118", width:28, height:28, borderRadius:"var(--radius-sm,10px)", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ── Quick name suggestions for new lists ─────────────────────────────────────
const LIST_SUGGESTIONS = ["🏠 Casa","🛒 Semana","🎉 Fiesta","💪 Gym","🍳 Desayuno","🌮 Cena","🧹 Limpieza","🎂 Cumple","📦 Mes","🐾 Mascotas"];

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

  const card = {
    background: theme.isDark
      ? "rgba(30,41,59,0.92)"
      : "rgba(255,255,255,0.94)",
    borderRadius: 22,
    border: theme.isDark
      ? "1px solid rgba(99,102,241,0.18)"
      : `1px solid ${theme.border}`,
    boxShadow: theme.isDark
      ? "0 4px 20px rgba(0,0,0,0.35)"
      : `0 3px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)`,
  };

  return (
    <>
      {/* ── Compact Hero Banner — glass, glow, no patterns ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "0 0 26px 26px",
        background: themeName === "moon"
          ? "linear-gradient(160deg, #0F172A 0%, #1e1b4b 100%)"
          : themeName === "pink"
          ? "linear-gradient(160deg, #fff0f6 0%, #fce7f3 60%, #fdf2f8 100%)"
          : "linear-gradient(160deg, #f0fdf4 0%, #dcfce7 60%, #ecfdf5 100%)",
        boxShadow: themeName === "moon"
          ? "0 6px 28px rgba(99,102,241,0.20), 0 1px 0 rgba(129,140,248,0.12)"
          : themeName === "pink"
          ? "0 6px 24px rgba(236,72,153,0.12), 0 1px 0 rgba(249,168,212,0.30)"
          : "0 6px 24px rgba(22,163,74,0.10), 0 1px 0 rgba(134,239,172,0.30)",
      }}>

        {/* Soft orb — top right */}
        <div style={{
          position:"absolute", top:-28, right:-28,
          width:110, height:110, borderRadius:"50%",
          background: themeName === "moon"
            ? "radial-gradient(circle, rgba(99,102,241,0.30) 0%, transparent 70%)"
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
            ? "radial-gradient(circle, rgba(129,140,248,0.18) 0%, transparent 70%)"
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
            ? "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.18) 50%, transparent 70%)"
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
                background:"rgba(255,255,255,0.80)",
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
              ? "rgba(99,102,241,0.22)"
              : "rgba(255,255,255,0.85)",
            border:`1.5px solid ${
              themeName === "moon" ? "rgba(129,140,248,0.28)"
              : themeName === "pink" ? "rgba(244,114,182,0.28)"
              : "rgba(74,222,128,0.30)"
            }`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:19,
            boxShadow: themeName === "moon"
              ? "0 2px 10px rgba(99,102,241,0.22), inset 0 1px 0 rgba(255,255,255,0.08)"
              : "0 2px 10px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)",
            animation:"badgePop .4s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            {themeName === "moon" ? "🌙" : themeName === "pink" ? "🌸" : "🌿"}
          </div>

          {/* Text */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{
              fontSize:15, fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.2,
              color: themeName === "moon" ? "#E2E8F0" : themeName === "pink" ? "#9d174d" : "#14532D",
              animation:"fadeSlideIn .35s ease both",
            }}>
              {lists.length === 0 ? "¡Hola! 👋" : `${lists.length} lista${lists.length!==1?"s":""}`}
              {lists.length > 0 && (() => {
                const totalItems = lists.reduce((s,l)=>s+l.items.length,0);
                const checked    = lists.reduce((s,l)=>s+l.items.filter(i=>i.checked).length,0);
                return totalItems > 0
                  ? <span style={{ fontWeight:500, fontSize:11.5, marginLeft:7, opacity:0.62 }}>· {totalItems} art{checked>0?` · ${checked} ✓`:""}</span>
                  : null;
              })()}
            </div>
            <div style={{
              fontSize:11, fontWeight:500, marginTop:2,
              color: themeName === "moon" ? "rgba(165,180,252,0.70)" : themeName === "pink" ? "rgba(157,23,77,0.52)" : "rgba(20,83,45,0.52)",
              animation:"fadeSlideIn .35s .05s ease both",
            }}>
              {lists.length === 0 ? "Crea tu primera lista 🛒" : "Toca una para comprar"}
            </div>
          </div>

          {/* Cart pill — frosted glass */}
          <div style={{
            display:"flex", alignItems:"center", gap:5,
            background: themeName === "moon"
              ? "rgba(99,102,241,0.22)"
              : "rgba(255,255,255,0.85)",
            border:`1px solid ${
              themeName === "moon" ? "rgba(129,140,248,0.22)"
              : themeName === "pink" ? "rgba(244,114,182,0.25)"
              : "rgba(74,222,128,0.25)"
            }`,
            borderRadius:22, padding:"5px 12px 5px 9px",
            boxShadow: themeName === "moon"
              ? "0 2px 10px rgba(99,102,241,0.16)"
              : "0 2px 10px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.8)",
            animation:"badgePop .4s .08s cubic-bezier(.34,1.56,.64,1) both",
          }}>
            <span style={{ fontSize:15 }}>🛒</span>
            <span style={{ fontSize:11, fontWeight:800, letterSpacing:"0.02em",
              color: themeName === "moon" ? "#a5b4fc" : themeName === "pink" ? "#be185d" : "#166534",
            }}>Lista</span>
          </div>
        </div>

        {/* Hairline glow divider */}
        <div style={{
          height:1,
          background: themeName === "moon"
            ? "linear-gradient(90deg, transparent, rgba(129,140,248,0.35), transparent)"
            : themeName === "pink"
            ? "linear-gradient(90deg, transparent, rgba(244,114,182,0.30), transparent)"
            : "linear-gradient(90deg, transparent, rgba(74,222,128,0.30), transparent)",
        }} />
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"16px 0 8px" }}>

        {/* ── Existing lists ── */}
        {lists.map((list, idx) => {
          const done  = list.items.filter(i => i.checked).length;
          const total = list.items.length;
          const cost  = totalCost(list.items);
          const pct   = total > 0 ? (done / total) * 100 : 0;
          return (
            <div key={list.id} onClick={() => onOpenList(list.id)}
              className="list-card pressable"
              style={{ ...card, margin:"0 16px 10px", padding:"18px 20px 16px", cursor:"pointer", animation:`slItemSpring .30s var(--ease-spring) ${idx*.06}s both`, transition:"transform 0.25s var(--ease-spring), box-shadow 0.25s ease" }}
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5;
                const y = (e.clientY - r.top)  / r.height - 0.5;
                el.style.transform = `perspective(600px) rotateX(${-y*6}deg) rotateY(${x*6}deg) translateY(-3px) scale(1.012)`;
                el.style.boxShadow = theme.isDark
                  ? `${-x*8}px ${-y*8+8}px 28px rgba(0,0,0,0.42)`
                  : `${-x*8}px ${-y*8+8}px 24px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.9)`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.boxShadow = "";
              }}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom: total>0 ? 12 : 0 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:16, fontWeight:800, color: theme.isDark ? "#E2E8F0" : "#1A2118", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", lineHeight:1.3 }}>{list.name}</div>
                  <div style={{ fontSize:12, color: theme.isDark ? "#94A3B8" : "#9E9285", marginTop:3, fontWeight:500 }}>
                    {total > 0 ? `${total} artículo${total!==1?"s":""} · ${done} en bolsa` : "Vacía — toca para añadir"}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:12 }}>
                  {cost > 0 && (
                    <span style={{ fontSize:13, fontWeight:800, color: theme.isDark ? "#a5b4fc" : theme.tagColor, background: theme.tagBg, borderRadius:"var(--radius-sm)", padding:"4px 10px" }}>
                      {sym}{Math.round(cost).toLocaleString()}
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDeleteList(list.id); }}
                    style={{ background: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", border:"none", color: theme.isDark ? "#64748B" : "#C4B9AF", fontSize:13, cursor:"pointer", width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background .12s" }}>✕</button>
                </div>
              </div>
              {total > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div className="wc-progress-track" style={{ flex:1 }}>
                    <div className="wc-progress-fill" style={{ width:`${pct}%` }} />
                  </div>
                  <span style={{ fontSize:11, color: theme.isDark ? "#64748B" : "#B0A898", fontWeight:700, flexShrink:0 }}>{done}/{total}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Create new list — always visible, no modal ── */}
        <div style={{ ...card, margin:"0 16px 16px", padding:"20px 20px 16px", border: theme.isDark ? "1.5px dashed rgba(129,140,248,0.35)" : `1.5px dashed ${theme.border}` }}>
          <div style={{ fontSize:13, fontWeight:700, color: theme.isDark ? "#a5b4fc" : theme.tagColor, marginBottom:12, letterSpacing:".01em" }}>✨ Nueva lista</div>

          {/* Big input */}
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
            <input
              id="nueva-lista-input"
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleCreate()}
              placeholder="¿Cómo se llama?"
              style={{ flex:1, background: theme.isDark ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.7)", border: theme.isDark ? "1.5px solid rgba(129,140,248,0.25)" : `1.5px solid ${theme.border}`, borderRadius:14, padding:"13px 16px", color: theme.isDark ? "#E2E8F0" : "#1A2118", fontSize:16, fontWeight:600, outline:"none", boxSizing:"border-box", transition:"border-color .15s" }}
              onFocus={e  => e.target.style.borderColor="var(--accent)"}
              onBlur={e   => e.target.style.borderColor= theme.isDark ? "rgba(129,140,248,0.25)" : theme.border}
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
  const Sth = makeStyles(theme);
  const [searchQuery,    setSearchQuery]   = useState("");
  const [showCompleted,  setShowCompleted] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice,      setTempPrice]     = useState("");
  const [contextItemId,  setContextItemId] = useState(null);
  const [editingItem,    setEditingItem]   = useState(null);
  const [budgetFlipped,  setBudgetFlipped]  = useState(false);
  const [showUnchecked,  setShowUnchecked]  = useState(true);
  const [editingBudget,  setEditingBudget]  = useState(false);
  const [budgetDraft,    setBudgetDraft]    = useState(budget || "");
  const holdTimerRef = useRef(null);
  const budgetNum    = parseFloat(budget) || 0;

  const savePrice = (id) => { onUpdateItem(id, it => ({ ...it, price:tempPrice })); setEditingPriceId(null); };

  const all       = searchQuery ? list.items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())) : list.items;
  const unchecked = all.filter(i => !i.checked);
  const checked   = all.filter(i =>  i.checked);
  const done      = list.items.filter(i => i.checked).length;
  const tot       = list.items.length;
  // "libre" = presupuesto menos SOLO lo que ya está en la bolsa (checked)
  const inBagCost  = totalCost(list.items.filter(i => i.checked));
  const remaining  = budgetNum - inBagCost;   // puede ser negativo sin límite
  const overBudget = budgetNum > 0 && remaining < 0;
  const budgetPct  = budgetNum > 0 ? (inBagCost / budgetNum) * 100 : 0; // sin clamp, puede pasar 100%

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
      <div style={Sth.header}>
        <button onClick={() => { Sounds.navBack(); onBack(); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", padding:"4px 8px 4px 0", display:"flex", alignItems:"center", gap:5, borderRadius:10, transition:"opacity .15s" }} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <IconChevronLeft size={22} strokeWidth={2.5} color="var(--accent)" />
        </button>
        <span style={{ flex:1, fontWeight:800, fontSize:18, color: theme.isDark ? "#E2E8F0" : "#1A2118" }}>{list.name}</span>
        <span style={{ background: theme.isDark ? "rgba(99,102,241,0.18)" : "var(--soft)", borderRadius:"var(--radius-sm,10px)", padding:"3px 10px", fontSize:13, color: theme.isDark ? "#94A3B8" : "var(--accentDark)", fontWeight:600, marginRight:4 }}>{done}/{tot}</span>

        {/* ── Budget flip card en el header ── */}
        {editingBudget ? (
          <div style={{ display:"flex", alignItems:"center", gap:4, background: theme.isDark ? "rgba(99,102,241,0.18)" : "var(--soft)", border:"1.5px solid var(--accent)", borderRadius:22, padding:"0 10px", height:38, animation:"fadeIn .15s ease" }}>
            <span style={{ color:"var(--accentDark)", fontWeight:900, fontSize:14 }}>{sym}</span>
            <input autoFocus type="number" value={budgetDraft}
              onChange={e => setBudgetDraft(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") confirmBudgetEdit(); if(e.key==="Escape") setEditingBudget(false); }}
              onBlur={confirmBudgetEdit}
              style={{ width:52, background:"none", border:"none", color: theme.isDark ? "#E2E8F0" : "#2C2318", fontSize:14, fontWeight:800, outline:"none", textAlign:"right" }}
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
                    {budgetNum > 0 ? `${sym}${budgetNum >= 1000 ? `${(budgetNum/1000).toFixed(0)}k` : budgetNum}` : `${sym}${Math.round(inBagCost).toLocaleString()}`}
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
            <div style={{ fontSize:18, fontWeight:700, color: theme.isDark ? "#E2E8F0" : "#2C2318", marginBottom:6 }}>Tu lista está vacía</div>
            <div style={{ fontSize:13, color: theme.isDark ? "#94A3B8" : "#9E9285" }}>Toca + Añadir para agregar artículos</div>
          </div>
        )}
        {searchQuery && all.length===0 && <div style={{ fontSize:13, color: theme.isDark ? "#94A3B8" : "#9E9285", padding:20, textAlign:"center" }}>Sin resultados para "{searchQuery}"</div>}

        {unchecked.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"8px 16px 6px", borderBottom: theme.isDark ? "1px solid #1E293B" : "1px solid #F0F2EF" }}>
            <button onClick={() => setShowUnchecked(v => !v)}
              style={{ background:"none", border:"none", color: theme.isDark ? "#94A3B8" : "#7A6E5F", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0, fontWeight:700 }}>
              <span style={{ fontSize:11, transition:"transform .2s", display:"inline-block", transform: showUnchecked ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              <span>En lista</span>
              <span style={{ background: theme.isDark ? "rgba(30,41,59,0.8)" : "#EDE8DF", borderRadius:10, padding:"1px 8px", fontSize:11, color: theme.isDark ? "#94A3B8" : "#8A8075", fontWeight:600 }}>{unchecked.length}</span>
            </button>
          </div>
        )}

        {showUnchecked && unchecked.map(item => (
          <SwipeItem key={item.id} item={item}
            onToggle={(id) => onUpdateItem(id, it => ({ ...it, checked:!it.checked }))}
            onQtyMinus={(id) => onUpdateItem(id, it => ({ ...it, qty:Math.max(1,(it.qty||1)-1) }))}
            onQtyPlus={(id)  => onUpdateItem(id, it => ({ ...it, qty:(it.qty||1)+1 }))}
            onDelete={onDeleteItem} onContextMenu={setContextItemId}
            editingPriceId={editingPriceId} tempPrice={tempPrice}
            setTempPrice={setTempPrice} setEditingPriceId={setEditingPriceId} savePrice={savePrice}
            sym={sym} />
        ))}

        {/* ── En la bolsa: header colapsable ── */}
        {checked.length>0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"9px 12px 9px 16px", borderTop:"1px solid rgba(220,252,231,0.7)", background:"rgba(238,248,238,0.65)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", gap:8 }}>
            {/* Collapse toggle + label */}
            <button onClick={() => setShowCompleted(v => !v)}
              style={{ background:"none", border:"none", color:"var(--accentDark)", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0, fontWeight:700, flex:1, minWidth:0 }}>
              <span style={{ fontSize:10, transition:"transform .2s", display:"inline-block", transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)", opacity:.7 }}>▼</span>
              <span style={{ fontSize:15, lineHeight:1 }}>🛍</span>
              <span style={{ fontSize:13, color:"#2C2318", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {checked.length === 1 ? "1 en tu bolsa" : `${checked.length} en tu bolsa`}
              </span>
              {inBagCost > 0 && (
                <span style={{ fontSize:12, color:"var(--accentDark)", fontWeight:800, background:"var(--soft)", borderRadius:"var(--radius-sm,10px)", padding:"1px 7px", marginLeft:2, flexShrink:0 }}>
                  {sym}{Math.round(inBagCost).toLocaleString()}
                </span>
              )}
            </button>

            {/* ── Chip "Cerrar compra" ── */}
            <button
              onClick={(e) => { Sounds.checkout(); const colors=["#22C55E","#4ADE80","#FCD34D","#60A5FA","#F472B6","#A78BFA"]; celebrateCheckout(colors); ripple(e); onCloseSession({ total: inBagCost, items: list.items.filter(i=>i.checked), listName: list.name, date: Date.now(), itemCount: done }); }}
              style={{
                display:"flex", alignItems:"center", gap:5,
                background:"linear-gradient(135deg,#22C55E 0%,#15803D 100%)",
                color:"#FFFFFF", border:"none", borderRadius:100,
                padding:"6px 13px 6px 10px",
                fontSize:12, fontWeight:800, letterSpacing:".01em",
                cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
                boxShadow:"0 2px 8px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)",
                animation:"chipIn .35s cubic-bezier(.34,1.56,.64,1) both",
                transition:"transform .14s var(--ease-spring), box-shadow .14s ease",
                fontFamily:"inherit",
              }}
              onMouseDown={e  => { e.currentTarget.style.transform="scale(.92)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(22,163,74,.20)"; }}
              onMouseUp={e    => { e.currentTarget.style.transform="scale(1)";   e.currentTarget.style.boxShadow="0 2px 8px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)"; }}
              onTouchStart={e => { e.currentTarget.style.transform="scale(.92)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(22,163,74,.20)"; }}
              onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)";   e.currentTarget.style.boxShadow="0 2px 8px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)"; }}
            >
              <span style={{ width:16, height:16, borderRadius:"50%", background:"rgba(255,255,255,.22)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:900, lineHeight:1, flexShrink:0 }}>✓</span>
              Cerrar compra
            </button>
          </div>
        )}

        {showCompleted && checked.map(item => (
          <SwipeItem key={item.id} item={item}
            onToggle={(id) => onUpdateItem(id, it => ({ ...it, checked:!it.checked }))}
            onQtyMinus={(id) => onUpdateItem(id, it => ({ ...it, qty:Math.max(1,(it.qty||1)-1) }))}
            onQtyPlus={(id)  => onUpdateItem(id, it => ({ ...it, qty:(it.qty||1)+1 }))}
            onDelete={onDeleteItem} onContextMenu={setContextItemId}
            editingPriceId={editingPriceId} tempPrice={tempPrice}
            setTempPrice={setTempPrice} setEditingPriceId={setEditingPriceId} savePrice={savePrice}
            sym={sym} />
        ))}
      </div>

      {/* FABs */}
      <button className="wc-fab" onClick={(e) => { ripple(e, "rgba(255,255,255,0.3)"); onGoAdd(); }}>+ Añadir</button>

      <div style={Sth.bottomBar}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color: theme.isDark ? "#64748B" : "#9E9285", fontSize:16, pointerEvents:"none" }}>🔍</span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en lista..."
            style={{ width:"100%", background: theme.isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.80)", border: theme.isDark ? "1px solid #334155" : `1px solid ${theme?.border||"#D8DDD6"}`, borderRadius:22, padding:"9px 16px 9px 36px", color: theme.isDark ? "#E2E8F0" : "#2C2318", fontSize:14, outline:"none", boxSizing:"border-box" }} />
        </div>
      </div>



      {contextItem && (
        <ContextMenu item={contextItem} sym={sym}
          onClose={() => setContextItemId(null)}
          onDelete={() => { onDeleteItem(contextItem.id); setContextItemId(null); }}
          onDuplicate={() => { const copy={...contextItem,id:genId(),name:contextItem.name+" (copia)"}; onUpdateItem(null,null,copy); setContextItemId(null); }}
          onEdit={() => { setEditingItem({...contextItem}); setContextItemId(null); }} />
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
  const Sth = makeStyles(theme);
  const [search,       setSearch]      = useState("");
  const [category,     setCategory]    = useState("Todos");
  const [customEmoji,  setCustomEmoji] = useState("🛒");
  const [customName,   setCustomName]  = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const filtered = PRESET_ITEMS.filter(p => {
    const inCat    = category==="Todos" || p.category===category;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const added    = list.items.some(it => it.name===p.name);
    return inCat && inSearch && !added;
  });

  const addPreset = (p, e) => { Sounds.addItem(); if(e){ const r=e.currentTarget.getBoundingClientRect(); spawnEmojiParticle(r.left+r.width/2, r.top, p.emoji); ripple(e,"rgba(var(--accent-rgb),0.18)"); } onAddItem({ id:genId(), name:p.name, emoji:p.emoji, category:p.category, checked:false, price:String(CR_PRICES[p.name]||""), qty:1, unit:"pza", note:"" }); };
  const addCustom = (e) => {
    if (!customName.trim()) return;
    Sounds.addItem();
    if(e){ const r=e.currentTarget.getBoundingClientRect(); spawnEmojiParticle(r.left+r.width/2, r.top, customEmoji); ripple(e,"rgba(255,255,255,0.3)"); }
    onAddItem({ id:genId(), name:customName.trim(), emoji:customEmoji, category:"Otros", checked:false, price:"", qty:1, unit:"pza", note:"" });
    setCustomName(""); setCustomEmoji("🛒"); setShowEmojiPicker(false);
  };

  return (
    <>
      {/* ── Header ── */}
      <div style={Sth.header}>
        <button onClick={() => { Sounds.navBack(); onBack(); }} style={{ background:"none", border:"none", color:"var(--accent)", cursor:"pointer", padding:"4px 8px 4px 0", display:"flex", alignItems:"center", borderRadius:10, transition:"opacity .15s" }} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
          <IconChevronLeft size={22} strokeWidth={2.5} color="var(--accent)" />
        </button>
        <span style={{ flex:1, fontWeight:800, fontSize:18, color: theme.isDark ? "#E2E8F0" : "#1A2118" }}>Agregar artículos</span>
        <button onClick={() => { Sounds.save(); onBack(); }}
          style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:20, padding:"7px 16px", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", boxShadow:"0 2px 8px rgba(22,163,74,0.28)" }}>
          Listo ✓
        </button>
      </div>

      {/* ── Custom item row ── */}
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid #EBE8E2", background:"rgba(255,255,255,0.55)", backdropFilter:"blur(12px)" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9E9285", letterSpacing:".06em", textTransform:"uppercase", marginBottom:10 }}>Artículo personalizado</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Big emoji button */}
          <button onClick={() => setShowEmojiPicker(v => !v)}
            style={{ width:52, height:52, background: showEmojiPicker ? "var(--accent)" : "#EDE8DF", border: showEmojiPicker ? "2px solid var(--accentDark)" : "2px solid transparent", borderRadius:16, fontSize:26, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", boxShadow: showEmojiPicker ? "0 2px 12px rgba(var(--accent-rgb,34,197,94),0.28)" : "none" }}>
            {customEmoji}
          </button>
          <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => e.key==="Enter" && addCustom()}
            placeholder="Nombre del artículo..."
            style={{ flex:1, background:"rgba(255,255,255,0.80)", border:"1.5px solid var(--border)", borderRadius:"var(--radius-md,16px)", padding:"13px 14px", color:"#1A2118", fontSize:15, fontWeight:600, outline:"none", transition:"border-color .15s, box-shadow .15s", fontFamily:"inherit" }}
            onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow="0 0 0 3px var(--soft)"; }}
            onBlur={e  => e.target.style.borderColor="#D8DDD6"} />
          <button onClick={(e) => addCustom(e)}
            style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:14, width:52, height:52, fontSize:26, color:"#fff", fontWeight:900, cursor:"pointer", flexShrink:0, boxShadow:"0 2px 10px rgba(22,163,74,0.30)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            +
          </button>
        </div>

        {/* ── Emoji palette (slides open) ── */}
        {showEmojiPicker && (
          <div style={{ marginTop:12, background:"rgba(255,255,255,0.8)", border:"1px solid #E8E2D8", borderRadius:16, padding:"12px 10px", animation:"fadeIn .15s ease" }}>
            <div style={{ fontSize:10, color:"#B0A898", fontWeight:700, letterSpacing:".06em", textTransform:"uppercase", marginBottom:8, paddingLeft:2 }}>Elige un ícono</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
              {EMOJI_PALETTE.map(em => (
                <button key={em} onClick={() => { setCustomEmoji(em); setShowEmojiPicker(false); }}
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
      <div style={{ padding:"10px 16px 6px" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Buscar artículo..."
          style={{ width:"100%", background: theme.isDark ? "rgba(30,41,59,0.7)" : "rgba(255,255,255,0.80)", border:`1.5px solid ${theme.isDark ? "rgba(99,102,241,0.20)" : theme.border}`, borderRadius:"var(--radius-md,16px)", padding:"11px 16px", color: theme.isDark ? "#E2E8F0" : "#1A2118", fontSize:14, fontWeight:500, outline:"none", boxSizing:"border-box", transition:"border-color .15s, box-shadow .15s" }}
          onFocus={e => { e.target.style.borderColor="var(--accent)"; e.target.style.boxShadow=`0 0 0 3px ${theme.tagBg}`; }}
          onBlur={e  => { e.target.style.borderColor=theme.isDark ? "rgba(99,102,241,0.20)" : theme.border; e.target.style.boxShadow="none"; }} />
      </div>

      {/* ── Category chips ── */}
      <div style={{ display:"flex", overflowX:"auto", gap:7, padding:"6px 16px 10px", scrollbarWidth:"none" }}>
        {["Todos",...CATEGORIES].map(cat => {
          const CatIcon = CAT_ICONS[cat];
          return (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{ borderRadius:99, border:"none", padding:"5px 12px 5px 6px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, display:"flex", alignItems:"center", gap:5,
              background: category===cat ? "var(--accent)" : theme.isDark ? "rgba(255,255,255,0.07)" : theme.tagBg,
              color: category===cat ? "#fff" : theme.isDark ? "#94A3B8" : theme.tagColor,
              transition:"background .12s, color .12s, transform .1s",
              boxShadow: category===cat ? `0 2px 10px ${theme.pillBorder}` : "none",
            }}
            onMouseEnter={e => { if(category!==cat) e.currentTarget.style.background=theme.isDark ? "rgba(255,255,255,0.12)" : theme.pillBg; }}
            onMouseLeave={e => { if(category!==cat) e.currentTarget.style.background=theme.isDark ? "rgba(255,255,255,0.07)" : theme.tagBg; }}>
            {CatIcon && <span style={{display:"inline-flex",opacity:category===cat?1:0.8,filter:category===cat?"brightness(10)":""}}>{CatIcon(20)}</span>}
            {cat}
          </button>
          );
        })}
      </div>

      {/* ── Preset items list ── */}
      <div style={{ overflowY:"auto", flex:1 }}>
        {filtered.length===0 ? (
          <div style={{ fontSize:14, color:"#B0A898", padding:"32px 20px", textAlign:"center" }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🔍</div>
            No hay más artículos aquí
          </div>
        ) : (
          filtered.map(p => {
            const crp = CR_PRICES[p.name];
            return (
              <button key={p.name} onClick={(e) => addPreset(p,e)}
                className="preset-item-btn"
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"12px 16px", background: theme.isDark ? "rgba(30,41,59,0.55)" : "rgba(255,255,255,0.65)", border:"none", borderBottom:`1px solid ${theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`, cursor:"pointer", color: theme.isDark ? "#E2E8F0" : "#1A2118", textAlign:"left", transition:"background .12s ease" }}
                onMouseEnter={e => e.currentTarget.style.background=theme.isDark ? "rgba(99,102,241,0.12)" : theme.tagBg}
                onMouseLeave={e => e.currentTarget.style.background=theme.isDark ? "rgba(30,41,59,0.55)" : "rgba(255,255,255,0.65)"}
                onTouchStart={e => e.currentTarget.style.background=theme.isDark ? "rgba(99,102,241,0.15)" : theme.pillBg}
                onTouchEnd={e   => e.currentTarget.style.background=theme.isDark ? "rgba(30,41,59,0.55)" : "rgba(255,255,255,0.65)"}>
                <ItemIcon name={p.name} category={p.category} emoji={p.emoji} size={36} emojiSize={26}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontSize:14, fontWeight:700 }}>{p.name}</span>
                  <span style={{ fontSize:11, color:"var(--accent)", fontWeight:600, opacity:0.85 }}>{p.category}</span>
                </div>
                {crp && <span style={{ fontSize:12, color: theme.isDark ? "#a5b4fc" : theme.tagColor, fontWeight:800, background: theme.tagBg, borderRadius:"var(--radius-sm,10px)", padding:"2px 9px", flexShrink:0 }}>{sym}{crp.toLocaleString()}</span>}
                <div style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", color:"#fff", width:30, height:30, borderRadius:"var(--radius-sm,10px)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, flexShrink:0, boxShadow:`0 2px 8px ${theme.pillBorder}` }}>+</div>
              </button>
            );
          })
        )}
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
const fmtAmt = (n, sym) =>
  n >= 10000 ? `${sym}${(n / 1000).toFixed(0)}k` : `${sym}${Math.round(n).toLocaleString()}`;
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(var(--accent-rgb),0.14)" strokeWidth={stroke} />
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
  const maxVal = Math.max(...bars.map((s) => s.total), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80, paddingBottom: 20, position: "relative" }}>
      {bars.map((s, i) => {
        const pct = (s.total / maxVal) * 100;
        const isLast = i === bars.length - 1;
        return (
          <div key={s.date + i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
            <div
              title={`${fmtShortDate(s.date)}: ${fmtAmt(s.total, sym)}`}
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
  const totals = sessions.map((s) => s.total);
  const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
  const last = totals[totals.length - 1];
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

  if (budgetNum > 0) {
    const total = totals.reduce((a, b) => a + b, 0);
    const cap = budgetNum * 4.33;
    if (total > cap * 0.9)
      return { icon: "🔥", text: `Cerca del tope: llevás ${fmtAmt(total, sym)} de ${fmtAmt(cap, sym)} en el período.`, color: "#f87171" };
  }
  if (trend > avg * 0.15)
    return { icon: "📈", text: `Tus últimas 3 compras muestran un alza. Considerá revisar el presupuesto.`, color: "#fb923c" };
  if (trend < -avg * 0.15)
    return { icon: "📉", text: `Tus últimas 3 compras están bajando. ¡Buen control del gasto!`, color: "var(--accent)" };
  if (topItem && topItem[1] >= 3)
    return { icon: "🔁", text: `"${topItem[0]}" aparece ${topItem[1]}× en este período — tu ítem más recurrente.`, color: "#a5b4fc" };
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
      .reduce((a, s) => a + s.total, 0);

  const thisW = weekTotal(w0start, new Date(w0start.getTime() + 7 * 86400000));
  const lastW = weekTotal(w1start, w0start);
  const prevW = weekTotal(w2start, w1start);
  const maxW = Math.max(thisW, lastW, prevW, 1);

  const bars = [
    { label: "Hace 2 sem", val: prevW, color: "rgba(var(--accent-rgb),0.12)" },
    { label: "Sem pasada", val: lastW, color: "rgba(var(--accent-rgb),0.22)" },
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
          {parseFloat(delta) > 0 ? `▲ ${delta}% vs sem. pasada` : `▼ ${Math.abs(delta)}% vs sem. pasada`}
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
  const total = useMemo(() => sessions.reduce((a, s) => a + s.total, 0), [sessions]);
  const avgTicket = sessions.length > 0 ? total / sessions.length : 0;

  // prev-period delta (solo para "month")
  const prevTotal = useMemo(() => {
    if (period !== "month") return null;
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pmEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    return history
      .filter((s) => { const d = new Date(s.date); return d >= pm && d < pmEnd; })
      .reduce((a, s) => a + s.total, 0);
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

  // Budget %
  const budgetCap = period === "month" ? budgetNum * 4.33 : period === "q3" ? budgetNum * 13 : null;
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
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };
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
    <div style={{ padding: "0 0 32px" }}>

      {/* ── Period tabs ── */}
      <div style={{
        display: "flex", gap: 0, background: "var(--headerBg)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--cardBorder)",
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
          <div style={{ ...cardStyle, gridColumn: "1 / -1", background: "linear-gradient(135deg,rgba(var(--accent-rgb),0.13),rgba(var(--accent-rgb),0.05))", border: "1.5px solid rgba(var(--accent-rgb),0.22)" }}>
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
                  {parseFloat(delta) > 0 ? `▲ ${delta}%` : `▼ ${Math.abs(delta)}%`} vs mes ant.
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
            <div style={{ height: 6, background: "rgba(var(--accent-rgb),0.12)", borderRadius: 3, overflow: "hidden" }}>
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
                    background: "rgba(var(--accent-rgb),0.10)", borderRadius: 8,
                    padding: "2px 8px",
                  }}>
                    {fmtAmt(s.total, sym)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


// ── Theme tokens ──────────────────────────────────────────────────────────────
// Green: Pistachio palette  |  Pink: Blush/petal palette  |  Moon: Blueberry palette
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
    surface:     "rgba(245,239,228,0.92)", // Almond Beige surface
    cardBg:      "rgba(255,252,245,0.88)",
    cardBorder:  "rgba(167,212,90,0.30)",
    tagBg:       "rgba(94,171,47,0.13)",
    tagColor:    "#3D6B1E",
    pillBg:      "rgba(167,212,90,0.22)",
    pillBorder:  "rgba(94,171,47,0.35)",
    ginghamTile: "rgba(167,212,90,0.38)", // gingham band color
    ginghamBg:   "#F5EFE4",
    daisyColor:  "white",
    dashColor:   "rgba(255,255,255,0.60)",
    textPrimary: "#2C2010",
    textMuted:   "#6B5A3A",
    headerBg:    "rgba(245,239,228,0.90)",
    navBg:       "rgba(245,239,228,0.94)",
    sheetBg:     "rgba(249,245,237,0.97)",
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
    surface:     "rgba(255,245,247,0.92)",
    cardBg:      "rgba(255,250,252,0.90)",
    cardBorder:  "rgba(240,160,184,0.28)",
    tagBg:       "rgba(212,96,122,0.12)",
    tagColor:    "#8A2040",
    pillBg:      "rgba(240,160,184,0.24)",
    pillBorder:  "rgba(212,96,122,0.32)",
    ginghamTile: "rgba(240,160,184,0.38)", // Blush Pink band
    ginghamBg:   "#FFF5F7",
    daisyColor:  "white",
    dashColor:   "rgba(255,255,255,0.65)",
    textPrimary: "#2A1520",
    textMuted:   "#7A4558",
    headerBg:    "rgba(255,245,247,0.90)",
    navBg:       "rgba(255,245,247,0.94)",
    sheetBg:     "rgba(255,248,251,0.97)",
    label:       "🌸",
    isDark:      false,
    accentRgb:   "212,96,122",
  },
  moon: {
    // Blueberry palette
    checkerBg:   "#151A35",          // Blueberry Black — deep base
    checker:     "#273F8A",          // Indigo Berry — gingham tile
    accent:      "#6279C8",          // Periwinkle Blue — primary
    accentDark:  "#4F73C7",          // Cornflower Blue
    accentLight: "#7298D9",          // Blueberry Bloom
    soft:        "#1C285E",          // Midnight Blue surface
    border:      "#315CB4",          // Sapphire Blue border
    surface:     "rgba(28,40,94,0.92)",
    cardBg:      "rgba(27,34,80,0.85)",
    cardBorder:  "rgba(98,121,200,0.22)",
    tagBg:       "rgba(98,121,200,0.20)",
    tagColor:    "#C8D7E8",
    pillBg:      "rgba(79,115,199,0.22)",
    pillBorder:  "rgba(98,121,200,0.35)",
    ginghamTile: "rgba(79,115,199,0.18)",
    ginghamBg:   "#151A35",
    daisyColor:  "%23C8D7E8",        // Ice Crystal Blue (URL encoded)
    dashColor:   "rgba(200,215,232,0.18)",
    textPrimary: "#E8EDF3",          // Arctic Mist
    textMuted:   "#9CC4F2",          // Glacier Blue
    headerBg:    "rgba(21,26,53,0.94)",
    navBg:       "rgba(21,26,53,0.96)",
    sheetBg:     "rgba(21,26,53,0.98)",
    label:       "🌙",
    isDark:      true,
    accentRgb:   "98,121,200",
  },
};

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

  useEffect(() => { LS.set("sl5_lists",    lists);    }, [lists]);
  useEffect(() => { LS.set("sl5_settings", settings); }, [settings]);
  useEffect(() => { LS.set("sl5_profile",  profile);  }, [profile]);
  useEffect(() => { LS.set("sl5_history",  history);  }, [history]);
  useEffect(() => { LS.set("sl5_theme",    themeName); }, [themeName]);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", themeName);
    return () => document.documentElement.removeAttribute("data-theme");
  }, [themeName]);

  // ── Android hardware back-button handler ──────────────────────────────────
  // Strategy:
  //   • On mount, push ONE guard entry so the first popstate is always ours.
  //   • Use a ref for all navigation state so the single listener never goes
  //     stale — no re-registration, no extra pushState calls on re-renders.
  //   • On intentional exit, set a flag so the re-push is skipped, then call
  //     go(-1) to let the WebView/TWA close naturally.

  const navStateRef = useRef({ view: "lists", showProfile: false });
  const intentionalExitRef = useRef(false);

  // Keep the ref in sync with state (no re-render cost)
  useEffect(() => { navStateRef.current = { view, showProfile }; }, [view, showProfile]);

  useEffect(() => {
    // Single guard entry — pushed exactly once on mount
    window.history.pushState({ sl: true }, "");

    const handlePopState = () => {
      // If we signalled an intentional exit, don't re-push — let it close
      if (intentionalExitRef.current) return;

      // Re-push the guard so the next back press is also intercepted
      window.history.pushState({ sl: true }, "");

      // Read current nav state from ref (always fresh, no stale closure)
      const { view: currentView, showProfile: currentShowProfile } = navStateRef.current;

      // 1. Profile modal → close it
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

      // 5. Already at root ─────────────────────────────────────────────────
      if (exitToastTimer.current) {
        // Second press within 2.4 s → exit for real
        clearTimeout(exitToastTimer.current);
        exitToastTimer.current = null;
        setShowExitToast(false);
        // Signal that the next popstate should not re-push
        intentionalExitRef.current = true;
        // Pop the guard entry we just re-pushed; this fires popstate once
        // more but intentionalExitRef prevents re-push, allowing the WebView
        // to naturally close / navigate away.
        window.history.go(-1);
        return;
      }

      // First press at root → show "press again to exit" hint
      setShowExitToast(true);
      exitToastTimer.current = setTimeout(() => {
        setShowExitToast(false);
        exitToastTimer.current = null;
      }, 2400);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (exitToastTimer.current) clearTimeout(exitToastTimer.current);
    };
  }, []); // ← empty deps: register once, read state via ref

  const theme = THEMES[themeName];
  const [themeReveal, setThemeReveal] = useState(false);
  const toggleTheme = () => {
    setThemeReveal(true);
    setTimeout(() => setThemeReveal(false), 500);
    setThemeName(t => t === "green" ? "pink" : t === "pink" ? "moon" : "green");
  };

  const activeList = lists.find(l => l.id===activeListId);
  const sym = settings.currencyCode==="CRC" ? "₡" : settings.currencyCode==="EUR" ? "€" : settings.currencyCode==="GBP" ? "£" : "$";
  const Sd = makeStyles(theme); // dynamic styles for this render

  const updateItem = (id, fn, newItem) => setLists(prev => prev.map(l =>
    l.id===activeListId ? { ...l, items: newItem ? [...l.items,newItem] : id ? l.items.map(it=>it.id===id?fn(it):it) : l.items } : l
  ));
  const deleteItem = (id)   => setLists(prev => prev.map(l => l.id===activeListId ? { ...l, items:l.items.filter(it=>it.id!==id) } : l));
  const addItem    = (item) => setLists(prev => prev.map(l => l.id===activeListId ? { ...l, items:[...l.items,item] } : l));

  const closeSession = (session) => {
    setHistory(prev => [...prev, session]);
    // Desmarcar todos los artículos de la bolsa después de cerrar
    setLists(prev => prev.map(l => l.id===activeListId
      ? { ...l, items: l.items.map(it => ({ ...it, checked: false })) }
      : l
    ));
  };

  return (
    <>
      {/* ── Confetti / particle root — fixed overlay, pointer-events:none ── */}
      <div id="sl-confetti-root" style={{ position:"fixed", inset:0, zIndex:9999, pointerEvents:"none", overflow:"hidden" }} />

      {/* ── Theme switch radial reveal ── */}
      {themeReveal && (
        <div style={{
          position:"fixed", inset:0, zIndex:9998, pointerEvents:"none",
          background: themeName === "pink"
            ? "linear-gradient(160deg,#fff0f6,#fce7f3)"
            : themeName === "moon"
            ? "linear-gradient(160deg,#0F172A,#1e1b4b)"
            : "linear-gradient(160deg,#f0fdf4,#dcfce7)",
          animation:"slThemeReveal 0.5s cubic-bezier(.22,1,.36,1) forwards",
        }} />
      )}

      {/* ── Watercolor Google Fonts ── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Caveat:wght@400;500;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />

      <style>{`

/* ══════════════════════════════════════════════════════════════════════════════
   SuperLista — Gingham & Watercolor Design System  v3
   Three themes: Pistachio (green) · Sakura (pink) · Blueberry (moon)
   Each theme uses its own botanical color palette for every surface.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Reset ─────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
input, select, button { font-family: inherit; }
::-webkit-scrollbar { width: 0; }

/* ── Design tokens ─────────────────────────────────────────────────── */
:root {
  --font-hand:  'Caveat', cursive;
  --font-body:  'Nunito', sans-serif;
  --font-serif: 'Lora', serif;
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
  --cardBg:      rgba(255,252,245,0.88);
  --cardBorder:  rgba(167,212,90,0.30);
  --textPrimary: #2C2010;
  --textMuted:   #6B5A3A;
  --navBg:       rgba(245,239,228,0.94);
  --headerBg:    rgba(245,239,228,0.90);
  --sheetBg:     rgba(249,245,237,0.97);
  --pillBg:      rgba(167,212,90,0.22);
  --pillBorder:  rgba(94,171,47,0.35);
  --tagBg:       rgba(94,171,47,0.13);
  --tagColor:    #3D6B1E;
  --accent-rgb:  94,171,47;
}

/* ══════════════════════════════════════════════════════════════════════
   GINGHAM BACKGROUNDS — CSS-variable driven, changes instantly on theme switch
   data-theme is set on <html>, so :root vars cascade down to body.
   ══════════════════════════════════════════════════════════════════════ */

/* ── Background token defaults: 🌿 Pistachio ───────────────────────── */
:root {
  --bg-base:       #F1E6D5;  /* Almond Beige */
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
  --bg-band:       rgba(240,160,184,0.38);  /* Ballet Slipper Pink gingham */
  --bg-seam:       rgba(255,255,255,0.72);  /* white stitched seam */
  --bg-bloom1:     rgba(255,240,248,0.80);  /* Powder Pink top-right */
  --bg-bloom2:     rgba(255,220,235,0.40);  /* Cotton Candy bottom-left */
  --bg-bloom1-pos: 72% 4%;
  --bg-bloom2-pos: 5% 96%;
  /* daisy SVG — sakura: white petals, Rosewater center */
  --bg-daisy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cg transform='translate(40,40) rotate(-14)'%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(0)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(40)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(80)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(120)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(160)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(200)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(240)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(280)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23FFFAFC' opacity='0.97' transform='rotate(320)'/%3E%3Ccircle cx='0' cy='0' r='7' fill='%23F0A0B8'/%3E%3Ccircle cx='0' cy='0' r='4' fill='%23D4607A' opacity='0.50'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── Background token overrides: 🌙 Blueberry ──────────────────────── */
[data-theme="moon"] {
  --bg-base:       #151A35;  /* Blueberry Black */
  --bg-band:       rgba(79,115,199,0.18);   /* Cornflower Blue gingham */
  --bg-seam:       rgba(156,196,242,0.14);  /* Glacier Blue seam */
  --bg-bloom1:     rgba(28,40,94,0.80);     /* Midnight Blue top */
  --bg-bloom2:     rgba(98,121,200,0.10);   /* Periwinkle glow bottom */
  --bg-bloom1-pos: 75% 5%;
  --bg-bloom2-pos: 12% 92%;
  /* daisy SVG — blueberry: Ice Crystal Blue petals, Periwinkle center */
  --bg-daisy: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cg transform='translate(40,40) rotate(8)'%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(0)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(40)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(80)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(120)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(160)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(200)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(240)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(280)'/%3E%3Cellipse cx='0' cy='-13' rx='4.5' ry='8.5' fill='%23C8D7E8' opacity='0.20' transform='rotate(320)'/%3E%3Ccircle cx='0' cy='0' r='7' fill='%236279C8' opacity='0.45'/%3E%3Ccircle cx='0' cy='0' r='4' fill='%234F73C7' opacity='0.30'/%3E%3C/g%3E%3C/svg%3E");
}

/* ── SINGLE body rule — reads vars, works for ALL three themes ──────── */
body {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  color: var(--textPrimary);
  min-height: 100vh;
  background-color: var(--bg-base);
  background-image:
    var(--bg-daisy),
    repeating-linear-gradient(0deg,
      var(--bg-band) 0px, var(--bg-band) 80px,
      transparent 80px, transparent 160px),
    repeating-linear-gradient(90deg,
      var(--bg-band) 0px, var(--bg-band) 80px,
      transparent 80px, transparent 160px),
    radial-gradient(ellipse 55% 42% at var(--bg-bloom1-pos), var(--bg-bloom1) 0%, transparent 100%),
    radial-gradient(ellipse 50% 40% at var(--bg-bloom2-pos), var(--bg-bloom2) 0%, transparent 100%);
  background-size:    160px 160px, 160px 160px, 160px 160px, 100% 100%, 100% 100%;
  background-position: 40px 40px,  0 0,          0 0,          0 0,        0 0;
  transition: background-color 0.55s ease;
}

/* Painted grain overlay — static CSS noise, no SVG filter paint cost */
body::before {
  content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image: url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABAAQMAAACQp+OdAAAABlBMVEUAAAAAAAClZ7nPAAAAAnRSTlP/AOW3MEoAAAAaSURBVBjTY2AYBaNgFIyCUTAKRgEZBQABIAABd+5ciwAAAABJRU5ErkJggg==");
  background-size: 64px 64px; opacity: 0.045;
}

/* Dashed stitched seams — color changes via CSS var */
body::after {
  content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  background-image:
    repeating-linear-gradient(90deg,
      transparent 0px, transparent 78px,
      var(--bg-seam) 78px, var(--bg-seam) 82px,
      transparent 82px, transparent 160px),
    repeating-linear-gradient(0deg,
      transparent 0px, transparent 78px,
      var(--bg-seam) 78px, var(--bg-seam) 82px,
      transparent 82px, transparent 160px);
  background-size: 160px 160px;
}

/* Moon dark text override — already in vars but ensure body picks it up */
[data-theme="moon"] body { color: #E8EDF3; }

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
    0 1px 3px  rgba(0,0,0,0.04),
    inset 0 1px 0 rgba(255,255,255,0.80);
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

/* ── Moon card overrides */
[data-theme="moon"] .wc-card,
[data-theme="moon"] .list-card {
  background: var(--cardBg);
  border-color: var(--cardBorder);
  box-shadow:
    0 4px 24px rgba(0,0,0,0.35),
    0 1px 4px  rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.06);
}

/* ── Item rows ─────────────────────────────────────────────────────── */
.wc-item-row {
  border-radius: var(--radius-md);
  padding: 10px 12px; margin: 4px 0;
  background: rgba(255,255,255,0.45);
  border: 1px solid rgba(0,0,0,0.06);
  transition: background 0.15s ease, transform 0.12s ease;
  animation: itemIn 0.28s var(--ease-spring) both;
}

.wc-item-row:active { transform:scale(0.997); }

[data-theme="moon"] .wc-item-row {
  background: rgba(28,40,94,0.55);
  border-color: rgba(98,121,200,0.15);
}

/* ── Buttons ────────────────────────────────────────────────────────── */
.wc-btn-primary {
  font-family:var(--font-body); font-weight:800; font-size:15px;
  border:none; border-radius:var(--radius-md); padding:13px 20px;
  cursor:pointer;
  background: linear-gradient(145deg, var(--accent), var(--accentDark));
  color:white;
  box-shadow:
    0 5px 18px rgba(var(--accent-rgb),0.32),
    inset 0 1px 0 rgba(255,255,255,0.25);
  transition: transform 0.16s var(--ease-spring), box-shadow 0.16s ease;
  position:relative; overflow:hidden;
}
.wc-btn-primary::after {
  content:''; position:absolute; top:0; left:-80%;
  width:60%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.20),transparent);
  opacity:0;
}
.wc-btn-primary:active { transform:scale(0.94); }

.wc-btn-ghost {
  font-family:var(--font-body); font-weight:600; font-size:14px;
  border: 1.5px solid var(--border); border-radius:var(--radius-md);
  padding:11px 18px; cursor:pointer;
  background:rgba(255,255,255,0.72); color:var(--textMuted);
  transition: all 0.15s ease;
}
.wc-btn-ghost:active { background:rgba(255,255,255,0.75); transform:scale(0.97); }

[data-theme="moon"] .wc-btn-ghost {
  background: rgba(28,40,94,0.50);
  border-color: rgba(98,121,200,0.30);
  color: #9CC4F2;
}

/* ── Inputs ─────────────────────────────────────────────────────────── */
.wc-input {
  font-family:var(--font-body); font-size:15px; width:100%;
  padding:12px 14px; border-radius:var(--radius-md);
  border: 1.5px solid var(--border);
  background: rgba(255,255,255,0.60); color:var(--textPrimary);
  outline:none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.04);
}
.wc-input:focus {
  border-color: var(--accent);
  background: rgba(255,255,255,0.90);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb),0.14), inset 0 1px 3px rgba(0,0,0,0.03);
}
.wc-input::placeholder { color:var(--textMuted); font-style:italic; opacity:0.7; }

[data-theme="moon"] .wc-input {
  background: rgba(28,40,94,0.55); border-color: rgba(98,121,200,0.30); color:#E8EDF3;
}
[data-theme="moon"] .wc-input:focus { background:rgba(28,40,94,0.80); }
[data-theme="moon"] .wc-input::placeholder { color:#6279C8; }

/* ── Header / Nav bars ─────────────────────────────────────────────── */
.wc-header {
  display:flex; align-items:center;
  padding:14px 16px 12px;
  background: var(--headerBg);
  backdrop-filter:blur(24px) saturate(180%); -webkit-backdrop-filter:blur(24px) saturate(180%);
  border-bottom:1px solid var(--cardBorder);
  box-shadow: 0 2px 16px rgba(0,0,0,0.05), inset 0 -1px 0 rgba(255,255,255,0.5);
  position:sticky; top:0; z-index:10; gap:10px;
}

.wc-bottom-nav {
  position:fixed; bottom:0; left:50%; transform:translateX(-50%);
  width:430px; max-width:100%;
  background:var(--navBg);
  backdrop-filter:blur(32px) saturate(200%); -webkit-backdrop-filter:blur(32px) saturate(200%);
  border-top:1.5px solid var(--cardBorder);
  box-shadow: 0 -4px 28px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.65);
  display:flex; align-items:center;
  padding-bottom:env(safe-area-inset-bottom,8px); padding-top:8px; z-index:20;
}

[data-theme="moon"] .wc-header,
[data-theme="moon"] .wc-bottom-nav { border-color:rgba(98,121,200,0.20); }

/* ── Bottom Sheet / Modal ─────────────────────────────────────────── */
.wc-sheet {
  background:var(--sheetBg);
  backdrop-filter:blur(36px) saturate(200%); -webkit-backdrop-filter:blur(36px) saturate(200%);
  border-radius:28px 28px 0 0;
  border:1px solid rgba(255,255,255,0.80); border-bottom:none;
  box-shadow: 0 -10px 48px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.90);
}

[data-theme="moon"] .wc-sheet {
  background:rgba(21,26,53,0.98);
  border-color:rgba(98,121,200,0.20);
  box-shadow:0 -10px 48px rgba(0,0,0,0.50);
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
  box-shadow:0 2px 10px rgba(var(--accent-rgb),0.25), inset 0 1px 0 rgba(255,255,255,0.4);
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
  background:var(--tagBg); color:var(--tagColor); border:1px solid rgba(var(--accent-rgb),0.20);
}

/* ── Progress bar ──────────────────────────────────────────────────── */
.wc-progress-track {
  height:7px; border-radius:10px;
  background:rgba(0,0,0,0.08); overflow:hidden;
  box-shadow:inset 0 1px 3px rgba(0,0,0,0.08);
}
[data-theme="moon"] .wc-progress-track { background:rgba(255,255,255,0.08); }

.wc-progress-fill {
  height:100%; border-radius:10px;
  background:linear-gradient(90deg,var(--accent),var(--accentDark));
  transition:width 0.45s var(--ease-out);
  box-shadow:0 1px 6px rgba(var(--accent-rgb),0.42), inset 0 1px 0 rgba(255,255,255,0.28);
  position:relative; overflow:hidden;
}
.wc-progress-fill::after {
  content:''; position:absolute; top:0; left:0; right:0; bottom:0;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.20),transparent);
  opacity:0;
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
.wc-context-menu { background:var(--sheetBg); backdrop-filter:blur(32px); -webkit-backdrop-filter:blur(32px); border-radius:28px 28px 0 0; border:1px solid rgba(255,255,255,0.85); box-shadow:0 -8px 40px rgba(0,0,0,0.12); animation:slideUp .22s var(--ease-out); }

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
  from { opacity:0; transform:translateY(24px); }
  to   { opacity:1; transform:translateY(0); }
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
  0%,100% { box-shadow:0 6px 24px rgba(var(--accent-rgb),0.42),0 2px 6px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.25); }
  50%     { box-shadow:0 8px 32px rgba(var(--accent-rgb),0.62),0 2px 6px rgba(0,0,0,0.12),inset 0 1px 0 rgba(255,255,255,0.25); }
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

/* ── View transitions ───────────────────────────────────────────────── */
@keyframes viewEnterFwd {
  from { opacity:0; transform:translateX(26px) scale(0.991); }
  to   { opacity:1; transform:translateX(0) scale(1); }
}
@keyframes viewEnterBack {
  from { opacity:0; transform:translateX(-26px) scale(0.991); }
  to   { opacity:1; transform:translateX(0) scale(1); }
}
.view-enter-fwd  { animation: viewEnterFwd  0.30s var(--ease-out) both; }
.view-enter-back { animation: viewEnterBack 0.30s var(--ease-out) both; }

/* ── Exit toast entrance ────────────────────────────────────────────── */
@keyframes slExitToast {
  0%   { opacity:0; transform:translateX(-50%) translateY(14px) scale(0.90); }
  60%  { transform:translateX(-50%) translateY(-3px) scale(1.03); }
  100% { opacity:1; transform:translateX(-50%) translateY(0) scale(1); }
}

/* ── Accessibility & global polish ─────────────────────────────────── */
html { scroll-behavior: smooth; }
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
.wc-fab {
  position:fixed; bottom:70px; left:50%; transform:translateX(-50%);
  background:linear-gradient(145deg, var(--accent), var(--accentDark));
  color:#fff; border:none; border-radius:28px;
  padding:13px 32px; font-size:15px; font-weight:800;
  cursor:pointer; z-index:21; font-family:var(--font-body);
  box-shadow:
    0 6px 24px rgba(var(--accent-rgb),0.42),
    0 2px 6px  rgba(0,0,0,0.12),
    inset 0 1px 0 rgba(255,255,255,0.25);
  transition:transform 0.20s var(--ease-spring), box-shadow 0.20s ease;
  overflow:hidden; letter-spacing:0.02em;
}
.wc-fab::after {
  content:''; position:absolute; top:0; left:-80%; width:60%; height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent);
  animation:shimmer 2.8s ease-in-out infinite;
}
/* heartbeat breathe */
.wc-fab { animation: slFabBreath 2.6s ease-in-out infinite; }
.wc-fab:hover:not(:active),
.wc-fab:active { animation: none; }
.wc-fab:hover:not(:active) {
  transform:translateX(-50%) translateY(-2px);
  box-shadow:
    0 10px 30px rgba(var(--accent-rgb),0.52),
    0 2px 8px rgba(0,0,0,0.14),
    inset 0 1px 0 rgba(255,255,255,0.28);
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
  box-shadow:0 8px 28px rgba(0,0,0,0.09), inset 0 1px 0 rgba(255,255,255,0.85);
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

/* Dynamic injected vars (overwritten at runtime) ───────────────── */
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
        }
        .flip-card-front { background:${theme.soft}; border:1px solid ${theme.border}; }
        .flip-card-back  { background:${theme.soft}; border:1px solid ${theme.border}; transform:rotateY(180deg); }
      `}</style>

      {/* ── Crayon-paper grain overlay ── */}
      <div className="crayon-grain" />

      {/* ── Theme toggle pill ── */}
      <button
        onClick={(e) => { Sounds.themeToggle(); ripple(e, "rgba(255,255,255,0.4)"); toggleTheme(); }}
        title={themeName === "green" ? "Cambiar a rosa 🌸" : themeName === "pink" ? "Cambiar a modo luna 🌙" : "Cambiar a verde 🌿"}
        style={{
          position:"fixed", bottom:90, right:16, zIndex:50,
          background: themeName === "green"
            ? "linear-gradient(135deg,#f9a8d4,#ec4899)"
            : themeName === "pink"
            ? "linear-gradient(135deg,#818cf8,#6366f1)"
            : "linear-gradient(135deg,#86efac,#22c55e)",
          border:"none", borderRadius:100,
          width:44, height:44,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:20, cursor:"pointer",
          boxShadow:"0 3px 12px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.3)",
          transition:"background .4s ease, transform .18s cubic-bezier(0.34,1.4,0.64,1)",
        }}
        onMouseDown={e  => { e.currentTarget.style.transform="scale(.86)"; }}
        onMouseUp={e    => { e.currentTarget.style.transform="scale(1)"; }}
        onTouchStart={e => { e.currentTarget.style.transform="scale(.86)"; }}
        onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
      >
        {themeName === "green" ? "🌸" : themeName === "pink" ? "🌙" : "🌿"}
      </button>
      <div style={Sd.app}>
        {view==="lists" && (
          <div key="lists" className="view-enter-back">
          <ListsView lists={lists} sym={sym} history={history} budget={profile.budget} themeName={themeName} theme={theme}
            onOpenList={(id) => { setActiveListId(id); setView("list"); }}
            onDeleteList={(id) => setLists(prev => prev.filter(l=>l.id!==id))}
            onCreateList={(name) => { const nl={id:genId(),name,items:[],createdAt:Date.now()}; setLists(prev=>[...prev,nl]); setActiveListId(nl.id); setView("list"); }} />
          </div>
        )}
        {view==="stats" && (
          <div key="stats" className="view-enter-fwd" style={{ flex:1, overflowY:"auto", paddingBottom:80 }}>
            {/* Stats page header */}
            <div style={{
              display:"flex", alignItems:"center", gap:12,
              padding:"16px 16px 12px",
              background:"var(--headerBg)",
              backdropFilter:"blur(24px) saturate(180%)",
              WebkitBackdropFilter:"blur(24px) saturate(180%)",
              borderBottom:"1px solid var(--cardBorder)",
              boxShadow:"0 2px 16px rgba(0,0,0,0.05)",
              position:"sticky", top:0, zIndex:10,
            }}>
              <div style={{ width:40, height:40, borderRadius:14, background:"var(--soft)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <IconChart size={22} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize:17, fontWeight:800, color:"var(--textPrimary)", letterSpacing:"-0.01em" }}>Estadísticas</div>
                <div style={{ fontSize:12, color:"var(--textMuted)", marginTop:1 }}>Tus hábitos de compra</div>
              </div>
            </div>
            <StatsView history={history} budget={profile.budget} sym={sym} />
          </div>
        )}
        {view==="list" && activeList && (
          <div key="list" className="view-enter-fwd">
          <ListView list={activeList} sym={sym} budget={profile.budget} theme={theme}
            onBack={() => { setView("lists"); setActiveListId(null); }}
            onUpdateItem={updateItem} onDeleteItem={deleteItem} onGoAdd={() => setView("addItems")}
            onOpenProfile={() => { setProfileTab("budget"); setShowProfile(true); }}
            onSaveBudget={(val) => setProfile(p => ({ ...p, budget: val }))}
            onCloseSession={closeSession} />
          </div>
        )}
        {view==="addItems" && activeList && (
          <div key="addItems" className="view-enter-fwd">
          <AddItemsView list={activeList} sym={sym} theme={theme} onBack={() => setView("list")} onAddItem={addItem} />
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
          background: "rgba(30,20,10,0.88)",
          backdropFilter: "blur(16px) saturate(160%)",
          WebkitBackdropFilter: "blur(16px) saturate(160%)",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 100,
          fontSize: 14,
          fontWeight: 700,
          fontFamily: "var(--font-body)",
          letterSpacing: "0.01em",
          boxShadow: "0 8px 32px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
          whiteSpace: "nowrap",
          animation: "slExitToast 0.28s cubic-bezier(0.34,1.4,0.64,1) both",
          display: "flex",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: 18 }}>👋</span>
          Presiona atrás de nuevo para salir
        </div>
      )}
    </>
  );
}
