import { useState, useEffect } from "react";

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
  { name: "Zucchini", category: "Frutas y Verduras", emoji: "🫑" },
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
  { name: "Navajillas de Mujer", category: "Higiene", emoji: "✂️" },
];

const CATEGORIES = [...new Set(PRESET_ITEMS.map(i => i.category))];

const categoryColors = {
  "Lácteos": "#7dd3fc",
  "Frutas y Verduras": "#86efac",
  "Despensa": "#fcd34d",
  "Carnes": "#fca5a5",
  "Panadería": "#fdba74",
  "Bebidas": "#a5b4fc",
  "Higiene": "#f0abfc",
  "Limpieza": "#6ee7b7",
};

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

export default function SuperLista() {
  const [lists, setLists] = useState(() => {
    try {
      const saved = localStorage.getItem("superlista_lists");
      return saved ? JSON.parse(saved) : [
        { id: "default", name: "Casa", items: [], createdAt: Date.now() }
      ];
    } catch { return [{ id: "default", name: "Casa", items: [], createdAt: Date.now() }]; }
  });

  const [activeListId, setActiveListId] = useState(null);
  const [view, setView] = useState("lists"); // lists | list | addItems | editItem
  const [showCompleted, setShowCompleted] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [showNewList, setShowNewList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [editingItem, setEditingItem] = useState(null);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemEmoji, setCustomItemEmoji] = useState("🛒");

  useEffect(() => {
    try { localStorage.setItem("superlista_lists", JSON.stringify(lists)); } catch {}
  }, [lists]);

  const activeList = lists.find(l => l.id === activeListId);

  const openList = (id) => { setActiveListId(id); setView("list"); };

  const createList = () => {
    if (!newListName.trim()) return;
    const newList = { id: generateId(), name: newListName.trim(), items: [], createdAt: Date.now() };
    setLists(prev => [...prev, newList]);
    setNewListName("");
    setShowNewList(false);
    openList(newList.id);
  };

  const deleteList = (id) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) { setView("lists"); setActiveListId(null); }
  };

  const addItemToList = (preset) => {
    const newItem = {
      id: generateId(),
      name: preset.name,
      emoji: preset.emoji,
      category: preset.category,
      checked: false,
      price: "",
      qty: 1,
      unit: "pza",
      note: "",
    };
    setLists(prev => prev.map(l =>
      l.id === activeListId ? { ...l, items: [...l.items, newItem] } : l
    ));
  };

  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    const newItem = {
      id: generateId(),
      name: customItemName.trim(),
      emoji: customItemEmoji,
      category: "Otros",
      checked: false,
      price: "",
      qty: 1,
      unit: "pza",
      note: "",
    };
    setLists(prev => prev.map(l =>
      l.id === activeListId ? { ...l, items: [...l.items, newItem] } : l
    ));
    setCustomItemName("");
    setCustomItemEmoji("🛒");
  };

  const toggleItem = (itemId) => {
    setLists(prev => prev.map(l =>
      l.id === activeListId ? {
        ...l,
        items: l.items.map(it => it.id === itemId ? { ...it, checked: !it.checked } : it)
      } : l
    ));
  };

  const updateItem = (updated) => {
    setLists(prev => prev.map(l =>
      l.id === activeListId ? {
        ...l,
        items: l.items.map(it => it.id === updated.id ? updated : it)
      } : l
    ));
    setEditingItem(null);
    setView("list");
  };

  const deleteItem = (itemId) => {
    setLists(prev => prev.map(l =>
      l.id === activeListId ? { ...l, items: l.items.filter(it => it.id !== itemId) } : l
    ));
    setEditingItem(null);
    setView("list");
  };

  const totalCost = (items) => {
    return items.reduce((sum, it) => {
      const p = parseFloat(it.price) || 0;
      return sum + p * (it.qty || 1);
    }, 0);
  };

  const filteredPreset = PRESET_ITEMS.filter(p => {
    const inCat = selectedCategory === "Todos" || p.category === selectedCategory;
    const inSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const alreadyAdded = activeList?.items.some(it => it.name === p.name);
    return inCat && inSearch && !alreadyAdded;
  });

  // ── VIEWS ──────────────────────────────────────────────────────────

  if (view === "editItem" && editingItem) {
    const item = editingItem;
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => { setView("list"); setEditingItem(null); }}>←</button>
          <span style={styles.headerTitle}>Editar artículo</span>
          <button style={{ ...styles.iconBtn, color: "#ff6b6b" }} onClick={() => deleteItem(item.id)}>🗑</button>
        </div>
        <div style={styles.editBody}>
          <div style={styles.emojiPicker}>
            <input
              style={styles.emojiInput}
              value={item.emoji}
              onChange={e => setEditingItem({ ...item, emoji: e.target.value })}
              maxLength={2}
            />
          </div>
          <label style={styles.label}>Nombre</label>
          <input
            style={styles.input}
            value={item.name}
            onChange={e => setEditingItem({ ...item, name: e.target.value })}
          />
          <label style={styles.label}>Precio (por unidad)</label>
          <div style={styles.priceRow}>
            <span style={styles.currency}>$</span>
            <input
              style={{ ...styles.input, flex: 1 }}
              type="number"
              placeholder="0.00"
              value={item.price}
              onChange={e => setEditingItem({ ...item, price: e.target.value })}
            />
          </div>
          <label style={styles.label}>Cantidad</label>
          <div style={styles.qtyRow}>
            <button style={styles.qtyBtn} onClick={() => setEditingItem({ ...item, qty: Math.max(1, (item.qty || 1) - 1) })}>−</button>
            <span style={styles.qtyNum}>{item.qty || 1}</span>
            <button style={styles.qtyBtn} onClick={() => setEditingItem({ ...item, qty: (item.qty || 1) + 1 })}>+</button>
            <select
              style={styles.unitSelect}
              value={item.unit || "pza"}
              onChange={e => setEditingItem({ ...item, unit: e.target.value })}
            >
              {["pza", "kg", "g", "L", "ml", "paq", "cja"].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <label style={styles.label}>Nota (opcional)</label>
          <input
            style={styles.input}
            placeholder="ej. Sin azúcar, marca X..."
            value={item.note || ""}
            onChange={e => setEditingItem({ ...item, note: e.target.value })}
          />
          {item.price && (
            <div style={styles.subtotalCard}>
              <span style={styles.subtotalLabel}>Subtotal</span>
              <span style={styles.subtotalValue}>
                ${(parseFloat(item.price) * (item.qty || 1)).toFixed(2)}
              </span>
            </div>
          )}
          <button style={styles.saveBtn} onClick={() => updateItem(item)}>
            ✓ Guardar cambios
          </button>
        </div>
      </div>
    );
  }

  if (view === "addItems") {
    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setView("list")}>←</button>
          <span style={styles.headerTitle}>Agregar artículos</span>
        </div>
        {/* Custom item */}
        <div style={styles.customRow}>
          <input
            style={styles.emojiInputSmall}
            value={customItemEmoji}
            onChange={e => setCustomItemEmoji(e.target.value)}
            maxLength={2}
          />
          <input
            style={{ ...styles.input, flex: 1, margin: 0 }}
            placeholder="Artículo personalizado..."
            value={customItemName}
            onChange={e => setCustomItemName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomItem()}
          />
          <button style={styles.addCustomBtn} onClick={addCustomItem}>+</button>
        </div>
        {/* Search */}
        <input
          style={{ ...styles.input, margin: "8px 16px" }}
          placeholder="🔍  Buscar artículo..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {/* Category tabs */}
        <div style={styles.catTabs}>
          {["Todos", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              style={{
                ...styles.catTab,
                background: selectedCategory === cat ? "#4ade80" : "#2a2a2a",
                color: selectedCategory === cat ? "#111" : "#aaa",
              }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
        {/* Preset list */}
        <div style={styles.presetList}>
          {filteredPreset.length === 0 && (
            <div style={styles.emptyHint}>No hay más artículos en esta categoría</div>
          )}
          {filteredPreset.map(p => (
            <button key={p.name} style={styles.presetItem} onClick={() => addItemToList(p)}>
              <span style={styles.presetEmoji}>{p.emoji}</span>
              <div style={styles.presetInfo}>
                <span style={styles.presetName}>{p.name}</span>
                <span style={{ ...styles.presetCat, color: categoryColors[p.category] || "#aaa" }}>{p.category}</span>
              </div>
              <span style={styles.addCircle}>+</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === "list" && activeList) {
    const unchecked = activeList.items.filter(i => !i.checked);
    const checked = activeList.items.filter(i => i.checked);
    const cost = totalCost(activeList.items);

    return (
      <div style={styles.screen}>
        <div style={styles.header}>
          <button style={styles.backBtn} onClick={() => setView("lists")}>←</button>
          <span style={styles.headerTitle}>{activeList.name}</span>
          <span style={styles.progressBadge}>{checked.length}/{activeList.items.length}</span>
        </div>
        {/* Progress bar */}
        {activeList.items.length > 0 && (
          <div style={styles.progressBar}>
            <div style={{
              ...styles.progressFill,
              width: `${(checked.length / activeList.items.length) * 100}%`
            }} />
          </div>
        )}
        {/* Cost summary */}
        {cost > 0 && (
          <div style={styles.costBar}>
            <span style={styles.costLabel}>Total estimado</span>
            <span style={styles.costValue}>${cost.toFixed(2)}</span>
          </div>
        )}
        <div style={styles.listBody}>
          {activeList.items.length === 0 && (
            <div style={styles.emptyState}>
              <div style={styles.emptyEmoji}>🛒</div>
              <div style={styles.emptyText}>Tu lista está vacía</div>
              <div style={styles.emptyHint}>Toca + Añadir para agregar artículos</div>
            </div>
          )}
          {/* Unchecked items */}
          {unchecked.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={() => toggleItem(item.id)}
              onEdit={() => { setEditingItem({ ...item }); setView("editItem"); }}
            />
          ))}
          {/* Checked section */}
          {checked.length > 0 && (
            <>
              <button style={styles.sectionToggle} onClick={() => setShowCompleted(!showCompleted)}>
                ({checked.length}) {showCompleted ? "Ocultar" : "Mostrar"} marcados {showCompleted ? "▲" : "▼"}
              </button>
              {showCompleted && checked.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleItem(item.id)}
                  onEdit={() => { setEditingItem({ ...item }); setView("editItem"); }}
                />
              ))}
            </>
          )}
        </div>
        <button style={styles.fab} onClick={() => { setSearchQuery(""); setSelectedCategory("Todos"); setView("addItems"); }}>
          + Añadir
        </button>
      </div>
    );
  }

  // LISTS VIEW
  return (
    <div style={styles.screen}>
      <div style={styles.header}>
        <span style={{ ...styles.headerTitle, fontSize: 22 }}>🛒 SuperLista</span>
      </div>
      <div style={styles.listBody}>
        {lists.map(list => {
          const done = list.items.filter(i => i.checked).length;
          const total = list.items.length;
          const cost = totalCost(list.items);
          return (
            <div key={list.id} style={styles.listCard} onClick={() => openList(list.id)}>
              <div style={styles.listCardTop}>
                <span style={styles.listCardName}>{list.name}</span>
                <button style={styles.deleteListBtn} onClick={e => { e.stopPropagation(); deleteList(list.id); }}>✕</button>
              </div>
              {total > 0 && (
                <div style={styles.listProgressRow}>
                  <div style={styles.listProgressBar}>
                    <div style={{ ...styles.listProgressFill, width: `${total ? (done / total) * 100 : 0}%` }} />
                  </div>
                  <span style={styles.listProgressText}>{done}/{total}</span>
                </div>
              )}
              {cost > 0 && <span style={styles.listCost}>${cost.toFixed(2)} estimado</span>}
              {total === 0 && <span style={styles.listHint}>Toca para añadir artículos</span>}
            </div>
          );
        })}
        {showNewList ? (
          <div style={styles.newListCard}>
            <input
              style={styles.input}
              placeholder="Nombre de la lista..."
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createList()}
              autoFocus
            />
            <div style={styles.newListBtns}>
              <button style={styles.cancelBtn} onClick={() => setShowNewList(false)}>Cancelar</button>
              <button style={styles.saveBtn} onClick={createList}>Crear</button>
            </div>
          </div>
        ) : (
          <button style={styles.newListBtn} onClick={() => setShowNewList(true)}>
            + Nueva lista
          </button>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, onToggle, onEdit }) {
  return (
    <div style={{ ...styles.itemRow, opacity: item.checked ? 0.5 : 1 }}>
      <button style={{ ...styles.checkCircle, background: item.checked ? "#4ade80" : "transparent", borderColor: item.checked ? "#4ade80" : "#555" }} onClick={onToggle}>
        {item.checked && <span style={{ color: "#111", fontSize: 14, fontWeight: "bold" }}>✓</span>}
      </button>
      <span style={styles.itemEmoji}>{item.emoji}</span>
      <div style={styles.itemInfo} onClick={onEdit}>
        <span style={{ ...styles.itemName, textDecoration: item.checked ? "line-through" : "none" }}>{item.name}</span>
        <div style={styles.itemMeta}>
          {item.qty > 1 && <span style={styles.metaChip}>{item.qty} {item.unit}</span>}
          {item.price && <span style={styles.metaChip}>${(parseFloat(item.price) * (item.qty || 1)).toFixed(2)}</span>}
          {item.note && <span style={styles.metaChip}>📝 {item.note}</span>}
        </div>
      </div>
      <button style={styles.editBtn} onClick={onEdit}>✏️</button>
    </div>
  );
}

