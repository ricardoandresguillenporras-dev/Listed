import { useState, useEffect, useRef, useCallback } from "react";

// ── Data ────────────────────────────────────────────────────────────────────

const PRESET_ITEMS = [
  { name: "Leche", category: "Lácteos", emoji: "🥛" },
  { name: "Huevos", category: "Lácteos", emoji: "🥚" },
  { name: "Queso Mozarela", category: "Lácteos", emoji: "🧀" },
  { name: "Yogur", category: "Lácteos", emoji: "🫙" },
  { name: "Mantequilla", category: "Lácteos", emoji: "🧈" },
  { name: "Manzanas", category: "Frutas y Verduras", emoji: "🍎" },
  { name: "Plátanos", category: "Frutas y Verduras", emoji: "🍌" },
  { name: "Tomates", category: "Frutas y Verduras", emoji: "🍅" },
  { name: "Aguacate", category: "Frutas y Verduras", emoji: "🥑" },
  { name: "Espinacas", category: "Frutas y Verduras", emoji: "🥬" },
  { name: "Brócoli", category: "Frutas y Verduras", emoji: "🥦" },
  { name: "Zanahorias", category: "Frutas y Verduras", emoji: "🥕" },
  { name: "Limones", category: "Frutas y Verduras", emoji: "🍋" },
  { name: "Miel", category: "Despensa", emoji: "🍯" },
  { name: "Aceite de Oliva", category: "Despensa", emoji: "🫙" },
  { name: "Arroz", category: "Despensa", emoji: "🍚" },
  { name: "Pasta", category: "Despensa", emoji: "🍝" },
  { name: "Harina", category: "Despensa", emoji: "🌾" },
  { name: "Sal", category: "Despensa", emoji: "🧂" },
  { name: "Pollo", category: "Carnes", emoji: "🍗" },
  { name: "Carne molida", category: "Carnes", emoji: "🥩" },
  { name: "Salmón", category: "Carnes", emoji: "🐟" },
  { name: "Jamón", category: "Carnes", emoji: "🥓" },
  { name: "Pan", category: "Panadería", emoji: "🍞" },
  { name: "Tortillas", category: "Panadería", emoji: "🫓" },
  { name: "Café", category: "Bebidas", emoji: "☕" },
  { name: "Jugo de naranja", category: "Bebidas", emoji: "🍊" },
  { name: "Agua mineral", category: "Bebidas", emoji: "💧" },
  { name: "Shampoo", category: "Higiene", emoji: "🧴" },
  { name: "Jabón", category: "Higiene", emoji: "🧼" },
  { name: "Papel de baño", category: "Higiene", emoji: "🧻" },
  { name: "Cloro", category: "Limpieza", emoji: "🧹" },
  { name: "Detergente", category: "Limpieza", emoji: "🫧" },
];

const CATEGORIES = [...new Set(PRESET_ITEMS.map((i) => i.category))];

const CAT_COLORS = {
  Lácteos: "#7dd3fc",
  "Frutas y Verduras": "#86efac",
  Despensa: "#fcd34d",
  Carnes: "#fca5a5",
  Panadería: "#fdba74",
  Bebidas: "#a5b4fc",
  Higiene: "#f0abfc",
  Limpieza: "#6ee7b7",
};

const UNITS = ["pza", "kg", "g", "L", "ml", "paq", "cja"];
const HOLD_MS = 1000;
const genId = () => Math.random().toString(36).substr(2, 9);
const totalCost = (items) =>
  items.reduce((s, it) => s + (parseFloat(it.price) || 0) * (it.qty || 1), 0);

const STORAGE_KEY = "sl5_lists";
const loadLists = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
};
const saveLists = (lists) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {}
};

