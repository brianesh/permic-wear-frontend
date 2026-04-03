import { useEffect, useState } from "react";
import { reportsAPI } from "../services/api";

const fmt = n => (Number(n || 0) >= 1000 ? `${(Number(n) / 1000).toFixed(0)}k` : Number(n || 0).toLocaleString());

const LABELS = { today: "Today", week: "This week", year: "This year" };

export default function SalesByCashier({ range, period }) {
  const [cashiers, setCashiers] = useState([]);

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    reportsAPI.cashiers({ from: range.from, to: range.to })
      .then(res => setCashiers(res.data || []))
      .catch(() => setCashiers([]));
  }, [range?.from, range?.to]);

  const maxRev = Math.max(...cashiers.map(c => parseFloat(c.revenue) || 0), 1);

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="card-title">Sales by cashier</div>
          <div className="card-sub">{LABELS[period] || "Period"}</div>
        </div>
      </div>
      <div className="cashier-list">
        {cashiers.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>No data for this period</div>}
        {cashiers.map((c, i) => (
          <div key={c.id ?? i} className="cashier-row">
            <div className="cashier-avatar">{c.avatar}</div>
            <div className="cashier-info">
              <div className="cashier-name">{c.name}</div>
              <div className="cashier-bar-wrap">
                <div className="cashier-bar" style={{ width: `${(parseFloat(c.revenue) / maxRev) * 100}%` }} />
              </div>
            </div>
            <div className="cashier-stats">
              <div className="cashier-sales">{c.transactions} sales</div>
              <div className="cashier-rev">KES {fmt(c.revenue)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
