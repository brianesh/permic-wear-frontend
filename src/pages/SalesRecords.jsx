import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { salesAPI, usersAPI } from "../services/api";

const fmt = n => `KES ${Number(n||0).toLocaleString()}`;
const METHODS = ["All","Cash","M-Pesa","Split"];
const STATUS_FILTERS = ["All","completed","pending_mpesa","pending_split","failed"];

export default function SalesRecords() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const isGlobalMode = isSuperAdmin && !localStorage.getItem("active_store_id");
  const [sales, setSales]         = useState([]);
  const [total, setTotal]         = useState(0);
  const [cashiers, setCashiers]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [cashier, setCashier]     = useState("All");
  const [method, setMethod]       = useState("All");
  const [status, setStatus]       = useState("All"); // Default: show all (including completed)
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [expanded, setExpanded]   = useState(null);
  const [page, setPage]           = useState(1);
  const PER = 10;

  useEffect(() => {
    usersAPI.getAll().then(res => setCashiers(["All", ...res.data.filter(u=>u.role==="cashier").map(u=>u.name)])).catch(()=>{});
  }, []);

  useEffect(() => { load(); }, [page, cashier, method, status, dateFrom, dateTo]);

  const load = () => {
    setLoading(true);
    const fetchFn = isGlobalMode ? salesAPI.getAllStores : salesAPI.getAll;
    fetchFn({
      from: dateFrom || undefined, to: dateTo || undefined,
      method: method !== "All" ? method : undefined,
      status: status !== "All" ? status : undefined,
      page, limit: PER,
    })
    .then(res => { setSales(res.data.sales || []); setTotal(res.data.total || 0); })
    .catch(() => setSales([]))
    .finally(() => setLoading(false));
  };

  const filtered = sales.filter(s =>
    (s.txn_id?.toLowerCase().includes(search.toLowerCase()) || s.cashier_name?.toLowerCase().includes(search.toLowerCase())) &&
    (cashier === "All" || s.cashier_name === cashier)
  );

  const totalRev   = filtered.reduce((s,t) => s + parseFloat(t.selling_total||0), 0);
  const totalProfit= filtered.reduce((s,t) => s + parseFloat(t.extra_profit||0), 0);
  const cashTotal  = filtered.filter(t=>t.payment_method==="Cash").reduce((s,t) => s + parseFloat(t.selling_total||0), 0);
  const mpesaTotal = filtered.filter(t=>t.payment_method==="M-Pesa").reduce((s,t) => s + parseFloat(t.selling_total||0), 0);
  const pages = Math.max(1, Math.ceil(total / PER));

  const exportCSV = () => {
    const rows = [["TXN ID","Date","Cashier","Total","Profit","Method"], ...filtered.map(s=>[s.txn_id, new Date(s.sale_date).toLocaleDateString(), s.cashier_name, s.selling_total, s.extra_profit, s.payment_method])];
    const csv = rows.map(r=>r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="sales-export.csv"; a.click();
  };

  return (
    <div className="inv-page">
      <div className="page-header">
        <div><h1 className="page-title">Sales Records</h1><p className="page-sub">{total} total transactions{isGlobalMode ? " · All Stores" : ""}</p></div>
        <button className="primary-btn" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      <div className="sales-summary-grid">
        {[["Total Revenue",fmt(totalRev),"var(--text)"],["Total Profit",fmt(totalProfit),"var(--green)"],["Cash Sales",fmt(cashTotal),"var(--text)"],["M-Pesa Sales",fmt(mpesaTotal),"var(--teal)"]].map(([l,v,c])=>(
          <div key={l} className="summary-card"><div className="summary-label">{l}</div><div className="summary-value" style={{color:c}}>{v}</div></div>
        ))}
      </div>

      <div className="inv-filters" style={{flexWrap:"wrap"}}>
        <div className="pos-search-wrap" style={{flex:1,minWidth:220}}>
          <span className="pos-search-icon">↗</span>
          <input className="pos-search" placeholder="Search TXN ID or cashier…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="filter-group">{cashiers.map(c=><button key={c} className={`filter-chip ${cashier===c?"filter-chip--active":""}`} onClick={()=>{setCashier(c);setPage(1);}}>{c}</button>)}</div>
        <div className="filter-group">{METHODS.map(m=><button key={m} className={`filter-chip ${method===m?"filter-chip--active":""}`} onClick={()=>{setMethod(m);setPage(1);}}>{m}</button>)}</div>
        <div className="filter-group">{STATUS_FILTERS.map(s=><button key={s} className={`filter-chip ${status===s?"filter-chip--active":""}`} onClick={()=>{setStatus(s);setPage(1);}}>{s}</button>)}</div>
        <div className="date-filter-group">
          <input type="date" className="date-input" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);setPage(1);}}/>
          <span style={{color:"var(--text3)"}}>to</span>
          <input type="date" className="date-input" value={dateTo} onChange={e=>{setDateTo(e.target.value);setPage(1);}}/>
        </div>
      </div>

      <div className="panel-card" style={{padding:0}}>
        <div className="table-wrap">
          <table className="sales-table">
            <thead><tr><th>TXN ID</th><th>Date & Time</th><th>Cashier</th>{isGlobalMode && <th>Store</th>}<th>Items</th><th>Total</th><th>Profit</th><th>Commission</th><th>Method</th><th></th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={isGlobalMode ? 10 : 9} style={{textAlign:"center",padding:24,color:"var(--text3)"}}>Loading…</td></tr>}
              {!loading && filtered.map(s=>(
                <>
                  <tr key={s.id} style={{cursor:"pointer"}} onClick={()=>setExpanded(expanded===s.id?null:s.id)}>
                    <td className="txn-id">{s.txn_id}</td>
                    <td className="time">{new Date(s.sale_date).toLocaleString("en-KE")}</td>
                    <td>{s.cashier_name}</td>
                    {isGlobalMode && <td style={{fontSize:11,color:"var(--text3)"}}>{s.store_name || "—"}</td>}
                    <td>{s.items?.length || 0} item(s)</td>
                    <td className="amount">{fmt(s.selling_total)}</td>
                    <td className="profit">+{fmt(s.extra_profit)}</td>
                    <td style={{color:"var(--gold)",fontWeight:600}}>💰 {fmt(s.commission)}</td>
                    <td><span className={`method-tag method-tag--${s.payment_method==="Cash"?"cash":s.payment_method==="M-Pesa"?"m-pesa":"split"}`}>{s.payment_method}</span></td>
                    <td>
                      {s.status === 'completed' && <span style={{fontSize:11,color:"var(--green)"}}>✓</span>}
                      {s.status === 'pending_mpesa' && <span style={{fontSize:11,color:"var(--gold)"}}>⏳</span>}
                      {s.status === 'pending_split' && <span style={{fontSize:11,color:"var(--gold)"}}>⏳</span>}
                      {s.status === 'failed' && <span style={{fontSize:11,color:"var(--red)"}}>✕</span>}
                    </td>
                    <td style={{color:"var(--text3)",fontSize:12}}>{expanded===s.id?"▲":"▼"}</td>
                  </tr>
                  {expanded===s.id&&(
                    <tr key={s.id+"-exp"}>
                      <td colSpan={9} style={{background:"var(--bg3)",padding:"12px 20px"}}>
                        {(s.items||[]).map((it,i)=>(
                          <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--text2)",marginBottom:4}}>
                            <span>{it.product_name} Sz{it.size} × {it.qty} @ {fmt(it.selling_price)}</span>
                            <span style={{color:"var(--text)"}}>{fmt(it.selling_price*it.qty)}</span>
                          </div>
                        ))}
                        {s.payment_method==="Cash"&&<div style={{fontSize:12,color:"var(--text3)",marginTop:6}}>Amount paid: {fmt(s.amount_paid)} · Change: {fmt(s.change_given)}</div>}
                        {s.mpesa_ref&&<div style={{fontSize:12,color:"var(--teal)",marginTop:4}}>M-Pesa Ref: {s.mpesa_ref}</div>}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination">
          <button className="page-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{color:"var(--text3)",fontSize:13}}>Page {page} of {pages} · {total} records</span>
          <button className="page-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
