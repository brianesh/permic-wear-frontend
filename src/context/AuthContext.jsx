import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authAPI } from "../services/api";
import {
  cacheUserCredentials,
  getPendingSales,
  removePendingSale,
  countPendingSales,
} from "../lib/offlineDB";
import { salesAPI } from "../services/api";

export const PERMISSIONS = {
  super_admin: ["dashboard","pos","inventory","sales","users","commission","reports","settings","logs"],
  admin:       ["dashboard","pos","inventory","sales","users","commission","reports","logs"],
  cashier:     ["pos","commission"],
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Restore session from localStorage on refresh — don't clear it
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("se_user");
      const token  = localStorage.getItem("token");
      if (stored && token) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [loginError, setLoginError]   = useState("");
  const [loading, setLoading]         = useState(false);
  const [isOnline, setIsOnline]       = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [syncing, setSyncing]         = useState(false);
  const [commissionRate, setCommissionRate] = useState(
    () => parseFloat(localStorage.getItem("se_commission_rate") || "10")
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem("se_theme") || "dark"
  );

  // Validate token with backend on restore (don't block render — do async)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const stored = localStorage.getItem("se_user");
    if (token && stored && !navigator.onLine) return; // offline — keep cached session
    if (token && stored) {
      // Verify token is still valid
      authAPI.me()
        .then(res => {
          const u = res.data.user;
          setUser(u);
          localStorage.setItem("se_user", JSON.stringify(u));
        })
        .catch(() => {
          // Token expired or invalid — force re-login
          localStorage.removeItem("token");
          localStorage.removeItem("se_user");
          setUser(null);
        });
    }
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("se_theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");

  // ── Refresh pending count ──────────────────────────────────────
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await countPendingSales();
      setPendingSync(count);
    } catch { setPendingSync(0); }
  }, []);

  // ── Auto-sync pending sales when back online ──────────────────
  const syncPendingSales = useCallback(async () => {
    if (!navigator.onLine) return;
    const pending = await getPendingSales().catch(() => []);
    if (pending.length === 0) return;

    setSyncing(true);
    for (const sale of pending) {
      try {
        await salesAPI.create({
          items:          sale.items,
          payment_method: sale.payment_method,
          amount_paid:    sale.amount_paid,
          offline_id:     sale.localId,
          offline_ts:     sale.createdAt,
        });
        await removePendingSale(sale.localId);
        setPendingSync(prev => Math.max(0, prev - 1));
      } catch (err) {
        if (err.response?.status === 409) {
          await removePendingSale(sale.localId).catch(() => {});
          setPendingSync(prev => Math.max(0, prev - 1));
        }
      }
    }
    setSyncing(false);
    await refreshPendingCount();
  }, [refreshPendingCount]);

  // ── Online/offline events ─────────────────────────────────────
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true);
      await new Promise(r => setTimeout(r, 1500));
      await syncPendingSales();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [syncPendingSales]);

  useEffect(() => { refreshPendingCount(); }, [refreshPendingCount]);

  // ── Login ──────────────────────────────────────────────────────
  const login = async (identifier, password) => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await authAPI.login(identifier, password);
      const token = res.data?.token;

      // Protect against undefined/null token
      if (!token) {
        console.error("No token returned from API", res.data);
        setLoginError("Login failed: No authentication token received");
        setLoading(false);
        return;
      }

      const u = res.data?.user;
      if (!u) {
        console.error("No user data returned from API", res.data);
        setLoginError("Login failed: No user data received");
        setLoading(false);
        return;
      }

      localStorage.setItem("token", token);
      localStorage.setItem("se_user", JSON.stringify(u));
      if (u.commission_rate) {
        localStorage.setItem("se_commission_rate", String(u.commission_rate));
        setCommissionRate(parseFloat(u.commission_rate));
      }
      setUser(u);
      await cacheUserCredentials(u, token, password);
    } catch (err) {
      if (err.isOfflineError) {
        setLoginError(err.message);
      } else {
        setLoginError(err.response?.data?.error || "Login failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    try { await authAPI.logout(); } catch (_) {}
    localStorage.removeItem("token");
    localStorage.removeItem("se_user");
    setUser(null);
    setLoginError("");
  };

  const addLog = () => {};

  return (
    <AuthContext.Provider value={{
      user, login, logout, loginError, setLoginError, loading,
      isOnline, setIsOnline,
      pendingSync, setPendingSync,
      syncing,
      commissionRate, setCommissionRate,
      theme, toggleTheme,
      syncPendingSales, refreshPendingCount,
      addLog,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
