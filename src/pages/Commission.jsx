import { useState, useEffect, useCallback } from "react";
import { reportsAPI, salesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

const fmt     = n => `KES ${Number(n || 0).toLocaleString()}`;
const fmtPlus = n => { const v = Number(n || 0); return v > 0 ? `+${fmt(v)}` : fmt(v); };

function localYmd(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getRange(p) {
  const today = localYmd();
  if (p === 'day')   return { from: today, to: today };
  if (p === 'week')  { const s = new Date(); s.setDate(s.getDate()-6); return { from: localYmd(s), to: today }; }
  const s = new Date(); s.setDate(1);
  return { from: localYmd(s), to: today };
}

const PERIOD_LABELS = { day: 'Today', week: 'Last 7 Days', month: 'This Month' };
const ROLE_COLOR    = { super_admin: '#f5a623', admin: '#4ecdc4', cashier: '#a8e6cf' };
const ROLE_LABEL    = { super_admin: 'Super Admin', admin: 'Admin', cashier: 'Cashier' };

export default function Commission() {
  const { user, commissionRate } = useAuth();
  const [period, setPeriod]     = useState('day');
  const [staff, setStaff]       = useState([]);   // from /reports/cashiers — one row per user
  const [sales, setSales]       = useState([]);   // raw sales list
  const [loading, setLoading]   = useState(true);
  const [tick, setTick]         = useState(0);
  const [error, setError]       = useState('');

  const isSuperAdmin = user?.role === 'super_admin';
  const isAdmin      = user?.role === 'admin';
  const isCashier    = user?.role === 'cashier';

  const load = useCallback(() => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const range = getRange(period);

    Promise.all([
      reportsAPI.cashiers(range),
      salesAPI.getAll({ ...range, limit: 500 }),
    ])
      .then(([staffRes, salesRes]) => {
        setStaff(staffRes.data  || []);
        setSales(salesRes.data?.sales || []);
      })
      .catch(err => {
        console.error('[Commission] load error:', err?.response?.data || err?.message);
        setError('Failed to load commission data. Check server logs.');
      })
      .finally(() => setLoading(false));
  }, [period, user?.id]);

  useEffect(() => { load(); }, [load, tick]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // My own row from staff array
  const myRow   = staff.find(c => Number(c.id) === Number(user?.id));
  // My own sales
  const mySales = sales.filter(s => Number(s.cashier_id) === Number(user?.id));

  // ── Cashier: single-person hero card ─────────────────────────
  const CashierHero = () => (
    <div className="commission-hero">
      <div className="commission-hero-avatar">{myRow?.avatar || user?.avatar}</div>
      <div className="commission-hero-name">{user?.name}</div>
      <div className="commission-hero-period">{PERIOD_LABELS[period]}</div>
      <div className="commission-kpi-row">
        {[
          { label: 'Sales Made',        value: myRow?.transactions || 0,  unit: 'transactions',        color: 'var(--teal)'  },
          { label: 'Revenue Generated', value: fmt(myRow?.revenue),       unit: 'total',               color: 'var(--gold)'  },
          { label: 'Commission Earned', value: fmtPlus(myRow?.commission),unit: `at ${commissionRate}%`, color: 'var(--green)' },
          { label: 'Avg Sale Value',    value: fmt(myRow?.avg_sale),      unit: 'per transaction',     color: 'var(--gold)'  },
        ].map((k, i) => (
          <div key={i} className="commission-kpi-card" style={{ '--kpi-color': k.color }}>
            <div className="commission-kpi-label">{k.label}</div>
            <div className="commission-kpi-value">{k.value}</div>
            <div className="commission-kpi-unit">{k.unit}</div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Admin/SuperAdmin: individual card per staff member ────────
  const StaffCards = () => {
    const maxComm = Math.max(...staff.map(c => parseFloat(c.commission) || 0), 1);
    return (
      <div className="commission-all-grid">
        {staff.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', gridColumn: '1/-1' }}>
            No commission data for {PERIOD_LABELS[period].toLowerCase()}
          </div>
        )}
        {staff.map((c, i) => {
          const rc  = ROLE_COLOR[c.role] || 'var(--text3)';
          const pct = Math.round((parseFloat(c.commission) || 0) / maxComm * 100);
          // sales belonging to this person
          const personSales = sales.filter(s => Number(s.cashier_id) === Number(c.id));
          return (
            <div key={i} className="commission-card">
              <div className="commission-card-header">
                <div className="commission-card-avatar"
                  style={{ background: `linear-gradient(135deg,${rc},${rc}88)` }}>
                  {c.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="commission-card-name">{c.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: rc,
                      background: `${rc}22`, padding: '1px 7px', borderRadius: 20 }}>
                      {ROLE_LABEL[c.role] || c.role}
                    </span>
                    <span className="commission-card-period">{PERIOD_LABELS[period]}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>Rate</div>
                  <div style={{ fontWeight: 700, color: 'var(--gold)', fontSize: 13 }}>{c.commission_rate}%</div>
                </div>
              </div>

              <div className="commission-card-stats">
                <div className="commission-stat">
                  <div className="commission-stat-label">Sales</div>
                  <div className="commission-stat-value">{c.transactions}</div>
                </div>
                <div className="commission-stat">
                  <div className="commission-stat-label">Revenue</div>
                  <div className="commission-stat-value">{fmt(c.revenue)}</div>
                </div>
                <div className="commission-stat">
                  <div className="commission-stat-label">Avg Sale</div>
                  <div className="commission-stat-value">{fmt(c.avg_sale)}</div>
                </div>
                <div className="commission-stat" style={{ gridColumn: '1/-1' }}>
                  <div className="commission-stat-label">Commission Earned</div>
                  <div className="commission-stat-value" style={{ color: 'var(--gold)', fontSize: 18 }}>
                    💰 {fmtPlus(c.commission)}
                  </div>
                </div>
              </div>

              {/* Progress bar relative to top earner */}
              <div className="seller-bar-wrap" style={{ marginTop: 8 }}>
                <div className="seller-bar"
                  style={{ width: `${pct}%`, background: `linear-gradient(90deg,${rc},var(--teal))` }}/>
              </div>

              {/* Individual sales breakdown for this person */}
              {personSales.length > 0 && (
                <details style={{ marginTop: 10 }}>
                  <summary style={{ fontSize: 12, color: 'var(--text3)', cursor: 'pointer', userSelect: 'none' }}>
                    View {personSales.length} sale{personSales.length !== 1 ? 's' : ''} ▸
                  </summary>
                  <div className="table-wrap" style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                    <table className="sales-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr><th>TXN</th><th>Total</th><th>Commission</th><th>Method</th><th>Date</th></tr>
                      </thead>
                      <tbody>
                        {personSales.map(s => (
                          <tr key={s.id}>
                            <td className="txn-id" style={{ fontSize: 11 }}>{s.txn_id}</td>
                            <td className="amount">{fmt(s.selling_total)}</td>
                            <td style={{ color: 'var(--gold)', fontWeight: 700 }}>
                              {fmtPlus(s.commission)}
                            </td>
                            <td>
                              <span className={`method-tag method-tag--${
                                s.payment_method === 'Cash' ? 'cash'
                                : s.payment_method === 'M-Pesa' ? 'm-pesa' : 'split'}`}>
                                {s.payment_method}
                              </span>
                            </td>
                            <td className="time" style={{ fontSize: 11 }}>
                              {new Date(s.sale_date).toLocaleString('en-KE')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="inv-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Commission</h1>
          <p className="page-sub">
            {isCashier    ? `${user?.name} · Rate: ${commissionRate}%`
             : isAdmin    ? 'Admin & cashier commissions — individual breakdown'
             : 'All staff commissions — individual breakdown'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['day','week','month'].map(v => (
            <button key={v} type="button"
              className={`period-btn ${period === v ? 'period-btn--active' : ''}`}
              onClick={() => setPeriod(v)}>
              {PERIOD_LABELS[v]}
            </button>
          ))}
          <button type="button" className="period-btn"
            disabled={loading || !user?.id}
            onClick={() => setTick(t => t + 1)}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="lf-error" style={{ marginBottom: 16 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {loading
        ? <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>Loading…</div>
        : isCashier
          ? (
            <>
              <CashierHero />
              {/* My sales table */}
              <div className="panel-card" style={{ marginTop: 20 }}>
                <div className="panel-header">
                  <div className="card-title">My Sales — {PERIOD_LABELS[period]}</div>
                  <span className="badge">{mySales.length} transactions</span>
                </div>
                <div className="table-wrap">
                  <table className="sales-table">
                    <thead>
                      <tr>
                        <th>TXN</th><th>Date &amp; Time</th><th>Items</th>
                        <th>Total</th><th>Commission</th><th>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mySales.length === 0 && (
                        <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>
                          No sales in this period
                        </td></tr>
                      )}
                      {mySales.map(s => (
                        <tr key={s.id}>
                          <td className="txn-id">{s.txn_id}</td>
                          <td className="time">{new Date(s.sale_date).toLocaleString('en-KE')}</td>
                          <td>{s.items?.length || 0} item(s)</td>
                          <td className="amount">{fmt(s.selling_total)}</td>
                          <td><span style={{ color: 'var(--gold)', fontWeight: 700 }}>
                            💰 {fmtPlus(s.commission)}
                          </span></td>
                          <td>
                            <span className={`method-tag method-tag--${
                              s.payment_method === 'Cash' ? 'cash'
                              : s.payment_method === 'M-Pesa' ? 'm-pesa' : 'split'}`}>
                              {s.payment_method}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )
          : <StaffCards />
      }
    </div>
  );
}
