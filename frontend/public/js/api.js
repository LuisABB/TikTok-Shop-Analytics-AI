/**
 * api.js — Cliente HTTP para el backend.
 * Usa fetch con manejo de errores centralizado.
 */
const API_BASE = '/api';

const API = {
  async _fetch(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw Object.assign(new Error(err.error || 'Error de servidor'), { status: res.status });
    }
    return res.json();
  },

  // Dashboard
  getDashboardSummary: (params = {}) => API._fetch(`/dashboard/summary${buildQuery(params)}`),
  getGMVTrend:        (params = {}) => API._fetch(`/dashboard/gmv-trend${buildQuery(params)}`),
  getDiagnostics:     (params = {}) => API._fetch(`/dashboard/diagnostics${buildQuery(params)}`),
  getAvailableDates:  ()             => API._fetch('/dashboard/available-dates'),

  // Productos
  getTopProducts:          (params = {}) => API._fetch(`/products/top${buildQuery(params)}`),
  getProductsWithoutSales: (params = {}) => API._fetch(`/products/no-sales${buildQuery(params)}`),

  // Videos
  getVideoKPIs: (params = {}) => API._fetch(`/videos/kpis${buildQuery(params)}`),
  getTopVideos: (params = {}) => API._fetch(`/videos/top${buildQuery(params)}`),

  // LIVE
  getLiveKPIs:     (params = {}) => API._fetch(`/live/kpis${buildQuery(params)}`),
  getLiveSessions: (params = {}) => API._fetch(`/live/sessions${buildQuery(params)}`),

  // SEO
  getSearchKPIs:        (params = {}) => API._fetch(`/seo/kpis${buildQuery(params)}`),
  getTopSearchProducts: (params = {}) => API._fetch(`/seo/products${buildQuery(params)}`),

  // IA
  getRecommendations: (params = {}) => API._fetch(`/ai/recommendations${buildQuery(params)}`),

  // Analytics (Embudo y Rentabilidad)
  getFunnelAnalysis:     (params = {}) => API._fetch(`/analytics/funnel${buildQuery(params)}`),
  getTopFunnelProducts:  (params = {}) => API._fetch(`/analytics/top-funnel-products${buildQuery(params)}`),
  getFinancialAnalysis:  (params = {}) => API._fetch(`/analytics/financial${buildQuery(params)}`),
  getLeakageProducts:    (params = {}) => API._fetch(`/analytics/leakage${buildQuery(params)}`),

  // Import
  getImportHistory: () => API._fetch('/import/history'),
  deleteImport:     (id) => API._fetch(`/import/${id}`, { method: 'DELETE' }),

  async uploadCSV(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API_BASE}/import`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || 'Error al importar'), { status: res.status });
    return data;
  },
};

function buildQuery(params) {
  const q = Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  return q.length ? `?${q.join('&')}` : '';
}
