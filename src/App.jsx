import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import { useBackHistory } from "./lib/useBackHistory";
import { startKeepalive, stopKeepalive } from "./lib/keepalive";
import Login from "./pages/Login";
import Setup from "./pages/Setup";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import SalesRecords from "./pages/SalesRecords";
import Users from "./pages/Users";
import Commission from "./pages/Commission";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ActivityLogs from "./pages/ActivityLogs";
import Returns from "./pages/Returns";
import Stores from "./pages/Stores";
import Sidebar from "./components/Sidebar";
import AddToHome from "./components/AddToHome";
import AppPageHeader from "./components/AppPageHeader";
import SyncBanner from "./components/SyncBanner";
import GlobalSearch from "./components/GlobalSearch";
import { storesAPI } from "./services/api";
import api from "./services/api";
import "./index.css";

export const PERMISSIONS = {
  super_admin: ["dashboard","pos","inventory","sales","returns","users","stores","commission","reports","settings","logs"],
  admin:       ["dashboard","pos","inventory","sales","returns","users","commission","reports","logs"],
  cashier:     ["pos","commission"],
};

// ── Super Admin Store Picker ────────────────────────────────────
// Shown once after login so super_admin chooses which store they're
// operating in. Choice is stored in localStorage and sent as
// X-Active-Store-Id header on every API request.
function StorePicker({ onPicked }) {
  const { user } = useAuth();
  const [stores, setStores]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked]   = useState("");

  useEffect(() => {
    storesAPI.getAll()
      .then(r => setStores((r.data || []).filter(s => s.is_active)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const confirm = () => {
    if (!picked) return;
    const store = stores.find(s => s.id === parseInt(picked));
    localStorage.setItem("active_store_id", picked);
    localStorage.setItem("active_store_name", store?.name || "");
    onPicked(store);
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg1)", flexDirection: "column", gap: 0,
    }}>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16,
        padding: "40px 36px", width: "100%", maxWidth: 420, boxShadow: "0 8px 40px #0006",
      }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏪</div>
          <h2 style={{ margin: 0, color: "var(--text1)", fontWeight: 800, fontSize: 22 }}>Choose Active Store</h2>
          <p style={{ margin: "8px 0 0", color: "var(--text3)", fontSize: 14 }}>
            Welcome, {user?.name}. Select the store you're operating in today.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text3)", padding: 20 }}>Loading stores…</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {stores.map(s => (
              <button key={s.id} onClick={() => setPicked(String(s.id))} style={{
                padding: "14px 18px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                border: picked === String(s.id) ? "2px solid var(--gold)" : "1px solid var(--border)",
                background: picked === String(s.id) ? "var(--gold)18" : "var(--bg3)",
                color: "var(--text1)", transition: "all .15s",
              }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{s.name}</div>
                {s.location && <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>📍 {s.location}</div>}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={confirm}
          disabled={!picked}
          style={{
            width: "100%", padding: "13px", borderRadius: 10, border: "none", cursor: picked ? "pointer" : "not-allowed",
            background: picked ? "var(--gold)" : "var(--bg3)", color: picked ? "#000" : "var(--text3)",
            fontWeight: 700, fontSize: 15, transition: "all .15s",
          }}
        >
          Enter Store →
        </button>

        <button onClick={() => onPicked(null)} style={{
          width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: "none",
          background: "transparent", color: "var(--text3)", cursor: "pointer", fontSize: 13,
        }}>
          Skip — manage all stores globally
        </button>
      </div>
    </div>
  );
}

