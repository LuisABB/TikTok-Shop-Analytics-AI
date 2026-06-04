/**
 * pages/ai.js — Módulo de Recomendaciones IA.
 */
const AiPage = (() => {

  function init() {
    document.getElementById('btnGenerateAI')?.addEventListener('click', generate);
    document.getElementById('btnDownloadPdf')?.addEventListener('click', downloadPdf);
  }

  async function generate() {
    const { start, end } = getDateFilter();
    const btn = document.getElementById('btnGenerateAI');
    const loading = document.getElementById('ai-loading');
    const weeklyPlan = document.getElementById('ai-weekly-plan');

    btn.disabled = true;
    loading.style.display = 'block';
    weeklyPlan.style.display = 'none';

    try {
      const { recommendations: recs, diagnostics, generated_at } = await API.getRecommendations({ start, end });

      // Oportunidad principal
      const opp = document.getElementById('ai-key-opportunity');
      if (opp) opp.textContent = recs.key_opportunity || 'Ver recomendaciones abajo.';

      // Reporte del período
      weeklyPlan.style.display = 'block';
      if (recs.period_report) {
        weeklyPlan.innerHTML = recs.period_report
          .split('\n')
          .filter(l => l.trim())
          .map(l => `<p class="mb-2">${l}</p>`)
          .join('');
      } else if (recs.weekly_plan) {
        weeklyPlan.innerHTML = recs.weekly_plan
          .split('\n')
          .filter(l => l.trim())
          .map(l => `<p class="mb-2">${l}</p>`)
          .join('');
      } else {
        weeklyPlan.innerHTML = '<p class="text-muted">Sin reporte generado.</p>';
      }

      // Fecha de generación
      const genAt = document.getElementById('ai-generated-at');
      if (genAt) genAt.textContent = `Generado el ${new Date(generated_at).toLocaleString('es-MX')}`;

      // Plan mensual (4 semanas)
      renderMonthlyPlan(recs.monthly_plan, start, end);

      // Activar botón PDF y llenar cabecera de impresión
      const pdfBtn = document.getElementById('btnDownloadPdf');
      if (pdfBtn) pdfBtn.style.display = 'inline-flex';
      const fmt2 = d => new Date(d).toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' });
      const el = id => document.getElementById(id);
      if (el('ai-print-title')) el('ai-print-title').textContent =
        `Reporte ${start ? fmt2(start) : ''} — ${end ? fmt2(end) : ''}`;
      if (el('ai-print-period')) el('ai-print-period').textContent =
        `Oportunidad: ${recs.key_opportunity || ''}`;
      if (el('ai-print-date')) el('ai-print-date').textContent =
        `Generado el ${new Date(generated_at).toLocaleString('es-MX')}`;

      // Diagnósticos
      renderDiagnostics(diagnostics);

      // Recomendaciones
      renderRecs('ai-recs-high',   recs.priority_high,   'high');
      renderRecs('ai-recs-medium', recs.priority_medium, 'medium');
      renderRecs('ai-recs-low',    recs.priority_low,    'low');

      showToast('Análisis IA generado correctamente', 'success');
    } catch (e) {
      weeklyPlan.style.display = 'block';
      weeklyPlan.innerHTML = `<div class="alert alert-danger"><i class="bi bi-exclamation-triangle me-2"></i>${e.message}</div>`;
      showToast('Error: ' + e.message, 'error');
    } finally {
      btn.disabled = false;
      loading.style.display = 'none';
    }
  }

  function downloadPdf() {
    window.print();
  }

  function renderMonthlyPlan(weeks, start, end) {
    const card  = document.getElementById('ai-monthly-plan-card');
    const cont  = document.getElementById('ai-monthly-plan-weeks');
    const label = document.getElementById('ai-next-month-label');
    if (!card || !cont) return;

    if (!weeks?.length) { card.style.display = 'none'; return; }

    // Calcular nombre del mes siguiente al período
    if (label) {
      const base = end ? new Date(end) : new Date();
      const next = new Date(base);
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      label.textContent = next.toLocaleString('es-MX', { month: 'long', year: 'numeric' })
        .replace(/^./, c => c.toUpperCase());
    }

    const weekColors = ['primary', 'success', 'warning', 'info'];
    const weekIcons  = ['1-circle', '2-circle', '3-circle', '4-circle'];

    cont.innerHTML = weeks.map((w, i) => `
      <div class="col-12 col-md-6 col-xl-3">
        <div class="section-card h-100" style="border-top: 3px solid var(--bs-${weekColors[i] || 'secondary'})">
          <div class="card-body-custom">
            <div class="d-flex align-items-center gap-2 mb-2">
              <i class="bi bi-${weekIcons[i] || 'circle'}-fill text-${weekColors[i] || 'secondary'} fs-4"></i>
              <div>
                <div class="fw-bold" style="font-size:13px">${w.label || `Semana ${w.week}`}</div>
                ${w.dates ? `<div class="text-muted" style="font-size:11px">${w.dates}</div>` : ''}
              </div>
            </div>
            ${w.focus ? `<div class="badge bg-${weekColors[i] || 'secondary'} bg-opacity-10 text-${weekColors[i] || 'secondary'} border border-${weekColors[i] || 'secondary'} mb-3 py-1 px-2 text-wrap" style="font-size:11px;font-weight:600">${w.focus}</div>` : ''}
            <ul class="list-unstyled mb-0">
              ${(w.actions || []).map(a => `
                <li class="d-flex gap-2 align-items-start mb-2" style="font-size:12.5px">
                  <i class="bi bi-check2 text-${weekColors[i] || 'secondary'} mt-1 flex-shrink-0"></i>
                  <span>${a}</span>
                </li>`).join('')}
            </ul>
          </div>
        </div>
      </div>`).join('');

    card.style.display = 'block';
  }

  function renderDiagnostics(diagnostics) {
    const container = document.getElementById('ai-diagnostics-container');
    if (!container) return;
    if (!diagnostics?.length) {
      container.innerHTML = '<div class="text-center text-success py-3 small"><i class="bi bi-check-circle me-1"></i>Sin problemas críticos detectados.</div>';
      return;
    }
    container.innerHTML = diagnostics.map(d => `
      <div class="diagnostic-item ${d.severity}">
        <div class="diag-label">${d.label}</div>
        <div class="diag-desc">${d.description}</div>
        ${d.actions?.length ? `<ul class="mb-0 mt-2 small ps-3">${d.actions.map(a => `<li>${a}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
  }

  function renderRecs(containerId, items, priority) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items?.length) {
      container.innerHTML = '<div class="text-muted small">—</div>';
      return;
    }
    container.innerHTML = items.map(r => `
      <div class="rec-card ${priority}">
        <div class="rec-action"><i class="bi bi-arrow-right-circle-fill me-2 text-${priority === 'high' ? 'danger' : priority === 'medium' ? 'warning' : 'secondary'}"></i>${r.action}</div>
        <div class="rec-impact"><i class="bi bi-graph-up me-1"></i>${r.impact}</div>
        <div class="rec-justif">${r.justification}</div>
        ${r.deadline ? `<span class="rec-deadline"><i class="bi bi-calendar-check me-1"></i>${r.deadline}</span>` : ''}
      </div>`).join('');
  }

  return { init, refresh: init };
})();
