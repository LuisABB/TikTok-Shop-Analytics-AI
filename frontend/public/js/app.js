/**
 * app.js — Utilidades globales compartidas por todas las páginas.
 */

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  currency(v, decimals = 2) {
    if (v == null) return '—';
    return '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  number(v, decimals = 0) {
    if (v == null) return '—';
    return Number(v).toLocaleString('es-MX', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  },
  percent(v, decimals = 2) {
    if (v == null) return '—';
    return Number(v).toFixed(decimals) + '%';
  },
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  },
};

// ── Toast notifications ───────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const colors = { success: 'bg-success', error: 'bg-danger', info: 'bg-primary', warning: 'bg-warning text-dark' };
  const id = 'toast_' + Date.now();
  const html = `
    <div id="${id}" class="toast align-items-center text-white ${colors[type] || 'bg-secondary'} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);
  const toastEl = document.getElementById(id);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

// ── Skeleton loader helper ────────────────────────────────────────────────────
function skeletonRow(cols = 5) {
  return `<tr>${'<td><span class="placeholder col-8"></span></td>'.repeat(cols)}</tr>`;
}

// ── Obtener filtros de fecha activos ──────────────────────────────────────────
function getDateFilter() {
  return {
    start: document.getElementById('filterStart')?.value || null,
    end:   document.getElementById('filterEnd')?.value   || null,
  };
}

// Inicializa los filtros de fecha con los últimos 30 días si están vacíos
function initDateFilter() {
  const startEl = document.getElementById('filterStart');
  const endEl   = document.getElementById('filterEnd');
  if (!startEl || !endEl) return;
  if (!startEl.value && !endEl.value) {
    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const fmt = d => d.toISOString().split('T')[0];
    startEl.value = fmt(start);
    endEl.value   = fmt(end);
  }
}

// ── ApexCharts defaults ───────────────────────────────────────────────────────
const CHART_COLORS = {
  red:   '#FE2C55',
  teal:  '#25F4EE',
  blue:  '#0d6efd',
  green: '#198754',
  orange:'#fd7e14',
  gray:  '#adb5bd',
};

function defaultChartOptions(overrides = {}) {
  return Object.assign({
    chart: { fontFamily: 'Segoe UI, system-ui, sans-serif', toolbar: { show: false }, animations: { enabled: true, speed: 400 } },
    grid:  { borderColor: '#f0f2f5', strokeDashArray: 4 },
    tooltip: { theme: 'light' },
    colors: [CHART_COLORS.red, CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.green],
  }, overrides);
}

// ── Destroy chart if exists ───────────────────────────────────────────────────
function destroyChart(id) {
  const el = document.getElementById(id);
  if (el && el._chart) { el._chart.destroy(); el._chart = null; }
}

function mountChart(id, options) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return null;
  const chart = new ApexCharts(el, options);
  chart.render();
  el._chart = chart;
  return chart;
}

// ── Error display ─────────────────────────────────────────────────────────────
function showError(containerId, message) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>${message}</div>`;
}
