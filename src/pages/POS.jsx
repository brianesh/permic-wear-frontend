import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { salesAPI, tumaAPI, productsAPI, categoriesAPI } from "../services/api";
import { queueSale, updateCachedProductStock } from "../lib/offlineDB";
import { useModalBackButton, useBackHistory } from "../lib/useBackHistory";

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`;
const num = v => parseInt(v, 10) || 0;
const CLOTH_ICONS = { "Shirts":"👔","T-Shirts":"👕","Vests":"🎽","Belts":"🔗","Trousers":"👖","Shorts":"🩳","Jeans":"👖","Hoodies":"🧥","Jackets":"🧥","Caps":"🧢","Tracksuits":"🩱" };
const stockC = s => s > 10 ? "var(--teal)" : s > 0 ? "var(--gold)" : "#e74c3c";

// Size ordering for clothes - ensures XL comes before 2XL, etc.
const CLOTH_SIZE_ORDER = ["XS","S","M","L","XL","2XL","3XL","4XL","5XL","6XL"];
const compareSizes = (a, b) => {
  const na = parseFloat(a.size), nb = parseFloat(b.size);
  if (!isNaN(na) && !isNaN(nb)) return na - nb; // Numeric sizes (shoes, waist) - ascending
  const ia = CLOTH_SIZE_ORDER.indexOf(a.size), ib = CLOTH_SIZE_ORDER.indexOf(b.size);
  if (ia !== -1 && ib !== -1) return ia - ib; // Known cloth sizes - ordered
  return String(a.size).localeCompare(String(b.size)); // Fallback
};

function calcItem(item, rate) {
  const st = item.sellingPrice * item.qty, mt = item.minPrice * item.qty;
  const ep = st > mt ? st - mt : 0;
  return { extraProfit: ep, commission: ep > 0 ? Math.round(ep * rate / 100) : 0 };
}

function printReceipt(receipt, store = {}) {
  const nm = store.store_name || "Permic Men's Wear";
  const lc = store.store_location || "Ruiru, Kenya";
  const ph = store.store_phone || "+254 706 505008";
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(`PERMIC:${receipt.txn}:${receipt.subtotal}`)}`;
  const rows = receipt.items.map(c => `<tr><td><b>${c.name}</b><br/><small>SKU:${c.sku} Sz:${c.size}</small></td><td style="text-align:center">${c.qty}</td><td style="text-align:right">KES ${((c.sellingPrice || num(c.sellingPrice)) * c.qty).toLocaleString()}</td></tr>`).join("");
  const w = window.open("", "_blank", "width=380,height=650");
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:monospace;font-size:12px;width:300px;margin:0 auto;padding:16px}h2{text-align:center;font-size:15px;margin:0 0 2px}.c{text-align:center;color:#555;font-size:10px;margin-bottom:10px}table{width:100%;border-collapse:collapse}td{padding:3px 2px;vertical-align:top}hr{border:none;border-top:1px dashed #bbb;margin:7px 0}.f{text-align:center;font-size:10px;color:#888;margin-top:12px}.q{text-align:center;margin:10px 0}</style></head><body>
  <h2>🏪 ${nm}</h2><div class="c">${lc} · ${ph}<br/>${receipt.date.toLocaleString("en-KE")}<br/><b>${receipt.txn}</b> · ${receipt.cashier}</div>
  <hr/><table><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amt</th></tr>${rows}</table><hr/>
  <table>
    <tr><td colspan="2"><b>TOTAL</b></td><td style="text-align:right"><b>KES ${receipt.subtotal.toLocaleString()}</b></td></tr>
    <tr><td colspan="2">Payment</td><td style="text-align:right">${receipt.method}</td></tr>
    ${(receipt.method === "Cash" || receipt.method === "Split") ? `<tr><td colspan="2">Paid</td><td style="text-align:right">KES ${(receipt.amountPaid || 0).toLocaleString()}</td></tr><tr><td colspan="2"><b>Change</b></td><td style="text-align:right"><b>KES ${(receipt.change || 0).toLocaleString()}</b></td></tr>` : ""}
    ${receipt.paymentRef ? `<tr><td colspan="2">M-Pesa Ref</td><td style="text-align:right;color:#1565c0">${receipt.paymentRef}</td></tr>` : ""}
    ${receipt.customerPhone ? `<tr><td colspan="2">Phone</td><td style="text-align:right">${receipt.customerPhone}</td></tr>` : ""}
  </table>
  <div class="q"><img src="${qr}" width="80" height="80"/><br/><small>Scan to verify · ${receipt.txn}</small></div>
  <div class="f">Thank you for shopping at ${nm}!</div></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 500);
}

