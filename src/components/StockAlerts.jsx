import { useEffect, useState } from "react";
import { productsAPI, settingsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function StockAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts]     = useState([]);
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  useEffect(() => {
    productsAPI.getAll().then(res => {
      const products = res.data || [];
      const crit  = products.filter(p => p.stock <= 2 && p.stock >= 0).map(p => ({ name:`${p.name} Sz${p.size}`, meta:`${p.stock} units left`, type:"critical" }));
      const low   = products.filter(p => p.stock > 2 && p.stock <= 5).map(p => ({ name:`${p.name} Sz${p.size}`, meta:`${p.stock} units left`, type:"low" }));
      const aging = products.filter(p => p.days_in_stock >= 60).map(p => ({ name:`${p.name} Sz${p.size}`, meta:`${p.days_in_stock} days in stock`, type:"aging" }));
      setAlerts([...crit, ...low, ...aging].slice(0, 6));
    }).catch(() => setAlerts([]));
  }, []);

  const sendAlert = async () => {
    setSending(true);
    try {
      // Hits backend /api/settings to get admin phone, then triggers SMS
      // For now we POST to a dedicated alert endpoint
      await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/products/send-alert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("se_token")}`,
        },
        body: JSON.stringify({ alerts, sentBy: user?.name }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch { /* fail silently */ }
    finally { setSending(false); }
  };

  return (
    <div className="panel-card panel-card--alert">
      <div className="panel-header">
        <div><div className="card-title">Stock Alerts</div><div className="card-sub">Needs attention</div></div>
        <span className="badge badge--red">{alerts.length} items</span>
      </div>
      <div className="alerts-list">
        {alerts.length===0 && <div style={{color:"var(--text3)",fontSize:13,textAlign:"center",padding:16}}>All stock levels OK ✓</div>}
        {alerts.map((a,i)=>(
          <div key={i} className={`alert-row alert-row--${a.type}`}>
            <div className="alert-dot"/>
            <div className="alert-info">
              <div className="alert-name">{a.name}</div>
              <div className="alert-meta">{a.meta}</div>
            </div>
            <span className={`alert-tag alert-tag--${a.type}`}>{a.type}</span>
          </div>
        ))}
      </div>
      {/* ALL roles (including cashier) can send an alert */}
      <button
        className="alert-action-btn"
        disabled={sending || alerts.length === 0}
        onClick={sendAlert}
        style={sent ? {background:"rgba(168,230,207,0.15)",color:"var(--green)",borderColor:"rgba(168,230,207,0.4)"} : {}}
      >
        {sent ? "✓ Alert sent to Admin!" : sending ? "Sending…" : "📲 Send Stock Alert to Admin"}
      </button>
    </div>
  );
}
