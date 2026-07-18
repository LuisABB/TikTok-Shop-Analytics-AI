/**
 * pages/videos.js — Módulo de Performance de Videos.
 */
const VideosPage = (() => {
  let tableRows = [];
  let tableSort = { key: 'vv', dir: 'desc' };

  const TABLE_COLUMNS = [
    { key: 'label',  type: 'text' },
    { key: 'author', type: 'text' },
    { key: 'vv',     type: 'number' },
    { key: 'gmv',    type: 'number' },
    { key: 'orders', type: 'number' },
    { key: 'ctr',    type: 'number' },
    { key: 'ctor',   type: 'number' },
    { key: 'gpm',    type: 'number' },
  ];

  function formatDateAxisLabel(rawDate) {
    const iso = String(rawDate || '').split('T')[0];
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso || '—';
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const monthName = months[Math.max(0, Math.min(11, Number(m[2]) - 1))];
    return `${m[3]} ${monthName} ${m[1]}`;
  }

  async function init() {
    const { start, end } = getDateFilter();
    try {
      const [kpis, videos] = await Promise.all([
        API.getVideoKPIs({ start, end }),
        API.getTopVideos({ limit: 100, start, end }), // Aumentado para mostrar todos los días
      ]);
      setupTableSorting();
      tableRows = videos || [];
      renderKPIs(kpis);
      renderTopVideosChart(videos);
      renderRatesChart(videos);
      renderTable(sortTableRows(tableRows));
    } catch (e) {
      showToast('Error cargando videos: ' + e.message, 'error');
    }
  }

  function setupTableSorting() {
    const tbody = document.getElementById('videos-table-body');
    if (!tbody) return;
    const table = tbody.closest('table');
    if (!table) return;

    const headers = Array.from(table.querySelectorAll('thead th'));
    headers.forEach((th, index) => {
      const col = TABLE_COLUMNS[index];
      if (!col) return;

      th.dataset.sortKey = col.key;
      th.style.cursor = 'pointer';
      th.title = 'Ordenar';

      if (!th.dataset.sortBound) {
        th.addEventListener('click', () => {
          if (tableSort.key === col.key) {
            tableSort.dir = tableSort.dir === 'asc' ? 'desc' : 'asc';
          } else {
            tableSort.key = col.key;
            tableSort.dir = col.type === 'text' ? 'asc' : 'desc';
          }
          updateSortIndicators(headers);
          renderTable(sortTableRows(tableRows));
        });
        th.dataset.sortBound = '1';
      }
    });

    updateSortIndicators(headers);
  }

  function updateSortIndicators(headers) {
    headers.forEach((th, index) => {
      const col = TABLE_COLUMNS[index];
      if (!col) return;

      const base = (th.textContent || '').replace(/[\s▲▼]+$/g, '').trim();
      const isActive = col.key === tableSort.key;
      const marker = isActive ? (tableSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
      th.textContent = base + marker;
    });
  }

  function sortTableRows(rows) {
    const col = TABLE_COLUMNS.find(c => c.key === tableSort.key) || TABLE_COLUMNS[2];
    const dirFactor = tableSort.dir === 'asc' ? 1 : -1;
    const arr = [...(rows || [])];

    arr.sort((a, b) => {
      const av = sortableValue(a, col.key, col.type);
      const bv = sortableValue(b, col.key, col.type);

      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (col.type === 'text') {
        return String(av).localeCompare(String(bv), 'es', { sensitivity: 'base' }) * dirFactor;
      }
      return ((Number(av) || 0) - (Number(bv) || 0)) * dirFactor;
    });

    return arr;
  }

  function sortableValue(video, key, type) {
    if (!video) return null;

    if (key === 'label') {
      return video.video_title || video.video_id || video.report_date || '';
    }
    if (key === 'author') {
      return video.author || '';
    }

    const raw = video[key];
    if (raw === null || raw === undefined || raw === '') return null;
    if (type === 'number') return Number(raw);
    return raw;
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
    const labels = top.map((v, i) => {
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