function useCategoryNav(pushHistory) {
  const [topType, setTopType] = useState(null);
  const [brands, setBrands] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [selBrand, setSelBrand] = useState(null);
  const [selSubtype, setSelSubtype] = useState(null);
  const [loading, setLoading] = useState(false);
  const goTop = () => { setTopType(null); setSelBrand(null); setSelSubtype(null); setBrands([]); setSubtypes([]); };
  const goBrands = tt => {
    setTopType(tt); setSelBrand(null); setSelSubtype(null); setSubtypes([]); setLoading(true);
    if (pushHistory) pushHistory(`category-brands-${tt}`);
    categoriesAPI.getBrands({ top_type: tt }).then(r => setBrands(r.data || [])).catch(() => setBrands([])).finally(() => setLoading(false));
  };
  const goSubtypes = b => {
    setSelBrand(b); setSelSubtype(null);
    if (b?.top_type === "shoes") {
      setLoading(true);
      if (pushHistory) pushHistory(`category-subtypes-${b.id}`);
      categoriesAPI.getSubtypes({ brand_id: b.id }).then(r => setSubtypes(r.data || [])).catch(() => setSubtypes([])).finally(() => setLoading(false));
    } else {
      // For clothes, brand IS the type - go straight to products
      setSubtypes([]);
    }
  };
  // For clothes: check if we should go directly to products (no subtypes)
  const shouldSkipSubtypes = topType === "clothes" && selBrand !== null;
  const selectSubtype = st => {
    setSelSubtype(st);
    if (pushHistory) pushHistory(`category-products-${st.id}`);
  };
  const goBack = () => {
    const level = topType === null ? "top" : selBrand === null ? "brands" : (topType === "shoes" && selSubtype === null) ? "subtypes" : "products";
    if (level === "products") { setSelSubtype(null); }
    else if (level === "subtypes") { setSelBrand(null); setSelSubtype(null); }
    else if (level === "brands") { goTop(); }
  };
  // For clothes, skip subtypes level and go directly to products after selecting a brand
  const level = topType === null ? "top" : selBrand === null ? "brands" : shouldSkipSubtypes ? "products" : (selSubtype === null ? "subtypes" : "products");
  return { topType, brands, subtypes, selBrand, selSubtype, setSelSubtype: selectSubtype, level, loading, goTop, goBrands, goSubtypes, goBack, shouldSkipSubtypes };
}