// ── Styles (CSS-in-JS object) ────────────────────────────────────────────────
const S = {
  app: {
    maxWidth: 430,
    margin: "0 auto",
    minHeight: "100vh",
    background: "#111",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    paddingBottom: 120,
    fontFamily: "'Nunito','Segoe UI',sans-serif",
    color: "#fff",
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "14px 16px 12px",
    background: "#111",
    borderBottom: "1px solid #222",
    gap: 10,
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  body: { flex: 1, overflowY: "auto", padding: "8px 0" },
  bottomBar: {
    position: "fixed",
    bottom: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 430,
    maxWidth: "100%",
    background: "#111",
    borderTop: "1px solid #222",
    display: "flex",
    alignItems: "center",
    padding: "10px 14px",
    gap: 10,
    zIndex: 20,
  },
  fab: {
    position: "fixed",
    bottom: 70,
    left: "50%",
    transform: "translateX(-50%)",
    background: "linear-gradient(135deg,#4ade80,#22c55e)",
    color: "#111",
    border: "none",
    borderRadius: 28,
    padding: "13px 28px",
    fontSize: 15,
    fontWeight: 800,
    cursor: "pointer",
    zIndex: 21,
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function ContextMenu({ item, onClose, onDelete, onDuplicate, onEdit }) {
  const subtotal = (parseFloat(item.price) || 0) * (item.qty || 1);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 430,
          paddingBottom: 20,
          overflow: "hidden",
          animation: "slideUp .2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px 14px",
            borderBottom: "1px solid #2a2a2a",
          }}
        >
          <span style={{ fontSize: 28 }}>{item.emoji}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{item.name}</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {item.qty || 1} {item.unit || "pza"}
              {item.price ? ` · $${subtotal.toFixed(2)}` : ""}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 12px" }}>
          <CtxBtn icon="✏️" onClick={onEdit}>Editar artículo</CtxBtn>
          <CtxBtn icon="📋" onClick={onDuplicate}>Duplicar</CtxBtn>
          <div style={{ height: 1, background: "#2a2a2a", margin: "4px 12px" }} />
          <CtxBtn icon="🗑" danger onClick={onDelete}>Eliminar</CtxBtn>
          <div style={{ height: 1, background: "#2a2a2a", margin: "4px 12px" }} />
          <CtxBtn icon="✕" muted onClick={onClose}>Cancelar selección</CtxBtn>
        </div>
      </div>
    </div>
  );
}

function CtxBtn({ icon, children, onClick, danger, muted }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 12px",
        background: "none",
        border: "none",
        borderRadius: 12,
        color: danger ? "#ff6b6b" : muted ? "#666" : "#fff",
        fontSize: muted ? 14 : 15,
        fontWeight: muted ? 400 : 600,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span style={{ fontSize: 18, width: 24, textAlign: "center" }}>{icon}</span>
      {children}
    </button>
  );
}

