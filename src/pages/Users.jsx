import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { usersAPI, storesAPI } from "../services/api";

const ROLE_COLOR = { super_admin:"#f5a623", admin:"#4ecdc4", cashier:"#a8e6cf" };
const ROLE_LABEL = { super_admin:"Super Admin", admin:"Admin", cashier:"Cashier" };
const AV_COLORS  = ["#f5a623","#4ecdc4","#a8e6cf","#f5a62399","#4ecdc499"];
const EMPTY      = () => ({
  name:"", email:"", role:"cashier", password:"", commission_rate:"10",
  store_id: localStorage.getItem("active_store_id") || ""
});

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers]   = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading]= useState(true);
  const [modal, setModal]   = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm]     = useState(EMPTY);
  const [delId, setDelId]   = useState(null);
  const [togId, setTogId]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const load = () => {
    Promise.all([
      usersAPI.getAll().then(r=>setUsers(r.data||[])).catch(()=>{}),
      storesAPI.getAll().then(r=>setStores(r.data||[])).catch(()=>setStores([])),
    ]).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const openAdd  = ()  => { setForm(EMPTY());  setEditId(null); setModal(true); setError(""); };
  const openEdit = u   => { setForm({ name:u.name, email:u.email, role:u.role, password:"", commission_rate:String(u.commission_rate||10), store_id: u.store_id || "" }); setEditId(u.id); setModal(true); setError(""); };

  const save = async () => {
    if (!form.name||!form.email) { setError("Name and email required"); return; }
    setSaving(true); setError("");
    try {
      const payload = { name:form.name, email:form.email, role:form.role, commission_rate:parseFloat(form.commission_rate||10) };
      if (form.store_id) payload.store_id = parseInt(form.store_id);
      if (form.password) payload.password = form.password;
      if (editId) await usersAPI.update(editId, payload);
      else        await usersAPI.create({ ...payload, password: form.password });
      setModal(false); load();
    } catch(e) { setError(e.response?.data?.error || "Save failed"); }
    finally { setSaving(false); }
  };

  const del = async id => { setError("");
    try { await usersAPI.remove(id); setDelId(null); load(); }
    catch(e) { setError(e.response?.data?.error || "Delete failed"); }
  };

  const toggle = async id => {
    const u = users.find(x=>x.id===id);
    try { await usersAPI.update(id, { status: u.status==="active"?"inactive":"active" }); setTogId(null); load(); }
    catch(e) { setError(e.response?.data?.error || "Failed"); }
  };

  const canManage = u => me.role==="super_admin" || (u.role!=="super_admin" && me.role==="admin");
  // super_admin can delete any user except themselves and other super_admins
  // admin can only delete cashiers in their own store
  const canDel = u => {
    if (u.id === me.id) return false;
    if (u.role === 'super_admin') return false;
    if (me.role === 'super_admin') return true;
    if (me.role === 'admin') return u.role === 'cashier';
    return false;
  };

  return (
    <div className="inv-page">
      {modal&&(
        <div className="modal-overlay" onClick={()=>setModal(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{editId?"Edit User":"Add User"}</h3><button className="modal-close" onClick={()=>setModal(false)}>✕</button></div>
            <div className="modal-grid">
              <div className="modal-field"><label>Full Name</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Jane Mwangi"/></div>
              <div className="modal-field"><label>Email</label><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="jane@permicwear.co.ke"/></div>
              <div className="modal-field"><label>Role</label>
                <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                  {me.role==="super_admin"&&<option value="super_admin">Super Admin</option>}
                </select>
              </div>
              <div className="modal-field"><label>Store Assignment</label>
                <select value={form.store_id} onChange={e=>setForm({...form,store_id:e.target.value})}>
                  <option value="">— No store (Super Admin) —</option>
                  {stores.filter(s=>s.is_active).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="modal-field"><label>Commission Rate (%)</label><input type="number" value={form.commission_rate} onChange={e=>setForm({...form,commission_rate:e.target.value})} placeholder="10"/></div>
              <div className="modal-field"><label>{editId?"New Password (blank = keep)":"Password"}</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••"/></div>
            </div>
            {error&&<div className="lf-error" style={{marginTop:12}}><span>⚠</span> {error}</div>}
            <div className="modal-actions"><button className="modal-cancel" onClick={()=>setModal(false)}>Cancel</button><button className="modal-save" onClick={save} disabled={saving}>{saving?"Saving…":editId?"Save Changes":"Create User"}</button></div>
          </div>
        </div>
      )}
      {delId&&(
        <div className="modal-overlay" onClick={()=>setDelId(null)}>
          <div className="modal-card modal-card--sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Remove User?</h3><button className="modal-close" onClick={()=>setDelId(null)}>✕</button></div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>They'll lose all access. Sales history preserved.</p>
            {error&&<div className="lf-error" style={{marginBottom:10}}><span>⚠</span> {error}</div>}
            <div className="modal-actions"><button className="modal-cancel" onClick={()=>setDelId(null)}>Cancel</button><button className="modal-save modal-save--danger" onClick={()=>del(delId)}>Remove</button></div>
          </div>
        </div>
      )}
      {togId&&(
        <div className="modal-overlay" onClick={()=>setTogId(null)}>
          <div className="modal-card modal-card--sm" onClick={e=>e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">{users.find(u=>u.id===togId)?.status==="active"?"Deactivate?":"Activate?"}</h3><button className="modal-close" onClick={()=>setTogId(null)}>✕</button></div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>{users.find(u=>u.id===togId)?.status==="active"?"User won't be able to log in.":"User will regain access."}</p>
            <div className="modal-actions"><button className="modal-cancel" onClick={()=>setTogId(null)}>Cancel</button><button className="modal-save" onClick={()=>toggle(togId)}>Confirm</button></div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div><h1 className="page-title">Users</h1><p className="page-sub">{users.filter(u=>u.status==="active").length} active · {users.filter(u=>u.role==="cashier").length} cashiers</p></div>
        <button className="primary-btn" onClick={openAdd}>+ Add User</button>
      </div>

      {loading ? <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading…</div> : (
        <div className="users-grid">
          {users.map((u,i)=>(
            <div key={u.id} className={`user-card ${u.status==="inactive"?"user-card--inactive":""}`}>
              <div className="user-card-top">
                <div className="user-card-avatar" style={{background:AV_COLORS[i%AV_COLORS.length]}}>{u.avatar}</div>
                <div className="user-card-info">
                  <div className="user-card-name">{u.name}{u.id===me.id&&<span style={{fontSize:10,color:"var(--gold)",marginLeft:4}}>(You)</span>}</div>
                  <div className="user-card-email">{u.email}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end"}}>
                  <span className={`role-tag ${u.role==="super_admin"?"role-tag--super":u.role==="admin"?"role-tag--admin":"role-tag--cashier"}`}>{ROLE_LABEL[u.role]}</span>
                  <span className={`status-tag ${u.status==="active"?"status-tag--active":"status-tag--inactive"}`}>{u.status}</span>
                </div>
              </div>
              <div className="user-card-meta">
                <div className="user-meta-item"><span className="user-meta-label">Last Login</span><span className="user-meta-val">{u.last_login ? new Date(u.last_login).toLocaleString("en-KE") : "Never"}</span></div>
                {u.role==="cashier"&&<div className="user-meta-item"><span className="user-meta-label">Commission</span><span className="user-meta-val" style={{color:"var(--gold)"}}>{u.commission_rate}%</span></div>}
                {u.total_sales!=null&&<div className="user-meta-item"><span className="user-meta-label">Sales</span><span className="user-meta-val">{u.total_sales} txns</span></div>}
                {u.store_id && (() => { const s = stores.find(s=>s.id===u.store_id); return s ? <div className="user-meta-item"><span className="user-meta-label">Store</span><span className="user-meta-val" style={{color:"var(--teal)"}}>{u.role === 'super_admin' ? `🏢 ${s.name}` : `🏪 ${s.name}${s.location ? ` · ${s.location}` : ''}`}</span></div> : null; })()}
              </div>
              {canManage(u)?(
                <div className="user-card-actions">
                  <button className="tbl-btn tbl-btn--edit" onClick={()=>openEdit(u)}>Edit</button>
                  {u.id!==me.id&&<button className="tbl-btn" style={{color:"var(--text2)",border:"1px solid var(--border)"}} onClick={()=>setTogId(u.id)}>{u.status==="active"?"Deactivate":"Activate"}</button>}
                  {canDel(u)&&<button className="tbl-btn tbl-btn--del" onClick={()=>setDelId(u.id)} title="Delete user">🗑 Delete</button>}
                </div>
              ):<div style={{padding:"10px 0 0",fontSize:11,color:"var(--text3)"}}>🔒 Protected account</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
