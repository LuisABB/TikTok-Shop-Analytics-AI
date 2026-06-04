/**
 * pages/live.js — Módulo de Performance LIVE.
 */
const LivePage = (() => {

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [kpis, sessions] = await Promise.all([
        API.getLiveKPIs({ start, end }),
        API.getLiveSessions({ limit: 20, start, end }),
      ]);
      renderKPIs(kpis);
      renderTopLivesChart(sessions);
      renderRatesChart(sessions);
      renderTable(sessions);
    } catch (e) {
      showToast('Error cargando LIVE: ' + e.message, 'error');
    }
  }

  function renderKPIs(kpis) {
    document.getElementById('l-kpi-sessions').textContent = fmt.number(kpis.total_sessions);
    document.getElementById('l-kpi-gmv').textContent      = fmt.currency(kpis.gmv);
    document.getElementById('l-kpi-viewers').textContent  = fmt.number(kpis.total_viewers);
    document.getElementById('l-kpi-ctr').textContent      = fmt.percent(kpis.avg_ctr);
    document.getElementById('l-kpi-ctor').textContent     = fmt.percent(kpis.avg_ctor);
    document.getElementById('l-kpi-peak').textContent     = fmt.number(kpis.avg_peak_viewers);
  }

  function renderTopLivesChart(sessions) {
    const top = sessions.slice(0, 10);
    mountChart('chart-top-lives', {
      ...defaultChartOptions(),
      chart:  { type: 'bar', height: 280 },
      series: [{ name: 'GMV', data: top.map(s => s.gmv || 0) }],
      xaxis:  { categories: top.map(s => truncate(s.live_title || s.live_id || fmt.date(s.report_date), 16)), labels: { style: { fontSize: '10px' } } },
      yaxis:  { labels: { formatter: v => typeof v === 'number' ? '$' + fmt.number(v) : String(v || '') } },
      plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.red],
    });
  }

  function renderRatesChart(sessions) {
    const rows = sessions.filter(s => s.ctr != null || s.ctor != null);
    if (!rows.length) return;
    const labels = rows.map(s => fmt.date(s.report_date));
    mountChart('chart-live-rates', {
      ...defaultChartOptions(),
      chart:   { type: 'bar', height: 280 },
      series:  [
        { name: 'CTR', data: rows.map(s => s.ctr  != null ? +s.ctr.toFixed(2)  : 0) },
        { name: 'CTOR', data: rows.map(s => s.ctor != null ? +s.ctor.toFixed(2) : 0) },
      ],
      xaxis:   { categories: labels, labels: { style: { fontSize: '11px' } } },
      yaxis:   { labels: { formatter: v => typeof v === 'number' ? v.toFixed(1) + '%' : String(v || '') } },
      plotOptions: { bar: { borderRadius: 4, columnWidth: '55%' } },
      dataLabels: { enabled: false },
      colors:  [CHART_COLORS.red, CHART_COLORS.teal],
      tooltip: { y: { formatter: v => v.toFixed(2) + '%' } },
    });
  }

  function renderTable(sessions) {
    const tbody = document.getElementById('live-table-body');
    if (!sessions.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 small">Sin datos. Importa "Live Performance Core Stats".</td></tr>';
      return;
    }
    tbody.innerHTML = sessions.map(s => `
      <tr>
        <td>
          <div style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.live_title || s.live_id || '—'}</div>
          <small class="text-muted">${fmt.date(s.report_date)}</small>
        </td>
        <td class="text-end num">${fmt.number(s.viewers)}</td>
        <td class="text-end num">${fmt.number(s.peak_viewers)}</td>
        <td class="text-end num">${fmt.currency(s.gmv)}</td>
        <td class="text-end num">${fmt.number(s.orders)}</td>
        <td class="text-end num">${(s.ctr != null && s.ctr > 0) ? fmt.percent(s.ctr) : '—'}</td>
        <td class="text-end num">${(s.ctor != null && s.ctor > 0) ? fmt.percent(s.ctor) : '—'}</td>
        <td class="text-end num">${s.duration_sec != null ? (s.duration_sec >= 60 ? Math.floor(s.duration_sec/60) + 'min ' + (s.duration_sec%60) + 's' : s.duration_sec + 's') : '—'}</td>
      </tr>`).join('');
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init };
})();