function EditModal({ item, onClose, onSave }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price || "");
  const [qty, setQty] = useState(item.qty || 1);
  const [unit, setUnit] = useState(item.unit || "pza");
  const [note, setNote] = useState(item.note || "");
  const subtotal = (parseFloat(price) || 0) * qty;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        zIndex: 60,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#1a1a1a",
          borderRadius: "20px 20px 0 0",
          width: "100%",
          maxWidth: 430,
          padding: 20,
          animation: "slideUp .2s ease",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 28 }}>{item.emoji}</span> Editar artículo
        </div>

        <EditLabel>Nombre</EditLabel>
        <input className="edit-input" value={name} onChange={(e) => setName(e.target.value)} style={editInputStyle} />

        <EditLabel>Precio por unidad</EditLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <span style={{ color: "#4ade80", fontSize: 18, fontWeight: 800 }}>$</span>
          <input
            type="number"
            placeholder="0.00"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ ...editInputStyle, flex: 1 }}
          />
        </div>

        <EditLabel>Cantidad</EditLabel>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          <button style={qtyEditBtn} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
          <span style={{ fontSize: 18, fontWeight: 800, minWidth: 36, textAlign: "center", lineHeight: "40px" }}>{qty}</span>
          <button style={qtyEditBtn} onClick={() => setQty((q) => q + 1)}>+</button>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            style={{ background: "#222", border: "1px solid #333", borderRadius: 10, color: "#fff", padding: "0 10px", fontSize: 14, height: 40 }}
          >
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>

        <EditLabel>Nota (opcional)</EditLabel>
        <input
          placeholder="ej. Sin azúcar, marca X..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={editInputStyle}
        />

        {price && (
          <div style={{ marginTop: 16, background: "#111", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #2d4a2d" }}>
            <span style={{ color: "#86efac", fontSize: 14 }}>Subtotal</span>
            <span style={{ color: "#4ade80", fontSize: 20, fontWeight: 800 }}>${subtotal.toFixed(2)}</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#222", border: "none", borderRadius: 10, padding: 10, color: "#aaa", fontSize: 14, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={() => onSave({ ...item, name, price, qty, unit, note })}
            style={{ flex: 2, background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: 12, padding: 14, color: "#111", fontSize: 15, fontWeight: 800, cursor: "pointer" }}
          >
            ✓ Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

const editInputStyle = {
  width: "100%",
  background: "#222",
  border: "1px solid #333",
  borderRadius: 10,
  padding: "11px 12px",
  color: "#fff",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const qtyEditBtn = {
  background: "#333",
  border: "none",
  color: "#fff",
  width: 40,
  height: 40,
  borderRadius: 10,
  fontSize: 20,
  cursor: "pointer",
};

function EditLabel({ children }) {
  return (
    <label style={{ display: "block", fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 4, marginTop: 14, textTransform: "uppercase", letterSpacing: 1 }}>
      {children}
    </label>
  );
}

// ── SwipeItem ────────────────────────────────────────────────────────────────

function SwipeItem({ item, onToggle, onQtyMinus, onQtyPlus, onDelete, onContextMenu, editingPriceId, tempPrice, setTempPrice, setEditingPriceId, savePrice }) {
  const rowRef = useRef(null);
  const wrapRef = useRef(null);
  const swipeState = useRef({ startX: 0, curX: 0, dragging: false, hasMoved: false, holdTimer: null });
  const qty = item.qty || 1;
  const subtotal = (parseFloat(item.price) || 0) * qty;
  const isEditingPrice = editingPriceId === item.id;

  const startHold = useCallback(() => {
    const s = swipeState.current;
    s.holdTimer = setTimeout(() => {
      if (s.hasMoved) return;
      if (navigator.vibrate) navigator.vibrate(25);
      rowRef.current?.classList.add("holding");
      setTimeout(() => {
        rowRef.current?.classList.remove("holding");
        onContextMenu(item.id);
      }, 120);
    }, HOLD_MS);
  }, [item.id, onContextMenu]);

  const cancelHold = useCallback(() => {
    const s = swipeState.current;
    if (s.holdTimer) { clearTimeout(s.holdTimer); s.holdTimer = null; }
    rowRef.current?.classList.remove("holding");
  }, []);

  const onStart = useCallback((e) => {
    if (e.target.closest("button") || e.target.closest("input")) return;
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const s = swipeState.current;
    s.startX = cx; s.curX = 0; s.dragging = true; s.hasMoved = false;
    if (rowRef.current) rowRef.current.style.transition = "none";
    startHold();
  }, [startHold]);

  const onMove = useCallback((e) => {
    const s = swipeState.current;
    if (!s.dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - s.startX;
    s.curX = x;
    if (Math.abs(x) > 8) { s.hasMoved = true; cancelHold(); }
    if (rowRef.current) rowRef.current.style.transform = `translateX(${x}px)`;
    const bgL = wrapRef.current?.querySelector(".sl-bg-left");
    const bgR = wrapRef.current?.querySelector(".sl-bg-right");
    if (bgL && bgR) {
      bgL.style.display = x < -20 ? "flex" : "none";
      bgR.style.display = x > 20 ? "flex" : "none";
    }
    if (e.cancelable) e.preventDefault();
  }, [cancelHold]);

  const onEnd = useCallback(() => {
    const s = swipeState.current;
    if (!s.dragging) return;
    s.dragging = false;
    cancelHold();
    if (rowRef.current) rowRef.current.style.transition = "transform .22s ease";
    const bgL = wrapRef.current?.querySelector(".sl-bg-left");
    const bgR = wrapRef.current?.querySelector(".sl-bg-right");
    const THRESHOLD = 72;
    if (s.hasMoved) {
      if (s.curX < -THRESHOLD) {
        if (rowRef.current) rowRef.current.style.transform = "translateX(-110%)";
        setTimeout(() => onDelete(item.id), 220);
      } else if (s.curX > THRESHOLD) {
        onToggle(item.id, true);
        if (rowRef.current) rowRef.current.style.transform = "translateX(0)";
        if (bgL) bgL.style.display = "none";
        if (bgR) bgR.style.display = "none";
      } else {
        if (rowRef.current) rowRef.current.style.transform = "translateX(0)";
        if (bgL) bgL.style.display = "none";
        if (bgR) bgR.style.display = "none";
      }
    } else {
      if (rowRef.current) rowRef.current.style.transform = "translateX(0)";
      if (bgL) bgL.style.display = "none";
      if (bgR) bgR.style.display = "none";
    }
  }, [cancelHold, item.id, onDelete, onToggle]);

  return (
    <div
      ref={wrapRef}
      style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid #1e1e1e" }}
    >
      <div className="sl-bg-left" style={{ position: "absolute", inset: 0, background: "#ef4444", display: "none", alignItems: "center", justifyContent: "flex-end", paddingRight: 22, fontSize: 15, fontWeight: 700, color: "#fff", gap: 8 }}>
        🗑 Eliminar
      </div>
      <div className="sl-bg-right" style={{ position: "absolute", inset: 0, background: "#4ade80", display: "none", alignItems: "center", justifyContent: "flex-start", paddingLeft: 22, fontSize: 15, fontWeight: 700, color: "#111", gap: 8 }}>
        ✓ Seleccionar
      </div>
      <div
        ref={rowRef}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "11px 14px",
          gap: 10,
          background: "#111",
          position: "relative",
          touchAction: "pan-y",
          userSelect: "none",
          opacity: item.checked ? 0.45 : 1,
        }}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
        onMouseDown={onStart}
        onMouseMove={onMove}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(item.id); }}
      >
        {/* Check circle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
          style={{
            width: 28, height: 28, borderRadius: "50%",
            border: item.checked ? "2px solid #4ade80" : "2px solid #555",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, background: item.checked ? "#4ade80" : "transparent",
            color: "#111", fontSize: 14, fontWeight: "bold",
          }}
        >
          {item.checked ? "✓" : ""}
        </button>

        <span style={{ fontSize: 22, width: 30, textAlign: "center", flexShrink: 0 }}>{item.emoji}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 600, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: item.checked ? "line-through" : "none" }}>
            {item.name}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
            {isEditingPrice ? (
              <input
                autoFocus
                type="number"
                placeholder="0.00"
                value={tempPrice}
                onChange={(e) => setTempPrice(e.target.value)}
                onBlur={() => savePrice(item.id)}
                onKeyDown={(e) => e.key === "Enter" && savePrice(item.id)}
                style={{ background: "#1e1e1e", border: "1px solid #4ade80", borderRadius: 6, color: "#4ade80", fontSize: 13, width: 70, padding: "2px 6px", textAlign: "right", outline: "none" }}
              />
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setEditingPriceId(item.id); setTempPrice(item.price || ""); }}
                style={{ background: "none", border: "none", color: "#4ade80", fontSize: 12, cursor: "pointer", padding: 0, textDecoration: "underline dotted" }}
              >
                {item.price ? `$${subtotal.toFixed(2)}` : "+ precio"}
              </button>
            )}
            {item.note && (
              <span style={{ background: "#222", borderRadius: 6, padding: "1px 7px", fontSize: 11, color: "#aaa" }}>📝 {item.note}</span>
            )}
          </div>
        </div>

        {/* Qty controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {qty === 1 ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
              style={{ background: "#3a1010", border: "none", color: "#ff6b6b", width: 28, height: 28, borderRadius: 8, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >🗑</button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onQtyMinus(item.id); }}
              style={{ background: "#222", border: "none", color: "#fff", width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >−</button>
          )}
          <span style={{ fontSize: 14, fontWeight: 800, minWidth: 22, textAlign: "center", color: "#fff" }}>{qty}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onQtyPlus(item.id); }}
            style={{ background: "#222", border: "none", color: "#fff", width: 28, height: 28, borderRadius: 8, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >+</button>
        </div>
      </div>
    </div>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────

function ListsView({ lists, onOpenList, onDeleteList, onCreateList }) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (showNew) inputRef.current?.focus(); }, [showNew]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreateList(newName.trim());
    setNewName(""); setShowNew(false);
  };

  return (
    <>
      <div style={S.header}>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 22, color: "#fff" }}>🛒 SuperLista</span>
      </div>
      <div style={S.body}>
        {lists.map((list) => {
          const done = list.items.filter((i) => i.checked).length;
          const total = list.items.length;
          const cost = totalCost(list.items);
          return (
            <div
              key={list.id}
              onClick={() => onOpenList(list.id)}
              style={{ margin: "8px 16px", background: "#1a1a1a", borderRadius: 14, padding: 16, cursor: "pointer", border: "1px solid #2a2a2a" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800 }}>{list.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteList(list.id); }}
                  style={{ background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer" }}
                >✕</button>
              </div>
              {total > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ flex: 1, height: 6, background: "#2a2a2a", borderRadius: 3 }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius: 3, width: `${(done / total) * 100}%` }} />
                  </div>
                  <span style={{ fontSize: 12, color: "#aaa" }}>{done}/{total}</span>
                </div>
              )}
              {cost > 0 && <span style={{ fontSize: 13, color: "#4ade80" }}>${cost.toFixed(2)} estimado</span>}
              {total === 0 && <span style={{ fontSize: 12, color: "#555" }}>Toca para añadir artículos</span>}
            </div>
          );
        })}

        {showNew ? (
          <div style={{ margin: "8px 16px", background: "#1a1a1a", borderRadius: 14, padding: 16 }}>
            <input
              ref={inputRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Nombre de la lista..."
              style={{ width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={() => { setShowNew(false); setNewName(""); }} style={{ flex: 1, background: "#222", border: "none", borderRadius: 10, padding: 10, color: "#aaa", fontSize: 14, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleCreate} style={{ flex: 1, background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: 10, padding: 10, color: "#111", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>Crear</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNew(true)}
            style={{ margin: "8px 16px", width: "calc(100% - 32px)", background: "none", border: "2px dashed #333", borderRadius: 14, padding: 16, color: "#555", fontSize: 16, cursor: "pointer" }}
          >
            + Nueva lista
          </button>
        )}
      </div>
    </>
  );
}

function ListView({ list, onBack, onUpdateItem, onDeleteItem, onGoAdd }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showCompleted, setShowCompleted] = useState(true);
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [tempPrice, setTempPrice] = useState("");
  const [contextItemId, setContextItemId] = useState(null);
  const [editingItem, setEditingItem] = useState(null);

  const savePrice = (id) => {
    onUpdateItem(id, (it) => ({ ...it, price: tempPrice }));
    setEditingPriceId(null);
  };

  const all = searchQuery
    ? list.items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : list.items;
  const unchecked = all.filter((i) => !i.checked);
  const checked = all.filter((i) => i.checked);
  const done = list.items.filter((i) => i.checked).length;
  const tot = list.items.length;
  const cost = totalCost(list.items);

  const contextItem = contextItemId ? list.items.find((i) => i.id === contextItemId) : null;

  return (
    <>
      <div style={S.header}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#4ade80", fontSize: 24, cursor: "pointer", padding: "0 6px" }}>←</button>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 18, color: "#fff" }}>{list.name}</span>
        <span style={{ background: "#222", borderRadius: 12, padding: "3px 10px", fontSize: 13, color: "#aaa" }}>{done}/{tot}</span>
      </div>

      {tot > 0 && (
        <div style={{ height: 4, background: "#222" }}>
          <div style={{ height: "100%", background: "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius: 2, width: `${tot ? (done / tot) * 100 : 0}%`, transition: "width .4s" }} />
        </div>
      )}

      <div style={S.body}>
        {list.items.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🛒</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#ddd", marginBottom: 6 }}>Tu lista está vacía</div>
            <div style={{ fontSize: 13, color: "#555", padding: 20, textAlign: "center" }}>Toca + Añadir para agregar artículos</div>
          </div>
        )}
        {searchQuery && all.length === 0 && (
          <div style={{ fontSize: 13, color: "#555", padding: 20, textAlign: "center" }}>Sin resultados para "{searchQuery}"</div>
        )}

        {unchecked.map((item) => (
          <SwipeItem
            key={item.id}
            item={item}
            onToggle={(id) => onUpdateItem(id, (it) => ({ ...it, checked: !it.checked }))}
            onQtyMinus={(id) => onUpdateItem(id, (it) => ({ ...it, qty: Math.max(1, (it.qty || 1) - 1) }))}
            onQtyPlus={(id) => onUpdateItem(id, (it) => ({ ...it, qty: (it.qty || 1) + 1 }))}
            onDelete={onDeleteItem}
            onContextMenu={setContextItemId}
            editingPriceId={editingPriceId}
            tempPrice={tempPrice}
            setTempPrice={setTempPrice}
            setEditingPriceId={setEditingPriceId}
            savePrice={savePrice}
          />
        ))}

        {checked.length > 0 && (
          <button
            onClick={() => setShowCompleted((v) => !v)}
            style={{ width: "100%", background: "#1a1a1a", border: "none", color: "#aaa", padding: "10px 16px", textAlign: "left", fontSize: 13, cursor: "pointer", borderTop: "1px solid #222", borderBottom: "1px solid #222" }}
          >
            ({checked.length}) {showCompleted ? "Ocultar" : "Mostrar"} marcados {showCompleted ? "▲" : "▼"}
          </button>
        )}

        {showCompleted && checked.map((item) => (
          <SwipeItem
            key={item.id}
            item={item}
            onToggle={(id) => onUpdateItem(id, (it) => ({ ...it, checked: !it.checked }))}
            onQtyMinus={(id) => onUpdateItem(id, (it) => ({ ...it, qty: Math.max(1, (it.qty || 1) - 1) }))}
            onQtyPlus={(id) => onUpdateItem(id, (it) => ({ ...it, qty: (it.qty || 1) + 1 }))}
            onDelete={onDeleteItem}
            onContextMenu={setContextItemId}
            editingPriceId={editingPriceId}
            tempPrice={tempPrice}
            setTempPrice={setTempPrice}
            setEditingPriceId={setEditingPriceId}
            savePrice={savePrice}
          />
        ))}
      </div>

      <button style={S.fab} onClick={onGoAdd}>+ Añadir</button>

      <div style={S.bottomBar}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#555", fontSize: 16, pointerEvents: "none" }}>🔍</span>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar en lista..."
            style={{ width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 22, padding: "9px 16px 9px 36px", color: "#fff", fontSize: 14, outline: "none", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ background: "#1a2e1a", border: "1px solid #2d4a2d", borderRadius: 22, padding: "9px 14px", whiteSpace: "nowrap", flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#86efac", display: "block", lineHeight: 1 }}>Total</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#4ade80", display: "block", lineHeight: 1.2 }}>${cost.toFixed(2)}</span>
        </div>
      </div>

      {contextItem && (
        <ContextMenu
          item={contextItem}
          onClose={() => setContextItemId(null)}
          onDelete={() => { onDeleteItem(contextItem.id); setContextItemId(null); }}
          onDuplicate={() => {
            const copy = { ...contextItem, id: genId(), name: contextItem.name + " (copia)" };
            onUpdateItem(null, null, copy);
            setContextItemId(null);
          }}
          onEdit={() => { setEditingItem({ ...contextItem }); setContextItemId(null); }}
        />
      )}

      {editingItem && (
        <EditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={(updated) => { onUpdateItem(updated.id, () => updated); setEditingItem(null); }}
        />
      )}
    </>
  );
}

function AddItemsView({ list, onBack, onAddItem }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [customEmoji, setCustomEmoji] = useState("🛒");
  const [customName, setCustomName] = useState("");

  const filtered = PRESET_ITEMS.filter((p) => {
    const inCat = category === "Todos" || p.category === category;
    const inSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const added = list.items.some((it) => it.name === p.name);
    return inCat && inSearch && !added;
  });

  const addPreset = (p) => {
    onAddItem({ id: genId(), name: p.name, emoji: p.emoji, category: p.category, checked: false, price: "", qty: 1, unit: "pza", note: "" });
  };

  const addCustom = () => {
    if (!customName.trim()) return;
    onAddItem({ id: genId(), name: customName.trim(), emoji: customEmoji, category: "Otros", checked: false, price: "", qty: 1, unit: "pza", note: "" });
    setCustomName(""); setCustomEmoji("🛒");
  };

  return (
    <>
      <div style={S.header}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#4ade80", fontSize: 24, cursor: "pointer", padding: "0 6px" }}>←</button>
        <span style={{ flex: 1, fontWeight: 800, fontSize: 18, color: "#fff" }}>Agregar artículos</span>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#4ade80", fontSize: 15, fontWeight: 800, cursor: "pointer", padding: "4px 10px", borderRadius: 10 }}>Listo ✓</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #222" }}>
        <input
          value={customEmoji}
          onChange={(e) => setCustomEmoji(e.target.value)}
          maxLength={2}
          style={{ width: 40, height: 40, background: "#222", border: "none", borderRadius: 10, fontSize: 22, textAlign: "center", color: "#fff", outline: "none" }}
        />
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Artículo personalizado..."
          style={{ flex: 1, background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 15, outline: "none" }}
        />
        <button onClick={addCustom} style={{ background: "#4ade80", border: "none", borderRadius: 10, width: 40, height: 40, fontSize: 22, color: "#111", fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>+</button>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar artículo..."
        style={{ margin: "8px 16px", width: "calc(100% - 32px)", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" }}
      />

      <div style={{ display: "flex", overflowX: "auto", gap: 6, padding: "8px 16px", scrollbarWidth: "none" }}>
        {["Todos", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{ borderRadius: 20, border: "none", padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, background: category === cat ? "#4ade80" : "#2a2a2a", color: category === cat ? "#111" : "#aaa" }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ overflowY: "auto", flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 13, color: "#555", padding: 20, textAlign: "center" }}>No hay más artículos aquí</div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.name}
              onClick={() => addPreset(p)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", color: "#fff", textAlign: "left" }}
            >
              <span style={{ fontSize: 26, width: 34, textAlign: "center" }}>{p.emoji}</span>
              <div style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{p.name}</span>
                <span style={{ fontSize: 12, color: CAT_COLORS[p.category] || "#aaa" }}>{p.category}</span>
              </div>
              <span style={{ background: "#4ade80", color: "#111", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>+</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────

export default function SuperLista() {
  const [lists, setLists] = useState(() => loadLists() || [{ id: "default", name: "Casa", items: [], createdAt: Date.now() }]);
  const [activeListId, setActiveListId] = useState(null);
  const [view, setView] = useState("lists"); // "lists" | "list" | "addItems"

  useEffect(() => { saveLists(lists); }, [lists]);

  const activeList = lists.find((l) => l.id === activeListId);

  const updateItem = (id, fn, newItem) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === activeListId
          ? {
              ...l,
              items: newItem
                ? [...l.items, newItem]
                : id
                ? l.items.map((it) => (it.id === id ? fn(it) : it))
                : l.items,
            }
          : l
      )
    );
  };

  const deleteItem = (id) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === activeListId ? { ...l, items: l.items.filter((it) => it.id !== id) } : l
      )
    );
  };

  const addItem = (item) => {
    setLists((prev) =>
      prev.map((l) =>
        l.id === activeListId ? { ...l, items: [...l.items, item] } : l
      )
    );
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #111; }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
      <div style={S.app}>
        {view === "lists" && (
          <ListsView
            lists={lists}
            onOpenList={(id) => { setActiveListId(id); setView("list"); }}
            onDeleteList={(id) => setLists((prev) => prev.filter((l) => l.id !== id))}
            onCreateList={(name) => {
              const nl = { id: genId(), name, items: [], createdAt: Date.now() };
              setLists((prev) => [...prev, nl]);
              setActiveListId(nl.id);
              setView("list");
            }}
          />
        )}
        {view === "list" && activeList && (
          <ListView
            list={activeList}
            onBack={() => { setView("lists"); setActiveListId(null); }}
            onUpdateItem={updateItem}
            onDeleteItem={deleteItem}
            onGoAdd={() => setView("addItems")}
          />
        )}
        {view === "addItems" && activeList && (
          <AddItemsView
            list={activeList}
            onBack={() => setView("list")}
            onAddItem={addItem}
          />
        )}
      </div>
    </>
  );
}