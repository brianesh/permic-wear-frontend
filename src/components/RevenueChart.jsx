import { useEffect, useState } from "react";
import { reportsAPI } from "../services/api";

const PERIOD_SUB = { today: "Today", week: "Last 7 days", year: "Year to date" };

export default function RevenueChart({ period, range }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!range?.from || !range?.to) return;
    setLoading(true);
    reportsAPI.daily({ from: range.from, to: range.to })
      .then(res => {
        const rows = res.data || [];
        setData([...rows].sort((a, b) => String(a.date).localeCompare(String(b.date))));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [range?.from, range?.to]);

  const maxVal = Math.max(...data.map(d => parseFloat(d.revenue || 0)), 1);
  const W = 560;
  const H = 160;
  const PAD = 32;
  const bw = data.length ? Math.floor((W - PAD * 2) / data.length) : 60;
  const bar = Math.max(2, Math.floor(bw * 0.32));

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <div className="card-title">Revenue breakdown</div>
          <div className="card-sub">Cash vs M-Pesa · {PERIOD_SUB[period] || period}</div>
        </div>
        <div className="chart-legend">
          <div className="legend-item"><div className="legend-dot" style={{ background: "var(--gold)" }} /> Cash</div>
          <div className="legend-item"><div className="legend-dot" style={{ background: "var(--teal)" }} /> M-Pesa</div>
        </div>
      </div>
      {loading ? (
        <div style={{ height: 188, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 13 }}>Loading chart…</div>
      ) : data.length === 0 ? (
        <div style={{ height: 188, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 13 }}>No data for this period</div>
      ) : (
        <div className="revenue-chart-svg-wrap">
          <svg viewBox={`0 0 ${W} ${H + 28}`} className="revenue-svg" preserveAspectRatio="xMidYMid meet">
            {data.map((d, i) => {
              const x = PAD + i * bw + bw / 2;
              const cash = parseFloat(d.cash_total || 0);
              const mpesa = parseFloat(d.mpesa_total || 0);
              const ch = Math.max(2, Math.round((cash / maxVal) * H));
              const mh = Math.max(2, Math.round((mpesa / maxVal) * H));
              const raw = d.date != null ? String(d.date) : "";
              const lbl = raw.length >= 10 ? raw.slice(5, 10) : raw.slice(5) || "—";
              return (
                <g key={i}>
                  <rect x={x - bar - 2} y={H - ch} width={bar} height={ch} rx={3} fill="var(--gold)" opacity="0.85" />
                  <rect x={x + 2} y={H - mh} width={bar} height={mh} rx={3} fill="var(--teal)" opacity="0.85" />
                  <text x={x} y={H + 18} textAnchor="middle" fontSize="10" fill="var(--text3)" fontFamily="DM Sans, sans-serif">{lbl}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
