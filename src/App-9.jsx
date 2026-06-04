import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import BunnyG from "./assets/BunnyG.png";
import BunnyP from "./assets/BunnyP.png";

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
const fmtCRC = (n) => n >= 1000 ? `₡${(n/1000).toFixed(n%1000===0?0:1)}k` : `₡${Math.round(n)}`;

// ── Storage ───────────────────────────────────────────────────────────────────
const STORAGE_KEY = "sl5_lists";
const loadLists = () => { try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const saveLists  = (l) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)); } catch {} };

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app: {
    maxWidth: 430, margin: "0 auto", minHeight: "100vh",
    background: "transparent", display: "flex", flexDirection: "column",
    position: "relative", paddingBottom: 76,
    fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#2C2318",
  },
  header: {
    display: "flex", alignItems: "center", padding: "14px 16px 12px",
    background: "rgba(255,255,255,0.60)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderBottom: "1px solid rgba(255,255,255,0.65)",
    boxShadow: "0 1px 12px rgba(80,60,20,0.06)",
    gap: 10,
    position: "sticky", top: 0, zIndex: 10,
  },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  bottomBar: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: 430, maxWidth: "100%",
    background: "rgba(255,255,255,0.70)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    borderTop: "1px solid rgba(255,255,255,0.65)",
    boxShadow: "0 -1px 12px rgba(80,60,20,0.06)",
    display: "flex", alignItems: "center",
    padding: "10px 14px", gap: 10, zIndex: 20,
  },
  fab: {
    position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#FFFFFF",
    border: "none", borderRadius: 28, padding: "13px 28px",
    fontSize: 15, fontWeight: 800, cursor: "pointer", zIndex: 21,
  },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconHome    = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={color}/></svg>;
