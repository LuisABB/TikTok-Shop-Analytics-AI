/**
 * pages/products.js — Módulo de Análisis de Productos.
 */
const ProductsPage = (() => {
  let currentMetric = 'gmv';

  async function init() {
    // Selector de métrica
    document.querySelectorAll('#metricSelector button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#metricSelector button').forEach(b => {
          b.classList.remove('btn-danger');
          b.classList.add('btn-outline-secondary');
        });
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-danger');
        currentMetric = btn.dataset.metric;
        loadTopProducts();
      });
    });

    const { start, end } = getDateFilter();
    await Promise.all([
      loadTopProducts(),
      loadNoSales(start, end),
    ]);
  }

  async function loadTopProducts() {
    const { start, end } = getDateFilter();
    try {
      const data = await API.getTopProducts({ metric: currentMetric, limit: 10, start, end });
      
      // Si ordenamos por GMV/orders y todos son 0, re-consultar por impressions
      if ((currentMetric === 'gmv' || currentMetric === 'orders') && data.length > 0) {
        const allZero = data.every(p => (!p[currentMetric] || p[currentMetric] === 0));
        if (allZero) {
          // Mostrar los mismos datos pero ordenados por impressions localmente
          const sorted = [...data].sort((a, b) => (b.impressions || 0) - (a.impressions || 0));
          renderTopProductsChart(sorted, 'impressions'); // Mostrar gráfico con impresiones
          renderProductsTable(sorted);
          return;
        }
      }
      
      renderTopProductsChart(data);
      renderProductsTable(data);
    } catch (e) {
      showToast('Error cargando productos: ' + e.message, 'error');
    }
  }

  async function loadNoSales(start, end) {
    try {
      const data = await API.getProductsWithoutSales({ start, end });
      document.getElementById('no-sales-count').textContent = data.length;
      const tbody = document.getElementById('no-sales-body');
      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-success small py-3"><i class="bi bi-check-circle me-1"></i>Todos tus productos tienen ventas.</td></tr>';
        return;
      }
      tbody.innerHTML = data.map(p => `
        <tr>
          <td class="small" style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.product_name}">${p.product_name}</td>
          <td class="text-end num">${fmt.number(p.impressions)}</td>
          <td class="text-end num">${fmt.number(p.clicks)}</td>
        </tr>`).join('');
    } catch (_e) {}
  }

  function renderTopProductsChart(data, metricOverride = null) {
    const effectiveMetric = metricOverride || currentMetric;
    const names  = data.map(p => truncate(p.product_name, 20));
    const values = data.map(p => p[effectiveMetric] || 0);
    const isMonetary = effectiveMetric === 'gmv';
    
    // Si no hay datos o todos son 0, mostrar mensaje
    if (!data.length || values.every(v => v === 0)) {
      const container = document.getElementById('chart-top-products');
      const metricLabel = { gmv: 'ventas', orders: 'pedidos', impressions: 'impresiones', customers: 'clientes' }[effectiveMetric] || effectiveMetric;
      container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-bar-chart fs-1 d-block mb-3 opacity-25"></i><p class="mb-0">No hay ${metricLabel} en el período seleccionado</p><small>Ajusta el rango de fechas o selecciona otra métrica</small></div>`;
      return;
    }

    const chartTitle = effectiveMetric !== currentMetric 
      ? `Top productos por ${effectiveMetric.toUpperCase()} (sin ${currentMetric.toUpperCase()})`
      : effectiveMetric.toUpperCase();

    mountChart('chart-top-products', {
      ...defaultChartOptions(),
      chart:   { type: 'bar', height: 300 },
      series:  [{ name: chartTitle, data: values }],
      xaxis:   { categories: names, labels: { style: { fontSize: '11px' } } },
      yaxis:   { labels: { formatter: v => typeof v === 'number' ? (isMonetary ? '$' + fmt.number(v) : fmt.number(v)) : String(v || '') } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4, dataLabels: { position: 'top' } } },
      dataLabels: {
        enabled: true,
        formatter: v => isMonetary ? '$' + fmt.number(v) : fmt.number(v),
        offsetX: 6,
        style: { fontSize: '10px', colors: ['#555'] },
      },
      colors: [CHART_COLORS.red],
    });
  }

  function renderProductsTable(data) {
    const tbody = document.getElementById('products-table-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 small">Sin datos de productos. Importa un CSV de "Product List" o "Product Card Traffic Stats".</td></tr>';
      return;
    }
    
    // Detectar si todos tienen GMV=0
    const allZeroGMV = data.every(p => (!p.gmv || p.gmv === 0) && (!p.orders || p.orders === 0));
    
    tbody.innerHTML = data.map(p => {
      const hasTraffic = p.impressions > 0 || p.clicks > 0;
      const rowClass = allZeroGMV && hasTraffic ? '' : '';
      return `
      <tr class="${rowClass}">
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.product_name}">${p.product_name}</td>
        <td class="text-end num">${fmt.currency(p.gmv)}</td>
        <td class="text-end num">${fmt.number(p.orders)}</td>
        <td class="text-end num">${fmt.number(p.customers)}</td>
        <td class="text-end num">${fmt.number(p.impressions)}</td>
        <td class="text-end num">${fmt.number(p.clicks)}</td>
        <td class="text-end num">${(p.clicks > 0 && p.impressions) ? fmt.percent(p.clicks / p.impressions * 100) : '—'}</td>
        <td class="text-end num">${(p.conversion_rate != null && p.conversion_rate > 0) ? fmt.percent(p.conversion_rate) : '—'}</td>
      </tr>`;
    }).join('');
    
    // Mostrar alerta si todos tienen GMV=0
    if (allZeroGMV) {
      const alert = `<tr><td colspan="8" class="text-center py-2"><div class="alert alert-info mb-0 py-2"><i class="bi bi-info-circle me-2"></i>Los productos tienen tráfico pero sin ventas en el período seleccionado. Ajusta el rango de fechas o importa datos más recientes.</div></td></tr>`;
      tbody.insertAdjacentHTML('afterbegin', alert);
    }
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init };
})();
