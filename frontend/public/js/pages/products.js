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
      let metric = currentMetric;
      let data = await API.getTopProducts({ metric, limit: 10, start, end });

      // Si ordenamos por GMV/orders y todos son 0, mostrar por impresiones
      if ((metric === 'gmv' || metric === 'orders') && data.length > 0) {
        const allZero = data.every(p => (!p[metric] || p[metric] === 0));
        if (allZero) {
          data = await API.getTopProducts({ metric: 'impressions', limit: 10, start, end });
          metric = 'impressions';
        }
      }

      renderTopProductsChart(data, metric);
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

  function channelValue(p, channel, metric) {
    const ch = p.channels && p.channels[channel];
    if (ch && ch[metric] != null) return Number(ch[metric]) || 0;
    if (channel === 'all') return Number(p[metric]) || 0;
    return 0;
  }

  function renderTopProductsChart(data, metricOverride = null) {
    const effectiveMetric = metricOverride || currentMetric;
    const names = data.map(p => truncate(p.product_name, 20));
    const isMonetary = effectiveMetric === 'gmv';

    const totalVals = data.map(p => channelValue(p, 'all', effectiveMetric));
    const liveVals  = data.map(p => channelValue(p, 'live', effectiveMetric));
    const videoVals = data.map(p => channelValue(p, 'video', effectiveMetric));
    const cardVals  = data.map(p => channelValue(p, 'product_card', effectiveMetric));

    const hasChannelBreakdown = data.some(p =>
      p.channels && (p.channels.live || p.channels.video || p.channels.product_card)
    );

    if (!data.length || totalVals.every(v => v === 0)) {
      const container = document.getElementById('chart-top-products');
      const metricLabel = { gmv: 'GMV', orders: 'pedidos', impressions: 'impresiones', items_sold: 'ventas', customers: 'clientes' }[effectiveMetric] || effectiveMetric;
      container.innerHTML = `<div class="text-center text-muted py-5"><i class="bi bi-bar-chart fs-1 d-block mb-3 opacity-25"></i><p class="mb-0">No hay ${metricLabel} en el período seleccionado</p><small>Ajusta el rango de fechas o selecciona otra métrica</small></div>`;
      return;
    }

    const fmtVal = v => isMonetary ? '$' + fmt.number(v) : fmt.number(v);

    const series = hasChannelBreakdown
      ? [
          { name: 'Total',   data: totalVals },
          { name: 'LIVE',    data: liveVals },
          { name: 'Video',   data: videoVals },
          { name: 'Tarjeta', data: cardVals },
        ]
      : [{ name: effectiveMetric.toUpperCase(), data: totalVals }];

    const colors = hasChannelBreakdown
      ? [CHART_COLORS.red, CHART_COLORS.teal, CHART_COLORS.blue, CHART_COLORS.orange]
      : [CHART_COLORS.red];

    mountChart('chart-top-products', {
      ...defaultChartOptions(),
      chart:  { type: 'bar', height: hasChannelBreakdown ? 420 : 300, stacked: false },
      series,
      xaxis:  { categories: names, labels: { style: { fontSize: '11px' } } },
      yaxis:  { labels: { formatter: v => typeof v === 'number' ? fmtVal(v) : String(v || '') } },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 3,
          barHeight: hasChannelBreakdown ? '70%' : '60%',
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        formatter: v => (v ? fmtVal(v) : ''),
        offsetX: 4,
        style: { fontSize: '9px', colors: ['#555'] },
      },
      legend: { position: 'top', horizontalAlign: 'left' },
      tooltip: {
        y: { formatter: v => fmtVal(v) },
      },
      colors,
    });
  }

  function renderProductsTable(data) {
    const tbody = document.getElementById('products-table-body');
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 small">Sin datos de productos. Importa un CSV de "Product List" o "Product Card Traffic Stats".</td></tr>';
      return;
    }

    const allZeroGMV = data.every(p => (!p.gmv || p.gmv === 0) && (!p.orders || p.orders === 0));

    tbody.innerHTML = data.map(p => `
      <tr>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.product_name}">${p.product_name}</td>
        <td class="text-end num">${fmt.currency(p.gmv)}</td>
        <td class="text-end num">${fmt.number(p.orders)}</td>
        <td class="text-end num">${fmt.number(p.customers)}</td>
        <td class="text-end num">${fmt.number(p.impressions)}</td>
        <td class="text-end num">${fmt.number(p.clicks)}</td>
        <td class="text-end num">${(p.clicks > 0 && p.impressions) ? fmt.percent(p.clicks / p.impressions * 100) : '—'}</td>
        <td class="text-end num">${(p.conversion_rate != null && p.conversion_rate > 0) ? fmt.percent(p.conversion_rate) : '—'}</td>
      </tr>`).join('');

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