// ── App Shell ───────────────────────────────────────────────────
function AppShell() {
  const { user, logout, isOnline, setIsOnline, pendingSync } = useAuth();
  const isSuperAdmin = user.role === "super_admin";
  const allowed   = PERMISSIONS[user.role] || [];
  const startPage = user.role === "cashier" ? "pos" : "dashboard";

  // Super admin active store state
  const [activeStore, setActiveStore] = useState(() => {
    if (!isSuperAdmin) return null;
    const id   = localStorage.getItem("active_store_id");
    const name = localStorage.getItem("active_store_name");
    return id ? { id: parseInt(id), name } : null;
  });
  // Show picker if super_admin hasn't chosen yet this session
  const [showPicker, setShowPicker] = useState(
    isSuperAdmin && !localStorage.getItem("active_store_id")
  );

  const handleStorePicked = (store) => {
    if (store) {
      setActiveStore(store);
      localStorage.setItem("active_store_id", String(store.id));
      localStorage.setItem("active_store_name", store.name);
    } else {
      // Skipped — operate globally (no store filter)
      localStorage.removeItem("active_store_id");
      localStorage.removeItem("active_store_name");
      setActiveStore(null);
    }
    setShowPicker(false);
  };

  const switchStore = () => {
    localStorage.removeItem("active_store_id");
    localStorage.removeItem("active_store_name");
    // Reload the page so all store-specific state (products, sales cache, etc) clears
    window.location.reload();
  };

  const [page, setPageRaw]           = useState(startPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const activePage = allowed.includes(page) ? page : startPage;

  useEffect(() => { startKeepalive(); return () => stopKeepalive(); }, []);

  const setPage = useCallback(p => { if (allowed.includes(p)) setPageRaw(p); }, [allowed]);
  const { pushHistory, showExitWarning } = useBackHistory(activePage, setPage, startPage);
  const navigate = useCallback(p => {
    if (!allowed.includes(p)) return;
    setPageRaw(p); pushHistory(p);
  }, [allowed, pushHistory]);

  useEffect(() => {
    const on = () => setIsOnline(true), off = () => setIsOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setIsOnline]);

  useEffect(() => {
    const fn = e => {
      if (e.key === "/" && !e.target.matches("input,textarea,select")) { e.preventDefault(); setGlobalSearchOpen(true); }
      if (e.key === "Escape") setGlobalSearchOpen(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  if (showPicker) return <StorePicker onPicked={handleStorePicked} />;

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-is-collapsed" : "")}>
      <Sidebar
        activePage={activePage} setActivePage={navigate}
        user={user} logout={logout} allowed={allowed}
        onCollapsedChange={setSidebarCollapsed}
        onSearchClick={() => setGlobalSearchOpen(true)}
        activeStore={activeStore}
        onSwitchStore={isSuperAdmin ? switchStore : null}
      />
      <main className="main-content">
        {showExitWarning && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.85)", color: "#fff", padding: "12px 24px",
            borderRadius: 25, fontSize: 14, fontWeight: 600, zIndex: 9999,
            backdropFilter: "blur(8px)", whiteSpace: "nowrap",
            boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          }}>Press back again to exit</div>
        )}
        <SyncBanner isOnline={isOnline} pendingSync={pendingSync} />
        <AppPageHeader onSearchClick={() => setGlobalSearchOpen(true)} />
        {globalSearchOpen && <GlobalSearch onClose={() => setGlobalSearchOpen(false)} onNavigate={navigate} />}
        {activePage === "dashboard"  && <Dashboard />}
        {activePage === "pos"        && <POS />}
        {activePage === "inventory"  && <Inventory />}
        {activePage === "sales"      && <SalesRecords />}
        {activePage === "returns"    && <Returns />}
        {activePage === "users"      && <Users />}
        {activePage === "stores"     && <Stores />}
        {activePage === "commission" && <Commission />}
        {activePage === "reports"    && <Reports />}
        {activePage === "settings"   && <Settings />}
        {activePage === "logs"       && <ActivityLogs />}
      </main>
    </div>
  );
}

function AuthGate() {
  const { user } = useAuth();
  const [needsSetup, setNeedsSetup] = useState(null);
  const [wakingUp, setWakingUp]     = useState(false);

  useEffect(() => {
    if (user) { setNeedsSetup(false); return; }
    let att = 0;
    const check = () => {
      api.get("/auth/setup-status").then(r => setNeedsSetup(r.data.needs_setup === true)).catch(() => {
        att++; if (att >= 8) { setNeedsSetup(false); return; }
        setWakingUp(true); setTimeout(check, 5000);
      });
    };
    check();
  }, [user]);

  const onSetup = (u, t) => {
    localStorage.setItem("se_token", t);
    localStorage.setItem("se_user", JSON.stringify(u));
    window.location.reload();
  };

  if (needsSetup === null) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--bg1)",gap:12}}>
      <div style={{color:"var(--text3)",fontSize:14}}>
        {wakingUp ? "⏳ Waking up server… ~30 seconds on first load" : "Starting Permic Men's Wear…"}
      </div>
    </div>
  );

  return (
    <StoreProvider isLoggedIn={!!user}>
      {needsSetup ? <Setup onComplete={onSetup} /> : user ? <AppShell /> : <Login />}
    </StoreProvider>
  );
}

export default function App() {
  return <AuthProvider><AuthGate /><AddToHome /></AuthProvider>;
}
