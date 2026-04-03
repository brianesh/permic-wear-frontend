import { useState } from "react";
import api from "../services/api";

export default function Setup({ onComplete }) {
  const [step, setStep]     = useState(1); // 1=store, 2=admin
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const [store, setStore] = useState({
    store_name: "Permic Men's Wear",
    store_location: "",
    store_phone: "",
  });
  const [admin, setAdmin] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState(false);

  const submitSetup = async () => {
    setError("");
    if (!admin.name.trim())           { setError("Full name is required");               return; }
    if (!admin.email.trim())          { setError("Email is required");                   return; }
    if (admin.password.length < 8)    { setError("Password must be at least 8 characters"); return; }
    if (admin.password !== admin.confirmPassword) { setError("Passwords do not match"); return; }

    setSaving(true);
    try {
      const res = await api.post("/auth/setup", {
        name:           admin.name.trim(),
        email:          admin.email.trim().toLowerCase(),
        password:       admin.password,
        store_name:     store.store_name,
        store_location: store.store_location,
        store_phone:    store.store_phone,
      });
      // Auto-login with the returned token
      localStorage.setItem("se_token", res.data.token);
      localStorage.setItem("se_user",  JSON.stringify(res.data.user));
      onComplete(res.data.user, res.data.token);
    } catch (e) {
      setError(e.response?.data?.error || "Setup failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg1)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 480,
        background: "var(--bg2)", borderRadius: 18,
        border: "1px solid var(--border)", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, var(--teal), #2a9d8f)",
          padding: "28px 32px", textAlign: "center",
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>👟</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#000", letterSpacing: 1 }}>
            Welcome to Permic Men's Wear
          </div>
          <div style={{ fontSize: 13, color: "rgba(0,0,0,0.7)", marginTop: 6 }}>
            First-time setup — takes less than a minute
          </div>
        </div>

        {/* Progress steps */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
          {[
            { n: 1, label: "Store Info" },
            { n: 2, label: "Super Admin" },
          ].map(s => (
            <div key={s.n} style={{
              flex: 1, padding: "14px 0", textAlign: "center",
              background: step === s.n ? "var(--bg3)" : "transparent",
              borderBottom: step === s.n ? "2px solid var(--teal)" : "2px solid transparent",
              cursor: "pointer",
            }} onClick={() => { if (s.n < step || step === 1) setStep(s.n); }}>
              <div style={{
                fontWeight: 700, fontSize: 12,
                color: step === s.n ? "var(--teal)" : "var(--text3)",
              }}>
                {s.n}. {s.label}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "28px 32px" }}>
          {/* Step 1: Store Info */}
          {step === 1 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 20 }}>
                Store Information
              </div>
              {[
                { label: "Store Name *", key: "store_name", placeholder: "Permic Men's Wear" },
                { label: "Location", key: "store_location", placeholder: "e.g. Ruiru, Kiambu County, Kenya" },
                { label: "Phone Number", key: "store_phone", placeholder: "e.g. +254 700 000000" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                    {f.label}
                  </label>
                  <input
                    style={{
                      width: "100%", padding: "10px 14px", background: "var(--bg3)",
                      border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
                      fontSize: 14, boxSizing: "border-box",
                    }}
                    value={store[f.key]}
                    onChange={e => setStore({ ...store, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <button
                style={{
                  width: "100%", padding: "12px 0", background: "var(--teal)", color: "#000",
                  border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer",
                  marginTop: 8,
                }}
                onClick={() => { if (!store.store_name.trim()) { setError("Store name is required"); return; } setError(""); setStep(2); }}
              >
                Next: Create Admin Account →
              </button>
            </>
          )}

          {/* Step 2: Super Admin */}
          {step === 2 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text)", marginBottom: 4 }}>
                Super Admin Account
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 20 }}>
                This is the master account with full access. Keep these credentials safe.
              </div>
              {[
                { label: "Full Name *", key: "name", type: "text", placeholder: "Your full name" },
                { label: "Email Address *", key: "email", type: "email", placeholder: "you@example.com" },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                    {f.label}
                  </label>
                  <input
                    style={{
                      width: "100%", padding: "10px 14px", background: "var(--bg3)",
                      border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
                      fontSize: 14, boxSizing: "border-box",
                    }}
                    type={f.type}
                    value={admin[f.key]}
                    onChange={e => setAdmin({ ...admin, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                  Password * <span style={{ fontWeight: 400, color: "var(--text3)" }}>(min 8 characters)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{
                      width: "100%", padding: "10px 48px 10px 14px", background: "var(--bg3)",
                      border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
                      fontSize: 14, boxSizing: "border-box",
                    }}
                    type={showPw ? "text" : "password"}
                    value={admin.password}
                    onChange={e => setAdmin({ ...admin, password: e.target.value })}
                    placeholder="Choose a strong password"
                  />
                  <button
                    type="button"
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 12 }}
                    onClick={() => setShowPw(s => !s)}
                  >{showPw ? "Hide" : "Show"}</button>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>
                  Confirm Password *
                </label>
                <input
                  style={{
                    width: "100%", padding: "10px 14px", background: "var(--bg3)",
                    border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)",
                    fontSize: 14, boxSizing: "border-box",
                  }}
                  type={showPw ? "text" : "password"}
                  value={admin.confirmPassword}
                  onChange={e => setAdmin({ ...admin, confirmPassword: e.target.value })}
                  placeholder="Re-enter password"
                />
              </div>

              {error && (
                <div style={{
                  padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 16,
                }}>
                  ⚠ {error}
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={{
                    flex: "0 0 auto", padding: "12px 18px", background: "var(--bg3)", color: "var(--text2)",
                    border: "1px solid var(--border)", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer",
                  }}
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <button
                  style={{
                    flex: 1, padding: "12px 0", background: "var(--teal)", color: "#000",
                    border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                    cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
                  }}
                  onClick={submitSetup}
                  disabled={saving}
                >
                  {saving ? "Creating account…" : "Complete Setup & Sign In →"}
                </button>
              </div>
            </>
          )}

          {step === 1 && error && (
            <div style={{
              marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: 13,
            }}>
              ⚠ {error}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", textAlign: "center", fontSize: 11, color: "var(--text3)" }}>
          After setup, add staff accounts from Settings → Users
        </div>
      </div>
    </div>
  );
}
