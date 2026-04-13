import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { storesAPI } from "../services/api";

const fmt  = n => `KES ${Number(n || 0).toLocaleString()}`;
const fmtN = n => Number(n || 0).toLocaleString();
const today  = () => new Date().toISOString().split("T")[0];
const daysAgo = d => new Date(Date.now() - d * 86400_000).toISOString().split("T")[0];

// ── small helpers ────────────────────────────────────────────────
const S = {
  card:   { background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 },
  tab:    a => ({ padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, background: a ? "var(--gold)" : "var(--bg3)", color: a ? "#000" : "var(--text2)", transition: "all .15s" }),
  badge:  (active) => ({ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: active ? "#4ecdc422" : "#e74c3c22", color: active ? "var(--teal)" : "#e74c3c" }),
  pill:   col => ({ padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: col + "22", color: col }),
  input:  { padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 14, width: "100%", boxSizing: "border-box" },
  label:  { fontSize: 12, color: "var(--text3)", marginBottom: 4, display: "block", fontWeight: 600 },
};

const ROLE_COLOR = { admin: "var(--gold)", cashier: "var(--teal)", super_admin: "#9b59b6" };

// ════════════════════════════════════════════════════════════════
export default function Stores() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === "super_admin";

  const [tab, setTab]         = useState("stores");
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modal, setModal]       = useState(false);     // add/edit
  const [editStore, setEditStore] = useState(null);
  const [form, setForm]         = useState({ name: "", location: "", phone: "" });
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");

  // details panel
  const [detailsStore, setDetailsStore] = useState(null);  // store obj
  const [details, setDetails]           = useState(null);  // API response
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsTab, setDetailsTab]     = useState("users");

  // compare
  const [compare, setCompare]     = useState(null);
  const [comparing, setComparing] = useState(false);
  const [from, setFrom]           = useState(daysAgo(30));
  const [to, setTo]               = useState(today());
  const [assigning, setAssigning] = useState(false);

  // ── load stores list ─────────────────────────────────────────
  const load = useCallback(() => {
    setLoading(true);
    storesAPI.getAll()
      .then(r => setStores(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Non-super-admins: auto-redirect to their own store details
  useEffect(() => {
    if (!isSuperAdmin && user.store_id && stores.length > 0) {
      const mine = stores.find(s => s.id === user.store_id);
      if (mine) openDetails(mine);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  // ── compare ──────────────────────────────────────────────────
  const loadCompare = useCallback(() => {
    setComparing(true);
    storesAPI.compare({ from, to })
      .then(r => setCompare(r.data))
      .catch(() => {})
      .finally(() => setComparing(false));
  }, [from, to]);

  useEffect(() => { if (tab === "compare") loadCompare(); }, [tab, loadCompare]);

  // ── store details ─────────────────────────────────────────────
  const openDetails = (s) => {
    setDetailsStore(s);
    setDetailsTab("users");
    setDetails(null);
    setDetailsLoading(true);
    storesAPI.details(s.id)
      .then(r => setDetails(r.data))
      .catch(() => setDetails(null))
      .finally(() => setDetailsLoading(false));
  };

  const closeDetails = () => {
    // Non-super-admins can't close their own store details
    if (!isSuperAdmin) return;
    setDetailsStore(null);
    setDetails(null);
  };

  // ── price list download ───────────────────────────────────────
  const downloadPriceList = (storeId) => {
    const token = localStorage.getItem("token");
    const url   = storesAPI.priceListUrl(storeId);
    // Fetch with auth header then trigger download
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a   = document.createElement("a");
        a.href    = URL.createObjectURL(blob);
        a.download = `price-list-store-${storeId}-${today()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => alert("Failed to download price list"));
  };

  // ── add / edit modal ─────────────────────────────────────────
  const openAdd  = () => { setForm({ name: "", location: "", phone: "" }); setEditStore(null); setFormError(""); setModal(true); };
  const openEdit = s  => { setForm({ name: s.name, location: s.location || "", phone: s.phone || "" }); setEditStore(s); setFormError(""); setModal(true); };

  const save = async () => {
    if (!form.name.trim()) { setFormError("Store name is required"); return; }
    setSaving(true); setFormError("");
    try {
      if (editStore) await storesAPI.update(editStore.id, form);
      else           await storesAPI.create(form);
      setModal(false); load();
    } catch (e) { setFormError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const deactivate = async s => {
    if (!window.confirm(`Deactivate "${s.name}"?\nUsers assigned here will lose store access.`)) return;
    try { await storesAPI.remove(s.id); load(); if (detailsStore?.id === s.id) closeDetails(); }
    catch (e) { alert(e.response?.data?.error || "Failed"); }
  };

  const activate = async s => {
    try { await storesAPI.activate(s.id); load(); }
    catch (e) { alert(e.response?.data?.error || "Failed"); }
  };

  // ── Assign orphan records (NULL store_id) to a store ───────────
  const assignOrphans = async (storeId) => {
    if (!window.confirm(
      `Assign all products and sales with no store to this store?\n` +
      `This fixes data from before multi-store was set up.\n\n` +
      `Only do this once. This cannot be undone.`
    )) return;
    setAssigning(true);
    try {
      const r = await storesAPI.assignOrphans(storeId);
      alert(`✅ Done! Assigned ${r.data.products} products and ${r.data.sales} sales to this store.`);
      load();
      if (tab === "compare") loadCompare();
    } catch (e) {
      alert(e.response?.data?.error || "Failed to assign records");
    } finally { setAssigning(false); }
  };

  // ── CSV helper for stock lists ────────────────────────────────
  const downloadStockCSV = (rows, filename) => {
    const header = "SKU,Product,Size,Stock\n";
    const body   = rows.map(p => `${p.sku || ""},${p.name},${p.size || ""},${p.stock}`).join("\n");
    const blob   = new Blob([header + body], { type: "text/csv" });
    const a      = document.createElement("a");
    a.href       = URL.createObjectURL(blob);
    a.download   = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  // Non-super-admins only see the details panel for their store
  if (!isSuperAdmin) {
    return (
      <div className="inv-page">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Store</h1>
            <p className="page-sub">{detailsStore?.name || "Loading…"}</p>
          </div>
        </div>
        {detailsLoading && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading store info…</div>}
        {details && <StoreDetails store={detailsStore} details={details} tab={detailsTab} setTab={setDetailsTab} onDownloadStock={downloadStockCSV} isSuperAdmin={false} />}
      </div>
    );
  }

  // ── super admin full view ─────────────────────────────────────
  return (
    <div className="inv-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Stores & Branches</h1>
          <p className="page-sub">{stores.filter(s => s.is_active).length} active · {stores.length} total</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--bg3)", borderRadius: 10, padding: 4 }}>
            {[["stores", "🏪 Manage"], ["compare", "📊 Compare"]].map(([id, lbl]) => (
              <button key={id} style={S.tab(tab === id)} onClick={() => { setTab(id); setDetailsStore(null); }}>{lbl}</button>
            ))}
          </div>
          <button className="primary-btn" onClick={openAdd}>+ Add Store</button>
        </div>
      </div>

      {/* ── Add / Edit Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editStore ? "Edit Store" : "Add Store"}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field"><label>Store Name *</label><input style={S.input} value={form.name}     onChange={e => setForm({ ...form, name:     e.target.value })} placeholder="e.g. Permic Wear – Westlands" /></div>
              <div className="modal-field"><label>Location</label>    <input style={S.input} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Westlands, Nairobi" /></div>
              <div className="modal-field"><label>Phone</label>        <input style={S.input} value={form.phone}    onChange={e => setForm({ ...form, phone:    e.target.value })} placeholder="+254 7XX XXX XXX" /></div>
            </div>
            {formError && <div className="lf-error" style={{ marginTop: 12 }}><span>⚠</span> {formError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModal(false)}>Cancel</button>
              <button className="modal-save"   onClick={save} disabled={saving}>{saving ? "Saving…" : editStore ? "Save Changes" : "Create Store"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── STORES TAB ── */}
      {tab === "stores" && !detailsStore && (
        loading
          ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading…</div>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 16 }}>
              {stores.map(s => (
                <div key={s.id} style={{ ...S.card, opacity: s.is_active ? 1 : 0.6, cursor: "pointer" }}
                  onClick={() => openDetails(s)}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text1)" }}>{s.name}</div>
                      {s.location && <div style={{ fontSize: 13, color: "var(--text3)", marginTop: 2 }}>📍 {s.location}</div>}
                      {s.phone    && <div style={{ fontSize: 13, color: "var(--text3)" }}>📞 {s.phone}</div>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                      <span style={S.badge(s.is_active)}>{s.is_active ? "Active" : "Inactive"}</span>
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>ID #{s.id}</span>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                    {[["Staff", fmtN(s.staff_count)], ["Sales", fmtN(s.total_sales)], ["Revenue", fmt(s.total_revenue)]].map(([lbl, val]) => (
                      <div key={lbl} style={{ textAlign: "center", background: "var(--bg3)", borderRadius: 8, padding: "8px 4px" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--gold)" }}>{val}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>{lbl}</div>
                      </div>
                    ))}
                  </div>

                  {/* actions — stop propagation so card click doesn't also trigger */}
                  <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => openDetails(s)} className="tbl-btn tbl-btn--edit" style={{ flex: 1 }}>Details</button>
                    <button onClick={() => openEdit(s)}    className="tbl-btn tbl-btn--edit" style={{ flex: 1 }}>Edit</button>
                    {s.is_active
                      ? stores.filter(x => x.is_active).length > 1 && (
                          <button onClick={() => deactivate(s)} className="tbl-btn tbl-btn--del" style={{ flex: 1 }}>Deactivate</button>
                        )
                      : <button onClick={() => activate(s)} className="tbl-btn" style={{ flex: 1, background: "var(--teal)22", color: "var(--teal)" }}>Activate</button>
                    }
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {/* ── STORE DETAILS PANEL (super admin) ── */}
      {tab === "stores" && detailsStore && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <button onClick={closeDetails} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>
              ← Back to stores
            </button>
            <div>
              <span style={{ fontWeight: 700, fontSize: 18, color: "var(--text1)" }}>{detailsStore.name}</span>
              {detailsStore.location && <span style={{ fontSize: 13, color: "var(--text3)", marginLeft: 10 }}>📍 {detailsStore.location}</span>}
            </div>
            <span style={{ ...S.badge(detailsStore.is_active), marginLeft: "auto" }}>{detailsStore.is_active ? "Active" : "Inactive"}</span>
            <button onClick={() => downloadPriceList(detailsStore.id)} className="primary-btn" style={{ fontSize: 13, padding: "7px 14px" }}>
              ⬇ Price List CSV
            </button>
          </div>

          {detailsLoading
            ? <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading…</div>
            : details && <StoreDetails store={detailsStore} details={details} tab={detailsTab} setTab={setDetailsTab} onDownloadStock={downloadStockCSV} isSuperAdmin={true} />
          }
        </div>
      )}

      {/* ── COMPARE TAB ── */}
      {tab === "compare" && (
        <CompareTab
          compare={compare} comparing={comparing}
          from={from} to={to}
          setFrom={setFrom} setTo={setTo}
          onCompare={loadCompare}
          daysAgo={daysAgo} today={today}
          stores={stores}
          onAssignOrphans={assignOrphans}
          assigning={assigning}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Store Details Panel
// ════════════════════════════════════════════════════════════════
function StoreDetails({ store, details, tab, setTab, onDownloadStock, isSuperAdmin }) {
  const { out_of_stock = [], low_stock = [], users = [] } = details;

  const TABS = [
    ["users",     `👥 Staff (${users.length})`],
    ["out",       `🚫 Out of Stock (${out_of_stock.length})`],
    ["low",       `⚠️ Low Stock (${low_stock.length})`],
  ];

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map(([id, lbl]) => (
          <button key={id} style={S.tab(tab === id)} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ margin: 0, color: "var(--text1)" }}>Staff Members</h3>
            <span style={{ fontSize: 13, color: "var(--text3)" }}>{users.length} total</span>
          </div>
          {users.length === 0
            ? <div style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>No staff assigned to this store</div>
            : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["Name", "Email", "Role", "Status"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text2)", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px 10px", color: "var(--text1)", fontWeight: 600 }}>{u.name}</td>
                      <td style={{ padding: "8px 10px", color: "var(--text3)" }}>{u.email}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={S.pill(ROLE_COLOR[u.role] || "var(--text2)")}>{u.role}</span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={S.badge(u.is_active)}>{u.is_active ? "Active" : "Inactive"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      )}

      {/* Out of stock tab */}
      {tab === "out" && (
        <StockTable
          rows={out_of_stock}
          empty="No out-of-stock products 🎉"
          title="Out of Stock Products"
          badgeColor="#e74c3c"
          onDownload={() => onDownloadStock(out_of_stock, `out-of-stock-${store.name.replace(/\s/g,"-")}-${today()}.csv`)}
        />
      )}

      {/* Low stock tab */}
      {tab === "low" && (
        <StockTable
          rows={low_stock}
          empty="No low-stock products 🎉"
          title="Low Stock Products (≤ 5 units)"
          badgeColor="var(--gold)"
          onDownload={() => onDownloadStock(low_stock, `low-stock-${store.name.replace(/\s/g,"-")}-${today()}.csv`)}
        />
      )}
    </div>
  );
}

// ── Stock table shared by out-of-stock + low-stock ───────────────
function StockTable({ rows, empty, title, badgeColor, onDownload }) {
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ margin: 0, color: "var(--text1)" }}>{title}</h3>
        {rows.length > 0 && (
          <button onClick={onDownload} style={{ padding: "6px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer", fontSize: 12 }}>
            ⬇ Download CSV
          </button>
        )}
      </div>
      {rows.length === 0
        ? <div style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>{empty}</div>
        : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)" }}>
                  {["SKU", "Product", "Size", "Category", "Stock"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: "var(--text2)", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(p => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 10px", color: "var(--text3)", fontFamily: "monospace", fontSize: 12 }}>{p.sku || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text1)", fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text3)" }}>{p.size || "—"}</td>
                    <td style={{ padding: "8px 10px", color: "var(--text3)" }}>{p.category || "—"}</td>
                    <td style={{ padding: "8px 10px" }}>
                      <span style={{ fontWeight: 700, color: badgeColor }}>{p.stock}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Compare Tab
// ════════════════════════════════════════════════════════════════
function CompareTab({ compare, comparing, from, to, setFrom, setTo, onCompare, daysAgo, today, stores = [], onAssignOrphans, assigning }) {
  const fmt  = n => `KES ${Number(n || 0).toLocaleString()}`;
  const fmtN = n => Number(n || 0).toLocaleString();

  const dateInput = (value, onChange) => (
    <input type="date" value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: "6px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", fontSize: 13 }} />
  );

  const quickSet = d => { setFrom(daysAgo(d)); setTo(today()); setTimeout(onCompare, 100); };

  return (
    <div>
      {/* Date filter bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--text2)" }}>From</label>
          {dateInput(from, setFrom)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--text2)" }}>To</label>
          {dateInput(to, setTo)}
        </div>
        <button onClick={onCompare} disabled={comparing} className="primary-btn">{comparing ? "Loading…" : "Compare"}</button>
        {[["7d", 7], ["30d", 30], ["90d", 90]].map(([lbl, d]) => (
          <button key={lbl} onClick={() => quickSet(d)}
            style={{ padding: "6px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", cursor: "pointer", fontSize: 13 }}>{lbl}</button>
        ))}
      </div>

      {comparing && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Loading comparison…</div>}
      {compare && !comparing && compare.stores && compare.stores.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
          No stores found. Add stores first.
        </div>
      )}

      {/* Orphan data helper */}
      {stores.length > 0 && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 13 }}>
          <div style={{ color: "var(--text2)", marginBottom: 8 }}>
            <strong>📦 If compare shows zero values:</strong> Some products/sales may not have a store assigned (added before multi-store was set up).
            Assign them to their store below.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stores.filter(s => s.is_active).map(s => (
              <button key={s.id} onClick={() => onAssignOrphans(s.id)} disabled={assigning}
                style={{ padding: "6px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text1)", cursor: "pointer", fontSize: 12 }}>
                {assigning ? "Assigning…" : `Assign unassigned → ${s.name}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {compare && !comparing && compare.stores && compare.stores.length > 0 && (
        <>
          {/* Revenue cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
            {compare.stores.map((s, i) => {
              const maxRev = Math.max(...compare.stores.map(x => parseFloat(x.total_revenue) || 0));
              const pct    = maxRev > 0 ? (parseFloat(s.total_revenue) / maxRev) * 100 : 0;
              return (
                <div key={s.id} style={{ ...S.card, position: "relative", overflow: "hidden" }}>
                  {i === 0 && <div style={{ position: "absolute", top: 12, right: 12, fontSize: 20 }}>🏆</div>}
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text1)", marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>
                    {s.location || "—"} · {s.cashier_count} cashier(s) · {s.admin_count} admin(s)
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: "var(--text2)" }}>Revenue</span>
                      <strong style={{ color: "var(--gold)" }}>{fmt(s.total_revenue)}</strong>
                    </div>
                    <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: i === 0 ? "var(--gold)" : "var(--teal)", borderRadius: 3, transition: "width .5s" }} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                    {[["Sales", fmtN(s.completed_sales)], ["Avg Sale", fmt(Math.round(s.avg_sale))], ["Profit", fmt(s.total_profit)]].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: "var(--bg3)", borderRadius: 8, padding: "6px 4px", textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text1)" }}>{val}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)" }}>{lbl}</div>
                      </div>
                    ))}
                  </div>
                  {/* Top products */}
                  {s.top_products?.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                      <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 700, marginBottom: 6 }}>TOP PRODUCTS</div>
                      {s.top_products.map((p, pi) => (
                        <div key={pi} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                          <span style={{ color: "var(--text2)" }}>{p.product_name}</span>
                          <span style={{ color: "var(--gold)", fontWeight: 700 }}>{fmtN(p.units_sold)} units</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Side-by-side table */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", color: "var(--text1)" }}>Side-by-Side Comparison</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text2)" }}>Metric</th>
                    {compare.stores.map(s => (
                      <th key={s.id} style={{ textAlign: "right", padding: "8px 12px", color: "var(--text1)", fontWeight: 700 }}>{s.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Revenue",     s => fmt(s.total_revenue),                 true],
                    ["Profit",      s => fmt(s.total_profit),                  true],
                    ["Sales Count", s => fmtN(s.completed_sales),              true],
                    ["Avg Sale",    s => fmt(Math.round(s.avg_sale)),           true],
                    ["Cashiers",    s => fmtN(s.cashier_count),                false],
                    ["Admins",      s => fmtN(s.admin_count),                  false],
                  ].map(([label, fn, highlight]) => {
                    const vals   = compare.stores.map(s => parseFloat(String(fn(s)).replace(/[^0-9.]/g, "")) || 0);
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
  );
}
