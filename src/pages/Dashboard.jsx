import { useState, useEffect, useMemo } from "react";
import { reportsAPI } from "../services/api";
import { getDashboardRange } from "../lib/dateRange";
import { useStore } from "../context/StoreContext";
import StatCard       from "../components/StatCard";
import RevenueChart   from "../components/RevenueChart";
import TopSellers     from "../components/TopSellers";
import StockAlerts    from "../components/StockAlerts";
import SalesByCashier from "../components/SalesByCashier";
import RecentSales    from "../components/RecentSales";

const PERIOD_LABEL = { today: "Today", week: "This week", year: "This year" };

export default function Dashboard() {
  const [period, setPeriod]   = useState("today");
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const store = useStore();

  const range = useMemo(() => getDashboardRange(period), [period]);

  useEffect(() => {
    setLoading(true);
    setSummary(null);
    reportsAPI.summary({ from: range.from, to: range.to })
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const fmt = n => `KES ${Number(n ?? 0).toLocaleString()}`;

  const stats = summary ? (() => {
    const tr = Number(summary.total_revenue ?? 0);
    const tp = Number(summary.total_profit ?? 0);
    const tu = Number(summary.total_units ?? 0);
    const tt = Number(summary.total_transactions ?? 0);
    const todayRev = Number(summary.today_revenue ?? 0);
    const pct = Number(summary.pct_change ?? 0);
    const revDisplay = period === "today" ? todayRev : tr;
    const revLabel = period === "today" ? "Today's revenue" : period === "week" ? "Week revenue" : "Year revenue";
    const revUp = period === "today" ? pct >= 0 : tr >= 0;
    return [
      {
        label: revLabel,
        value: fmt(revDisplay),
        change: period === "today" ? `${pct >= 0 ? "+" : ""}${pct}%` : "",
        up: revUp,
        sub: period === "today" ? "vs yesterday" : `${PERIOD_LABEL[period]} · ${tt} txns`,
        accent: "#f5a623",
        icon: "↗",
      },
      { label: "Units sold", value: String(Math.round(tu)), change: "", up: tu >= 0, sub: PERIOD_LABEL[period], accent: "#4ecdc4", icon: "👟" },
      { label: "Gross profit", value: fmt(tp), change: "", up: tp >= 0, sub: `${tt} transactions`, accent: "#a8e6cf", icon: "◈" },
      { label: "Low stock items", value: String(summary.low_stock_count ?? 0), change: "", up: false, sub: "need restocking", accent: "#ff6b6b", icon: "⚠" },
    ];
  })() : [
    { label: "Revenue", value: "—", change: "", up: true, sub: "loading…", accent: "#f5a623", icon: "↗" },
    { label: "Units sold", value: "—", change: "", up: true, sub: "loading…", accent: "#4ecdc4", icon: "👟" },
    { label: "Gross profit", value: "—", change: "", up: true, sub: "loading…", accent: "#a8e6cf", icon: "◈" },
    { label: "Low stock items", value: "—", change: "", up: false, sub: "loading…", accent: "#ff6b6b", icon: "⚠" },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">{store.store_name} · {store.store_location} · {store.store_phone}</p>
        </div>
        <div className="dashboard-toolbar">
          <label className="period-select-label" htmlFor="dash-period">Period</label>
          <select
            id="dash-period"
            className="period-select"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            aria-label="Dashboard period"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="year">This year</option>
          </select>
        </div>
      </div>

      <div className="stats-grid">
        {stats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      <div className="dashboard-grid">
        <div className="grid-col-wide">
          <RevenueChart period={period} range={range} />
          <RecentSales range={range} />
        </div>
        <div className="grid-col-narrow">
          <TopSellers range={range} period={period} />
          <StockAlerts />
          <SalesByCashier range={range} period={period} />
        </div>
      </div>
    </div>
  );
}
