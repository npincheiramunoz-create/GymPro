import { useState, useEffect, useMemo } from "react";

const API = "https://script.google.com/macros/s/AKfycbxF4yBG01zQ4_DTXUr7cdN61BOwbylb8QQ1OIA-87gJeIt3eWPkipf5qIAikO616rLt/exec";
const api = async (action, body = {}) => {
  const res = await fetch(API, { method: "POST", body: JSON.stringify({ action, ...body }) });
  return res.json();
};

const INITIAL_PLANS = [
  { id: "p1", name: "Plan Mensual", price: 25000, type: "plan", durationDays: 30 },
  { id: "p2", name: "Plan Trimestral", price: 65000, type: "plan", durationDays: 90 },
  { id: "p3", name: "Plan Anual", price: 200000, type: "plan", durationDays: 365 },
  { id: "p4", name: "Clase Suelta", price: 5000, type: "plan", durationDays: 1 },
];
const INITIAL_PRODUCTS = [
  { id: "pr1", name: "Barra Proteica", price: 2500, type: "product" },
  { id: "pr2", name: "Agua 500ml", price: 800, type: "product" },
  { id: "pr3", name: "Bebida Isotónica", price: 1500, type: "product" },
  { id: "pr4", name: "Proteína Whey (scoop)", price: 3000, type: "product" },
];

const fmt = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
const fmtDate = (iso) => new Date(iso).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const fmtDay = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
const monthKey = (iso) => iso.slice(0, 7);
const nowISO = () => new Date().toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const monthLabel = (key) => { const [y, m] = key.split("-"); return `${MONTHS_ES[parseInt(m)-1]} ${y}`; };

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const daysUntil = (dateStr) => {
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(dateStr + "T12:00:00");
  return Math.round((end - now) / 86400000);
};

const calcStock = (productId, receipts, sales) => {
  const received = receipts.reduce((a, r) => { const it = r.items.find(i => i.productId === productId); return a + (it ? it.qty : 0); }, 0);
  const sold = sales.reduce((a, s) => { const it = s.items.find(i => i.id === productId && i.type === "product"); return a + (it ? it.qty : 0); }, 0);
  return received - sold;
};

// ── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [role, setRole] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [plans, setPlans] = useState(INITIAL_PLANS);
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [sales, setSales] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [clients, setClients] = useState([]);
  const [ownerPin, setOwnerPin] = useState("1234");
  const [sellerName, setSellerName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const [inv, salesData, pinData, receiptsData, clientsData] = await Promise.all([
          api("getInventory"), api("getSales"), api("getPin"), api("getReceipts"), api("getClients"),
        ]);
        if (inv.plans?.length) setPlans(inv.plans);
        if (inv.products?.length) setProducts(inv.products);
        if (salesData.sales?.length) setSales(salesData.sales);
        if (pinData.pin) setOwnerPin(pinData.pin);
        if (receiptsData.receipts?.length) setReceipts(receiptsData.receipts);
        if (clientsData.clients?.length) setClients(clientsData.clients);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    init();
  }, []);

  const addSale = async (sale) => { setSales(prev => [sale, ...prev]); await api("addSale", { sale }); };
  const addReceipt = async (r) => { setReceipts(prev => [r, ...prev]); await api("addReceipt", { receipt: r }); };
  const addClient = async (c) => { setClients(prev => [c, ...prev]); await api("addClient", { client: c }); return c; };
  const updateClient = async (c) => { setClients(prev => prev.map(x => x.id === c.id ? c : x)); await api("updateClient", { client: c }); };
  const savePlans = async (p) => { setPlans(p); await api("saveInventory", { plans: p, products }); };
  const saveProducts = async (p) => { setProducts(p); await api("saveInventory", { plans, products: p }); };
  const savePin = async (p) => { setOwnerPin(p); await api("savePin", { pin: p }); };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#0d0d1a", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif", color:"#fff" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>💪</div>
      <div style={{ fontSize:24, fontWeight:900, letterSpacing:4 }}>GYM<span style={{ color:"#f0b429" }}>PRO</span></div>
      <div style={{ color:"#555", fontSize:13, marginTop:12 }}>Cargando datos...</div>
    </div>
  );

  if (!role) return <LoginScreen onSeller={(n) => { setSellerName(n); setRole("seller"); }} onOwner={(p) => { if (p === ownerPin) { setRole("owner"); setPinError(false); } else setPinError(true); }} pin={pin} setPin={setPin} pinError={pinError} />;

  if (role === "seller") return (
    <SellerView plans={plans} products={products} receipts={receipts} sales={sales} clients={clients}
      onSale={addSale} onReceipt={addReceipt} onAddClient={addClient} onUpdateClient={updateClient}
      sellerName={sellerName} onLogout={() => setRole(null)} ownerPin={ownerPin} />
  );

  return (
    <OwnerView plans={plans} setPlans={savePlans} products={products} setProducts={saveProducts}
      sales={sales} receipts={receipts} clients={clients} onAddClient={addClient} onUpdateClient={updateClient}
      onLogout={() => setRole(null)} ownerPin={ownerPin} setOwnerPin={savePin} />
  );
}

// ── LOGIN ───────────────────────────────────────────────────────────────────
function LoginScreen({ onSeller, onOwner, pin, setPin, pinError }) {
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  return (
    <div style={{ minHeight:"100vh", background:"#0d0d1a", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"sans-serif" }}>
      <div style={{ background:"#13132a", borderRadius:16, padding:40, width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.6)", border:"1px solid #1e1e3a" }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:48, marginBottom:8 }}>💪</div>
          <div style={{ fontSize:32, fontWeight:900, color:"#fff", letterSpacing:4 }}>GYM<span style={{ color:"#f0b429" }}>PRO</span></div>
          <div style={{ color:"#666", fontSize:13, marginTop:4 }}>Sistema de Gestión</div>
        </div>
        {!mode && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <button style={{ ...rBtn, background:"#1a1a2e" }} onClick={() => setMode("seller")}><span style={{ fontSize:24 }}>🧾</span><span>Soy Vendedor / Recepción</span></button>
            <button style={{ ...rBtn, background:"#16213e" }} onClick={() => setMode("owner")}><span style={{ fontSize:24 }}>👑</span><span>Soy Dueño</span></button>
          </div>
        )}
        {mode === "seller" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={lbl}>Tu nombre</div>
            <input style={inp} placeholder="Nombre" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key==="Enter" && name.trim() && onSeller(name.trim())} />
            <button style={btnP} onClick={() => name.trim() && onSeller(name.trim())}>Entrar</button>
            <button style={btnG} onClick={() => setMode(null)}>← Volver</button>
          </div>
        )}
        {mode === "owner" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={lbl}>PIN del dueño</div>
            <input style={{ ...inp, ...(pinError?{borderColor:"#e74c3c"}:{}) }} type="password" placeholder="••••" maxLength={8} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key==="Enter" && onOwner(pin)} />
            {pinError && <div style={{ color:"#e74c3c", fontSize:12 }}>PIN incorrecto</div>}
            <button style={btnP} onClick={() => onOwner(pin)}>Ingresar</button>
            <button style={btnG} onClick={() => setMode(null)}>← Volver</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CLIENT SELECTOR MODAL ───────────────────────────────────────────────────
