/**
 * pages/seo.js — Módulo SEO / Búsqueda.
 */
const SeoPage = (() => {

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [kpis, products] = await Promise.all([
        API.getSearchKPIs({ start, end }),
        API.getTopSearchProducts({ limit: 15, start, end }),
      ]);
      renderKPIs(kpis);
      renderImpressionsChart(products);
      renderRatesChart(products);
      renderTable(products);
    } catch (e) {
      showToast('Error cargando SEO: ' + e.message, 'error');
    }
  }

  function renderKPIs(kpis) {
    document.getElementById('s-kpi-imp').textContent    = fmt.number(kpis.impressions);
    document.getElementById('s-kpi-clicks').textContent = fmt.number(kpis.clicks);
    document.getElementById('s-kpi-ctr').textContent    = fmt.percent(kpis.avg_ctr);
    document.getElementById('s-kpi-gmv').textContent    = fmt.currency(kpis.gmv);
  }

  function renderImpressionsChart(products) {
    const top = products.slice(0, 10);
    mountChart('chart-search-impressions', {
      ...defaultChartOptions(),
      chart:  { type: 'bar', height: 280 },
      series: [{ name: 'Impresiones', data: top.map(p => p.impressions || 0) }],
      xaxis:  { categories: top.map(p => truncate(p.product_name, 18)), labels: { style: { fontSize: '10px' } } },
      yaxis:  { labels: { formatter: v => typeof v === 'number' ? fmt.number(v) : String(v || '') } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.blue],
    });
  }

  function renderRatesChart(products) {
    const top = products.slice(0, 8);
    mountChart('chart-search-rates', {
      ...defaultChartOptions(),
      chart:   { type: 'bar', height: 280 },
      series:  [
        { name: 'Impresiones', data: top.map(p => p.impressions || 0) },
        { name: 'Clics',       data: top.map(p => p.clicks      || 0) },
      ],
      xaxis:   { categories: top.map(p => truncate(p.product_name, 16)), labels: { style: { fontSize: '10px' } } },
      yaxis:   { labels: { formatter: v => typeof v === 'number' ? fmt.number(v) : String(v || '') } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      dataLabels: { enabled: false },
      colors:  [CHART_COLORS.blue, CHART_COLORS.teal],
      tooltip: {
        y: { formatter: (v, { seriesIndex }) => seriesIndex === 0 ? fmt.number(v) + ' imp.' : fmt.number(v) + ' clics' },
      },
    });
  }

  function renderTable(products) {
    const tbody = document.getElementById('seo-table-body');
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4 small">Sin datos. Importa "Channel Product List - Search" o "Channel Stats - Search".</td></tr>';
      return;
    }
    tbody.innerHTML = products.map(p => `
      <tr>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.product_name}">${p.product_name}</td>
        <td class="text-end num">${fmt.number(p.impressions)}</td>
        <td class="text-end num">${fmt.number(p.clicks)}</td>
        <td class="text-end num">${(p.avg_ctr != null && p.avg_ctr > 0) ? fmt.percent(p.avg_ctr) : '—'}</td>
        <td class="text-end num">${fmt.number(p.orders)}</td>
        <td class="text-end num">${(p.avg_conversion != null && p.avg_conversion > 0) ? fmt.percent(p.avg_conversion) : '—'}</td>
        <td class="text-end num">${p.gmv > 0 ? fmt.currency(p.gmv) : '—'}</td>
      </tr>`).join('');
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init };
})();
