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
import BackButtonHandler from "./components/BackButtonHandler";
import api from "./services/api";
import "./index.css";

export const PERMISSIONS = {
  super_admin: ["dashboard","pos","inventory","sales","returns","users","stores","commission","reports","settings","logs"],
  admin:       ["dashboard","pos","inventory","sales","returns","users","commission","reports","logs"],
  cashier:     ["pos","commission"],
};

function AppShell() {
  const { user, logout, isOnline, setIsOnline, pendingSync } = useAuth();
  const allowed   = PERMISSIONS[user.role] || [];
  const startPage = user.role === "cashier" ? "pos" : "dashboard";
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

  return (
    <div className={"app-shell" + (sidebarCollapsed ? " sidebar-is-collapsed" : "")}>
      <Sidebar activePage={activePage} setActivePage={navigate} user={user} logout={logout} allowed={allowed} onCollapsedChange={setSidebarCollapsed} onSearchClick={() => setGlobalSearchOpen(true)} />
      <main className="main-content">
        <SyncBanner isOnline={isOnline} pendingSync={pendingSync} />
        <AppPageHeader onSearchClick={() => setGlobalSearchOpen(true)} />
        {globalSearchOpen && <GlobalSearch onClose={() => setGlobalSearchOpen(false)} onNavigate={navigate} />}
        {/* Exit warning overlay */}
        {/* Back button handler with double-click to exit */}
        <BackButtonHandler currentPage={activePage} onNavigateBack={() => navigate(activePage === 'pos' ? 'dashboard' : 'dashboard')} />
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
  const onSetup = (u, t) => { localStorage.setItem("se_token",t); localStorage.setItem("se_user",JSON.stringify(u)); window.location.reload(); };
  if (needsSetup === null) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"var(--bg1)",gap:12}}>
      <div style={{color:"var(--text3)",fontSize:14}}>{wakingUp?"⏳ Waking up server… ~30 seconds on first load":"Starting Permic Men's Wear…"}</div>
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
