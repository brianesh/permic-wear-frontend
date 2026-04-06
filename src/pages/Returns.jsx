import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`;

const REASONS = [
  "Wrong size", "Defective/damaged product", "Customer changed mind",
  "Wrong item received", "Quality issue", "Other",
];

export default function Returns() {
  const { user } = useAuth();
  const [step, setStep] = useState("lookup");   // lookup → review → done
  const [refInput, setRefInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState("");
  const [saleData, setSaleData] = useState(null);
  const [selected, setSelected] = useState({});  // { item_id: { qty, restock, condition } }
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const lookup = async () => {
    const ref = refInput.trim().toUpperCase();
    if (!ref) return;
    setLooking(true); setLookupErr(""); setSaleData(null);
    try {
      const res = await api.get(`/returns/lookup/${ref}`);
      setSaleData(res.data);
      const sel = {};
      res.data.items.forEach(i => {
        if (i.returnable_qty > 0) sel[i.id] = { qty: 0, restock: true, condition: "good" };
      });
      setSelected(sel);
      setStep("review");
    } catch (e) {
      setLookupErr(e.response?.data?.error || "Receipt not found. Check the ID and try again.");
    } finally { setLooking(false); }
  };

  const toggleItem = id => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], qty: prev[id]?.qty > 0 ? 0 : 1 } }));
  };

  const updateSel = (id, field, val) => {
    setSelected(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const selectedItems = saleData?.items?.filter(i => selected[i.id]?.qty > 0) || [];
  const totalRefund = selectedItems.reduce((s, i) => s + parseFloat(i.selling_price) * selected[i.id].qty, 0);

  const process = async () => {
    if (!selectedItems.length) return;
    if (!reason) return alert("Please select a return reason.");
    setProcessing(true);
    try {
      const res = await api.post("/returns", {
        original_sale_id: saleData.sale.id,
        items: selectedItems.map(i => ({
          sale_item_id: i.id,
          qty: selected[i.id].qty,
          restock: selected[i.id].restock,
          condition: selected[i.id].condition,
        })),
        reason, notes,
      });
      setResult(res.data);
      setStep("done");
    } catch (e) {
      alert(e.response?.data?.error || "Return processing failed.");
    } finally { setProcessing(false); }
  };

  const reset = () => { setStep("lookup"); setRefInput(""); setSaleData(null); setResult(null); setReason(""); setNotes(""); };

  const S = { card: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 16 } };

  return (
    <div className="inv-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Returns & Refunds</h1>
          <p className="page-sub">Scan receipt QR or enter receipt ID to process a return</p>
        </div>
      </div>

      {/* Step 1: Lookup */}
      {step === "lookup" && (
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={S.card}>
            <h3 style={{ margin: "0 0 16px", color: "var(--text1)" }}>🔍 Find Receipt</h3>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={refInput} onChange={e => setRefInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && lookup()}
                placeholder="e.g. TXN-A1B2C3D4 or UBNGT7QNYB"
                style={{ flex: 1, padding: "10px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 14, fontFamily: "monospace", letterSpacing: 1, outline: "none" }}
              />
              <button onClick={lookup} disabled={looking || !refInput.trim()} className="primary-btn">
                {looking ? "Searching…" : "Find"}
              </button>
            </div>
            {lookupErr && <div style={{ marginTop: 10, color: "#e74c3c", fontSize: 13 }}>⚠ {lookupErr}</div>}
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text3)" }}>
              Enter the receipt ID (e.g. TXN-A1B2C3D4) printed on the receipt, or the M-Pesa reference number.
            </p>
          </div>
        </div>
      )}

      {/* Step 2: Review */}
      {step === "review" && saleData && (
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {/* Sale summary */}
          <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{saleData.sale.txn_id}</div>
                <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>
                  {new Date(saleData.sale.sale_date).toLocaleString("en-KE")} · Cashier: {saleData.sale.cashier_name}
                </div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>
                  {saleData.sale.store_name} · {saleData.sale.payment_method}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--gold)" }}>{fmt(saleData.sale.selling_total)}</div>
                {!saleData.within_window && (
                  <div style={{ marginTop: 4, padding: "4px 10px", background: "#e74c3c22", color: "#e74c3c", borderRadius: 6, fontSize: 12 }}>
                    ⚠ Return window expired ({saleData.days_since_sale} days ago — limit: {saleData.return_window_days} days)
                  </div>
                )}
                {saleData.within_window && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "var(--text3)" }}>
                    {saleData.days_since_sale} day(s) ago · {saleData.return_window_days - saleData.days_since_sale} days left in window
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", color: "var(--text1)" }}>Select Items to Return</h3>
            {saleData.items.map(item => {
              const sel = selected[item.id];
              const isSelected = sel?.qty > 0;
              const canReturn = item.returnable_qty > 0;
              return (
                <div key={item.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14, marginBottom: 14 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <input type="checkbox" checked={isSelected} disabled={!canReturn} onChange={() => canReturn && toggleItem(item.id)} style={{ marginTop: 3, width: 18, height: 18, cursor: canReturn ? "pointer" : "not-allowed" }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "var(--text1)" }}>{item.product_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)" }}>SKU: {item.sku} · Sz: {item.size} · Sold: {item.qty} · Price: {fmt(item.selling_price)}</div>
                      {item.already_returned > 0 && <div style={{ fontSize: 12, color: "var(--gold)" }}>Already returned: {item.already_returned}</div>}
                      {!canReturn && <div style={{ fontSize: 12, color: "#e74c3c" }}>All units already returned</div>}
                    </div>
                    {isSelected && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 2 }}>Qty</label>
                          <select value={sel.qty} onChange={e => updateSel(item.id, "qty", parseInt(e.target.value))} style={{ padding: "4px 8px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text1)", fontSize: 13 }}>
                            {Array.from({ length: item.returnable_qty }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 2 }}>Condition</label>
                          <select value={sel.condition} onChange={e => updateSel(item.id, "condition", e.target.value)} style={{ padding: "4px 8px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text1)", fontSize: 13 }}>
                            <option value="good">Good</option>
                            <option value="damaged">Damaged</option>
                            <option value="unsellable">Unsellable</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "var(--text3)", display: "block", marginBottom: 2 }}>Restock?</label>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                            <input type="checkbox" checked={sel.restock && sel.condition !== "unsellable"} disabled={sel.condition === "unsellable"} onChange={e => updateSel(item.id, "restock", e.target.checked)} />
                            {sel.condition === "unsellable" ? "No (unsellable)" : "Yes"}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason + notes */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", color: "var(--text1)" }}>Return Details</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 6 }}>Reason *</label>
                <select value={reason} onChange={e => setReason(e.target.value)} style={{ width: "100%", padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 13 }}>
                  <option value="">— Select reason —</option>
                  {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 6 }}>Notes</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional details…" style={{ width: "100%", padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            </div>
          </div>

          {/* Summary + actions */}
          {selectedItems.length > 0 && (
            <div style={{ ...S.card, background: "var(--bg3)" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", marginBottom: 8 }}>Return Summary</div>
              {selectedItems.map(i => (
                <div key={i.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text2)", marginBottom: 4 }}>
                  <span>{i.product_name} Sz{i.size} × {selected[i.id].qty} {selected[i.id].condition !== "good" ? `(${selected[i.id].condition})` : ""} {selected[i.id].restock ? "🔄" : "🗑"}</span>
                  <strong>{fmt(parseFloat(i.selling_price) * selected[i.id].qty)}</strong>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700 }}>Total Refund</span>
                <strong style={{ color: "var(--gold)", fontSize: 16 }}>{fmt(totalRefund)}</strong>
              </div>
              {totalRefund > 5000 && user.role !== "super_admin" && (
                <div style={{ marginTop: 8, padding: "6px 12px", background: "#f5a62322", borderRadius: 6, fontSize: 12, color: "var(--gold)" }}>
                  ⚠ Refund above KES 5,000 — will require manager approval
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={reset} style={{ flex: 1, padding: "12px 0", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer", fontSize: 14 }}>← Start Over</button>
            <button onClick={process} disabled={!selectedItems.length || !reason || processing || !saleData.within_window} className="primary-btn" style={{ flex: 2 }}>
              {processing ? "Processing…" : `Process Return · ${fmt(totalRefund)}`}
            </button>
          </div>
          {!saleData.within_window && <div style={{ marginTop: 8, fontSize: 12, color: "#e74c3c", textAlign: "center" }}>Returns are not allowed after the {saleData.return_window_days}-day window.</div>}
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && result && (
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ ...S.card, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>{result.status === "pending_approval" ? "⏳" : "✅"}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text1)", marginBottom: 8 }}>
              {result.status === "pending_approval" ? "Pending Approval" : "Return Processed"}
            </div>
            <div style={{ fontSize: 14, color: "var(--text2)", marginBottom: 4 }}>Ref: <strong style={{ fontFamily: "monospace" }}>{result.return_ref}</strong></div>
            <div style={{ fontSize: 18, color: "var(--gold)", fontWeight: 700, margin: "12px 0" }}>{fmt(result.total_refund)} to refund</div>
            <div style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20 }}>{result.message}</div>
            <button onClick={reset} className="primary-btn" style={{ width: "100%" }}>Process Another Return</button>
          </div>
        </div>
      )}
    </div>
  );
}
