/**
 * pages/videos.js — Módulo de Performance de Videos.
 */
const VideosPage = (() => {

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [kpis, videos] = await Promise.all([
        API.getVideoKPIs({ start, end }),
        API.getTopVideos({ limit: 100, start, end }), // Aumentado para mostrar todos los días
      ]);
      renderKPIs(kpis);
      renderTopVideosChart(videos);
      renderRatesChart(videos);
      renderTable(videos);
    } catch (e) {
      showToast('Error cargando videos: ' + e.message, 'error');
    }
  }

  function renderKPIs(kpis) {
    document.getElementById('v-kpi-vv').textContent   = fmt.number(kpis.vv);
    document.getElementById('v-kpi-gmv').textContent  = fmt.currency(kpis.gmv);
    document.getElementById('v-kpi-ctr').textContent  = fmt.percent(kpis.avg_ctr);
    document.getElementById('v-kpi-ctor').textContent = fmt.percent(kpis.avg_ctor);
  }

  function renderTopVideosChart(videos) {
    const isAggregate = videos.length > 0 && !videos[0].video_id;

    if (isAggregate) {
      // Datos diarios agregados: mostrar tendencia de VV
      const sorted = [...videos].sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
      document.querySelector('#chart-top-videos')?.closest('.section-card')?.querySelector('h6')
        && (document.querySelector('#chart-top-videos').closest('.section-card').querySelector('h6').innerHTML =
          '<i class="bi bi-graph-up me-2 text-danger"></i>Tendencia de Reproducciones Diarias');
      
      // Mostrar solo cada 3 días para evitar sobrepoblación
      const labels = sorted.map((v, i) => {
        const dayOnly = String(v.report_date || '').split('T')[0].slice(-2); // Solo día (DD)
        return i % 3 === 0 ? dayOnly : ''; // Mostrar cada 3 días
      });
      
      mountChart('chart-top-videos', {
        ...defaultChartOptions(),
        chart:      { type: 'area', height: 280 },
        series:     [{ name: 'VV', data: sorted.map(v => v.vv || 0) }],
        xaxis:      { categories: labels, labels: { rotate: -45, rotateAlways: true, style: { fontSize: '10px' } } },
        yaxis:      { labels: { formatter: v => fmt.number(v) } },
        fill:       { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: .4, opacityTo: .05 } },
        stroke:     { curve: 'smooth', width: 2.5 },
        dataLabels: { enabled: false },
        colors:     [CHART_COLORS.red],
      });
    } else {
      const top = videos.slice(0, 10);
      mountChart('chart-top-videos', {
        ...defaultChartOptions(),
        chart:   { type: 'bar', height: 280 },
        series:  [{ name: 'GMV', data: top.map(v => v.gmv || 0) }],
        xaxis:   { categories: top.map(v => truncate(v.video_title || v.video_id || 'Video', 18)), labels: { style: { fontSize: '10px' } } },
        yaxis:   { labels: { formatter: v => typeof v === 'number' ? '$' + fmt.number(v) : String(v || '') } },
        plotOptions: { bar: { horizontal: true, borderRadius: 4 } },
        dataLabels: { enabled: false },
        colors:  [CHART_COLORS.red],
      });
    }
  }

  function renderRatesChart(videos) {
    const isAggregate = videos.length > 0 && !videos[0].video_id;
    const top = isAggregate
      ? [...videos].sort((a, b) => new Date(a.report_date) - new Date(b.report_date))
      : videos.slice(0, 10);
    
    // Mostrar solo cada 3 días para datos agregados
    const labels = top.map((v, i) => {
      if (v.video_title) {
        return truncate(v.video_title, 14);
      } else if (v.report_date) {
        const dayOnly = String(v.report_date).split('T')[0].slice(-2); // Solo día (DD)
        return isAggregate && i % 3 !== 0 ? '' : dayOnly;
      }
      return 'Video';
    });
    
    mountChart('chart-video-rates', {
      ...defaultChartOptions(),
      chart:  { type: 'bar', height: 280 },
      series: [
        { name: 'CTR %',  data: top.map(v => v.ctr  != null ? parseFloat(v.ctr.toFixed(2))  : 0) },
        { name: 'CTOR %', data: top.map(v => v.ctor != null ? parseFloat(v.ctor.toFixed(2)) : 0) },
      ],
      xaxis: { categories: labels, labels: { rotate: -45, rotateAlways: true, style: { fontSize: '10px' } } },
      yaxis: { labels: { formatter: v => v.toFixed(1) + '%' } },
      plotOptions: { bar: { borderRadius: 3, columnWidth: '60%' } },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.red, CHART_COLORS.teal],
    });
  }

  function renderTable(videos) {
    const tbody = document.getElementById('videos-table-body');
    if (!videos.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4 small">Sin datos. Importa "Video Performance Core Stats".</td></tr>';
      return;
    }
    tbody.innerHTML = videos.map(v => {
      const label = v.video_title || v.video_id || (v.report_date ? String(v.report_date).split('T')[0] : '—');
      return `
      <tr>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${label}">${label}</td>
        <td class="small text-muted">${v.author || '—'}</td>
        <td class="text-end num">${fmt.number(v.vv)}</td>
        <td class="text-end num">${fmt.currency(v.gmv)}</td>
        <td class="text-end num">${fmt.number(v.orders)}</td>
        <td class="text-end num">${(v.ctr != null && v.ctr > 0) ? fmt.percent(v.ctr) : '—'}</td>
        <td class="text-end num">${(v.ctor != null && v.ctor > 0) ? fmt.percent(v.ctor) : '—'}</td>
        <td class="text-end num">${(v.gpm != null && v.gpm > 0) ? fmt.currency(v.gpm) : '—'}</td>
      </tr>`;}).join('');
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init };
})();
