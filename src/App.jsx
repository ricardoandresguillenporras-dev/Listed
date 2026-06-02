import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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
  Lácteos: "#7dd3fc", "Frutas y Verduras": "#86efac", Despensa: "#fcd34d",
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
    background: "#111", display: "flex", flexDirection: "column",
    position: "relative", paddingBottom: 76,
    fontFamily: "'Nunito','Segoe UI',sans-serif", color: "#fff",
  },
  header: {
    display: "flex", alignItems: "center", padding: "14px 16px 12px",
    background: "#111", borderBottom: "1px solid #222", gap: 10,
    position: "sticky", top: 0, zIndex: 10,
  },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  bottomBar: {
    position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
    width: 430, maxWidth: "100%", background: "#111",
    borderTop: "1px solid #222", display: "flex", alignItems: "center",
    padding: "10px 14px", gap: 10, zIndex: 20,
  },
  fab: {
    position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)",
    background: "linear-gradient(135deg,#4ade80,#22c55e)", color: "#111",
    border: "none", borderRadius: 28, padding: "13px 28px",
    fontSize: 15, fontWeight: 800, cursor: "pointer", zIndex: 21,
  },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const IconHome   = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill={color}/></svg>;
const IconSearch = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={color} strokeWidth="2.2"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;
const IconPerson = ({ size=24, color="#fff" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2.2"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke={color} strokeWidth="2.2" strokeLinecap="round"/></svg>;

// ── Bottom Nav ────────────────────────────────────────────────────────────────
function BottomNav({ active, onHome, onSearch, onProfile }) {
  const btn = (Icon, onClick, isActive) => (
    <button onClick={onClick} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"none", border:"none", cursor:"pointer", padding:"6px 0" }}>
      <div style={{ width:52, height:52, borderRadius:16, background:isActive?"#222":"transparent", display:"flex", alignItems:"center", justifyContent:"center", transition:"background .15s" }}>
        <Icon size={22} color={isActive?"#fff":"#555"} />
      </div>
    </button>
  );
  return (
    <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:430, maxWidth:"100%", background:"#111", borderTop:"1px solid #1e1e1e", display:"flex", alignItems:"center", paddingBottom:4, zIndex:20 }}>
      {btn(IconHome,   onHome,    active==="home")}
      {btn(IconSearch, onSearch,  active==="search")}
      {btn(IconPerson, onProfile, active==="profile")}
    </div>
  );
}

