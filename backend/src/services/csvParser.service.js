'use strict';
const { parse } = require('csv-parse');
const fs        = require('fs');
const { normalize } = require('./reportDetector.service');

// ── Mapeo canónico de columnas ────────────────────────────────────────────────
// Cada entrada: [variaciones posibles] → nombre_canonico
//
// ORDEN IMPORTANTE: las entradas más específicas deben ir ANTES que las
// generales (ej. aov antes que gmv, product_name antes que product_id)
// para que el algoritmo de includes no genere falsos positivos.
const COLUMN_MAP = [
  // ── Tiempo ─────────────────────────────────────────────────────────────────
  { canonical: 'date',             patterns: ['date', 'day', 'fecha', 'periodo', 'time'] },

  // ── Producto ────────────────────────────────────────────────────────────────
  // product_name antes de product_id: evita que 'producto' (en "nombre producto")
  // se resuelva como product_id vía el patrón 'producto id'.
  { canonical: 'product_name',     patterns: ['product name', 'item name', 'nombre producto', 'product title',
                                               'nombre del producto'] },
  { canonical: 'product_id',       patterns: ['product id', 'item id', 'producto id',
                                               'id del producto', 'id de producto'] },
  { canonical: 'status',           patterns: ['status', 'estado', 'product status'] },
  { canonical: 'category',         patterns: ['category', 'categoria', 'product category'] },
  { canonical: 'price',            patterns: ['price', 'precio', 'unit price', 'selling price'] },

  // ── Ventas / ingresos ───────────────────────────────────────────────────────
  // aov antes de gmv: "gmv por cliente prom" incluye 'gmv', sin este orden
  // matchearía gmv en lugar de aov.
  { canonical: 'aov',              patterns: ['aov', 'average order value', 'avg order value', 'ticket promedio',
                                               'gmv por cliente prom'] },
  { canonical: 'gmv',              patterns: ['gmv', 'revenue', 'sales amount', 'total revenue', 'total gmv',
                                               'gross merchandise value'] },
  { canonical: 'orders',           patterns: ['orders', 'total orders', 'number of orders', 'order count',
                                               'pedidos'] },
  { canonical: 'customers',        patterns: ['customers', 'buyers', 'unique buyers', 'compradores', 'buyers count',
                                               'clientes'] },
  { canonical: 'new_customers',    patterns: ['new customers', 'new buyers', 'first time buyers',
                                               'nuevos compradores'] },
  { canonical: 'items_sold',       patterns: ['items sold', 'units sold', 'quantity sold', 'unidades vendidas',
                                               'artículos vendidos', 'ventas de artículos'] },

  // ── Tráfico / métricas de contenido ─────────────────────────────────────────
  // conversion_rate antes de impressions: "Tasa de conversión de impresiones a clic"
  // contiene 'impresiones' y matchearía impressions si este entry fuera primero.
  { canonical: 'conversion_rate',  patterns: ['conversion rate', 'cvr', 'tasa de conversion', 'purchase rate',
                                               'tasa de conversión', 'tasa de vista a pago'] },
  { canonical: 'impressions',      patterns: ['impressions', 'product impressions', 'card impressions',
                                               'impresiones'] },
  // ctr antes de views: "tasa de vistas a clics" contiene 'vistas' y matchearía views sin este orden
  { canonical: 'ctr',              patterns: ['ctr', 'click through rate', 'click-through rate', 'tasa de clics',
                                               'tasa de vistas a clics'] },
  { canonical: 'views',            patterns: ['views', 'product views', 'page views', 'vistas'] },
  // add_to_cart antes de clicks: "Clics para agregar al carrito" contiene 'clics' y matchearía clicks
  { canonical: 'add_to_cart',      patterns: ['add to cart', 'add-to-cart', 'cart adds', 'agregar al carrito'] },
  // usuarios únicos que agregaron al carrito (≠ clics) → columnas como
  // "Usuario que agregó al carrito" / "Visitante que agregó al carrito"
  { canonical: 'add_to_cart_users',patterns: ['add to cart users', 'unique add to cart', 'agregó al carrito'] },
  { canonical: 'clicks',           patterns: ['clicks', 'product clicks', 'clics'] },
  { canonical: 'visitors',         patterns: ['visitors', 'unique visitors', 'visitantes', 'store visitors'] },

  // ── Video ───────────────────────────────────────────────────────────────────
  { canonical: 'video_id',         patterns: ['video id', 'video_id'] },
  { canonical: 'video_title',      patterns: ['video title', 'video name', 'titulo video', 'content title'] },
  { canonical: 'author',           patterns: ['author', 'creator', 'account', 'autor'] },
  { canonical: 'vv',               patterns: ['vv', 'video views', 'video view', 'reproducciones'] },
  { canonical: 'ctor',             patterns: ['ctor', 'click to order rate', 'click-to-order rate'] },
  { canonical: 'gpm',              patterns: ['gpm', 'gmv per 1000', 'revenue per 1000', 'gmv per mille'] },

  // ── LIVE ────────────────────────────────────────────────────────────────────
  { canonical: 'live_id',          patterns: ['live id', 'broadcast id', 'live_id'] },
  { canonical: 'live_title',       patterns: ['live title', 'broadcast title', 'titulo live'] },
  { canonical: 'viewers',          patterns: ['viewers', 'live viewers', 'avg viewers', 'espectadores'] },
  { canonical: 'peak_viewers',     patterns: ['peak viewers', 'max viewers', 'pico espectadores'] },
  { canonical: 'duration_min',     patterns: ['duration', 'duration min', 'live duration', 'duracion',
                                               'duración'] },

  // ── Servicio al cliente ──────────────────────────────────────────────────────
  { canonical: 'agent_id',         patterns: ['agent id', 'identificacion del agente',
                                               'identificación del agente', 'identificacion agente'] },
  { canonical: 'assigned_chats',   patterns: ['assigned chats', 'total chats', 'chats assigned',
                                               'chats asignados'] },
  { canonical: 'resolved_chats',   patterns: ['resolved chats', 'chats resolved', 'chats resueltos'] },
  { canonical: 'response_rate',    patterns: ['response rate', 'reply rate', 'tasa de respuesta'] },
  { canonical: 'satisfaction_rate',patterns: ['satisfaction', 'csat', 'satisfaction rate', 'satisfaction score',
                                               'satisfaccion', 'tasa de satisfacción', 'satisfacción'] },
  { canonical: 'avg_response_time',patterns: ['avg response time', 'average response time', 'tiempo de respuesta',
                                               'tiempo promedio'] },

  // ── Búsqueda ─────────────────────────────────────────────────────────────────
  { canonical: 'search_impressions',patterns: ['search impressions', 'search views'] },
  { canonical: 'search_clicks',    patterns: ['search clicks'] },
  { canonical: 'search_ctr',       patterns: ['search ctr', 'search click rate'] },
  { canonical: 'search_orders',    patterns: ['search orders'] },
  { canonical: 'search_conversion',patterns: ['search conversion', 'search cvr'] },
  { canonical: 'search_gmv',       patterns: ['search gmv', 'search revenue'] },
  { canonical: 'keyword',          patterns: ['keyword', 'search term', 'search keyword', 'palabra clave'] },
];

