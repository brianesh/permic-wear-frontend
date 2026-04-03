import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, loginError, setLoginError, loading } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);

  const submit = e => {
    e.preventDefault();
    if (!email || !password) { setLoginError("Please fill in both fields."); return; }
    login(email.trim(), password);
  };

  return (
    <div className="login-shell">
      <div className="login-brand">
        <div className="login-brand-content">
          <div className="login-brand-logo" style={{ fontSize: 13, letterSpacing: 2, fontWeight: 900 }}>PMW</div>
          <h1 className="login-brand-name">PERMIC<br />MEN'S WEAR</h1>
          <p className="login-brand-tagline">Premium Shoes &amp; Clothing<br />Kenya</p>

          <div style={{ display: "flex", gap: 10, marginTop: 20, marginBottom: 6, justifyContent: "center" }}>
            <div style={{ width: 135, height: 105, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)", boxShadow: "0 6px 20px #0007", background: "#0d0d1a" }}>
              <img src="/shoe.png" alt="Shoes" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
            </div>
            <div style={{ width: 135, height: 105, borderRadius: 12, overflow: "hidden", border: "2px solid rgba(255,255,255,0.2)", boxShadow: "0 6px 20px #0007", background: "#0d0d1a" }}>
              <img src="/outfit.png" alt="Clothing" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display = "none"; }} />
            </div>
          </div>

          <div className="login-brand-features" style={{ marginTop: 14 }}>
            {["Shoes & Men's Clothing", "M-Pesa & Cash payments", "Role-based staff access", "Real-time inventory tracking", "Works offline as mobile app"].map(f => (
              <div key={f} className="login-feat">
                <span className="login-feat-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="login-brand-bg-text">PERMIC<br />MEN'S</div>
      </div>

      <div className="login-form-side">
        <div className="login-form-box">
          <div className="login-greeting">
            <div className="login-greeting-title">Welcome back 👋</div>
            <div className="login-greeting-sub">Sign in to Permic Men's Wear</div>
          </div>

          <form onSubmit={submit} noValidate>
            <div className="lf-field">
              <label className="lf-label">Email address</label>
              <input
                className="lf-input"
                type="email"
                placeholder="your@email.com"
                value={email}
                autoFocus
                autoComplete="email"
                onChange={e => { setEmail(e.target.value); setLoginError(""); }}
              />
            </div>
            <div className="lf-field">
              <label className="lf-label">Password</label>
              <div className="lf-pw-wrap">
                <input
                  className="lf-input"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setLoginError(""); }}
                />
                <button type="button" className="lf-pw-eye" onClick={() => setShowPw(s => !s)}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {loginError && <div className="lf-error"><span>⚠</span> {loginError}</div>}
            <button className="lf-submit" type="submit" disabled={loading}>
              {loading ? <span className="lf-spinner" /> : "Sign In →"}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "var(--text3)" }}>
            Forgot your password? Contact your administrator.
          </div>
        </div>
        <div className="login-footer-note">© 2026 Permic Men's Wear · Kenya</div>
      </div>
    </div>
  );
}
