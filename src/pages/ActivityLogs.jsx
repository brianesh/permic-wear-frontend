import { useState, useEffect } from "react";
import { logsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const CAT_COLOR = {
  auth:      { dot:"var(--teal)",  bg:"rgba(78,205,196,0.12)",  label:"Auth"      },
  sale:      { dot:"var(--green)", bg:"rgba(168,230,207,0.12)", label:"Sale"      },
  inventory: { dot:"var(--gold)",  bg:"rgba(245,166,35,0.12)",  label:"Inventory" },
  users:     { dot:"#a78bfa",      bg:"rgba(167,139,250,0.12)", label:"Users"     },
  settings:  { dot:"var(--text2)", bg:"rgba(255,255,255,0.06)", label:"Settings"  },
  general:   { dot:"var(--text3)", bg:"rgba(255,255,255,0.04)", label:"General"   },
};
const ACTION_ICON = { login:"🔓", logout:"🔒", sale:"💰", product_added:"➕", product_edited:"✏️", product_deleted:"🗑️", user_created:"👤", user_edited:"✏️", user_deleted:"❌", settings_saved:"⚙️", csv_import:"📥", password_changed:"🔑", mpesa_stk_sent:"📱" };
const CATEGORIES = ["All","auth","sale","inventory","users","settings"];
const ROLES      = ["All","super_admin","admin","cashier"];
const ROLE_LABEL = { super_admin:"Super Admin", admin:"Admin", cashier:"Cashier" };

export default function ActivityLogs() {
  const { user } = useAuth();
  const [logs, setLogs]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [cat, setCat]           = useState("All");
  const [role, setRole]         = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [page, setPage]         = useState(1);
  const PER = 15;

  const load = () => {
    setLoading(true);
    logsAPI.getAll({
      category: cat  !== "All" ? cat  : undefined,
      role:     role !== "All" ? role : undefined,
      search:   search   || undefined,
      from:     dateFrom || undefined,
      to:       dateTo   || undefined,
      page, limit: PER,
    })
      .then(res => { setLogs(res.data.logs||[]); setTotal(res.data.total||0); })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [cat, role, dateFrom, dateTo, page]);

  const clearLogs = async () => {
    if (!window.confirm("Clear all activity logs? This cannot be undone.")) return;
    try { await logsAPI.clear(); load(); } catch {}
  };

  const pages = Math.max(1, Math.ceil(total / PER));

  return (
    <div className="inv-page logs-page">
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-sub">{total} events · Full audit trail</p>
        </div>
        {user?.role==="super_admin" && (
          <button className="primary-btn" style={{background:"var(--red)",color:"#fff"}} onClick={clearLogs}>
            🗑 Clear Logs
          </button>
        )}
      </div>

      {/* ── Category chips ── */}
      <div className="log-chips-row">
        {Object.entries(CAT_COLOR).filter(([k])=>k!=="general").map(([key,val])=>(
          <button
            key={key}
            className={`log-chip ${cat===key?"log-chip--active":""}`}
            style={{"--chip-col":val.dot}}
            onClick={()=>{ setCat(cat===key?"All":key); setPage(1); }}
          >
            <span className="log-chip-dot" style={{background:val.dot}}/>
            <span>{val.label}</span>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="logs-filters">
        <div className="logs-search-wrap">
          <span className="pos-search-icon">🔍</span>
          <input
            className="pos-search"
            placeholder="Search user, action, detail…"
            value={search}
            onChange={e=>{ setSearch(e.target.value); setPage(1); }}
            onKeyDown={e=>e.key==="Enter"&&load()}
          />
        </div>
        <div className="logs-filter-row">
          <div className="filter-group">
            {ROLES.map(r=>(
              <button
                key={r}
                className={`filter-chip ${role===r?"filter-chip--active":""}`}
                onClick={()=>{ setRole(r); setPage(1); }}
              >
                {r==="All"?"All Roles":ROLE_LABEL[r]||r}
              </button>
            ))}
          </div>
          <div className="logs-date-row">
            <input type="date" className="date-input" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
            <span className="logs-date-sep">to</span>
            <input type="date" className="date-input" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* ── Log entries ── */}
      <div className="panel-card logs-panel">
        {/* Desktop table — hidden on mobile */}
        <div className="logs-table-wrap">
          <table className="sales-table logs-table">
            <thead>
              <tr>
                <th style={{width:140}}>Time</th>
                <th style={{width:160}}>User</th>
                <th style={{width:160}}>Action</th>
                <th style={{width:120}}>Target</th>
                <th>Detail</th>
                <th style={{width:90}}>Category</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="logs-empty">Loading…</td></tr>
              )}
              {!loading && logs.length===0 && (
                <tr><td colSpan={6} className="logs-empty">No logs match your filters</td></tr>
              )}
              {!loading && logs.map(l=>{
                const cv = CAT_COLOR[l.category]||CAT_COLOR.general;
                return (
                  <tr key={l.id}>
                    <td className="time">{new Date(l.logged_at).toLocaleString("en-KE")}</td>
                    <td>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <div className="log-user-dot" style={{background:cv.dot}}/>
                        <div>
                          <div style={{fontWeight:600,color:"var(--text)",fontSize:12,lineHeight:1.3}}>{l.user_name}</div>
                          <div style={{fontSize:10,color:"var(--text3)"}}>{ROLE_LABEL[l.user_role]||l.user_role}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="log-action-badge" style={{background:cv.bg,color:cv.dot}}>
                        {ACTION_ICON[l.action]||"•"} {l.action.replace(/_/g," ")}
                      </span>
                    </td>
                    <td style={{color:"var(--text)",fontWeight:500,fontSize:12}}>{l.target}</td>
                    <td style={{color:"var(--text2)",fontSize:12,wordBreak:"break-word"}}>{l.detail}</td>
                    <td>
                      <span className="log-cat-tag" style={{background:cv.bg,color:cv.dot}}>{cv.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards — shown only on small screens */}
        <div className="logs-cards">
          {loading && <div className="logs-empty">Loading…</div>}
          {!loading && logs.length===0 && <div className="logs-empty">No logs match your filters</div>}
          {!loading && logs.map(l=>{
            const cv = CAT_COLOR[l.category]||CAT_COLOR.general;
            return (
              <div key={l.id} className="log-card">
                <div className="log-card-top">
                  <span className="log-action-badge" style={{background:cv.bg,color:cv.dot}}>
                    {ACTION_ICON[l.action]||"•"} {l.action.replace(/_/g," ")}
                  </span>
                  <span className="log-cat-tag" style={{background:cv.bg,color:cv.dot}}>{cv.label}</span>
                </div>
                <div className="log-card-detail">{l.detail}</div>
                <div className="log-card-meta">
                  <span style={{color:"var(--text)",fontWeight:600}}>{l.user_name}</span>
                  <span style={{color:"var(--text3)"}}>·</span>
                  <span style={{color:"var(--text3)"}}>{ROLE_LABEL[l.user_role]||l.user_role}</span>
                  <span style={{color:"var(--text3)"}}>·</span>
                  <span className="time">{new Date(l.logged_at).toLocaleString("en-KE")}</span>
                </div>
                {l.target && <div className="log-card-target">Target: <strong>{l.target}</strong></div>}
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        <div className="pagination">
          <button className="page-btn" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{color:"var(--text3)",fontSize:13}}>Page {page} of {pages} · {total} entries</span>
          <button className="page-btn" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      </div>
    </div>
  );
}
