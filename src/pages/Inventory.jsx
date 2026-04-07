import { useState, useEffect, useRef } from "react";
import { productsAPI, categoriesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { generateSKU } from "../lib/skuGenerator";

// ── Size options ─────────────────────────────────────────────────
const SIZES_SHOES         = ["36","37","38","39","40","41","42","43","44","45","46"];
const SIZES_CLOTH_TOPS    = ["XS","S","M","L","XL","2XL","3XL"];
const SIZES_CLOTH_BOTTOMS = ["26","28","30","32","34","36","38","40","42"];
const SIZES_CLOTH_FREE    = ["Free Size","XS","S","M","L","XL","2XL"];

const CLOTH_TYPE_TO_SIZES = {
  "Shirts":SIZES_CLOTH_TOPS, "T-Shirts":SIZES_CLOTH_TOPS, "Vests":SIZES_CLOTH_TOPS,
  "Hoodies":SIZES_CLOTH_TOPS, "Jackets":SIZES_CLOTH_TOPS, "Tracksuits":SIZES_CLOTH_TOPS,
  "Trousers":SIZES_CLOTH_BOTTOMS, "Jeans":SIZES_CLOTH_BOTTOMS, "Shorts":SIZES_CLOTH_BOTTOMS,
  "Belts":SIZES_CLOTH_FREE, "Caps":SIZES_CLOTH_FREE,
};

const CLOTH_ICONS = {
  "Shirts":"👔","T-Shirts":"👕","Vests":"🎽","Belts":"🔗","Trousers":"👖","Shorts":"🩳",
  "Jeans":"👖","Hoodies":"🧥","Jackets":"🧥","Caps":"🧢","Tracksuits":"🩱",
};

const fmt      = n => `KES ${Number(n||0).toLocaleString()}`;
const stockSt  = s => +s<=2?{l:"Critical",c:"stock-tag--critical"} : +s<=5?{l:"Low",c:"stock-tag--low"} : {l:"OK",c:"stock-tag--ok"};
const getSizeOpts = (topType, brandName) =>
  topType === "shoes" ? SIZES_SHOES : (CLOTH_TYPE_TO_SIZES[brandName] || SIZES_CLOTH_TOPS);

// ── Empty form factories ─────────────────────────────────────────
const emptyForm = (topType = "shoes") => ({
  top_type: topType, name: "", brand: "", brand_id: null,
  sub_type_id: null, category: "", size: "", stock: "", min_price: "",
  sku: "", color: "", photo_url: "",
});

function downloadTemplate() {
  const csv = "name,brand,category,size,color,stock,min_price,sku\nNike Air Force 1,Nike,Air Force 1,42,White,10,4800,NK-AF1-W42\nSlim Fit Shirt,Shirts,Slim Fit,L,Blue,5,1800,SH-SF-B-L\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = "permic-inventory-template.csv"; a.click();
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";

  // ── Category state ────────────────────────────────────────────
  const [topType, setTopType]       = useState(null); // null | "shoes" | "clothes"
  const [brands, setBrands]         = useState([]);
  const [subtypes, setSubtypes]     = useState([]);
  const [selBrand, setSelBrand]     = useState(null); // brand object
  const [selSubtype, setSelSubtype] = useState(null); // subtype object

  // ── Products state ────────────────────────────────────────────
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [search, setSearch]         = useState("");

  // ── Modals ────────────────────────────────────────────────────
  const [modal, setModal]           = useState(false);
  const [editId, setEditId]         = useState(null);
  const [form, setForm]             = useState(emptyForm());
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState("");

  const [delId, setDelId]           = useState(null);
  const [delName, setDelName]       = useState("");

  const [catModal, setCatModal]     = useState(false); // CRUD brands/subtypes
  const [catTab, setCatTab]         = useState("brands"); // "brands" | "subtypes"
  const [catForm, setCatForm]       = useState({ name:"", top_type:"shoes", brand_id:"", photo_url:"" });
  const [catEditId, setCatEditId]   = useState(null);
  const [catSaving, setCatSaving]   = useState(false);
  const [catError, setCatError]     = useState("");

  const [csvModal, setCsvModal]     = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError]     = useState("");

  // ── Bulk creation modal ─────────────────────────────────────────
  const [bulkModal, setBulkModal]     = useState(false);
  const [bulkForm, setBulkForm]       = useState({
    name: "",
    brand: "",
    brand_id: null,
    sub_type_id: null,
    category: "",
    colors: [],
    sizes: [],
    minPrice: "",
    stock: "",
    distributeStock: false,
    photo_url: "",
  });
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkSaving, setBulkSaving]   = useState(false);
  const [bulkError, setBulkError]     = useState("");
  const [bulkPhotoPreview, setBulkPhotoPreview] = useState("");
  const bulkPhotoRef = useRef();

  // ── Bulk creation handlers ──────────────────────────────────────
  const openBulkAdd = () => {
    const f = {
      name: "",
      brand: selBrand?.name || "",
      brand_id: selBrand?.id || null,
      sub_type_id: selSubtype?.id || null,
      category: selSubtype?.name || "",
      colors: [],
      sizes: [],
      minPrice: "",
      stock: "",
      distributeStock: false,
      photo_url: "",
    };
    setBulkForm(f);
    setBulkPreview([]);
    setBulkError("");
    setBulkModal(true);
  };

  const addColor = () => {
    const color = prompt("Enter color name:");
    if (color && !bulkForm.colors.includes(color)) {
      setBulkForm(f => ({ ...f, colors: [...f.colors, color] }));
    }
  };

  const removeColor = (color) => {
    setBulkForm(f => ({ ...f, colors: f.colors.filter(c => c !== color) }));
  };

  const addSize = () => {
    const size = prompt("Enter size (e.g., 40, XL, 32):");
    if (size && !bulkForm.sizes.includes(size)) {
      setBulkForm(f => ({ ...f, sizes: [...f.sizes, size] }));
    }
  };

  const removeSize = (size) => {
    setBulkForm(f => ({ ...f, sizes: f.sizes.filter(s => s !== size) }));
  };

  const handleBulkPhotoFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setBulkPhotoPreview(ev.target.result);
      setBulkForm(f => ({ ...f, photo_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const generateBulkPreview = () => {
    if (!bulkForm.name || !bulkForm.brand || !bulkForm.minPrice) {
      setBulkError("Product name, brand, and min price are required");
      return;
    }
    if (bulkForm.colors.length === 0) {
      setBulkError("Add at least one color");
      return;
    }
    if (bulkForm.sizes.length === 0) {
      setBulkError("Add at least one size");
      return;
    }

    // Import the preview function from variantGenerator
    import('../services/variantGenerator').then(({ previewVariants }) => {
      const preview = previewVariants({
        name: bulkForm.name,
        brand: bulkForm.brand,
        subType: bulkForm.category,
        colors: bulkForm.colors,
        sizes: bulkForm.sizes,
        minPrice: bulkForm.minPrice,
        stock: bulkForm.stock,
        distributeStock: bulkForm.distributeStock,
        photoUrl: bulkForm.photo_url,
      });
      setBulkPreview(preview);
      setBulkError("");
    }).catch(err => {
      setBulkError("Failed to generate preview: " + err.message);
    });
  };

  const saveBulkProducts = async () => {
    if (bulkPreview.length === 0) {
      setBulkError("Generate preview first");
      return;
    }

    setBulkSaving(true);
    setBulkError("");

    try {
      // Prepare the product data for the API
      const productData = {
        name: bulkForm.name,
        brand: bulkForm.brand,
        brand_id: bulkForm.brand_id,
        sub_type_id: bulkForm.sub_type_id,
        subType: bulkForm.category,
        colors: bulkForm.colors,
        sizes: bulkForm.sizes,
        minPrice: bulkForm.minPrice,
        min_price: bulkForm.minPrice,
        stock: bulkForm.stock,
        distributeStock: bulkForm.distributeStock,
        topType: topType,
        top_type: topType,
        category: bulkForm.category,
        photoUrl: bulkForm.photo_url,
        photo_url: bulkForm.photo_url,
        store_id: user?.store_id || null,
      };

      // Use the bulk-create endpoint which handles variant generation on the server
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products/bulk-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(productData)
      });

      const result = await response.json();

      if (response.ok) {
        setBulkModal(false);
        setBulkPreview([]);
        setBulkError("");
        refreshProducts();
      } else {
        setBulkError(result.error || result.message || "Failed to save products");
      }
    } catch (err) {
      setBulkError("Network error: " + err.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const photoRef = useRef();
  const catPhotoRef = useRef();
  const fileRef  = useRef();

  // ── Load brands when topType selected ────────────────────────
  useEffect(() => {
    if (!topType) return;
    categoriesAPI.getBrands({ top_type: topType })
      .then(r => setBrands(r.data || []))
      .catch(() => setBrands([]));
    setSelBrand(null); setSelSubtype(null); setProducts([]);
  }, [topType]);

  // ── Load subtypes when brand selected ────────────────────────
  useEffect(() => {
    if (!selBrand) { setSubtypes([]); setSelSubtype(null); setProducts([]); return; }
    if (selBrand.top_type === "shoes") {
      categoriesAPI.getSubtypes({ brand_id: selBrand.id })
        .then(r => setSubtypes(r.data || []))
        .catch(() => setSubtypes([]));
      setSelSubtype(null); setProducts([]);
    } else {
      // Clothes: brand IS the type (Shirts, Jeans etc.) — go straight to products
      setSubtypes([]); setSelSubtype(null);
      loadProducts({ brand_id: selBrand.id });
    }
  }, [selBrand]);

  // ── Load products when subtype selected (shoes) ───────────────
  useEffect(() => {
    if (!selSubtype) return;
    loadProducts({ sub_type_id: selSubtype.id });
  }, [selSubtype]);

  const loadProducts = (params = {}) => {
    setLoading(true);
    if (search) params.search = search;
    productsAPI.getAll(params)
      .then(r => setProducts(r.data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  const refreshProducts = () => {
    if (selSubtype)        loadProducts({ sub_type_id: selSubtype.id });
    else if (selBrand)     loadProducts({ brand_id: selBrand.id });
  };

  // ── Product modal ─────────────────────────────────────────────
  const openAdd = () => {
    const tt = topType || "shoes";
    const f = emptyForm(tt);
    if (selBrand) { f.brand = selBrand.name; f.brand_id = selBrand.id; }
    if (selSubtype) { f.sub_type_id = selSubtype.id; f.category = selSubtype.name; }
    const sizeOpts = getSizeOpts(tt, selBrand?.name || "");
    f.size = sizeOpts[0] || "";
    setForm(f); setEditId(null); setPhotoPreview(""); setModal(true); setFormError("");
  };

  const openEdit = p => {
    setForm({
      top_type: p.top_type || "shoes",
      name: p.name, brand: p.brand, brand_id: p.brand_id,
      sub_type_id: p.sub_type_id, category: p.category,
      size: p.size, stock: p.stock, min_price: p.min_price,
      sku: p.sku, color: p.color || "", photo_url: p.photo_url || "",
    });
    setPhotoPreview(p.photo_url || "");
    setEditId(p.id); setModal(true); setFormError("");
  };

  const handlePhotoFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhotoPreview(ev.target.result);
      setForm(f => ({ ...f, photo_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!form.name || !form.sku || !form.min_price) {
      setFormError("Name, SKU and Min Price are required"); return;
    }
    setSaving(true); setFormError("");
    try {
      const payload = {
        ...form,
        stock: +form.stock || 0,
        min_price: +form.min_price,
        brand_id: form.brand_id || null,
        sub_type_id: form.sub_type_id || null,
      };
      if (editId) await productsAPI.update(editId, payload);
      else        await productsAPI.create(payload);
      setModal(false); refreshProducts();
    } catch(e) {
      setFormError(e.response?.data?.error || "Save failed");
    }
    finally { setSaving(false); }
  };

  const del = async () => {
    try { await productsAPI.remove(delId); setDelId(null); setDelName(""); refreshProducts(); }
    catch { setFormError("Delete failed"); }
  };

  // ── Category CRUD modal ────────────────────────────────────────
  const openCatAdd = (tab) => {
    setCatTab(tab);
    setCatForm({ name:"", top_type: topType || "shoes", brand_id: selBrand?.id || "", photo_url:"" });
    setCatEditId(null); setCatError(""); setCatModal(true);
  };

  const openCatEdit = (item, tab) => {
    setCatTab(tab);
    setCatForm({
      name: item.name,
      top_type: item.top_type || topType || "shoes",
      brand_id: item.brand_id || "",
      photo_url: item.photo_url || "",
    });
    setCatEditId(item.id); setCatError(""); setCatModal(true);
  };

  const saveCat = async () => {
    if (!catForm.name) { setCatError("Name is required"); return; }
    setCatSaving(true); setCatError("");
    try {
      if (catTab === "brands") {
        if (catEditId) await categoriesAPI.updateBrand(catEditId, { name: catForm.name, photo_url: catForm.photo_url || null });
        else           await categoriesAPI.createBrand({ name: catForm.name, top_type: catForm.top_type, photo_url: catForm.photo_url || null });
      } else {
        if (!catForm.brand_id) { setCatError("Select a brand"); setCatSaving(false); return; }
        if (catEditId) await categoriesAPI.updateSubtype(catEditId, { name: catForm.name, photo_url: catForm.photo_url || null });
        else           await categoriesAPI.createSubtype({ brand_id: catForm.brand_id, name: catForm.name, photo_url: catForm.photo_url || null });
      }
      setCatModal(false);
      // Refresh lists
      if (topType) {
        categoriesAPI.getBrands({ top_type: topType }).then(r => setBrands(r.data || []));
        if (selBrand) categoriesAPI.getSubtypes({ brand_id: selBrand.id }).then(r => setSubtypes(r.data || []));
      }
    } catch(e) { setCatError(e.response?.data?.error || "Save failed"); }
    finally { setCatSaving(false); }
  };

  const deleteCat = async (id, tab) => {
    if (!window.confirm("Remove this category?")) return;
    try {
      if (tab === "brands") {
        await categoriesAPI.deleteBrand(id);
        setBrands(prev => prev.filter(b => b.id !== id));
        if (selBrand?.id === id) { setSelBrand(null); setSelSubtype(null); setProducts([]); }
      } else {
        await categoriesAPI.deleteSubtype(id);
        setSubtypes(prev => prev.filter(s => s.id !== id));
        if (selSubtype?.id === id) { setSelSubtype(null); setProducts([]); }
      }
    } catch(e) { alert(e.response?.data?.error || "Delete failed"); }
  };

  // ── CSV import ────────────────────────────────────────────────
  const handleCSVFile = e => {
    const file = e.target.files[0]; if (!file) return; setCsvError("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const lines = ev.target.result.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).map(line => {
          const vals = line.split(",").map(v => v.trim());
          const row = {}; headers.forEach((h, j) => row[h] = vals[j] || "");
          return {
            name: row.name, brand: row.brand || "Nike",
            category: row.category || "Lifestyle",
            top_type: row.top_type || "shoes",
            size: row.size || "", color: row.color || "",
            sku: row.sku, stock: +row.stock || 0, min_price: +row.min_price || 0,
          };
        }).filter(r => r.name && r.sku);
        if (!rows.length) { setCsvError("No valid rows found."); return; }
        setCsvPreview(rows);
      } catch { setCsvError("Failed to parse CSV."); }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    setSaving(true);
    try { await productsAPI.bulkImport(csvPreview); setCsvModal(false); setCsvPreview([]); refreshProducts(); }
    catch(e) { setCsvError(e.response?.data?.error || "Import failed"); }
    finally { setSaving(false); }
  };

  const sizeOpts = getSizeOpts(form.top_type, form.brand);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="inv-page">

      {/* ── Product Add/Edit Modal ── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal-card" style={{maxWidth:560}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editId ? "Edit Product" : "Add Product"}</h3>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>

            {/* Photo — only for shoes (sub-type level) and clothes type level */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",background:"var(--bg2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {photoPreview
                  ? <img src={photoPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontSize:28,opacity:.4}}>📷</span>}
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Product photo (optional)</div>
                <input ref={photoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoFile}/>
                <button className="modal-cancel" style={{fontSize:12,padding:"5px 12px"}} onClick={() => photoRef.current.click()}>📷 Upload Photo</button>
                {photoPreview && <button className="modal-cancel" style={{fontSize:12,padding:"5px 10px",marginLeft:6}} onClick={() => { setPhotoPreview(""); setForm(f => ({...f, photo_url:""})); }}>✕ Remove</button>}
              </div>
            </div>

            <div className="modal-grid">
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Product Name *</label>
                <input type="text" placeholder={form.top_type==="shoes" ? "Nike Air Force 1 White" : "Slim Fit Black Shirt"}
                  value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
              </div>
              <div className="modal-field">
                <label>Brand / Type</label>
                <input type="text" value={form.brand} readOnly style={{opacity:.7}}/>
              </div>
              <div className="modal-field">
                <label>Category / Model</label>
                <input type="text" value={form.category} onChange={e => setForm({...form, category:e.target.value})} placeholder="e.g. Air Force 1, Slim Fit"/>
              </div>
              <div className="modal-field">
                <label>Size *</label>
                <select value={form.size} onChange={e => setForm({...form, size:e.target.value})}>
                  {sizeOpts.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="modal-field">
                <label>Color / Variant</label>
                <input type="text" placeholder="White, Black, Blue…" value={form.color} onChange={e => setForm({...form, color:e.target.value})}/>
              </div>
              <div className="modal-field">
                <label>Stock Quantity *</label>
                <input type="number" min="0" placeholder="0" value={form.stock} onChange={e => setForm({...form, stock:e.target.value})}/>
              </div>
              <div className="modal-field">
                <label>Min Price (KES) *</label>
                <input type="number" min="0" placeholder="4800" value={form.min_price} onChange={e => setForm({...form, min_price:e.target.value})}/>
              </div>
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>SKU *</label>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input type="text" placeholder="NK-AF1-W42" value={form.sku} onChange={e => setForm({...form, sku:e.target.value})}/>
                  <button className="modal-cancel" style={{fontSize:12,padding:"6px 10px",height:"auto"}}
                    onClick={() => {
                      const sku = generateSKU({
                        brand: form.brand,
                        subType: form.category,
                        color: form.color || "Default",
                        size: form.size
                      });
                      setForm({...form, sku});
                    }}>
                    🤖 Auto SKU
                  </button>
                </div>
              </div>
            </div>

            {formError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {formError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setModal(false)}>Cancel</button>
              <button className="modal-save" onClick={save} disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Add Product"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal-card modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Delete Product?</h3><button className="modal-close" onClick={() => setDelId(null)}>✕</button></div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>Remove <strong>{delName}</strong>? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDelId(null)}>Cancel</button>
              <button className="modal-save modal-save--danger" onClick={del}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category CRUD Modal ── */}
      {catModal && (
        <div className="modal-overlay" onClick={() => setCatModal(false)}>
          <div className="modal-card" style={{maxWidth:480}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{catEditId ? "Edit Category" : "Add Category"}</h3>
              <button className="modal-close" onClick={() => setCatModal(false)}>✕</button>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[["brands","Brand"],["subtypes","Sub-Type / Model"]].map(([t,l]) => (
                <button key={t} style={{flex:1,padding:"8px 0",borderRadius:8,fontWeight:600,fontSize:13,cursor:"pointer",
                  background:catTab===t?"var(--teal)":"var(--bg2)",color:catTab===t?"#000":"var(--text2)",border:"1px solid var(--border)"}}
                  onClick={() => setCatTab(t)}>{l}</button>
              ))}
            </div>
            <div className="modal-grid">
              {catTab === "brands" && (
                <div className="modal-field">
                  <label>Type</label>
                  <select value={catForm.top_type} onChange={e => setCatForm({...catForm, top_type:e.target.value})}>
                    <option value="shoes">👟 Shoes</option>
                    <option value="clothes">👕 Clothes</option>
                  </select>
                </div>
              )}
              {catTab === "subtypes" && (
                <div className="modal-field">
                  <label>Brand *</label>
                  <select value={catForm.brand_id} onChange={e => setCatForm({...catForm, brand_id:e.target.value})}>
                    <option value="">Select brand…</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Name *</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm({...catForm, name:e.target.value})}
                  placeholder={catTab==="brands" ? "e.g. Nike, Adidas, Shirts…" : "e.g. Air Force 1, Slim Fit…"}/>
              </div>
              {/* Photo only for clothes brands (type cards) and shoe sub-types */}
              {(catTab === "subtypes" || catForm.top_type === "clothes") && (
                <div className="modal-field" style={{gridColumn:"1/-1"}}>
                  <label>Category Photo (optional)</label>
                  <div style={{display:"flex",gap:10,alignItems:"center"}}>
                    {catForm.photo_url && <img src={catForm.photo_url} alt="" style={{width:50,height:50,objectFit:"cover",borderRadius:8,border:"1px solid var(--border)"}}/>}
                    <input ref={catPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => {
                      const file = e.target.files[0]; if (!file) return;
                      const r = new FileReader();
                      r.onload = ev => setCatForm(f => ({...f, photo_url: ev.target.result}));
                      r.readAsDataURL(file);
                    }}/>
                    <button className="modal-cancel" style={{fontSize:12,padding:"5px 12px"}} onClick={() => catPhotoRef.current.click()}>📷 Upload</button>
                    {catForm.photo_url && <button className="modal-cancel" style={{fontSize:12,padding:"5px 10px"}} onClick={() => setCatForm(f => ({...f, photo_url:""}))}>✕</button>}
                  </div>
                </div>
              )}
            </div>
            {catError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {catError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setCatModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveCat} disabled={catSaving}>{catSaving ? "Saving…" : catEditId ? "Save Changes" : "Add"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Add Modal ── */}
      {bulkModal && (
        <div className="modal-overlay" onClick={() => { setBulkModal(false); setBulkError(""); }}>
          <div className="modal-card" style={{maxWidth:700}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📦 Bulk Add Products</h3>
              <button className="modal-close" onClick={() => { setBulkModal(false); setBulkError(""); }}>✕</button>
            </div>

            {/* Photo upload */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",background:"var(--bg2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {bulkPhotoPreview
                  ? <img src={bulkPhotoPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : <span style={{fontSize:28,opacity:.4}}>📷</span>}
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Product photo (optional)</div>
                <input ref={bulkPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBulkPhotoFile}/>
                <button className="modal-cancel" style={{fontSize:12,padding:"5px 12px"}} onClick={() => bulkPhotoRef.current.click()}>📷 Upload Photo</button>
                {bulkPhotoPreview && <button className="modal-cancel" style={{fontSize:12,padding:"5px 10px",marginLeft:6}} onClick={() => { setBulkPhotoPreview(""); setBulkForm(f => ({...f, photo_url:""})); }}>✕ Remove</button>}
              </div>
            </div>

            <div className="modal-grid">
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Product Name *</label>
                <input type="text" placeholder="e.g. Nike Air Force 1"
                  value={bulkForm.name} onChange={e => setBulkForm({...bulkForm, name:e.target.value})}/>
              </div>
              <div className="modal-field">
                <label>Brand</label>
                <input type="text" value={bulkForm.brand} readOnly style={{opacity:.7}}/>
              </div>
              <div className="modal-field">
                <label>Model / Category</label>
                <input type="text" value={bulkForm.category} onChange={e => setBulkForm({...bulkForm, category:e.target.value})} placeholder="e.g. Air Force 1"/>
              </div>

              {/* Colors */}
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Colors *</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                  {bulkForm.colors.map(c => (
                    <span key={c} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:"var(--teal)",color:"#000",fontSize:12,fontWeight:600}}>
                      {c}
                      <button onClick={() => removeColor(c)} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:"#000",fontSize:14}}>✕</button>
                    </span>
                  ))}
                  <button className="modal-cancel" style={{fontSize:11,padding:"3px 8px"}} onClick={addColor}>+ Add Color</button>
                </div>
              </div>

              {/* Sizes */}
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Sizes *</label>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:4}}>
                  {bulkForm.sizes.map(s => (
                    <span key={s} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:20,background:"var(--purple)",color:"#fff",fontSize:12,fontWeight:600}}>
                      {s}
                      <button onClick={() => removeSize(s)} style={{background:"none",border:"none",cursor:"pointer",padding:0,color:"#fff",fontSize:14}}>✕</button>
                    </span>
                  ))}
                  <button className="modal-cancel" style={{fontSize:11,padding:"3px 8px"}} onClick={addSize}>+ Add Size</button>
                </div>
              </div>

              <div className="modal-field">
                <label>Min Price (KES) *</label>
                <input type="number" min="0" placeholder="4800" value={bulkForm.minPrice} onChange={e => setBulkForm({...bulkForm, minPrice:e.target.value})}/>
              </div>
              <div className="modal-field">
                <label>Stock per Variant</label>
                <input type="number" min="0" placeholder="10" value={bulkForm.stock} onChange={e => setBulkForm({...bulkForm, stock:e.target.value})}/>
              </div>
              <div className="modal-field" style={{gridColumn:"1/-1",display:"flex",alignItems:"center",gap:8}}>
                <input type="checkbox" id="distributeStock" checked={bulkForm.distributeStock} onChange={e => setBulkForm({...bulkForm, distributeStock:e.target.checked})} style={{width:18,height:18}}/>
                <label htmlFor="distributeStock" style={{cursor:"pointer",fontSize:13}}>Distribute stock across all variants (total stock)</label>
              </div>
            </div>

            {bulkError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {bulkError}</div>}

            {/* Preview */}
            {bulkPreview.length > 0 && (
              <div style={{marginTop:16,maxHeight:200,overflow:"auto",border:"1px solid var(--border)",borderRadius:8}}>
                <div style={{padding:"8px 12px",background:"var(--bg2)",borderBottom:"1px solid var(--border)",fontWeight:600,fontSize:13,position:"sticky",top:0}}>
                  ✓ {bulkPreview.length} variants will be created
                </div>
                <table style={{width:"100%",fontSize:12}}>
                  <thead>
                    <tr style={{background:"var(--bg2)"}}>
                      <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid var(--border)"}}>Color</th>
                      <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid var(--border)"}}>Size</th>
                      <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid var(--border)"}}>SKU</th>
                      <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid var(--border)"}}>Stock</th>
                      <th style={{padding:"6px 8px",textAlign:"left",borderBottom:"1px solid var(--border)"}}>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkPreview.slice(0, 20).map((v, i) => (
                      <tr key={i}>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)"}}>{v.color}</td>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)"}}>{v.size}</td>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)",fontFamily:"monospace",fontSize:11}}>{v.sku}</td>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)"}}>{v.stock}</td>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)"}}>{fmt(v.minPrice)}</td>
                      </tr>
                    ))}
                    {bulkPreview.length > 20 && (
                      <tr>
                        <td colSpan="5" style={{padding:"8px",textAlign:"center",color:"var(--text3)",fontSize:11}}>
                          ... and {bulkPreview.length - 20} more variants
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions" style={{marginTop:16}}>
              <button className="modal-cancel" onClick={() => { setBulkModal(false); setBulkError(""); setBulkPreview([]); }}>Cancel</button>
              <button className="modal-cancel" onClick={generateBulkPreview} disabled={bulkSaving}>🔮 Preview</button>
              <button className="modal-save" onClick={saveBulkProducts} disabled={bulkSaving || bulkPreview.length === 0}>
                {bulkSaving ? "Creating…" : `Create ${bulkPreview.length || ''} Variants`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Modal ── */}
      {csvModal && (
        <div className="modal-overlay" onClick={() => { setCsvModal(false); setCsvPreview([]); setCsvError(""); }}>
          <div className="modal-card" style={{maxWidth:620}} onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3 className="modal-title">Bulk Import CSV</h3><button className="modal-close" onClick={() => { setCsvModal(false); setCsvPreview([]); }}>✕</button></div>
            <div className="csv-info-box"><span>Columns: <code>name, brand, category, top_type, size, color, stock, min_price, sku</code></span><button className="link-btn" onClick={downloadTemplate}>⬇ Template</button></div>
            <div className="csv-drop-area"><input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleCSVFile}/><button className="csv-pick-btn" onClick={() => fileRef.current.click()}>📂 Choose CSV File</button></div>
            {csvError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {csvError}</div>}
            {csvPreview.length > 0 && <div style={{marginTop:12,fontSize:13,color:"var(--green)",fontWeight:600}}>✓ {csvPreview.length} rows ready to import</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setCsvModal(false); setCsvPreview([]); setCsvError(""); }}>Cancel</button>
              <button className="modal-save" disabled={!csvPreview.length || saving} onClick={confirmImport}>{saving ? "Importing…" : `Import ${csvPreview.length} Products`}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">
            {topType === null ? "Select a category to browse" :
             selSubtype ? `${selBrand?.name} › ${selSubtype.name} — ${products.length} variants` :
             selBrand ? `${selBrand.name} — ${products.length} items` :
             `${topType === "shoes" ? "👟 Shoes" : "👕 Clothes"} — ${brands.length} brands`}
          </p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {isAdmin && topType && (
            <button className="modal-cancel" style={{padding:"10px 14px",fontSize:13}} onClick={() => openCatAdd("brands")}>⚙ Manage Categories</button>
          )}
          <button className="modal-cancel" style={{padding:"10px 14px",fontSize:13}} onClick={() => setCsvModal(true)}>📥 Import CSV</button>
          {(selSubtype || (selBrand && topType === "clothes")) && isAdmin && (
            <>
              <button className="primary-btn" style={{fontSize:13}} onClick={openBulkAdd}>📦 Bulk Add</button>
              <button className="primary-btn" style={{fontSize:13}} onClick={openAdd}>+ Add Product</button>
            </>
          )}
        </div>
      </div>

      {/* ── LEVEL 1: Top-type selection ── */}
      {topType === null && (
        <div style={{display:"flex",gap:20,marginTop:20,flexWrap:"wrap"}}>
          {[
            { t:"shoes",   icon:"👟", label:"Shoes",   sub:"Nike, Adidas, Jordan…" },
            { t:"clothes", icon:"👕", label:"Clothes", sub:"Shirts, Jeans, Shorts…" },
          ].map(({ t, icon, label, sub }) => (
            <div key={t}
              className="panel-card"
              style={{flex:1,minWidth:220,cursor:"pointer",padding:30,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s"}}
              onClick={() => setTopType(t)}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--teal)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <div style={{fontSize:56,marginBottom:12}}>{icon}</div>
              <div style={{fontSize:20,fontWeight:700,color:"var(--text)"}}>{label}</div>
              <div style={{fontSize:13,color:"var(--text3)",marginTop:6}}>{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── LEVEL 2: Brand grid ── */}
      {topType && !selBrand && (
        <>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={() => { setTopType(null); setBrands([]); }}>← Back</button>
            <span style={{fontSize:13,color:"var(--text3)"}}>{topType === "shoes" ? "👟 Shoes" : "👕 Clothes"} › Select a brand</span>
            {isAdmin && <button className="tbl-btn tbl-btn--edit" style={{marginLeft:"auto"}} onClick={() => openCatAdd("brands")}>+ Add Brand</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14}}>
            {brands.map(b => (
              <div key={b.id}
                className="panel-card"
                style={{cursor:"pointer",padding:20,textAlign:"center",position:"relative",border:"2px solid var(--border)",transition:"border-color .2s"}}
                onClick={() => setSelBrand(b)}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--teal)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                {b.photo_url
                  ? <img src={b.photo_url} alt={b.name} style={{width:64,height:64,objectFit:"contain",borderRadius:8,margin:"0 auto 10px"}}/>
                  : <div style={{fontSize:40,marginBottom:10}}>{topType === "shoes" ? "👟" : (CLOTH_ICONS[b.name] || "👕")}</div>
                }
                <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{b.name}</div>
                {isAdmin && (
                  <div style={{position:"absolute",top:8,right:8,display:"flex",gap:4}} onClick={e => e.stopPropagation()}>
                    <button className="tbl-btn" style={{padding:"2px 6px",fontSize:11}} onClick={() => openCatEdit(b, "brands")}>✏</button>
                    <button className="tbl-btn tbl-btn--del" style={{padding:"2px 6px",fontSize:11}} onClick={() => deleteCat(b.id, "brands")}>🗑</button>
                  </div>
                )}
              </div>
            ))}
            {brands.length === 0 && <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)"}}>No brands yet. {isAdmin && "Click '+ Add Brand' to create one."}</div>}
          </div>
        </>
      )}

      {/* ── LEVEL 3 (shoes only): Sub-type grid ── */}
      {topType === "shoes" && selBrand && !selSubtype && (
        <>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={() => setSelBrand(null)}>← Back</button>
            <span style={{fontSize:13,color:"var(--text3)"}}>👟 Shoes › {selBrand.name} › Select model</span>
            {isAdmin && <button className="tbl-btn tbl-btn--edit" style={{marginLeft:"auto"}} onClick={() => openCatAdd("subtypes")}>+ Add Model</button>}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14}}>
            {subtypes.map(st => (
              <div key={st.id}
                className="panel-card"
                style={{cursor:"pointer",padding:20,textAlign:"center",position:"relative",border:"2px solid var(--border)",transition:"border-color .2s"}}
                onClick={() => setSelSubtype(st)}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--teal)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                {st.photo_url
                  ? <img src={st.photo_url} alt={st.name} style={{width:64,height:64,objectFit:"contain",borderRadius:8,margin:"0 auto 10px"}}/>
                  : <div style={{fontSize:38,marginBottom:10}}>👟</div>
                }
                <div style={{fontWeight:700,fontSize:13,color:"var(--text)"}}>{st.name}</div>
                {isAdmin && (
                  <div style={{position:"absolute",top:8,right:8,display:"flex",gap:4}} onClick={e => e.stopPropagation()}>
                    <button className="tbl-btn" style={{padding:"2px 6px",fontSize:11}} onClick={() => openCatEdit(st, "subtypes")}>✏</button>
                    <button className="tbl-btn tbl-btn--del" style={{padding:"2px 6px",fontSize:11}} onClick={() => deleteCat(st.id, "subtypes")}>🗑</button>
                  </div>
                )}
              </div>
            ))}
            {subtypes.length === 0 && <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)"}}>No models yet. {isAdmin && "Click '+ Add Model' to create one."}</div>}
          </div>
        </>
      )}

      {/* ── LEVEL 4: Products table ── */}
      {(selSubtype || (selBrand && topType === "clothes")) && (
        <>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={() => {
              if (topType === "clothes") setSelBrand(null);
              else setSelSubtype(null);
              setProducts([]);
            }}>← Back</button>
            <span style={{fontSize:13,color:"var(--text3)"}}>
              {topType === "shoes"
                ? `👟 Shoes › ${selBrand?.name} › ${selSubtype?.name}`
                : `👕 Clothes › ${selBrand?.name}`}
            </span>
            <div className="pos-search-wrap" style={{marginLeft:"auto",flex:"0 0 240px"}}>
              <span className="pos-search-icon">🔍</span>
              <input className="pos-search" placeholder="Search…" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && refreshProducts()}/>
            </div>
          </div>

          {loading && <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading…</div>}

          {!loading && products.length === 0 && (
            <div style={{textAlign:"center",padding:50,color:"var(--text3)"}}>
              <div style={{fontSize:32,marginBottom:10}}>📦</div>
              No products found.
              {isAdmin && <> <button className="link-btn" style={{marginLeft:8}} onClick={openAdd}>Add one now →</button></>}
            </div>
          )}

          {!loading && products.length > 0 && (
            <div className="panel-card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"var(--bg2)",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <span style={{fontWeight:700,fontSize:14}}>{products.length} listings · {products.reduce((s,p) => s + +p.stock, 0)} units total</span>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {isAdmin && <button className="tbl-btn tbl-btn--edit" onClick={openBulkAdd}>📦 Bulk Add</button>}
                  {isAdmin && <button className="tbl-btn tbl-btn--edit" onClick={openAdd}>+ Add Variant</button>}
                </div>
              </div>
              <div className="table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Photo</th><th>Name</th><th>SKU</th><th>Size</th>
                      <th>Color</th><th>Stock</th><th>Status</th><th>Min Price</th>
                      <th>Days In</th>{isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => {
                      const ss = stockSt(p.stock);
                      return (
                        <tr key={p.id}>
                          <td>
                            {p.photo_url
                              ? <img src={p.photo_url} alt={p.name} style={{width:44,height:44,objectFit:"cover",borderRadius:7,border:"1px solid var(--border)"}}/>
                              : <div style={{width:44,height:44,borderRadius:7,background:"var(--bg2)",border:"1px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>
                                  {p.top_type === "shoes" ? "👟" : (CLOTH_ICONS[p.brand] || "👕")}
                                </div>
                            }
                          </td>
                          <td><span style={{fontWeight:600,color:"var(--text)"}}>{p.name}</span><br/><span style={{fontSize:11,color:"var(--text3)"}}>{p.category}</span></td>
                          <td className="txn-id">{p.sku}</td>
                          <td><span style={{fontWeight:600}}>{p.size}</span></td>
                          <td>{p.color || <span style={{color:"var(--text3)"}}>—</span>}</td>
                          <td><span style={{fontWeight:700,fontSize:15}}>{p.stock}</span></td>
                          <td><span className={`stock-tag ${ss.c}`}>{ss.l}</span></td>
                          <td>{fmt(p.min_price)}</td>
                          <td><span style={{color:p.days_in_stock>60?"var(--teal)":"var(--text2)"}}>{p.days_in_stock}d</span></td>
                          {isAdmin && (
                            <td>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                <button className="tbl-btn tbl-btn--edit" onClick={() => openEdit(p)}>✏ Edit</button>
                                <button className="tbl-btn" style={{background:"var(--bg2)",color:"var(--text2)",border:"1px solid var(--border)"}}
                                  onClick={() => { setForm({...p, stock:"", sku:"", photo_url: p.photo_url||""}); setPhotoPreview(p.photo_url||""); setEditId(null); setModal(true); setFormError(""); }}>
                                  + Variant
                                </button>
                                <button className="tbl-btn tbl-btn--del" onClick={() => { setDelId(p.id); setDelName(`${p.name} Sz${p.size}`); }}>🗑</button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