// Mapeo exacto para columnas cuyo nombre normalizado es muy corto o ambiguo y
// podría generar falsos positivos con el algoritmo de includes.
// Clave: resultado de normalize(header). Valor: canonical deseado.
const EXACT_MAP = {
  'hora':    'date',         // "Hora" en exports de TikTok Shop (columna de fecha/día)
  'id':      'product_id',   // "ID" solo, en product_list exports
  'sku':     'product_id',   // "SKU" solo como cabecera
  'producto':'product_name', // "Producto" solo, columna de nombre de producto
  'alias':   'author',
  'gmv':     'gmv',          // evita que 'gmv por cliente prom'.includes('gmv') lo resuelva como aov
  'clics':   'clicks',       // evita que 'tasa de clics'.includes('clics') lo resuelva como ctr
  'vistas':  'views',        // evita que 'tasa de vistas a clics'.includes('vistas') lo resuelva como ctr
  'vistas de live': 'viewers', // "Vistas de LIVE" = audiencia, no "views" de producto
  'transmisiones live': 'sessions', // "Transmisiones LIVE" = número real de sesiones live del día

  // Fix Search/SEO — "Espectadores de productos" son impresiones de búsqueda, no live viewers
  'espectadores de productos': 'impressions',
  // "Tasa de conversión de impresiones a clic" es el CTR real (impresión→clic)
  'tasa de conversión de impresiones a clic': 'ctr',
  // "Tasa de clics por pedidos" es click→orden rate; no contaminar el campo orders
  'tasa de clics por pedidos': 'click_order_rate',

  // Fix Video/Live — anclar GMV al canal directo (no al atribuido ni al indirecto)
  'gmv atribuido al video': 'gmv_attributed',  // no sobreescribe row.gmv
  'gmv indirecto de video': 'gmv_indirect',
  'gmv atribuido a live':   'gmv_attributed',
  'gmv indirecto de live':  'gmv_indirect',

  // Fix Video/Live — anclar Orders al canal directo
  'pedidos con sku atribuidos':           'orders_attributed',
  'pedidos con sku indirectos de videos': 'orders_indirect',
  'pedidos con sku indirectos de live':   'orders_indirect',
};

