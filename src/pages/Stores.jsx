import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { storesAPI } from "../services/api";

const fmt  = n => `KES ${Number(n || 0).toLocaleString()}`;
const fmtN = n => Number(n || 0).toLocaleString();
const today = () => new Date().toISOString().split("T")[0];
const daysAgo = d => new Date(Date.now() - d * 86400_000).toISOString().split("T")[0];

export default function Stores() {
  const { user } = useAuth();
  const [tab, setTab] = useState("stores");
  const [stores, setStores] = useState([]);
  const [compare, setCompare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());
  const [modal, setModal] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [form, setForm] = useState({ name: "", location: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    storesAPI.getAll().then(r => setStores(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadCompare = () => {
    setComparing(true);
    storesAPI.compare({ from, to }).then(r => setCompare(r.data)).catch(() => {}).finally(() => setComparing(false));
  };
  useEffect(() => { if (tab === "compare") loadCompare(); }, [tab]);

  const openAdd = () => { setForm({ name: "", location: "", phone: "" }); setEditStore(null); setModal(true); setError(""); };
  const openEdit = s => { setForm({ name: s.name, location: s.location || "", phone: s.phone || "" }); setEditStore(s); setModal(true); setError(""); };

  const save = async () => {
    if (!form.name.trim()) { setError("Store name is required"); return; }
    setSaving(true); setError("");
    try {
      if (editStore) await storesAPI.update(editStore.id, form);
      else await storesAPI.create(form);
      setModal(false); load();
    } catch (e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const deactivate = async s => {
    if (!window.confirm(`Deactivate "${s.name}"? Users assigned to this store will lose store access.`)) return;
    try { await storesAPI.remove(s.id); load(); }
    catch (e) { alert(e.response?.data?.error || "Failed"); }
  };

  const S = {
    card: { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 },
    tab: (active) => ({ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: active ? "var(--gold)" : "var(--bg3)", color: active ? "#000" : "var(--text2)", transition: "all .15s" }),
  };

  return (
    <div className="inv-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stores & Branches</h1>
          <p className="page-sub">{stores.filter(s => s.is_active).length} active stores · Super Admin view</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 10, padding: 4 }}>
            {[["stores", "🏪 Manage"], ["compare", "📊 Compare"]].map(([id, lbl]) => (
              <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{lbl}</button>
            ))}
          </div>
          <button className="primary-btn" onClick={openAdd}>+ Add Store</button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editStore ? "Edit Store" : "Add Store"}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field"><label>Store Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Permic Wear – Westlands" /></div>
              <div className="modal-field"><label>Location</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Westlands, Nairobi" /></div>
              <div className="modal-field"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+254 7XX XXX XXX" /></div>
            </div>
            {error && <div className="lf-error" style={{ marginTop: 12 }}><span>⚠</span> {error}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModal(false)}>Cancel</button>
              <button className="modal-save" onClick={save} disabled={saving}>{saving ? "Saving…" : editStore ? "Save Changes" : "Create Store"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Stores tab */}
      {tab === "stores" && (
        loading ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
            {stores.map(s => (
              <div key={s.id} style={{ ...S.card, opacity: s.is_active ? 1 : 0.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{s.name}</div>
                    {s.location && <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>📍 {s.location}</div>}
                    {s.phone && <div style={{ fontSize: 13, color: "var(--text3)" }}>📞 {s.phone}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.is_active ? "#4ecdc422" : "#e74c3c22", color: s.is_active ? "var(--teal)" : "#e74c3c" }}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text3)" }}>ID #{s.id}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[["Staff", fmtN(s.staff_count)], ["Sales", fmtN(s.total_sales)], ["Revenue", fmt(s.total_revenue)]].map(([lbl, val]) => (
                    <div key={lbl} style={{ textAlign: "center", background: "var(--bg3)", borderRadius: 8, padding: "8px 4px" }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>{val}</div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => openEdit(s)} className="tbl-btn tbl-btn--edit" style={{ flex: 1 }}>Edit</button>
                  {s.is_active && stores.filter(x => x.is_active).length > 1 && (
                    <button onClick={() => deactivate(s)} className="tbl-btn tbl-btn--del" style={{ flex: 1 }}>Deactivate</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Compare tab */}
      {tab === "compare" && (
        <div>
          {/* Date filter */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, color: "var(--text2)" }}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ padding: "6px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 13 }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <label style={{ fontSize: 13, color: "var(--text2)" }}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ padding: "6px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 13 }} />
            </div>
            <button onClick={loadCompare} disabled={comparing} className="primary-btn">{comparing ? "Loading…" : "Compare"}</button>
            {[["7d", 7], ["30d", 30], ["90d", 90]].map(([lbl, d]) => (
              <button key={lbl} onClick={() => { setFrom(daysAgo(d)); setTo(today()); setTimeout(loadCompare, 100); }} style={{ padding: "6px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>{lbl}</button>
            ))}
          </div>

          {comparing && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading comparison…</div>}

          {compare && !comparing && (
            <>
              {/* Revenue leaderboard */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
                {compare.stores.map((s, i) => {
                  const maxRev = Math.max(...compare.stores.map(x => parseFloat(x.total_revenue) || 0));
                  const pct = maxRev > 0 ? (parseFloat(s.total_revenue) / maxRev) * 100 : 0;
                  return (
                    <div key={s.id} style={{ ...S.card, position: "relative", overflow: "hidden" }}>
                      {i === 0 && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 20 }}>🏆</div>}
                      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", marginBottom: 4 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
                        {s.location || "—"} · {s.cashier_count} cashier(s) · {s.admin_count} admin(s)
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "var(--text2)" }}>Revenue</span>
                          <strong style={{ color: "var(--gold)" }}>{fmt(s.total_revenue)}</strong>
                        </div>
                        <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "var(--gold)" : "var(--teal)", borderRadius: 3, transition: "width .5s" }} />
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {[["Sales", fmtN(s.completed_sales)], ["Avg Sale", fmt(Math.round(s.avg_sale))], ["Profit", fmt(s.total_profit)]].map(([lbl, val]) => (
                          <div key={lbl} style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text1)" }}>{val}</div>
                            <div style={{ fontSize: 10, color: "var(--text3)" }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tabular comparison */}
              <div style={S.card}>
                <h3 style={{ margin: "0 0 14px", color: "var(--text1)" }}>Side-by-Side Comparison</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text2)" }}>Metric</th>
                        {compare.stores.map(s => <th key={s.id} style={{ textAlign: "right", padding: "8px 12px", color: "var(--text1)", fontWeight: 700 }}>{s.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Revenue", s => fmt(s.total_revenue), true],
                        ["Profit", s => fmt(s.total_profit), true],
                        ["Sales Count", s => fmtN(s.completed_sales), true],
                        ["Avg Sale", s => fmt(Math.round(s.avg_sale)), true],
                        ["Cashiers", s => fmtN(s.cashier_count), false],
                        ["Admins", s => fmtN(s.admin_count), false],
                      ].map(([label, fn, highlight]) => {
                        const vals = compare.stores.map(s => parseFloat(fn(s).replace(/[^0-9.]/g, "")) || 0);
                        const maxVal = Math.max(...vals);
                        return (
                          <tr key={label} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "8px 12px", color: "var(--text2)", fontWeight: 600 }}>{label}</td>
                            {compare.stores.map((s, i) => (
                              <td key={s.id} style={{ textAlign: "right", padding: "8px 12px", color: highlight && vals[i] === maxVal && maxVal > 0 ? "var(--gold)" : "var(--text1)", fontWeight: highlight && vals[i] === maxVal && maxVal > 0 ? 700 : 400 }}>
                                {fn(s)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
