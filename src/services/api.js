import axios from 'axios';
import {
  getCachedProducts, cacheProducts,
  getCachedDashboard, cacheDashboard,
  getCachedSettings, cacheSettings,
  getOfflineUser,
} from '../lib/offlineDB';

// Normalise the API URL — always ends with /api, never has trailing slash
function buildBaseURL() {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  url = url.trim().replace(/\/+$/, ''); // strip trailing slashes
  if (!url.endsWith('/api')) url = url + '/api'; // ensure /api suffix
  return url;
}

const BASE_URL = buildBaseURL();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('se_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('se_token');
      localStorage.removeItem('se_user');
      window.location.href = '/';
    }
    return Promise.reject(err);
  }
);

const isOffline = () => !navigator.onLine;

// ── Auth ──────────────────────────────────────────────────────────
export const authAPI = {
  login: async (email, password) => {
    if (isOffline()) {
      const cached = await getOfflineUser(email);
      if (!cached) throw { isOfflineError: true, message: 'No cached session. Please sign in online first.' };
      if (cached.storedPassword !== password)
        throw { isOfflineError: true, message: 'Incorrect password.' };
      return { data: { token: cached.token, user: cached.user } };
    }
    return api.post('/auth/login', { email, password });
  },
  me:             ()                       => api.get('/auth/me'),
  logout:         ()                       => api.post('/auth/logout').catch(() => {}),
  changePassword: (currentPassword, newPassword) =>
                  api.post('/auth/change-password', { currentPassword, newPassword }),
};

// ── Categories ────────────────────────────────────────────────────
export const categoriesAPI = {
  getBrands:      (params)     => api.get('/categories/brands', { params }),
  createBrand:    (data)       => api.post('/categories/brands', data),
  updateBrand:    (id, data)   => api.put(`/categories/brands/${id}`, data),
  deleteBrand:    (id)         => api.delete(`/categories/brands/${id}`),
  getSubtypes:    (params)     => api.get('/categories/subtypes', { params }),
  createSubtype:  (data)       => api.post('/categories/subtypes', data),
  updateSubtype:  (id, data)   => api.put(`/categories/subtypes/${id}`, data),
  deleteSubtype:  (id)         => api.delete(`/categories/subtypes/${id}`),
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
      if (params?.brand)        products = products.filter(p => p.brand === params.brand);
      if (params?.brand_id)     products = products.filter(p => p.brand_id === parseInt(params.brand_id));
      if (params?.sub_type_id)  products = products.filter(p => p.sub_type_id === parseInt(params.sub_type_id));
      if (params?.top_type)     products = products.filter(p => p.top_type === params.top_type);
      return { data: products };
    }
    const res = await api.get('/products', { params });
    if (!params?.search && !params?.brand && !params?.brand_id && !params?.sub_type_id) {
      cacheProducts(res.data || []).catch(() => {});
    }
    return res;
  },
  create:     (data)     => api.post('/products', data),
  update:     (id, data) => api.put(`/products/${id}`, data),
  remove:     (id)       => api.delete(`/products/${id}`),
  bulkImport: (products) => api.post('/products/bulk-import', { products }),
};

// ── Sales ─────────────────────────────────────────────────────────
export const salesAPI = {
  create:             (data)    => api.post('/sales', data),
  getAll:             (params)  => api.get('/sales', { params }),
  getById:            (id)      => api.get(`/sales/${id}`),
  confirmMpesaManual: (saleId)  => api.post('/sales/confirm-mpesa-manual', { sale_id: saleId }),
};

// ── M-Pesa ────────────────────────────────────────────────────────
export const mpesaAPI = {
  stkPush:       (sale_id, phone, amount)                      => api.post('/mpesa/stk-push',       { sale_id, phone, amount }),
  getStatus:     (checkoutRequestId)                           => api.get(`/mpesa/status/${checkoutRequestId}`),
  confirmManual: (checkout_request_id, sale_id)                => api.post('/mpesa/confirm-manual',  { checkout_request_id, sale_id }),
  confirmByRef:  (checkout_request_id, sale_id, mpesa_ref)     => api.post('/mpesa/confirm-by-ref',  { checkout_request_id, sale_id, mpesa_ref }),
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
      const key = `top_${params?.from}_${params?.to}`;
      const cached = await getCachedDashboard(key);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/top-products', { params });
    cacheDashboard(`top_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  cashiers: async (params) => {
    if (isOffline()) {
      const key = `cashiers_${params?.from}_${params?.to}`;
      const cached = await getCachedDashboard(key);
      return cached ? { data: cached } : { data: [] };
    }
    const res = await api.get('/reports/cashiers', { params });
    cacheDashboard(`cashiers_${params?.from}_${params?.to}`, res.data).catch(() => {});
    return res;
  },
  paymentMix: async (params) => {
    if (isOffline()) {
      const key = `pmix_${params?.from}_${params?.to}`;
      const cached = await getCachedDashboard(key);
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
