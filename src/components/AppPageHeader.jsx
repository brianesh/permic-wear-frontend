import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";

function getGreeting(name) {
  const h = new Date().getHours();
  const firstName = name?.split(" ")[0] || "there";
  if (h < 12) return { greeting: `Good Morning, ${firstName}! ☀️`, sub: "Happy sales today!" };
  if (h < 17) return { greeting: `Good Afternoon, ${firstName}! 👋`, sub: "Keep up the great work!" };
  return { greeting: `Good Evening, ${firstName}! 🌙`, sub: "Wrapping up strong today!" };
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function AppPageHeader() {
  const { user } = useAuth();
  const store    = useStore();
  const now      = useLiveClock();
  const { greeting, sub } = getGreeting(user?.name);
  const dateStr  = now.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr  = now.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="app-page-header" aria-label="Welcome header">
      <div className="dash-greeting-text">
        <h2 className="dash-greeting-title">{greeting}</h2>
        <p className="dash-greeting-sub">{sub}</p>
      </div>
      <div className="dash-clock">
        <div className="dash-clock-time">{timeStr}</div>
        <div className="dash-clock-date">{dateStr}</div>
        <div className="dash-clock-loc">📍 {store.store_location}</div>
      </div>
    </div>
  );
}
