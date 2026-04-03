import { useEffect, useState } from "react";
import { reportsAPI } from "../services/api";

const fmt = n => `KES ${Number(n || 0).toLocaleString()}`;

const LABELS = { today: "Today", week: "This week", year: "This year" };

export default function TopSellers({ range, period }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    reportsAPI.topProducts({ from: range.from, to: range.to, limit: 5 })
      .then(res => setItems(res.data || []))
      .catch(() => setItems([]));
  }, [range?.from, range?.to]);

  const maxUnits = Math.max(...items.map(i => i.units_sold), 1);
  const COLORS = ["#f5a623", "#4ecdc4", "#a8e6cf", "#f5a623", "#4ecdc4"];

  return (
    <div className="panel-card">
      <div className="panel-header">
        <div>
          <div className="card-title">Top sellers</div>
          <div className="card-sub">{LABELS[period] || "Period"}</div>
        </div>
        <span className="badge">↑ units</span>
      </div>
      <div className="sellers-list">
        {items.length === 0 && <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: 16 }}>No data for this period</div>}
        {items.map((item, i) => (
          <div key={item.product_id ?? i} className="seller-row">
            <div className="seller-rank">{i + 1}</div>
            <div className="seller-info">
              <div className="seller-name">{item.name}</div>
              <div className="seller-bar-wrap">
                <div className="seller-bar" style={{ width: `${(item.units_sold / maxUnits) * 100}%`, background: COLORS[i] }} />
              </div>
            </div>
            <div className="seller-stats">
              <div className="seller-sold">{item.units_sold} pairs</div>
              <div className="seller-rev">{fmt(item.revenue)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
