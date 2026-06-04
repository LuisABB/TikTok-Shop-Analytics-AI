/**
 * pages/dashboard.js — Módulo del Dashboard Ejecutivo.
 */
const DashboardPage = (() => {

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [summary, trend, diagnostics] = await Promise.all([
        API.getDashboardSummary({ start, end }),
        API.getGMVTrend({ start, end }),
        API.getDiagnostics({ start, end }),
      ]);
      renderKPIs(summary);
      renderGMVTrend(trend);
      renderFunnel(summary.funnel);
      renderChannelMix(summary);
      renderDiagnostics(diagnostics);
    } catch (e) {
      showToast('Error cargando el dashboard: ' + e.message, 'error');
    }
  }

  function renderKPIs({ sales }) {
    document.getElementById('kpi-gmv').textContent       = fmt.currency(sales.gmv);
    document.getElementById('kpi-orders').textContent    = fmt.number(sales.orders);
    document.getElementById('kpi-customers').textContent = fmt.number(sales.customers);
    document.getElementById('kpi-aov').textContent       = fmt.currency(sales.aov);
  }

  function renderGMVTrend(trend) {
    const categories = trend.map(r => r.date);
    const values     = trend.map(r => r.gmv);
    mountChart('chart-gmv-trend', {
      ...defaultChartOptions(),
      chart:  { ...defaultChartOptions().chart, type: 'area', height: 240 },
      series: [{ name: 'GMV', data: values }],
      xaxis:  { categories, labels: { rotate: -30, style: { fontSize: '11px' } } },
      yaxis:  { labels: { formatter: v => '$' + fmt.number(v) } },
      fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .4, opacityTo: .05 } },
      stroke: { curve: 'smooth', width: 2.5 },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.red],
    });
  }

  function renderFunnel({ impressions, clicks, cart, orders, ctr, cart_rate, purchase_rate, overall_cvr }) {
    const container = document.getElementById('funnel-container');
    if (!container) return;
    const steps = [
      { label: 'Impresiones',   value: fmt.number(impressions), rate: null },
      { label: 'Clics',         value: fmt.number(clicks),      rate: ctr         ? fmt.percent(ctr)          : null, rateLabel: 'CTR' },
      { label: 'Carrito',       value: fmt.number(cart),        rate: cart_rate   ? fmt.percent(cart_rate)   : null, rateLabel: 'Clic→Carrito' },
      { label: 'Pedidos',       value: fmt.number(orders),      rate: purchase_rate ? fmt.percent(purchase_rate) : null, rateLabel: 'Carrito→Compra' },
    ];
    container.innerHTML = steps.map((s, i) => `
      <div class="funnel-step ${i < steps.length - 1 ? 'border-bottom' : ''}">
        <div class="step-value">${s.value}</div>
        <div class="step-label">${s.label}</div>
        ${s.rate ? `<div class="step-rate"><i class="bi bi-arrow-down-short"></i>${s.rate} ${s.rateLabel}</div>` : ''}
      </div>`).join('');

    // Badge conversión general
    const kpiConv = document.getElementById('kpi-aov');
    if (kpiConv && overall_cvr != null) {
      // Añadir sub de conversión general a cualquier kpi-sub visible
    }
  }

  function renderChannelMix({ video, live, search }) {
    const gmvValues = [
      parseFloat(video.gmv  || 0),
      parseFloat(live.gmv   || 0),
      parseFloat(search.gmv || 0),
    ];
    const hasGMV = gmvValues.some(v => v > 0);

    // Si hay GMV, mostrar por GMV; si no, mostrar por actividad (vv / viewers / impressions)
    const activityValues = [
      parseFloat(video.vv             || 0),
      parseFloat(live.total_viewers   || 0),
      parseFloat(search.impressions   || 0),
    ];
    const values = hasGMV ? gmvValues : activityValues;
    const seriesLabel = hasGMV ? 'GMV' : 'Actividad';

    if (values.every(v => v === 0)) {
      document.getElementById('chart-channel-mix').innerHTML = '<p class="text-center text-muted py-5 small">Sin datos de canales aún.</p>';
      return;
    }

    mountChart('chart-channel-mix', {
      ...defaultChartOptions(),
      chart:  { type: 'donut', height: 240 },
      series: values,
      labels: ['Video', 'LIVE', 'Búsqueda'],
      legend: { position: 'bottom' },
      plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: seriesLabel } } } } },
      dataLabels: { formatter: (val) => val.toFixed(1) + '%' },
      tooltip: { y: { formatter: hasGMV ? (v => '$' + fmt.number(v)) : (v => fmt.number(v)) } },
      colors: [CHART_COLORS.red, CHART_COLORS.teal, CHART_COLORS.blue],
    });
  }

  function renderDiagnostics(diagnostics) {
    const container = document.getElementById('diagnostics-container');
    const badge = document.getElementById('badge-diagnostics');
    if (badge) badge.textContent = diagnostics.length;

    if (!diagnostics.length) {
      container.innerHTML = `<div class="text-center text-success py-4"><i class="bi bi-check-circle fs-2"></i><p class="mt-2 small">Sin problemas críticos detectados.</p></div>`;
      return;
    }
    container.innerHTML = diagnostics.map(d => `
      <div class="diagnostic-item ${d.severity}">
        <div class="diag-label">${d.label}</div>
        <div class="diag-desc">${d.description}</div>
        ${d.actions?.length ? `<ul class="mb-0 mt-2 small text-muted ps-3">${d.actions.slice(0,2).map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
  }

  return { init, refresh: init };
})();