const styles = {
  screen: {
    maxWidth: 430,
    margin: "0 auto",
    minHeight: "100vh",
    background: "#111",
    color: "#fff",
    fontFamily: "'Nunito', 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    paddingBottom: 80,
  },
  header: {
    display: "flex",
    alignItems: "center",
    padding: "16px 16px 12px",
    background: "#111",
    borderBottom: "1px solid #222",
    gap: 10,
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  headerTitle: { flex: 1, fontWeight: 800, fontSize: 18, color: "#fff" },
  backBtn: { background: "none", border: "none", color: "#4ade80", fontSize: 24, cursor: "pointer", padding: "0 6px" },
  iconBtn: { background: "none", border: "none", fontSize: 20, cursor: "pointer", padding: "0 4px" },
  progressBadge: { background: "#222", borderRadius: 12, padding: "3px 10px", fontSize: 13, color: "#aaa" },
  progressBar: { height: 4, background: "#222", margin: "0 0 0 0" },
  progressFill: { height: "100%", background: "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius: 2, transition: "width 0.4s" },
  costBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: "#1a1a1a", borderBottom: "1px solid #222" },
  costLabel: { fontSize: 13, color: "#888" },
  costValue: { fontSize: 16, fontWeight: 800, color: "#4ade80" },
  listBody: { flex: 1, overflowY: "auto", padding: "8px 0" },
  itemRow: { display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid #1e1e1e", gap: 10, transition: "opacity 0.2s" },
  checkCircle: { width: 28, height: 28, borderRadius: "50%", border: "2px solid", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s" },
  itemEmoji: { fontSize: 22, width: 30, textAlign: "center", flexShrink: 0 },
  itemInfo: { flex: 1, cursor: "pointer" },
  itemName: { fontSize: 15, fontWeight: 600, display: "block" },
  itemMeta: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 },
  metaChip: { background: "#222", borderRadius: 6, padding: "1px 7px", fontSize: 11, color: "#aaa" },
  editBtn: { background: "none", border: "none", fontSize: 16, cursor: "pointer", opacity: 0.5 },
  sectionToggle: { width: "100%", background: "#1a1a1a", border: "none", color: "#aaa", padding: "10px 16px", textAlign: "left", fontSize: 13, cursor: "pointer", borderTop: "1px solid #222", borderBottom: "1px solid #222" },
  fab: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#4ade80,#22c55e)", color: "#111", border: "none", borderRadius: 28, padding: "14px 32px", fontSize: 16, fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 20px rgba(74,222,128,0.4)", zIndex: 20 },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyText: { fontSize: 18, fontWeight: 700, color: "#ddd", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#555", textAlign: "center", padding: "20px" },
  // Lists view
  listCard: { margin: "8px 16px", background: "#1a1a1a", borderRadius: 14, padding: "16px", cursor: "pointer", border: "1px solid #2a2a2a" },
  listCardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  listCardName: { fontSize: 18, fontWeight: 800 },
  deleteListBtn: { background: "none", border: "none", color: "#555", fontSize: 16, cursor: "pointer" },
  listProgressRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  listProgressBar: { flex: 1, height: 6, background: "#2a2a2a", borderRadius: 3 },
  listProgressFill: { height: "100%", background: "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius: 3, transition: "width 0.4s" },
  listProgressText: { fontSize: 12, color: "#aaa", minWidth: 36 },
  listCost: { fontSize: 13, color: "#4ade80", display: "block", marginTop: 2 },
  listHint: { fontSize: 12, color: "#555" },
  newListBtn: { margin: "8px 16px", width: "calc(100% - 32px)", background: "none", border: "2px dashed #333", borderRadius: 14, padding: 16, color: "#555", fontSize: 16, cursor: "pointer" },
  newListCard: { margin: "8px 16px", background: "#1a1a1a", borderRadius: 14, padding: 16 },
  newListBtns: { display: "flex", gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, background: "#222", border: "none", borderRadius: 10, padding: "10px", color: "#aaa", fontSize: 14, cursor: "pointer" },
  saveBtn: { flex: 1, background: "linear-gradient(135deg,#4ade80,#22c55e)", border: "none", borderRadius: 10, padding: "10px", color: "#111", fontSize: 14, fontWeight: 800, cursor: "pointer" },
  // Add items view
  customRow: { display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", borderBottom: "1px solid #222" },
  emojiInputSmall: { width: 40, height: 40, background: "#222", border: "none", borderRadius: 10, fontSize: 22, textAlign: "center", color: "#fff" },
  addCustomBtn: { background: "#4ade80", border: "none", borderRadius: 10, width: 40, height: 40, fontSize: 22, color: "#111", fontWeight: 800, cursor: "pointer", flexShrink: 0 },
  catTabs: { display: "flex", overflowX: "auto", gap: 6, padding: "8px 16px", scrollbarWidth: "none" },
  catTab: { borderRadius: 20, border: "none", padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 },
  presetList: { overflowY: "auto", flex: 1 },
  presetItem: { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", borderBottom: "1px solid #1e1e1e", cursor: "pointer", color: "#fff", textAlign: "left" },
  presetEmoji: { fontSize: 26, width: 34, textAlign: "center" },
  presetInfo: { flex: 1 },
  presetName: { display: "block", fontSize: 15, fontWeight: 600 },
  presetCat: { fontSize: 12 },
  addCircle: { background: "#4ade80", color: "#111", width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0 },
  // Edit item view
  editBody: { padding: "16px 20px", overflowY: "auto" },
  emojiPicker: { textAlign: "center", marginBottom: 20 },
  emojiInput: { width: 64, height: 64, background: "#1e1e1e", border: "2px solid #333", borderRadius: 16, fontSize: 32, textAlign: "center", color: "#fff" },
  label: { display: "block", fontSize: 12, color: "#888", fontWeight: 700, marginBottom: 4, marginTop: 14, textTransform: "uppercase", letterSpacing: 1 },
  input: { width: "100%", background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, padding: "11px 12px", color: "#fff", fontSize: 15, outline: "none", boxSizing: "border-box" },
  priceRow: { display: "flex", alignItems: "center", gap: 8 },
  currency: { fontSize: 18, color: "#4ade80", fontWeight: 800 },
  qtyRow: { display: "flex", alignItems: "center", gap: 10 },
  qtyBtn: { background: "#2a2a2a", border: "none", color: "#fff", width: 40, height: 40, borderRadius: 10, fontSize: 20, cursor: "pointer" },
  qtyNum: { fontSize: 20, fontWeight: 800, minWidth: 30, textAlign: "center" },
  unitSelect: { background: "#1e1e1e", border: "1px solid #333", borderRadius: 10, color: "#fff", padding: "8px 10px", fontSize: 14, marginLeft: 8 },
  subtotalCard: { marginTop: 20, background: "#1a2e1a", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #2d4a2d" },
  subtotalLabel: { color: "#86efac", fontSize: 14 },
  subtotalValue: { color: "#4ade80", fontSize: 20, fontWeight: 800 },
};