/**
 * Resuelve el nombre canónico de una columna original del CSV.
 * 1. Coincidencia exacta (EXACT_MAP) para tokens cortos o ambiguos.
 * 2. Recorre COLUMN_MAP con lógica includes bidireccional.
 * @param {string} header - Nombre de columna original
 * @returns {string} - Nombre canónico o el normalizado con guiones bajos
 */
function resolveColumn(header) {
  const norm = normalize(header);
  // 1. Exact override — evita falsos positivos de includes con tokens cortos
  if (Object.prototype.hasOwnProperty.call(EXACT_MAP, norm)) return EXACT_MAP[norm];
  // 2. Includes bidireccional
  for (const entry of COLUMN_MAP) {
    for (const pattern of entry.patterns) {
      if (norm.includes(pattern) || pattern.includes(norm)) {
        return entry.canonical;
      }
    }
  }
  // Fallback: retornar el normalizado con guiones bajos
  return norm.replace(/\s+/g, '_');
}

/**
 * Limpia y convierte un valor de celda CSV a su tipo correcto.
 */
// Patrón de cadena de fecha — no convertir a número
// Cubre: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY (con hora opcional)
const DATE_STRING_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s\d{1,2}:\d{2}(:\d{2})?)?$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}$/;

function cleanValue(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (str === '' || str === '-' || str === '--' || str === 'N/A' || str === 'N/D' || str.toLowerCase() === 'null') return null;

  // Cadenas de fecha — preservar como string para que parseDate las interprete correctamente.
  // Sin este guard, "2026-05-01" se convierte en 2026 vía parseFloat, colapsando todas
  // las filas diarias a la misma fecha en los handlers de upsert.
  if (DATE_STRING_RE.test(str)) return str;

  // Porcentaje → decimal
  if (str.endsWith('%')) {
    const num = parseFloat(str.replace('%', '').replace(',', '.'));
    return isNaN(num) ? null : num / 100;
  }

  // Eliminar símbolo de moneda (incluye prefijo "MX") y separadores de miles
  const cleaned = str.replace(/[A-Z]{0,3}[$€£¥]/g, '').replace(/,(?=\d{3})/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  if (!isNaN(num)) return num;

  return str;
}

// ── Detección de filas de metadatos TikTok Shop ──────────────────────────────
const METADATA_PATTERNS = [
  /^\[rango de fechas\]/i,
  /^rango de fechas/i,
  /^fecha del an[aá]lisis/i,
  /^resumen de los datos/i,
  /^datos diarios/i,
  /^\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}$/,
];

