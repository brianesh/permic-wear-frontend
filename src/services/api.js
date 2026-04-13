import axios from 'axios';
import {
  getCachedProducts, cacheProducts,
  getCachedDashboard, cacheDashboard,
  getCachedSettings, cacheSettings,
  getOfflineUser,
} from '../lib/offlineDB';

function buildBaseURL() {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  url = url.trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) url = url + '/api';
  return url;
}

export const BASE_URL = buildBaseURL();
// Root URL without /api — used for keepalive ping
export const ROOT_URL = BASE_URL.replace(/\/api$/, '');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

// Set Authorization header globally for all requests
// This ensures every request automatically includes the token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Super admin store picker: inject active store header so backend scopes correctly
  const activeStoreId = localStorage.getItem('active_store_id');
  if (activeStoreId) {
    config.headers['X-Active-Store-Id'] = activeStoreId;
  }
  return config;
});

// Also set global axios defaults for any non-api-instance requests
// This is a best practice to ensure all axios requests include auth
if (typeof window !== 'undefined') {
  const updateAuthHeader = () => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      // Clear the header if no token (prevents stale tokens)
      delete axios.defaults.headers.common['Authorization'];
    }
  };

  // Set initial auth header
  updateAuthHeader();

  // Update auth header on storage changes (e.g., after login/logout)
  window.addEventListener('storage', updateAuthHeader);
}

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('se_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

const isOffline = () => !navigator.onLine;

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  login: async (identifier, password) => {
    if (isOffline()) {
      const cached = await getOfflineUser(identifier);
      if (!cached) throw { isOfflineError: true, message: 'No cached session. Please sign in online first.' };
      if (cached.storedPassword !== password)
        throw { isOfflineError: true, message: 'Incorrect password.' };
      return { data: { token: cached.token, user: cached.user } };
    }
    return api.post('/auth/login', { identifier, password });
  },
  me:             ()                          => api.get('/auth/me'),
  logout:         ()                          => api.post('/auth/logout').catch(() => {}),
  changePassword: (currentPassword, newPassword) =>
                  api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ── Categories ────────────────────────────────────────────────────
export const categoriesAPI = {
  getBrands:     (params)     => api.get('/categories/brands', { params }),
  createBrand:   (data)       => api.post('/categories/brands', data),
  updateBrand:   (id, data)   => api.put(`/categories/brands/${id}`, data),
  deleteBrand:   (id)         => api.delete(`/categories/brands/${id}`),
  getSubtypes:   (params)     => api.get('/categories/subtypes', { params }),
  createSubtype: (data)       => api.post('/categories/subtypes', data),
  updateSubtype: (id, data)   => api.put(`/categories/subtypes/${id}`, data),
  deleteSubtype: (id)         => api.delete(`/categories/subtypes/${id}`),
};

// ── Products ──────────────────────────────────────────────────────
export const productsAPI = {
  getAll: async (params) => {
    if (isOffline()) {
      let products = await getCachedProducts();
      if (params?.search) {
        const q = params.search.toLowerCase();
        products = products.filter(p =>
          p.name?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q)
        );
      }
      if (params?.brand)       products = products.filter(p => p.brand === params.brand);
      if (params?.brand_id)    products = products.filter(p => p.brand_id === parseInt(params.brand_id));
      if (params?.sub_type_id) products = products.filter(p => p.sub_type_id === parseInt(params.sub_type_id));
      if (params?.top_type)    products = products.filter(p => p.top_type === params.top_type);
      if (params?.in_stock === 'true') products = products.filter(p => p.stock > 0);
      return { data: products };
    }
    const res = await api.get('/products', { params });
    // Cache the full unfiltered list for offline use
    if (!params?.search && !params?.brand && !params?.brand_id && !params?.sub_type_id) {
      cacheProducts(res.data || []).catch(() => {});
    }
    return res;
  },

  // Fast autocomplete search — hits /products/search endpoint
  // Falls back to in-memory cache when offline
  search: async (q, opts = {}) => {
    if (!q || q.trim().length === 0) return { data: [] };
    if (isOffline()) {
      const all = await getCachedProducts();
      const lq  = q.toLowerCase();
      const filtered = all.filter(p =>
        p.stock > 0 && (
          p.name?.toLowerCase().includes(lq)   ||
          p.brand?.toLowerCase().includes(lq)  ||
          p.sku?.toLowerCase().includes(lq)    ||
          p.color?.toLowerCase().includes(lq)
        )
      );
      if (opts.top_type) filtered.filter(p => p.top_type === opts.top_type);
      return { data: filtered.slice(0, 15) };
    }
    return api.get('/products/search', { params: { q, ...opts } });
  },

  // Cashier's most-used products for quick picks
  getFavorites: (params) => {
    if (isOffline()) return getCachedProducts()
      .then(all => ({ data: all.filter(p => p.stock > 0).slice(0, 12) }));
    return api.get('/products/favorites', { params });
  },

  // Record a product was used (called after successful sale)
  recordUsed: (productId) => api.post(`/products/favorites/${productId}`).catch(() => {}),

  create:     (data)     => api.post('/products', data),
  update:     (id, data) => api.put(`/products/${id}`, data),
  remove:     (id)       => api.delete(`/products/${id}`),
  bulkImport: (products) => api.post('/products/bulk-import', { products }, { timeout: 120000 }),
  bulkCreate: (data) => api.post('/products/bulk-create', data, { timeout: 120000 }),
};

