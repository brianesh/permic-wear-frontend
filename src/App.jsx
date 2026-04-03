import { useState, useEffect } from "react";
import { AuthProvider, useAuth, PERMISSIONS } from "./context/AuthContext";
import { StoreProvider } from "./context/StoreContext";
import Login        from "./pages/Login";
import Setup        from "./pages/Setup";
import Dashboard    from "./pages/Dashboard";
import POS          from "./pages/POS";
import Inventory    from "./pages/Inventory";
import SalesRecords from "./pages/SalesRecords";
import Users        from "./pages/Users";
import Commission   from "./pages/Commission";
import Reports      from "./pages/Reports";
import Settings     from "./pages/Settings";
import ActivityLogs from "./pages/ActivityLogs";
import Sidebar      from "./components/Sidebar";
import AddToHome    from "./components/AddToHome";
import AppPageHeader from "./components/AppPageHeader";
import SyncBanner   from "./components/SyncBanner";
import api          from "./services/api";
import "./index.css";

function AppShell() {
  const { user, logout, isOnline, setIsOnline, pendingSync } = useAuth();
  const allowed   = PERMISSIONS[user.role] || [];
  const startPage = user.role === "cashier" ? "pos" : "dashboard";
  const [page, setPage]                     = useState(startPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const activePage = allowed.includes(page) ? page : startPage;

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, [setIsOnline]);

  const navigate = p => { if (allowed.includes(p)) setPage(p); };

  return (
    <div className={`app-shell${sidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
      <Sidebar
        activePage={activePage}
        setActivePage={navigate}
        user={user}
        logout={logout}
        allowed={allowed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main className="main-content">
        <SyncBanner isOnline={isOnline} pendingSync={pendingSync} />
        <AppPageHeader />
        {activePage === "dashboard"  && <Dashboard />}
        {activePage === "pos"        && <POS />}
        {activePage === "inventory"  && <Inventory />}
        {activePage === "sales"      && <SalesRecords />}
        {activePage === "users"      && <Users />}
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
  const [needsSetup, setNeedsSetup] = useState(null); // null = checking
  const [wakingUp,   setWakingUp]   = useState(false);

  useEffect(() => {
    if (user) { setNeedsSetup(false); return; }

    let attempts = 0;
    const MAX    = 8; // up to ~40 seconds for Render cold start

    const check = () => {
      api.get("/auth/setup-status")
        .then(res => setNeedsSetup(res.data.needs_setup === true))
        .catch(() => {
          attempts++;
          if (attempts >= MAX) {
            setNeedsSetup(false); // give up — show login anyway
            return;
          }
          setWakingUp(true);
          setTimeout(check, 5000); // retry every 5 seconds
        });
    };

    check();
  }, [user]);

  const handleSetupComplete = (u, token) => {
    localStorage.setItem("se_token", token);
    localStorage.setItem("se_user",  JSON.stringify(u));
    window.location.reload();
  };

  if (needsSetup === null) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg1)", gap: 12 }}>
        <div style={{ color: "var(--text3)", fontSize: 14 }}>
          {wakingUp ? "⏳ Waking up server… this takes ~30 seconds on first load" : "Starting Permic Men's Wear…"}
        </div>
        {wakingUp && (
          <div style={{ color: "var(--text3)", fontSize: 12, opacity: 0.6 }}>
            Render free tier spins down after inactivity
          </div>
        )}
      </div>
    );
  }

  return (
    <StoreProvider isLoggedIn={!!user}>
      {needsSetup
        ? <Setup onComplete={handleSetupComplete} />
        : user
          ? <AppShell />
          : <Login />}
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
      <AddToHome />
    </AuthProvider>
  );
}