const IconSearch  = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;
const IconPerson  = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2.2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;
const IconPlus    = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth="2.5" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></svg>;
const IconHistory = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.2"/><polyline points="12 7 12 12 15 15" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ onNewList, onHistory, onProfile, active }) {
  const tabs = [
    { key:"new",     Icon:IconPlus,    label:"Nueva",    onClick:onNewList,  accent:true },
    { key:"history", Icon:IconHistory, label:"Historial",onClick:onHistory,  accent:false },
    { key:"profile", Icon:IconPerson,  label:"Perfil",   onClick:onProfile,  accent:false },
  ];
  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:430, maxWidth:"100%", background:"rgba(255,255,255,0.88)", backdropFilter:"blur(28px) saturate(200%)", WebkitBackdropFilter:"blur(28px) saturate(200%)", borderTop:"1px solid rgba(255,255,255,0.7)", boxShadow:"0 -4px 28px rgba(80,60,20,0.10)", display:"flex", alignItems:"center", paddingBottom:"env(safe-area-inset-bottom,6px)", paddingTop:6, zIndex:20 }}>
      {tabs.map(({ key, Icon, label, onClick, accent }) => {
        const on = active === key;
        return (
          <button key={key} onClick={onClick}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", padding:"5px 0 4px", gap:3 }}>
            <div style={{
              width: accent ? 54 : 46,
              height: accent ? 46 : 38,
              borderRadius: accent ? 16 : 12,
              background: accent
                ? "linear-gradient(135deg,var(--accent),var(--accentDark))"
                : on ? "var(--soft)" : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center",
              transition:"all .18s",
              boxShadow: accent ? "0 4px 14px rgba(22,163,74,0.32)" : "none",
            }}>
              <Icon size={accent ? 22 : 20} color={accent ? "#fff" : on ? "var(--accentDark)" : "#999"} />
            </div>
            <span style={{ fontSize:10, fontWeight: (accent||on) ? 700 : 500, color: accent ? "var(--accentDark)" : on ? "var(--accentDark)" : "#AAA", letterSpacing:".01em" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Top Tabs (Pinterest style) ────────────────────────────────────────────────
function TopTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", borderBottom:"1px solid #E4E8E3", background:"#FDFAF5", paddingLeft:4 }}>
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            background:"none", border:"none", cursor:"pointer",
            padding:"14px 18px 12px", fontSize:15, fontWeight:on?700:400,
            color:on?"#fff":"#555", position:"relative", transition:"color .15s",
          }}>
            {tab.label}
            {on && <span style={{ position:"absolute", bottom:0, left:18, right:18, height:2, background:"#fff", borderRadius:2, display:"block", animation:"underlineIn .2s ease" }} />}
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

function ProfileModal({ profile, settings, onClose, onSaveProfile, onSaveSettings, initialTab }) {
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
    <div style={{ position:"fixed", inset:0, background:"rgba(30,50,30,.25)", zIndex:70, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"rgba(253,248,242,0.88)", backdropFilter:"blur(28px) saturate(180%)", WebkitBackdropFilter:"blur(28px) saturate(180%)", borderRadius:"24px 24px 0 0", border:"1px solid rgba(255,255,255,0.7)", width:"100%", maxWidth:430, animation:"slideUp .25s ease", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", padding:"20px 20px 0", justifyContent:"space-between" }}>
          <div style={{ width:48, height:48, borderRadius:14, background:"#E8E0D3", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconPerson size={24} color="#aaa" />
          </div>
          <div style={{ flex:1, marginLeft:14 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>{profile.name||"Mi Perfil"}</div>
            <div style={{ fontSize:12, color:"#8A8075", marginTop:1 }}>Configuración personal</div>
          </div>
          <button onClick={onClose} style={{ background:"#EDE8DF", border:"none", color:"#8A8075", width:32, height:32, borderRadius:"50%", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>
        <TopTabs tabs={[{id:"profile",label:"Perfil"},{id:"budget",label:"💰 Presupuesto"},{id:"currency",label:"Moneda"}]} active={tab} onChange={setTab} />
        <div style={{ overflowY:"auto", flex:1, padding:20 }}>
          {tab==="profile" && <>
            <EditLabel>Nombre</EditLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="¿Cómo te llaman?" style={editInputStyle} />
          </>}
          {tab==="budget" && <>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:20 }}>
              <div style={{ width:44, height:44, borderRadius:13, background:"#1e3a1e", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>💰</div>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:"#2C2318" }}>Presupuesto de compras</div>
                <div style={{ fontSize:12, color:"#8A8075", marginTop:2 }}>¿Cuánto querés gastar por visita?</div>
              </div>
            </div>

            {/* Big number input */}
            <div style={{ background:"#FDFAF5", borderRadius:16, padding:"16px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, border:"1.5px solid #2a3a2a", transition:"border-color .2s" }}
              onFocus={(e) => e.currentTarget.style.borderColor="#22C55E"}
              onBlur={(e) => e.currentTarget.style.borderColor="#D4F0E0"}>
              <span style={{ color:"#16A34A", fontWeight:900, fontSize:24 }}>{sym}</span>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                style={{ flex:1, background:"none", border:"none", color:"#2C2318", fontSize:30, fontWeight:800, outline:"none", width:"100%" }} />
              {budget && <button onClick={() => setBudget("")}
                style={{ background:"#E8E0D3", border:"none", color:"#8A8075", width:30, height:30, borderRadius:"50%", fontSize:14, cursor:"pointer", flexShrink:0 }}>✕</button>}
            </div>

            {/* Quick-pick chips — editables */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:"#9E9285", fontWeight:700, letterSpacing:.5, marginBottom:10, textTransform:"uppercase", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>Montos rápidos</span>
                <span style={{ fontSize:10, color:"#A09585", fontWeight:400, textTransform:"none" }}>Mantén para eliminar</span>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                {quickAmts.map(amt => (
                  <button key={amt} onClick={() => setBudget(String(amt))}
                    onContextMenu={(e) => { e.preventDefault(); removeAmt(amt); }}
                    style={{ background:budget===String(amt)?"#22C55E":"#E8E0D3", border:"1.5px solid", borderColor:budget===String(amt)?"#22C55E":"#DDD5C8", borderRadius:20, padding:"7px 15px", color:budget===String(amt)?"#FFFFFF":"#7A6E5F", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s", position:"relative" }}>
                    {sym}{amt>=1000 ? `${(amt/1000).toFixed(0)}k` : amt}
                  </button>
                ))}
                {/* Botón para agregar monto */}
                {addingAmt ? (
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input autoFocus type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") confirmAmt(); if(e.key==="Escape") { setAddingAmt(false); setNewAmt(""); } }}
                      placeholder="ej. 15000"
                      style={{ width:90, background:"#F5F0E8", border:"1.5px solid #22C55E", borderRadius:20, padding:"7px 10px", color:"#2C2318", fontSize:13, outline:"none", textAlign:"center" }} />
                    <button onClick={confirmAmt} style={{ background:"#22C55E", border:"none", borderRadius:"50%", width:28, height:28, color:"#111", fontSize:16, fontWeight:900, cursor:"pointer" }}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingAmt(true)}
                    style={{ background:"none", border:"1.5px dashed #C8BDB0", borderRadius:20, padding:"7px 14px", color:"#A09585", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#22C55E"; e.currentTarget.style.color="#22C55E"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#C8BDB0"; e.currentTarget.style.color="#9E9285"; }}>
                    + Agregar
                  </button>
                )}
              </div>
            </div>

            {/* Info callout */}
            <div style={{ background:"#161f16", borderRadius:12, padding:"12px 14px", border:"1px solid #1e3a1e", display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
              <p style={{ fontSize:12, color:"#8A8075", lineHeight:1.6, margin:0 }}>
                Con presupuesto activo, la bolsita 🛍 en el header se convierte en un card que al tocar muestra cuánto te queda libre o si te pasaste.
              </p>
            </div>
          </>}
          {tab==="currency" && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CURRENCIES.map((c) => (
                <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  background:c.code===currency?"#DCFCE7":"#F0EBE2",
                  border:c.code===currency?"1.5px solid #38bdf8":"1.5px solid transparent",
                  borderRadius:12, cursor:"pointer", color:"#2C2318", textAlign:"left",
                }}>
                  <span style={{ fontSize:22 }}>{c.flag}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{c.label}</div>
                    <div style={{ fontSize:12, color:"#8A8075" }}>{c.code} · {c.symbol}</div>
                  </div>
                  {c.code===currency && <span style={{ color:"#16A34A", fontWeight:800 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding:"0 20px 24px", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:"#F0EBE2", border:"1px solid #E0D9CE", borderRadius:10, padding:12, color:"#7A6E5F", fontSize:14, cursor:"pointer" }}>Cancelar</button>
          <button onClick={() => { Sounds.save(); onSaveProfile({ name, budget }); onSaveSettings({ currencyCode:currency }); onClose(); }}
            style={{ flex:2, background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", borderRadius:12, padding:14, color:"#FFFFFF", fontSize:15, fontWeight:800, cursor:"pointer" }}>
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit helpers ──────────────────────────────────────────────────────────────
const editInputStyle = { width:"100%", background:"#FDFAF5", border:"1px solid #E2E7E1", borderRadius:10, padding:"11px 12px", color:"#2C2318", fontSize:15, outline:"none", boxSizing:"border-box" };
const qtyEditBtn = { background:"#F5F0E8", border:"1px solid #E2E7E1", color:"#2C2318", width:40, height:40, borderRadius:10, fontSize:20, cursor:"pointer" };
function EditLabel({ children }) {
  return <label style={{ display:"block", fontSize:11, color:"#8A8075", fontWeight:700, marginBottom:4, marginTop:14, textTransform:"uppercase", letterSpacing:1 }}>{children}</label>;
}

// ── ContextMenu ───────────────────────────────────────────────────────────────
function ContextMenu({ item, onClose, onDelete, onDuplicate, onEdit, sym }) {
  const subtotal = (parseFloat(item.price)||0)*(item.qty||1);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"rgba(253,248,242,0.88)", backdropFilter:"blur(28px) saturate(180%)", WebkitBackdropFilter:"blur(28px) saturate(180%)", borderRadius:"24px 24px 0 0", border:"1px solid rgba(255,255,255,0.7)", width:"100%", maxWidth:430, paddingBottom:20, overflow:"hidden", animation:"slideUp .2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 20px 14px", borderBottom:"1px solid #E5DDD0" }}>
          <span style={{ fontSize:28 }}>{item.emoji}</span>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>{item.name}</div>
            <div style={{ fontSize:12, color:"#8A8075", marginTop:2 }}>{item.qty||1} {item.unit||"pza"}{item.price?` · ${sym}${Math.round(subtotal).toLocaleString()}`:""}</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"8px 12px" }}>
          <CtxBtn icon="✏️" onClick={onEdit}>Editar artículo</CtxBtn>
          <CtxBtn icon="📋" onClick={onDuplicate}>Duplicar</CtxBtn>
          <div style={{ height:1, background:"#E8E0D3", margin:"4px 12px" }} />
          <CtxBtn icon="🗑" danger onClick={onDelete}>Eliminar</CtxBtn>
          <div style={{ height:1, background:"#E8E0D3", margin:"4px 12px" }} />
          <CtxBtn icon="✕" muted onClick={onClose}>Cancelar selección</CtxBtn>
        </div>
      </div>
    </div>
  );
}
function CtxBtn({ icon, children, onClick, danger, muted }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:14, padding:"14px 12px", background:"none", border:"none", borderRadius:12, color:danger?"#ff6b6b":muted?"#666":"#fff", fontSize:muted?14:15, fontWeight:muted?400:600, cursor:"pointer", width:"100%", textAlign:"left" }}>
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:60, display:"flex", alignItems:"flex-end", justifyContent:"center" }}>
      <div style={{ background:"rgba(253,248,242,0.88)", backdropFilter:"blur(28px) saturate(180%)", WebkitBackdropFilter:"blur(28px) saturate(180%)", borderRadius:"24px 24px 0 0", border:"1px solid rgba(255,255,255,0.7)", width:"100%", maxWidth:430, padding:20, animation:"slideUp .2s ease", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ fontSize:17, fontWeight:800, marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:28 }}>{item.emoji}</span> Editar artículo
        </div>
        <EditLabel>Nombre</EditLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={editInputStyle} />
        <EditLabel>Precio por unidad</EditLabel>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
          <span style={{ color:"#16A34A", fontSize:18, fontWeight:800 }}>{sym}</span>
          <input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...editInputStyle, flex:1 }} />
        </div>
        {/* Preset price hint */}
        {presetPrice && !price && (
          <button onClick={() => setPrice(String(presetPrice))}
            style={{ marginTop:6, background:"#E6F4EE", border:"1px solid #BBE5D0", borderRadius:8, padding:"5px 10px", color:"#4ADE80", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, animation:"fadeIn .25s ease" }}>
            <span style={{ fontSize:14 }}>💡</span>
            Precio típico en CR: {sym}{presetPrice.toLocaleString()} — usar este
          </button>
        )}
        <EditLabel>Cantidad</EditLabel>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:4 }}>
          <button style={qtyEditBtn} onClick={() => setQty(q => Math.max(1,q-1))}>−</button>
          <span style={{ fontSize:18, fontWeight:800, minWidth:36, textAlign:"center", lineHeight:"40px" }}>{qty}</span>
          <button style={qtyEditBtn} onClick={() => setQty(q => q+1)}>+</button>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ background:"#EDE8DF", border:"1px solid #D8DDD6", borderRadius:10, color:"#2C2318", padding:"0 10px", fontSize:14, height:40 }}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <EditLabel>Nota (opcional)</EditLabel>
        <input placeholder="ej. Sin azúcar, marca X..." value={note} onChange={(e) => setNote(e.target.value)} style={editInputStyle} />
        {price && (
          <div style={{ marginTop:16, background:"#FDFAF5", borderRadius:12, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #BBE5D0" }}>
            <span style={{ color:"#4ADE80", fontSize:14 }}>Subtotal</span>
            <span style={{ color:"#16A34A", fontSize:20, fontWeight:800 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, background:"#F0EBE2", border:"1px solid #E0D9CE", borderRadius:10, padding:10, color:"#7A6E5F", fontSize:14, cursor:"pointer" }}>Cancelar</button>
          <button onClick={() => { Sounds.save(); onSave({ ...item, name, price, qty, unit, note }); }}
            style={{ flex:2, background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", borderRadius:12, padding:14, color:"#FFFFFF", fontSize:15, fontWeight:800, cursor:"pointer" }}>
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
      <div ref={wrapRef} style={{ position:"relative", overflow:"hidden", animation:"itemIn .35s ease both" }}>
        <div className="sl-bg-left" style={{ position:"absolute", inset:0, background:"#FFEDE8", display:"none", alignItems:"center", justifyContent:"flex-end", paddingRight:22, fontSize:15, fontWeight:700, color:"#2C2318", gap:8 }}>🗑 Eliminar</div>
        <div ref={rowRef}
          style={{ display:"flex", alignItems:"center", padding:"10px 14px", gap:10, background:"rgba(238,248,238,0.70)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", position:"relative", touchAction:"pan-y", userSelect:"none", borderBottom:"1px solid rgba(212,238,226,0.5)", cursor:"pointer" }}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onClick={(e) => { if (!swipeState.current.hasMoved) { Sounds.uncheckItem(); onToggle(item.id); } }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

          {/* soft left accent bar */}
          <div style={{ position:"absolute", left:0, top:6, bottom:6, width:3, borderRadius:3, background:"#22C55E", opacity:.5 }} />

          {/* check circle – soft green, tappable to uncheck */}
          <button onClick={(e) => { e.stopPropagation(); Sounds.uncheckItem(); onToggle(item.id); }}
            style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #38bdf8", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"#22C55E", color:"#111", fontSize:13, fontWeight:900, transition:"transform .15s ease", animation:"softPop .3s ease" }}
            onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.88)"; }}
            onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; }}
            onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.88)"; }}
            onTouchEnd={(e)   => { e.currentTarget.style.transform="scale(1)"; }}>
            ✓
          </button>

          {/* emoji – slightly dimmed */}
          <span style={{ fontSize:22, width:30, textAlign:"center", flexShrink:0, opacity:.6 }}>{item.emoji}</span>

          {/* name + price – no strikethrough, just softened */}
          <div style={{ flex:1, minWidth:0 }}>
            <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"#1A4B2E", opacity:.9 }}>{item.name}</span>
            {item.price && (
              <span style={{ fontSize:11, color:"#4ADE80", fontWeight:600 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
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
    <div ref={wrapRef} style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #F0F2EF", animation:"itemIn .22s ease both" }}>
      <div className="sl-bg-left"  style={{ position:"absolute", inset:0, background:"#FFEDE8", display:"none", alignItems:"center", justifyContent:"flex-end",  paddingRight:22, fontSize:15, fontWeight:700, color:"#2C2318", gap:8 }}>🗑 Eliminar</div>
      <div className="sl-bg-right" style={{ position:"absolute", inset:0, background:"#22C55E", display:"none", alignItems:"center", justifyContent:"flex-start", paddingLeft:22,  fontSize:15, fontWeight:700, color:"#111", gap:8 }}>✓ Seleccionar</div>
      <div ref={rowRef}
        style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10, background:"rgba(255,252,247,0.72)", backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)", position:"relative", touchAction:"pan-y", userSelect:"none", transition:"opacity .3s", cursor:"pointer" }}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onClick={(e) => { if (!swipeState.current.hasMoved && !e.target.closest("button") && !e.target.closest("input")) { Sounds.checkItem(); onToggle(item.id); } }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

        <button onClick={(e) => { e.stopPropagation(); Sounds.checkItem(); onToggle(item.id); }}
          style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #3a3a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"transparent", fontSize:14, fontWeight:"bold", transition:"border-color .2s, transform .15s" }}
          onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#22C55E"; }}
          onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="#3a3a3a"; }}
          onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#22C55E"; }}
          onTouchEnd={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="#3a3a3a"; }}>
        </button>

        <span style={{ fontSize:22, width:30, textAlign:"center", flexShrink:0 }}>{item.emoji}</span>

        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{item.name}</span>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:3 }}>
            {isEditingPrice ? (
              <input autoFocus type="number" placeholder="0" value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onBlur={() => savePrice(item.id)}
                onKeyDown={(e) => e.key==="Enter" && savePrice(item.id)}
                style={{ background:"#F5F0E8", border:"1px solid #38bdf8", borderRadius:6, color:"#16A34A", fontSize:13, width:80, padding:"2px 6px", textAlign:"right", outline:"none" }} />
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setEditingPriceId(item.id); setTempPrice(item.price||""); }}
                style={{ background:"none", border:"none", color:item.price?"#22C55E":"#555", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline dotted" }}>
                {item.price ? `${sym}${Math.round(subtotal).toLocaleString()}` : "+ precio"}
              </button>
            )}
            {item.note && <span style={{ background:"#EDE8DF", borderRadius:6, padding:"1px 7px", fontSize:11, color:"#7A6E5F" }}>📝 {item.note}</span>}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
          {qty===1 ? (
            <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDelete(item.id); }}
              style={{ background:"#FEF2F2", border:"none", color:"#EF4444", width:28, height:28, borderRadius:8, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyMinus(item.id); }}
              style={{ background:"#F5F0E8", border:"1px solid #E2E7E1", color:"#2C2318", width:28, height:28, borderRadius:8, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
          )}
          <span style={{ fontSize:14, fontWeight:800, minWidth:22, textAlign:"center" }}>{qty}</span>
          <button onClick={(e) => { e.stopPropagation(); Sounds.qtyChange(); onQtyPlus(item.id); }}
            style={{ background:"#F5F0E8", border:"1px solid #E2E7E1", color:"#2C2318", width:28, height:28, borderRadius:8, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ── Quick name suggestions for new lists ─────────────────────────────────────
const LIST_SUGGESTIONS = ["🏠 Casa","🛒 Semana","🎉 Fiesta","💪 Gym","🍳 Desayuno","🌮 Cena","🧹 Limpieza","🎂 Cumple","📦 Mes","🐾 Mascotas"];

// ── ListsView ─────────────────────────────────────────────────────────────────
function ListsView({ lists, onOpenList, onDeleteList, onCreateList, sym, history, budget, themeName }) {
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
    background: "rgba(255,255,255,0.58)",
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.75)",
    boxShadow: "0 4px 20px rgba(80,60,20,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
  };

  // Determine which banner image to use based on theme (passed via prop from parent)
  const bannerImg = themeName === "green" ? BunnyG : BunnyP;

  return (
    <>
      {/* ── Hero Banner ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "0 0 24px 24px",
        boxShadow: "0 6px 28px rgba(0,0,0,0.10)",
      }}>
        {/* Full-width banner image */}
        <img
          src={bannerImg}
          alt="SuperLista banner"
          style={{
            width: "100%",
            height: 160,
            objectFit: "cover",
            objectPosition: "center 30%",
            display: "block",
          }}
        />

        {/* Gradient overlay for text legibility */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg, rgba(0,0,0,0.38) 0%, rgba(0,0,0,0.08) 60%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Text row */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "18px 20px",
          zIndex: 2,
        }}>
          <div>
            <div style={{
              fontSize: 10, color: "rgba(255,255,255,0.88)", fontWeight: 700,
              letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4,
              textShadow: "0 1px 4px rgba(0,0,0,0.25)",
            }}>SuperLista</div>
            <div style={{
              fontSize: 24, fontWeight: 900, color: "#fff",
              letterSpacing: "-0.03em", lineHeight: 1.1,
              textShadow: "0 2px 8px rgba(0,0,0,0.28)",
            }}>
              {lists.length === 0 ? "¡Hola! 👋" : `${lists.length} lista${lists.length!==1?"s":""}`}
            </div>
            <div style={{
              fontSize: 12, color: "rgba(255,255,255,0.90)", marginTop: 4,
              fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.22)",
            }}>
              {lists.length === 0 ? "Crea tu primera lista 🐰" : "Toca una para comprar"}
            </div>
          </div>

          {/* Cart badge — frosted glass */}
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: "rgba(255,255,255,0.28)",
            backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
            boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
          }}>🛒</div>
        </div>
      </div>

      <div style={{ ...S.body, padding:"16px 0 8px" }}>

        {/* ── Existing lists ── */}
        {lists.map((list, idx) => {
          const done  = list.items.filter(i => i.checked).length;
          const total = list.items.length;
          const cost  = totalCost(list.items);
          const pct   = total > 0 ? (done / total) * 100 : 0;
          return (
            <div key={list.id} onClick={() => onOpenList(list.id)}
              style={{ ...card, margin:"0 16px 12px", padding:"20px 20px 18px", cursor:"pointer", animation:`itemIn .28s ease ${idx*.06}s both`, transition:"transform .13s ease" }}
              onTouchStart={e => e.currentTarget.style.transform="scale(.982)"}
              onTouchEnd={e   => e.currentTarget.style.transform="scale(1)"}
              onMouseDown={e  => e.currentTarget.style.transform="scale(.982)"}
              onMouseUp={e    => e.currentTarget.style.transform="scale(1)"}
            >
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: total>0 ? 14 : 4 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:18, fontWeight:800, color:"#1A2118", letterSpacing:"-0.01em", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{list.name}</div>
                  <div style={{ fontSize:12, color:"#9E9285", marginTop:3 }}>
                    {total > 0 ? `${total} artículo${total!==1?"s":""} · ${done} en bolsa` : "Vacía — toca para añadir"}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0, marginLeft:12 }}>
                  {cost > 0 && (
                    <span style={{ fontSize:14, fontWeight:800, color:"#16A34A", background:"rgba(34,197,94,0.13)", borderRadius:12, padding:"4px 10px" }}>
                      {sym}{Math.round(cost).toLocaleString()}
                    </span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); Sounds.deleteItem(); onDeleteList(list.id); }}
                    style={{ background:"rgba(0,0,0,0.055)", border:"none", color:"#AAA098", fontSize:14, cursor:"pointer", width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
                </div>
              </div>
              {total > 0 && (
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, height:6, background:"rgba(0,0,0,0.07)", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"linear-gradient(90deg,var(--accent),var(--accentDark))", borderRadius:99, width:`${pct}%`, transition:"width .6s cubic-bezier(.4,0,.2,1)" }} />
                  </div>
                  <span style={{ fontSize:11, color:"#9E9285", fontWeight:700, flexShrink:0 }}>{done}/{total}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* ── Create new list — always visible, no modal ── */}
        <div style={{ ...card, margin:"0 16px 16px", padding:"20px 20px 16px", border:"1.5px dashed rgba(34,197,94,0.4)" }}>
          <div style={{ fontSize:13, fontWeight:700, color:"#6B9E72", marginBottom:12, letterSpacing:".01em" }}>✨ Nueva lista</div>

          {/* Big input */}
          <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
            <input
              id="nueva-lista-input"
              ref={inputRef}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key==="Enter" && handleCreate()}
              placeholder="¿Cómo se llama?"
              style={{ flex:1, background:"rgba(255,255,255,0.7)", border:"1.5px solid rgba(34,197,94,0.25)", borderRadius:14, padding:"13px 16px", color:"#1A2118", fontSize:16, fontWeight:600, outline:"none", boxSizing:"border-box", transition:"border-color .15s" }}
              onFocus={e  => e.target.style.borderColor="var(--accent)"}
              onBlur={e   => e.target.style.borderColor="rgba(34,197,94,0.25)"}
            />
            <button
              onClick={() => handleCreate()}
              style={{ background:"linear-gradient(135deg,var(--accent),var(--accentDark))", border:"none", borderRadius:14, width:52, height:52, fontSize:26, color:"#fff", fontWeight:900, cursor:"pointer", flexShrink:0, boxShadow:"0 3px 12px rgba(22,163,74,0.32)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              +
            </button>
          </div>

          {/* Quick suggestion chips */}
          <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
            {LIST_SUGGESTIONS.map(s => (
              <button key={s} onClick={() => handleCreate(s)}
                style={{ background:"rgba(34,197,94,0.10)", border:"1px solid rgba(34,197,94,0.22)", borderRadius:20, padding:"6px 13px", fontSize:13, fontWeight:600, color:"#2A6E38", cursor:"pointer", transition:"background .12s" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(34,197,94,0.22)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(34,197,94,0.10)"}
                onTouchStart={e => e.currentTarget.style.background="rgba(34,197,94,0.22)"}
                onTouchEnd={e   => e.currentTarget.style.background="rgba(34,197,94,0.10)"}>
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
function ListView({ list, onBack, onUpdateItem, onDeleteItem, onGoAdd, sym, budget, onOpenProfile, onSaveBudget, onCloseSession }) {
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
      <div style={S.header}>
        <button onClick={() => { Sounds.navBack(); onBack(); }} style={{ background:"none", border:"none", color:"#16A34A", fontSize:24, cursor:"pointer", padding:"0 6px" }}>←</button>
        <span style={{ flex:1, fontWeight:800, fontSize:18 }}>{list.name}</span>
        <span style={{ background:"#EDE8DC", borderRadius:12, padding:"3px 10px", fontSize:13, color:"#7A6E5F", fontWeight:600, marginRight:4 }}>{done}/{tot}</span>

        {/* ── Budget flip card en el header ── */}
        {editingBudget ? (
          /* Modo edición inline — reemplaza el card */
          <div style={{ display:"flex", alignItems:"center", gap:4, background:"#E6F4EE", border:"1.5px solid #22C55E", borderRadius:22, padding:"0 10px", height:38, animation:"fadeIn .15s ease" }}>
            <span style={{ color:"#16A34A", fontWeight:900, fontSize:14 }}>{sym}</span>
            <input autoFocus type="number" value={budgetDraft}
              onChange={e => setBudgetDraft(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") confirmBudgetEdit(); if(e.key==="Escape") setEditingBudget(false); }}
              onBlur={confirmBudgetEdit}
              style={{ width:52, background:"none", border:"none", color:"#2C2318", fontSize:14, fontWeight:800, outline:"none", textAlign:"right" }}
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
              {/* FRENTE: 🛍 + presupuesto total */}
              <div className="flip-card-front" style={{ flexDirection:"row", alignItems:"center", gap:5, padding:"0 10px" }}>
                <span style={{ fontSize:16 }}>🛍</span>
                <div style={{ lineHeight:1.2 }}>
                  <span style={{ fontSize:8, color:"#16A34A", display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700 }}>
                    {budgetNum > 0 ? "presup." : "bolsa"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color:"#16A34A" }}>
                    {budgetNum > 0 ? `${sym}${budgetNum >= 1000 ? `${(budgetNum/1000).toFixed(0)}k` : budgetNum}` : `${sym}${Math.round(inBagCost).toLocaleString()}`}
                  </span>
                </div>
              </div>
              {/* DORSO: libre o excedido */}
              <div className={`flip-card-back${overBudget ? " over" : ""}`} style={{ flexDirection:"row", alignItems:"center", gap:5, padding:"0 10px" }}>
                <span style={{ fontSize:16 }}>{overBudget ? "🚨" : "✅"}</span>
                <div style={{ lineHeight:1.2 }}>
                  <span style={{ fontSize:8, display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700, color: overBudget ? "#fca5a5" : "#4ADE80" }}>
                    {overBudget ? "excedido" : "libre"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color: overBudget ? "#f87171" : "#22C55E" }}>
                    {remaining < 0 ? "-" : ""}{sym}{Math.abs(Math.round(remaining)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {tot>0 && (
        <div style={{ height:4, background:"#E5DDD0" }}>
          <div style={{ height:"100%", background: budgetNum>0
            ? overBudget
              ? "linear-gradient(90deg,#EF4444,#B91C1C)"
              : `linear-gradient(90deg,#38bdf8,#0ea5e9)`
            : "linear-gradient(90deg,#22C55E,#16A34A)",
            borderRadius:2, width:`${budgetNum>0 ? Math.min(budgetPct,100) : tot?(done/tot)*100:0}%`, transition:"width .5s cubic-bezier(.4,0,.2,1)" }} />        </div>
      )}

      <div style={S.body}>
        {list.items.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🛒</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#2C2318", marginBottom:6 }}>Tu lista está vacía</div>
            <div style={{ fontSize:13, color:"#9E9285" }}>Toca + Añadir para agregar artículos</div>
          </div>
        )}
        {searchQuery && all.length===0 && <div style={{ fontSize:13, color:"#9E9285", padding:20, textAlign:"center" }}>Sin resultados para "{searchQuery}"</div>}

        {/* ── Pendientes con header colapsable ── */}
        {unchecked.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"8px 16px 6px", borderBottom:"1px solid #F0F2EF" }}>
            <button onClick={() => setShowUnchecked(v => !v)}
              style={{ background:"none", border:"none", color:"#7A6E5F", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0, fontWeight:700 }}>
              <span style={{ fontSize:11, transition:"transform .2s", display:"inline-block", transform: showUnchecked ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              <span>En lista</span>
              <span style={{ background:"#EDE8DF", borderRadius:10, padding:"1px 8px", fontSize:11, color:"#8A8075", fontWeight:600 }}>{unchecked.length}</span>
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
              style={{ background:"none", border:"none", color:"#16A34A", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:5, padding:0, fontWeight:700, flex:1, minWidth:0 }}>
              <span style={{ fontSize:10, transition:"transform .2s", display:"inline-block", transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)", opacity:.7 }}>▼</span>
              <span style={{ fontSize:15, lineHeight:1 }}>🛍</span>
              <span style={{ fontSize:13, color:"#2C2318", fontWeight:700, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {checked.length === 1 ? "1 en tu bolsa" : `${checked.length} en tu bolsa`}
              </span>
              {inBagCost > 0 && (
                <span style={{ fontSize:12, color:"#16A34A", fontWeight:800, background:"#D1FAE5", borderRadius:8, padding:"1px 7px", marginLeft:2, flexShrink:0 }}>
                  {sym}{Math.round(inBagCost).toLocaleString()}
                </span>
              )}
            </button>

            {/* ── Chip "Cerrar compra" ── */}
            <button
              onClick={() => { Sounds.checkout(); onCloseSession({ total: inBagCost, items: list.items.filter(i=>i.checked), listName: list.name, date: Date.now(), itemCount: done }); }}
              style={{
                display:"flex", alignItems:"center", gap:5,
                background:"linear-gradient(135deg,#22C55E 0%,#15803D 100%)",
                color:"#FFFFFF", border:"none", borderRadius:100,
                padding:"6px 13px 6px 10px",
                fontSize:12, fontWeight:800, letterSpacing:".01em",
                cursor:"pointer", flexShrink:0, whiteSpace:"nowrap",
                boxShadow:"0 2px 8px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)",
                animation:"chipIn .35s cubic-bezier(.34,1.56,.64,1) both",
                transition:"transform .12s ease, box-shadow .12s ease",
              }}
              onMouseDown={e  => { e.currentTarget.style.transform="scale(.94)"; e.currentTarget.style.boxShadow="0 1px 3px rgba(22,163,74,.20)"; }}
              onMouseUp={e    => { e.currentTarget.style.transform="scale(1)";   e.currentTarget.style.boxShadow="0 2px 8px rgba(22,163,74,.30), inset 0 1px 0 rgba(255,255,255,.18)"; }}
              onTouchStart={e => { e.currentTarget.style.transform="scale(.94)"; }}
              onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
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
      <button style={S.fab} onClick={onGoAdd}>+ Añadir</button>

      <div style={S.bottomBar}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#9E9285", fontSize:16, pointerEvents:"none" }}>🔍</span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en lista..."
            style={{ width:"100%", background:"#F5F0E8", border:"1px solid #D8DDD6", borderRadius:22, padding:"9px 16px 9px 36px", color:"#2C2318", fontSize:14, outline:"none", boxSizing:"border-box" }} />
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
function AddItemsView({ list, onBack, onAddItem, sym }) {
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

  const addPreset = (p) => { Sounds.addItem(); onAddItem({ id:genId(), name:p.name, emoji:p.emoji, category:p.category, checked:false, price:String(CR_PRICES[p.name]||""), qty:1, unit:"pza", note:"" }); };
  const addCustom = () => {
    if (!customName.trim()) return;
    Sounds.addItem();
    onAddItem({ id:genId(), name:customName.trim(), emoji:customEmoji, category:"Otros", checked:false, price:"", qty:1, unit:"pza", note:"" });
    setCustomName(""); setCustomEmoji("🛒"); setShowEmojiPicker(false);
  };

  return (
    <>
      {/* ── Header ── */}
      <div style={S.header}>
        <button onClick={() => { Sounds.navBack(); onBack(); }} style={{ background:"none", border:"none", color:"#16A34A", fontSize:24, cursor:"pointer", padding:"0 6px 0 0" }}>←</button>
        <span style={{ flex:1, fontWeight:800, fontSize:18 }}>Agregar artículos</span>
        <button onClick={() => { Sounds.save(); onBack(); }}
          style={{ background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", borderRadius:20, padding:"7px 16px", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer", boxShadow:"0 2px 8px rgba(22,163,74,0.28)" }}>
          Listo ✓
        </button>
      </div>

      {/* ── Custom item row ── */}
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid #EBE8E2", background:"rgba(255,255,255,0.55)", backdropFilter:"blur(12px)" }}>
        <div style={{ fontSize:11, fontWeight:700, color:"#9E9285", letterSpacing:".06em", textTransform:"uppercase", marginBottom:10 }}>Artículo personalizado</div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          {/* Big emoji button */}
          <button onClick={() => setShowEmojiPicker(v => !v)}
            style={{ width:52, height:52, background: showEmojiPicker ? "#22C55E" : "#EDE8DF", border: showEmojiPicker ? "2px solid #16A34A" : "2px solid transparent", borderRadius:16, fontSize:26, cursor:"pointer", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s", boxShadow: showEmojiPicker ? "0 2px 12px rgba(34,197,94,0.28)" : "none" }}>
            {customEmoji}
          </button>
          <input value={customName} onChange={e => setCustomName(e.target.value)} onKeyDown={e => e.key==="Enter" && addCustom()}
            placeholder="Nombre del artículo..."
            style={{ flex:1, background:"#F5F0E8", border:"1.5px solid #D8DDD6", borderRadius:14, padding:"13px 14px", color:"#1A2118", fontSize:15, fontWeight:600, outline:"none", transition:"border-color .15s" }}
            onFocus={e => e.target.style.borderColor="#22C55E"}
            onBlur={e  => e.target.style.borderColor="#D8DDD6"} />
          <button onClick={addCustom}
            style={{ background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", borderRadius:14, width:52, height:52, fontSize:26, color:"#fff", fontWeight:900, cursor:"pointer", flexShrink:0, boxShadow:"0 2px 10px rgba(22,163,74,0.30)", display:"flex", alignItems:"center", justifyContent:"center" }}>
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
                  style={{ width:40, height:40, background: em===customEmoji ? "#22C55E" : "rgba(0,0,0,0.04)", border: em===customEmoji ? "2px solid #16A34A" : "2px solid transparent", borderRadius:10, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"transform .1s, background .1s", flexShrink:0 }}
                  onTouchStart={e => e.currentTarget.style.transform="scale(1.2)"}
                  onTouchEnd={e   => e.currentTarget.style.transform="scale(1)"}
                  onMouseEnter={e => e.currentTarget.style.background = em===customEmoji ? "#22C55E" : "rgba(34,197,94,0.14)"}
                  onMouseLeave={e => e.currentTarget.style.background = em===customEmoji ? "#22C55E" : "rgba(0,0,0,0.04)"}>
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
          style={{ width:"100%", background:"#F5F0E8", border:"1.5px solid #D8DDD6", borderRadius:12, padding:"11px 14px", color:"#1A2118", fontSize:14, outline:"none", boxSizing:"border-box", transition:"border-color .15s" }}
          onFocus={e => e.target.style.borderColor="#22C55E"}
          onBlur={e  => e.target.style.borderColor="#D8DDD6"} />
      </div>

      {/* ── Category chips ── */}
      <div style={{ display:"flex", overflowX:"auto", gap:7, padding:"6px 16px 10px", scrollbarWidth:"none" }}>
        {["Todos",...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{ borderRadius:20, border:"none", padding:"6px 15px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, background:category===cat?"#22C55E":"#EDE8DC", color:category===cat?"#fff":"#7A6E5F", transition:"background .12s, color .12s", boxShadow:category===cat?"0 2px 8px rgba(22,163,74,0.22)":"none" }}>
            {cat}
          </button>
        ))}
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
              <button key={p.name} onClick={() => addPreset(p)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:14, padding:"13px 16px", background:"rgba(255,252,247,0.7)", border:"none", borderBottom:"1px solid rgba(240,238,234,0.8)", cursor:"pointer", color:"#1A2118", textAlign:"left", transition:"background .1s" }}
                onMouseEnter={e => e.currentTarget.style.background="rgba(34,197,94,0.07)"}
                onMouseLeave={e => e.currentTarget.style.background="rgba(255,252,247,0.7)"}
                onTouchStart={e => e.currentTarget.style.background="rgba(34,197,94,0.09)"}
                onTouchEnd={e   => e.currentTarget.style.background="rgba(255,252,247,0.7)"}>
                <span style={{ fontSize:28, width:36, textAlign:"center", flexShrink:0 }}>{p.emoji}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <span style={{ display:"block", fontSize:15, fontWeight:700 }}>{p.name}</span>
                  <span style={{ fontSize:11, color:CAT_COLORS[p.category]||"#aaa", fontWeight:600 }}>{p.category}</span>
                </div>
                {crp && <span style={{ fontSize:12, color:"#16A34A", fontWeight:800, background:"rgba(34,197,94,0.10)", borderRadius:8, padding:"2px 8px", flexShrink:0 }}>{sym}{crp.toLocaleString()}</span>}
                <div style={{ background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", width:32, height:32, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:900, flexShrink:0, boxShadow:"0 2px 6px rgba(22,163,74,0.25)" }}>+</div>
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5DDD0" strokeWidth={stroke} />
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
                  ? "linear-gradient(180deg,#38bdf8,#0284c7)"
                  : "linear-gradient(180deg,#D1FAE5,#A7F3D0)",
                border: isLast ? "none" : "1px solid #2a3a2a",
                transition: "height .5s cubic-bezier(.4,0,.2,1)",
                cursor: "default",
                boxShadow: isLast ? "0 4px 12px rgba(34,197,94,.25)" : "none",
              }}
            />
            <span style={{
              position: "absolute", bottom: 0,
              fontSize: 9, color: isLast ? "#22C55E" : "#444",
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
    return { icon: "📉", text: `Tus últimas 3 compras están bajando. ¡Buen control del gasto!`, color: "#16A34A" };
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
    { label: "Hace 2 sem", val: prevW, color: "#E8F5EE" },
    { label: "Sem pasada", val: lastW, color: "#CCEEDD" },
    { label: "Esta sem", val: thisW, color: "#16A34A" },
  ];

  const delta = lastW > 0 ? (((thisW - lastW) / lastW) * 100).toFixed(0) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 60, marginBottom: 8 }}>
        {bars.map((b, i) => {
          const h = Math.max(4, (b.val / maxW) * 60);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: i === 2 ? "#22C55E" : "#555", fontWeight: i === 2 ? 700 : 400 }}>
                {b.val > 0 ? fmtAmt(b.val, sym) : "—"}
              </span>
              <div style={{
                width: "100%", height: h, borderRadius: "4px 4px 0 0",
                background: i === 2 ? "linear-gradient(180deg,#38bdf8,#0284c7)" : b.color,
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
        <div style={{ fontSize: 11, color: parseFloat(delta) > 0 ? "#EF4444" : "#16A34A", fontWeight: 700, textAlign: "center" }}>
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
          {streak} <span style={{ fontSize: 13, fontWeight: 600, color: "#9E9285" }}>sem</span>
        </div>
        <div style={{ fontSize: 11, color: "#8A8075", marginTop: 2 }}>
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
        <div style={{ fontSize: 14, fontWeight: 700, color: "#2C2318", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {best.name}
        </div>
        <div style={{ fontSize: 11, color: "#9E9285" }}>{fmtShortDate(best.date)}</div>
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
        <div style={{ fontSize: 18, fontWeight: 800, color: "#2C2318", marginBottom: 8 }}>Sin datos aún</div>
        <div style={{ fontSize: 13, color: "#9E9285", lineHeight: 1.7 }}>
          Completá una compra marcando artículos<br />y tocando "Cerrar compra".
        </div>
      </div>
    );
  }

  // ── UI ──
  const cardStyle = {
    background: "#FFFCF7",
    border: "1px solid #EEF0ED",
    borderRadius: 18,
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(120,80,20,0.06)",
  };
  const labelStyle = {
    fontSize: 10,
    color: "#9E9285",
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  };

  const periodLabels = { month: "Este mes", q3: "Últimos 3 meses", all: "Todo el tiempo" };

  return (
    <div style={{ padding: "0 0 32px" }}>

      {/* ── Period tabs ── */}
      <div style={{
        display: "flex", gap: 0, background: "rgba(253,250,245,0.94)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #E8ECE7",
        position: "sticky", top: 0, zIndex: 5,
      }}>
        {[["month", "Este mes"], ["q3", "3 meses"], ["all", "Todo"]].map(([id, label]) => {
          const on = period === id;
          return (
            <button key={id} onClick={() => setPeriod(id)} style={{
              flex: 1, background: "none", border: "none",
              color: on ? "#22C55E" : "#444", fontWeight: on ? 800 : 500,
              fontSize: 13, padding: "12px 4px", cursor: "pointer",
              position: "relative", transition: "color .15s",
            }}>
              {label}
              {on && (
                <span style={{
                  position: "absolute", bottom: 0, left: "20%", right: "20%",
                  height: 2, background: "#22C55E", borderRadius: 2, display: "block",
                  animation: "underlineIn .2s ease",
                }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* ── KPI hero row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ ...cardStyle, gridColumn: "1 / -1", background: "linear-gradient(135deg,#0d1f0d,#111b11)", border: "1px solid #1e3a1e" }}>
            <div style={labelStyle}>Gastado · {periodLabels[period]}</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#16A34A", lineHeight: 1, letterSpacing: -1 }}>
              {fmtAmt(total, sym)}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#9E9285" }}>
                {sessions.length} compra{sessions.length !== 1 ? "s" : ""}
              </span>
              {avgTicket > 0 && (
                <span style={{ fontSize: 12, color: "#9E9285" }}>
                  Ticket prom. <span style={{ color: "#4ADE80", fontWeight: 700 }}>{fmtAmt(avgTicket, sym)}</span>
                </span>
              )}
              {delta !== null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(delta) > 0 ? "#EF4444" : "#16A34A" }}>
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
            <div style={{ height: 6, background: "#EDE8DF", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${budgetPct}%`,
                background: budgetPct >= 100 ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : budgetPct >= 80 ? "linear-gradient(90deg,#f59e0b,#d97706)"
                  : "linear-gradient(90deg,#22C55E,#16A34A)",
                transition: "width .6s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "#A09585" }}>
                {total < budgetCap
                  ? `${fmtAmt(budgetCap - total, sym)} disponible`
                  : `${fmtAmt(total - budgetCap, sym)} excedido`}
              </span>
              <span style={{ fontSize: 10, color: "#A09585" }}>de {fmtAmt(budgetCap, sym)}</span>
            </div>
          </div>
        )}

        {/* ── Bar chart con fechas ── */}
        {sessions.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Historial de compras</div>
            <BarChart sessions={sessions} sym={sym} maxBars={12} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#A09585" }}>
                {sessions.length > 0 ? fmtShortDate(sessions[0].date) : ""}
              </span>
              <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 700 }}>
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
                  <span style={{ fontSize: 10, color: "#9E9285", fontWeight: 700, letterSpacing: 0.5 }}>
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
                      <span style={{ flex: 1, fontSize: 11, color: "#bbb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
              <p style={{ fontSize: 13, color: "#4A4035", lineHeight: 1.6, margin: 0 }}>
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
                  borderBottom: i < arr.length - 1 ? "1px solid #1e1e1e" : "none",
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#2C2318" }}>
                      {s.listName || "Compra"}
                    </div>
                    <div style={{ fontSize: 10, color: "#A09585", marginTop: 1 }}>
                      {fmtDate(s.date)} · {s.itemCount || (s.items?.length) || 0} art.
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 900, color: "#16A34A",
                    background: "#38bdf811", borderRadius: 8,
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
const THEMES = {
  green: {
    checker:   "#B5DDB5",
    checkerBg: "#F0F5E8",
    accent:    "#22C55E",
    accentDark:"#16A34A",
    soft:      "#EAF7EF",
    border:    "#BBE5D0",
    label:     "🌿",
  },
  pink: {
    checker:   "#F4ACBB",
    checkerBg: "#FDF0F4",
    accent:    "#F472B6",
    accentDark:"#DB2777",
    soft:      "#FDE8F1",
    border:    "#F9A8D4",
    label:     "🌸",
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

  useEffect(() => { LS.set("sl5_lists",    lists);    }, [lists]);
  useEffect(() => { LS.set("sl5_settings", settings); }, [settings]);
  useEffect(() => { LS.set("sl5_profile",  profile);  }, [profile]);
  useEffect(() => { LS.set("sl5_history",  history);  }, [history]);
  useEffect(() => { LS.set("sl5_theme",    themeName); }, [themeName]);

  const theme = THEMES[themeName];
  const toggleTheme = () => setThemeName(t => t === "green" ? "pink" : "green");

  const activeList = lists.find(l => l.id===activeListId);
  const sym = settings.currencyCode==="CRC" ? "₡" : settings.currencyCode==="EUR" ? "€" : settings.currencyCode==="GBP" ? "£" : "$";

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
      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');

        :root {
          --checker:    ${theme.checker};
          --checkerBg:  ${theme.checkerBg};
          --accent:     ${theme.accent};
          --accentDark: ${theme.accentDark};
          --soft:       ${theme.soft};
          --border:     ${theme.border};
        }

        body {
          background-color: ${theme.checkerBg};
          background-image:
            /* dashed grid lines */
            repeating-linear-gradient(0deg,   transparent, transparent 59px, rgba(255,255,255,.55) 59px, rgba(255,255,255,.55) 61px),
            repeating-linear-gradient(90deg,  transparent, transparent 59px, rgba(255,255,255,.55) 59px, rgba(255,255,255,.55) 61px),
            /* checkerboard */
            repeating-conic-gradient(${theme.checker} 0% 25%, ${theme.checkerBg} 0% 50%);
          background-size: 60px 60px, 60px 60px, 120px 120px;
          color:#1A2118;
        }

        @keyframes slideUp    { from { transform:translateY(22px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes itemIn     { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes underlineIn{ from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes fadeIn     { from { opacity:0; } to { opacity:1; } }
        @keyframes softPop    { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes bagSlide   { from{opacity:0;transform:translateX(6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes chipIn     { 0%{opacity:0;transform:scale(.72) translateX(8px)} 60%{transform:scale(1.04) translateX(-1px)} 100%{opacity:1;transform:scale(1) translateX(0)} }
        @keyframes budgetIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRed   { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 5px rgba(239,68,68,.18)} }
        @keyframes themeFlip  { 0%{transform:scale(1) rotate(0deg)} 40%{transform:scale(.82) rotate(180deg)} 100%{transform:scale(1) rotate(360deg)} }
        .flip-card { position:relative; cursor:pointer; perspective:700px; flex-shrink:0; }
        .flip-card-inner { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .45s cubic-bezier(.4,0,.2,1); }
        .flip-card.flipped .flip-card-inner { transform:rotateY(180deg); }
        .flip-card-front, .flip-card-back { position:absolute; inset:0; border-radius:22px; padding:7px 14px; display:flex; flex-direction:column; justify-content:center; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
        .flip-card-front { background:${theme.soft}; border:1px solid ${theme.border}; }
        .flip-card-back  { background:${theme.soft}; border:1px solid ${theme.border}; transform:rotateY(180deg); }
        .flip-card-back.over { background:#FEF2F2; border-color:#FECACA; animation:pulseRed 2s infinite; }
        input, select, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 0px; }

        /* daisy pseudo-elements scattered on body */
        .gingham-daisies::before,
        .gingham-daisies::after {
          content:'🌼';
          position:fixed; font-size:22px; opacity:.18; pointer-events:none; z-index:0;
        }
        .gingham-daisies::before { top:8%; left:12%; }
        .gingham-daisies::after  { top:55%; right:8%; }
      `}</style>

      {/* ── Theme toggle pill ── */}
      <button
        onClick={() => { Sounds.themeToggle(); toggleTheme(); }}
        title={themeName === "green" ? "Cambiar a rosa 🌸" : "Cambiar a verde 🌿"}
        style={{
          position:"fixed", bottom:90, right:16, zIndex:50,
          background: themeName === "green"
            ? "linear-gradient(135deg,#f9a8d4,#ec4899)"
            : "linear-gradient(135deg,#86efac,#22c55e)",
          border:"none", borderRadius:100,
          width:44, height:44,
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:20, cursor:"pointer",
          boxShadow:"0 3px 12px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.3)",
          transition:"background .4s ease",
        }}
        onMouseDown={e  => { e.currentTarget.style.transform="scale(.88)"; }}
        onMouseUp={e    => { e.currentTarget.style.transform="scale(1)"; }}
        onTouchStart={e => { e.currentTarget.style.transform="scale(.88)"; }}
        onTouchEnd={e   => { e.currentTarget.style.transform="scale(1)"; }}
      >
        {themeName === "green" ? "🌸" : "🌿"}
      </button>
      <div style={S.app}>
        {view==="lists" && (
          <ListsView lists={lists} sym={sym} history={history} budget={profile.budget} themeName={themeName}
            onOpenList={(id) => { setActiveListId(id); setView("list"); }}
            onDeleteList={(id) => setLists(prev => prev.filter(l=>l.id!==id))}
            onCreateList={(name) => { const nl={id:genId(),name,items:[],createdAt:Date.now()}; setLists(prev=>[...prev,nl]); setActiveListId(nl.id); setView("list"); }} />
        )}
        {view==="list" && activeList && (
          <ListView list={activeList} sym={sym} budget={profile.budget}
            onBack={() => { setView("lists"); setActiveListId(null); }}
            onUpdateItem={updateItem} onDeleteItem={deleteItem} onGoAdd={() => setView("addItems")}
            onOpenProfile={() => { setProfileTab("budget"); setShowProfile(true); }}
            onSaveBudget={(val) => setProfile(p => ({ ...p, budget: val }))}
            onCloseSession={closeSession} />
        )}
        {view==="addItems" && activeList && (
          <AddItemsView list={activeList} sym={sym} onBack={() => setView("list")} onAddItem={addItem} />
        )}
      </div>

      {view==="lists" && (
        <BottomNav active={navActive}
          onNewList={() => { setNavActive("new"); document.getElementById("nueva-lista-input")?.focus(); }}
          onHistory={() => { setNavActive("history"); setProfileTab("history"); setShowProfile(true); }}
          onProfile={() => { setNavActive("profile"); setProfileTab("profile"); setShowProfile(true); }} />
      )}

      {showProfile && (
        <ProfileModal profile={profile} settings={settings}
          initialTab={profileTab}
          onClose={() => { setShowProfile(false); setNavActive(""); setProfileTab("profile"); }}
          onSaveProfile={(p) => setProfile(p)}
          onSaveSettings={(s) => setSettings(s)} />
      )}
    </>
  );
}
