/**
 * pages/analytics.js — Módulo de Análisis Avanzado (Embudo y Rentabilidad).
 */
const AnalyticsPage = (() => {
  let currentLeakageStage = 'click_to_cart';

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [funnelData, financialData, topCtor, leakageData] = await Promise.all([
        API.getFunnelAnalysis({ start, end }),
        API.getFinancialAnalysis({ start, end }),
        API.getTopFunnelProducts({ metric: 'ctor', limit: 10, start, end }),
        API.getLeakageProducts({ stage: currentLeakageStage, limit: 10, start, end }),
      ]);
      
      renderFunnelKPIs(funnelData);
      renderFinancialKPIs(financialData);
      renderFunnelChart(funnelData);
      renderLeakageChart(funnelData);
      renderFinancialChart(financialData);
      renderTopCTORChart(topCtor);
      renderLeakageTable(leakageData);
    } catch (e) {
      showToast('Error cargando analytics: ' + e.message, 'error');
    }
  }

  function renderFunnelKPIs(data) {
    document.getElementById('kpi-impressions').textContent = fmt.number(data.total.impressions);
    document.getElementById('kpi-ctr').textContent = fmt.percent(data.total.ctr);
    document.getElementById('kpi-atc-rate').textContent = fmt.percent(data.total.add_to_cart_rate);
    document.getElementById('kpi-ctor').textContent = fmt.percent(data.total.ctor);
  }

  function renderFinancialKPIs(data) {
    document.getElementById('kpi-gmv').textContent = fmt.currency(data.gmv);
    document.getElementById('kpi-net-revenue').textContent = fmt.currency(data.net_revenue);
    
    const refundText = `${fmt.currency(data.refunds)} (${fmt.percent(data.refund_rate)})`;
    document.getElementById('kpi-refunds').textContent = refundText;
    
    document.getElementById('kpi-aov').textContent = fmt.currency(data.avg_aov);
  }

  function renderFunnelChart(data) {
    const stages = ['Impresiones', 'Clics', 'Carrito', 'Pedidos'];
    const values = [
      data.total.impressions,
      data.total.clicks,
      data.total.add_to_cart,
      data.total.orders,
    ];

    mountChart('chart-funnel', {
      ...defaultChartOptions(),
      chart: { type: 'bar', height: 350 },
      series: [{ name: 'Total', data: values }],
      xaxis: { categories: stages },
      yaxis: { labels: { formatter: v => fmt.number(v) } },
      plotOptions: {
        bar: {
          borderRadius: 4,
          horizontal: false,
          columnWidth: '50%',
        },
      },
      dataLabels: {
        enabled: true,
        formatter: v => fmt.number(v),
        style: { fontSize: '11px', colors: ['#fff'] },
      },
      colors: [CHART_COLORS.red],
      annotations: {
        points: values.map((val, idx) => ({
          x: stages[idx],
          y: val,
          marker: { size: 0 },
          label: {
            text: idx < stages.length - 1 
              ? `${fmt.percent(100 - data.leakage[
                  idx === 0 ? 'impression_to_click' 
                : idx === 1 ? 'click_to_cart'
                : 'cart_to_order'
                ])}` 
              : '',
            style: { fontSize: '10px', background: '#fff', color: '#555' },
            offsetY: -10,
          },
        })),
      },
    });
  }

  function renderLeakageChart(data) {
    const stages = ['Impresión→Clic', 'Clic→Carrito', 'Carrito→Pedido'];
    const leakageValues = [
      data.leakage.impression_to_click,
      data.leakage.click_to_cart,
      data.leakage.cart_to_order,
    ];

    mountChart('chart-leakage', {
      ...defaultChartOptions(),
      chart: { type: 'donut', height: 350 },
      series: leakageValues,
      labels: stages,
      colors: [CHART_COLORS.red, CHART_COLORS.orange, CHART_COLORS.teal],
      legend: { position: 'bottom' },
      dataLabels: {
        enabled: true,
        formatter: (val) => val.toFixed(1) + '%',
      },
      plotOptions: {
        pie: {
          donut: {
            labels: {
              show: true,
              name: { show: true },
              value: {
                show: true,
                formatter: val => parseFloat(val).toFixed(1) + '%',
              },
              total: {
                show: true,
                label: 'Pérdida Prom.',
                formatter: () => {
                  const avg = leakageValues.reduce((a, b) => a + b, 0) / leakageValues.length;
                  return avg.toFixed(1) + '%';
                },
              },
            },
          },
        },
      },
    });
  }

  function renderFinancialChart(data) {
    const categories = data.gmv_includes_tax
      ? ['GMV (c/ imp.)', 'Envío', 'Reembolsos', 'Subsidio TikTok', 'Neto']
      : ['GMV', 'Impuestos', 'Envío', 'Reembolsos', 'Subsidio TikTok', 'Neto'];
    const values = data.gmv_includes_tax
      ? [data.gmv, -data.shipping_fees, -data.refunds, data.subsidy_impact, data.net_revenue]
      : [data.gmv, -data.tax, -data.shipping_fees, -data.refunds, data.subsidy_impact, data.net_revenue];

    const hasData = values.some(v => Math.abs(v) > 0);
    const container = document.getElementById('chart-financial');
    if (!hasData) {
      container.innerHTML = '<p class="text-center text-muted py-5 small">Sin datos financieros en este período.</p>';
      return;
    }

    mountChart('chart-financial', {
      ...defaultChartOptions(),
      chart: { type: 'bar', height: 300, stacked: false },
      series: [{ name: 'Monto', data: values }],
      xaxis: { categories },
      yaxis: { labels: { formatter: v => '$' + fmt.number(v) } },
      plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '60%' } },
      dataLabels: {
        enabled: true,
        formatter: v => v !== 0 ? '$' + fmt.number(Math.abs(v)) : '',
        style: { fontSize: '10px' },
      },
      colors: values.map(v => v >= 0 ? CHART_COLORS.green : CHART_COLORS.red),
    });
  }

  function renderTopCTORChart(products) {
    const titleEl = document.querySelector('#chart-top-ctor')?.closest('.section-card')?.querySelector('h6');
    const withCtor = products.filter(p => p.ctor > 0);
    const useClicks = withCtor.length === 0;
    const source = useClicks
      ? [...products].filter(p => p.clicks > 0).sort((a, b) => b.clicks - a.clicks).slice(0, 10)
      : withCtor.slice(0, 10);

    if (!source.length) {
      document.getElementById('chart-top-ctor').innerHTML =
        '<p class="text-center text-muted py-5 small">Sin conversiones ni clics en este período.</p>';
      if (titleEl) {
        titleEl.innerHTML = '<i class="bi bi-graph-up me-2 text-info"></i>Top Productos por CTOR';
      }
      return;
    }

    if (titleEl) {
      titleEl.innerHTML = useClicks
        ? '<i class="bi bi-graph-up me-2 text-info"></i>Top Productos por Clics <small class="text-muted fw-normal">(sin pedidos aún)</small>'
        : '<i class="bi bi-graph-up me-2 text-info"></i>Top Productos por CTOR';
    }

    const names = source.map(p => truncate(p.product_name, 18));
    const chartValues = useClicks ? source.map(p => p.clicks) : source.map(p => p.ctor);
    const seriesName = useClicks ? 'Clics' : 'CTOR %';

    mountChart('chart-top-ctor', {
      ...defaultChartOptions(),
      chart: { type: 'bar', height: 300 },
      series: [{ name: seriesName, data: chartValues }],
      xaxis: {
        categories: names,
        labels: { formatter: v => (useClicks && typeof v === 'number') ? fmt.number(v) : undefined, style: { fontSize: '10px' } },
      },
      yaxis: {
        labels: {
          formatter: v => typeof v === 'number'
            ? (useClicks ? fmt.number(v) : v.toFixed(1) + '%')
            : String(v || ''),
          style: { fontSize: '10px' },
        },
      },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      dataLabels: {
        enabled: true,
        formatter: v => useClicks ? fmt.number(v) : v.toFixed(2) + '%',
        style: { fontSize: '10px' },
      },
      colors: [CHART_COLORS.blue],
      tooltip: {
        y: { formatter: v => useClicks ? fmt.number(v) + ' clics' : v.toFixed(2) + '%' },
      },
    });
  }

  function renderLeakageTable(products) {
    const tbody = document.getElementById('leakage-table-body');
    if (!products.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4 small">Sin datos</td></tr>';
      return;
    }

    tbody.innerHTML = products.map(p => `
      <tr>
        <td style="max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.product_name}">
          ${p.product_name}
        </td>
        <td class="text-end num">${fmt.number(p.impressions)}</td>
        <td class="text-end num">${fmt.number(p.clicks)}</td>
        <td class="text-end num">${fmt.number(p.add_to_cart)}</td>
        <td class="text-end num">${fmt.number(p.orders)}</td>
        <td class="text-end">
          <span class="badge bg-${p.selected_leakage > 80 ? 'danger' : p.selected_leakage > 50 ? 'warning' : 'success'}">
            ${p.selected_leakage.toFixed(1)}%
          </span>
        </td>
      </tr>
    `).join('');
  }

  async function changeLeakageStage(stage, btn) {
    // Update button states
    document.querySelectorAll('[data-stage]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentLeakageStage = stage;
    const { start, end } = getDateFilter();
    
    try {
      const data = await API.getLeakageProducts({ stage, limit: 10, start, end });
      renderLeakageTable(data);
    } catch (e) {
      showToast('Error cargando datos: ' + e.message, 'error');
    }
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init, changeLeakageStage };
})();