// ── Top Tabs (Pinterest style) ────────────────────────────────────────────────
function TopTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display:"flex", borderBottom:"1px solid #222", background:"#111", paddingLeft:4 }}>
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:70, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#1a1a1a", borderRadius:"22px 22px 0 0", width:"100%", maxWidth:430, animation:"slideUp .25s ease", maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", alignItems:"center", padding:"20px 20px 0", justifyContent:"space-between" }}>
          <div style={{ width:48, height:48, borderRadius:14, background:"#2a2a2a", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <IconPerson size={24} color="#aaa" />
          </div>
          <div style={{ flex:1, marginLeft:14 }}>
            <div style={{ fontSize:17, fontWeight:800 }}>{profile.name||"Mi Perfil"}</div>
            <div style={{ fontSize:12, color:"#666", marginTop:1 }}>Configuración personal</div>
          </div>
          <button onClick={onClose} style={{ background:"#222", border:"none", color:"#888", width:32, height:32, borderRadius:"50%", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
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
                <div style={{ fontSize:15, fontWeight:800, color:"#fff" }}>Presupuesto de compras</div>
                <div style={{ fontSize:12, color:"#666", marginTop:2 }}>¿Cuánto querés gastar por visita?</div>
              </div>
            </div>

            {/* Big number input */}
            <div style={{ background:"#111", borderRadius:16, padding:"16px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10, border:"1.5px solid #2a3a2a", transition:"border-color .2s" }}
              onFocus={(e) => e.currentTarget.style.borderColor="#4ade80"}
              onBlur={(e) => e.currentTarget.style.borderColor="#2a3a2a"}>
              <span style={{ color:"#4ade80", fontWeight:900, fontSize:24 }}>{sym}</span>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                placeholder="0"
                style={{ flex:1, background:"none", border:"none", color:"#fff", fontSize:30, fontWeight:800, outline:"none", width:"100%" }} />
              {budget && <button onClick={() => setBudget("")}
                style={{ background:"#2a2a2a", border:"none", color:"#888", width:30, height:30, borderRadius:"50%", fontSize:14, cursor:"pointer", flexShrink:0 }}>✕</button>}
            </div>

            {/* Quick-pick chips — editables */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, color:"#555", fontWeight:700, letterSpacing:.5, marginBottom:10, textTransform:"uppercase", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>Montos rápidos</span>
                <span style={{ fontSize:10, color:"#444", fontWeight:400, textTransform:"none" }}>Mantén para eliminar</span>
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                {quickAmts.map(amt => (
                  <button key={amt} onClick={() => setBudget(String(amt))}
                    onContextMenu={(e) => { e.preventDefault(); removeAmt(amt); }}
                    style={{ background:budget===String(amt)?"#4ade80":"#1e1e1e", border:"1.5px solid", borderColor:budget===String(amt)?"#4ade80":"#2a2a2a", borderRadius:20, padding:"7px 15px", color:budget===String(amt)?"#111":"#aaa", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s", position:"relative" }}>
                    {sym}{amt>=1000 ? `${(amt/1000).toFixed(0)}k` : amt}
                  </button>
                ))}
                {/* Botón para agregar monto */}
                {addingAmt ? (
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <input autoFocus type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)}
                      onKeyDown={e => { if(e.key==="Enter") confirmAmt(); if(e.key==="Escape") { setAddingAmt(false); setNewAmt(""); } }}
                      placeholder="ej. 15000"
                      style={{ width:90, background:"#1e1e1e", border:"1.5px solid #4ade80", borderRadius:20, padding:"7px 10px", color:"#fff", fontSize:13, outline:"none", textAlign:"center" }} />
                    <button onClick={confirmAmt} style={{ background:"#4ade80", border:"none", borderRadius:"50%", width:28, height:28, color:"#111", fontSize:16, fontWeight:900, cursor:"pointer" }}>✓</button>
                  </div>
                ) : (
                  <button onClick={() => setAddingAmt(true)}
                    style={{ background:"none", border:"1.5px dashed #2a2a2a", borderRadius:20, padding:"7px 14px", color:"#444", fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor="#4ade80"; e.currentTarget.style.color="#4ade80"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor="#2a2a2a"; e.currentTarget.style.color="#444"; }}>
                    + Agregar
                  </button>
                )}
              </div>
            </div>

            {/* Info callout */}
            <div style={{ background:"#161f16", borderRadius:12, padding:"12px 14px", border:"1px solid #1e3a1e", display:"flex", gap:10, alignItems:"flex-start" }}>
              <span style={{ fontSize:18, flexShrink:0 }}>💡</span>
              <p style={{ fontSize:12, color:"#666", lineHeight:1.6, margin:0 }}>
                Con presupuesto activo, la bolsita 🛍 en el header se convierte en un card que al tocar muestra cuánto te queda libre o si te pasaste.
              </p>
            </div>
          </>}
          {tab==="currency" && (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {CURRENCIES.map((c) => (
                <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                  display:"flex", alignItems:"center", gap:12, padding:"12px 14px",
                  background:c.code===currency?"#1a3a1a":"#222",
                  border:c.code===currency?"1.5px solid #4ade80":"1.5px solid transparent",
                  borderRadius:12, cursor:"pointer", color:"#fff", textAlign:"left",
                }}>
                  <span style={{ fontSize:22 }}>{c.flag}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:700 }}>{c.label}</div>
                    <div style={{ fontSize:12, color:"#888" }}>{c.code} · {c.symbol}</div>
                  </div>
                  {c.code===currency && <span style={{ color:"#4ade80", fontWeight:800 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ padding:"0 20px 24px", display:"flex", gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:"#222", border:"none", borderRadius:10, padding:12, color:"#aaa", fontSize:14, cursor:"pointer" }}>Cancelar</button>
          <button onClick={() => { onSaveProfile({ name, budget }); onSaveSettings({ currencyCode:currency }); onClose(); }}
            style={{ flex:2, background:"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", borderRadius:12, padding:14, color:"#111", fontSize:15, fontWeight:800, cursor:"pointer" }}>
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit helpers ──────────────────────────────────────────────────────────────
const editInputStyle = { width:"100%", background:"#222", border:"1px solid #333", borderRadius:10, padding:"11px 12px", color:"#fff", fontSize:15, outline:"none", boxSizing:"border-box" };
const qtyEditBtn = { background:"#333", border:"none", color:"#fff", width:40, height:40, borderRadius:10, fontSize:20, cursor:"pointer" };
function EditLabel({ children }) {
  return <label style={{ display:"block", fontSize:11, color:"#888", fontWeight:700, marginBottom:4, marginTop:14, textTransform:"uppercase", letterSpacing:1 }}>{children}</label>;
}

// ── ContextMenu ───────────────────────────────────────────────────────────────
function ContextMenu({ item, onClose, onDelete, onDuplicate, onEdit, sym }) {
  const subtotal = (parseFloat(item.price)||0)*(item.qty||1);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.55)", zIndex:50, display:"flex", alignItems:"flex-end", justifyContent:"center" }}
      onClick={(e) => e.target===e.currentTarget && onClose()}>
      <div style={{ background:"#1a1a1a", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:430, paddingBottom:20, overflow:"hidden", animation:"slideUp .2s ease" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, padding:"18px 20px 14px", borderBottom:"1px solid #2a2a2a" }}>
          <span style={{ fontSize:28 }}>{item.emoji}</span>
          <div>
            <div style={{ fontSize:16, fontWeight:800 }}>{item.name}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{item.qty||1} {item.unit||"pza"}{item.price?` · ${sym}${Math.round(subtotal).toLocaleString()}`:""}</div>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:2, padding:"8px 12px" }}>
          <CtxBtn icon="✏️" onClick={onEdit}>Editar artículo</CtxBtn>
          <CtxBtn icon="📋" onClick={onDuplicate}>Duplicar</CtxBtn>
          <div style={{ height:1, background:"#2a2a2a", margin:"4px 12px" }} />
          <CtxBtn icon="🗑" danger onClick={onDelete}>Eliminar</CtxBtn>
          <div style={{ height:1, background:"#2a2a2a", margin:"4px 12px" }} />
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
      <div style={{ background:"#1a1a1a", borderRadius:"20px 20px 0 0", width:"100%", maxWidth:430, padding:20, animation:"slideUp .2s ease", maxHeight:"85vh", overflowY:"auto" }}>
        <div style={{ fontSize:17, fontWeight:800, marginBottom:18, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:28 }}>{item.emoji}</span> Editar artículo
        </div>
        <EditLabel>Nombre</EditLabel>
        <input value={name} onChange={(e) => setName(e.target.value)} style={editInputStyle} />
        <EditLabel>Precio por unidad</EditLabel>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
          <span style={{ color:"#4ade80", fontSize:18, fontWeight:800 }}>{sym}</span>
          <input type="number" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} style={{ ...editInputStyle, flex:1 }} />
        </div>
        {/* Preset price hint */}
        {presetPrice && !price && (
          <button onClick={() => setPrice(String(presetPrice))}
            style={{ marginTop:6, background:"#1a2e1a", border:"1px solid #2d4a2d", borderRadius:8, padding:"5px 10px", color:"#86efac", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:6, animation:"fadeIn .25s ease" }}>
            <span style={{ fontSize:14 }}>💡</span>
            Precio típico en CR: {sym}{presetPrice.toLocaleString()} — usar este
          </button>
        )}
        <EditLabel>Cantidad</EditLabel>
        <div style={{ display:"flex", gap:8, alignItems:"center", marginTop:4 }}>
          <button style={qtyEditBtn} onClick={() => setQty(q => Math.max(1,q-1))}>−</button>
          <span style={{ fontSize:18, fontWeight:800, minWidth:36, textAlign:"center", lineHeight:"40px" }}>{qty}</span>
          <button style={qtyEditBtn} onClick={() => setQty(q => q+1)}>+</button>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} style={{ background:"#222", border:"1px solid #333", borderRadius:10, color:"#fff", padding:"0 10px", fontSize:14, height:40 }}>
            {UNITS.map(u => <option key={u}>{u}</option>)}
          </select>
        </div>
        <EditLabel>Nota (opcional)</EditLabel>
        <input placeholder="ej. Sin azúcar, marca X..." value={note} onChange={(e) => setNote(e.target.value)} style={editInputStyle} />
        {price && (
          <div style={{ marginTop:16, background:"#111", borderRadius:12, padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", border:"1px solid #2d4a2d" }}>
            <span style={{ color:"#86efac", fontSize:14 }}>Subtotal</span>
            <span style={{ color:"#4ade80", fontSize:20, fontWeight:800 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, marginTop:18 }}>
          <button onClick={onClose} style={{ flex:1, background:"#222", border:"none", borderRadius:10, padding:10, color:"#aaa", fontSize:14, cursor:"pointer" }}>Cancelar</button>
          <button onClick={() => onSave({ ...item, name, price, qty, unit, note })}
            style={{ flex:2, background:"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", borderRadius:12, padding:14, color:"#111", fontSize:15, fontWeight:800, cursor:"pointer" }}>
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
        if (rowRef.current) rowRef.current.style.transform="translateX(-110%)";
        setTimeout(() => onDelete(item.id), 220);
      } else if (s.curX > THRESHOLD) {
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
        <div className="sl-bg-left" style={{ position:"absolute", inset:0, background:"#ef4444", display:"none", alignItems:"center", justifyContent:"flex-end", paddingRight:22, fontSize:15, fontWeight:700, color:"#fff", gap:8 }}>🗑 Eliminar</div>
        <div ref={rowRef}
          style={{ display:"flex", alignItems:"center", padding:"10px 14px", gap:10, background:"#141f14", position:"relative", touchAction:"pan-y", userSelect:"none", borderBottom:"1px solid #1c2b1c", cursor:"pointer" }}
          onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
          onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
          onClick={(e) => { if (!swipeState.current.hasMoved) onToggle(item.id); }}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

          {/* soft left accent bar */}
          <div style={{ position:"absolute", left:0, top:6, bottom:6, width:3, borderRadius:3, background:"#4ade80", opacity:.5 }} />

          {/* check circle – soft green, tappable to uncheck */}
          <button onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
            style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #4ade80", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"#4ade80", color:"#111", fontSize:13, fontWeight:900, transition:"transform .15s ease", animation:"softPop .3s ease" }}
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
            <span style={{ fontSize:15, fontWeight:600, display:"block", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"#a7f3c0", opacity:.85 }}>{item.name}</span>
            {item.price && (
              <span style={{ fontSize:11, color:"#6ee7a0", fontWeight:600 }}>{sym}{Math.round(subtotal).toLocaleString()}</span>
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
    <div ref={wrapRef} style={{ position:"relative", overflow:"hidden", borderBottom:"1px solid #1e1e1e", animation:"itemIn .22s ease both" }}>
      <div className="sl-bg-left"  style={{ position:"absolute", inset:0, background:"#ef4444", display:"none", alignItems:"center", justifyContent:"flex-end",  paddingRight:22, fontSize:15, fontWeight:700, color:"#fff", gap:8 }}>🗑 Eliminar</div>
      <div className="sl-bg-right" style={{ position:"absolute", inset:0, background:"#4ade80", display:"none", alignItems:"center", justifyContent:"flex-start", paddingLeft:22,  fontSize:15, fontWeight:700, color:"#111", gap:8 }}>✓ Seleccionar</div>
      <div ref={rowRef}
        style={{ display:"flex", alignItems:"center", padding:"11px 14px", gap:10, background:"#111", position:"relative", touchAction:"pan-y", userSelect:"none", transition:"opacity .3s", cursor:"pointer" }}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onClick={(e) => { if (!swipeState.current.hasMoved && !e.target.closest("button") && !e.target.closest("input")) onToggle(item.id); }}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}>

        <button onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
          style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #3a3a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, background:"transparent", fontSize:14, fontWeight:"bold", transition:"border-color .2s, transform .15s" }}
          onMouseDown={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#4ade80"; }}
          onMouseUp={(e)   => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.borderColor="#3a3a3a"; }}
          onTouchStart={(e) => { e.currentTarget.style.transform="scale(0.85)"; e.currentTarget.style.borderColor="#4ade80"; }}
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
                style={{ background:"#1e1e1e", border:"1px solid #4ade80", borderRadius:6, color:"#4ade80", fontSize:13, width:80, padding:"2px 6px", textAlign:"right", outline:"none" }} />
            ) : (
              <button onClick={(e) => { e.stopPropagation(); setEditingPriceId(item.id); setTempPrice(item.price||""); }}
                style={{ background:"none", border:"none", color:item.price?"#4ade80":"#555", fontSize:12, cursor:"pointer", padding:0, textDecoration:"underline dotted" }}>
                {item.price ? `${sym}${Math.round(subtotal).toLocaleString()}` : "+ precio"}
              </button>
            )}
            {item.note && <span style={{ background:"#222", borderRadius:6, padding:"1px 7px", fontSize:11, color:"#aaa" }}>📝 {item.note}</span>}
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
          {qty===1 ? (
            <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              style={{ background:"#3a1010", border:"none", color:"#ff6b6b", width:28, height:28, borderRadius:8, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>🗑</button>
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onQtyMinus(item.id); }}
              style={{ background:"#222", border:"none", color:"#fff", width:28, height:28, borderRadius:8, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
          )}
          <span style={{ fontSize:14, fontWeight:800, minWidth:22, textAlign:"center" }}>{qty}</span>
          <button onClick={(e) => { e.stopPropagation(); onQtyPlus(item.id); }}
            style={{ background:"#222", border:"none", color:"#fff", width:28, height:28, borderRadius:8, fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
        </div>
      </div>
    </div>
  );
}

// ── ListsView ─────────────────────────────────────────────────────────────────
function ListsView({ lists, onOpenList, onDeleteList, onCreateList, sym, history, budget }) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [tab, setTab] = useState("listas");
  const inputRef = useRef(null);
  useEffect(() => { if (showNew) inputRef.current?.focus(); }, [showNew]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateList(newName.trim()); setNewName(""); setShowNew(false);
  };

  return (
    <>
      <div style={S.header}>
        <span style={{ flex:1, fontWeight:800, fontSize:22 }}>SuperLista</span>
      </div>
      <TopTabs tabs={[{id:"listas",label:"Listas"},{id:"stats",label:"Estadísticas"}]} active={tab} onChange={setTab} />
      {tab === "stats" ? (
        <div style={S.body}>
          <StatsView history={history} budget={budget} sym={sym} />
        </div>
      ) : (
      <div style={S.body}>
        {lists.map((list, idx) => {
          const done = list.items.filter(i => i.checked).length;
          const total = list.items.length;
          const cost = totalCost(list.items);
          return (
            <div key={list.id} onClick={() => onOpenList(list.id)}
              style={{ margin:"8px 16px", background:"#1a1a1a", borderRadius:14, padding:16, cursor:"pointer", border:"1px solid #2a2a2a", animation:`itemIn .2s ease ${idx*0.04}s both` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontSize:18, fontWeight:800 }}>{list.name}</span>
                <button onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }} style={{ background:"none", border:"none", color:"#555", fontSize:16, cursor:"pointer" }}>✕</button>
              </div>
              {total>0 && (
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ flex:1, height:6, background:"#2a2a2a", borderRadius:3 }}>
                    <div style={{ height:"100%", background:"linear-gradient(90deg,#4ade80,#22c55e)", borderRadius:3, width:`${(done/total)*100}%`, transition:"width .5s ease" }} />
                  </div>
                  <span style={{ fontSize:12, color:"#aaa" }}>{done}/{total}</span>
                </div>
              )}
              {cost>0  && <span style={{ fontSize:13, color:"#4ade80" }}>{sym}{Math.round(cost).toLocaleString()} estimado</span>}
              {total===0 && <span style={{ fontSize:12, color:"#555" }}>Toca para añadir artículos</span>}
            </div>
          );
        })}

        {showNew ? (
          <div style={{ margin:"8px 16px", background:"#1a1a1a", borderRadius:14, padding:16, animation:"itemIn .18s ease both" }}>
            <input ref={inputRef} value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key==="Enter" && handleCreate()} placeholder="Nombre de la lista..."
              style={{ width:"100%", background:"#1e1e1e", border:"1px solid #333", borderRadius:10, padding:"11px 12px", color:"#fff", fontSize:15, outline:"none", boxSizing:"border-box" }} />
            <div style={{ display:"flex", gap:10, marginTop:10 }}>
              <button onClick={() => { setShowNew(false); setNewName(""); }} style={{ flex:1, background:"#222", border:"none", borderRadius:10, padding:10, color:"#aaa", fontSize:14, cursor:"pointer" }}>Cancelar</button>
              <button onClick={handleCreate} style={{ flex:1, background:"linear-gradient(135deg,#4ade80,#22c55e)", border:"none", borderRadius:10, padding:10, color:"#111", fontSize:14, fontWeight:800, cursor:"pointer" }}>Crear</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowNew(true)}
            style={{ margin:"8px 16px", width:"calc(100% - 32px)", background:"none", border:"2px dashed #2a2a2a", borderRadius:14, padding:16, color:"#555", fontSize:16, cursor:"pointer" }}>
            + Nueva lista
          </button>
        )}
      </div>
      )}
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
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#4ade80", fontSize:24, cursor:"pointer", padding:"0 6px" }}>←</button>
        <span style={{ flex:1, fontWeight:800, fontSize:18 }}>{list.name}</span>
        <span style={{ background:"#222", borderRadius:12, padding:"3px 10px", fontSize:13, color:"#aaa", marginRight:4 }}>{done}/{tot}</span>

        {/* ── Budget flip card en el header ── */}
        {editingBudget ? (
          /* Modo edición inline — reemplaza el card */
          <div style={{ display:"flex", alignItems:"center", gap:4, background:"#1a2e1a", border:"1.5px solid #4ade80", borderRadius:22, padding:"0 10px", height:38, animation:"fadeIn .15s ease" }}>
            <span style={{ color:"#4ade80", fontWeight:900, fontSize:14 }}>{sym}</span>
            <input autoFocus type="number" value={budgetDraft}
              onChange={e => setBudgetDraft(e.target.value)}
              onKeyDown={e => { if(e.key==="Enter") confirmBudgetEdit(); if(e.key==="Escape") setEditingBudget(false); }}
              onBlur={confirmBudgetEdit}
              style={{ width:52, background:"none", border:"none", color:"#fff", fontSize:14, fontWeight:800, outline:"none", textAlign:"right" }}
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
                  <span style={{ fontSize:8, color:"#86efac", display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700 }}>
                    {budgetNum > 0 ? "presup." : "bolsa"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color:"#4ade80" }}>
                    {budgetNum > 0 ? `${sym}${budgetNum >= 1000 ? `${(budgetNum/1000).toFixed(0)}k` : budgetNum}` : `${sym}${Math.round(inBagCost).toLocaleString()}`}
                  </span>
                </div>
              </div>
              {/* DORSO: libre o excedido */}
              <div className={`flip-card-back${overBudget ? " over" : ""}`} style={{ flexDirection:"row", alignItems:"center", gap:5, padding:"0 10px" }}>
                <span style={{ fontSize:16 }}>{overBudget ? "🚨" : "✅"}</span>
                <div style={{ lineHeight:1.2 }}>
                  <span style={{ fontSize:8, display:"block", letterSpacing:.5, textTransform:"uppercase", fontWeight:700, color: overBudget ? "#fca5a5" : "#86efac" }}>
                    {overBudget ? "excedido" : "libre"}
                  </span>
                  <span style={{ fontSize:13, fontWeight:800, color: overBudget ? "#f87171" : "#4ade80" }}>
                    {remaining < 0 ? "-" : ""}{sym}{Math.abs(Math.round(remaining)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {tot>0 && (
        <div style={{ height:4, background:"#222" }}>
          <div style={{ height:"100%", background: budgetNum>0
            ? overBudget
              ? "linear-gradient(90deg,#ef4444,#b91c1c)"
              : `linear-gradient(90deg,#4ade80,#22c55e)`
            : "linear-gradient(90deg,#4ade80,#22c55e)",
            borderRadius:2, width:`${budgetNum>0 ? Math.min(budgetPct,100) : tot?(done/tot)*100:0}%`, transition:"width .5s cubic-bezier(.4,0,.2,1)" }} />        </div>
      )}

      <div style={S.body}>
        {list.items.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 20px" }}>
            <div style={{ fontSize:56, marginBottom:12 }}>🛒</div>
            <div style={{ fontSize:18, fontWeight:700, color:"#ddd", marginBottom:6 }}>Tu lista está vacía</div>
            <div style={{ fontSize:13, color:"#555" }}>Toca + Añadir para agregar artículos</div>
          </div>
        )}
        {searchQuery && all.length===0 && <div style={{ fontSize:13, color:"#555", padding:20, textAlign:"center" }}>Sin resultados para "{searchQuery}"</div>}

        {/* ── Pendientes con header colapsable ── */}
        {unchecked.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", padding:"8px 16px 6px", borderBottom:"1px solid #1e1e1e" }}>
            <button onClick={() => setShowUnchecked(v => !v)}
              style={{ background:"none", border:"none", color:"#aaa", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0, fontWeight:700 }}>
              <span style={{ fontSize:11, transition:"transform .2s", display:"inline-block", transform: showUnchecked ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              <span>En lista</span>
              <span style={{ background:"#222", borderRadius:10, padding:"1px 8px", fontSize:11, color:"#666", fontWeight:600 }}>{unchecked.length}</span>
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
          <div style={{ display:"flex", alignItems:"center", padding:"10px 16px", borderTop:"1px solid #1e2e1e", background:"#121a12" }}>
            <button onClick={() => setShowCompleted(v => !v)}
              style={{ background:"none", border:"none", color:"#86efac", fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:6, padding:0, fontWeight:700, flex:1 }}>
              <span style={{ fontSize:11, transition:"transform .2s", display:"inline-block", transform: showCompleted ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
              <span style={{ fontSize:13 }}>🛍</span>
              <span>{checked.length === 1 ? "1 artículo en tu bolsa" : `${checked.length} artículos en tu bolsa`}</span>
            </button>
            {inBagCost > 0 && (
              <span style={{ fontSize:12, color:"#4ade80", fontWeight:700 }}>{sym}{Math.round(inBagCost).toLocaleString()}</span>
            )}
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
      {checked.length > 0 && (
        <button
          onClick={() => onCloseSession({ total: inBagCost, items: list.items.filter(i=>i.checked), listName: list.name, date: Date.now(), itemCount: done })}
          style={{ position:"fixed", bottom:130, left:"50%", transform:"translateX(-50%)", background:"linear-gradient(135deg,#22c55e,#16a34a)", color:"#fff", border:"none", borderRadius:28, padding:"11px 24px", fontSize:14, fontWeight:800, cursor:"pointer", zIndex:21, display:"flex", alignItems:"center", gap:6, boxShadow:"0 4px 20px rgba(34,197,94,.35)", animation:"slideUp .2s ease" }}>
          🛍 Cerrar compra · {sym}{Math.round(inBagCost).toLocaleString()}
        </button>
      )}

      <div style={S.bottomBar}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#555", fontSize:16, pointerEvents:"none" }}>🔍</span>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar en lista..."
            style={{ width:"100%", background:"#1e1e1e", border:"1px solid #333", borderRadius:22, padding:"9px 16px 9px 36px", color:"#fff", fontSize:14, outline:"none", boxSizing:"border-box" }} />
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

// ── AddItemsView ──────────────────────────────────────────────────────────────
function AddItemsView({ list, onBack, onAddItem, sym }) {
  const [search,      setSearch]      = useState("");
  const [category,    setCategory]    = useState("Todos");
  const [customEmoji, setCustomEmoji] = useState("🛒");
  const [customName,  setCustomName]  = useState("");

  const filtered = PRESET_ITEMS.filter(p => {
    const inCat    = category==="Todos" || p.category===category;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const added    = list.items.some(it => it.name===p.name);
    return inCat && inSearch && !added;
  });

  const addPreset = (p) => onAddItem({ id:genId(), name:p.name, emoji:p.emoji, category:p.category, checked:false, price:String(CR_PRICES[p.name]||""), qty:1, unit:"pza", note:"" });
  const addCustom = () => {
    if (!customName.trim()) return;
    onAddItem({ id:genId(), name:customName.trim(), emoji:customEmoji, category:"Otros", checked:false, price:"", qty:1, unit:"pza", note:"" });
    setCustomName(""); setCustomEmoji("🛒");
  };

  return (
    <>
      <div style={S.header}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#4ade80", fontSize:24, cursor:"pointer", padding:"0 6px" }}>←</button>
        <span style={{ flex:1, fontWeight:800, fontSize:18 }}>Agregar artículos</span>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#4ade80", fontSize:15, fontWeight:800, cursor:"pointer", padding:"4px 10px", borderRadius:10 }}>Listo ✓</button>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:"1px solid #222" }}>
        <input value={customEmoji} onChange={(e) => setCustomEmoji(e.target.value)} maxLength={2}
          style={{ width:40, height:40, background:"#222", border:"none", borderRadius:10, fontSize:22, textAlign:"center", color:"#fff", outline:"none" }} />
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => e.key==="Enter" && addCustom()}
          placeholder="Artículo personalizado..."
          style={{ flex:1, background:"#1e1e1e", border:"1px solid #333", borderRadius:10, padding:"11px 12px", color:"#fff", fontSize:15, outline:"none" }} />
        <button onClick={addCustom} style={{ background:"#4ade80", border:"none", borderRadius:10, width:40, height:40, fontSize:22, color:"#111", fontWeight:800, cursor:"pointer", flexShrink:0 }}>+</button>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Buscar artículo..."
        style={{ margin:"8px 16px", width:"calc(100% - 32px)", background:"#1e1e1e", border:"1px solid #333", borderRadius:10, padding:"11px 12px", color:"#fff", fontSize:15, outline:"none", boxSizing:"border-box" }} />

      <div style={{ display:"flex", overflowX:"auto", gap:6, padding:"8px 16px", scrollbarWidth:"none" }}>
        {["Todos",...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCategory(cat)}
            style={{ borderRadius:20, border:"none", padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, background:category===cat?"#4ade80":"#2a2a2a", color:category===cat?"#111":"#aaa" }}>
            {cat}
          </button>
        ))}
      </div>

      <div style={{ overflowY:"auto", flex:1 }}>
        {filtered.length===0 ? (
          <div style={{ fontSize:13, color:"#555", padding:20, textAlign:"center" }}>No hay más artículos aquí</div>
        ) : (
          filtered.map(p => {
            const crp = CR_PRICES[p.name];
            return (
              <button key={p.name} onClick={() => addPreset(p)}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:"none", border:"none", borderBottom:"1px solid #1e1e1e", cursor:"pointer", color:"#fff", textAlign:"left" }}>
                <span style={{ fontSize:26, width:34, textAlign:"center" }}>{p.emoji}</span>
                <div style={{ flex:1 }}>
                  <span style={{ display:"block", fontSize:15, fontWeight:600 }}>{p.name}</span>
                  <span style={{ fontSize:12, color:CAT_COLORS[p.category]||"#aaa" }}>{p.category}</span>
                </div>
                {crp && <span style={{ fontSize:12, color:"#4ade80", fontWeight:700, marginRight:6, flexShrink:0 }}>{sym}{crp.toLocaleString()}</span>}
                <span style={{ background:"#4ade80", color:"#111", width:28, height:28, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800, flexShrink:0 }}>+</span>
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth={stroke} />
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
                  ? "linear-gradient(180deg,#4ade80,#16a34a)"
                  : "linear-gradient(180deg,#2a3a2a,#1e2e1e)",
                border: isLast ? "none" : "1px solid #2a3a2a",
                transition: "height .5s cubic-bezier(.4,0,.2,1)",
                cursor: "default",
                boxShadow: isLast ? "0 0 10px rgba(74,222,128,.35)" : "none",
              }}
            />
            <span style={{
              position: "absolute", bottom: 0,
              fontSize: 9, color: isLast ? "#4ade80" : "#444",
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
    return { icon: "📉", text: `Tus últimas 3 compras están bajando. ¡Buen control del gasto!`, color: "#4ade80" };
  if (topItem && topItem[1] >= 3)
    return { icon: "🔁", text: `"${topItem[0]}" aparece ${topItem[1]}× en este período — tu ítem más recurrente.`, color: "#a5b4fc" };
  if (freq_per_week && parseFloat(freq_per_week) >= 2)
    return { icon: "🛒", text: `Comprás unas ${freq_per_week}× por semana. Agrupar visitas puede ahorrarte tiempo y plata.`, color: "#fcd34d" };
  if (last > avg * 1.3)
    return { icon: "💸", text: `Última compra fue un ${Math.round(((last - avg) / avg) * 100)}% más cara que tu promedio.`, color: "#fb923c" };
  return { icon: "✅", text: `Gasto estable. Ticket promedio: ${fmtAmt(avg, sym)}.`, color: "#86efac" };
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
    { label: "Hace 2 sem", val: prevW, color: "#2a3a2a" },
    { label: "Sem pasada", val: lastW, color: "#2d4a3a" },
    { label: "Esta sem", val: thisW, color: "#4ade80" },
  ];

  const delta = lastW > 0 ? (((thisW - lastW) / lastW) * 100).toFixed(0) : null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 60, marginBottom: 8 }}>
        {bars.map((b, i) => {
          const h = Math.max(4, (b.val / maxW) * 60);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, color: i === 2 ? "#4ade80" : "#555", fontWeight: i === 2 ? 700 : 400 }}>
                {b.val > 0 ? fmtAmt(b.val, sym) : "—"}
              </span>
              <div style={{
                width: "100%", height: h, borderRadius: "4px 4px 0 0",
                background: i === 2 ? "linear-gradient(180deg,#4ade80,#16a34a)" : b.color,
                transition: "height .5s ease",
              }} />
              <span style={{ fontSize: 9, color: i === 2 ? "#4ade80" : "#444", textAlign: "center", lineHeight: 1.2 }}>
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
      {delta !== null && (
        <div style={{ fontSize: 11, color: parseFloat(delta) > 0 ? "#f87171" : "#4ade80", fontWeight: 700, textAlign: "center" }}>
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

  const color = streak >= 8 ? "#f59e0b" : streak >= 4 ? "#a78bfa" : streak >= 2 ? "#4ade80" : "#555";
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
          {streak} <span style={{ fontSize: 13, fontWeight: 600, color: "#555" }}>sem</span>
        </div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
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
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {best.name}
        </div>
        <div style={{ fontSize: 11, color: "#555" }}>{fmtShortDate(best.date)}</div>
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
        <div style={{ fontSize: 18, fontWeight: 800, color: "#ddd", marginBottom: 8 }}>Sin datos aún</div>
        <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>
          Completá una compra marcando artículos<br />y tocando "Cerrar compra".
        </div>
      </div>
    );
  }

  // ── UI ──
  const cardStyle = {
    background: "#161616",
    border: "1px solid #242424",
    borderRadius: 18,
    padding: "16px 18px",
  };
  const labelStyle = {
    fontSize: 10,
    color: "#444",
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  };

  const periodLabels = { month: "Este mes", q3: "Últimos 3 meses", all: "Todo el tiempo" };

  return (
    <div style={{ padding: "0 0 32px" }}>

      {/* ── Period tabs ── */}
      <div style={{
        display: "flex", gap: 0, background: "#111",
        borderBottom: "1px solid #1e1e1e",
        position: "sticky", top: 0, zIndex: 5,
      }}>
        {[["month", "Este mes"], ["q3", "3 meses"], ["all", "Todo"]].map(([id, label]) => {
          const on = period === id;
          return (
            <button key={id} onClick={() => setPeriod(id)} style={{
              flex: 1, background: "none", border: "none",
              color: on ? "#4ade80" : "#444", fontWeight: on ? 800 : 500,
              fontSize: 13, padding: "12px 4px", cursor: "pointer",
              position: "relative", transition: "color .15s",
            }}>
              {label}
              {on && (
                <span style={{
                  position: "absolute", bottom: 0, left: "20%", right: "20%",
                  height: 2, background: "#4ade80", borderRadius: 2, display: "block",
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
            <div style={{ fontSize: 36, fontWeight: 900, color: "#4ade80", lineHeight: 1, letterSpacing: -1 }}>
              {fmtAmt(total, sym)}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#555" }}>
                {sessions.length} compra{sessions.length !== 1 ? "s" : ""}
              </span>
              {avgTicket > 0 && (
                <span style={{ fontSize: 12, color: "#555" }}>
                  Ticket prom. <span style={{ color: "#86efac", fontWeight: 700 }}>{fmtAmt(avgTicket, sym)}</span>
                </span>
              )}
              {delta !== null && (
                <span style={{ fontSize: 12, fontWeight: 700, color: parseFloat(delta) > 0 ? "#f87171" : "#4ade80" }}>
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
                color: budgetPct >= 100 ? "#f87171" : budgetPct >= 80 ? "#fb923c" : "#4ade80",
              }}>
                {Math.round(budgetPct)}%
              </span>
            </div>
            <div style={{ height: 6, background: "#222", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${budgetPct}%`,
                background: budgetPct >= 100 ? "linear-gradient(90deg,#ef4444,#dc2626)"
                  : budgetPct >= 80 ? "linear-gradient(90deg,#f59e0b,#d97706)"
                  : "linear-gradient(90deg,#4ade80,#22c55e)",
                transition: "width .6s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: "#444" }}>
                {total < budgetCap
                  ? `${fmtAmt(budgetCap - total, sym)} disponible`
                  : `${fmtAmt(total - budgetCap, sym)} excedido`}
              </span>
              <span style={{ fontSize: 10, color: "#444" }}>de {fmtAmt(budgetCap, sym)}</span>
            </div>
          </div>
        )}

        {/* ── Bar chart con fechas ── */}
        {sessions.length > 0 && (
          <div style={cardStyle}>
            <div style={labelStyle}>Historial de compras</div>
            <BarChart sessions={sessions} sym={sym} maxBars={12} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#444" }}>
                {sessions.length > 0 ? fmtShortDate(sessions[0].date) : ""}
              </span>
              <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>
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
                  <span style={{ fontSize: 10, color: "#555", fontWeight: 700, letterSpacing: 0.5 }}>
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
              <p style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6, margin: 0 }}>
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
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ddd" }}>
                      {s.listName || "Compra"}
                    </div>
                    <div style={{ fontSize: 10, color: "#444", marginTop: 1 }}>
                      {fmtDate(s.date)} · {s.itemCount || (s.items?.length) || 0} art.
                    </div>
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 900, color: "#4ade80",
                    background: "#4ade8011", borderRadius: 8,
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

  useEffect(() => { LS.set("sl5_lists",    lists);    }, [lists]);
  useEffect(() => { LS.set("sl5_settings", settings); }, [settings]);
  useEffect(() => { LS.set("sl5_profile",  profile);  }, [profile]);
  useEffect(() => { LS.set("sl5_history",  history);  }, [history]);

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
        body { background:#111; }
        @keyframes slideUp    { from { transform:translateY(22px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes itemIn     { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes underlineIn{ from { transform:scaleX(0); } to { transform:scaleX(1); } }
        @keyframes fadeIn     { from { opacity:0; } to { opacity:1; } }
        @keyframes softPop    { 0%{transform:scale(1)} 50%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes bagSlide   { from{opacity:0;transform:translateX(6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes budgetIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseRed   { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 5px rgba(239,68,68,.18)} }
        .flip-card { position:relative; cursor:pointer; perspective:700px; flex-shrink:0; }
        .flip-card-inner { position:relative; width:100%; height:100%; transform-style:preserve-3d; transition:transform .45s cubic-bezier(.4,0,.2,1); }
        .flip-card.flipped .flip-card-inner { transform:rotateY(180deg); }
        .flip-card-front, .flip-card-back { position:absolute; inset:0; border-radius:22px; padding:7px 14px; display:flex; flex-direction:column; justify-content:center; backface-visibility:hidden; -webkit-backface-visibility:hidden; }
        .flip-card-front { background:#1a2e1a; border:1px solid #2d4a2d; }
        .flip-card-back { background:#1a2e1a; border:1px solid #2d4a2d; transform:rotateY(180deg); }
        .flip-card-back.over { background:#2d0f0f; border-color:#7f1d1d; animation:pulseRed 2s infinite; }
      `}</style>
      <div style={S.app}>
        {view==="lists" && (
          <ListsView lists={lists} sym={sym} history={history} budget={profile.budget}
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
          onHome={() => setNavActive("home")}
          onSearch={() => setNavActive("search")}
          onProfile={() => { setNavActive("profile"); setShowProfile(true); }} />
      )}

      {showProfile && (
        <ProfileModal profile={profile} settings={settings}
          initialTab={profileTab}
          onClose={() => { setShowProfile(false); setNavActive("home"); setProfileTab("profile"); }}
          onSaveProfile={(p) => setProfile(p)}
          onSaveSettings={(s) => setSettings(s)} />
      )}
    </>
  );
}
