import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { salesAPI, usersAPI } from "../services/api";
import { exportSalesPDF } from "../lib/pdfExport";
import { useStore } from "../context/StoreContext";

const fmt = n => `KES ${Number(n||0).toLocaleString()}`;
const METHODS = ["All","Cash","M-Pesa","Split"];
const STATUS_FILTERS = ["All","completed","pending_mpesa","pending_split","failed"];

export default function SalesRecords() {
  const { user } = useAuth();
  const store = useStore();
  const isSuperAdmin = user?.role === "super_admin";
  const isGlobalMode = isSuperAdmin && !localStorage.getItem("active_store_id");

  const [sales, setSales]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [cashiers, setCashiers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [cashier, setCashier]     = useState("All");
  const [method, setMethod]       = useState("All");
  const [status, setStatus]       = useState("All");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [expanded, setExpanded]   = useState(null);
  const [page, setPage]           = useState(1);
  const PER = 10;

  // --- Summary totals state (computed from ALL matching records, not just current page) ---
  const [summaryRev,    setSummaryRev]    = useState(0);
  const [summaryProfit, setSummaryProfit] = useState(0);
  const [summaryCash,   setSummaryCash]   = useState(0);
  const [summaryMpesa,  setSummaryMpesa]  = useState(0);
  const [exporting,     setExporting]     = useState(false);

  useEffect(() => {
    usersAPI.getAll()
      .then(res => setCashiers(["All", ...res.data.filter(u => u.role === "cashier").map(u => u.name)]))
      .catch(() => {});
  }, []);

  // Build shared filter params (no page/limit)
  const buildParams = useCallback(() => ({
    from:   dateFrom || undefined,
    to:     dateTo   || undefined,
    method: method !== "All" ? method : undefined,
    status: status !== "All" ? status : undefined,
    cashier: cashier !== "All" ? cashier : undefined,
  }), [dateFrom, dateTo, method, status, cashier]);

  // Paginated load for the table
  const load = useCallback(() => {
    setLoading(true);
    const fetchFn = isGlobalMode ? salesAPI.getAllStores : salesAPI.getAll;
    fetchFn({ ...buildParams(), page, limit: PER })
      .then(res => {
        setSales(res.data.sales || []);
        setTotal(res.data.total || 0);
      })
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, [page, buildParams, isGlobalMode]);

  // Full load (no pagination) for summary cards — re-runs whenever filters change
  const loadSummary = useCallback(() => {
    const fetchFn = isGlobalMode ? salesAPI.getAllStores : salesAPI.getAll;
    fetchFn({ ...buildParams(), page: 1, limit: 999999 })
      .then(res => {
        const all = res.data.sales || [];
        // Client-side cashier filter still applies if cashier filter is active
        // (server already filters by cashier param above, so this is a safety net)
        setSummaryRev(   all.reduce((s, t) => s + parseFloat(t.selling_total || 0), 0));
        setSummaryProfit(all.reduce((s, t) => s + parseFloat(t.extra_profit  || 0), 0));
        setSummaryCash(  all.filter(t => t.payment_method === "Cash")
                            .reduce((s, t) => s + parseFloat(t.selling_total || 0), 0));
        setSummaryMpesa( all.filter(t => ["M-Pesa","Tuma"].includes(t.payment_method))
                            .reduce((s, t) => s + parseFloat(t.selling_total || 0), 0));
      })
      .catch(() => {
        setSummaryRev(0); setSummaryProfit(0);
        setSummaryCash(0); setSummaryMpesa(0);
      });
  }, [buildParams, isGlobalMode]);

  useEffect(() => { load(); },        [load]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  // Client-side search filter (TXN ID / cashier name) applied on top of paginated results
  const filtered = sales.filter(s =>
    s.txn_id?.toLowerCase().includes(search.toLowerCase()) ||
    s.cashier_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pages = Math.max(1, Math.ceil(total / PER));

  // Export PDF: fetch ALL matching records for the selected filters/dates
  const exportPDF = async () => {
    setExporting(true);
    try {
      const fetchFn = isGlobalMode ? salesAPI.getAllStores : salesAPI.getAll;
      const res = await fetchFn({ ...buildParams(), page: 1, limit: 999999 });
      const allSales = res.data.sales || [];
      exportSalesPDF(allSales, {
        from:      dateFrom,
        to:        dateTo,
        storeName: store.store_name,
        method:    method !== "All" ? method : undefined,
        status:    status !== "All" ? status : undefined,
        cashier:   cashier !== "All" ? cashier : undefined,
      });
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="inv-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Records</h1>
          <p className="page-sub">{total} total transactions{isGlobalMode ? " · All Stores" : ""}</p>
        </div>
        <button className="primary-btn" onClick={exportPDF} disabled={exporting}>
          {exporting ? "Exporting…" : "⬇ Export PDF"}
        </button>
      </div>

      {/* Summary cards — always reflect ALL records matching the active filters */}
      <div className="sales-summary-grid">
        {[
          ["Total Revenue",  fmt(summaryRev),    "var(--text)"],
          ["Total Profit",   fmt(summaryProfit), "var(--green)"],
          ["Cash Sales",     fmt(summaryCash),   "var(--text)"],
          ["M-Pesa Sales",   fmt(summaryMpesa),  "var(--teal)"],
        ].map(([l, v, c]) => (
          <div key={l} className="summary-card">
            <div className="summary-label">{l}</div>
            <div className="summary-value" style={{color: c}}>{v}</div>
          </div>
        ))}
      </div>

      <div className="inv-filters" style={{flexWrap:"wrap"}}>
        <div className="pos-search-wrap" style={{flex:1, minWidth:220}}>
          <span className="pos-search-icon">↗</span>
          <input
            className="pos-search"
            placeholder="Search TXN ID or cashier…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          {cashiers.map(c => (
            <button key={c} className={`filter-chip ${cashier===c?"filter-chip--active":""}`}
              onClick={() => { setCashier(c); setPage(1); }}>{c}</button>
          ))}
        </div>
        <div className="filter-group">
          {METHODS.map(m => (
            <button key={m} className={`filter-chip ${method===m?"filter-chip--active":""}`}
              onClick={() => { setMethod(m); setPage(1); }}>{m}</button>
          ))}
        </div>
        <div className="filter-group">
          {STATUS_FILTERS.map(s => (
            <button key={s} className={`filter-chip ${status===s?"filter-chip--active":""}`}
              onClick={() => { setStatus(s); setPage(1); }}>{s}</button>
          ))}
        </div>
        <div className="date-filter-group">
          <input type="date" className="date-input" value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}/>
          <span style={{color:"var(--text3)"}}>to</span>
          <input type="date" className="date-input" value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}/>
        </div>
      </div>

      <div className="panel-card" style={{padding:0}}>
        <div className="table-wrap">
          <table className="sales-table">
            <thead>
              <tr>
                <th>TXN ID</th><th>Date & Time</th><th>Cashier</th>
                {isGlobalMode && <th>Store</th>}
                <th>Items</th><th>Total</th><th>Profit</th><th>Commission</th><th>Method</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={isGlobalMode ? 11 : 10} style={{textAlign:"center",padding:24,color:"var(--text3)"}}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && filtered.map(s => (
                <>
                  <tr key={s.id} style={{cursor:"pointer"}} onClick={() => setExpanded(expanded===s.id ? null : s.id)}>
                    <td className="txn-id">{s.txn_id}</td>
                    <td className="time">{new Date(s.sale_date).toLocaleString("en-KE")}</td>
                    <td>{s.cashier_name}</td>
                    {isGlobalMode && <td style={{fontSize:11,color:"var(--text3)"}}>{s.store_name || "—"}</td>}
                    <td>{s.items?.length || 0} item(s)</td>
                    <td className="amount">{fmt(s.selling_total)}</td>
                    <td className="profit">+{fmt(s.extra_profit)}</td>
                    <td style={{color:"var(--gold)",fontWeight:600}}>💰 {fmt(s.commission)}</td>
                    <td>
                      <span className={`method-tag method-tag--${s.payment_method==="Cash"?"cash":s.payment_method==="M-Pesa"?"m-pesa":"split"}`}>
                        {s.payment_method}
                      </span>
                    </td>
                    <td>
                      {s.status === "completed"     && <span style={{fontSize:11,color:"var(--green)"}}>✓</span>}
                      {s.status === "pending_mpesa" && <span style={{fontSize:11,color:"var(--gold)"}}>⏳</span>}
                      {s.status === "pending_split" && <span style={{fontSize:11,color:"var(--gold)"}}>⏳</span>}
                      {s.status === "failed"        && <span style={{fontSize:11,color:"var(--red)"}}>✕</span>}
                    </td>
                    <td style={{color:"var(--text3)",fontSize:12}}>{expanded===s.id ? "▲" : "▼"}</td>
                  </tr>
                  {expanded === s.id && (
                    <tr key={s.id+"-exp"}>
                      <td colSpan={isGlobalMode ? 11 : 10} style={{background:"var(--bg3)",padding:"12px 20px"}}>
                        {(s.items||[]).map((it,i) => (
                          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)",marginBottom:4}}>
                            <span>{it.product_name} Sz{it.size} × {it.qty} @ {fmt(it.selling_price)}</span>
                            <span style={{color:"var(--text)"}}>{fmt(it.selling_price * it.qty)}</span>
                          </div>
                        ))}
                        {s.payment_method === "Cash" && (
                          <div style={{fontSize:12,color:"var(--text3)",marginTop:6}}>
                            Amount paid: {fmt(s.amount_paid)} · Change: {fmt(s.change_given)}
                          </div>
                        )}
                        {(s.phone||s.mpesa_phone) && ["M-Pesa","Tuma","Split"].includes(s.payment_method) && (
                          <div style={{fontSize:12,color:"var(--teal)",marginTop:4}}>
                            📱 Phone: {s.phone||s.mpesa_phone}
                          </div>
                        )}
                        {s.mpesa_ref && (
                          <div style={{fontSize:12,color:"var(--teal)",marginTop:4}}>
                            M-Pesa Ref: {s.mpesa_ref}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="page-btn" disabled={page===1} onClick={() => setPage(p => p-1)}>← Prev</button>
          <span style={{color:"var(--text3)",fontSize:13}}>Page {page} of {pages} · {total} records</span>
          <button className="page-btn" disabled={page>=pages} onClick={() => setPage(p => p+1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
