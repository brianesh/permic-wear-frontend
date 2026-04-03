import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { salesAPI, mpesaAPI, productsAPI, categoriesAPI } from "../services/api";
import { queueSale, updateCachedProductStock } from "../lib/offlineDB";

const fmt = n => `KES ${Number(n||0).toLocaleString()}`;
const num = v => parseInt(v, 10) || 0;

const CLOTH_ICONS = {
  "Shirts":"👔","T-Shirts":"👕","Vests":"🎽","Belts":"🔗","Trousers":"👖","Shorts":"🩳",
  "Jeans":"👖","Hoodies":"🧥","Jackets":"🧥","Caps":"🧢","Tracksuits":"🩱",
};

function calcItem(item, rate) {
  const sellingTotal = item.sellingPrice * item.qty;
  const minTotal     = item.minPrice * item.qty;
  const extraProfit  = sellingTotal > minTotal ? sellingTotal - minTotal : 0;
  const commission   = extraProfit > 0 ? Math.round(extraProfit * rate / 100) : 0;
  return { sellingTotal, minTotal, extraProfit, commission };
}

function printReceipt(receipt, store = {}) {
  const storeName      = store.store_name      || "Permic Men's Wear";
  const storeLoc       = store.store_location  || "Ruiru, Kenya";
  const storePhone     = store.store_phone     || "+254 792 369700";
  const mpesaShortcode = store.mpesa_shortcode || "880100";
  const mpesaAccount   = store.mpesa_account   || "505008";

  const lines = receipt.items.map(c => `
    <tr>
      <td>${c.name} Sz${c.size}</td>
      <td style="text-align:center">${c.qty}</td>
      <td style="text-align:right">KES ${(c.sellingPrice * c.qty).toLocaleString()}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html><html><head><title>Receipt ${receipt.txn}</title>
  <style>
    body{font-family:monospace;font-size:13px;width:300px;margin:0 auto;padding:20px}
    h2{text-align:center;font-size:16px;margin:0 0 2px}
    .sub{text-align:center;color:#555;font-size:11px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse} td,th{padding:4px 2px;vertical-align:top}
    hr{border:none;border-top:1px dashed #ccc;margin:8px 0}
    .total{font-weight:bold;font-size:14px}
    .footer{text-align:center;font-size:11px;color:#888;margin-top:14px}
  </style></head><body>
  <h2>👗 ${storeName}</h2>
  <div class="sub">
    ${storeLoc} · ${storePhone}<br/>
    ${receipt.date.toLocaleString("en-KE")}<br/>
    TXN: ${receipt.txn} · Cashier: ${receipt.cashier}
  </div>
  <hr/>
  <table>
    <tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Amt</th></tr>
    ${lines}
  </table>
  <hr/>
  <table>
    <tr class="total"><td colspan="2">TOTAL</td><td style="text-align:right">KES ${receipt.subtotal.toLocaleString()}</td></tr>
    <tr><td colspan="2">Payment</td><td style="text-align:right">${receipt.method}</td></tr>
    ${receipt.method==="Cash"||receipt.method==="Split"
      ? `<tr><td colspan="2">Amount Paid</td><td style="text-align:right">KES ${(receipt.amountPaid||0).toLocaleString()}</td></tr>
         <tr><td colspan="2"><b>Change</b></td><td style="text-align:right"><b>KES ${(receipt.change||0).toLocaleString()}</b></td></tr>`
      : ""}
    ${receipt.method==="M-Pesa"&&receipt.mpesaRef
      ? `<tr><td colspan="2">M-Pesa Ref</td><td style="text-align:right">${receipt.mpesaRef}</td></tr>
         <tr><td colspan="2">Paybill</td><td style="text-align:right">${mpesaShortcode}</td></tr>
         <tr><td colspan="2">Account No.</td><td style="text-align:right">${mpesaAccount}</td></tr>`
      : ""}
  </table>
  <div class="footer">Thank you for shopping at ${storeName}!<br/>${storeLoc}</div>
  </body></html>`;

  const w = window.open("","_blank","width=420,height=600");
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 500);
}

// ── Category drill-down state machine ────────────────────────────
// level: "top" → "brand" → "subtype"(shoes only) → "products"
function useCategoryNav() {
  const [topType, setTopType]     = useState(null);
  const [brands, setBrands]       = useState([]);
  const [subtypes, setSubtypes]   = useState([]);
  const [selBrand, setSelBrand]   = useState(null);
  const [selSubtype, setSelSubtype] = useState(null);
  const [catLoading, setCatLoading] = useState(false);

  const goTop = () => { setTopType(null); setSelBrand(null); setSelSubtype(null); setBrands([]); setSubtypes([]); };
  const goBrands = tt => {
    setTopType(tt); setSelBrand(null); setSelSubtype(null); setSubtypes([]);
    setCatLoading(true);
    categoriesAPI.getBrands({ top_type: tt }).then(r => setBrands(r.data||[])).catch(()=>setBrands([])).finally(()=>setCatLoading(false));
  };
  const goSubtypes = brand => {
    setSelBrand(brand); setSelSubtype(null);
    if (brand.top_type === "shoes") {
      setCatLoading(true);
      categoriesAPI.getSubtypes({ brand_id: brand.id }).then(r => setSubtypes(r.data||[])).catch(()=>setSubtypes([])).finally(()=>setCatLoading(false));
    }
  };

  const level = topType === null ? "top"
    : selBrand === null ? "brands"
    : (topType === "shoes" && selSubtype === null) ? "subtypes"
    : "products";

  return { topType, brands, subtypes, selBrand, selSubtype, setSelSubtype, level, catLoading, goTop, goBrands, goSubtypes };
}

