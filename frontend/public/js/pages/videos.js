/**
 * pages/videos.js — Módulo de Performance de Videos.
 */
const VideosPage = (() => {
  let videoListQuery = '';
  let searchTimer = null;

  function formatDateAxisLabel(rawDate) {
    const iso = String(rawDate || '').split('T')[0];
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso || '—';
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const monthName = months[Math.max(0, Math.min(11, Number(m[2]) - 1))];
    return `${m[3]} ${monthName} ${m[1]}`;
  }

  function setupVideoIdSearch() {
    const input = document.getElementById('video-id-search');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.value = videoListQuery;
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        videoListQuery = input.value.trim();
        refreshVideoListChart();
      }, 300);
    });
  }

  async function refreshVideoListChart() {
    const { start, end } = getDateFilter();
    const q = videoListQuery;
    try {
      const videoList = await API.getVideoList({
        limit: q ? 50 : 15,
        start,
        end,
        ...(q ? { q } : {}),
      });
      renderVideoListChart(videoList, q);
    } catch (e) {
      showToast('Error buscando videos: ' + e.message, 'error');
    }
  }

  async function init() {
    const { start, end } = getDateFilter();
    const input = document.getElementById('video-id-search');
    if (input) input.value = videoListQuery;
    setupVideoIdSearch();

    try {
      const q = videoListQuery;
      const [kpis, videos, videoList] = await Promise.all([
        API.getVideoKPIs({ start, end }),
        API.getTopVideos({ limit: 100, start, end }),
        API.getVideoList({
          limit: q ? 50 : 15,
          start,
          end,
          ...(q ? { q } : {}),
        }),
      ]);
      renderKPIs(kpis);
      renderTopVideosChart(videos);
      renderRatesChart(videos);
      renderVideoListChart(videoList, q);
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
      
      // Mostrar fecha en todos los puntos para evitar ambigüedad
      const labels = sorted.map(v => formatDateAxisLabel(v.report_date));
      
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
    
    // Mostrar fecha en todos los puntos para mantener trazabilidad
    const labels = top.map((v) => {
      if (v.video_title) {
        return truncate(v.video_title, 14);
      } else if (v.report_date) {
        const fullDate = formatDateAxisLabel(v.report_date); // DD mes YYYY
        return fullDate;
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

  async function copyVideoId(videoId) {
    if (!videoId) return;
    try {
      await navigator.clipboard.writeText(String(videoId));
      showToast('ID copiado: ' + videoId, 'success');
    } catch {
      showToast('No se pudo copiar el ID', 'error');
    }
  }

  function renderVideoListChart(videos, q = '') {
    const container = document.getElementById('chart-video-list');
    if (!container) return;

    if (!videos.length) {
      destroyChart('chart-video-list');
      container.innerHTML = q
        ? `<div class="text-center text-muted py-5"><i class="bi bi-search fs-1 d-block mb-3 opacity-25"></i><p class="mb-0">Ningún video con ID que contenga "<code style="user-select:all">${escapeHtml(q)}</code>"</p></div>`
        : '<div class="text-center text-muted py-5"><i class="bi bi-play-btn fs-1 d-block mb-3 opacity-25"></i><p class="mb-0">Sin datos. Importa "Video Performance List".</p></div>';
      return;
    }

    const allZeroVV = videos.every(v => !v.vv);
    const useGmv = allZeroVV && videos.some(v => v.gmv > 0);
    const metricName = useGmv ? 'GMV' : 'Reproducciones';
    const metricData = videos.map(v => useGmv ? (v.gmv || 0) : (v.vv || 0));
    // En búsqueda mostrar ID completo (seleccionable vía clic); sin búsqueda truncar título/id
    const labels = videos.map(v => {
      if (q) return String(v.video_id || '—');
      return truncate(v.video_title || v.video_id || 'Video', 28);
    });

    const titleEl = container.closest('.section-card')?.querySelector('h6');
    if (titleEl) {
      const base = useGmv ? 'Top Videos por GMV' : 'Top Videos por Reproducciones';
      const hint = q
        ? `<span class="text-muted fw-normal small ms-1">${videos.length} resultado${videos.length === 1 ? '' : 's'}</span>`
        : '<span class="text-muted fw-normal small ms-1">(clic para copiar ID)</span>';
      titleEl.innerHTML = `<i class="bi bi-play-btn me-2 text-danger"></i>${base} ${hint}`;
    }

    mountChart('chart-video-list', {
      ...defaultChartOptions(),
      chart: {
        type: 'bar',
        height: Math.max(320, videos.length * 28),
        events: {
          click: (_e, _ctx, config) => {
            if (config.dataPointIndex == null || config.dataPointIndex < 0) return;
            copyVideoId(videos[config.dataPointIndex]?.video_id);
          },
          xAxisLabelClick: (_e, _ctx, config) => {
            if (config.labelIndex == null || config.labelIndex < 0) return;
            copyVideoId(videos[config.labelIndex]?.video_id);
          },
        },
      },
      series: [{ name: metricName, data: metricData }],
      xaxis: {
        categories: labels,
        labels: { style: { fontSize: '11px', cssClass: 'apexcharts-yaxis-label cursor-pointer' } },
      },
      yaxis: {
        labels: {
          formatter: v => typeof v === 'number'
            ? (useGmv ? '$' + fmt.number(v) : fmt.number(v))
            : String(v || ''),
        },
      },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 4,
          barHeight: '70%',
          dataLabels: { position: 'top' },
        },
      },
      states: {
        active: { filter: { type: 'none' } },
        hover: { filter: { type: 'lighten', value: 0.05 } },
      },
      dataLabels: { enabled: false },
      colors: [CHART_COLORS.red],
      tooltip: {
        custom: ({ dataPointIndex }) => {
          const row = videos[dataPointIndex];
          if (!row) return '';
          const value = useGmv ? fmt.currency(row.gmv) : fmt.number(row.vv);
          const title = row.video_title ? `<div class="fw-semibold mb-1">${escapeHtml(row.video_title)}</div>` : '';
          return `<div class="px-2 py-1" style="user-select:text">
            ${title}
            <div><span class="text-muted">ID:</span> <code style="user-select:all">${escapeHtml(row.video_id || '—')}</code></div>
            <div>${metricName}: ${value}</div>
            <div class="small text-muted mt-1">Clic para copiar ID</div>
          </div>`;
        },
      },
    });

    container.style.cursor = 'pointer';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '—');
  }

  return { init, refresh: init };
})();
