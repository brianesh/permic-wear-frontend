/**
 * offlineDB.js — IndexedDB wrapper for offline-first support
 *
 * Stores:
 *  - "products"      : full product catalogue (keyed by id)
 *  - "pendingSales"  : sales queued while offline (keyed by local uuid)
 *  - "dashboardCache": last known dashboard summary per period key
 *  - "users"         : cached user credentials for offline login (keyed by email)
 *  - "settings"      : cached app settings
 */

const DB_NAME    = "permic-wear-offline";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("products"))
        db.createObjectStore("products", { keyPath: "id" });
      if (!db.objectStoreNames.contains("pendingSales"))
        db.createObjectStore("pendingSales", { keyPath: "localId" });
      if (!db.objectStoreNames.contains("dashboardCache"))
        db.createObjectStore("dashboardCache", { keyPath: "key" });
      if (!db.objectStoreNames.contains("users"))
        db.createObjectStore("users", { keyPath: "email" });
      if (!db.objectStoreNames.contains("settings"))
        db.createObjectStore("settings", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t  = db.transaction(store, mode);
    const os = t.objectStore(store);
    const req = fn(os);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ── Products ─────────────────────────────────────────────────────────────────
export async function cacheProducts(products) {
  const db = await openDB();
  const t  = db.transaction("products", "readwrite");
  const os = t.objectStore("products");
  // Clear old cache first
  await new Promise((res, rej) => { const r = os.clear(); r.onsuccess=res; r.onerror=rej; });
  // Never cache base64 photo_url — images average ~2 MB each and would fill
  // device storage quickly. URL-based photos are fine to cache as-is.
  for (const p of products) {
    const safe = (p.photo_url && p.photo_url.startsWith('data:'))
      ? { ...p, photo_url: null, has_photo: true }
      : p;
    os.put(safe);
  }
  return new Promise((res, rej) => { t.oncomplete=res; t.onerror=rej; });
}

export async function getCachedProducts() {
  const db = await openDB();
  return tx(db, "products", "readonly", os => os.getAll());
}

// Update stock for a single product (after offline sale)
export async function updateCachedProductStock(productId, deltaQty) {
  const db = await openDB();
  const t  = db.transaction("products", "readwrite");
  const os = t.objectStore("products");
  return new Promise((resolve, reject) => {
    const getReq = os.get(productId);
    getReq.onsuccess = () => {
      const p = getReq.result;
      if (!p) { resolve(); return; }
      p.stock = Math.max(0, (parseInt(p.stock, 10) || 0) - deltaQty);
      const putReq = os.put(p);
      putReq.onsuccess = resolve;
      putReq.onerror   = reject;
    };
    getReq.onerror = reject;
  });
}

// ── Pending Sales ─────────────────────────────────────────────────────────────
export async function queueSale(sale) {
  const db = await openDB();
  return tx(db, "pendingSales", "readwrite", os => os.put(sale));
}

export async function getPendingSales() {
  const db = await openDB();
  return tx(db, "pendingSales", "readonly", os => os.getAll());
}

export async function removePendingSale(localId) {
  const db = await openDB();
  return tx(db, "pendingSales", "readwrite", os => os.delete(localId));
}

export async function countPendingSales() {
  const db = await openDB();
  return tx(db, "pendingSales", "readonly", os => os.count());
}

// ── Dashboard Cache ────────────────────────────────────────────────────────────
export async function cacheDashboard(key, data) {
  const db = await openDB();
  return tx(db, "dashboardCache", "readwrite", os => os.put({ key, data, ts: Date.now() }));
}

export async function getCachedDashboard(key) {
  const db = await openDB();
  const row = await tx(db, "dashboardCache", "readonly", os => os.get(key));
  return row?.data ?? null;
}

// ── Users (offline login) ─────────────────────────────────────────────────────
export async function cacheUserCredentials(user, token, plainPassword) {
  const db = await openDB();
  return tx(db, "users", "readwrite", os => os.put({
    email: user.email,
    storedPassword: plainPassword, // stored locally on-device only — never transmitted
    user,
    token,
    cachedAt: Date.now(),
  }));
}

export async function getOfflineUser(email) {
  const db = await openDB();
  return tx(db, "users", "readonly", os => os.get(email));
}

// ── Settings ──────────────────────────────────────────────────────────────────
export async function cacheSettings(data) {
  const db = await openDB();
  return tx(db, "settings", "readwrite", os => os.put({ key: "main", data, ts: Date.now() }));
}

export async function getCachedSettings() {
  const db = await openDB();
  const row = await tx(db, "settings", "readonly", os => os.get("main"));
  return row?.data ?? null;
}