function ClientModal({ clients, onSelect, onAddClient, onClose }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", phone:"", email:"", dob:"" });
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const c = { id: Date.now().toString(), name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), dob: form.dob, createdAt: nowISO() };
    const created = await onAddClient(c);
    onSelect(created);
    setSaving(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
      <div style={{ background:"#13132a", border:"1px solid #2a2a4a", borderRadius:14, padding:24, width:"100%", maxWidth:460, maxHeight:"80vh", display:"flex", flexDirection:"column" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:16 }}>👤 Seleccionar Cliente</div>
          <button style={{ background:"transparent", border:"none", color:"#aaa", cursor:"pointer", fontSize:20 }} onClick={onClose}>✕</button>
        </div>

        {!showForm ? (
          <>
            <input style={{ ...inp, marginBottom:12 }} placeholder="🔍 Buscar por nombre, teléfono o email..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
            <div style={{ flex:1, overflowY:"auto", marginBottom:12 }}>
              {filtered.length === 0
                ? <div style={{ color:"#555", textAlign:"center", padding:20 }}>Sin resultados</div>
                : filtered.map(c => (
                  <div key={c.id} style={{ padding:"10px 12px", borderRadius:8, cursor:"pointer", marginBottom:6, background:"#1a1a30", border:"1px solid #2a2a4a" }} onClick={() => onSelect(c)}>
                    <div style={{ fontWeight:600 }}>{c.name}</div>
                    <div style={{ color:"#888", fontSize:12 }}>{c.phone} {c.email ? `· ${c.email}` : ""}</div>
                  </div>
                ))
              }
            </div>
            <button style={{ ...btnG, width:"100%" }} onClick={() => setShowForm(true)}>+ Registrar nuevo cliente</button>
          </>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <div style={lbl}>Nombre *</div>
                <input style={inp} placeholder="Nombre completo" value={form.name} onChange={e => setForm(f => ({...f, name:e.target.value}))} />
              </div>
              <div>
                <div style={lbl}>Teléfono</div>
                <input style={inp} placeholder="+56 9 ..." value={form.phone} onChange={e => setForm(f => ({...f, phone:e.target.value}))} />
              </div>
              <div>
                <div style={lbl}>Email</div>
                <input style={inp} placeholder="correo@..." value={form.email} onChange={e => setForm(f => ({...f, email:e.target.value}))} />
              </div>
              <div>
                <div style={lbl}>Fecha de nacimiento</div>
                <input style={inp} type="date" value={form.dob} onChange={e => setForm(f => ({...f, dob:e.target.value}))} />
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={btnP} onClick={save} disabled={saving || !form.name.trim()}>{saving?"Guardando...":"Guardar y seleccionar"}</button>
              <button style={btnG} onClick={() => setShowForm(false)}>← Volver</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── PIN CONFIRM MODAL ───────────────────────────────────────────────────────
function PinModal({ ownerPin, onConfirm, onClose, title = "Autorización del Dueño" }) {
  const [p, setP] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1001 }}>
      <div style={{ background:"#13132a", border:"1px solid #2a2a4a", borderRadius:14, padding:28, width:"100%", maxWidth:320 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>🔐 {title}</div>
        <div style={lbl}>PIN del dueño</div>
        <input style={{ ...inp, marginBottom:8, ...(err?{borderColor:"#e74c3c"}:{}) }} type="password" placeholder="••••" maxLength={8} value={p} onChange={e => { setP(e.target.value); setErr(false); }} autoFocus onKeyDown={e => { if (e.key==="Enter") { if (p===ownerPin) onConfirm(); else setErr(true); }}} />
        {err && <div style={{ color:"#e74c3c", fontSize:12, marginBottom:8 }}>PIN incorrecto</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button style={btnP} onClick={() => { if (p===ownerPin) onConfirm(); else setErr(true); }}>Confirmar</button>
          <button style={btnG} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ── SELLER VIEW ─────────────────────────────────────────────────────────────
function SellerView({ plans, products, receipts, sales, clients, onSale, onReceipt, onAddClient, onUpdateClient, sellerName, onLogout, ownerPin }) {
  const [view, setView] = useState("sell");
  const stockMap = useMemo(() => { const m = {}; products.forEach(p => { m[p.id] = calcStock(p.id, receipts, sales); }); return m; }, [products, receipts, sales]);
  return (
    <div style={{ minHeight:"100vh", background:"#0d0d1a", fontFamily:"sans-serif", color:"#fff" }}>
      <header style={hdr}>
        <div style={{ fontSize:18, fontWeight:700 }}>💪 GymPro</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <button style={{ ...tabBtn, ...(view==="sell"?tabBtnA:{}) }} onClick={() => setView("sell")}>🧾 Vender</button>
          <button style={{ ...tabBtn, ...(view==="receive"?tabBtnA:{}) }} onClick={() => setView("receive")}>📦 Recepción</button>
          <span style={{ background:"#1a1a3a", border:"1px solid #2a2a5a", borderRadius:20, padding:"4px 12px", fontSize:13, color:"#ccc" }}>👤 {sellerName}</span>
          <button style={logBtn} onClick={onLogout}>Salir</button>
        </div>
      </header>
      {view === "sell"
        ? <SellPanel plans={plans} products={products} stockMap={stockMap} onSale={onSale} sellerName={sellerName} clients={clients} onAddClient={onAddClient} ownerPin={ownerPin} />
        : <ReceivePanel products={products} onReceipt={onReceipt} sellerName={sellerName} />
      }
    </div>
  );
}

// ── SELL PANEL ──────────────────────────────────────────────────────────────
function SellPanel({ plans, products, stockMap, onSale, sellerName, clients, onAddClient, ownerPin }) {
  const [cart, setCart] = useState([]);
  const [client, setClient] = useState(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("plans");
  const [showClientModal, setShowClientModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [discountItem, setDiscountItem] = useState(null); // {cartId, pendingDiscount}
  const [planDates, setPlanDates] = useState({}); // cartId -> startDate
  const [pendingDiscount, setPendingDiscount] = useState({ cartId:null, value:"" });
  const items = tab === "plans" ? plans : products;

  const addToCart = (item) => {
    if (item.type === "product" && (stockMap[item.id]||0) <= 0) return;
    const cartId = `${item.id}_${Date.now()}`;
    setCart(prev => {
      if (item.type === "product") {
        const ex = prev.find(c => c.id === item.id && c.type === "product");
        if (ex) return prev.map(c => c.id===item.id && c.type==="product" ? {...c, qty:c.qty+1} : c);
      }
      return [...prev, { ...item, cartId, qty:1, discount:0 }];
    });
    if (item.type === "plan") setPlanDates(pd => ({ ...pd, [cartId]: todayStr() }));
  };

  const removeFromCart = (cartId) => setCart(prev => prev.filter(c => c.cartId !== cartId));
  const updateQty = (cartId, qty) => { if (qty < 1) { removeFromCart(cartId); return; } setCart(prev => prev.map(c => c.cartId===cartId ? {...c, qty} : c)); };

  const requestDiscount = (cartId) => {
    setPendingDiscount({ cartId, value:"" });
    setShowPinModal(true);
  };
  const applyDiscount = () => {
    const val = Math.min(100, Math.max(0, parseFloat(pendingDiscount.value)||0));
    setCart(prev => prev.map(c => c.cartId===pendingDiscount.cartId ? {...c, discount:val} : c));
    setShowPinModal(false);
  };

  const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
  const discountTotal = cart.reduce((a, c) => a + (c.discount ? c.price * c.qty * c.discount / 100 : 0), 0);
  const total = subtotal - discountTotal;

  const confirm = async () => {
    if (!cart.length || saving) return;
    if (!client) { setShowClientModal(true); return; }
    setSaving(true);
    const saleItems = cart.map(c => ({
      id: c.id, cartId: c.cartId, name: c.name, price: c.price, qty: c.qty, type: c.type,
      discount: c.discount || 0,
      finalPrice: c.price * (1 - (c.discount||0)/100),
      ...(c.type==="plan" ? { startDate: planDates[c.cartId] || todayStr(), endDate: addDays(planDates[c.cartId]||todayStr(), c.durationDays||30), durationDays: c.durationDays||30 } : {}),
    }));
    const sale = { id: Date.now().toString(), date: nowISO(), seller: sellerName, clientId: client.id, clientName: client.name, items: saleItems, subtotal, discountTotal, total };
    await onSale(sale);
    setCart([]); setClient(null); setPlanDates({}); setSuccess(true); setSaving(false);
    setTimeout(() => setSuccess(false), 2500);
  };

  return (
    <>
      {showClientModal && <ClientModal clients={clients} onSelect={(c) => { setClient(c); setShowClientModal(false); }} onAddClient={onAddClient} onClose={() => setShowClientModal(false)} />}
      {showPinModal && (
        <PinModal ownerPin={ownerPin} title="Autorizar Descuento" onClose={() => setShowPinModal(false)}
          onConfirm={() => {
            setShowPinModal(false);
            setDiscountItem(pendingDiscount.cartId);
          }} />
      )}
      {discountItem && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1001 }}>
          <div style={{ background:"#13132a", border:"1px solid #2a2a4a", borderRadius:14, padding:28, width:"100%", maxWidth:300 }}>
            <div style={{ fontWeight:700, marginBottom:12 }}>% Descuento</div>
            <input style={{ ...inp, marginBottom:12 }} type="number" min="0" max="100" placeholder="Ej: 10" value={pendingDiscount.value} onChange={e => setPendingDiscount(p => ({...p, value:e.target.value}))} autoFocus />
            <div style={{ display:"flex", gap:10 }}>
              <button style={btnP} onClick={() => { applyDiscount(); setDiscountItem(null); }}>Aplicar</button>
              <button style={btnG} onClick={() => setDiscountItem(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {success && <div style={{ background:"#1a3a2a", borderBottom:"1px solid #2ecc71", color:"#2ecc71", padding:"10px 24px", fontSize:14, fontWeight:600 }}>✅ Venta registrada exitosamente</div>}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 380px", height:"calc(100vh - 61px)" }}>
        <div style={{ borderRight:"1px solid #1e1e3a", overflow:"auto", padding:20 }}>
          <div style={{ display:"flex", gap:4, marginBottom:16 }}>
            {[["plans","Planes"],["products","Productos"]].map(([k,l]) => (
              <button key={k} style={{ background:tab===k?"#f0b429":"#1a1a30", border:"1px solid "+(tab===k?"#f0b429":"#2a2a4a"), color:tab===k?"#0d0d1a":"#aaa", borderRadius:6, padding:"8px 16px", cursor:"pointer", fontSize:14, fontWeight:tab===k?700:400 }} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))", gap:10 }}>
            {items.map(item => {
              const stock = item.type==="product" ? (stockMap[item.id]||0) : null;
              const oos = item.type==="product" && stock<=0;
              return (
                <button key={item.id} style={{ background:oos?"#1a1a20":"#13132a", border:"1px solid "+(oos?"#2a1a1a":"#2a2a4a"), borderRadius:10, padding:"14px 10px", cursor:oos?"not-allowed":"pointer", textAlign:"center", color:oos?"#444":"#fff", opacity:oos?0.6:1 }} onClick={() => addToCart(item)}>
                  <div style={{ fontSize:28, marginBottom:6 }}>{item.type==="plan"?"🏋️":"🛒"}</div>
                  <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{item.name}</div>
                  <div style={{ fontSize:13, color:oos?"#555":"#f0b429", fontWeight:700 }}>{fmt(item.price)}</div>
                  {item.type==="plan" && item.durationDays && <div style={{ fontSize:10, color:"#666", marginTop:2 }}>{item.durationDays} días</div>}
                  {item.type==="product" && <div style={{ fontSize:11, marginTop:2, color:stock<=0?"#e74c3c":stock<5?"#f0b429":"#2ecc71" }}>{stock<=0?"Sin stock":`Stock: ${stock}`}</div>}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding:20, overflow:"auto", background:"#0f0f20", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontSize:16, fontWeight:700, color:"#f0b429" }}>🧾 Venta Actual</div>

          {/* Client selector */}
          <div style={{ background:"#13132a", border:"1px solid "+(client?"#2ecc71":"#2a2a4a"), borderRadius:8, padding:"10px 14px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }} onClick={() => setShowClientModal(true)}>
            {client
              ? <><span style={{ fontWeight:600 }}>👤 {client.name}</span><span style={{ color:"#2ecc71", fontSize:12 }}>✓ Cambiar</span></>
              : <span style={{ color:"#666" }}>👤 Seleccionar cliente *</span>
            }
          </div>

          {/* Cart items */}
          {cart.length === 0
            ? <div style={{ color:"#555", fontSize:14, padding:"20px 0", textAlign:"center" }}>Selecciona productos o planes</div>
            : cart.map(c => (
              <div key={c.cartId} style={{ background:"#13132a", borderRadius:8, padding:"10px 12px", border:"1px solid #2a2a4a" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: c.type==="plan"?8:0 }}>
                  <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{c.name}</div>
                  {c.type==="product" && (
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <button style={qBtn} onClick={() => updateQty(c.cartId, c.qty-1)}>−</button>
                      <span style={{ width:20, textAlign:"center", fontSize:13 }}>{c.qty}</span>
                      <button style={qBtn} onClick={() => updateQty(c.cartId, c.qty+1)}>+</button>
                    </div>
                  )}
                  <div style={{ fontSize:13, color:"#f0b429", fontWeight:600, minWidth:65, textAlign:"right" }}>
                    {c.discount ? <><span style={{ textDecoration:"line-through", color:"#666", fontSize:11, marginRight:4 }}>{fmt(c.price*c.qty)}</span>{fmt(c.price*c.qty*(1-c.discount/100))}</> : fmt(c.price*c.qty)}
                  </div>
                  <button style={{ background:"transparent", border:"none", color:"#e74c3c", cursor:"pointer", fontSize:12 }} onClick={() => removeFromCart(c.cartId)}>✕</button>
                </div>
                {c.type==="plan" && (
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                    <div>
                      <div style={{ ...lbl, fontSize:10 }}>Fecha inicio</div>
                      <input style={{ ...inp, fontSize:12, padding:"6px 10px" }} type="date" value={planDates[c.cartId]||todayStr()} onChange={e => setPlanDates(pd => ({...pd,[c.cartId]:e.target.value}))} />
                    </div>
                    <div>
                      <div style={{ ...lbl, fontSize:10 }}>Vence</div>
                      <div style={{ background:"#1a1a30", border:"1px solid #2a2a4a", borderRadius:8, padding:"6px 10px", fontSize:12, color:"#aaa" }}>
                        {fmtDay(addDays(planDates[c.cartId]||todayStr(), c.durationDays||30))}
                      </div>
                    </div>
                    <div style={{ gridColumn:"1/-1", display:"flex", justifyContent:"flex-end" }}>
                      {c.discount
                        ? <span style={{ color:"#f0b429", fontSize:12 }}>🏷️ {c.discount}% descuento aplicado · <span style={{ cursor:"pointer", textDecoration:"underline" }} onClick={() => { setCart(prev => prev.map(x => x.cartId===c.cartId ? {...x,discount:0} : x)); }}>quitar</span></span>
                        : <button style={{ background:"transparent", border:"1px solid #3a3a5a", color:"#aaa", borderRadius:5, padding:"3px 10px", cursor:"pointer", fontSize:11 }} onClick={() => requestDiscount(c.cartId)}>🏷️ Aplicar descuento</button>
                      }
                    </div>
                  </div>
                )}
              </div>
            ))
          }

          {cart.length > 0 && (
            <div style={{ borderTop:"1px solid #2a2a4a", paddingTop:10 }}>
              {discountTotal > 0 && (
                <>
                  <div style={{ display:"flex", justifyContent:"space-between", color:"#888", fontSize:13, marginBottom:4 }}>
                    <span>Subtotal</span><span>{fmt(subtotal)}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", color:"#e74c3c", fontSize:13, marginBottom:4 }}>
                    <span>Descuento</span><span>−{fmt(discountTotal)}</span>
                  </div>
                </>
              )}
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:18, marginBottom:12 }}>
                <span>Total</span><span style={{ color:"#f0b429", fontWeight:700 }}>{fmt(total)}</span>
              </div>
              <button style={{ background:saving?"#7a5a10":"#f0b429", color:"#0d0d1a", border:"none", borderRadius:8, padding:"14px 20px", fontWeight:700, cursor:"pointer", fontSize:16, width:"100%" }} onClick={confirm} disabled={saving}>
                {saving?"Guardando...":"Confirmar Venta"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── RECEIVE PANEL ────────────────────────────────────────────────────────────
function ReceivePanel({ products, onReceipt, sellerName }) {
  const [guideNum, setGuideNum] = useState("");
  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState([{ productId:"", productName:"", qty:"", costUnit:"", isNew:false }]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateItem = (i, f, v) => setItems(prev => prev.map((it,idx) => idx===i ? {...it,[f]:v} : it));
  const toggleNew = (i) => setItems(prev => prev.map((it,idx) => idx===i ? {...it,isNew:!it.isNew,productId:"",productName:""} : it));
  const addRow = () => setItems(prev => [...prev, { productId:"", productName:"", qty:"", costUnit:"", isNew:false }]);
  const removeRow = (i) => setItems(prev => prev.filter((_,idx) => idx!==i));

  const confirm = async () => {
    if (!guideNum.trim()||!supplier.trim()) return;
    const valid = items.filter(it => (it.productId||it.productName) && it.qty>0);
    if (!valid.length) return;
    setSaving(true);
    const receipt = { id:Date.now().toString(), date:nowISO(), guideNum:guideNum.trim(), supplier:supplier.trim(), receivedBy:sellerName, items:valid.map(it => ({ productId:it.isNew?`new_${Date.now()}_${Math.random().toString(36).slice(2,6)}`:it.productId, productName:it.isNew?it.productName:(products.find(p=>p.id===it.productId)?.name||it.productId), qty:+it.qty, costUnit:+it.costUnit||0, isNew:it.isNew })) };
    await onReceipt(receipt);
    setGuideNum(""); setSupplier(""); setItems([{ productId:"", productName:"", qty:"", costUnit:"", isNew:false }]);
    setSuccess(true); setSaving(false); setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div style={{ padding:24, maxWidth:700 }}>
      {success && <div style={{ background:"#1a3a2a", border:"1px solid #2ecc71", color:"#2ecc71", padding:"12px 20px", borderRadius:8, marginBottom:16, fontWeight:600 }}>✅ Recepción registrada correctamente</div>}
      <div style={card}>
        <div style={cardT}>📦 Nueva Recepción de Mercadería</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
          <div><div style={lbl}>N° Guía *</div><input style={inp} placeholder="GR-2024-001" value={guideNum} onChange={e=>setGuideNum(e.target.value)} /></div>
          <div><div style={lbl}>Proveedor *</div><input style={inp} placeholder="Nombre proveedor" value={supplier} onChange={e=>setSupplier(e.target.value)} /></div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 90px 36px", gap:8, marginBottom:8 }}>
          {["Producto","Cantidad","Costo Unit.","",""].map((h,i) => <div key={i} style={{ color:"#666", fontSize:11, fontWeight:600 }}>{h}</div>)}
        </div>
        {items.map((it,i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 90px 36px", gap:8, marginBottom:8, alignItems:"center" }}>
            {it.isNew ? <input style={inp} placeholder="Nuevo producto" value={it.productName} onChange={e=>updateItem(i,"productName",e.target.value)} />
              : <select style={inp} value={it.productId} onChange={e=>updateItem(i,"productId",e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>}
            <input style={inp} placeholder="0" type="number" min="1" value={it.qty} onChange={e=>updateItem(i,"qty",e.target.value)} />
            <input style={inp} placeholder="0" type="number" min="0" value={it.costUnit} onChange={e=>updateItem(i,"costUnit",e.target.value)} />
            <button onClick={()=>toggleNew(i)} style={{ background:it.isNew?"#2ecc71":"#2a2a4a", border:"none", color:it.isNew?"#0d0d1a":"#aaa", borderRadius:6, padding:"6px 8px", cursor:"pointer", fontSize:11, fontWeight:600 }}>{it.isNew?"✓ Nuevo":"+ Nuevo"}</button>
            {items.length>1 ? <button style={{ background:"transparent", border:"none", color:"#e74c3c", cursor:"pointer", fontSize:18 }} onClick={()=>removeRow(i)}>✕</button> : <div/>}
          </div>
        ))}
        <button style={{ ...btnG, marginTop:8, fontSize:13 }} onClick={addRow}>+ Agregar fila</button>
        <button style={{ ...btnP, width:"100%", marginTop:16 }} onClick={confirm} disabled={saving||!guideNum.trim()||!supplier.trim()}>{saving?"Guardando...":"Confirmar Recepción"}</button>
      </div>
    </div>
  );
}

// ── OWNER VIEW ───────────────────────────────────────────────────────────────
function OwnerView({ plans, setPlans, products, setProducts, sales, receipts, clients, onAddClient, onUpdateClient, onLogout, ownerPin, setOwnerPin }) {
  const [tab, setTab] = useState("dashboard");
  const stockMap = useMemo(() => { const m={}; products.forEach(p=>{m[p.id]=calcStock(p.id,receipts,sales);}); return m; }, [products,receipts,sales]);

  return (
    <div style={{ minHeight:"100vh", background:"#0d0d1a", fontFamily:"sans-serif", color:"#fff" }}>
      <header style={hdr}>
        <div style={{ fontSize:18, fontWeight:700 }}>💪 GymPro — <span style={{ color:"#f0b429" }}>Panel del Dueño</span></div>
        <button style={logBtn} onClick={onLogout}>Salir</button>
      </header>
      <div style={{ display:"flex", background:"#0f0f20", borderBottom:"1px solid #1e1e3a", padding:"0 20px", overflowX:"auto" }}>
        {[["dashboard","📊 Dashboard"],["clients","👥 Clientes"],["sales","📋 Ventas"],["receipts","📦 Recepciones"],["inventory","🗄️ Inventario"],["catalog","🏷️ Catálogo"],["settings","⚙️ Config"]].map(([k,l]) => (
          <button key={k} style={{ background:"transparent", border:"none", color:tab===k?"#f0b429":"#666", padding:"14px 16px", cursor:"pointer", fontSize:13, borderBottom:tab===k?"2px solid #f0b429":"2px solid transparent", fontWeight:tab===k?600:400, whiteSpace:"nowrap" }} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>
      <div style={{ padding:24, overflow:"auto" }}>
        {tab==="dashboard"  && <Dashboard sales={sales} receipts={receipts} products={products} stockMap={stockMap} clients={clients} plans={plans} />}
        {tab==="clients"    && <ClientsView clients={clients} sales={sales} plans={plans} onAddClient={onAddClient} onUpdateClient={onUpdateClient} />}
        {tab==="sales"      && <SalesHistory sales={sales} />}
        {tab==="receipts"   && <ReceiptsHistory receipts={receipts} />}
        {tab==="inventory"  && <InventoryView products={products} stockMap={stockMap} />}
        {tab==="catalog"    && <CatalogEditor plans={plans} setPlans={setPlans} products={products} setProducts={setProducts} />}
        {tab==="settings"   && <Settings ownerPin={ownerPin} setOwnerPin={setOwnerPin} />}
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ sales, receipts, products, stockMap, clients, plans }) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [chartMode, setChartMode] = useState("day"); // "day" | "month"

  const allMonths = useMemo(() => { const keys=[...new Set(sales.map(s=>monthKey(s.date)))].sort().reverse(); if(!keys.includes(currentMonth))keys.unshift(currentMonth); return keys; }, [sales,currentMonth]);
  const filtered = useMemo(() => sales.filter(s=>monthKey(s.date)===selectedMonth), [sales,selectedMonth]);

  // FIX: safe price helper — use finalPrice if valid number, else fall back to price
  const safePrice = (item) => {
    const fp = parseFloat(item.finalPrice);
    return isNaN(fp) ? (parseFloat(item.price) || 0) : fp;
  };

  const totalRevenue = filtered.reduce((a,s)=>a+(parseFloat(s.total)||0),0);
  const planRevenue  = filtered.reduce((a,s)=>a+s.items.filter(i=>i.type==="plan").reduce((x,i)=>x+safePrice(i)*i.qty,0),0);
  const productRevenue = filtered.reduce((a,s)=>a+s.items.filter(i=>i.type==="product").reduce((x,i)=>x+(parseFloat(i.price)||0)*i.qty,0),0);

  const itemMap = {};
  filtered.forEach(s=>s.items.forEach(i=>{ if(!itemMap[i.name])itemMap[i.name]={revenue:0,qty:0,type:i.type}; itemMap[i.name].revenue+=safePrice(i)*i.qty; itemMap[i.name].qty+=i.qty; }));
  const topItems = Object.entries(itemMap).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,6);

  // Daily chart data
  const daysInMonth = new Date(parseInt(selectedMonth.split("-")[0]),parseInt(selectedMonth.split("-")[1]),0).getDate();
  const dailyData = Array.from({length:daysInMonth},(_,i)=>{ const day=String(i+1).padStart(2,"0"); const ds=filtered.filter(s=>s.date.slice(0,10)===`${selectedMonth}-${day}`); return {label:`${i+1}`,total:ds.reduce((a,s)=>a+(parseFloat(s.total)||0),0)}; });

  // Monthly chart data (last 12 months)
  const monthlyData = useMemo(() => {
    const map = {};
    sales.forEach(s => { const k=monthKey(s.date); map[k]=(map[k]||0)+(parseFloat(s.total)||0); });
    return Object.entries(map).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12).map(([k,v])=>({ label:MONTHS_ES[parseInt(k.split("-")[1])-1].slice(0,3), total:v, key:k }));
  }, [sales]);

  const chartData = chartMode==="day" ? dailyData : monthlyData;
  const chartMax = Math.max(...chartData.map(d=>d.total),1);

  const lowStock = products.filter(p=>(stockMap[p.id]||0)<5);

  // FIX: compute endDate dynamically from startDate + current plan duration (not stored endDate)
  const getEffectiveEndDate = (saleItem) => {
    if (!saleItem.startDate) return saleItem.endDate || null;
    const planDef = plans?.find(p => p.id === saleItem.id);
    const duration = planDef?.durationDays || saleItem.durationDays || 30;
    return addDays(saleItem.startDate, duration);
  };

  // Plan expiry alerts
  const expiringPlans = [];
  sales.forEach(s => {
    s.items.forEach(it => {
      if (it.type==="plan" && it.startDate) {
        const effectiveEnd = getEffectiveEndDate(it);
        if (!effectiveEnd) return;
        const d = daysUntil(effectiveEnd);
        if (d >= 0 && d <= 10) {
          expiringPlans.push({ clientName:s.clientName||"—", planName:it.name, endDate:effectiveEnd, daysLeft:d });
        }
      }
    });
  });
  const seen = {}; const alerts = [];
  expiringPlans.sort((a,b)=>a.daysLeft-b.daysLeft).forEach(e => { const k=`${e.clientName}_${e.planName}`; if(!seen[k]){seen[k]=true;alerts.push(e);} });

  return (
    <div style={{ maxWidth:900 }}>
      {/* Controls */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <span style={{ color:"#aaa", fontSize:14 }}>Mes:</span>
        <select style={{ background:"#1a1a30", border:"1px solid #2a2a4a", color:"#fff", borderRadius:6, padding:"8px 12px", fontSize:14, outline:"none" }} value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}>
          {allMonths.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div style={{ background:"#1a1220", border:"1px solid #9b59b6", borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
          <div style={{ color:"#9b59b6", fontWeight:700, marginBottom:8 }}>🔔 Planes por vencer (próximos 10 días)</div>
          {alerts.map((a,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0", borderBottom:i<alerts.length-1?"1px solid #2a1a3a":"none" }}>
              <div><span style={{ fontWeight:600, marginRight:8 }}>{a.clientName}</span><span style={{ color:"#aaa", fontSize:13 }}>{a.planName}</span></div>
              <div style={{ textAlign:"right" }}>
                <span style={{ color:a.daysLeft===0?"#e74c3c":a.daysLeft<=3?"#f0b429":"#9b59b6", fontWeight:700, fontSize:13 }}>
                  {a.daysLeft===0?"Vence hoy":a.daysLeft===1?"Vence mañana":`Vence en ${a.daysLeft} días`}
                </span>
                <div style={{ color:"#666", fontSize:11 }}>{fmtDay(a.endDate)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stock alerts */}
      {lowStock.length > 0 && (
        <div style={{ background:"#2a1a0a", border:"1px solid #f0b429", borderRadius:10, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ color:"#f0b429", fontWeight:700 }}>⚠️ Stock bajo:</span>
          {lowStock.map(p=><span key={p.id} style={{ background:"#1a1000", border:"1px solid #f0b429", borderRadius:4, padding:"2px 8px", fontSize:12, color:"#f0b429" }}>{p.name} ({stockMap[p.id]||0})</span>)}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:20 }}>
        {[["💰","Ingresos Totales",fmt(totalRevenue),"#f0b429"],["🏋️","Planes",fmt(planRevenue),"#3498db"],["🛒","Productos",fmt(productRevenue),"#2ecc71"],["🧾","Transacciones",filtered.length,"#9b59b6"]].map(([icon,label,value,color])=>(
          <div key={label} style={{ background:"#13132a", border:"1px solid #1e1e3a", borderRadius:10, padding:"18px 20px", borderTop:`3px solid ${color}` }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{icon}</div>
            <div style={{ color:"#888", fontSize:12, marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:22, fontWeight:800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={cardT}>
            {chartMode==="day" ? `Ingresos por día — ${monthLabel(selectedMonth)}` : "Ingresos por mes (últimos 12)"}
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {[["day","Por día"],["month","Por mes"]].map(([m,l])=>(
              <button key={m} style={{ background:chartMode===m?"#f0b429":"#1a1a30", border:"1px solid "+(chartMode===m?"#f0b429":"#2a2a4a"), color:chartMode===m?"#0d0d1a":"#aaa", borderRadius:5, padding:"5px 12px", cursor:"pointer", fontSize:12, fontWeight:chartMode===m?700:400 }} onClick={()=>setChartMode(m)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:160, padding:"0 4px" }}>
          {chartData.map((d,i)=>{
            const pct = Math.round((d.total/chartMax)*100);
            const isSelected = chartMode==="month" && d.key===selectedMonth;
            const barColor = isSelected ? "#fff" : d.total>0 ? "#f0b429" : "#2a2a3e";
            return (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, height:"100%", cursor:"pointer" }}
                title={`${d.label}: ${fmt(d.total)}`}
                onClick={()=>{ if(chartMode==="month" && d.key) setSelectedMonth(d.key); }}
              >
                <div style={{ width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", flex:1 }}>
                  {d.total > 0 && (
                    <div style={{ color:"#888", fontSize:9, textAlign:"center", marginBottom:2, lineHeight:1 }}>
                      {pct > 15 ? fmt(d.total).replace("$","").replace(".000","k").replace(".","k").slice(0,6) : ""}
                    </div>
                  )}
                  <div style={{ width:"100%", borderRadius:"3px 3px 0 0", minHeight:3, background:barColor, height:`${pct}%`, transition:"height 0.3s" }} />
                </div>
                <div style={{ color: isSelected?"#fff":"#555", fontSize:chartMode==="day"?9:10, textAlign:"center", lineHeight:1 }}>{d.label}</div>
              </div>
            );
          })}
        </div>
        {chartMode==="month" && <div style={{ color:"#555", fontSize:11, marginTop:8, textAlign:"center" }}>Clic en una barra para ver el detalle del mes</div>}
      </div>

      {/* Top items */}
      {topItems.length > 0 && (
        <div style={card}>
          <div style={cardT}>Top productos / planes — {monthLabel(selectedMonth)}</div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Nombre","Tipo","Cant.","Ingreso"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{topItems.map(([name,d])=>(
              <tr key={name} style={{ borderBottom:"1px solid #13132a" }}>
                <td style={td}>{name}</td>
                <td style={td}><span style={{ borderRadius:4, padding:"2px 8px", fontSize:11, fontWeight:600, background:d.type==="plan"?"#1a3a5c":"#1a3a2c" }}>{d.type==="plan"?"Plan":"Producto"}</span></td>
                <td style={td}>{d.qty}</td>
                <td style={{ ...td, color:"#f0b429", fontWeight:600 }}>{fmt(d.revenue)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── CLIENTS VIEW ─────────────────────────────────────────────────────────────
function ClientsView({ clients, sales, plans, onAddClient, onUpdateClient }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", phone:"", email:"", dob:"" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.email?.toLowerCase().includes(search.toLowerCase()));

  const clientSales = useMemo(() => selected ? sales.filter(s => s.clientId===selected.id) : [], [selected, sales]);

  const activePlans = useMemo(() => {
    const result = [];
    clientSales.forEach(s => s.items.forEach(it => {
      if (it.type==="plan" && it.startDate) {
        const planDef = plans?.find(p => p.id === it.id);
        const duration = planDef?.durationDays || it.durationDays || 30;
        const effectiveEnd = addDays(it.startDate, duration);
        const d = daysUntil(effectiveEnd);
        result.push({ ...it, endDate: effectiveEnd, saleDate:s.date, daysLeft:d });
      }
    }));
    return result.sort((a,b) => new Date(b.saleDate)-new Date(a.saleDate));
  }, [clientSales, plans]);

  const saveClient = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editId) {
      const updated = { ...clients.find(c=>c.id===editId), ...form };
      await onUpdateClient(updated);
    } else {
      await onAddClient({ id:Date.now().toString(), ...form, createdAt:nowISO() });
    }
    setForm({name:"",phone:"",email:"",dob:""}); setEditId(null); setShowForm(false); setSaving(false);
  };

  if (selected) return (
    <div style={{ maxWidth:700 }}>
      <button style={{ ...btnG, marginBottom:16, fontSize:13 }} onClick={() => setSelected(null)}>← Volver</button>
      <div style={card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div>
            <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>👤 {selected.name}</div>
            <div style={{ color:"#888", fontSize:13 }}>{selected.phone} {selected.email ? `· ${selected.email}` : ""}</div>
            {selected.dob && <div style={{ color:"#666", fontSize:12, marginTop:2 }}>Nac: {fmtDay(selected.dob)}</div>}
          </div>
          <button style={{ ...btnG, fontSize:12 }} onClick={() => { setForm({name:selected.name,phone:selected.phone||"",email:selected.email||"",dob:selected.dob||""}); setEditId(selected.id); setShowForm(true); }}>✏️ Editar</button>
        </div>
      </div>

      {activePlans.length > 0 && (
        <div style={card}>
          <div style={cardT}>Planes</div>
          {activePlans.map((p,i) => {
            const active = p.daysLeft >= 0;
            const urgent = p.daysLeft >= 0 && p.daysLeft <= 10;
            return (
              <div key={i} style={{ padding:"10px 0", borderBottom:i<activePlans.length-1?"1px solid #1e1e3a":"none" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <span style={{ fontWeight:600, marginRight:8 }}>{p.name}</span>
                    {p.discount > 0 && <span style={{ color:"#f0b429", fontSize:12 }}>🏷️ -{p.discount}%</span>}
                  </div>
                  <span style={{ color:active?(urgent?"#f0b429":"#2ecc71"):"#555", fontSize:12, fontWeight:600 }}>
                    {active ? (p.daysLeft===0?"Vence hoy":p.daysLeft===1?"Vence mañana":`${p.daysLeft} días`) : "Vencido"}
                  </span>
                </div>
                <div style={{ color:"#666", fontSize:12, marginTop:3 }}>
                  {fmtDay(p.startDate)} → {fmtDay(p.endDate)} · {fmt(p.finalPrice||p.price)} pagado
                </div>
              </div>
            );
          })}
        </div>
      )}

      {clientSales.length > 0 && (
        <div style={card}>
          <div style={cardT}>Historial de compras</div>
          {clientSales.map(s => (
            <div key={s.id} style={{ padding:"8px 0", borderBottom:"1px solid #1e1e3a" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:"#888", fontSize:12 }}>{fmtDate(s.date)}</span>
                <span style={{ color:"#f0b429", fontWeight:700 }}>{fmt(s.total)}</span>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginTop:4 }}>
                {s.items.map((it,i) => <span key={i} style={{ background:"#1a1a30", borderRadius:4, padding:"2px 8px", fontSize:11, color:"#aaa" }}>{it.name} ×{it.qty}{it.discount>0?` (-${it.discount}%)`:""}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth:900 }}>
      {showForm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }}>
          <div style={{ background:"#13132a", border:"1px solid #2a2a4a", borderRadius:14, padding:28, width:"100%", maxWidth:420 }}>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:16 }}>{editId?"Editar":"Nuevo"} Cliente</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:16 }}>
              <div style={{ gridColumn:"1/-1" }}><div style={lbl}>Nombre *</div><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
              <div><div style={lbl}>Teléfono</div><input style={inp} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
              <div><div style={lbl}>Email</div><input style={inp} value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
              <div><div style={lbl}>Fecha de nacimiento</div><input style={inp} type="date" value={form.dob} onChange={e=>setForm(f=>({...f,dob:e.target.value}))} /></div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button style={btnP} onClick={saveClient} disabled={saving||!form.name.trim()}>{saving?"Guardando...":"Guardar"}</button>
              <button style={btnG} onClick={()=>{setShowForm(false);setEditId(null);setForm({name:"",phone:"",email:"",dob:""});}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <input style={{ ...inp, maxWidth:320 }} placeholder="🔍 Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)} />
        <button style={btnP} onClick={()=>{setForm({name:"",phone:"",email:"",dob:""});setEditId(null);setShowForm(true);}}>+ Nuevo cliente</button>
      </div>

      {filtered.length===0
        ? <div style={{ color:"#555", textAlign:"center", padding:40 }}>Sin clientes registrados</div>
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:10 }}>
            {filtered.map(c => {
              const cSales = sales.filter(s=>s.clientId===c.id);
              const lastSale = cSales[0];
              const activePlan = cSales.flatMap(s=>s.items.filter(it=>it.type==="plan"&&it.endDate&&daysUntil(it.endDate)>=0)).sort((a,b)=>new Date(b.endDate)-new Date(a.endDate))[0];
              return (
                <div key={c.id} style={{ background:"#13132a", border:"1px solid #1e1e3a", borderRadius:10, padding:14, cursor:"pointer" }} onClick={()=>setSelected(c)}>
                  <div style={{ fontWeight:700, marginBottom:4 }}>{c.name}</div>
                  <div style={{ color:"#888", fontSize:12, marginBottom:6 }}>{c.phone} {c.email?`· ${c.email}`:""}</div>
                  {activePlan
                    ? <div style={{ fontSize:12, color: daysUntil(activePlan.endDate)<=10?"#f0b429":"#2ecc71" }}>
                        🏋️ {activePlan.name} · vence {fmtDay(activePlan.endDate)}
                      </div>
                    : <div style={{ fontSize:12, color:"#555" }}>Sin plan activo</div>
                  }
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ── SALES HISTORY ─────────────────────────────────────────────────────────────
function SalesHistory({ sales }) {
  const [search, setSearch] = useState("");
  const filtered = sales.filter(s => s.clientName?.toLowerCase().includes(search.toLowerCase()) || s.seller?.toLowerCase().includes(search.toLowerCase()) || s.items.some(i=>i.name.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{ maxWidth:900 }}>
      <input style={{ ...inp, maxWidth:340, marginBottom:16 }} placeholder="🔍 Cliente, vendedor o producto..." value={search} onChange={e=>setSearch(e.target.value)} />
      {filtered.length===0 ? <div style={{ color:"#555", textAlign:"center", padding:40 }}>Sin ventas</div>
        : filtered.map(sale => (
          <div key={sale.id} style={{ background:"#13132a", border:"1px solid #1e1e3a", borderRadius:10, padding:14, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
              <div>
                <span style={{ color:"#666", fontSize:12, marginRight:8 }}>{fmtDate(sale.date)}</span>
                <span style={{ color:"#ccc", fontWeight:600, marginRight:8 }}>👤 {sale.clientName||"—"}</span>
                <span style={{ color:"#888", fontSize:12 }}>por {sale.seller}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                {sale.discountTotal>0 && <div style={{ color:"#e74c3c", fontSize:11 }}>−{fmt(sale.discountTotal)} desc.</div>}
                <div style={{ color:"#f0b429", fontWeight:700 }}>{fmt(sale.total)}</div>
              </div>
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {sale.items.map((it,i) => (
                <span key={i} style={{ background:"#1a1a30", borderRadius:4, padding:"3px 8px", fontSize:12, color:"#aaa" }}>
                  {it.name} ×{it.qty}{it.discount>0?` 🏷️-${it.discount}%`:""} — {fmt((it.finalPrice||it.price)*it.qty)}
                  {it.type==="plan"&&it.endDate?` (hasta ${fmtDay(it.endDate)})` : ""}
                </span>
              ))}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ── RECEIPTS HISTORY ─────────────────────────────────────────────────────────
function ReceiptsHistory({ receipts }) {
  return (
    <div style={{ maxWidth:900 }}>
      {receipts.length===0 ? <div style={{ color:"#555", textAlign:"center", padding:40 }}>Sin recepciones</div>
        : receipts.map(r => (
          <div key={r.id} style={{ background:"#13132a", border:"1px solid #1e1e3a", borderRadius:10, padding:14, marginBottom:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
              <div><span style={{ color:"#f0b429", fontWeight:700, marginRight:8 }}>Guía #{r.guideNum}</span><span style={{ color:"#ccc", fontSize:13, marginRight:8 }}>🏭 {r.supplier}</span><span style={{ color:"#888", fontSize:12 }}>por {r.receivedBy}</span></div>
              <span style={{ color:"#666", fontSize:12 }}>{fmtDate(r.date)}</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{["Producto","Cantidad","Costo Unit.","Total costo","Nuevo"].map(h=><th key={h} style={{ ...th, fontSize:11 }}>{h}</th>)}</tr></thead>
              <tbody>{r.items.map((it,i)=>(
                <tr key={i} style={{ borderBottom:"1px solid #1a1a30" }}>
                  <td style={td}>{it.productName}</td><td style={td}>{it.qty}</td><td style={td}>{fmt(it.costUnit)}</td>
                  <td style={{ ...td, color:"#f0b429" }}>{fmt(it.costUnit*it.qty)}</td>
                  <td style={td}>{it.isNew?<span style={{ color:"#2ecc71", fontSize:12 }}>✓</span>:"—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ))
      }
    </div>
  );
}

// ── INVENTORY VIEW ────────────────────────────────────────────────────────────
function InventoryView({ products, stockMap }) {
  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ color:"#666", fontSize:13, marginBottom:16 }}>Stock = ingresos acumulados − ventas acumuladas.</div>
      <div style={card}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Producto","Precio venta","Stock actual","Estado"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{products.map(p=>{ const stock=stockMap[p.id]||0; const [label,color]=stock<=0?["Sin stock","#e74c3c"]:stock<5?["Stock bajo","#f0b429"]:["OK","#2ecc71"]; return (
            <tr key={p.id} style={{ borderBottom:"1px solid #1a1a30" }}>
              <td style={td}>{p.name}</td><td style={{ ...td, color:"#f0b429" }}>{fmt(p.price)}</td>
              <td style={{ ...td, fontWeight:700, color }}>{stock}</td>
              <td style={td}><span style={{ background:stock<=0?"#2a1a1a":stock<5?"#2a1a00":"#1a2a1a", color, borderRadius:4, padding:"3px 10px", fontSize:12, fontWeight:600 }}>{label}</span></td>
            </tr>
          );})}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── CATALOG EDITOR ────────────────────────────────────────────────────────────
function CatalogEditor({ plans, setPlans, products, setProducts }) {
  const [tab, setTab] = useState("plans");
  const [form, setForm] = useState({ name:"", price:"", durationDays:"" });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const isP = tab==="products";
  const items = isP ? products : plans;
  const setItems = isP ? setProducts : setPlans;

  const save = async () => {
    if (!form.name.trim()||!form.price||saving) return;
    setSaving(true);
    const base = { name:form.name, price:+form.price, type:isP?"product":"plan", ...(!isP?{durationDays:+form.durationDays||30}:{}) };
    let updated;
    if (editId) updated = items.map(i=>i.id===editId?{...i,...base}:i);
    else updated = [...items, { id:Date.now().toString(), ...base }];
    await setItems(updated);
    setForm({name:"",price:"",durationDays:""}); setEditId(null); setSaving(false);
  };

  return (
    <div style={{ maxWidth:900 }}>
      <div style={{ color:"#666", fontSize:13, marginBottom:16 }}>Define productos y planes. El stock se gestiona desde Recepciones.</div>
      <div style={{ display:"flex", gap:4, marginBottom:16 }}>
        {[["plans","Planes"],["products","Productos"]].map(([k,l])=>(
          <button key={k} style={{ background:tab===k?"#f0b429":"#1a1a30", border:"1px solid "+(tab===k?"#f0b429":"#2a2a4a"), color:tab===k?"#0d0d1a":"#aaa", borderRadius:6, padding:"8px 16px", cursor:"pointer", fontSize:14, fontWeight:tab===k?700:400 }} onClick={()=>{setTab(k);setForm({name:"",price:"",durationDays:""});setEditId(null);}}>{l}</button>
        ))}
      </div>
      <div style={card}>
        <div style={cardT}>{editId?"Editar":"Agregar"} {isP?"Producto":"Plan"}</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <div style={{ flex:1 }}><div style={lbl}>Nombre</div><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
          <div style={{ width:140 }}><div style={lbl}>Precio venta</div><input style={inp} type="number" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} /></div>
          {!isP && <div style={{ width:120 }}><div style={lbl}>Duración (días)</div><input style={inp} type="number" placeholder="30" value={form.durationDays} onChange={e=>setForm(f=>({...f,durationDays:e.target.value}))} /></div>}
          <button style={btnP} onClick={save} disabled={saving}>{saving?"Guardando...":editId?"Guardar":"Agregar"}</button>
          {editId && <button style={btnG} onClick={()=>{setForm({name:"",price:"",durationDays:""});setEditId(null);}}>Cancelar</button>}
        </div>
      </div>
      <div style={card}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["Nombre","Precio",...(!isP?["Duración"]:[]),"Acciones"].map(h=><th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{items.map(item=>(
            <tr key={item.id} style={{ borderBottom:"1px solid #1a1a30" }}>
              <td style={td}>{item.name}</td>
              <td style={{ ...td, color:"#f0b429" }}>{fmt(item.price)}</td>
              {!isP && <td style={td}>{item.durationDays||30} días</td>}
              <td style={td}>
                <button style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:16, marginRight:6 }} onClick={()=>{setForm({name:item.name,price:item.price,durationDays:item.durationDays||""});setEditId(item.id);}}>✏️</button>
                <button style={{ background:"transparent", border:"none", cursor:"pointer", fontSize:16 }} onClick={()=>setItems(items.filter(i=>i.id!==item.id))}>🗑️</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────
function Settings({ ownerPin, setOwnerPin }) {
  const [current, setCurrent] = useState(""); const [newPin, setNewPin] = useState(""); const [confirm, setConfirm] = useState(""); const [msg, setMsg] = useState(null); const [saving, setSaving] = useState(false);
  const change = async () => {
    if (current!==ownerPin){setMsg({err:true,text:"PIN incorrecto"});return;}
    if (newPin.length<4){setMsg({err:true,text:"Mínimo 4 dígitos"});return;}
    if (newPin!==confirm){setMsg({err:true,text:"Los PINs no coinciden"});return;}
    setSaving(true); await setOwnerPin(newPin); setCurrent(""); setNewPin(""); setConfirm(""); setMsg({err:false,text:"PIN actualizado ✅"}); setSaving(false);
  };
  return (
    <div style={{ maxWidth:900 }}>
      <div style={card}>
        <div style={cardT}>⚙️ Cambiar PIN del Dueño</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10, maxWidth:300 }}>
          <input style={inp} type="password" placeholder="PIN actual" value={current} onChange={e=>setCurrent(e.target.value)} />
          <input style={inp} type="password" placeholder="Nuevo PIN" value={newPin} onChange={e=>setNewPin(e.target.value)} />
          <input style={inp} type="password" placeholder="Confirmar" value={confirm} onChange={e=>setConfirm(e.target.value)} />
          {msg && <div style={{ color:msg.err?"#e74c3c":"#2ecc71", fontSize:13 }}>{msg.text}</div>}
          <button style={btnP} onClick={change} disabled={saving}>{saving?"Guardando...":"Cambiar PIN"}</button>
        </div>
      </div>
      <div style={card}>
        <div style={cardT}>ℹ️ Información</div>
        <div style={{ color:"#aaa", fontSize:14, lineHeight:2 }}>
          <div>• Stock = ingresos − ventas (calculado automáticamente)</div>
          <div>• Alertas de vencimiento: 10 días antes</div>
          <div>• Descuentos en planes requieren PIN del dueño</div>
          <div>• PIN por defecto: <strong style={{ color:"#f0b429" }}>1234</strong></div>
        </div>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const inp  = { background:"#1a1a30", border:"1px solid #2a2a4a", borderRadius:8, padding:"10px 14px", color:"#fff", fontSize:14, outline:"none", width:"100%", boxSizing:"border-box" };
const btnP = { background:"#f0b429", color:"#0d0d1a", border:"none", borderRadius:8, padding:"12px 20px", fontWeight:700, cursor:"pointer", fontSize:14 };
const btnG = { background:"transparent", color:"#aaa", border:"1px solid #2a2a4a", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:14 };
const rBtn = { padding:"16px 20px", borderRadius:10, border:"1px solid #2a2a4a", color:"#fff", cursor:"pointer", fontSize:16, fontWeight:600, display:"flex", alignItems:"center", gap:12 };
const lbl  = { color:"#aaa", fontSize:12, fontWeight:600, letterSpacing:0.5, marginBottom:6, display:"block" };
const hdr  = { background:"#13132a", borderBottom:"1px solid #1e1e3a", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" };
const logBtn = { background:"transparent", color:"#e74c3c", border:"1px solid #e74c3c", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:13 };
const qBtn = { background:"#2a2a4a", border:"none", color:"#fff", width:24, height:24, borderRadius:4, cursor:"pointer", fontSize:14 };
const tabBtn  = { background:"transparent", border:"1px solid #2a2a4a", color:"#aaa", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontSize:13 };
const tabBtnA = { background:"#f0b429", border:"1px solid #f0b429", color:"#0d0d1a", fontWeight:700 };
const card  = { background:"#13132a", border:"1px solid #1e1e3a", borderRadius:10, padding:20, marginBottom:16 };
const cardT = { fontSize:15, fontWeight:700, marginBottom:14, color:"#ccc" };
const th = { color:"#666", fontSize:12, fontWeight:600, textAlign:"left", padding:"8px 10px", borderBottom:"1px solid #1e1e3a" };
const td = { padding:"10px", fontSize:14, color:"#ccc" };
