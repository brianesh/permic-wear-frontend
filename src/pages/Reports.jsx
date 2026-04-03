import { useState, useEffect } from "react";
import { reportsAPI } from "../services/api";
import { useStore } from "../context/StoreContext";

const fmt = n => `KES ${Number(n||0).toLocaleString()}`;

function exportCSV(daily, from, to) {
  const rows=[["Date","Revenue","Profit","Commission","Units","Method"],
    ...daily.map(d=>[d.date,d.revenue,d.profit,d.commission,d.units,d.method||""])];
  const csv=rows.map(r=>r.join(",")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download=`report-${from}-${to}.csv`; a.click();
}

export default function Reports() {
  const store = useStore();
  const today      = new Date().toISOString().slice(0,10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);

  const [from, setFrom]         = useState(monthStart);
  const [to, setTo]             = useState(today);
  const [summary, setSummary]   = useState(null);
  const [daily, setDaily]       = useState([]);
  const [topProds, setTopProds] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [payMix, setPayMix]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const load = () => {
    setLoading(true);
    const p = { from, to };
    Promise.all([
      reportsAPI.summary(p), reportsAPI.daily(p),
      reportsAPI.topProducts({...p, limit:5}),
      reportsAPI.cashiers(p), reportsAPI.paymentMix(p),
    ]).then(([s,d,tp,c,pm]) => {
      setSummary(s.data || { total_revenue:0, total_profit:0, total_commission:0, total_transactions:0, total_units:0 });
      setDaily(d.data||[]);
      setTopProds(tp.data||[]);
      setCashiers(c.data||[]);
      setPayMix(pm.data||[]);
    }).catch(err => {
      console.error('[Reports] load error:', err?.response?.data || err?.message);
    }).finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); }, [from, to]);

  const maxRev = Math.max(...daily.map(d=>parseFloat(d.revenue||0)), 1);
  const totalCashierRev = cashiers.reduce((s,c)=>s+parseFloat(c.revenue||0),0)||1;
  const COLORS = { "M-Pesa":"var(--teal)", "Cash":"var(--green)", "Split":"var(--gold)" };

  return (
    <div className="inv-page">
      <div className="page-header">
        <div><h1 className="page-title">Reports & Analytics</h1><p className="page-sub">{store.store_name} · {store.store_location}</p></div>
        <button className="primary-btn" onClick={()=>exportCSV(daily,from,to)}>⬇ Export CSV</button>
      </div>

      <div className="rep-date-bar">
        <span style={{fontSize:13,color:"var(--text2)",fontWeight:500}}>Date Range:</span>
        <div className="date-filter-group">
          <input type="date" className="date-input" value={from} onChange={e=>setFrom(e.target.value)}/>
          <span style={{color:"var(--text3)"}}>to</span>
          <input type="date" className="date-input" value={to} onChange={e=>setTo(e.target.value)}/>
        </div>
        <button className="filter-chip filter-chip--active" onClick={()=>{
          const t = new Date().toISOString().slice(0,10);
          const s = new Date(); s.setDate(s.getDate()-6);
          setFrom(s.toISOString().slice(0,10)); setTo(t);
        }}>Last 7 Days</button>
        <button className="filter-chip" onClick={()=>{
          const t = new Date().toISOString().slice(0,10);
          const s = new Date(); s.setDate(1);
          setFrom(s.toISOString().slice(0,10)); setTo(t);
        }}>This Month</button>
        <button className="filter-chip" onClick={()=>{
          const t = new Date().toISOString().slice(0,10);
          setFrom(t); setTo(t);
        }}>Today</button>
      </div>

      {loading ? <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading…</div> : (
        <>
          <div className="rep-kpi-row">
            {[
              {label:"Total Revenue",  value:fmt(summary?.total_revenue),   sub:`${summary?.total_transactions||0} txns`,  color:"var(--gold)"},
              {label:"Gross Profit",   value:fmt(summary?.total_profit),    sub:`Margin ${summary?.total_revenue>0?Math.round(summary.total_profit/summary.total_revenue*100):0}%`, color:"var(--green)"},
              {label:"Units Sold",     value:summary?.total_units||0,       sub:"pairs",              color:"var(--teal)"},
              {label:"Commissions",    value:fmt(summary?.total_commission), sub:"cashier earnings",  color:"var(--gold)"},
              {label:"Transactions",   value:summary?.total_transactions||0, sub:"total sales",       color:"var(--teal)"},
              {label:"Avg Sale",       value:fmt(summary?.total_transactions>0?Math.round(summary.total_revenue/summary.total_transactions):0), sub:"per sale", color:"var(--green)"},
            ].map((k,i)=>(
              <div key={i} className="rep-kpi-card" style={{"--kpi-color":k.color}}>
                <div className="rep-kpi-label">{k.label}</div>
                <div className="rep-kpi-value">{k.value}</div>
                <div className="rep-kpi-sub">{k.sub}</div>
              </div>
            ))}
          </div>

          <div className="rep-grid">
            <div className="panel-card">
              <div className="panel-header">
                <div><div className="card-title">Daily Revenue vs Profit</div></div>
                <div style={{display:"flex",gap:12}}>
                  <div className="legend-item"><div className="legend-dot" style={{background:"var(--gold)"}}/> Revenue</div>
                  <div className="legend-item"><div className="legend-dot" style={{background:"var(--green)"}}/> Profit</div>
                </div>
              </div>
              {daily.length===0
                ? <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>No data</div>
                : <div className="rep-bar-chart">
                    {daily.slice(-14).map((d,i)=>(
                      <div key={i} className="rep-bar-group">
                        <div className="rep-bar-pair">
                          <div className="rep-bar rep-bar--rev"    style={{height:`${(parseFloat(d.revenue||0)/maxRev)*140}px`}}/>
                          <div className="rep-bar rep-bar--profit" style={{height:`${(parseFloat(d.profit||0)/maxRev)*140}px`}}/>
                        </div>
                        <div className="rep-bar-label">{String(d.date||"").slice(5)}</div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            <div className="panel-card">
              <div className="panel-header"><div className="card-title">Payment Mix</div></div>
              <div className="rep-donut-wrap">
                <svg viewBox="0 0 120 120" className="rep-donut">
                  {(()=>{
                    let offset=0;
                    return payMix.map((p,i)=>{
                      const circ=2*Math.PI*45, dash=(p.pct/100)*circ;
                      const el=<circle key={i} cx="60" cy="60" r="45" fill="none" stroke={COLORS[p.method]||"var(--text3)"} strokeWidth="18" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset} style={{transform:"rotate(-90deg)",transformOrigin:"60px 60px"}}/>;
                      offset+=dash; return el;
                    });
                  })()}
                  <text x="60" y="56" textAnchor="middle" fill="var(--text)" fontSize="13" fontFamily="Bebas Neue">{payMix.find(p=>p.method==="M-Pesa")?.pct||0}%</text>
                  <text x="60" y="68" textAnchor="middle" fill="var(--text3)" fontSize="6">M-Pesa</text>
                </svg>
              </div>
              <div className="rep-pay-list">
                {payMix.map((p,i)=>(
                  <div key={i} className="rep-pay-row">
                    <div className="rep-pay-dot" style={{background:COLORS[p.method]||"var(--text3)"}}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,fontWeight:500,color:"var(--text)"}}>{p.method}</span><span style={{fontSize:13}}>{p.pct}%</span></div>
                      <div className="seller-bar-wrap"><div className="seller-bar" style={{width:`${p.pct}%`,background:COLORS[p.method]||"var(--text3)"}}/></div>
                      <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>{fmt(p.total)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel-card" style={{marginTop:16}}>
            <div className="panel-header"><div className="card-title">Top Products</div><span className="badge">By Revenue</span></div>
            <div className="table-wrap">
              <table className="sales-table">
                <thead><tr><th>#</th><th>Product</th><th>Units</th><th>Revenue</th><th>Profit</th><th>Margin</th><th>Performance</th></tr></thead>
                <tbody>
                  {topProds.map((p,i)=>(
                    <tr key={i}>
                      <td style={{fontFamily:"Bebas Neue",fontSize:18,color:"var(--text3)"}}>{i+1}</td>
                      <td style={{fontWeight:600,color:"var(--text)"}}>{p.name}</td>
                      <td>{p.units_sold} pairs</td>
                      <td className="amount">{fmt(p.revenue)}</td>
                      <td className="profit">+{fmt(p.profit)}</td>
                      <td><span style={{color:p.margin_pct>18?"var(--green)":"var(--gold)",fontWeight:600}}>{p.margin_pct}%</span></td>
                      <td style={{width:120}}><div className="seller-bar-wrap"><div className="seller-bar" style={{width:`${topProds[0]?.revenue>0?(p.revenue/topProds[0].revenue)*100:0}%`,background:"linear-gradient(90deg,var(--gold),var(--gold)88)"}}/></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card" style={{marginTop:16}}>
            <div className="panel-header"><div className="card-title">Cashier Performance & Commissions</div></div>
            <div className="table-wrap">
              <table className="sales-table">
                <thead><tr><th>Staff</th><th>Role</th><th>Transactions</th><th>Revenue</th><th>Avg Sale</th><th>Commission</th><th>Share</th></tr></thead>
                <tbody>
                  {cashiers.map((c,i)=>(
                    <tr key={i}>
                      <td><div style={{display:"flex",alignItems:"center",gap:8}}><div className="cashier-avatar">{c.avatar}</div><span style={{fontWeight:500,color:"var(--text)"}}>{c.name}</span></div></td>
                      <td><span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:20,background:"var(--bg3)",color:"var(--text3)"}}>{c.role||"—"}</span></td>
                      <td>{c.transactions}</td>
                      <td className="amount">{fmt(c.revenue)}</td>
                      <td>{fmt(c.avg_sale)}</td>
                      <td><span style={{color:"var(--gold)",fontWeight:700}}>💰 {fmt(c.commission)}</span></td>
                      <td style={{width:140}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div className="cashier-bar-wrap" style={{flex:1}}><div className="cashier-bar" style={{width:`${(parseFloat(c.revenue)||0)/totalCashierRev*100}%`}}/></div>
                          <span style={{fontSize:11,color:"var(--text3)"}}>{Math.round((parseFloat(c.revenue)||0)/totalCashierRev*100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
