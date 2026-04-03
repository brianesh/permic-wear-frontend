import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const ALL_NAV = [
  { id:"dashboard",  icon:"◈",  label:"Dashboard"     },
  { id:"pos",        icon:"⊕",  label:"Point of Sale"  },
  { id:"inventory",  icon:"▦",  label:"Inventory"      },
  { id:"sales",      icon:"↗",  label:"Sales Records"  },
  { id:"users",      icon:"◉",  label:"Users"          },
  { id:"commission", icon:"💰", label:"My Commission"  },
  { id:"reports",    icon:"≡",  label:"Reports"        },
  { id:"logs",       icon:"📋", label:"Activity Logs"  },
  { id:"settings",   icon:"⚙",  label:"Settings"       },
];

const ROLE_COLOR = { super_admin:"#f5a623", admin:"#4ecdc4", cashier:"#a8e6cf" };
const ROLE_LABEL = { super_admin:"Super Admin", admin:"Admin", cashier:"Cashier" };

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return mobile;
}

export default function Sidebar({ activePage, setActivePage, user, logout, allowed, onCollapsedChange }) {
  const { theme, toggleTheme } = useAuth();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed]   = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = ALL_NAV.filter(n => allowed.includes(n.id));
  const rc = ROLE_COLOR[user?.role] || "#f5a623";

  // Notify parent whenever collapsed state changes (desktop only)
  useEffect(() => {
    if (onCollapsedChange) onCollapsedChange(!isMobile && collapsed);
  }, [collapsed, isMobile, onCollapsedChange]);

  const navigate = (id) => {
    setActivePage(id);
    if (isMobile) setDrawerOpen(false);
  };

  useEffect(() => {
    if (!isMobile || !drawerOpen) return;
    const handler = (e) => {
      if (!e.target.closest(".sidebar") && !e.target.closest(".sidebar-toggle-btn"))
        setDrawerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [isMobile, drawerOpen]);

  const sidebarClass = [
    "sidebar",
    isMobile  ? (drawerOpen  ? "sidebar--drawer sidebar--drawer-open" : "sidebar--drawer") : "",
    !isMobile && collapsed ? "sidebar--collapsed" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      {isMobile && drawerOpen && (
        <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} />
      )}

      <button
        className="sidebar-toggle-btn"
        onClick={() => isMobile ? setDrawerOpen(o => !o) : setCollapsed(c => !c)}
        aria-label="Toggle sidebar"
      >
        {isMobile ? (drawerOpen ? "✕" : "☰") : (collapsed ? "»" : "«")}
      </button>

      <aside className={sidebarClass}>
        <div className="sidebar-logo">
          <div className="logo-mark">PW</div>
          {!collapsed && (
            <div className="logo-text">
              <span className="logo-title">Permic Men's Wear</span>
              <span className="logo-sub">SOLUTIONS</span>
            </div>
          )}
        </div>

        <div className="sidebar-user">
          <div className="user-avatar" style={{background:`linear-gradient(135deg,${rc},${rc}88)`}}>
            {user?.avatar}
          </div>
          {!collapsed && (
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role" style={{color:rc}}>{ROLE_LABEL[user?.role]}</span>
            </div>
          )}
          <div className="user-status"/>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? "nav-item--active" : ""}`}
              onClick={() => navigate(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {activePage === item.id && !collapsed && <div className="nav-indicator"/>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sync-status">
              <div className="sync-dot sync-dot--online"/>
              <span>Synced · just now</span>
            </div>
          )}
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
