/**
 * router.js — SPA router.
 * Carga fragmentos HTML de /pages/:page y ejecuta el módulo JS correspondiente.
 */

const PAGE_TITLES = {
  dashboard: 'Dashboard Ejecutivo',
  import:    'Importar CSV',
  products:  'Análisis de Productos',
  videos:    'Performance de Videos',
  live:      'Performance LIVE',
  seo:       'SEO / Búsqueda',
  analytics: 'Análisis Avanzado',
  ai:        'Recomendaciones IA',
};

const PAGE_MODULES = {
  dashboard: typeof DashboardPage !== 'undefined' ? DashboardPage : null,
  import:    typeof ImportPage    !== 'undefined' ? ImportPage    : null,
  products:  typeof ProductsPage  !== 'undefined' ? ProductsPage  : null,
  videos:    typeof VideosPage    !== 'undefined' ? VideosPage    : null,
  live:      typeof LivePage      !== 'undefined' ? LivePage      : null,
  seo:       typeof SeoPage       !== 'undefined' ? SeoPage       : null,
  analytics: typeof AnalyticsPage !== 'undefined' ? AnalyticsPage : null,
  ai:        typeof AiPage        !== 'undefined' ? AiPage        : null,
};

let currentPage = null;

async function navigate(page) {
  if (!PAGE_TITLES[page]) page = 'dashboard';

  // Actualizar título topbar
  document.getElementById('topbarTitle').textContent = PAGE_TITLES[page];

  // Marcar nav activo
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Mostrar loader
  const content = document.getElementById('pageContent');
  content.innerHTML = `<div class="loading-overlay"><div class="spinner-border text-primary"></div></div>`;

  try {
    const res  = await fetch(`/pages/${page}`);
    const html = await res.text();
    content.innerHTML = html;

    // Ejecutar módulo de página si existe
    const mod = PAGE_MODULES[page];
    if (mod && typeof mod.init === 'function') {
      await mod.init();
    }

    currentPage = page;
    history.pushState({ page }, '', `#${page}`);
  } catch (e) {
    content.innerHTML = `<div class="alert alert-danger m-4"><i class="bi bi-exclamation-triangle me-2"></i>Error cargando la página: ${e.message}</div>`;
  }
}

// Escuchar clics en navegación
document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(el.dataset.page);
  });
});

// Sidebar toggle
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const wrapper = document.getElementById('mainWrapper');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
    wrapper.classList.toggle('expanded');
  }
});

// Filtro de fechas global: re-inicializa la página actual
document.getElementById('filterApply')?.addEventListener('click', () => {
  if (currentPage) {
    const mod = PAGE_MODULES[currentPage];
    if (mod && typeof mod.refresh === 'function') mod.refresh();
    else if (mod && typeof mod.init === 'function') mod.init();
  }
});

// Navegación con botones del navegador
window.addEventListener('popstate', (e) => {
  if (e.state?.page) navigate(e.state.page);
});

// Carga inicial según hash
(async function () {
  await initDateFilter();
  const page = location.hash.replace('#', '') || 'dashboard';
  navigate(page);
})();
