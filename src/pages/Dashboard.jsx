import { useState, useEffect, useMemo, useRef } from "react";
import { reportsAPI } from "../services/api";
import { getDashboardRange } from "../lib/dateRange";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import StatCard       from "../components/StatCard";
import RevenueChart   from "../components/RevenueChart";
import TopSellers     from "../components/TopSellers";
import StockAlerts    from "../components/StockAlerts";
import SalesByCashier from "../components/SalesByCashier";
import RecentSales    from "../components/RecentSales";

const PERIOD_LABEL = { today: "Today", week: "This week", year: "This year" };

// Format a JS Date to "YYYY-MM-DD" in local time (not UTC)
const toLocalISO = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Human-readable label for the custom range badge
const formatRangeLabel = (from, to) => {
  if (!from && !to) return "Custom";
  const opts = { day: "numeric", month: "short" };
  const f = from ? new Date(from + "T00:00:00").toLocaleDateString("en-KE", opts) : "…";
  const t = to   ? new Date(to   + "T00:00:00").toLocaleDateString("en-KE", opts) : "…";
  return from === to ? f : `${f} – ${t}`;
};

// Format date range for revenue sub-label with time details
const formatRevenueDateRange = (period, from, to) => {
  const opts = { day: "numeric", month: "short", year: "numeric" };
  if (period === "today") {
    const today = new Date().toLocaleDateString("en-KE", opts);
    return `${today} (00:00 – 23:59)`;
  }
  if (period === "week") {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
    const f = startOfWeek.toLocaleDateString("en-KE", opts);
    const t = now.toLocaleDateString("en-KE", opts);
    return `${f} – ${t}`;
  }
  if (period === "year") {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const f = startOfYear.toLocaleDateString("en-KE", { month: "short", year: "numeric" });
    const t = now.toLocaleDateString("en-KE", opts);
    return `${f} – ${t}`;
  }
  if (period === "custom" && from && to) {
    const f = new Date(from + "T00:00:00").toLocaleDateString("en-KE", opts);
    const t = new Date(to + "T00:00:00").toLocaleDateString("en-KE", opts);
    if (from === to) {
      return `${f} (00:00 – 23:59)`;
    }
    return `${f} – ${t}`;
  }
  return "";
};