export default function POS() {
  const { user, commissionRate, isOnline, refreshPendingCount } = useAuth();
  const store = useStore();
  const { pushHistory } = useBackHistory('pos', () => {}, 'pos');
  const cat = useCategoryNav(pushHistory);

  const [catalog, setCatalog] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [payMethod, setPayMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [tumaStep, setTumaStep] = useState(null);
  const [tumaError, setTumaError] = useState("");
  const [payRef, setPayRef] = useState("");
  const [checkoutId, setCheckoutId] = useState(null);
  const [countdown, setCountdown] = useState(90);
  const [receipt, setReceipt] = useState(null);
  const [checkoutErr, setCheckoutErr] = useState("");
  const [activeTab, setActiveTab] = useState("search");
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [skuInput, setSkuInput] = useState("");
  const [skuErr, setSkuErr] = useState("");

  const pollRef = useRef(null);
  const cdRef = useRef(null);
  const saleCommRef = useRef(0);
  const pendingSaleRef = useRef(null);
  const lastItemsRef = useRef([]);
  const searchRef = useRef(null);
  const skuRef = useRef(null);
  const debRef = useRef(null);

  useModalBackButton(!!tumaStep, () => { if (tumaStep !== "confirming") setTumaStep(null); });
  useModalBackButton(!!receipt, () => setReceipt(null));

  useEffect(() => {
    productsAPI.getFavorites({ in_stock: "true" }).then(r => setFavorites(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const items = JSON.parse(sessionStorage.getItem("pos_quick_add") || "[]");
      if (items.length) { items.forEach(p => addToCart({ ...p, minPrice: parseFloat(p.min_price) })); sessionStorage.removeItem("pos_quick_add"); }
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (cat.level !== "products") { setCatalog([]); return; }
    setCatLoading(true);
    const p = cat.topType === "shoes" ? { sub_type_id: cat.selSubtype.id } : { brand_id: cat.selBrand.id };
    productsAPI.getAll(p).then(r => setCatalog(r.data || [])).catch(() => setCatalog([])).finally(() => setCatLoading(false));
  }, [cat.level, cat.selSubtype?.id, cat.selBrand?.id]);

  useEffect(() => {
    clearTimeout(debRef.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    setSearching(true);
    debRef.current = setTimeout(async () => {
      try { const r = await productsAPI.search(searchQ.trim(), { in_stock: "false" }); setSearchResults(r.data || []); }
      catch (_) { setSearchResults([]); } finally { setSearching(false); }
    }, 180);
    return () => clearTimeout(debRef.current);
  }, [searchQ]);

  useEffect(() => {
    const fn = e => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) {
        e.preventDefault(); setActiveTab("search"); setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  const addToCart = useCallback(item => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) { if (ex.qty >= item.stock) return prev; return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c); }
      return [...prev, { ...item, qty: 1, sellingPrice: "", minPrice: parseFloat(item.min_price || item.minPrice || 0) }];
    });
    setSearchQ("");
  }, []);

  const removeFromCart = id => setCart(p => p.filter(c => c.id !== id));
  const changeQty = (id, d) => setCart(p => p.map(c => { if (c.id !== id) return c; const q = c.qty + d; if (q < 1 || q > c.stock) return c; return { ...c, qty: q }; }));
  const setSP = (id, v) => setCart(p => p.map(c => c.id === id ? { ...c, sellingPrice: v } : c));
  const validateSP = id => setCart(p => p.map(c => { if (c.id !== id) return c; const n = num(c.sellingPrice); return { ...c, sellingPrice: n < c.minPrice ? c.minPrice : n }; }));

  const addBySKU = async () => {
    const sku = skuInput.trim().toUpperCase(); if (!sku) return; setSkuErr("");
    try {
      const r = await productsAPI.search(sku, { in_stock: "false" });
      const m = (r.data || []).find(p => p.sku.toUpperCase() === sku);
      if (m) { addToCart({ ...m, minPrice: parseFloat(m.min_price) }); setSkuInput(""); skuRef.current?.focus(); }
      else setSkuErr(`SKU "${sku}" not found`);
    } catch (_) { setSkuErr("Search failed"); }
  };

  const applyStockDed = items => setCatalog(p => p.map(pr => { const l = items.find(i => i.product_id === pr.id); return l ? { ...pr, stock: Math.max(0, (parseInt(pr.stock, 10) || 0) - l.qty) } : pr; }));

  // Error code to user-friendly message mapping
  const getErrorMessage = (code) => {
    const messages = {
      1: "Insufficient balance in customer's M-Pesa account",
      1032: "Customer cancelled the payment request",
      1037: "Phone unreachable - check if phone is on and has network",
      1038: "Phone switched off or out of coverage area",
      1039: "Network timeout - please try again",
      1040: "Invalid phone number or format",
      1041: "Customer not opted in for M-Pesa services",
    };
    return messages[code] || `Payment failed (code: ${code})`;
  };

  const startPoll = cid => {
    let att = 0;
    const maxAttempts = 30; // 30 attempts * 4s = 120s max wait
    const pollInterval = 4000; // Poll every 4 seconds (reduced from 2.5s)
    
    const tick = async () => {
      att++;
      try {
        const r = await tumaAPI.getStatus(cid);
        const { status, payment_ref, error_code, error_message } = r.data;
        
        if (status === "success") { 
          clearInterval(pollRef.current); 
          setPayRef(payment_ref || ""); 
          applyStockDed(lastItemsRef.current || []); 
          setTumaStep("confirmed"); 
          return; 
        }
        if (status === "failed") { 
          clearInterval(pollRef.current); 
          setTumaError(getErrorMessage(error_code || 0));
          setTumaStep("failed"); 
          return; 
        }
        if (status === "timeout") { 
          clearInterval(pollRef.current); 
          setTumaStep("timeout"); 
          return; 
        }
        if (att >= maxAttempts) { 
          clearInterval(pollRef.current); 
          setTumaStep("timeout"); 
        }
      } catch (err) { 
        console.error('[Poll Error]', err.message);
        if (att >= maxAttempts) { 
          clearInterval(pollRef.current); 
          setTumaStep("timeout"); 
        }
      }
    };
    pollRef.current = setInterval(tick, pollInterval);
  };

  useEffect(() => {
    if (tumaStep === "confirming") {
      setCountdown(90);
      cdRef.current = setInterval(() => setCountdown(s => s <= 1 ? (clearInterval(cdRef.current), 0) : s - 1), 1000);
    } else clearInterval(cdRef.current);
    return () => clearInterval(cdRef.current);
  }, [tumaStep]);
  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(cdRef.current); }, []);

  const cartReady = cart.filter(c => num(c.sellingPrice) >= c.minPrice);
  const subtotal = cartReady.reduce((s, c) => s + num(c.sellingPrice) * c.qty, 0);
  const totalComm = cartReady.reduce((s, c) => s + calcItem({ ...c, sellingPrice: num(c.sellingPrice) }, commissionRate).commission, 0);
  const paidAmt = num(amountPaid);
  const change = paidAmt - subtotal;
  const allPriced = cart.length > 0 && cart.every(c => num(c.sellingPrice) >= c.minPrice);

  const doCheckout = async method => {
    const items = cart.map(c => ({ product_id: c.id, qty: c.qty, selling_price: num(c.sellingPrice) }));
    setCheckoutErr("");
    if (!isOnline) {
      const lid = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await queueSale({ localId: lid, items, payment_method: method, amount_paid: paidAmt, cashier_id: user?.id, cashier_name: user?.name, commission: totalComm, createdAt: new Date().toISOString() });
      for (const l of items) await updateCachedProductStock(l.product_id, l.qty);
      applyStockDed(items); if (refreshPendingCount) refreshPendingCount();
      setReceipt({ txn: lid, items: cart.map(c => ({ ...c, sellingPrice: num(c.sellingPrice) })), subtotal, method, amountPaid: paidAmt, change: Math.max(0, paidAmt - subtotal), date: new Date(), cashier: user?.name, paymentRef: "", cashierCommission: totalComm, isOffline: true, customerPhone: "" });
      setCart([]); setAmountPaid(""); setMpesaPhone(""); return;
    }
    try {
      const mp = method === "Split" ? Math.max(0, subtotal - paidAmt) : 0;
      const r = await salesAPI.create({ items, payment_method: method, amount_paid: paidAmt, mpesa_phone: mpesaPhone || undefined, mpesa_portion: mp || undefined });
      const { txn_id, selling_total, change_given, commission, sale_id } = r.data;
      saleCommRef.current = Number(commission) || 0;
      pendingSaleRef.current = (method === "M-Pesa" || (method === "Split" && mp > 0)) && sale_id ? sale_id : null;
      if (method === "M-Pesa" || (method === "Split" && mp > 0)) lastItemsRef.current = items;
      else applyStockDed(items);

      if ((method === "M-Pesa" || (method === "Split" && mp > 0)) && mpesaPhone) {
        try {
          const sr = await tumaAPI.stkPush(sale_id, mpesaPhone, method === "Split" ? mp : selling_total);
          // Use the reference from backend (always available) for polling
          const reference = sr.data?.reference || sr.data?.checkout_request_id;
          if (!reference) {
            console.error('[Tuma] No reference in response:', sr.data);
            setCheckoutErr("STK push response missing reference. Please check backend logs.");
            setTumaStep(null);
            return;
          }
          setCheckoutId(reference);
          setTumaStep("confirming");
          startPoll(reference);
        } catch (e) {
          const msg = e.response?.data?.error || e.message || "STK push failed";
          console.error('[Tuma STK Error]', msg, e.response?.data);
          setCheckoutErr(msg.includes("STK_CANCEL_BLOCKED") ? "🚫 This number is blocked due to repeated cancellations. Contact support." : msg);
          setTumaStep(null);
        }
        return;
      }
      for (const l of items) productsAPI.recordUsed(l.product_id);
      setReceipt({ txn: txn_id, items: cart.map(c => ({ ...c, sellingPrice: num(c.sellingPrice) })), subtotal: selling_total, method, amountPaid: paidAmt, change: Math.max(0, change_given), date: new Date(), cashier: user?.name, paymentRef: "", cashierCommission: Number(commission) || totalComm, isOffline: false, customerPhone: mpesaPhone || "" });
      setCart([]); setAmountPaid(""); setMpesaPhone("");
    } catch (e) { setCheckoutErr(e.response?.data?.error || "Sale failed. Please try again."); }
  };

  const completeTuma = async () => {
    clearInterval(pollRef.current);
    const saleId = pendingSaleRef.current, cid = checkoutId, ref = payRef.trim();
    let finalRef = ref;
    try {
      if (ref) {
        const result = await tumaAPI.confirmByRef(cid, saleId, ref);
        finalRef = result.data?.payment_ref || ref;
      } else {
        const result = await tumaAPI.confirmManual(cid, saleId);
        finalRef = result.data?.payment_ref || `MANUAL-${Date.now()}`;
      }
      applyStockDed(lastItemsRef.current || []); lastItemsRef.current = [];
    } catch (e) {
      const m = e.response?.data?.error || "";
      if (!m.includes("completed")) console.warn("[tuma]", m);
      // Generate a reference if we don't have one
      if (!finalRef) finalRef = `TUMA-${Date.now()}`;
    }
    pendingSaleRef.current = null;
    setReceipt({ txn: finalRef, items: cart.map(c => ({ ...c, sellingPrice: num(c.sellingPrice) })), subtotal, method: "M-Pesa", amountPaid: subtotal, change: 0, date: new Date(), cashier: user?.name, paymentRef: finalRef, cashierCommission: saleCommRef.current || totalComm, isOffline: false, customerPhone: mpesaPhone });
    setCart([]); setAmountPaid(""); setMpesaPhone(""); setTumaStep(null); setCheckoutId(null); setPayRef("");
  };

  const checkout = () => {
    if (!allPriced) return;
    if (payMethod === "cash" && paidAmt < subtotal) return;
    if (payMethod === "split" && paidAmt <= 0) return;
    if (payMethod === "cash") { doCheckout("Cash"); return; }
    setTumaStep("preview"); // Show confirmation before STK
  };

  // Tuma overlay
  if (tumaStep) return (
    <div className="pos-page"><div className="mpesa-overlay"><div className="mpesa-modal">
      {tumaStep === "preview" && <>
        <div className="mpesa-title" style={{ marginBottom: 16 }}>Confirm Payment</div>
        <div style={{ textAlign: "center", margin: "8px 0" }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>
            Pay {fmt(payMethod === "split" ? Math.max(0, subtotal - paidAmt) : subtotal)}
          </div>
          <div style={{ fontSize: 14, color: "var(--text2)" }}>
            Business: <strong>PERMIC MEN'S WEAR</strong>
          </div>
        </div>
        <div className="mpesa-preview-note">
          Note: You will see <strong>TUMA ONLINE</strong> on your phone
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button className="pos-checkout-btn" style={{ flex: 1, background: "var(--bg3)", color: "var(--text1)", border: "1px solid var(--border)" }} onClick={() => setTumaStep(null)}>Cancel</button>
          <button className="pos-checkout-btn" style={{ flex: 1 }} onClick={() => { setTumaStep("sending"); setTimeout(() => doCheckout(payMethod === "mpesa" ? "M-Pesa" : "Split"), 800); }}>Proceed with Payment</button>
        </div>
      </>}
      {tumaStep === "sending" && <><div className="mpesa-spinner" /><div className="mpesa-title">Sending STK Push…</div><div className="mpesa-sub">Requesting M-Pesa payment</div></>}
      {tumaStep === "confirming" && <>
        <div className="mpesa-spinner" />
        <div className="mpesa-title">Awaiting Payment</div>
        <div className="mpesa-sub">STK push sent to <strong>{mpesaPhone}</strong> ({countdown}s)</div>
        <div className="mpesa-manual-ref-section">
          <div className="mpesa-alt-note">Enter M-Pesa receipt code from customer's SMS:</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, width: "100%" }}>
            <input className="pos-cash-input" style={{ flex: 1, textTransform: "uppercase", letterSpacing: 1 }} placeholder="e.g. RBK7X4Y2PQ" value={payRef} onChange={e => setPayRef(e.target.value.toUpperCase())} />
            <button className="pos-checkout-btn" style={{ background: "var(--green)", color: "#000", padding: "0 16px", flexShrink: 0 }} disabled={!payRef.trim()} onClick={completeTuma}>✓ Confirm</button>
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text3)", textAlign: "center" }}>— OR wait for automatic confirmation —</div>
          <button className="pos-checkout-btn" style={{ marginTop: 4, background: "var(--bg3)", color: "var(--text1)", border: "1px solid var(--border)", width: "100%" }} onClick={completeTuma}>✓ Confirm Manually</button>
        </div>
        <button style={{ marginTop: 8, width: "100%", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 13 }} onClick={() => { clearInterval(pollRef.current); setTumaStep(null); }}>Cancel Sale</button>
      </>}
      {tumaStep === "confirmed" && <>
        <div className="mpesa-success-icon">✓</div>
        <div className="mpesa-title">Payment Confirmed!</div>
        <div className="mpesa-sub">
          {mpesaPhone && <div style={{ marginBottom: 4 }}>Customer: <strong>{mpesaPhone}</strong></div>}
          <div>Ref: <strong>{payRef || "Processing..."}</strong></div>
        </div>
        <button className="pos-checkout-btn" style={{ marginTop: 16 }} onClick={completeTuma}>Continue → Receipt</button>
      </>}
      {(tumaStep === "failed" || tumaStep === "timeout") && <>
        <div className="mpesa-fail-icon">✕</div>
        <div className="mpesa-title">{tumaStep === "timeout" ? "Payment Timed Out" : "Payment Failed"}</div>
        <div className="mpesa-sub" style={{ color: "var(--red)", fontSize: 13 }}>
          {tumaError || "Customer may have cancelled or not responded."}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="pos-checkout-btn" style={{ flex: 1, background: "var(--bg3)", color: "var(--text1)", border: "1px solid var(--border)" }} onClick={() => { setTumaStep(null); setTumaError(""); }}>Back to Cart</button>
          <button className="pos-checkout-btn" style={{ flex: 1, background: "var(--green)", color: "#000" }} onClick={() => { setTumaStep(null); setTumaError(""); checkout(); }}>🔄 Retry Payment</button>
          <button className="pos-checkout-btn" style={{ flex: 1, background: "var(--gold)", color: "#000" }} onClick={completeTuma}>Mark Paid</button>
        </div>
      </>}
    </div></div></div>
  );

  // Receipt
  if (receipt) return (
    <div className="pos-page"><div className="receipt-overlay"><div className="receipt-card">
      <div className="receipt-header">
        <div className="receipt-logo">PW</div>
        <div style={{textAlign:"center"}}><div className="receipt-title">{store.store_name || "Permic Men's Wear"}</div><div className="receipt-sub">{store.store_location} · {receipt.date.toLocaleString("en-KE")}</div></div>
        <div className="receipt-check">✓</div>
      </div>
      <div className="receipt-txn" style={{textAlign:"center"}}>{receipt.txn}</div>
      <div className="receipt-cashier" style={{textAlign:"center"}}>Served by: {receipt.cashier}</div>
      {receipt.isOffline && <div className="receipt-offline-badge">📴 Saved offline — syncs on reconnect</div>}
      <div className="receipt-items">
        {receipt.items.map((c, i) => (
          <div key={i} className="receipt-item">
            <span>{c.name} Sz{c.size} × {c.qty}</span>
            <span className="receipt-item-price">{fmt((c.sellingPrice || num(c.sellingPrice)) * c.qty)}</span>
          </div>
        ))}
      </div>
      <div className="receipt-divider" />
      <div className="receipt-row"><span>Total</span><strong>{fmt(receipt.subtotal)}</strong></div>
      <div className="receipt-row"><span>Method</span><span className={`method-tag method-tag--${receipt.method === "Cash" ? "cash" : receipt.method === "M-Pesa" ? "m-pesa" : "split"}`}>{receipt.method}</span></div>
      {(receipt.method === "Cash" || receipt.method === "Split") && <>
        <div className="receipt-row"><span>Amount Paid</span><span>{fmt(receipt.amountPaid)}</span></div>
        <div className="receipt-row"><span>Change</span><strong style={{ color: "var(--green)" }}>{fmt(receipt.change)}</strong></div>
      </>}
      {receipt.paymentRef && <div className="receipt-row"><span>M-Pesa Ref</span><span style={{ color: "var(--teal)", fontWeight: 600 }}>{receipt.paymentRef}</span></div>}
      {receipt.customerPhone && <div className="receipt-row"><span>Phone</span><span>{receipt.customerPhone}</span></div>}
      {(receipt.cashierCommission ?? 0) > 0 && <div className="receipt-commission-screen">💰 Your commission: <strong>{fmt(receipt.cashierCommission)}</strong></div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="pos-checkout-btn" style={{ flex: 1, background: "var(--bg3)", color: "var(--text1)", border: "1px solid var(--border)" }} onClick={() => printReceipt(receipt, store)}>🖨 Print</button>
        <button className="pos-checkout-btn" style={{ flex: 1 }} onClick={() => setReceipt(null)}>New Sale ↩</button>
      </div>
    </div></div></div>
  );

  // Main layout
  return (
    <div className="pos-page">
      <div className="pos-header">
        <h1 className="page-title">Point of Sale</h1>
        <p className="page-sub">Cashier: <strong>{user?.name}</strong> · {new Date().toLocaleDateString("en-KE")} · Commission: {commissionRate}%</p>
      </div>

      <div className="pos-layout">
        {/* Product Browser */}
        <div className="pos-products">
          <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "var(--bg3)", borderRadius: 10, padding: 4 }}>
            {[["search", "🔍 Search"], ["sku", "📷 SKU/Scan"], ["category", "📂 Browse"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{ flex: 1, padding: "7px 4px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: activeTab === id ? "var(--bg1)" : "transparent", color: activeTab === id ? "var(--text1)" : "var(--text3)", boxShadow: activeTab === id ? "0 1px 4px rgba(0,0,0,.15)" : "none", transition: "all .15s" }}>{lbl}</button>
            ))}
          </div>

          {activeTab === "search" && (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", background: "var(--bg2)", border: "2px solid var(--border)", borderRadius: 10, padding: "8px 12px", marginBottom: 10 }}>
                <span>🔍</span>
                <input ref={searchRef} value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Name, brand, color, size… (press /)" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--text1)", fontSize: 15 }} />
                {searching && <span style={{ color: "var(--text3)", fontSize: 12 }}>…</span>}
                {searchQ && <button onClick={() => setSearchQ("")} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16 }}>✕</button>}
              </div>
              {searchQ ? (
                <div style={{ background: "var(--bg2)", borderRadius: 10, border: "1px solid var(--border)", overflow: "hidden" }}>
                  {searchResults.length === 0 && !searching && <div style={{ padding: 16, textAlign: "center", color: "var(--text3)" }}>No results for "{searchQ}"</div>}
                  {searchResults.map(p => (
                    <div key={p.id} onClick={() => addToCart({ ...p, minPrice: parseFloat(p.min_price) })} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, overflow: "hidden" }}>
                        {p.photo_url ? <img src={p.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} /> : (p.top_type === "shoes" ? "👟" : "👔")}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text1)" }}>{p.name}{p.fav_count > 0 && <span style={{ color: "var(--gold)", fontSize: 10, marginLeft: 4 }}>★</span>}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{p.brand} · Sz {p.size} · {p.color || "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)", fontFamily: "monospace" }}>{p.sku}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gold)" }}>{fmt(p.min_price)}</div>
                        <div style={{ fontSize: 11, color: stockC(p.stock) }}>{p.stock > 0 ? `${p.stock} left` : "Out"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : favorites.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 8, fontWeight: 600 }}>★ FREQUENT ITEMS</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8 }}>
                    {favorites.slice(0, 12).map(p => (
                      <div key={p.id} onClick={() => addToCart({ ...p, minPrice: parseFloat(p.min_price) })} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: 10, cursor: "pointer", textAlign: "center" }}>
                        <div style={{ fontSize: 26, marginBottom: 4 }}>{p.top_type === "shoes" ? "👟" : "👔"}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text1)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>Sz {p.size}</div>
                        <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>{fmt(p.min_price)}</div>
                        <div style={{ fontSize: 10, color: stockC(p.stock) }}>{p.stock} in stock</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "sku" && (
            <div>
              <div style={{ marginBottom: 12, padding: 12, background: "var(--bg2)", borderRadius: 10, fontSize: 13, color: "var(--text2)" }}>
                📷 Scan barcode or type SKU manually. Press <strong>Enter</strong> to add to cart.
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={skuRef} value={skuInput} onChange={e => { setSkuInput(e.target.value.toUpperCase()); setSkuErr(""); }} onKeyDown={e => { if (e.key === "Enter") addBySKU(); }}
                  placeholder="e.g. NK-AF1-WHT-40" autoFocus
                  style={{ flex: 1, padding: "10px 14px", background: "var(--bg2)", border: "2px solid var(--border)", borderRadius: 10, color: "var(--text1)", fontSize: 15, fontFamily: "monospace", letterSpacing: 1, outline: "none" }} />
                <button onClick={addBySKU} className="pos-checkout-btn" style={{ padding: "0 18px", flexShrink: 0 }}>Add</button>
              </div>
              {skuErr && <div style={{ marginTop: 8, color: "#e74c3c", fontSize: 13 }}>⚠ {skuErr}</div>}
            </div>
          )}

          {activeTab === "category" && (
            <>
              {cat.level === "top" && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {[{ t: "shoes", icon: "👟", lbl: "Shoes" }, { t: "clothes", icon: "👕", lbl: "Clothes" }].map(({ t, icon, lbl }) => (
                    <div key={t} style={{ flex: 1, minWidth: 140, cursor: "pointer", padding: 24, textAlign: "center", border: "2px solid var(--border)", borderRadius: 12, background: "var(--bg2)" }} onClick={() => cat.goBrands(t)}>
                      <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
              )}
              {cat.level === "brands" && (
                <><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}><button className="tbl-btn" onClick={cat.goTop}>← Back</button><span style={{ fontSize: 12, color: "var(--text3)" }}>{cat.topType === "shoes" ? "👟" : "👕"} › Brand</span></div>
                  {cat.loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--text3)" }}>Loading…</div> : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
                      {cat.brands.map(b => (
                        <div key={b.id} style={{ cursor: "pointer", padding: 14, textAlign: "center", border: "2px solid var(--border)", borderRadius: 10, background: "var(--bg2)" }} onClick={() => cat.goSubtypes(b)}>
                          <div style={{ fontSize: 30, marginBottom: 6 }}>{cat.topType === "shoes" ? "👟" : (CLOTH_ICONS[b.name] || "👕")}</div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{b.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {cat.level === "subtypes" && (
                <><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}><button className="tbl-btn" onClick={() => cat.goBrands(cat.topType)}>← Back</button><span style={{ fontSize: 12, color: "var(--text3)" }}>👟 {cat.selBrand?.name} › Model</span></div>
                  {cat.loading ? <div style={{ padding: 30, textAlign: "center", color: "var(--text3)" }}>Loading…</div> : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
                      {cat.subtypes.map(st => (
                        <div key={st.id} style={{ cursor: "pointer", padding: 14, textAlign: "center", border: "2px solid var(--border)", borderRadius: 10, background: "var(--bg2)" }} onClick={() => cat.setSelSubtype(st)}>
                          <div style={{ fontSize: 30, marginBottom: 6 }}>👟</div>
                          <div style={{ fontWeight: 700, fontSize: 12 }}>{st.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {cat.level === "products" && (
                <>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                    <button className="tbl-btn" onClick={() => { if (cat.topType === "shoes") cat.setSelSubtype(null); else cat.goBrands(cat.topType); setCatalog([]); }}>← Back</button>
                    <span style={{ fontSize: 12, color: "var(--text3)" }}>{cat.topType === "shoes" ? `👟 ${cat.selBrand?.name} › ${cat.selSubtype?.name}` : `👕 ${cat.selBrand?.name}`}</span>
                  </div>
                  {catLoading ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading…</div> : (() => {
                    const groups = {};
                    catalog.forEach(p => { const k = `${p.brand}__${p.name}`; if (!groups[k]) groups[k] = []; groups[k].push(p); });
                    const entries = Object.entries(groups);
                    if (!entries.length) return <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>No products found</div>;
                    return <div className="pos-grid">{entries.map(([key, vars]) => {
                      const rep = vars[0];
                      const sorted = [...vars].sort(compareSizes);
                      const minP = Math.min(...vars.map(v => parseFloat(v.min_price)));
                      const totS = vars.reduce((s, v) => s + v.stock, 0);
                      return (
                        <div key={key} className={`pos-product-card pos-product-card--grouped ${!totS ? "pos-product-card--out" : ""}`}>
                          {rep.photo_url ? <img src={rep.photo_url} alt={rep.name} className="pos-product-photo" /> : <div className="pos-product-photo-placeholder">{cat.topType === "clothes" ? (CLOTH_ICONS[rep.brand] || "👕") : "👟"}</div>}
                          <div className="pos-product-brand">{rep.brand}</div>
                          <div className="pos-product-name">{rep.name}</div>
                          {rep.color && <div className="pos-product-color">🎨 {rep.color}</div>}
                          <div className="pos-product-price-row"><span className="pos-product-price">Min: {fmt(minP)}</span><span className={`pos-product-stock ${totS <= 3 ? "pos-product-stock--low" : ""}`}>{totS}</span></div>
                          <div className="pos-size-label">SIZES</div>
                          <div className="pos-size-chips">
                            {sorted.map(v => {
                              const ic = cart.find(c => c.id === v.id);
                              const rem = v.stock - (ic?.qty || 0);
                              return <button key={v.id} className={["pos-size-chip", v.stock === 0 ? "pos-size-chip--out" : "", ic ? "pos-size-chip--active" : "", v.stock > 0 && rem <= 2 ? "pos-size-chip--low" : ""].filter(Boolean).join(" ")} disabled={v.stock === 0} onClick={() => { if (v.stock > 0) addToCart({ ...v, minPrice: parseFloat(v.min_price) }); }}>
                                <span className="pos-size-chip-sz">{v.size}</span>
                                <span className={`pos-size-chip-qty ${v.stock > 0 && rem <= 2 ? "pos-size-chip-qty--low" : ""}`}>{v.stock === 0 ? "✕" : ic ? `${rem}l` : `${v.stock}`}</span>
                              </button>;
                            })}
                          </div>
                        </div>
                      );
                    })}</div>;
                  })()}
                </>
              )}
            </>
          )}
        </div>

        {/* Cart */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <span className="card-title">Current Sale</span>
            {cart.length > 0 && <button className="link-btn" onClick={() => setCart([])}>Clear</button>}
          </div>
          {cart.length === 0
            ? <div className="pos-cart-empty"><div className="pos-cart-empty-icon">🛒</div><p>Search or scan a product to add</p></div>
            : <div className="pos-cart-items">
              {cart.map(item => {
                const sp = num(item.sellingPrice);
                const { extraProfit, commission } = calcItem({ ...item, sellingPrice: sp }, commissionRate);
                const belowMin = item.sellingPrice !== "" && sp < item.minPrice;
                return (
                  <div key={item.id} className="pos-cart-item">
                    <div className="pos-cart-item-info">
                      <div className="pos-cart-item-name">{item.name}</div>
                      <div className="pos-cart-item-meta">Sz {item.size} · {item.sku} · Min: {fmt(item.minPrice)}</div>
                      <div className="pos-selling-price-block">
                        <label className="pos-selling-label">Selling Price <span style={{ color: "var(--text3)", fontWeight: 400 }}>(per unit)</span></label>
                        <input className={`pos-selling-input ${belowMin ? "pos-selling-input--error" : sp > item.minPrice ? "pos-selling-input--upsell" : ""}`} type="number" placeholder={`Min ${item.minPrice}`} value={item.sellingPrice} onChange={e => setSP(item.id, e.target.value)} onBlur={() => validateSP(item.id)} />
                        {belowMin && <div className="pos-price-error">⚠ Cannot be less than {fmt(item.minPrice)}</div>}
                        {!belowMin && extraProfit > 0 && <div className="pos-commission-hint">💰 Extra: {fmt(extraProfit)} → Commission: <strong>{fmt(commission)}</strong></div>}
                      </div>
                    </div>
                    <div className="pos-cart-item-controls">
                      <button className="qty-btn" onClick={() => changeQty(item.id, -1)}>−</button>
                      <span className="qty-val">{item.qty}</span>
                      <button className="qty-btn" onClick={() => changeQty(item.id, 1)}>+</button>
                      <button className="qty-btn qty-btn--del" onClick={() => removeFromCart(item.id)}>✕</button>
                    </div>
                    <div className="pos-cart-item-total">{sp >= item.minPrice ? fmt(sp * item.qty) : "—"}</div>
                  </div>
                );
              })}
            </div>
          }
          <div className="pos-cart-footer">
            <div className="pos-subtotal"><span>Total</span><strong>{fmt(subtotal)}</strong></div>
            {totalComm > 0 && <div className="pos-commission-summary"><span>💰 Commission ({commissionRate}%)</span><strong style={{ color: "var(--gold)" }}>{fmt(totalComm)}</strong></div>}
            <div className="pos-pay-methods">
              {[["cash", "💵 Cash"], ["mpesa", "📱 M-Pesa"], ["split", "⚡ Split"]].map(([m, lbl]) => (
                <button key={m} className={`pos-pay-btn ${payMethod === m ? "pos-pay-btn--active" : ""} ${m === "mpesa" && !isOnline ? "pos-pay-btn--disabled" : ""}`} onClick={() => { if (m === "mpesa" && !isOnline) return; setPayMethod(m); }}>{lbl}{m === "mpesa" && !isOnline ? " (offline)" : ""}</button>
              ))}
            </div>
            {!isOnline && <div className="pos-offline-note"><span>📴</span> Offline — Cash & Split only. Syncs on reconnect.</div>}
            {payMethod === "cash" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Amount Paid (KES)</label>
                <input className="pos-cash-input" type="number" placeholder={`Min ${fmt(subtotal)}`} value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                {amountPaid && <div className={`pos-change-row ${change < 0 ? "pos-change-row--neg" : ""}`}><span>{change < 0 ? "Short by" : "Change"}</span><strong>{fmt(Math.abs(change))}</strong></div>}
              </div>
            )}
            {payMethod === "mpesa" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Customer Safaricom Number</label>
                <input className="pos-cash-input" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
                <div className="mpesa-paybill-card">
                  <div className="mpesa-paybill-row"><span>NCBA Paybill</span><strong>{store.ncba_shortcode || "880100"}</strong></div>
                  <div className="mpesa-paybill-row"><span>Account</span><strong>{store.ncba_account || "505008"}</strong></div>
                  <div className="mpesa-paybill-row"><span>Amount</span><strong>{fmt(subtotal)}</strong></div>
                </div>
              </div>
            )}
            {payMethod === "split" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Cash Portion (KES)</label>
                <input className="pos-cash-input" type="number" placeholder="Cash amount" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                {paidAmt > 0 && paidAmt < subtotal && (
                  <div className="pos-split-breakdown">
                    <div className="pos-split-row"><span>💵 Cash</span><strong>{fmt(paidAmt)}</strong></div>
                    <div className="pos-split-row pos-split-row--mpesa"><span>📱 M-Pesa STK</span><strong style={{ color: "var(--teal)" }}>{fmt(subtotal - paidAmt)}</strong></div>
                    <div className="pos-split-row pos-split-row--total"><span>Total</span><strong>{fmt(subtotal)}</strong></div>
                  </div>
                )}
                <label className="pos-cash-label" style={{ marginTop: 8 }}>Safaricom Number</label>
                <input className="pos-cash-input" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)} />
              </div>
            )}
            {checkoutErr && <div className="lf-error"><span>⚠</span> {checkoutErr}</div>}
            <button className="pos-checkout-btn"
              disabled={!allPriced || (payMethod === "cash" && paidAmt < subtotal) || (payMethod === "split" && paidAmt <= 0) || ((payMethod === "mpesa" || (payMethod === "split" && (subtotal - paidAmt) > 0)) && !mpesaPhone.trim())}
              onClick={checkout}>
              {!allPriced ? "Enter selling prices ↑" : payMethod === "split" && paidAmt > 0 && (subtotal - paidAmt) > 0 ? `Pay ${fmt(paidAmt)} Cash + ${fmt(subtotal - paidAmt)} M-Pesa` : `Complete Sale · ${fmt(subtotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