// Celda que parece un valor de dato, no un nombre de columna:
// vacía, guion, número, porcentaje, tiempo ("9sec"), fecha ("May 2, 2026")
const DATA_CELL_RE = /^(-|[\d.]+%?|[\d].*sec|[A-Z][a-z]+ \d+, \d{4})$/;

/**
 * Devuelve true si la fila es vacía, de metadatos, o un bloque de datos
 * de resumen que debe ignorarse antes de llegar a la cabecera real.
 *
 * Caso especial: Store Page Performance inserta una fila de totales
 * (primera celda vacía, resto numérico) entre "Resumen de los datos" y
 * la cabecera real "Fecha, GMV, ...".
 */
function isMetadataRow(row) {
  // 1. Fila completamente vacía
  if (row.every(cell => !cell || String(cell).trim() === '')) return true;

  const firstCell = String(row[0] || '').trim();

  // 2. Patrón de metadato conocido en la primera celda
  if (METADATA_PATTERNS.some(p => p.test(firstCell))) return true;

  // 3. Primera celda vacía y todas las celdas no-vacías parecen datos numéricos
  //    → fila de resumen/totales, no una cabecera real
  if (!firstCell) {
    const nonEmpty = row.map(c => String(c || '').trim()).filter(Boolean);
    if (nonEmpty.length > 0 && nonEmpty.every(c => DATA_CELL_RE.test(c))) {
      return true;
    }
  }

  return false;
}

/**
 * Parsea un archivo CSV y devuelve los datos normalizados.
 * Ignora automáticamente filas vacías y de metadatos al inicio del archivo
 * (p.ej. "[Rango de fechas]: …") y detecta la cabecera real.
 * @param {string} filePath - Ruta al archivo CSV
 * @returns {Promise<{ headers: string[], canonicalHeaders: string[], rows: Object[] }>}
 */
async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = [];
    let canonicalHeaders = [];

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });

    stream.pipe(
      parse({
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
      })
    )
    .on('data', (row) => {
      if (headers.length === 0) {
        // Saltar filas vacías y de metadatos hasta encontrar la cabecera real
        if (isMetadataRow(row)) return;
        headers = row;
        canonicalHeaders = row.map(resolveColumn);
        return;
      }
      const obj = {};
      canonicalHeaders.forEach((col, i) => {
        obj[col] = cleanValue(row[i]);
      });
      rows.push(obj);
    })
    .on('end', () => resolve({ headers, canonicalHeaders, rows }))
    .on('error', reject);
  });
}

/**
 * Parsea fechas en los formatos comunes de exportación de TikTok Shop.
 * Soporta: YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY, y el nativo.
 * @param {*} raw
 * @returns {Date|null}
 */
function parseDate(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a') return null;

  // YYYY-MM-DD o YYYY/MM/DD
  let m = str.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD/MM/YYYY (formato europeo/español de TikTok Shop — p.ej. "01/05/2026" = 1 de mayo)
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // DD-MM-YYYY
  m = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback al parser nativo
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  return null;
}

/**
 * Intenta detectar el rango de fechas de los datos.
 * @param {Object[]} rows - Filas normalizadas
 * @returns {{ startDate: Date|null, endDate: Date|null }}
 */
function extractDateRange(rows) {
  const dates = rows
    .map(r => r.date)
    .filter(Boolean)
    .map(d => parseDate(d))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (dates.length === 0) return { startDate: null, endDate: null };
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

module.exports = { parseCSV, resolveColumn, cleanValue, extractDateRange, parseDate };