export default function Dashboard() {
  const [period, setPeriod]         = useState("today");
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const store = useStore();

  // Custom date range state
  const [customFrom, setCustomFrom] = useState("");
  const [customTo,   setCustomTo]   = useState("");
  const [calOpen,    setCalOpen]     = useState(false);
  const [pickStep,   setPickStep]    = useState("from"); // "from" | "to"
  const [hoverDate,  setHoverDate]   = useState(null);
  const [calMonth,   setCalMonth]    = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const calRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handler = e => {
      if (calRef.current && !calRef.current.contains(e.target)) setCalOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Derive the active range: custom takes priority when period === "custom"
  const range = useMemo(() => {
    if (period === "custom") {
      const from = customFrom || toLocalISO(new Date());
      const to   = customTo   || from;
      return { from, to };
    }
    return getDashboardRange(period);
  }, [period, customFrom, customTo]);

  useEffect(() => {
    setLoading(true);
    setSummary(null);
    reportsAPI.summary({ from: range.from, to: range.to })
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const fmt = n => `KES ${Number(n ?? 0).toLocaleString()}`;

  // Period label shown in stat cards
  const activePeriodLabel = period === "custom"
    ? formatRangeLabel(customFrom, customTo)
    : PERIOD_LABEL[period];

  const stats = summary ? (() => {
    const tr = Number(summary.total_revenue ?? 0);
    const tp = Number(summary.total_profit  ?? 0);
    const tu = Number(summary.total_units   ?? 0);
    const tt = Number(summary.total_transactions ?? 0);
    const todayRev = Number(summary.today_revenue ?? 0);
    const pct      = Number(summary.pct_change    ?? 0);
    const revDisplay = period === "today" ? todayRev : tr;
    const revLabel   = period === "today"  ? "Today's revenue"
                     : period === "week"   ? "Week revenue"
                     : period === "custom" ? "Period revenue"
                     : "Year revenue";
    const revUp = period === "today" ? pct >= 0 : tr >= 0;
    const dateRangeStr = formatRevenueDateRange(period, customFrom, customTo);
    const revSub = period === "today"
      ? `${dateRangeStr} · vs yesterday ${pct >= 0 ? "+" : ""}${pct}%`
      : period === "custom"
      ? `${dateRangeStr} · ${tt} txns`
      : `${activePeriodLabel} · ${tt} txns`;
    return [
      {
        label: revLabel,
        value: fmt(revDisplay),
        change: period === "today" ? `${pct >= 0 ? "+" : ""}${pct}%` : "",
        up: revUp,
        sub: revSub,
        accent: "#f5a623", icon: "↗",
      },
      { label: "Units sold",     value: String(Math.round(tu)), change: "", up: tu >= 0, sub: activePeriodLabel, accent: "#4ecdc4", icon: "👟" },
      { label: "Gross profit",   value: fmt(tp),                change: "", up: tp >= 0, sub: `${tt} transactions`, accent: "#a8e6cf", icon: "◈" },
      { label: "Low stock items",value: String(summary.low_stock_count ?? 0), change: "", up: false, sub: "need restocking", accent: "#ff6b6b", icon: "⚠" },
    ];
  })() : [
    { label: "Revenue",         value: "—", change: "", up: true,  sub: "loading…", accent: "#f5a623", icon: "↗" },
    { label: "Units sold",      value: "—", change: "", up: true,  sub: "loading…", accent: "#4ecdc4", icon: "👟" },
    { label: "Gross profit",    value: "—", change: "", up: true,  sub: "loading…", accent: "#a8e6cf", icon: "◈" },
    { label: "Low stock items", value: "—", change: "", up: false, sub: "loading…", accent: "#ff6b6b", icon: "⚠" },
  ];

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfWeek = (year, month) => new Date(year, month, 1).getDay(); // 0=Sun

  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  const prevMonth = () => setCalMonth(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setCalMonth(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const handleDayClick = isoDate => {
    if (pickStep === "from") {
      setCustomFrom(isoDate);
      setCustomTo("");
      setPickStep("to");
    } else {
      // Ensure from <= to
      if (isoDate < customFrom) {
        setCustomFrom(isoDate);
        setCustomTo(customFrom);
      } else {
        setCustomTo(isoDate);
      }
      setPickStep("from");
      setCalOpen(false);
      setPeriod("custom");
    }
  };

  const isInRange = isoDate => {
    const from = customFrom;
    const to   = pickStep === "to" ? (hoverDate || customTo) : customTo;
    if (!from || !to) return false;
    return isoDate >= Math.min(from, to) && isoDate <= Math.max(from, to);
  };

  const renderCalendar = () => {
    const { year, month } = calMonth;
    const daysInMonth  = getDaysInMonth(year, month);
    const firstDow     = getFirstDayOfWeek(year, month);
    const today        = toLocalISO(new Date());

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(`${year}-${String(month + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    }

    return (
      <div style={{padding:"14px 16px", minWidth:260}}>
        {/* Month nav */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <button onClick={prevMonth} style={navBtnStyle}>‹</button>
          <span style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} style={navBtnStyle}>›</button>
        </div>

        {/* Day headers */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{textAlign:"center",fontSize:10,color:"var(--text3)",fontWeight:600,padding:"2px 0"}}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
          {cells.map((iso, i) => {
            if (!iso) return <div key={`e-${i}`}/>;
            const isFrom    = iso === customFrom;
            const isTo      = iso === customTo;
            const isToday   = iso === today;
            const inRange   = isInRange(iso);
            const isEnd     = pickStep === "to" && hoverDate && iso === hoverDate;
            const selected  = isFrom || isTo;

            return (
              <div
                key={iso}
                onClick={() => handleDayClick(iso)}
                onMouseEnter={() => pickStep === "to" && setHoverDate(iso)}
                onMouseLeave={() => pickStep === "to" && setHoverDate(null)}
                style={{
                  textAlign:"center",
                  fontSize:12,
                  padding:"5px 2px",
                  borderRadius: selected ? 6 : inRange ? 0 : 6,
                  cursor:"pointer",
                  fontWeight: selected || isToday ? 700 : 400,
                  color: selected
                    ? "#fff"
                    : isToday
                    ? "var(--gold, #f5a623)"
                    : "var(--text)",
                  background: selected
                    ? "var(--accent, #f5a623)"
                    : inRange
                    ? "var(--accent-muted, rgba(245,166,35,0.18))"
                    : "transparent",
                  transition:"background 0.1s",
                }}
              >
                {Number(iso.slice(8))}
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div style={{marginTop:10,fontSize:11,color:"var(--text3)",textAlign:"center"}}>
          {pickStep === "from" ? "Click to set start date" : "Now click an end date"}
        </div>

        {/* Quick presets inside the calendar */}
        <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
          {[
            { label:"Today",       fn:()=>{ const t=toLocalISO(new Date()); applyCustom(t,t); } },
            { label:"Yesterday",   fn:()=>{ const y=toLocalISO(new Date(Date.now()-86400000)); applyCustom(y,y); } },
            { label:"Last 7 days", fn:()=>{ const t=toLocalISO(new Date()); const f=toLocalISO(new Date(Date.now()-6*86400000)); applyCustom(f,t); } },
            { label:"This month",  fn:()=>{ const n=new Date(); const f=toLocalISO(new Date(n.getFullYear(),n.getMonth(),1)); const t=toLocalISO(new Date()); applyCustom(f,t); } },
          ].map(({ label, fn }) => (
            <button key={label} onClick={fn} style={presetBtnStyle}>{label}</button>
          ))}
        </div>

        {/* Clear button */}
        {(customFrom || customTo) && (
          <button
            onClick={() => { setCustomFrom(""); setCustomTo(""); setPickStep("from"); setPeriod("today"); setCalOpen(false); }}
            style={{...presetBtnStyle, marginTop:6, width:"100%", color:"var(--red,#ff6b6b)", borderColor:"var(--red,#ff6b6b)"}}
          >
            ✕ Clear custom range
          </button>
        )}
      </div>
    );
  };

  const applyCustom = (from, to) => {
    setCustomFrom(from);
    setCustomTo(to);
    setPickStep("from");
    setCalOpen(false);
    setPeriod("custom");
    // Navigate calendar to the selected month
    const d = new Date(from + "T00:00:00");
    setCalMonth({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Shared button styles (inline, so no CSS file changes needed)
  const navBtnStyle = {
    background:"none", border:"none", cursor:"pointer",
    fontSize:16, color:"var(--text2)", padding:"2px 6px",
    borderRadius:4,
  };
  const presetBtnStyle = {
    fontSize:11, padding:"3px 8px", borderRadius:5,
    background:"none", border:"1px solid var(--border, #333)",
    color:"var(--text2)", cursor:"pointer",
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">
            {(() => {
              const activeId   = localStorage.getItem("active_store_id");
              const activeName = localStorage.getItem("active_store_name");
              if (activeId && activeName) return `🏪 ${activeName}`;
              return `${store.store_name}${store.store_location ? ` · ${store.store_location}` : ""}`;
            })()}
          </p>
        </div>

        <div className="dashboard-toolbar" style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          {/* Period selector */}
          <label className="period-select-label" htmlFor="dash-period">Period</label>
          <select
            id="dash-period"
            className="period-select"
            value={period === "custom" ? "" : period}
            onChange={e => { setPeriod(e.target.value); setCustomFrom(""); setCustomTo(""); }}
            aria-label="Dashboard period"
          >
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="year">This year</option>
            {period === "custom" && <option value="">— custom —</option>}
          </select>

          {/* Calendar trigger */}
          <div ref={calRef} style={{position:"relative"}}>
            <button
              onClick={() => setCalOpen(o => !o)}
              style={{
                display:"flex", alignItems:"center", gap:6,
                padding:"6px 12px", borderRadius:8, cursor:"pointer",
                border: period === "custom"
                  ? "1.5px solid var(--accent, #f5a623)"
                  : "1px solid var(--border, #333)",
                background: period === "custom"
                  ? "rgba(245,166,35,0.10)"
                  : "var(--bg2, #1e1e1e)",
                color: period === "custom" ? "var(--accent,#f5a623)" : "var(--text2)",
                fontSize:13, fontWeight: period === "custom" ? 600 : 400,
                transition:"all 0.15s",
              }}
              aria-label="Pick custom date range"
            >
              📅 {period === "custom" ? formatRangeLabel(customFrom, customTo) : "Custom date"}
            </button>

            {/* Calendar dropdown */}
            {calOpen && (
              <div style={{
                position:"absolute", right:0, top:"calc(100% + 6px)",
                background:"var(--bg2, #1e1e1e)",
                border:"1px solid var(--border, #2e2e2e)",
                borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
                zIndex:999, minWidth:280,
              }}>
                {renderCalendar()}
              </div>
            )}
          </div>
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
