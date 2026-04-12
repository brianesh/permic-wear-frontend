import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const ALL_NAV = [
  { id: "dashboard",  icon: "◈",  label: "Dashboard"      },
  { id: "pos",        icon: "⊕",  label: "Point of Sale"  },
  { id: "inventory",  icon: "▦",  label: "Inventory"      },
  { id: "sales",      icon: "↗",  label: "Sales Records"  },
  { id: "returns",    icon: "↩",  label: "Returns"        },
  { id: "barcodes",   icon: "▤",  label: "Barcodes"       },
  { id: "users",      icon: "◉",  label: "Users"          },
  { id: "stores",     icon: "🏪", label: "Stores"         },
  { id: "commission", icon: "💰", label: "My Commission"  },
  { id: "reports",    icon: "≡",  label: "Reports"        },
  { id: "logs",       icon: "📋", label: "Activity Logs"  },
  { id: "settings",   icon: "⚙",  label: "Settings"       },
];

const ROLE_COLOR = { super_admin: "#f5a623", admin: "#4ecdc4", cashier: "#a8e6cf" };
const ROLE_LABEL = { super_admin: "Super Admin", admin: "Admin", cashier: "Cashier" };

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const h = e => setMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return mobile;
}

export default function Sidebar({ activePage, setActivePage, user, logout, allowed, onCollapsedChange, onSearchClick, activeStore, onSwitchStore }) {
  const { theme, toggleTheme } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = ALL_NAV.filter(n => allowed.includes(n.id));
  const rc = ROLE_COLOR[user?.role] || "#f5a623";

  useEffect(() => {
    if (onCollapsedChange) onCollapsedChange(!isMobile && collapsed);
  }, [collapsed, isMobile, onCollapsedChange]);

  const navigate = id => { setActivePage(id); if (isMobile) setDrawerOpen(false); };

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    const h = e => {
      if (!e.target.closest(".sidebar") && !e.target.closest(".sidebar-toggle-btn")) setDrawerOpen(false);
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("touchstart", h);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("touchstart", h); };
  }, [isMobile, drawerOpen]);

  const cls = [
    "sidebar",
    isMobile ? (drawerOpen ? "sidebar--drawer sidebar--drawer-open" : "sidebar--drawer") : "",
    !isMobile && collapsed ? "sidebar--collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      {isMobile && drawerOpen && <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />}

      <button className="sidebar-toggle-btn" onClick={() => isMobile ? setDrawerOpen(o => !o) : setCollapsed(c => !c)} aria-label="Toggle sidebar">
        {isMobile ? (drawerOpen ? "✕" : "☰") : (collapsed ? "»" : "«")}
      </button>

      <aside className={cls}>
        <div className="sidebar-logo">
          <div className="logo-mark">PW</div>
          {!collapsed && (
            <div className="logo-text">
              <span className="logo-title">Permic Men's Wear</span>
              <span className="logo-sub">SOLUTIONS</span>
            </div>
          )}
        </div>

        {/* Global search button */}
        {!collapsed && onSearchClick && (
          <button onClick={onSearchClick} style={{
            display: "flex", alignItems: "center", gap: 8, width: "calc(100% - 24px)",
            margin: "0 12px 8px", padding: "8px 12px", background: "var(--bg3)",
            border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer",
            color: "var(--text3)", fontSize: 13,
          }}>
            <span>🔍</span>
            <span style={{ flex: 1, textAlign: "left" }}>Search… (press /)</span>
            <span style={{ fontSize: 11, background: "var(--bg2)", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--border)" }}>/</span>
          </button>
        )}

        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: `linear-gradient(135deg,${rc},${rc}88)` }}>{user?.avatar}</div>
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role" style={{ color: rc }}>{ROLE_LABEL[user?.role]}</span>
              {/* Store display: super_admin shows active store with switch button */}
              {user?.role === 'super_admin' ? (
                <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 1, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                  {activeStore ? `🏪 ${activeStore.name}` : "🏢 All Stores"}
                  {onSwitchStore && (
                    <button onClick={onSwitchStore} style={{
                      fontSize: 9, padding: "1px 5px", borderRadius: 4,
                      border: "1px solid var(--border)", background: "var(--bg3)",
                      color: "var(--gold)", cursor: "pointer", fontWeight: 700,
                    }}>switch</button>
                  )}
                </span>
              ) : user?.store_name ? (
                <span style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>
                  {`🏪 ${user.store_name}${user.store_location ? ` · ${user.store_location}` : ''}`}
                </span>
              ) : null}
            </div>
          )}
          <div className="user-status" />
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activePage === item.id ? "nav-item--active" : ""}`}
              onClick={() => navigate(item.id)} title={collapsed ? item.label : undefined}>
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {activePage === item.id && !collapsed && <div className="nav-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && <div className="sync-status"><div className="sync-dot sync-dot--online" /><span>Synced · just now</span></div>}
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === "dark" ? "Light Mode" : "Dark Mode"}>
            <span>{theme === "dark" ? "☀️" : "🌙"}</span>
            {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <button className="logout-btn" onClick={logout} title="Sign Out">
            <span>⏻</span>
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