export default function POS() {
  const { user, commissionRate, isOnline, refreshPendingCount } = useAuth();
  const store = useStore();
  const cat = useCategoryNav();

  const [catalog, setCatalog]           = useState([]);
  const [catProductLoading, setCatProductLoading] = useState(false);
  const [search, setSearch]             = useState("");
  const [cart, setCart]                 = useState([]);
  const [payMethod, setPayMethod]       = useState("cash");
  const [amountPaid, setAmountPaid]     = useState("");
  const [mpesaPhone, setMpesaPhone]     = useState("");
  const [mpesaStep, setMpesaStep]       = useState(null);
  const [mpesaRef, setMpesaRef]         = useState("");
  const [mpesaCheckoutId, setMpesaCheckoutId] = useState(null);
  const [mpesaCountdown, setMpesaCountdown]   = useState(120);
  const [receipt, setReceipt]           = useState(null);
  const [checkoutErr, setCheckoutErr]   = useState("");
  const pollRef      = useRef(null);
  const countdownRef = useRef(null);
  const lastCreatedSaleCommissionRef = useRef(0);
  const lastPendingMpesaSaleIdRef = useRef(null);
  const lastItemsRef = useRef([]);

  // Load products when category drill-down reaches "products" level
  useEffect(() => {
    if (cat.level !== "products") { setCatalog([]); return; }
    setCatProductLoading(true);
    const params = cat.topType === "shoes"
      ? { sub_type_id: cat.selSubtype.id }
      : { brand_id: cat.selBrand.id };
    productsAPI.getAll(params)
      .then(r => setCatalog(r.data || []))
      .catch(() => setCatalog([]))
      .finally(() => setCatProductLoading(false));
  }, [cat.level, cat.selSubtype?.id, cat.selBrand?.id]);

  const filtered = catalog.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.brand.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = item => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id);
      if (ex) {
        if (ex.qty >= item.stock) return prev;
        return prev.map(c => c.id===item.id ? {...c, qty:c.qty+1} : c);
      }
      return [...prev, {...item, qty:1, sellingPrice:"", minPrice:parseFloat(item.min_price)}];
    });
  };

  const removeFromCart  = id => setCart(prev => prev.filter(c => c.id !== id));
  const changeQty       = (id, delta) => setCart(prev => prev.map(c => {
    if (c.id !== id) return c;
    const nq = c.qty + delta;
    if (nq < 1 || nq > c.stock) return c;
    return {...c, qty:nq};
  }));
  const setSellingPrice = (id, val) => setCart(prev => prev.map(c => c.id===id ? {...c, sellingPrice:val} : c));
  const validateSellingPrice = id => setCart(prev => prev.map(c => {
    if (c.id !== id) return c;
    const n = num(c.sellingPrice);
    return {...c, sellingPrice: n < c.minPrice ? c.minPrice : n};
  }));

  const cartReady       = cart.filter(c => num(c.sellingPrice) >= c.minPrice);
  const subtotal        = cartReady.reduce((s,c) => s + num(c.sellingPrice)*c.qty, 0);
  const totalCommission = cartReady.reduce((s,c) => s + calcItem({...c,sellingPrice:num(c.sellingPrice)}, commissionRate).commission, 0);
  const paidAmt         = num(amountPaid);
  const change          = paidAmt - subtotal;
  const allPriced       = cart.length > 0 && cart.every(c => num(c.sellingPrice) >= c.minPrice);

  const applyCatalogStockDeduction = items => {
    setCatalog(prev => prev.map(p => {
      const line = items.find(l => l.product_id === p.id);
      if (!line) return p;
      return {...p, stock: Math.max(0, (parseInt(p.stock,10)||0) - line.qty)};
    }));
  };

  // M-Pesa polling
  const startPolling = checkoutId => {
    let attempts = 0;
    const MAX = 50;
    const tick = async () => {
      attempts++;
      try {
        const res = await mpesaAPI.getStatus(checkoutId);
        const { status, mpesa_ref } = res.data;
        if (status === "success") {
          clearInterval(pollRef.current);
          setMpesaRef(mpesa_ref || "");
          applyCatalogStockDeduction(lastItemsRef.current || []);
          setMpesaStep("confirmed");
          return;
        }
        if (status === "failed") { clearInterval(pollRef.current); setMpesaStep("failed"); return; }
        if (attempts >= MAX) { clearInterval(pollRef.current); setMpesaStep("failed"); }
      } catch (_) {
        if (attempts >= MAX) { clearInterval(pollRef.current); setMpesaStep("failed"); }
      }
    };
    pollRef.current = setInterval(async () => {
      await tick();
      if (attempts === 15 && pollRef.current) { clearInterval(pollRef.current); pollRef.current = setInterval(tick, 4000); }
    }, 2000);
  };

  // Countdown timer
  useEffect(() => {
    if (mpesaStep === "confirming") {
      setMpesaCountdown(120);
      countdownRef.current = setInterval(() => setMpesaCountdown(s => { if (s <= 1) { clearInterval(countdownRef.current); return 0; } return s-1; }), 1000);
    } else {
      clearInterval(countdownRef.current);
    }
    return () => clearInterval(countdownRef.current);
  }, [mpesaStep]);

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(countdownRef.current); }, []);

  const doCheckout = async (method) => {
    const commissionSnapshot = cartReady.reduce((s,c) => s + calcItem({...c,sellingPrice:num(c.sellingPrice)}, commissionRate).commission, 0);
    const items = cart.map(c => ({ product_id: c.id, qty: c.qty, selling_price: num(c.sellingPrice) }));

    // Offline path
    if (!isOnline) {
      const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const offlineSale = { localId, items, payment_method: method, amount_paid: paidAmt, cashier_id: user?.id, cashier_name: user?.name, commission: commissionSnapshot, createdAt: new Date().toISOString() };
      await queueSale(offlineSale);
      for (const line of items) await updateCachedProductStock(line.product_id, line.qty);
      applyCatalogStockDeduction(items);
      if (refreshPendingCount) refreshPendingCount();
      setReceipt({ txn: localId, items: cart.map(c => ({...c, sellingPrice:num(c.sellingPrice)})), subtotal, method, amountPaid: paidAmt, change: Math.max(0, paidAmt-subtotal), date: new Date(), cashier: user?.name, mpesaRef: "", cashierCommission: commissionSnapshot, isOffline: true });
      setCart([]); setAmountPaid(""); setMpesaPhone("");
      return;
    }

    // Online path
    try {
      const mpesaPortion = method === "Split" ? Math.max(0, subtotal - paidAmt) : 0;
      const res = await salesAPI.create({ items, payment_method: method, amount_paid: paidAmt, mpesa_phone: mpesaPhone || undefined, mpesa_portion: mpesaPortion || undefined });
      const { txn_id, selling_total, change_given, commission, sale_id } = res.data;
      lastCreatedSaleCommissionRef.current = Number(commission) || 0;
      lastPendingMpesaSaleIdRef.current = (method==="M-Pesa"||(method==="Split"&&mpesaPortion>0)) && sale_id ? sale_id : null;

      if (method==="M-Pesa"||(method==="Split"&&mpesaPortion>0)) {
        lastItemsRef.current = items;
      } else {
        applyCatalogStockDeduction(items);
      }

      if (method === "M-Pesa" && mpesaPhone) {
        try {
          const stkRes = await mpesaAPI.stkPush(sale_id, mpesaPhone, selling_total);
          setMpesaCheckoutId(stkRes.data.checkout_request_id);
          setMpesaStep("confirming");
          startPolling(stkRes.data.checkout_request_id);
        } catch (stkErr) {
          setCheckoutErr(stkErr.response?.data?.error || stkErr.message || "STK push failed");
          setMpesaStep(null);
        }
        return;
      }

      if (method === "Split" && mpesaPortion > 0 && mpesaPhone) {
        try {
          const stkRes = await mpesaAPI.stkPush(sale_id, mpesaPhone, mpesaPortion);
          setMpesaCheckoutId(stkRes.data.checkout_request_id);
          setMpesaStep("confirming");
          startPolling(stkRes.data.checkout_request_id);
        } catch (stkErr) {
          setCheckoutErr(stkErr.response?.data?.error || stkErr.message || "STK push failed");
          setMpesaStep(null);
        }
        return;
      }

      // Cash or Split where cash covers full
      setReceipt({ txn: txn_id, items: cart.map(c=>({...c,sellingPrice:num(c.sellingPrice)})), subtotal: selling_total, method, amountPaid: paidAmt, change: Math.max(0, change_given), date: new Date(), cashier: user?.name, mpesaRef: "", cashierCommission: Number(commission||commissionSnapshot)||0, isOffline: false });
      setCart([]); setAmountPaid(""); setMpesaPhone("");

    } catch (err) {
      setCheckoutErr(err.response?.data?.error || "Sale failed. Please try again.");
      setMpesaStep(null);
    }
  };

  const completeMpesaSale = async () => {
    const saleId     = lastPendingMpesaSaleIdRef.current;
    const checkoutId = mpesaCheckoutId;
    const refCode    = mpesaRef.trim();
    clearInterval(pollRef.current);
    try {
      if (refCode) await mpesaAPI.confirmByRef(checkoutId, saleId, refCode);
      else         await mpesaAPI.confirmManual(checkoutId, saleId);
      applyCatalogStockDeduction(lastItemsRef.current || []);
      lastItemsRef.current = [];
    } catch (err) {
      const msg = err.response?.data?.error || '';
      if (!msg.includes('completed') && !msg.includes('Already')) console.warn('[completeMpesaSale] confirm error:', msg);
    }
    lastPendingMpesaSaleIdRef.current = null;
    const cashierComm = lastCreatedSaleCommissionRef.current || totalCommission;
    setReceipt({ txn: refCode || `TXN-MPE-${Date.now()}`, items: cart.map(c=>({...c,sellingPrice:num(c.sellingPrice)})), subtotal, method:"M-Pesa", amountPaid: subtotal, change: 0, date: new Date(), cashier: user?.name, mpesaRef: refCode, cashierCommission: cashierComm, isOffline: false });
    setCart([]); setAmountPaid(""); setMpesaPhone("");
    setMpesaStep(null); setMpesaCheckoutId(null); setMpesaRef("");
  };

  const checkout = () => {
    if (!allPriced) return;
    if (payMethod === "cash" && paidAmt < subtotal) return;
    if (payMethod === "mpesa") { setMpesaStep("sending"); setTimeout(() => doCheckout("M-Pesa"), 1000); return; }
    if (payMethod === "split") {
      if (paidAmt <= 0) return;
      const mpesaPortion = subtotal - paidAmt;
      if (mpesaPortion > 0 && !mpesaPhone) return;
      setMpesaStep("sending");
      setTimeout(() => doCheckout("Split"), 1000);
      return;
    }
    doCheckout("Cash");
  };

  // ── M-Pesa overlay ────────────────────────────────────────────
  if (mpesaStep) return (
    <div className="pos-page">
      <div className="mpesa-overlay">
        <div className="mpesa-modal">
          {mpesaStep === "sending" && (
            <><div className="mpesa-spinner"/><div className="mpesa-title">Sending STK Push…</div>
            <div className="mpesa-sub">{payMethod==="split" ? `Requesting KES ${fmt(subtotal-paidAmt)} via M-Pesa` : `Preparing M-Pesa for ${fmt(subtotal)}`}</div></>
          )}
          {mpesaStep === "confirming" && (
            <>
              <div className="mpesa-spinner"/>
              <div className="mpesa-title">Awaiting M-Pesa Confirmation</div>
              <div className="mpesa-sub">Waiting for payment on customer's phone… ({mpesaCountdown}s)</div>
              {payMethod === "split" && paidAmt > 0 && (
                <div className="pos-split-breakdown" style={{margin:"12px 0"}}>
                  <div className="pos-split-row"><span>💵 Cash collected</span><strong style={{color:"var(--green)"}}>{fmt(paidAmt)}</strong></div>
                  <div className="pos-split-row pos-split-row--mpesa"><span>📱 M-Pesa pending</span><strong style={{color:"var(--teal)"}}>{fmt(subtotal-paidAmt)}</strong></div>
                </div>
              )}
              <div className="mpesa-paybill-card">
                <div className="mpesa-paybill-row"><span>Paybill</span><strong>{store.mpesa_shortcode}</strong></div>
                <div className="mpesa-paybill-row"><span>Account No.</span><strong>{store.mpesa_account}</strong></div>
                <div className="mpesa-paybill-row"><span>Amount</span><strong>{fmt(payMethod==="split" ? Math.max(0,subtotal-paidAmt) : subtotal)}</strong></div>
              </div>

              {/* Enforce: must enter M-Pesa code OR wait for automatic confirmation */}
              <div className="mpesa-manual-ref-section">
                <div className="mpesa-alt-note">
                  💬 Once customer pays, enter the M-Pesa confirmation code from their SMS to complete the sale:
                </div>
                <div style={{display:"flex",gap:8,marginTop:8,width:"100%"}}>
                  <input
                    className="pos-cash-input"
                    style={{flex:1,textTransform:"uppercase",letterSpacing:1}}
                    placeholder="e.g. RBK7X4Y2PQ"
                    value={mpesaRef}
                    onChange={e => setMpesaRef(e.target.value.toUpperCase())}
                  />
                  <button
                    className="pos-checkout-btn"
                    style={{background:"var(--green)",color:"#000",padding:"0 16px",flexShrink:0}}
                    disabled={!mpesaRef.trim()}
                    onClick={completeMpesaSale}
                  >
                    ✓ Confirm Code
                  </button>
                </div>
                <div style={{marginTop:8,fontSize:11,color:"var(--text3)",textAlign:"center"}}>
                  — OR —
                </div>
                <button
                  className="pos-checkout-btn"
                  style={{marginTop:4,background:"var(--bg3)",color:"var(--text)",border:"1px solid var(--border)",width:"100%"}}
                  onClick={completeMpesaSale}
                >
                  ✓ Confirm Manually (no code — I verified payment)
                </button>
              </div>
              <button className="lf-demo-toggle" style={{marginTop:8,width:"100%",justifyContent:"center"}} onClick={() => { clearInterval(pollRef.current); setMpesaStep(null); }}>
                Cancel Sale
              </button>
            </>
          )}
          {mpesaStep === "confirmed" && (
            <>
              <div className="mpesa-success-icon">✓</div>
              <div className="mpesa-title">Payment Confirmed!</div>
              <div className="mpesa-sub">M-Pesa Ref: <strong>{mpesaRef}</strong></div>
              <button className="pos-checkout-btn" style={{marginTop:16}} onClick={completeMpesaSale}>Continue → Receipt</button>
            </>
          )}
          {mpesaStep === "failed" && (
            <>
              <div className="mpesa-fail-icon">✕</div>
              <div className="mpesa-title">Payment Not Confirmed</div>
              <div className="mpesa-sub">Customer may have cancelled or timed out.</div>
              <div style={{display:"flex",gap:10,marginTop:16}}>
                <button className="pos-checkout-btn" style={{flex:1,background:"var(--bg3)",color:"var(--text)",border:"1px solid var(--border)"}} onClick={() => setMpesaStep(null)}>Back to Cart</button>
                <button className="pos-checkout-btn" style={{flex:1,background:"var(--green)",color:"#000"}} onClick={completeMpesaSale}>Mark Paid</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ── Receipt screen ────────────────────────────────────────────
  if (receipt) return (
    <div className="pos-page">
      <div className="receipt-overlay">
        <div className="receipt-card">
          <div className="receipt-header">
            <div className="receipt-logo">PW</div>
            <div><div className="receipt-title">{store.store_name}</div><div className="receipt-sub">{store.store_location} · {receipt.date.toLocaleString("en-KE")}</div></div>
            <div className="receipt-check">✓</div>
          </div>
          <div className="receipt-txn">{receipt.txn}</div>
          <div className="receipt-cashier">Served by: {receipt.cashier}</div>
          {receipt.isOffline && <div className="receipt-offline-badge">📴 Saved offline — will sync when internet returns</div>}
          <div className="receipt-items">
            {receipt.items.map((c,i) => (
              <div key={i} className="receipt-item">
                <span>{c.name} Sz{c.size} × {c.qty}</span>
                <span className="receipt-item-price">{fmt((c.sellingPrice||num(c.sellingPrice)) * c.qty)}</span>
              </div>
            ))}
          </div>
          <div className="receipt-divider"/>
          <div className="receipt-row"><span>Total</span><strong>{fmt(receipt.subtotal)}</strong></div>
          <div className="receipt-row"><span>Method</span><span className={`method-tag method-tag--${receipt.method==="Cash"?"cash":receipt.method==="M-Pesa"?"m-pesa":"split"}`}>{receipt.method}</span></div>
          {(receipt.method==="Cash"||receipt.method==="Split") && <>
            <div className="receipt-row"><span>Amount Paid</span><span>{fmt(receipt.amountPaid)}</span></div>
            <div className="receipt-row"><span>Change</span><strong style={{color:"var(--green)"}}>{fmt(receipt.change)}</strong></div>
          </>}
          {receipt.method==="M-Pesa"&&receipt.mpesaRef && (
            <div className="receipt-row"><span>M-Pesa Ref</span><span style={{color:"var(--teal)",fontWeight:600}}>{receipt.mpesaRef}</span></div>
          )}
          {(receipt.cashierCommission??0) > 0 && (
            <div className="receipt-commission-screen">💰 Your commission: <strong>{fmt(receipt.cashierCommission)}</strong></div>
          )}
          <div style={{display:"flex",gap:10,marginTop:20}}>
            <button className="pos-checkout-btn" style={{flex:1,background:"var(--bg3)",color:"var(--text)",border:"1px solid var(--border)"}} onClick={() => printReceipt(receipt, store)}>🖨 Print</button>
            <button className="pos-checkout-btn" style={{flex:1}} onClick={() => setReceipt(null)}>New Sale ↩</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Main POS layout ────────────────────────────────────────────
  return (
    <div className="pos-page">
      <div className="pos-header">
        <div>
          <h1 className="page-title">Point of Sale</h1>
          <p className="page-sub">Cashier: <strong>{user?.name}</strong> · {new Date().toLocaleDateString("en-KE")} · Commission: {commissionRate}%</p>
        </div>
      </div>

      <div className="pos-layout">
        {/* ── Product Browser ── */}
        <div className="pos-products">
          {/* Search bar always visible */}
          {cat.level === "products" && (
            <div className="pos-search-wrap" style={{marginBottom:12}}>
              <span className="pos-search-icon">🔍</span>
              <input className="pos-search" placeholder="Search by name, SKU…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
          )}

          {/* LEVEL 1: top type selector */}
          {cat.level === "top" && (
            <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
              {[{t:"shoes",icon:"👟",label:"Shoes"},{t:"clothes",icon:"👕",label:"Clothes"}].map(({t,icon,label}) => (
                <div key={t}
                  className="panel-card"
                  style={{flex:1,minWidth:140,cursor:"pointer",padding:24,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s"}}
                  onClick={() => cat.goBrands(t)}
                  onMouseEnter={e => e.currentTarget.style.borderColor="var(--teal)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                >
                  <div style={{fontSize:44,marginBottom:8}}>{icon}</div>
                  <div style={{fontWeight:700,fontSize:15}}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* LEVEL 2: brands */}
          {cat.level === "brands" && (
            <>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
                <button className="tbl-btn" onClick={cat.goTop}>← Back</button>
                <span style={{fontSize:12,color:"var(--text3)"}}>{cat.topType==="shoes"?"👟 Shoes":"👕 Clothes"} › Select brand</span>
              </div>
              {cat.catLoading ? <div style={{padding:30,textAlign:"center",color:"var(--text3)"}}>Loading…</div> : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
                  {cat.brands.map(b => (
                    <div key={b.id}
                      className="panel-card"
                      style={{cursor:"pointer",padding:14,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s"}}
                      onClick={() => cat.goSubtypes(b)}
                      onMouseEnter={e => e.currentTarget.style.borderColor="var(--teal)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                    >
                      {b.photo_url
                        ? <img src={b.photo_url} alt={b.name} style={{width:48,height:48,objectFit:"contain",margin:"0 auto 8px",display:"block"}}/>
                        : <div style={{fontSize:32,marginBottom:8}}>{cat.topType==="shoes"?"👟":(CLOTH_ICONS[b.name]||"👕")}</div>
                      }
                      <div style={{fontWeight:700,fontSize:12}}>{b.name}</div>
                    </div>
                  ))}
                  {cat.brands.length===0 && <div style={{gridColumn:"1/-1",textAlign:"center",padding:30,color:"var(--text3)"}}>No brands found</div>}
                </div>
              )}
            </>
          )}

          {/* LEVEL 3: shoe subtypes */}
          {cat.level === "subtypes" && (
            <>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
                <button className="tbl-btn" onClick={() => cat.goSubtypes(null) || cat.goBrands(cat.topType)}>← Back</button>
                <span style={{fontSize:12,color:"var(--text3)"}}>👟 {cat.selBrand?.name} › Select model</span>
              </div>
              {cat.catLoading ? <div style={{padding:30,textAlign:"center",color:"var(--text3)"}}>Loading…</div> : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:10}}>
                  {cat.subtypes.map(st => (
                    <div key={st.id}
                      className="panel-card"
                      style={{cursor:"pointer",padding:14,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s"}}
                      onClick={() => cat.setSelSubtype(st)}
                      onMouseEnter={e => e.currentTarget.style.borderColor="var(--teal)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}
                    >
                      {st.photo_url
                        ? <img src={st.photo_url} alt={st.name} style={{width:48,height:48,objectFit:"contain",margin:"0 auto 8px",display:"block"}}/>
                        : <div style={{fontSize:32,marginBottom:8}}>👟</div>
                      }
                      <div style={{fontWeight:700,fontSize:12}}>{st.name}</div>
                    </div>
                  ))}
                  {cat.subtypes.length===0 && <div style={{gridColumn:"1/-1",textAlign:"center",padding:30,color:"var(--text3)"}}>No models found</div>}
                </div>
              )}
            </>
          )}

          {/* LEVEL 4: products */}
          {cat.level === "products" && (
            <>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
                <button className="tbl-btn" onClick={() => {
                  if (cat.topType==="shoes") cat.setSelSubtype(null);
                  else cat.goSubtypes(null) || cat.goBrands(cat.topType);
                  setCatalog([]);
                }}>← Back</button>
                <span style={{fontSize:12,color:"var(--text3)"}}>
                  {cat.topType==="shoes"
                    ? `👟 ${cat.selBrand?.name} › ${cat.selSubtype?.name}`
                    : `👕 ${cat.selBrand?.name}`}
                </span>
              </div>

              {catProductLoading
                ? <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading products…</div>
                : (() => {
                    const groups = {};
                    filtered.forEach(item => {
                      const key = `${item.brand}__${item.name}`;
                      if (!groups[key]) groups[key] = [];
                      groups[key].push(item);
                    });
                    const entries = Object.entries(groups);
                    if (!entries.length) return <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}><div style={{fontSize:32,marginBottom:8}}>🔍</div>No products found</div>;
                    return (
                      <div className="pos-grid">
                        {entries.map(([key, variants]) => {
                          const rep = variants[0];
                          const anyInStock = variants.some(v => v.stock > 0);
                          const sorted = [...variants].sort((a,b) => {
                            const na=parseFloat(a.size), nb=parseFloat(b.size);
                            if (!isNaN(na)&&!isNaN(nb)) return na-nb;
                            return String(a.size).localeCompare(String(b.size));
                          });
                          const minPrice = Math.min(...variants.map(v => parseFloat(v.min_price)));
                          const totalStock = variants.reduce((s,v) => s+v.stock, 0);
                          const isClothing = cat.topType === "clothes";
                          return (
                            <div key={key} className={`pos-product-card pos-product-card--grouped ${!anyInStock?"pos-product-card--out":""}`}>
                              {rep.photo_url
                                ? <img src={rep.photo_url} alt={rep.name} className="pos-product-photo"/>
                                : <div className="pos-product-photo-placeholder">{isClothing?(CLOTH_ICONS[rep.brand]||"👕"):"👟"}</div>
                              }
                              <div className="pos-product-brand">{rep.brand}</div>
                              <div className="pos-product-name">{rep.name}</div>
                              {rep.color && <div className="pos-product-color">🎨 {rep.color}</div>}
                              <div className="pos-product-price-row">
                                <span className="pos-product-price">Min: {fmt(minPrice)}</span>
                                <span className={`pos-product-stock ${totalStock<=3?"pos-product-stock--low":""}`}>{totalStock} in stock</span>
                              </div>
                              <div className="pos-size-label">SIZES</div>
                              <div className="pos-size-chips">
                                {sorted.map(v => {
                                  const inCart = cart.find(c => c.id===v.id);
                                  const remaining = v.stock - (inCart?.qty||0);
                                  const outOfStock = v.stock===0;
                                  return (
                                    <button key={v.id}
                                      className={["pos-size-chip", outOfStock?"pos-size-chip--out":"", inCart?"pos-size-chip--active":"", !outOfStock&&remaining<=2?"pos-size-chip--low":""].filter(Boolean).join(" ")}
                                      disabled={outOfStock}
                                      title={outOfStock?"Out of stock":`${v.stock} in stock`}
                                      onClick={() => { if (!outOfStock) addToCart({...v, minPrice:parseFloat(v.min_price)}); }}
                                    >
                                      <span className="pos-size-chip-sz">{v.size}</span>
                                      <span className={`pos-size-chip-qty ${!outOfStock&&remaining<=2?"pos-size-chip-qty--low":""}`}>
                                        {outOfStock?"✕":inCart?`${remaining} left`:`${v.stock}`}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()
              }
            </>
          )}
        </div>

        {/* ── Cart ── */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <span className="card-title">Current Sale</span>
            {cart.length>0 && <button className="link-btn" onClick={() => setCart([])}>Clear</button>}
          </div>

          {cart.length===0
            ? <div className="pos-cart-empty"><div className="pos-cart-empty-icon">👟</div><p>Browse products and tap a size to add</p></div>
            : <div className="pos-cart-items">
                {cart.map(item => {
                  const sp = num(item.sellingPrice);
                  const { extraProfit, commission } = calcItem({...item,sellingPrice:sp}, commissionRate);
                  const belowMin = item.sellingPrice !== "" && sp < item.minPrice;
                  return (
                    <div key={item.id} className="pos-cart-item">
                      <div className="pos-cart-item-info">
                        <div className="pos-cart-item-name">{item.name}</div>
                        <div className="pos-cart-item-meta">Sz {item.size} · {item.sku} · Min: {fmt(item.minPrice)}</div>
                        <div className="pos-selling-price-block">
                          <label className="pos-selling-label">Selling Price <span style={{color:"var(--text3)",fontWeight:400}}>(per unit, KES)</span></label>
                          <input
                            className={`pos-selling-input ${belowMin?"pos-selling-input--error":sp>item.minPrice?"pos-selling-input--upsell":""}`}
                            type="number" placeholder={`Min ${item.minPrice}`}
                            value={item.sellingPrice}
                            onChange={e => setSellingPrice(item.id, e.target.value)}
                            onBlur={() => validateSellingPrice(item.id)}
                          />
                          {belowMin && <div className="pos-price-error">⚠ Cannot be less than {fmt(item.minPrice)}</div>}
                          {!belowMin && extraProfit>0 && <div className="pos-commission-hint">💰 Extra: {fmt(extraProfit)} → Commission: <strong>{fmt(commission)}</strong></div>}
                        </div>
                      </div>
                      <div className="pos-cart-item-controls">
                        <button className="qty-btn" onClick={() => changeQty(item.id,-1)}>−</button>
                        <span className="qty-val">{item.qty}</span>
                        <button className="qty-btn" onClick={() => changeQty(item.id,1)}>+</button>
                        <button className="qty-btn qty-btn--del" onClick={() => removeFromCart(item.id)}>✕</button>
                      </div>
                      <div className="pos-cart-item-total">{sp>=item.minPrice?fmt(sp*item.qty):"—"}</div>
                    </div>
                  );
                })}
              </div>
          }

          <div className="pos-cart-footer">
            <div className="pos-subtotal"><span>Total Selling Price</span><strong>{fmt(subtotal)}</strong></div>
            {totalCommission>0 && <div className="pos-commission-summary"><span>💰 Your commission ({commissionRate}%)</span><strong style={{color:"var(--gold)"}}>{fmt(totalCommission)}</strong></div>}

            <div className="pos-pay-methods">
              {[["cash","💵 Cash"],["mpesa","📱 M-Pesa"],["split","⚡ Split"]].map(([m,label]) => (
                <button key={m}
                  className={`pos-pay-btn ${payMethod===m?"pos-pay-btn--active":""} ${m==="mpesa"&&!isOnline?"pos-pay-btn--disabled":""}`}
                  onClick={() => { if(m==="mpesa"&&!isOnline) return; setPayMethod(m); }}
                  title={m==="mpesa"&&!isOnline?"M-Pesa requires internet":undefined}
                >
                  {label}{m==="mpesa"&&!isOnline?" (offline)":""}
                </button>
              ))}
            </div>

            {!isOnline && <div className="pos-offline-note"><span>📴</span> Offline mode — Cash &amp; Split only. Sale will sync when internet returns.</div>}

            {payMethod==="cash" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Amount Paid by Customer (KES)</label>
                <input className="pos-cash-input" type="number" placeholder={`Min ${fmt(subtotal)}`} value={amountPaid} onChange={e => setAmountPaid(e.target.value)}/>
                {amountPaid && <div className={`pos-change-row ${change<0?"pos-change-row--neg":""}`}><span>{change<0?"Short by":"Change"}</span><strong>{fmt(Math.abs(change))}</strong></div>}
              </div>
            )}

            {payMethod==="mpesa" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Customer Safaricom Number</label>
                <input className="pos-cash-input" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}/>
                <div className="mpesa-paybill-card">
                  <div className="mpesa-paybill-row"><span>Paybill No.</span><strong>{store.mpesa_shortcode}</strong></div>
                  <div className="mpesa-paybill-row"><span>Account No.</span><strong>{store.mpesa_account}</strong></div>
                  <div className="mpesa-paybill-row"><span>Amount</span><strong>{fmt(subtotal)}</strong></div>
                </div>
              </div>
            )}

            {payMethod==="split" && (
              <div className="pos-cash-row">
                <label className="pos-cash-label">Cash Portion (KES)</label>
                <input className="pos-cash-input" type="number" placeholder="How much customer pays in cash" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}/>
                {paidAmt>0 && paidAmt<subtotal && (
                  <div className="pos-split-breakdown">
                    <div className="pos-split-row"><span>💵 Cash received</span><strong>{fmt(paidAmt)}</strong></div>
                    <div className="pos-split-row pos-split-row--mpesa"><span>📱 M-Pesa STK push</span><strong style={{color:"var(--teal)"}}>{fmt(subtotal-paidAmt)}</strong></div>
                    <div className="pos-split-row pos-split-row--total"><span>Total</span><strong>{fmt(subtotal)}</strong></div>
                  </div>
                )}
                {paidAmt>=subtotal && <div className="pos-change-row"><span>No M-Pesa needed — cash covers total</span></div>}
                <label className="pos-cash-label" style={{marginTop:8}}>Customer Safaricom Number</label>
                <input className="pos-cash-input" type="tel" placeholder="+254 7XX XXX XXX" value={mpesaPhone} onChange={e => setMpesaPhone(e.target.value)}/>
              </div>
            )}

            {checkoutErr && <div className="lf-error"><span>⚠</span> {checkoutErr}</div>}

            <button className="pos-checkout-btn"
              disabled={
                !allPriced ||
                (payMethod==="cash"  && paidAmt<subtotal) ||
                (payMethod==="split" && paidAmt<=0) ||
                (payMethod==="split" && paidAmt>0 && (subtotal-paidAmt)>0 && !mpesaPhone.trim())
              }
              onClick={checkout}
            >
              {!allPriced ? "Enter selling prices ↑"
                : payMethod==="split" && paidAmt<=0 ? "Enter cash portion ↑"
                : payMethod==="split" && (subtotal-paidAmt)>0 && !mpesaPhone.trim() ? "Enter M-Pesa number ↑"
                : payMethod==="split" && paidAmt>0 && subtotal-paidAmt>0 ? `Complete — ${fmt(paidAmt)} Cash + ${fmt(subtotal-paidAmt)} M-Pesa`
                : `Complete Sale · ${fmt(subtotal)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
