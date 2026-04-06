import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import { settingsAPI, authAPI } from "../services/api";

export default function Settings() {
  const { user, setCommissionRate, logout } = useAuth();
  const { refreshStore } = useStore();
  const [tab, setTab]     = useState("store");
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(true);

  const [store, setStore]   = useState({ store_name:"Permic Wear Solutions", store_location:"Ruiru, Kenya", store_phone:"+254 792 369700", store_email:"info@permicwear.co.ke", currency:"KES", timezone:"Africa/Nairobi" });
  const [alerts, setAlerts] = useState({ low_stock_threshold:5, aging_days:60, sms_alerts:"true", admin_phone:"", admin_email:"", email_alerts:"true" });
  const [sms, setSms]       = useState({ at_api_key:"", at_username:"", at_sender_id:"PERMICWEAR" });
  const [gmail, setGmail]   = useState({ gmail_user:"", gmail_app_password:"" });
  const [tuma, setTuma]     = useState({ tuma_paybill:"880100", tuma_account:"505008", tuma_phone:"0706505008", tuma_api_key:"" });
  const [commission, setCommission] = useState({ commission_rate:"10" });
  const [pwForm, setPwForm] = useState({ current:"", next:"", confirm:"" });
  const [pwErr, setPwErr]   = useState("");
  const [pwOk, setPwOk]     = useState(false);

  useEffect(() => {
    settingsAPI.get().then(res => {
      const s = res.data;
      setStore(prev => ({...prev, ...Object.fromEntries(Object.keys(prev).map(k=>[k,s[k]??prev[k]]))}));
      setAlerts(prev => ({...prev, ...Object.fromEntries(Object.keys(prev).map(k=>[k,s[k]??prev[k]]))}));
      setSms(prev => ({...prev, ...Object.fromEntries(Object.keys(prev).map(k=>[k,s[k]??prev[k]]))}));
      setGmail(prev => ({...prev, ...Object.fromEntries(Object.keys(prev).map(k=>[k,s[k]??prev[k]]))}));
      setTuma(prev => ({...prev, ...Object.fromEntries(Object.keys(prev).map(k=>[k,s[k]??prev[k]]))}));
      setCommission({ commission_rate: s.commission_rate ?? "10" });
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const save = async (data, section) => {
    try {
      await settingsAPI.update(data);
      if (data.commission_rate) setCommissionRate(parseFloat(data.commission_rate));
      if (section === "store") refreshStore();
      setSaved(section); setTimeout(()=>setSaved(null), 2500);
    } catch { setSaved(null); }
  };

  // Critical sections that require confirmation before saving
  const CRITICAL_SECTIONS = ["payments", "sms", "gmail", "commission"];
  const CRITICAL_MESSAGES = {
    payments:   "You are about to change Tuma payment credentials.\n\nThis affects how customers pay. Wrong credentials will break payments.\n\nAre you sure?",
    sms:        "You are about to change SMS (Africa's Talking) credentials.\n\nThis affects stock alert messages.\n\nAre you sure?",
    gmail:      "You are about to change Gmail email credentials.\n\nThis affects email alert delivery.\n\nAre you sure?",
    commission: "You are about to change the commission rate.\n\nThis affects how much all cashiers earn per sale.\n\nAre you sure?",
  };

  const saveWithConfirm = (data, section) => {
    if (CRITICAL_SECTIONS.includes(section)) {
      const msg = CRITICAL_MESSAGES[section] || `Save changes to ${section}?`;
      if (!window.confirm(msg)) return;
    }
    save(data, section);
  };

  const changePw = async () => {
    setPwErr(""); setPwOk(false);
    if (!pwForm.current) { setPwErr("Enter your current password."); return; }
    if (pwForm.next.length < 8) { setPwErr("New password must be at least 8 characters."); return; }
    if (pwForm.next !== pwForm.confirm) { setPwErr("Passwords do not match."); return; }
    try {
      await authAPI.changePassword(pwForm.current, pwForm.next);
      setPwForm({current:"",next:"",confirm:""}); setPwOk(true);
    } catch(e) { setPwErr(e.response?.data?.error || "Failed to change password"); }
  };

  const TABS = [
    {id:"store",      icon:"◈",  label:"Store Info"},
    {id:"commission", icon:"💰", label:"Commission"},
    {id:"alerts",     icon:"⚠",  label:"Stock Alerts"},
    {id:"sms",        icon:"📲", label:"SMS (Africa's Talking)"},
    {id:"gmail",      icon:"📧", label:"Email (Gmail)"},
    {id:"payments",   icon:"📱", label:"Payment (Tuma)"},
    {id:"security",   icon:"◉",  label:"Security"},
  ];

  const Field = ({label, children}) => <div className="modal-field">{label&&<label>{label}</label>}{children}</div>;
  const Toggle = ({on, onChange}) => <div className={`toggle ${on?"toggle--on":""}`} onClick={onChange}><div className="toggle-thumb"/></div>;
  const Row = ({label,sub,right}) => <div className="settings-row"><div className="settings-row-info"><div className="settings-row-label">{label}</div>{sub&&<div className="settings-row-sub">{sub}</div>}</div>{right}</div>;
  const SaveBtn = ({section, data}) => <div className="settings-save-row"><button className="modal-save" onClick={()=>saveWithConfirm(data,section)}>{saved===section?"✓ Saved!":"Save Changes"}</button></div>;
  // Secret fields: show "●●●● saved" indicator when DB has a value, allow editing
  const SecretField = ({label, value, onChange, placeholder}) => {
    const [editing, setEditing] = useState(false);
    const hasValue = value && value.length > 0;
    return (
      <div className="modal-field">
        {label && <label>{label}</label>}
        {!editing && hasValue ? (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{flex:1,padding:"9px 12px",background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",fontSize:13,color:"var(--green)",letterSpacing:2}}>
              ●●●● saved
            </div>
            <button type="button" className="filter-chip" style={{flexShrink:0,padding:"8px 14px"}} onClick={()=>setEditing(true)}>Change</button>
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input
              type="password"
              placeholder={placeholder}
              value={editing ? value : ""}
              onChange={onChange}
              autoFocus={editing}
              style={{flex:1}}
            />
            {editing && hasValue && (
              <button type="button" className="filter-chip" style={{flexShrink:0,padding:"8px 14px"}} onClick={()=>setEditing(false)}>Cancel</button>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="inv-page" style={{paddingTop:60,textAlign:"center",color:"var(--text3)"}}>Loading settings…</div>;

  return (
    <div className="inv-page">
      <div className="page-header"><div><h1 className="page-title">Settings</h1><p className="page-sub">System configuration</p></div></div>
      <div className="settings-layout">
        <div className="settings-tabs">
          {TABS.map(t=><button key={t.id} className={`settings-tab ${tab===t.id?"settings-tab--active":""}`} onClick={()=>setTab(t.id)}><span className="settings-tab-icon">{t.icon}</span><span>{t.label}</span></button>)}
        </div>
        <div className="settings-content">

          {tab==="store"&&(<>
            <div className="settings-section-title">Store Information</div>
            <div className="settings-section-sub">Basic details about your business.</div>
            <div className="modal-grid" style={{marginTop:20}}>
              <Field label="Store Name"><input value={store.store_name} onChange={e=>setStore({...store,store_name:e.target.value})}/></Field>
              <Field label="Location"><input value={store.store_location} onChange={e=>setStore({...store,store_location:e.target.value})}/></Field>
              <Field label="Phone"><input value={store.store_phone} onChange={e=>setStore({...store,store_phone:e.target.value})}/></Field>
              <Field label="Email"><input type="email" value={store.store_email} onChange={e=>setStore({...store,store_email:e.target.value})}/></Field>
              <Field label="Currency"><select value={store.currency} onChange={e=>setStore({...store,currency:e.target.value})}><option value="KES">KES</option><option value="USD">USD</option></select></Field>
              <Field label="Timezone"><select value={store.timezone} onChange={e=>setStore({...store,timezone:e.target.value})}><option value="Africa/Nairobi">Africa/Nairobi (EAT +3)</option><option value="UTC">UTC</option></select></Field>
            </div>
            <SaveBtn section="store" data={store}/>
          </>)}

          {tab==="commission"&&(<>
            <div className="settings-section-title">Commission Rate</div>
            <div className="settings-section-sub">Percentage of extra profit (above min price) paid to cashiers.</div>
            <div style={{marginTop:24,maxWidth:300}}>
              <Field label="Commission Rate (%)">
                <input type="number" min="0" max="100" value={commission.commission_rate} onChange={e=>setCommission({commission_rate:e.target.value})}/>
              </Field>
              <div className="settings-info-box" style={{marginTop:16}}>
                <span>💡</span>
                <span>Example: Shoe min price KES 5,000. Cashier sells at KES 6,000. Extra profit = KES 1,000. Commission at {commission.commission_rate}% = KES {Math.round(1000*parseFloat(commission.commission_rate||0)/100).toLocaleString()}.</span>
              </div>
            </div>
            <SaveBtn section="commission" data={commission}/>
          </>)}

          {tab==="alerts"&&(<>
            <div className="settings-section-title">Stock Alert Settings</div>
            <div className="settings-section-sub">Configure when alerts fire, and how they are delivered (SMS + email).</div>
            <div className="settings-fields" style={{marginTop:20}}>
              <Row label="Low Stock Threshold" sub="Alert when stock drops below this" right={<input type="number" className="settings-number-input" value={alerts.low_stock_threshold} onChange={e=>setAlerts({...alerts,low_stock_threshold:e.target.value})}/>}/>
              <Row label="Aging Stock (Days)" sub="Alert when not sold for this many days" right={<input type="number" className="settings-number-input" value={alerts.aging_days} onChange={e=>setAlerts({...alerts,aging_days:e.target.value})}/>}/>
              <Row label="SMS Alerts" sub="Send SMS via Africa's Talking to admin phone" right={<Toggle on={alerts.sms_alerts==="true"} onChange={()=>setAlerts({...alerts,sms_alerts:alerts.sms_alerts==="true"?"false":"true"})}/>}/>
              {alerts.sms_alerts==="true"&&(
                <div className="modal-field" style={{maxWidth:340,marginTop:4}}>
                  <label>Admin Phone <span style={{color:"var(--text3)",fontWeight:400,fontSize:11}}>(receives SMS alerts — different from store public phone)</span></label>
                  <input value={alerts.admin_phone} onChange={e=>setAlerts({...alerts,admin_phone:e.target.value})} placeholder="+254 7XX XXX XXX"/>
                </div>
              )}
              <Row label="Email Alerts" sub="Send stock alerts to admin email via Gmail" right={<Toggle on={alerts.email_alerts==="true"} onChange={()=>setAlerts({...alerts,email_alerts:alerts.email_alerts==="true"?"false":"true"})}/>}/>
              {alerts.email_alerts==="true"&&(
                <div className="modal-field" style={{maxWidth:340,marginTop:4}}>
                  <label>Admin Email <span style={{color:"var(--text3)",fontWeight:400,fontSize:11}}>(receives email alerts — separate from store contact email)</span></label>
                  <input type="email" value={alerts.admin_email} onChange={e=>setAlerts({...alerts,admin_email:e.target.value})} placeholder="admin@gmail.com"/>
                </div>
              )}
            </div>
            <div className="settings-info-box" style={{marginTop:16}}>
              <span>💡</span>
              <span>Store public email (shown on receipts) is set in <strong>Store Info</strong>. Admin email here is only for receiving internal stock alerts.</span>
            </div>
            <SaveBtn section="alerts" data={alerts}/>
          </>)}

          {tab==="sms"&&(<>
            <div className="settings-section-title">SMS — Africa's Talking</div>
            <div className="settings-section-sub">API credentials for sending stock alert SMS. Get your keys at <strong>account.africastalking.com</strong></div>
            <div className="settings-info-box" style={{marginTop:16,marginBottom:20}}>
              <span>💡</span>
              <span>SMS alerts fire automatically after each sale when stock drops below your threshold. Leave <strong>API Key</strong> blank to disable SMS (mock logs only).</span>
            </div>
            <div className="modal-grid" style={{marginTop:4}}>
              <SecretField
                label="API Key"
                value={sms.at_api_key}
                onChange={e=>setSms({...sms,at_api_key:e.target.value})}
                placeholder="Paste from AT dashboard → Settings → API Key"
              />
              <Field label="Username">
                <input
                  placeholder="Your AT registered username (NOT your email)"
                  value={sms.at_username}
                  onChange={e=>setSms({...sms,at_username:e.target.value})}
                />
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
                  Find it at account.africastalking.com → top-right menu → your username (e.g. <em>permicwear</em>). Not your email.
                </div>
              </Field>
              <Field label="Sender ID (optional)">
                <input
                  placeholder="Approved alphanumeric sender ID e.g. PERMICWEAR"
                  value={sms.at_sender_id}
                  onChange={e=>setSms({...sms,at_sender_id:e.target.value})}
                />
              </Field>
            </div>
            <div className="settings-info-box" style={{marginTop:16}}>
              <span>📋</span>
              <span>Set the <strong>Admin Phone</strong> and enable SMS in the <strong>Stock Alerts</strong> tab to activate sending.</span>
            </div>
            <SaveBtn section="sms" data={sms}/>
          </>)}

          {tab==="gmail"&&(<>
            <div className="settings-section-title">Email Alerts via Gmail</div>
            <div className="settings-section-sub">Stock alerts and sale confirmations are sent via your Gmail account using an App Password (not your real password).</div>

            <div className="settings-info-box" style={{marginTop:16,marginBottom:20,borderColor:"rgba(78,205,196,0.4)"}}>
              <span>🔐</span>
              <span>
                Gmail requires an <strong>App Password</strong> — a 16-character code generated specifically for this app.
                Your real Gmail password is never used or stored here.
              </span>
            </div>

            <div className="modal-grid" style={{marginTop:4}}>
              <Field label="Gmail Address">
                <input
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={gmail.gmail_user}
                  onChange={e=>setGmail({...gmail,gmail_user:e.target.value})}
                />
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>
                  The Gmail account that will SEND the alert emails.
                </div>
              </Field>
              <SecretField
                label="Gmail App Password"
                value={gmail.gmail_app_password}
                onChange={e=>setGmail({...gmail,gmail_app_password:e.target.value})}
                placeholder="xxxx xxxx xxxx xxxx (16 characters)"
              />
            </div>

            <div className="settings-info-box" style={{marginTop:20,flexDirection:"column",alignItems:"flex-start",gap:12}}>
              <div style={{fontWeight:700,fontSize:13,color:"var(--text)"}}>📋 How to get your Gmail App Password</div>
              {[
                ["Step 1", "Go to myaccount.google.com and sign in with the Gmail you want to use"],
                ["Step 2", "Click Security in the left sidebar"],
                ["Step 3", "Under 'How you sign in to Google', make sure 2-Step Verification is ON — enable it if not"],
                ["Step 4", "In the search bar at the top type 'App passwords' and click it"],
                ["Step 5", "Under 'App name' type: Permic Wear — then click Create"],
                ["Step 6", "Google shows a 16-character password like: abcd efgh ijkl mnop — copy it"],
                ["Step 7", "Paste it into the App Password field above (spaces are fine, or remove them)"],
                ["Step 8", "Set the Admin Email in the Stock Alerts tab to where you want to RECEIVE emails"],
              ].map(([step, desc], i) => (
                <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"var(--teal)",background:"var(--bg3)",padding:"2px 8px",borderRadius:20,flexShrink:0,whiteSpace:"nowrap"}}>{step}</span>
                  <span style={{fontSize:12,color:"var(--text2)",lineHeight:1.5}}>{desc}</span>
                </div>
              ))}
              <div style={{marginTop:4,padding:"10px 14px",background:"rgba(168,230,207,0.08)",borderRadius:8,border:"1px solid rgba(168,230,207,0.2)",fontSize:12,color:"var(--green)"}}>
                ✅ The App Password only works for this app. You can revoke it anytime from your Google account without changing your real password.
              </div>
            </div>

            <div className="settings-info-box" style={{marginTop:12}}>
              <span>📬</span>
              <span>
                Make sure <strong>Admin Email</strong> in the <strong>Stock Alerts</strong> tab is set — that is where alert emails will be delivered.
                The Gmail above is the sender, the admin email is the recipient.
              </span>
            </div>

            <SaveBtn section="gmail" data={gmail}/>
          </>)}

          {tab==="payments"&&(<>
            <div className="settings-section-title">Payment — Tuma API</div>
            <div className="settings-section-sub">
              Configure your Tuma Payment Solutions credentials. Get your API key from
              <strong> api.tuma.co.ke</strong> dashboard.
            </div>

            {/* Live status */}
            <div className="settings-info-box" style={{marginTop:16,marginBottom:20,borderColor:"rgba(168,230,207,0.4)",background:"rgba(168,230,207,0.06)"}}>
              <span>✅</span>
              <span style={{color:"var(--green)"}}>
                <strong>Production mode</strong> — real customer payments via STK Push.
                Callback URL is auto-configured from your Render backend URL.
              </span>
            </div>

            <div className="modal-grid" style={{marginTop:4}}>
              <Field label="Paybill Number">
                <input value={tuma.tuma_paybill} onChange={e=>setTuma({...tuma,tuma_paybill:e.target.value})} placeholder="e.g. 880100"/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Your Tuma Paybill number</div>
              </Field>
              <Field label="Account Number">
                <input value={tuma.tuma_account} onChange={e=>setTuma({...tuma,tuma_account:e.target.value})} placeholder="e.g. 505008"/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Default account reference for STK pushes</div>
              </Field>
              <Field label="Registered Phone">
                <input value={tuma.tuma_phone} onChange={e=>setTuma({...tuma,tuma_phone:e.target.value})} placeholder="e.g. 0706505008"/>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:4}}>Phone number linked to the paybill</div>
              </Field>
              <SecretField
                label="Tuma API Key"
                value={tuma.tuma_api_key}
                onChange={e=>setTuma({...tuma,tuma_api_key:e.target.value})}
                placeholder="Paste from Tuma dashboard → API Keys"
              />
            </div>

            <div className="settings-info-box" style={{marginTop:16,flexDirection:"column",alignItems:"flex-start",gap:8}}>
              <div style={{fontWeight:700,fontSize:13}}>ℹ️ Environment variables (set in Render):</div>
              <code style={{fontSize:11,color:"var(--text2)",lineHeight:2,background:"var(--bg3)",padding:"8px 12px",borderRadius:6,display:"block",width:"100%",boxSizing:"border-box"}}>
                TUMA_API_KEY=your_api_key<br/>
                TUMA_CALLBACK_URL=https://your-app.onrender.com/api/tuma/callback
              </code>
              <div style={{fontSize:11,color:"var(--text3)"}}>
                The callback URL is automatically derived from your Render app URL.
              </div>
            </div>

            <div style={{display:"flex",gap:12,marginTop:20,flexWrap:"wrap"}}>
              <SaveBtn section="payments" data={tuma}/>
              {user?.role==="super_admin" && (
                <button className="modal-save" style={{background:"var(--bg3)",border:"1px solid var(--border)",color:"var(--text)"}}
                  onClick={async()=>{
                    try {
                      const r = await fetch((import.meta.env.VITE_API_URL||"http://localhost:5000/api")+"/tuma/test-credentials",
                        {headers:{Authorization:`Bearer ${localStorage.getItem("se_token")}`}});
                      const d = await r.json();
                      alert(d.ok
                        ? `OK: ${d.message}\n\nPaybill: ${d.report?.paybill}\nAccount: ${d.report?.account}`
                        : `FAILED: ${d.message}`);
                    } catch(e){alert("Test failed: "+e.message);}
                  }}
                >🔍 Test Credentials</button>
              )}
            </div>
          </>)}

          {tab==="security"&&(<>
            <div className="settings-section-title">Security</div>
            <div className="settings-section-sub">Change your account password.</div>
            <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:14,maxWidth:360}}>
              <div className="modal-field"><label>Current Password</label><input type="password" placeholder="••••••••" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})}/></div>
              <div className="modal-field"><label>New Password</label><input type="password" placeholder="Min 8 characters" value={pwForm.next} onChange={e=>setPwForm({...pwForm,next:e.target.value})}/></div>
              <div className="modal-field"><label>Confirm New Password</label><input type="password" placeholder="Repeat new password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})}/></div>
            </div>
            {pwErr&&<div className="lf-error" style={{marginTop:12,maxWidth:360}}><span>⚠</span> {pwErr}</div>}
            {pwOk&&<div style={{marginTop:12,fontSize:13,color:"var(--green)"}}>✓ Password changed successfully!</div>}
            <div className="settings-save-row" style={{marginTop:20}}><button className="modal-save" onClick={changePw}>Change Password</button></div>
            {user?.role==="super_admin"&&(
              <div className="danger-zone" style={{marginTop:32}}>
                <div className="danger-zone-title">⚠ Danger Zone</div>
                <div className="danger-zone-row"><div><div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Clear Activity Logs</div><div style={{fontSize:12,color:"var(--text3)"}}>Permanently delete all logs</div></div><button className="modal-save modal-save--danger">Clear Logs</button></div>
                <div className="danger-zone-row" style={{marginTop:12}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:"var(--text)"}}>Sign Out</div>
                    <div style={{fontSize:12,color:"var(--text3)"}}>End your session and return to login screen</div>
                  </div>
                  <button
                    className="modal-save"
                    style={{background:"var(--accent)",color:"#000",display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}
                    onClick={logout}
                  >
                    <span>⏻</span> Sign Out
                  </button>
                </div>
              </div>
            )}
          </>)}

        </div>
      </div>
    </div>
  );
}
