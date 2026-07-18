/**
 * pages/dashboard.js — Módulo del Dashboard Ejecutivo.
 */
const DashboardPage = (() => {

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [summary, trend, orderTrend, diagnostics] = await Promise.all([
        API.getDashboardSummary({ start, end }),
        API.getGMVTrend({ start, end }),
        API.getOrderGMVTrend({ start, end }),
        API.getDiagnostics({ start, end }),
      ]);
      const useOrders = summary.orders && summary.orders.has_data;
      renderKPIs(summary);
      renderGMVTrend(useOrders ? orderTrend : trend, useOrders);
      renderFunnel(summary.funnel, useOrders ? summary.orders.orders : null);
      renderChannelMix(summary, useOrders);
      renderDiagnostics(diagnostics);
    } catch (e) {
      showToast('Error cargando el dashboard: ' + e.message, 'error');
    }
  }

  function renderKPIs({ sales, orders }) {
    // Preferir datos de órdenes reales cuando estén disponibles (has_data = true)
    const useOrders = orders && orders.has_data;
    const data      = useOrders ? orders : sales;

    document.getElementById('kpi-gmv').textContent       = fmt.currency(data.gmv);
    document.getElementById('kpi-orders').textContent    = fmt.number(data.orders);
    document.getElementById('kpi-customers').textContent = fmt.number(data.customers);
    document.getElementById('kpi-aov').textContent       = fmt.currency(data.aov);

    // Badge de fuente de datos (si existe el elemento en el HTML)
    const badge = document.getElementById('kpi-data-source');
    if (badge) {
      badge.textContent = useOrders ? '📦 Pedidos reales' : '📊 Métricas TikTok';
      badge.title       = useOrders
        ? `GMV y pedidos calculados desde ${data.orders} órdenes reales importadas`
        : 'Basado en reportes agregados de TikTok Shop';
    }
  }

  function renderGMVTrend(trend, useOrders = false) {
    const categories = trend.map(r => r.date);
    const values     = trend.map(r => r.gmv);
    mountChart('chart-gmv-trend', {
      ...defaultChartOptions(),
      chart:  { ...defaultChartOptions().chart, type: 'area', height: 240 },
      series: [{ name: useOrders ? 'GMV (Pedidos)' : 'GMV', data: values }],
      xaxis:  { categories, labels: { rotate: -30, style: { fontSize: '11px' } } },
      yaxis:  { labels: { formatter: v => '$' + fmt.number(v) } },
      fill:   { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .4, opacityTo: .05 } },
      stroke: { curve: 'smooth', width: 2.5 },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.red],
    });
  }

  function renderFunnel({ impressions, clicks, cart, orders, ctr, cart_rate, purchase_rate, overall_cvr }, realOrders = null) {
    const container = document.getElementById('funnel-container');
    if (!container) return;
    const effectiveOrders = realOrders != null ? realOrders : orders;
    const effectivePurchaseRate = realOrders != null
      ? (cart > 0 ? (realOrders / cart) * 100 : null)
      : purchase_rate;
    const steps = [
      { label: 'Impresiones',   value: fmt.number(impressions), rate: null },
      { label: 'Clics',         value: fmt.number(clicks),      rate: ctr         ? fmt.percent(ctr)          : null, rateLabel: 'CTR' },
      { label: 'Carrito',       value: fmt.number(cart),        rate: cart_rate   ? fmt.percent(cart_rate)   : null, rateLabel: 'Clic→Carrito' },
      { label: 'Pedidos',       value: fmt.number(effectiveOrders), rate: effectivePurchaseRate ? fmt.percent(effectivePurchaseRate) : null, rateLabel: 'Carrito→Compra' },
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

  function renderChannelMix({ video, live, search, orders }, useOrders = false) {
    if (useOrders && orders && orders.channels) {
      const channels = orders.channels;
      const videoVal = parseFloat(channels.Videos?.gmv || channels.Video?.gmv || 0);
      const liveVal  = parseFloat(channels.LIVE?.gmv || channels.Live?.gmv || 0);
      const searchVal = parseFloat(
        channels['Product cards']?.gmv ||
        channels['Product Cards']?.gmv ||
        channels.Busqueda?.gmv ||
        channels.Búsqueda?.gmv ||
        channels.Search?.gmv ||
        0
      );

      const values = [videoVal, liveVal, searchVal];
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
        plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'GMV' } } } } },
        dataLabels: { formatter: (val) => val.toFixed(1) + '%' },
        tooltip: { y: { formatter: (v => '$' + fmt.number(v)) } },
        colors: [CHART_COLORS.red, CHART_COLORS.teal, CHART_COLORS.blue],
      });
      return;
    }

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
