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