// ── Sales ─────────────────────────────────────────────────────────
export const salesAPI = {
  create:             (data)   => api.post('/sales', data),
  getAll:             (params) => api.get('/sales', { params }),
  // getAllStores: bypasses store filter — for super_admin sales records page (sees all stores)
  getAllStores:        (params) => rawGet('/sales', { params }),
  getById:            (id)     => api.get(`/sales/${id}`),
};

// ── Tuma ──────────────────────────────────────────────────────────
export const tumaAPI = {
  stkPush:         (sale_id, phone, amount)                     => api.post('/tuma/stk-push',       { sale_id, phone, amount }),
  getStatus:       (checkoutRequestId)                          => api.get(`/tuma/status/${checkoutRequestId}`),
  confirmManual:   (checkout_request_id, sale_id)               => api.post('/tuma/confirm-manual',  { checkout_request_id, sale_id }),
  confirmByRef:    (checkout_request_id, sale_id, payment_ref)  => api.post('/tuma/confirm-by-ref',  { checkout_request_id, sale_id, payment_ref }),
  testCredentials: ()                                           => api.get('/tuma/test-credentials'),
  getCancelBlocks: ()                                           => api.get('/tuma/cancel-blocks'),
  unblockPhone:    (phone)                                      => api.delete(`/tuma/cancel-blocks/${encodeURIComponent(phone)}`),
};


// ── Stores ────────────────────────────────────────────────────────
// rawGet — bypasses X-Active-Store-Id so compare/global endpoints always see all stores
function rawGet(url, config = {}) {
  const headers = { ...config.headers };
  delete headers['X-Active-Store-Id'];
  return api.get(url, { ...config, headers });
}

export const storesAPI = {
  getAll:    ()         => api.get('/stores'),
  // compare must ALWAYS see all stores — never filter by active store
  compare:   (params)   => rawGet('/stores/compare', { params }),
  create:    (data)     => api.post('/stores', data),
  update:    (id, data) => api.put(`/stores/${id}`, data),
  activate:  (id)       => api.put(`/stores/${id}/activate`),
  remove:    (id)       => api.delete(`/stores/${id}`),
  details:   (id)       => api.get(`/stores/${id}/details`),
  priceListUrl:    (id)      => `${api.defaults.baseURL}/stores/${id}/price-list`,
  assignOrphans:   (store_id) => api.post('/stores/assign-orphans', { store_id }),
};

// ── Reports ───────────────────────────────────────────────────────
export const reportsAPI = {
  summary: async (params) => {
    if (isOffline()) {
      const key = `summary_${params?.from}_${params?.to}`;
      const cached = await getCachedDashboard(key);
      return cached ? { data: cached } : { data: null };
    }
    const res = await api.get('/reports/summary', { params });
    cacheDashboard(`summary_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  daily: async (params) => {
    if (isOffline()) {
      const key = `daily_${params?.from}_${params?.to}`;
      const cached = await getCachedDashboard(key);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/daily', { params });
    cacheDashboard(`daily_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  topProducts: async (params) => {
    if (isOffline()) {
      const cached = await getCachedDashboard(`top_${params?.from}_${params?.to}`);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/top-products', { params });
    cacheDashboard(`top_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  cashiers: async (params) => {
    if (isOffline()) {
      const cached = await getCachedDashboard(`cashiers_${params?.from}_${params?.to}`);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/cashiers', { params });
    cacheDashboard(`cashiers_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  paymentMix: async (params) => {
    if (isOffline()) {
      const cached = await getCachedDashboard(`pmix_${params?.from}_${params?.to}`);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/payment-mix', { params });
    cacheDashboard(`pmix_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
};

// ── Users ─────────────────────────────────────────────────────────
export const usersAPI = {
  getAll:  ()         => api.get('/users'),
  create:  (data)     => api.post('/users', data),
  update:  (id, data) => api.put(`/users/${id}`, data),
  remove:  (id)       => api.delete(`/users/${id}`),
};

// ── Logs ──────────────────────────────────────────────────────────
export const logsAPI = {
  getAll: (params) => api.get('/logs', { params }),
  clear:  ()       => api.delete('/logs'),
};

// ── Settings ──────────────────────────────────────────────────────
export const settingsAPI = {
  get: async () => {
    if (isOffline()) {
      const cached = await getCachedSettings();
      return cached ? { data: cached } : { data: {} };
    }
    const res = await api.get('/settings');
    cacheSettings(res.data).catch(() => {});
    return res;
  },
  update: (data) => api.put('/settings', data),
};

export default api;
