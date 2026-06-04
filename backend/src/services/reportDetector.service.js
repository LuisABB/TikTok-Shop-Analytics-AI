'use strict';

/**
 * Detecta automáticamente el tipo de reporte TikTok Shop
 * analizando las columnas del CSV.
 */

// Normaliza un nombre de columna para comparación uniforme
function normalize(col) {
  return col
    .toLowerCase()
    .trim()
    .replace(/\(.*?\)/g, '')   // quitar paréntesis y su contenido
    .replace(/[_\-/]/g, ' ')   // guiones y barras → espacio
    .replace(/\s+/g, ' ')      // colapsar espacios múltiples
    .trim();
}

// ── Firmas de reporte (columnas canónicas) ────────────────────────────────────
//
// Cada firma usa los NOMBRES CANÓNICOS que produce resolveColumn() en
// csvParser.service.js, lo que permite detectar reportes en español e inglés
// con la misma lógica.
//
// ORDEN DE PRIORIDAD:
//   Firmas más específicas (required más restrictivo) tienen mayor priority.
//   Si dos firmas tienen el mismo score → resultado ambiguous: true.
//
// Columnas canónicas de referencia
// (producidas por resolveColumn en csvParser.service.js):
//   date, product_id, product_name, status, gmv, orders, customers,
//   new_customers, items_sold, aov, impressions, views, clicks, ctr,
//   add_to_cart, add_to_cart_users, conversion_rate, visitors, vv, ctor,
//   gpm, viewers, peak_viewers, duration_min, assigned_chats,
//   resolved_chats, response_rate, satisfaction_rate, avg_response_time,
//   search_impressions, search_clicks, search_ctr, search_orders,
//   search_conversion, search_gmv, keyword
// ─────────────────────────────────────────────────────────────────────────────
const SIGNATURES = [

  // ── Altamente específicos (columnas exclusivas) ───────────────────────────
  {
    type:     'SERVICE_ANALYSIS',
    name:     'Service Analysis',
    // assigned_chats + response_rate son exclusivos de este reporte
    required: ['assigned_chats', 'response_rate'],
    optional: ['satisfaction_rate', 'avg_response_time'],
    priority: 100,
  },
  {
    type:     'VIDEO_PERFORMANCE',
    name:     'Video Performance Core Stats',
    // vv (video views) es exclusivo de video; gpm aparece en video y live
    required: ['vv', 'gpm'],
    optional: ['gmv', 'ctor', 'impressions', 'viewers', 'clicks'],
    priority: 95,
  },
  {
    type:     'LIVE_PERFORMANCE',
    name:     'Live Performance Core Stats',
    // duration_min (duración vista prom.) exclusivo de live; gpm descarta otros
    required: ['duration_min', 'gpm'],
    optional: ['gmv', 'items_sold', 'ctor', 'views', 'customers'],
    priority: 95,
  },
  {
    type:     'PRODUCT_LIST',
    name:     'Product List',
    // status (Estado) sólo aparece en el listado completo de productos
    required: ['product_id', 'product_name', 'status'],
    optional: ['items_sold', 'orders', 'gmv', 'impressions', 'views'],
    priority: 90,
  },
  {
    type:     'SHOP_KEY_METRICS',
    name:     'Shop Analytics - Key Metrics',
    // visitors + impressions + aov juntos sólo en el panel de métricas
    required: ['visitors', 'impressions', 'aov'],
    optional: ['gmv', 'orders', 'customers', 'items_sold', 'views', 'clicks'],
    priority: 90,
  },

  // ── Reportes de tarjetas de productos ────────────────────────────────────
  {
    type:     'PRODUCT_CARD_TRAFFIC',
    name:     'Product Card Traffic Stats',
    // Serie temporal (date) con views + viewers + add_to_cart_users
    // Sin product_id en posición de identificador; no tiene aov ni orders reales
    required: ['date', 'views', 'viewers', 'add_to_cart_users'],
    optional: ['clicks', 'customers', 'gmv', 'conversion_rate', 'ctor'],
    priority: 87,
  },
  {
    type:     'CHANNEL_PRODUCT_SEARCH',
    name:     'Channel Product List - Search',
    // A nivel producto con orders (Pedidos) explícito; sin conversion_rate
    required: ['product_id', 'product_name', 'viewers', 'orders'],
    optional: ['clicks', 'customers', 'gmv'],
    priority: 80,
  },
  {
    type:     'PRODUCTS_CARD_LIST',
    name:     'Products Card List',
    // A nivel producto con viewers pero sin orders explícito
    required: ['product_id', 'product_name', 'viewers'],
    optional: ['views', 'clicks', 'gmv', 'conversion_rate', 'add_to_cart_users'],
    priority: 70,
  },

  // ── Estadísticas de canal / tienda ────────────────────────────────────────
  // CORE_STATS y CHANNEL_STATS_SEARCH tienen estructura idéntica en los exports
  // de TikTok Shop en español → se marcan como ambiguous cuando ambos coinciden.
  {
    type:     'CORE_STATS',
    name:     'Core Stats',
    required: ['date', 'gmv', 'aov', 'orders', 'customers'],
    optional: ['viewers', 'add_to_cart_users', 'conversion_rate'],
    priority: 85,
  },
  {
    type:     'CHANNEL_STATS_SEARCH',
    name:     'Channel Stats - Search',
    required: ['date', 'gmv', 'aov', 'orders', 'customers'],
    optional: ['viewers', 'add_to_cart_users', 'conversion_rate'],
    priority: 85,
  },
  {
    type:     'STORE_PAGE_OVERVIEW',
    name:     'Store Page Performance - Overview',
    required: ['date', 'visitors'],
    optional: ['views', 'conversion_rate', 'gmv', 'orders', 'customers'],
    priority: 80,
  },
];

/**
 * Detecta el tipo de reporte a partir de los headers CRUDOS del CSV.
 * Internamente canonicaliza cada header usando resolveColumn() (lazy import
 * para evitar dependencia circular con csvParser.service.js).
 *
 * @param {string[]} headers - Nombres de columna originales del CSV
 * @returns {{
 *   type:       string,
 *   name:       string,
 *   score:      number,
 *   ambiguous:  boolean,
 *   candidates: Array<{type, name, score}>
 * } | null}
 */
function detectReportType(headers) {
  // Lazy import: evita dependencia circular
  // (csvParser importa normalize de este módulo)
  const { resolveColumn } = require('./csvParser.service');

  // Construir Set de canónicos para búsqueda O(1)
  const colSet = new Set(headers.map(resolveColumn));

  const candidates = [];
  for (const sig of SIGNATURES) {
    const allRequired = sig.required.every(req => colSet.has(req));
    if (!allRequired) continue;

    let score = sig.priority;
    for (const opt of sig.optional) {
      if (colSet.has(opt)) score += 5;
    }
    candidates.push({ type: sig.type, name: sig.name, score });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const topScore = candidates[0].score;

  // Ambigüedad: múltiples candidatos con el mismo score máximo
  const tied = candidates.filter(c => c.score === topScore);
  const ambiguous = tied.length > 1;

  return {
    type:       tied[0].type,
    name:       tied[0].name,
    score:      topScore,
    ambiguous,
    candidates: ambiguous ? tied : [tied[0]],
  };
}

module.exports = { detectReportType, normalize };

