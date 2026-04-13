import { useState, useEffect, useRef } from "react";
import { productsAPI, categoriesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { generateSKU } from "../lib/skuGenerator";
import BarcodePrinter from "../components/BarcodePrinter";

// ── Size options ─────────────────────────────────────────────────
const SIZES_SHOES = [
  "33","34","35","36","37","38","39","40",
  "41","42","43","44","45","46","47","48"
];

const SIZES_CLOTH_ALL = [
  "XS","S","M","L","XL","2XL","3XL","4XL","5XL","6XL",
  "26","27","28","29","30","31","32","33","34","35",
  "36","37","38","39","40","41","42","43","44","45",
  "46","47","48","49","50"
];

const getSizeOpts = (topType, categoryName = "") => {
  const type = (topType || "").toLowerCase();
  if (type === "shoes") return SIZES_SHOES;
  if (type === "clothes") return SIZES_CLOTH_ALL;
  return [];
};

const CLOTH_ICONS = {
  "Shirts":"👔","T-Shirts":"👕","Vests":"🎽","Belts":"🔗","Trousers":"👖","Shorts":"🩳",
  "Jeans":"👖","Hoodies":"🧥","Jackets":"🧥","Caps":"🧢","Tracksuits":"🩱",
};

const fmt = n => `KES ${Number(n||0).toLocaleString()}`;
const stockSt = s => +s<=2?{l:"Critical",c:"stock-tag--critical"} : +s<=5?{l:"Low",c:"stock-tag--low"} : {l:"OK",c:"stock-tag--ok"};

// ── Empty form factory ────────────────────────────────────────────
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

// ── Category Navigation Hook ──────────────────────────────────────
function useCategoryNav() {
  const [topType, setTopType] = useState(null);
  const [brands, setBrands] = useState([]);
  const [subtypes, setSubtypes] = useState([]);
  const [selBrand, setSelBrand] = useState(null);
  const [selSubtype, setSelSubtype] = useState(null);
  const [loading, setLoading] = useState(false);

  const goTop = () => {
    setTopType(null); setSelBrand(null); setSelSubtype(null);
    setBrands([]); setSubtypes([]);
  };

  const goBrands = tt => {
    setTopType(tt); setSelBrand(null); setSelSubtype(null); setSubtypes([]);
    setLoading(true);
    categoriesAPI.getBrands({ top_type: tt })
      .then(r => setBrands(r.data || []))
      .catch(() => setBrands([]))
      .finally(() => setLoading(false));
  };

  const goSubtypes = b => {
    setSelBrand(b); setSelSubtype(null);
    if (b?.top_type === "shoes") {
      setLoading(true);
      categoriesAPI.getSubtypes({ brand_id: b.id })
        .then(r => setSubtypes(r.data || []))
        .catch(() => setSubtypes([]))
        .finally(() => setLoading(false));
    } else {
      setSubtypes([]);
    }
  };

  const selectSubtype = st => setSelSubtype(st);

  const goBack = () => {
    const level = topType === null ? "top" : selBrand === null ? "brands" : (topType === "shoes" && selSubtype === null) ? "subtypes" : "products";
    if (level === "products") { setSelSubtype(null); }
    else if (level === "subtypes") { setSelBrand(null); setSelSubtype(null); }
    else if (level === "brands") { goTop(); }
  };

  const shouldSkipSubtypes = topType === "clothes" && selBrand !== null;
  const level = topType === null ? "top" : selBrand === null ? "brands" : shouldSkipSubtypes ? "products" : (selSubtype === null ? "subtypes" : "products");

  return {
    topType, brands, subtypes, selBrand, selSubtype,
    setSelSubtype: selectSubtype, level, loading,
    goTop, goBrands, goSubtypes, goBack, shouldSkipSubtypes
  };
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const cat = useCategoryNav();

  // ── Products state ────────────────────────────────────────────
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [search, setSearch]       = useState("");

  // ── Modals ────────────────────────────────────────────────────
  const [modal, setModal]         = useState(false);
  const [editId, setEditId]       = useState(null);
  const [form, setForm]           = useState(emptyForm());
  const [photoPreview, setPhotoPreview] = useState("");
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState("");

  const [delId, setDelId]         = useState(null);
  const [delName, setDelName]     = useState("");

  // ── Category/Brand Management Modals ─────────────────────────
  const [brandModal, setBrandModal]   = useState(false);
  const [brandForm, setBrandForm]     = useState({ name: "", top_type: "", photo_url: "" });
  const [brandEditId, setBrandEditId] = useState(null);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandError, setBrandError]   = useState("");

  const [delBrandId, setDelBrandId] = useState(null);
  const [delBrandName, setDelBrandName] = useState("");

  // ── Sub-Type (Model) Management Modals ───────────────────────
  const [subtypeModal, setSubtypeModal]     = useState(false);
  const [subtypeForm, setSubtypeForm]       = useState({ name: "", brand_id: null, photo_url: "" });
  const [subtypeEditId, setSubtypeEditId]   = useState(null);
  const [subtypeSaving, setSubtypeSaving]   = useState(false);
  const [subtypeError, setSubtypeError]     = useState("");

  const [delSubtypeId, setDelSubtypeId]     = useState(null);
  const [delSubtypeName, setDelSubtypeName] = useState("");

  const [csvModal, setCsvModal]   = useState(false);
  const [csvPreview, setCsvPreview] = useState([]);
  const [csvError, setCsvError]   = useState("");

  // Barcode printing
  const [barcodeSku, setBarcodeSku]   = useState(null);
  const [barcodeName, setBarcodeName] = useState("");

  // ── Bulk creation modal ───────────────────────────────────────
  const [bulkModal, setBulkModal]   = useState(false);
  const [bulkForm, setBulkForm]     = useState({
    name: "", brand: "", brand_id: null, sub_type_id: null, category: "",
    colors: [], sizes: [], minPrice: "", stockMap: {}, photo_url: "",
  });
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkSaving, setBulkSaving]   = useState(false);
  const [bulkError, setBulkError]     = useState("");
  const [bulkPhotoPreview, setBulkPhotoPreview] = useState("");
  const bulkPhotoRef = useRef();

  const photoRef = useRef();
  const fileRef  = useRef();

  // ── Variant stock map helpers ─────────────────────────────────
  const getVariantKey = (color, size) => `${color}||${size}`;

  const setVariantStock = (color, size, value) => {
    const key = getVariantKey(color, size);
    const numValue = parseInt(value);
    setBulkForm(f => {
      const newMap = { ...f.stockMap };
      if (!isNaN(numValue) && numValue > 0) {
        newMap[key] = numValue;
      } else {
        delete newMap[key];
      }
      return { ...f, stockMap: newMap };
    });
  };

  const getVariantStock = (color, size) => {
    return bulkForm.stockMap[getVariantKey(color, size)] || "";
  };

  const getColorTotal = (color) => {
    return bulkForm.sizes.reduce((sum, size) =>
      sum + (parseInt(bulkForm.stockMap[getVariantKey(color, size)]) || 0), 0);
  };

  const getSizeTotal = (size) => {
    return bulkForm.colors.reduce((sum, color) =>
      sum + (parseInt(bulkForm.stockMap[getVariantKey(color, size)]) || 0), 0);
  };

  const getTotalStock = () => {
    return Object.values(bulkForm.stockMap).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  };

  // ── Close and reset bulk modal ─────────────────────────────────
  const closeBulkModal = () => {
    setBulkModal(false);
    setTimeout(() => {
      setBulkPreview([]);
      setBulkError("");
      setBulkPhotoPreview("");
      setBulkForm({
        name: "", brand: "", brand_id: null, sub_type_id: null, category: "",
        colors: [], sizes: [], minPrice: "", stockMap: {}, photo_url: "",
      });
    }, 300);
  };

  // ── Bulk modal open ───────────────────────────────────────────
  const openBulkAdd = () => {
    const brandName    = cat.selBrand?.name || "";
    const brandId      = cat.selBrand?.id || null;
    const subTypeId    = cat.selSubtype?.id || null;
    const categoryName = cat.selSubtype?.name || "";
    setBulkForm({
      name: "", brand: brandName, brand_id: brandId,
      sub_type_id: subTypeId, category: categoryName,
      colors: [], sizes: [], minPrice: "", stockMap: {}, photo_url: "",
    });
    setBulkPreview([]); setBulkError(""); setBulkPhotoPreview(""); setBulkModal(true);
  };

  const addColor = () => {
    const c = prompt("Enter color name:");
    if (c && c.trim() && !bulkForm.colors.includes(c.trim()))
      setBulkForm(f => ({ ...f, colors: [...f.colors, c.trim()] }));
  };

  const removeColor = (c) => {
    setBulkForm(f => {
      const newMap = { ...f.stockMap };
      f.sizes.forEach(s => delete newMap[getVariantKey(c, s)]);
      return { ...f, colors: f.colors.filter(x => x !== c), stockMap: newMap };
    });
  };

  const removeSize = (s) => {
    setBulkForm(f => {
      const newMap = { ...f.stockMap };
      f.colors.forEach(c => delete newMap[getVariantKey(c, s)]);
      return { ...f, sizes: f.sizes.filter(x => x !== s), stockMap: newMap };
    });
  };

  const addSizeFromPicker = (s) => {
    if (s && !bulkForm.sizes.includes(s))
      setBulkForm(f => ({ ...f, sizes: [...f.sizes, s] }));
  };

  const getBulkSizeOpts = () => {
    const topType = (cat.topType || "").toLowerCase();
    if (topType === "shoes") return SIZES_SHOES;
    if (topType === "clothes") return SIZES_CLOTH_ALL;
    return [];
  };

  const bulkSizeOpts = getBulkSizeOpts();
  const bulkUnselectedSizes = bulkSizeOpts.filter(s => !bulkForm.sizes.includes(s));

  const handleBulkPhotoFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setBulkPhotoPreview(ev.target.result);
      setBulkForm(f => ({ ...f, photo_url: ev.target.result }));
    };
    reader.readAsDataURL(file);
  };

  // ── Generate preview only for variants with stock > 0 ──
  const generateBulkPreview = () => {
    setBulkError("");

    if (!bulkForm.name || !bulkForm.name.trim()) {
      setBulkError("Product name is required"); return;
    }
    if (!bulkForm.brand) {
      setBulkError("Brand is required"); return;
    }
    if (!bulkForm.minPrice || parseFloat(bulkForm.minPrice) <= 0) {
      setBulkError("Valid minimum price is required"); return;
    }
    if (bulkForm.colors.length === 0) {
      setBulkError("Add at least one color"); return;
    }
    if (bulkForm.sizes.length === 0) {
      setBulkError("Add at least one size"); return;
    }

    const preview = [];
    let hasStock = false;
    const skuMap = new Map();

    bulkForm.colors.forEach(color => {
      bulkForm.sizes.forEach(size => {
        const qty = parseInt(bulkForm.stockMap[getVariantKey(color, size)]) || 0;

        if (qty > 0) {
          hasStock = true;

          const sku = generateSKU({
            brand: bulkForm.brand,
            subType: bulkForm.category,
            color,
            size
          });

          if (skuMap.has(sku)) {
            setBulkError(`Duplicate SKU detected for ${color} - ${size}`);
            return;
          }
          skuMap.set(sku, true);

          preview.push({
            name: bulkForm.name.trim(),
            color: color.trim(),
            size: size,
            stock: qty,
            min_price: parseFloat(bulkForm.minPrice),
            sku: sku,
            brand: bulkForm.brand,
            brand_id: bulkForm.brand_id ? parseInt(bulkForm.brand_id) : null,
            sub_type_id: bulkForm.sub_type_id ? parseInt(bulkForm.sub_type_id) : null,
            category: bulkForm.category || "",
            photo_url: bulkForm.photo_url || null,
            top_type: cat.topType || "shoes",
            store_id: parseInt(localStorage.getItem("active_store_id") || user?.store_id || 0) || undefined,
          });
        }
      });
    });

    if (!hasStock) {
      setBulkError("No stock entered for any variant! Please set stock values before generating preview.");
      return;
    }

    if (preview.length === 0) {
      setBulkError("No valid variants to create");
      return;
    }

    setBulkPreview(preview);
    setBulkError(`✅ ${preview.length} variants ready to create`);
  };

  // ── FIX: Send bulkPreview array directly (each item has correct stock/sku/color/size) ──
  const saveBulkProducts = async () => {
    if (bulkPreview.length === 0) {
      setBulkError("Generate preview first");
      return;
    }

    setBulkSaving(true);
    setBulkError("");

    try {
      // Send the already-built preview array — each object is a ready product row
      // with real stock values, not the matrix object that caused the 400 error
      const response = await productsAPI.bulkCreate(bulkPreview);

      if (response.data) {
        closeBulkModal();
        refreshProducts();
        alert(`✅ Successfully created ${response.data.created || bulkPreview.length} products!`);
        if (response.data.errors && response.data.errors.length > 0) {
          console.warn("Warnings:", response.data.errors);
        }
      }
    } catch (err) {
      console.error("Bulk save error:", err);
      const errData = err.response?.data;
      let errorMessage = errData?.error || err.message || "Failed to save products";
      if (errData?.details) {
        errorMessage += ": " + (Array.isArray(errData.details) ? errData.details.join(", ") : errData.details);
      }
      setBulkError(`Validation failed: ${errorMessage}`);
    } finally {
      setBulkSaving(false);
    }
  };

  // ── Load products ─────────────────────────────────────────────
  useEffect(() => {
    if (cat.level !== "products") { setProducts([]); return; }
    loadProducts();
  }, [cat.level, cat.selSubtype?.id, cat.selBrand?.id]);

  const loadProducts = (params = {}) => {
    setLoading(true);
    if (search) params.search = search;
    if (cat.level === "products") {
      if (cat.topType === "shoes" && cat.selSubtype) {
        params.sub_type_id = cat.selSubtype.id;
      } else if (cat.selBrand) {
        params.brand_id = cat.selBrand.id;
      }
    }
    productsAPI.getAll(params)
      .then(r => setProducts(r.data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  const refreshProducts = () => loadProducts();

  // ── Product modal ─────────────────────────────────────────────
  const openAdd = () => {
    const topType = (cat.topType || "").toLowerCase();
    if (!topType || (topType !== "shoes" && topType !== "clothes")) {
      setFormError("Please select a category first (Shoes or Clothes)"); return;
    }
    const f = emptyForm(topType);
    if (cat.selBrand)   { f.brand = cat.selBrand.name; f.brand_id = cat.selBrand.id; }
    if (cat.selSubtype) { f.sub_type_id = cat.selSubtype.id; f.category = cat.selSubtype.name; }
    const sizes = getSizeOpts(topType, f.category);
    if (sizes.length === 0) {
      setFormError(`No size options available for ${topType}${f.category ? ` / ${f.category}` : ''}`); return;
    }
    if (!sizes.includes(f.size)) f.size = sizes[0] || "";
    setForm(f); setEditId(null); setPhotoPreview(""); setModal(true); setFormError("");
  };

  const openEdit = p => {
    setForm({
      top_type: p.top_type || "shoes", name: p.name, brand: p.brand,
      brand_id: p.brand_id, sub_type_id: p.sub_type_id, category: p.category,
      size: p.size, stock: p.stock, min_price: p.min_price,
      sku: p.sku, color: p.color || "", photo_url: p.photo_url || ""
    });
    setPhotoPreview(p.photo_url || ""); setEditId(p.id); setModal(true); setFormError("");
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
        ...form, stock: +form.stock || 0, min_price: +form.min_price,
        brand_id: form.brand_id || null, sub_type_id: form.sub_type_id || null
      };
      if (editId) { await productsAPI.update(editId, payload); }
      else        { await productsAPI.create(payload); }
      setModal(false); refreshProducts();
    } catch(e) {
      setFormError(e.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    try {
      await productsAPI.remove(delId);
      setDelId(null); setDelName(""); refreshProducts();
    } catch {
      setFormError("Delete failed");
    }
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
            sku: row.sku, stock: +row.stock || 0, min_price: +row.min_price || 0
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
    try {
      await productsAPI.bulkImport(csvPreview);
      setCsvModal(false); setCsvPreview([]); refreshProducts();
    } catch(e) {
      setCsvError(e.response?.data?.error || "Import failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Brand Management ──────────────────────────────────────────
  const openBrandAdd = () => {
    setBrandForm({ name: "", top_type: cat.topType || "shoes", photo_url: "" });
    setBrandEditId(null); setBrandError(""); setBrandModal(true);
  };

  const openBrandEdit = (brand) => {
    setBrandForm({ name: brand.name, top_type: brand.top_type, photo_url: brand.photo_url || "" });
    setBrandEditId(brand.id); setBrandError(""); setBrandModal(true);
  };

  const saveBrand = async () => {
    if (!brandForm.name || !brandForm.top_type) { setBrandError("Name and type are required"); return; }
    setBrandSaving(true); setBrandError("");
    try {
      if (brandEditId) { await categoriesAPI.updateBrand(brandEditId, brandForm); }
      else             { await categoriesAPI.createBrand(brandForm); }
      setBrandModal(false); cat.goBrands(cat.topType);
    } catch(e) {
      setBrandError(e.response?.data?.error || "Save failed");
    } finally {
      setBrandSaving(false);
    }
  };

  const deleteBrand = async () => {
    try {
      await categoriesAPI.deleteBrand(delBrandId);
      setDelBrandId(null); setDelBrandName(""); cat.goBrands(cat.topType);
    } catch(e) { console.error("Delete failed:", e); }
  };

  // ── Sub-Type Management ───────────────────────────────────────
  const openSubtypeAdd = () => {
    setSubtypeForm({ name: "", brand_id: cat.selBrand?.id || null, photo_url: "" });
    setSubtypeEditId(null); setSubtypeError(""); setSubtypeModal(true);
  };

  const openSubtypeEdit = (subtype) => {
    setSubtypeForm({ name: subtype.name, brand_id: subtype.brand_id, photo_url: subtype.photo_url || "" });
    setSubtypeEditId(subtype.id); setSubtypeError(""); setSubtypeModal(true);
  };

  const saveSubtype = async () => {
    if (!subtypeForm.name || !subtypeForm.brand_id) { setSubtypeError("Name and brand are required"); return; }
    setSubtypeSaving(true); setSubtypeError("");
    try {
      if (subtypeEditId) { await categoriesAPI.updateSubtype(subtypeEditId, subtypeForm); }
      else               { await categoriesAPI.createSubtype(subtypeForm); }
      setSubtypeModal(false); cat.goSubtypes(cat.selBrand);
    } catch(e) {
      setSubtypeError(e.response?.data?.error || "Save failed");
    } finally {
      setSubtypeSaving(false);
    }
  };

  const deleteSubtype = async () => {
    try {
      await categoriesAPI.deleteSubtype(delSubtypeId);
      setDelSubtypeId(null); setDelSubtypeName(""); cat.goSubtypes(cat.selBrand);
    } catch(e) { console.error("Delete failed:", e); }
  };

  const sizeOpts = getSizeOpts(form.top_type, form.category);

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
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",background:"var(--bg2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {photoPreview ? <img src={photoPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:28,opacity:.4}}>📷</span>}
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
                <input type="text" placeholder={form.top_type==="shoes" ? "Nike Air Force 1 White" : "Slim Fit Black Shirt"} value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
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
                  {sizeOpts.length > 0
                    ? sizeOpts.map(s => <option key={s}>{s}</option>)
                    : <option value="" disabled>No sizes available for this category</option>
                  }
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
                  <button className="modal-cancel" style={{fontSize:12,padding:"6px 10px",height:"auto"}} onClick={() => {
                    const sku = generateSKU({ brand: form.brand, subType: form.category, color: form.color || "Default", size: form.size });
                    setForm({...form, sku});
                  }}>🤖 Auto SKU</button>
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

      {/* ── Delete Product Confirm ── */}
      {delId && (
        <div className="modal-overlay" onClick={() => setDelId(null)}>
          <div className="modal-card modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Product?</h3>
              <button className="modal-close" onClick={() => setDelId(null)}>✕</button>
            </div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>Remove <strong>{delName}</strong>? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDelId(null)}>Cancel</button>
              <button className="modal-save modal-save--danger" onClick={del}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Barcode Printer ── */}
      {barcodeSku && (
        <BarcodePrinter
          sku={barcodeSku}
          productName={barcodeName}
          onClose={() => { setBarcodeSku(null); setBarcodeName(""); }}
        />
      )}

      {/* ── Bulk Add Modal ── */}
      {bulkModal && (
        <div className="modal-overlay" onClick={closeBulkModal}>
          <div className="modal-card" style={{maxWidth:740}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📦 Bulk Add Products</h3>
              <button className="modal-close" onClick={closeBulkModal}>✕</button>
            </div>

            {/* Photo */}
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
              <div style={{width:80,height:80,borderRadius:10,overflow:"hidden",background:"var(--bg2)",border:"2px dashed var(--border)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {bulkPhotoPreview ? <img src={bulkPhotoPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:28,opacity:.4}}>📷</span>}
              </div>
              <div>
                <div style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Product photo (optional)</div>
                <input ref={bulkPhotoRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleBulkPhotoFile}/>
                <button className="modal-cancel" style={{fontSize:12,padding:"5px 12px"}} onClick={() => bulkPhotoRef.current.click()}>📷 Upload Photo</button>
                {bulkPhotoPreview && (
                  <button className="modal-cancel" style={{fontSize:12,padding:"5px 10px",marginLeft:6}} onClick={() => { setBulkPhotoPreview(""); setBulkForm(f => ({...f, photo_url:""})); }}>
                    ✕ Remove
                  </button>
                )}
              </div>
            </div>

            <div className="modal-grid">
              {/* Name */}
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Product Name *</label>
                <input type="text" placeholder="e.g. Nike Air Force 1" value={bulkForm.name} onChange={e => setBulkForm({...bulkForm, name:e.target.value})}/>
              </div>

              {/* Brand + Category */}
              <div className="modal-field">
                <label>Brand</label>
                <input type="text" value={bulkForm.brand} readOnly style={{opacity:.7}}/>
              </div>
              <div className="modal-field">
                <label>Model / Category</label>
                <input type="text" value={bulkForm.category} onChange={e => setBulkForm({...bulkForm, category:e.target.value})} placeholder="e.g. Air Force 1"/>
              </div>

              {/* Min Price */}
              <div className="modal-field">
                <label>Min Price (KES) *</label>
                <input type="number" min="0" step="0.01" placeholder="4800" value={bulkForm.minPrice} onChange={e => setBulkForm({...bulkForm, minPrice:e.target.value})}/>
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
                </div>
                <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center"}}>
                  <select
                    onChange={e => { if (e.target.value) { addSizeFromPicker(e.target.value); e.target.value=""; }}}
                    style={{flex:1,padding:"6px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--bg2)",color:"var(--text1)",fontSize:13}}
                  >
                    <option value="">+ Pick size to add…</option>
                    {bulkUnselectedSizes.map(s => (
                      <option key={s} value={s}>
                        {cat.topType === "shoes" ? `EU ${s}` : (s.match(/^\d+$/) ? `Waist ${s}"` : s)}
                      </option>
                    ))}
                  </select>
                  <button className="modal-cancel" style={{fontSize:11,padding:"6px 10px",whiteSpace:"nowrap"}} onClick={() => setBulkForm(f => ({...f, sizes: bulkSizeOpts}))}>All Sizes</button>
                  <button className="modal-cancel" style={{fontSize:11,padding:"6px 10px",whiteSpace:"nowrap"}} onClick={() => setBulkForm(f => ({...f, sizes: [], stockMap: {}}))}>Clear</button>
                </div>
              </div>

              {/* ── Stock Matrix ── */}
              {bulkForm.colors.length > 0 && bulkForm.sizes.length > 0 && (
                <div className="modal-field" style={{gridColumn:"1/-1"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                    <label style={{margin:0}}>Stock per variant (color × size)</label>
                    <div style={{display:"flex",gap:6}}>
                      <button
                        className="modal-cancel"
                        style={{fontSize:11,padding:"3px 8px"}}
                        onClick={() => {
                          const v = prompt("Fill all empty cells with stock value:");
                          if (!v || isNaN(v) || parseInt(v) <= 0) return;
                          setBulkForm(f => {
                            const newMap = { ...f.stockMap };
                            f.colors.forEach(c => f.sizes.forEach(s => {
                              const key = getVariantKey(c, s);
                              if (!newMap[key]) newMap[key] = parseInt(v);
                            }));
                            return { ...f, stockMap: newMap };
                          });
                        }}
                      >
                        Fill empty
                      </button>
                      <button
                        className="modal-cancel"
                        style={{fontSize:11,padding:"3px 8px"}}
                        onClick={() => {
                          const v = prompt("Set ALL cells to this stock value:");
                          if (!v || isNaN(v) || parseInt(v) <= 0) return;
                          setBulkForm(f => {
                            const newMap = {};
                            f.colors.forEach(c => f.sizes.forEach(s => {
                              newMap[getVariantKey(c, s)] = parseInt(v);
                            }));
                            return { ...f, stockMap: newMap };
                          });
                        }}
                      >
                        Set all
                      </button>
                      <button
                        className="modal-cancel"
                        style={{fontSize:11,padding:"3px 8px"}}
                        onClick={() => setBulkForm(f => ({ ...f, stockMap: {} }))}
                      >
                        Clear all
                      </button>
                    </div>
                  </div>

                  <div style={{overflowX:"auto",border:"1px solid var(--border)",borderRadius:8}}>
                    <table style={{borderCollapse:"collapse",minWidth:"100%",fontSize:12}}>
                      <thead>
                        <tr style={{background:"var(--bg2)"}}>
                          <th style={{padding:"7px 10px",textAlign:"left",borderBottom:"1px solid var(--border)",fontWeight:600,minWidth:90,whiteSpace:"nowrap"}}>
                            Color \ Size
                          </th>
                          {bulkForm.sizes.map(s => (
                            <th key={s} style={{padding:"7px 8px",textAlign:"center",borderBottom:"1px solid var(--border)",fontWeight:600,minWidth:58,whiteSpace:"nowrap"}}>
                              {cat.topType === "shoes" ? `EU ${s}` : (s.match(/^\d+$/) ? `${s}"` : s)}
                            </th>
                          ))}
                          <th style={{padding:"7px 8px",textAlign:"center",borderBottom:"1px solid var(--border)",fontWeight:600,color:"var(--text3)",minWidth:54}}>
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkForm.colors.map(color => (
                          <tr key={color}>
                            <td style={{padding:"5px 10px",fontWeight:600,borderBottom:"1px solid var(--border)",whiteSpace:"nowrap",color:"var(--text1)"}}>
                              {color}
                            </td>
                            {bulkForm.sizes.map(size => {
                              const val = getVariantStock(color, size);
                              return (
                                <td key={size} style={{padding:"4px 5px",textAlign:"center",borderBottom:"1px solid var(--border)"}}>
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={val}
                                    onChange={e => setVariantStock(color, size, e.target.value)}
                                    style={{
                                      width:52,
                                      textAlign:"center",
                                      padding:"5px 4px",
                                      borderRadius:6,
                                      border:`1px solid ${val ? "var(--teal)" : "var(--border)"}`,
                                      background: val ? "rgba(29,158,117,0.08)" : "var(--bg2)",
                                      color:"var(--text1)",
                                      fontSize:12,
                                      outline:"none",
                                    }}
                                  />
                                </td>
                              );
                            })}
                            <td style={{padding:"5px 8px",textAlign:"center",borderBottom:"1px solid var(--border)",fontWeight:600,color:"var(--text3)",fontSize:12}}>
                              {getColorTotal(color) || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{background:"var(--bg2)"}}>
                          <th style={{padding:"6px 10px",textAlign:"left",fontSize:11,color:"var(--text3)",fontWeight:600}}>Total</th>
                          {bulkForm.sizes.map(size => (
                            <th key={size} style={{padding:"6px 8px",textAlign:"center",fontSize:11,color:"var(--text3)",fontWeight:600}}>
                              {getSizeTotal(size) || "—"}
                            </th>
                          ))}
                          <th style={{padding:"6px 8px",textAlign:"center",fontSize:12,fontWeight:700,color:"var(--text1)"}}>
                            {getTotalStock() || "—"}
                          </th>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div style={{marginTop:6,fontSize:11,color:"var(--text3)"}}>
                    {Object.keys(bulkForm.stockMap).length} of {bulkForm.colors.length * bulkForm.sizes.length} variants have stock set · {getTotalStock()} units total
                  </div>
                </div>
              )}
            </div>

            {bulkError && (
              <div className="lf-error" style={{marginTop:12}}>
                <span>⚠</span> {bulkError}
              </div>
            )}

            {/* Preview table - only shows variants with stock > 0 */}
            {bulkPreview.length > 0 && (
              <div style={{marginTop:16,maxHeight:200,overflow:"auto",border:"1px solid var(--border)",borderRadius:8}}>
                <div style={{padding:"8px 12px",background:"var(--bg2)",borderBottom:"1px solid var(--border)",fontWeight:600,fontSize:13,position:"sticky",top:0}}>
                  ✓ {bulkPreview.length} variants will be created · {bulkPreview.reduce((s,v) => s + (+v.stock||0), 0)} units total
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
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)",fontWeight:v.stock>0?700:400,color:v.stock>0?"var(--text1)":"var(--text3)"}}>{v.stock || "—"}</td>
                        <td style={{padding:"4px 8px",borderBottom:"1px solid var(--border)"}}>{fmt(v.min_price)}</td>
                      </tr>
                    ))}
                    {bulkPreview.length > 20 && (
                      <tr>
                        <td colSpan="5" style={{padding:"8px",textAlign:"center",color:"var(--text3)",fontSize:11}}>
                          … and {bulkPreview.length - 20} more variants
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions" style={{marginTop:16}}>
              <button className="modal-cancel" onClick={closeBulkModal}>Cancel</button>
              <button className="modal-cancel" onClick={generateBulkPreview} disabled={bulkSaving}>🔮 Preview</button>
              <button className="modal-save" onClick={saveBulkProducts} disabled={bulkSaving || bulkPreview.length === 0}>
                {bulkSaving ? "Creating…" : `Create ${bulkPreview.length || ""} Variants`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CSV Modal ── */}
      {csvModal && (
        <div className="modal-overlay" onClick={() => { setCsvModal(false); setCsvPreview([]); setCsvError(""); }}>
          <div className="modal-card" style={{maxWidth:620}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Bulk Import CSV</h3>
              <button className="modal-close" onClick={() => { setCsvModal(false); setCsvPreview([]); }}>✕</button>
            </div>
            <div className="csv-info-box">
              <span>Columns: <code>name, brand, category, top_type, size, color, stock, min_price, sku</code></span>
              <button className="link-btn" onClick={downloadTemplate}>⬇ Template</button>
            </div>
            <div className="csv-drop-area">
              <input ref={fileRef} type="file" accept=".csv" style={{display:"none"}} onChange={handleCSVFile}/>
              <button className="csv-pick-btn" onClick={() => fileRef.current.click()}>📂 Choose CSV File</button>
            </div>
            {csvError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {csvError}</div>}
            {csvPreview.length > 0 && <div style={{marginTop:12,fontSize:13,color:"var(--green)",fontWeight:600}}>✓ {csvPreview.length} rows ready to import</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => { setCsvModal(false); setCsvPreview([]); setCsvError(""); }}>Cancel</button>
              <button className="modal-save" disabled={!csvPreview.length || saving} onClick={confirmImport}>
                {saving ? "Importing…" : `Import ${csvPreview.length} Products`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Brand Add/Edit Modal ── */}
      {brandModal && (
        <div className="modal-overlay" onClick={() => setBrandModal(false)}>
          <div className="modal-card" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{brandEditId ? "Edit Brand" : "Add Brand"}</h3>
              <button className="modal-close" onClick={() => setBrandModal(false)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Brand Name *</label>
                <input type="text" placeholder="e.g. Nike, Adidas" value={brandForm.name} onChange={e => setBrandForm({...brandForm, name: e.target.value})}/>
              </div>
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Type</label>
                <select value={brandForm.top_type} onChange={e => setBrandForm({...brandForm, top_type: e.target.value})}>
                  <option value="shoes">👟 Shoes</option>
                  <option value="clothes">👕 Clothes</option>
                </select>
              </div>
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Photo URL (optional)</label>
                <input type="text" placeholder="https://..." value={brandForm.photo_url} onChange={e => setBrandForm({...brandForm, photo_url: e.target.value})}/>
              </div>
            </div>
            {brandError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {brandError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setBrandModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveBrand} disabled={brandSaving}>
                {brandSaving ? "Saving…" : brandEditId ? "Save Changes" : "Add Brand"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Brand Confirm ── */}
      {delBrandId && (
        <div className="modal-overlay" onClick={() => setDelBrandId(null)}>
          <div className="modal-card modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Brand?</h3>
              <button className="modal-close" onClick={() => setDelBrandId(null)}>✕</button>
            </div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>Remove <strong>{delBrandName}</strong>? This will hide the brand and may affect products using it.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDelBrandId(null)}>Cancel</button>
              <button className="modal-save modal-save--danger" onClick={deleteBrand}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Type Add/Edit Modal ── */}
      {subtypeModal && (
        <div className="modal-overlay" onClick={() => setSubtypeModal(false)}>
          <div className="modal-card" style={{maxWidth:420}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{subtypeEditId ? "Edit Model" : "Add Model"}</h3>
              <button className="modal-close" onClick={() => setSubtypeModal(false)}>✕</button>
            </div>
            <div className="modal-grid">
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Model Name *</label>
                <input type="text" placeholder="e.g. Air Force 1, Slim Fit" value={subtypeForm.name} onChange={e => setSubtypeForm({...subtypeForm, name: e.target.value})}/>
              </div>
              <div className="modal-field" style={{gridColumn:"1/-1"}}>
                <label>Photo URL (optional)</label>
                <input type="text" placeholder="https://..." value={subtypeForm.photo_url} onChange={e => setSubtypeForm({...subtypeForm, photo_url: e.target.value})}/>
              </div>
            </div>
            {subtypeError && <div className="lf-error" style={{marginTop:12}}><span>⚠</span> {subtypeError}</div>}
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setSubtypeModal(false)}>Cancel</button>
              <button className="modal-save" onClick={saveSubtype} disabled={subtypeSaving}>
                {subtypeSaving ? "Saving…" : subtypeEditId ? "Save Changes" : "Add Model"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Sub-Type Confirm ── */}
      {delSubtypeId && (
        <div className="modal-overlay" onClick={() => setDelSubtypeId(null)}>
          <div className="modal-card modal-card--sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Model?</h3>
              <button className="modal-close" onClick={() => setDelSubtypeId(null)}>✕</button>
            </div>
            <p style={{color:"var(--text2)",fontSize:13,margin:"8px 0 20px"}}>Remove <strong>{delSubtypeName}</strong>? This will hide the model and may affect products using it.</p>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setDelSubtypeId(null)}>Cancel</button>
              <button className="modal-save modal-save--danger" onClick={deleteSubtype}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">
            {cat.level === "top"      && "Select a category to browse"}
            {cat.level === "brands"   && `${cat.topType === "shoes" ? "👟 Shoes" : "👕 Clothes"} — ${cat.brands.length} brands`}
            {cat.level === "subtypes" && `👟 ${cat.selBrand?.name} — ${cat.subtypes.length} models`}
            {cat.level === "products" && `${cat.topType === "shoes" ? `👟 ${cat.selBrand?.name} › ${cat.selSubtype?.name}` : `👕 ${cat.selBrand?.name}`} — ${products.length} variants`}
          </p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button className="modal-cancel" style={{padding:"10px 14px",fontSize:13}} onClick={() => setCsvModal(true)}>📥 Import CSV</button>
          {isAdmin && cat.level === "products" && (
            <>
              <button className="primary-btn" style={{fontSize:13}} onClick={openBulkAdd}>📦 Bulk Add</button>
              <button className="primary-btn" style={{fontSize:13}} onClick={openAdd}>+ Add Product</button>
            </>
          )}
        </div>
      </div>

      {/* ── Category Browser: Top ── */}
      {cat.level === "top" && (
        <div style={{display:"flex",gap:20,marginTop:20,flexWrap:"wrap"}}>
          {[
            { t:"shoes",   icon:"👟", label:"Shoes",   sub:"Nike, Adidas, Jordan…" },
            { t:"clothes", icon:"👕", label:"Clothes", sub:"Shirts, Jeans, Shorts…" },
          ].map(({ t, icon, label, sub }) => (
            <div
              key={t}
              className="panel-card"
              style={{flex:1,minWidth:220,cursor:"pointer",padding:30,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s"}}
              onClick={() => cat.goBrands(t)}
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

      {/* ── Category Browser: Brands ── */}
      {cat.level === "brands" && (
        <>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={cat.goTop}>← Back</button>
            <span style={{fontSize:12,color:"var(--text3)"}}>{cat.topType === "shoes" ? "👟" : "👕"} › Brand</span>
            {isAdmin && <button className="primary-btn" style={{fontSize:12,padding:"6px 12px",marginLeft:"auto"}} onClick={openBrandAdd}>+ Add Brand</button>}
          </div>
          {cat.loading
            ? <div style={{padding:30,textAlign:"center",color:"var(--text3)"}}>Loading…</div>
            : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14}}>
                {cat.brands.map(b => (
                  <div
                    key={b.id}
                    className="panel-card"
                    style={{cursor:"pointer",padding:16,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s",position:"relative"}}
                    onClick={() => cat.goSubtypes(b)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--teal)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    {isAdmin && (
                      <div style={{position:"absolute",top:6,right:6,display:"flex",gap:4,zIndex:10}} onClick={e => e.stopPropagation()}>
                        <button className="tbl-btn" style={{padding:"3px 6px",fontSize:11}} onClick={() => openBrandEdit(b)} title="Edit">✏</button>
                        <button className="tbl-btn tbl-btn--del" style={{padding:"3px 6px",fontSize:11}} onClick={() => { setDelBrandId(b.id); setDelBrandName(b.name); }} title="Delete">🗑</button>
                      </div>
                    )}
                    <div style={{marginTop: isAdmin ? 20 : 0}}>
                      {b.photo_url
                        ? <img src={b.photo_url} alt={b.name} style={{width:64,height:64,objectFit:"contain",borderRadius:8,margin:"0 auto 10px"}}/>
                        : <div style={{fontSize:40,marginBottom:10}}>{cat.topType === "shoes" ? "👟" : (CLOTH_ICONS[b.name] || "👕")}</div>
                      }
                      <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>{b.name}</div>
                    </div>
                  </div>
                ))}
                {cat.brands.length === 0 && (
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)"}}>
                    No brands yet.{isAdmin && <><br/><button className="link-btn" onClick={openBrandAdd}>Add first brand →</button></>}
                  </div>
                )}
              </div>
            )
          }
        </>
      )}

      {/* ── Category Browser: Subtypes ── */}
      {cat.level === "subtypes" && (
        <>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={() => cat.goBrands(cat.topType)}>← Back</button>
            <span style={{fontSize:12,color:"var(--text3)"}}>👟 {cat.selBrand?.name} › Model</span>
            {isAdmin && <button className="primary-btn" style={{fontSize:12,padding:"6px 12px",marginLeft:"auto"}} onClick={openSubtypeAdd}>+ Add Model</button>}
          </div>
          {cat.loading
            ? <div style={{padding:30,textAlign:"center",color:"var(--text3)"}}>Loading…</div>
            : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:14}}>
                {cat.subtypes.map(st => (
                  <div
                    key={st.id}
                    className="panel-card"
                    style={{cursor:"pointer",padding:16,textAlign:"center",border:"2px solid var(--border)",transition:"border-color .2s",position:"relative"}}
                    onClick={() => cat.setSelSubtype(st)}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "var(--teal)"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                  >
                    {isAdmin && (
                      <div style={{position:"absolute",top:6,right:6,display:"flex",gap:4,zIndex:10}} onClick={e => e.stopPropagation()}>
                        <button className="tbl-btn" style={{padding:"3px 6px",fontSize:11}} onClick={() => openSubtypeEdit(st)} title="Edit">✏</button>
                        <button className="tbl-btn tbl-btn--del" style={{padding:"3px 6px",fontSize:11}} onClick={() => { setDelSubtypeId(st.id); setDelSubtypeName(st.name); }} title="Delete">🗑</button>
                      </div>
                    )}
                    <div style={{marginTop: isAdmin ? 20 : 0}}>
                      {st.photo_url
                        ? <img src={st.photo_url} alt={st.name} style={{width:64,height:64,objectFit:"contain",borderRadius:8,margin:"0 auto 10px"}}/>
                        : <div style={{fontSize:38,marginBottom:10}}>👟</div>
                      }
                      <div style={{fontWeight:700,fontSize:13,color:"var(--text)"}}>{st.name}</div>
                    </div>
                  </div>
                ))}
                {cat.subtypes.length === 0 && (
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"var(--text3)"}}>
                    No models yet.{isAdmin && <><br/><button className="link-btn" onClick={openSubtypeAdd}>Add first model →</button></>}
                  </div>
                )}
              </div>
            )
          }
        </>
      )}

      {/* ── Products Table ── */}
      {cat.level === "products" && (
        <div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
            <button className="tbl-btn" onClick={() => {
              if (cat.topType === "shoes") cat.setSelSubtype(null);
              else cat.goBrands(cat.topType);
              setProducts([]);
            }}>← Back</button>
            <span style={{fontSize:13,color:"var(--text3)"}}>
              {cat.topType === "shoes" ? `👟 ${cat.selBrand?.name} › ${cat.selSubtype?.name}` : `👕 ${cat.selBrand?.name}`}
            </span>
            <div className="pos-search-wrap" style={{marginLeft:"auto",flex:"0 0 240px"}}>
              <span className="pos-search-icon">🔍</span>
              <input
                className="pos-search"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && refreshProducts()}
              />
            </div>
          </div>

          {loading && <div style={{textAlign:"center",padding:40,color:"var(--text3)"}}>Loading…</div>}

          {!loading && products.length === 0 && (
            <div style={{textAlign:"center",padding:50,color:"var(--text3)"}}>
              <div style={{fontSize:32,marginBottom:10}}>📦</div>
              No products found.{isAdmin && <><button className="link-btn" style={{marginLeft:8}} onClick={openAdd}>Add one now →</button></>}
            </div>
          )}

          {!loading && products.length > 0 && (
            <div className="panel-card" style={{padding:0,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",background:"var(--bg2)",borderBottom:"1px solid var(--border)",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <span style={{fontWeight:700,fontSize:14}}>
                  {products.length} listings · {products.reduce((s,p) => s + +p.stock, 0)} units total
                </span>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {isAdmin && <button className="tbl-btn tbl-btn--edit" onClick={openBulkAdd}>📦 Bulk Add</button>}
                  {isAdmin && <button className="tbl-btn tbl-btn--edit" onClick={openAdd}>+ Add Variant</button>}
                </div>
              </div>
              <div className="table-wrap">
                <table className="sales-table">
                  <thead>
                    <tr>
                      <th>Photo</th>
                      <th>Name</th>
                      <th>SKU</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Min Price</th>
                      <th>Days In</th>
                      {isAdmin && <th>Actions</th>}
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
                          <td>
                            <span style={{fontWeight:600,color:"var(--text)"}}>{p.name}</span><br/>
                            <span style={{fontSize:11,color:"var(--text3)"}}>{p.category}</span>
                          </td>
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
                                <button
                                  className="tbl-btn"
                                  style={{background:"var(--bg2)",color:"var(--text2)",border:"1px solid var(--border)"}}
                                  onClick={() => {
                                    setForm({...p, stock:"", sku:"", photo_url: p.photo_url||""});
                                    setPhotoPreview(p.photo_url||"");
                                    setEditId(null); setModal(true); setFormError("");
                                  }}
                                >
                                  + Variant
                                </button>
                                <button
                                  className="tbl-btn tbl-btn--edit"
                                  onClick={() => { setBarcodeSku(p.sku); setBarcodeName(`${p.name} ${p.color || ""} Sz${p.size}`); }}
                                >
                                  📄 Barcode
                                </button>
                                <button
                                  className="tbl-btn tbl-btn--del"
                                  onClick={() => { setDelId(p.id); setDelName(`${p.name} Sz${p.size}`); }}
                                >
                                  🗑
                                </button>
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
        </div>
      )}
    </div>
  );
}