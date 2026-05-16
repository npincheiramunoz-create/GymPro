import { useState, useEffect, useMemo } from "react";

// ─── API ────────────────────────────────────────────────────────────────────
const API = "https://script.google.com/macros/s/AKfycbxaN69h_2aMvZu_PGbqFfCVnRFKOSAdNg6rs1E8IoFZvLVYZRaZdxm-qFYlOCpiiBc6/exec";

const api = async (action, body = {}) => {
  const res = await fetch(API, {
    method: "POST",
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
};

// ─── INITIAL DATA ──────────────────────────────────────────────────────────
const INITIAL_PLANS = [
  { id: "p1", name: "Plan Mensual", price: 25000, type: "plan" },
  { id: "p2", name: "Plan Trimestral", price: 65000, type: "plan" },
  { id: "p3", name: "Plan Anual", price: 200000, type: "plan" },
  { id: "p4", name: "Clase Suelta", price: 5000, type: "plan" },
];
const INITIAL_PRODUCTS = [
  { id: "pr1", name: "Barra Proteica", price: 2500, stock: 30, type: "product" },
  { id: "pr2", name: "Agua 500ml", price: 800, stock: 60, type: "product" },
  { id: "pr3", name: "Bebida Isotónica", price: 1500, stock: 40, type: "product" },
  { id: "pr4", name: "Proteína Whey (scoop)", price: 3000, stock: 20, type: "product" },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const monthKey = (iso) => iso.slice(0, 7);
const nowISO = () => new Date().toISOString();
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const monthLabel = (key) => { const [y, m] = key.split("-"); return `${MONTHS_ES[parseInt(m) - 1]} ${y}`; };

// ─── MAIN APP ──────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [plans, setPlans] = useState(INITIAL_PLANS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [sales, setSales] = useState([]);
  const [ownerPin, setOwnerPin] = useState("1234");
  const [sellerName, setSellerName] = useState("");
  const [loading, setLoading] = useState(true);

  // Cargar datos iniciales desde Google Sheets
  useEffect(() => {
    const init = async () => {
      try {
        const [inv, salesData, pinData] = await Promise.all([
          api("getInventory"),
          api("getSales"),
          api("getPin"),
        ]);
        if (inv.plans?.length) setPlans(inv.plans);
        if (inv.products?.length) setProducts(inv.products);
        if (salesData.sales?.length) setSales(salesData.sales);
        if (pinData.pin) setOwnerPin(pinData.pin);
      } catch (e) {
        console.error("Error cargando datos:", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const addSale = async (sale) => {
    setSales(prev => [sale, ...prev]);
    await api("addSale", { sale });
  };

  const savePlans = async (newPlans) => {
    setPlans(newPlans);
    await api("saveInventory", { plans: newPlans, products });
  };

  const saveProducts = async (newProducts) => {
    setProducts(newProducts);
    await api("saveInventory", { plans, products: newProducts });
  };

  const savePin = async (newPin) => {
    setOwnerPin(newPin);
    await api("savePin", { pin: newPin });
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow', sans-serif", color: "#fff" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>💪</div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4 }}>GYM<span style={{ color: "#f0b429" }}>PRO</span></div>
      <div style={{ color: "#555", fontSize: 13, marginTop: 12 }}>Cargando datos...</div>
    </div>
  );

  if (!role) return (
    <LoginScreen
      onSeller={(name) => { setSellerName(name); setRole("seller"); }}
      onOwner={(p) => { if (p === ownerPin) { setRole("owner"); setPinError(false); } else { setPinError(true); } }}
      pin={pin} setPin={setPin} pinError={pinError}
    />
  );

  if (role === "seller") return (
    <SellerView plans={plans} products={products} onSale={addSale} sellerName={sellerName} onLogout={() => setRole(null)} />
  );

  return (
    <OwnerView
      plans={plans} setPlans={savePlans}
      products={products} setProducts={saveProducts}
      sales={sales} onLogout={() => setRole(null)}
      ownerPin={ownerPin} setOwnerPin={savePin}
    />
  );
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────
function LoginScreen({ onSeller, onOwner, pin, setPin, pinError }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Barlow', sans-serif" }}>
      <div style={{ background: "#13132a", borderRadius: 16, padding: 40, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", border: "1px solid #1e1e3a" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>💪</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: 4 }}>GYM<span style={{ color: "#f0b429" }}>PRO</span></div>
          <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>Sistema de Gestión</div>
        </div>

        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button style={{ ...rBtn, background: "#1a1a2e" }} onClick={() => setMode("seller")}>
              <span style={{ fontSize: 24 }}>🧾</span><span>Soy Vendedor</span>
            </button>
            <button style={{ ...rBtn, background: "#16213e" }} onClick={() => setMode("owner")}>
              <span style={{ fontSize: 24 }}>👑</span><span>Soy Dueño</span>
            </button>
          </div>
        )}

        {mode === "seller" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lbl}>Tu nombre</div>
            <input style={inp} placeholder="Nombre del vendedor" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && name.trim() && onSeller(name.trim())} />
            <button style={btnP} onClick={() => name.trim() && onSeller(name.trim())}>Entrar</button>
            <button style={btnG} onClick={() => setMode(null)}>← Volver</button>
          </div>
        )}

        {mode === "owner" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={lbl}>PIN del dueño</div>
            <input style={{ ...inp, ...(pinError ? { borderColor: "#e74c3c" } : {}) }} type="password" placeholder="••••" maxLength={8} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === "Enter" && onOwner(pin)} />
            {pinError && <div style={{ color: "#e74c3c", fontSize: 12 }}>PIN incorrecto</div>}
            <button style={btnP} onClick={() => onOwner(pin)}>Ingresar</button>
            <button style={btnG} onClick={() => setMode(null)}>← Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SELLER VIEW ───────────────────────────────────────────────────────────
function SellerView({ plans, products, onSale, sellerName, onLogout }) {
  const [cart, setCart] = useState([]);
  const [clientName, setClientName] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("plans");
  const items = tab === "plans" ? plans : products;

  const addToCart = (item) => setCart(prev => {
    const ex = prev.find(c => c.id === item.id);
    if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c);
    return [...prev, { ...item, qty: 1 }];
  });
  const removeFromCart = (id) => setCart(prev => prev.filter(c => c.id !== id));
  const updateQty = (id, qty) => { if (qty < 1) { removeFromCart(id); return; } setCart(prev => prev.map(c => c.id === id ? { ...c, qty } : c)); };
  const total = cart.reduce((a, c) => a + c.price * c.qty, 0);

  const confirm = async () => {
    if (!cart.length || saving) return;
    setSaving(true);
    const sale = { id: Date.now().toString(), date: nowISO(), seller: sellerName, client: clientName.trim() || "Sin nombre", items: cart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty, type: c.type })), total };
    await onSale(sale);
    setCart([]); setClientName(""); setSuccess(true); setSaving(false);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", fontFamily: "'Barlow', sans-serif", color: "#fff" }}>
      <header style={hdr}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>💪 GymPro — <span style={{ color: "#f0b429" }}>Registro de Venta</span></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ background: "#1a1a3a", border: "1px solid #2a2a5a", borderRadius: 20, padding: "4px 12px", fontSize: 13, color: "#ccc" }}>👤 {sellerName}</span>
          <button style={logBtn} onClick={onLogout}>Salir</button>
        </div>
      </header>
      {success && <div style={{ background: "#1a3a2a", borderBottom: "1px solid #2ecc71", color: "#2ecc71", padding: "10px 24px", fontSize: 14, fontWeight: 600 }}>✅ Venta registrada exitosamente</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: "calc(100vh - 61px)" }}>
        <div style={{ borderRight: "1px solid #1e1e3a", overflow: "auto", padding: 20 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
            {[["plans", "Planes"], ["products", "Productos"]].map(([k, l]) => (
              <button key={k} style={{ background: tab === k ? "#f0b429" : "#1a1a30", border: "1px solid " + (tab === k ? "#f0b429" : "#2a2a4a"), color: tab === k ? "#0d0d1a" : "#aaa", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: tab === k ? 700 : 400 }} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 10 }}>
            {items.map(item => (
              <button key={item.id} style={{ background: "#13132a", border: "1px solid #2a2a4a", borderRadius: 10, padding: "14px 10px", cursor: "pointer", textAlign: "center", color: "#fff" }} onClick={() => addToCart(item)}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{item.type === "plan" ? "🏋️" : "🛒"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.name}</div>
                <div style={{ fontSize: 14, color: "#f0b429", fontWeight: 700 }}>{fmt(item.price)}</div>
                {item.type === "product" && <div style={{ fontSize: 11, marginTop: 2, color: item.stock < 5 ? "#e74c3c" : "#2ecc71" }}>Stock: {item.stock}</div>}
              </button>
            ))}
          </div>
        </div>
        <div style={{ padding: 20, overflow: "auto", background: "#0f0f20" }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#f0b429" }}>🧾 Venta Actual</div>
          <input style={{ ...inp, marginBottom: 12 }} placeholder="Nombre del cliente (opcional)" value={clientName} onChange={e => setClientName(e.target.value)} />
          {cart.length === 0
            ? <div style={{ color: "#555", fontSize: 14, padding: "20px 0", textAlign: "center" }}>Selecciona productos o planes</div>
            : cart.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, background: "#13132a", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ flex: 1, fontSize: 13 }}>{c.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button style={qBtn} onClick={() => updateQty(c.id, c.qty - 1)}>−</button>
                  <span style={{ width: 24, textAlign: "center", fontSize: 14 }}>{c.qty}</span>
                  <button style={qBtn} onClick={() => updateQty(c.id, c.qty + 1)}>+</button>
                </div>
                <div style={{ fontSize: 13, color: "#f0b429", fontWeight: 600, minWidth: 70, textAlign: "right" }}>{fmt(c.price * c.qty)}</div>
                <button style={{ background: "transparent", border: "none", color: "#e74c3c", cursor: "pointer", fontSize: 13 }} onClick={() => removeFromCart(c.id)}>✕</button>
              </div>
            ))
          }
          {cart.length > 0 && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #2a2a4a", marginTop: 12, paddingTop: 12, fontSize: 18 }}>
              <span>Total</span><span style={{ color: "#f0b429", fontWeight: 700 }}>{fmt(total)}</span>
            </div>
            <button style={{ background: saving ? "#7a5a10" : "#f0b429", color: "#0d0d1a", border: "none", borderRadius: 8, padding: "14px 20px", fontWeight: 700, cursor: "pointer", fontSize: 16, width: "100%", marginTop: 12 }} onClick={confirm} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar Venta"}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}

// ─── OWNER VIEW ────────────────────────────────────────────────────────────
function OwnerView({ plans, setPlans, products, setProducts, sales, onLogout, ownerPin, setOwnerPin }) {
  const [tab, setTab] = useState("dashboard");
  return (
    <div style={{ minHeight: "100vh", background: "#0d0d1a", fontFamily: "'Barlow', sans-serif", color: "#fff" }}>
      <header style={hdr}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>💪 GymPro — <span style={{ color: "#f0b429" }}>Panel del Dueño</span></div>
        <button style={logBtn} onClick={onLogout}>Salir</button>
      </header>
      <div style={{ display: "flex", background: "#0f0f20", borderBottom: "1px solid #1e1e3a", padding: "0 20px" }}>
        {[["dashboard", "📊 Dashboard"], ["sales", "📋 Historial"], ["inventory", "📦 Inventario"], ["settings", "⚙️ Config"]].map(([k, l]) => (
          <button key={k} style={{ background: "transparent", border: "none", color: tab === k ? "#f0b429" : "#666", padding: "14px 18px", cursor: "pointer", fontSize: 14, borderBottom: tab === k ? "2px solid #f0b429" : "2px solid transparent", fontWeight: tab === k ? 600 : 400 }} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div style={{ padding: 24, overflow: "auto" }}>
        {tab === "dashboard" && <Dashboard sales={sales} />}
        {tab === "sales" && <SalesHistory sales={sales} />}
        {tab === "inventory" && <Inventory plans={plans} setPlans={setPlans} products={products} setProducts={setProducts} />}
        {tab === "settings" && <Settings ownerPin={ownerPin} setOwnerPin={setOwnerPin} />}
      </div>
    </div>
  );
}

// ─── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ sales }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const allMonths = useMemo(() => {
    const keys = [...new Set(sales.map(s => monthKey(s.date)))].sort().reverse();
    if (!keys.includes(currentMonth)) keys.unshift(currentMonth);
    return keys;
  }, [sales, currentMonth]);

  const filtered = useMemo(() => sales.filter(s => monthKey(s.date) === selectedMonth), [sales, selectedMonth]);
  const totalRevenue = filtered.reduce((a, s) => a + s.total, 0);
  const planRevenue = filtered.reduce((a, s) => a + s.items.filter(i => i.type === "plan").reduce((x, i) => x + i.price * i.qty, 0), 0);
  const productRevenue = filtered.reduce((a, s) => a + s.items.filter(i => i.type === "product").reduce((x, i) => x + i.price * i.qty, 0), 0);

  const itemMap = {};
  filtered.forEach(s => s.items.forEach(i => {
    if (!itemMap[i.name]) itemMap[i.name] = { revenue: 0, qty: 0, type: i.type };
    itemMap[i.name].revenue += i.price * i.qty; itemMap[i.name].qty += i.qty;
  }));
  const topItems = Object.entries(itemMap).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 6);

  const daysInMonth = new Date(parseInt(selectedMonth.split("-")[0]), parseInt(selectedMonth.split("-")[1]), 0).getDate();
  const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    const ds = filtered.filter(s => s.date.slice(0, 10) === `${selectedMonth}-${day}`);
    return { day: i + 1, total: ds.reduce((a, s) => a + s.total, 0) };
  });
  const maxDay = Math.max(...dailyData.map(d => d.total), 1);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <span style={{ color: "#aaa", fontSize: 14 }}>Mes:</span>
        <select style={{ background: "#1a1a30", border: "1px solid #2a2a4a", color: "#fff", borderRadius: 6, padding: "8px 12px", fontSize: 14, outline: "none" }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
          {allMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[["💰", "Ingresos Totales", fmt(totalRevenue), "#f0b429"], ["🏋️", "Ingresos Planes", fmt(planRevenue), "#3498db"], ["🛒", "Ingresos Productos", fmt(productRevenue), "#2ecc71"], ["🧾", "Transacciones", filtered.length, "#9b59b6"]].map(([icon, label, value, color]) => (
          <div key={label} style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 10, padding: "18px 20px", borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{icon}</div>
            <div style={{ color: "#888", fontSize: 12, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={card}>
        <div style={cardT}>Ingresos por día — {monthLabel(selectedMonth)}</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120 }}>
          {dailyData.map(d => (
            <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }} title={`Día ${d.day}: ${fmt(d.total)}`}>
              <div style={{ width: "100%", borderRadius: "3px 3px 0 0", minHeight: 2, background: d.total > 0 ? "#f0b429" : "#2a2a3e", height: `${Math.round((d.total / maxDay) * 100)}%` }} />
            </div>
          ))}
        </div>
      </div>
      {topItems.length > 0 && (
        <div style={card}>
          <div style={cardT}>Top productos / planes</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Nombre", "Tipo", "Cant.", "Ingreso"].map(h => <th key={h} style={{ color: "#666", fontSize: 12, fontWeight: 600, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #1e1e3a" }}>{h}</th>)}</tr></thead>
            <tbody>{topItems.map(([name, d]) => (
              <tr key={name} style={{ borderBottom: "1px solid #13132a" }}>
                <td style={td}>{name}</td>
                <td style={td}><span style={{ borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600, background: d.type === "plan" ? "#1a3a5c" : "#1a3a2c" }}>{d.type === "plan" ? "Plan" : "Producto"}</span></td>
                <td style={td}>{d.qty}</td>
                <td style={{ ...td, color: "#f0b429", fontWeight: 600 }}>{fmt(d.revenue)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {filtered.length === 0 && <div style={{ color: "#555", textAlign: "center", padding: 40 }}>Sin ventas en este mes</div>}
    </div>
  );
}

// ─── SALES HISTORY ─────────────────────────────────────────────────────────
function SalesHistory({ sales }) {
  const [search, setSearch] = useState("");
  const filtered = sales.filter(s => s.client.toLowerCase().includes(search.toLowerCase()) || s.seller.toLowerCase().includes(search.toLowerCase()) || s.items.some(i => i.name.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{ maxWidth: 900 }}>
      <input style={{ ...inp, maxWidth: 340, marginBottom: 16 }} placeholder="🔍 Buscar por cliente, vendedor o producto..." value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.length === 0
        ? <div style={{ color: "#555", textAlign: "center", padding: 40 }}>Sin ventas registradas</div>
        : filtered.map(sale => (
          <div key={sale.id} style={{ background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <span style={{ color: "#666", fontSize: 12, marginRight: 10 }}>{fmtDate(sale.date)}</span>
                <span style={{ color: "#ccc", fontSize: 13, fontWeight: 600, marginRight: 8 }}>👤 {sale.client}</span>
                <span style={{ color: "#888", fontSize: 12 }}>por {sale.seller}</span>
              </div>
              <div style={{ color: "#f0b429", fontWeight: 700, fontSize: 16 }}>{fmt(sale.total)}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {sale.items.map((it, i) => <span key={i} style={{ background: "#1a1a30", borderRadius: 4, padding: "3px 8px", fontSize: 12, color: "#aaa" }}>{it.name} ×{it.qty} — {fmt(it.price * it.qty)}</span>)}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── INVENTORY ─────────────────────────────────────────────────────────────
function Inventory({ plans, setPlans, products, setProducts }) {
  const [tab, setTab] = useState("plans");
  const [form, setForm] = useState({ name: "", price: "", stock: "" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const isP = tab === "products";
  const items = isP ? products : plans;
  const setItems = isP ? setProducts : setPlans;

  const save = async () => {
    if (!form.name.trim() || !form.price || saving) return;
    setSaving(true);
    let updated;
    if (editId) {
      updated = items.map(i => i.id === editId ? { ...i, name: form.name, price: +form.price, ...(isP ? { stock: +form.stock } : {}) } : i);
    } else {
      updated = [...items, { id: Date.now().toString(), name: form.name, price: +form.price, type: isP ? "product" : "plan", ...(isP ? { stock: +form.stock } : {}) }];
    }
    await setItems(updated);
    setForm({ name: "", price: "", stock: "" }); setEditId(null); setSaving(false);
  };

  const del = async (id) => {
    await setItems(items.filter(i => i.id !== id));
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {[["plans", "Planes"], ["products", "Productos"]].map(([k, l]) => (
          <button key={k} style={{ background: tab === k ? "#f0b429" : "#1a1a30", border: "1px solid " + (tab === k ? "#f0b429" : "#2a2a4a"), color: tab === k ? "#0d0d1a" : "#aaa", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: tab === k ? 700 : 400 }} onClick={() => { setTab(k); setForm({ name: "", price: "", stock: "" }); setEditId(null); }}>{l}</button>
        ))}
      </div>
      <div style={card}>
        <div style={cardT}>{editId ? "Editar" : "Agregar"} {isP ? "Producto" : "Plan"}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input style={inp} placeholder="Nombre" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={{ ...inp, width: 120 }} placeholder="Precio" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          {isP && <input style={{ ...inp, width: 80 }} placeholder="Stock" type="number" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />}
          <button style={btnP} onClick={save} disabled={saving}>{saving ? "Guardando..." : editId ? "Guardar" : "Agregar"}</button>
          {editId && <button style={btnG} onClick={() => { setForm({ name: "", price: "", stock: "" }); setEditId(null); }}>Cancelar</button>}
        </div>
      </div>
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            {["Nombre", "Precio", ...(isP ? ["Stock"] : []), "Acciones"].map(h => <th key={h} style={{ color: "#666", fontSize: 12, fontWeight: 600, textAlign: "left", padding: "8px 10px", borderBottom: "1px solid #1e1e3a" }}>{h}</th>)}
          </tr></thead>
          <tbody>{items.map(item => (
            <tr key={item.id} style={{ borderBottom: "1px solid #1a1a30" }}>
              <td style={td}>{item.name}</td>
              <td style={{ ...td, color: "#f0b429" }}>{fmt(item.price)}</td>
              {isP && <td style={{ ...td, color: item.stock < 5 ? "#e74c3c" : "#2ecc71" }}>{item.stock}</td>}
              <td style={td}>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16, marginRight: 6 }} onClick={() => { setForm({ name: item.name, price: item.price, stock: item.stock ?? "" }); setEditId(item.id); }}>✏️</button>
                <button style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 16 }} onClick={() => del(item.id)}>🗑️</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ─── SETTINGS ──────────────────────────────────────────────────────────────
function Settings({ ownerPin, setOwnerPin }) {
  const [current, setCurrent] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const change = async () => {
    if (current !== ownerPin) { setMsg({ err: true, text: "PIN actual incorrecto" }); return; }
    if (newPin.length < 4) { setMsg({ err: true, text: "Mínimo 4 dígitos" }); return; }
    if (newPin !== confirm) { setMsg({ err: true, text: "Los PINs no coinciden" }); return; }
    setSaving(true);
    await setOwnerPin(newPin);
    setCurrent(""); setNewPin(""); setConfirm("");
    setMsg({ err: false, text: "PIN actualizado ✅" });
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={card}>
        <div style={cardT}>⚙️ Cambiar PIN del Dueño</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
          <input style={inp} type="password" placeholder="PIN actual" value={current} onChange={e => setCurrent(e.target.value)} />
          <input style={inp} type="password" placeholder="Nuevo PIN" value={newPin} onChange={e => setNewPin(e.target.value)} />
          <input style={inp} type="password" placeholder="Confirmar nuevo PIN" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {msg && <div style={{ color: msg.err ? "#e74c3c" : "#2ecc71", fontSize: 13 }}>{msg.text}</div>}
          <button style={btnP} onClick={change} disabled={saving}>{saving ? "Guardando..." : "Cambiar PIN"}</button>
        </div>
      </div>
      <div style={card}>
        <div style={cardT}>ℹ️ Información</div>
        <div style={{ color: "#aaa", fontSize: 14, lineHeight: 2 }}>
          <div>• Los datos se guardan en Google Sheets en tiempo real</div>
          <div>• Accesible desde cualquier dispositivo con internet</div>
          <div>• Los vendedores no tienen acceso al dashboard ni historial</div>
          <div>• PIN por defecto inicial: <strong style={{ color: "#f0b429" }}>1234</strong></div>
        </div>
      </div>
    </div>
  );
}

// ─── SHARED STYLES ─────────────────────────────────────────────────────────
const inp = { background: "#1a1a30", border: "1px solid #2a2a4a", borderRadius: 8, padding: "10px 14px", color: "#fff", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" };
const btnP = { background: "#f0b429", color: "#0d0d1a", border: "none", borderRadius: 8, padding: "12px 20px", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const btnG = { background: "transparent", color: "#aaa", border: "1px solid #2a2a4a", borderRadius: 8, padding: "10px 20px", cursor: "pointer", fontSize: 14 };
const rBtn = { padding: "16px 20px", borderRadius: 10, border: "1px solid #2a2a4a", color: "#fff", cursor: "pointer", fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 };
const lbl = { color: "#aaa", fontSize: 13, fontWeight: 600, letterSpacing: 1 };
const hdr = { background: "#13132a", borderBottom: "1px solid #1e1e3a", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" };
const logBtn = { background: "transparent", color: "#e74c3c", border: "1px solid #e74c3c", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 13 };
const qBtn = { background: "#2a2a4a", border: "none", color: "#fff", width: 24, height: 24, borderRadius: 4, cursor: "pointer", fontSize: 14 };
const card = { background: "#13132a", border: "1px solid #1e1e3a", borderRadius: 10, padding: 20, marginBottom: 16 };
const cardT = { fontSize: 15, fontWeight: 700, marginBottom: 14, color: "#ccc" };
const td = { padding: "10px", fontSize: 14, color: "#ccc" };
