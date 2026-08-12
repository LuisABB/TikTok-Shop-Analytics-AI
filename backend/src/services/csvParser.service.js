'use strict';
const { parse } = require('csv-parse');
const { Readable } = require('stream');
const { normalize } = require('./reportDetector.service');

/**
 * Detecta delimitador probable del CSV en base a las primeras lineas.
 * TikTok Shop puede exportar con ',' ';' o tab segun locale/herramienta.
 */
function detectDelimiter(csvContent) {
  const lines = String(csvContent)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 12);

  const candidates = [',', ';', '\t'];
  const scores = new Map(candidates.map(d => [d, 0]));

  for (const line of lines) {
    for (const d of candidates) {
      const count = line.split(d).length - 1;
      scores.set(d, scores.get(d) + Math.max(0, count));
    }
  }

  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const score = scores.get(d);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : ',';
}

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
  { canonical: 'video_id',         patterns: ['video id', 'video_id', 'id del video'] },
  { canonical: 'video_title',      patterns: ['video title', 'video name', 'titulo video', 'content title'] },
  { canonical: 'video_caption',    patterns: ['video caption', 'information', 'informacion del video',
                                               'información del video'] },
  { canonical: 'creator_name',     patterns: ['creator name', 'nombre del creador', 'creator', 'author name'] },
  { canonical: 'creator_id',       patterns: ['creator id', 'id del creador'] },
  { canonical: 'author',           patterns: ['author', 'account', 'autor'] },
  { canonical: 'vv',               patterns: ['vv', 'video views', 'video view', 'vistas del video', 'reproducciones'] },
  { canonical: 'ctor',             patterns: ['ctor', 'click to order rate', 'click-to-order rate'] },
  { canonical: 'gpm',              patterns: ['gpm', 'gmv per 1000', 'revenue per 1000', 'gmv per mille',
                                               'show gpm', 'watch gpm'] },
  { canonical: 'completion_rate',  patterns: ['completion rate', 'tasa de finalizacion', 'tasa de finalización'] },
  { canonical: 'likes',            patterns: ['likes', 'me gusta'] },
  { canonical: 'comments',         patterns: ['comments', 'comentarios'] },
  { canonical: 'shares',           patterns: ['shares', 'compartidos'] },
  { canonical: 'new_followers',    patterns: ['new followers', 'seguidores nuevos', 'followers'] },
  { canonical: 'diagnosis',        patterns: ['diagnosis', 'diagnostico', 'diagnóstico'] },

  // ── LIVE ────────────────────────────────────────────────────────────────────
  { canonical: 'live_id',          patterns: ['live id', 'broadcast id', 'live_id', 'room id'] },
  { canonical: 'live_title',       patterns: ['live title', 'broadcast title', 'titulo live', 'livestream', 'room title'] },
  { canonical: 'start_time',       patterns: ['start time', 'hora de inicio'] },
  { canonical: 'duration',         patterns: ['duration', 'duracion', 'duración'] },
  { canonical: 'viewers',          patterns: ['viewers', 'live viewers', 'avg viewers', 'espectadores', 'views'] },
  { canonical: 'peak_viewers',     patterns: ['peak viewers', 'max viewers', 'pico espectadores'] },
  { canonical: 'duration_min',     patterns: ['duration min', 'live duration'] },
  { canonical: 'avg_viewing_duration', patterns: ['avg viewing duration', 'average viewing duration',
                                                   'duracion vista prom'] },
  { canonical: 'follow_rate',      patterns: ['follow rate', 'tasa de seguidores'] },
  { canonical: 'comment_rate',     patterns: ['comment rate', 'tasa de comentarios'] },
  { canonical: 'share_rate',       patterns: ['share rate', 'tasa de compartidos'] },
  { canonical: 'like_rate',        patterns: ['like rate', 'tasa de me gusta'] },
  { canonical: 'impressions_per_hour', patterns: ['impressions per hour', 'impresiones por hora'] },
  { canonical: 'gmv_per_hour',     patterns: ['gmv per hour', 'gmv por hora'] },

  // ── Afiliados / Creadores ────────────────────────────────────────────────────
  { canonical: 'gross_revenue',    patterns: ['gross revenue', 'ingresos brutos'] },
  { canonical: 'commission',       patterns: ['commission', 'comision', 'comisión'] },
  { canonical: 'unit_sales',       patterns: ['unit sales', 'ventas de unidades', 'units'] },

  // ── Canal ─────────────────────────────────────────────────────────────────────
  { canonical: 'channel',          patterns: ['channel', 'canal', 'tipo de contenido'] },

  // ── Métricas de embudo y conversión (Key Metrics) ─────────────────────────────
  { canonical: 'sku_orders',       patterns: ['pedidos con sku', 'sku orders', 'orders sku'] },
  { canonical: 'items_sold',       patterns: ['articulos vendidos', 'artículos vendidos', 'items sold', 'unidades vendidas'] },
  { canonical: 'aov',              patterns: ['aov', 'average order value', 'valor promedio por pedido',
                                               'ticket promedio'] },
  { canonical: 'add_to_cart_rate', patterns: ['tasa de adicion al carrito', 'tasa de adición al carrito',
                                               'add to cart rate', 'atc rate'] },
  { canonical: 'ctor',             patterns: ['ctor', 'click to order rate', 'tasa de conversion a pedido'] },
  
  // ── Métricas únicas (usuarios únicos) ─────────────────────────────────────────
  { canonical: 'unique_impressions',   patterns: ['impresiones unicas', 'impresiones únicas',
                                                   'unique impressions', 'impresiones unicas de productos'] },
  { canonical: 'unique_clicks',        patterns: ['clics unicos', 'clics únicos', 'unique clicks',
                                                   'clics unicos de productos'] },
  { canonical: 'unique_ctr',           patterns: ['ctr unica', 'ctr única', 'unique ctr'] },
  { canonical: 'unique_add_to_cart_users', patterns: ['usuarios de agregar al carrito', 'unique atc users',
                                                       'usuarios atc'] },
  { canonical: 'unique_add_to_cart_rate',  patterns: ['tasa de atc unica', 'tasa de atc única',
                                                       'unique atc rate'] },
  { canonical: 'unique_ctor',          patterns: ['ctor unica', 'ctor única', 'unique ctor',
                                                   'ctor pedido con sku unica'] },
  
  // ── Métricas financieras avanzadas ────────────────────────────────────────────
  { canonical: 'gmv_with_tax',         patterns: ['gmv con impuestos', 'gmv with tax'] },
  { canonical: 'tax',                  patterns: ['impuesto', 'tax', 'taxes'] },
  { canonical: 'gmv_with_subsidy',     patterns: ['gmv con cofinanciacion', 'gmv con cofinanciación',
                                                   'gmv with subsidy', 'gmv cofinanciacion tiktok'] },
  { canonical: 'shipping_fees',        patterns: ['tarifas de envio', 'tarifas de envío', 'shipping fees',
                                                   'costos de envio'] },
  { canonical: 'refunds',              patterns: ['reembolsos', 'refunds', 'devoluciones'] },
  { canonical: 'refunded_items',       patterns: ['articulos reembolsados', 'artículos reembolsados',
                                                   'refunded items', 'items reembolsados'] },
  { canonical: 'refunded_customers',   patterns: ['clientes reembolsados', 'refunded customers'] },

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
  'hora':    'date',         // "Hora" en exports de TikTok Shop (columna de fecha/día en la mayoría de reportes)
  'id':      'product_id',   // "ID" solo, en product_list exports
  'sku':     'product_id',   // "SKU" solo como cabecera
  'producto':'product_name', // "Producto" solo, columna de nombre de producto
  'alias':   'author',
  'gmv':     'gmv',          // evita que 'gmv por cliente prom'.includes('gmv') lo resuelva como aov
  'clics':   'clicks',       // evita que 'tasa de clics'.includes('clics') lo resuelva como ctr
  'vistas':  'views',        // evita que 'tasa de vistas a clics'.includes('vistas') lo resuelva como ctr
  'vistas de live': 'viewers', // "Vistas de LIVE" = audiencia, no "views" de producto
  // TikTok renombró "VV" → "Vistas del video" en exports recientes; sin esto cae en 'views'
  'vistas del video': 'vv',
  'video views': 'vv',
  'transmisiones live': 'sessions', // "Transmisiones LIVE" = número real de sesiones live del día
  // "Productos" solo (Video Performance List) — no confundir con "impresiones … de productos"
  'productos': 'productos',

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

  // Fix Video Performance List — campos específicos
  'informacion del video':  'video_caption',
  'información del video':  'video_caption',
  'nombre del creador':     'creator_name',
  'id del creador':         'creator_id',
  'id del video':           'video_id',
  'me gusta':               'likes',
  'seguidores nuevos':      'new_followers',
  'tasa de finalizacion de videos': 'completion_rate',
  'tasa de finalización de videos': 'completion_rate',
  'diagnostico':            'diagnosis',
  
  // Fix Live Session List — campos específicos
  'livestream':             'live_title',
  'start time':             'start_time',
  'duration':               'duration',
  'attributed gmv':         'gmv_attributed',
  'attributed items sold':  'items_sold_attributed',
  'attributed orders':      'orders_attributed',
  'avg viewing duration':   'avg_viewing_duration',
  'impressions per hour':   'impressions_per_hour',
  'gmv per hour':           'gmv_per_hour',
  'show gpm':               'show_gpm',
  'watch gpm':              'watch_gpm',
  'follow rate':            'follow_rate',
  'comment rate':           'comment_rate',
  'share rate':             'share_rate',
  'like rate':              'like_rate',
  
  // Fix Creator Product List (Affiliates)
  'product info':           'product_name', // primera columna en algunos exports
  'gross revenue':          'gross_revenue',
  'unit sales':             'unit_sales',

  // Fix Channel Traffic List
  'tipo de contenido':      'channel',
  'live propio':            'channel_live',
  'video propio':           'channel_video',
  'tarjeta de producto propia': 'channel_card',
  'afiliado':               'channel_affiliate',
  
  // Fix Product Traffic Key Metrics
  'pedidos con sku':        'sku_orders',
  'articulos vendidos':     'items_sold',
  'artículos vendidos':     'items_sold',
  'aov pedidos con sku':    'aov',
  'cantidad de adiciones al carrito': 'add_to_cart',
  'tasa de adicion al carrito': 'add_to_cart_rate',
  'tasa de adición al carrito': 'add_to_cart_rate',
  'ctor pedido con sku':    'ctor',
  'impresiones unicas de productos': 'unique_impressions',
  'impresiones únicas de productos': 'unique_impressions',
  'clics unicos':           'unique_clicks',
  'clics únicos':           'unique_clicks',
  'ctr unica':              'unique_ctr',
  'ctr única':              'unique_ctr',
  'usuarios de agregar al carrito': 'unique_add_to_cart_users',
  'tasa de atc unica':      'unique_add_to_cart_rate',
  'tasa de atc única':      'unique_add_to_cart_rate',
  'ctor pedido con sku unica': 'unique_ctor',
  'ctor pedido con sku única': 'unique_ctor',
  'gmv con impuestos':      'gmv_with_tax',
  'impuesto':               'tax',
  'gmv con cofinanciacion de tiktok': 'gmv_with_subsidy',
  'gmv con cofinanciación de tiktok': 'gmv_with_subsidy',
  'tarifas de envio':       'shipping_fees',
  'tarifas de envío':       'shipping_fees',
  'reembolsos':             'refunds',
  'articulos reembolsados': 'refunded_items',
  'artículos reembolsados': 'refunded_items',
  'clientes reembolsados':  'refunded_customers',
  
  // Product Card Traffic Stats - columnas específicas
  'usuario que agrego al carrito': 'add_to_cart_users',
  'clics para agregar al carrito': 'add_to_cart',
  'clics unicos':                  'unique_clicks',

  // Order List (Todo pedido) — columnas del export de órdenes individuales
  'order id':                         'order_id',
  'order status':                     'order_status',
  'order substatus':                  'order_substatus',
  'cancelation return type':          'cancel_type',
  'normal or pre order':              'order_type',
  'sku id':                           'sku_id',
  'seller sku':                       'seller_sku',
  'variation':                        'variation',
  'quantity':                         'quantity',
  'sku unit original price':          'unit_price',
  'sku subtotal before discount':     'subtotal_before_discount',
  'sku platform discount':            'platform_discount',
  'sku seller discount':              'seller_discount',
  'sku subtotal after discount':      'subtotal_after_discount',
  'shipping fee after discount':      'shipping_fee',
  'original shipping fee':            'original_shipping_fee',
  'order amount':                     'order_amount',
  'order refund amount':              'refund_amount',
  'created time':                     'order_created_at',
  'paid time':                        'paid_at',
  'rts time':                         'rts_at',
  'shipped time':                     'shipped_at',
  'delivered time':                   'delivered_at',
  'cancelled time':                   'cancelled_at',
  'cancel by':                        'cancel_by',
  'cancel reason':                    'cancel_reason',
  'fulfillment type':                 'fulfillment_type',
  'warehouse name':                   'warehouse_name',
  'buyer username':                   'buyer_username',
  'buyer message':                    'buyer_message',
  'order channel':                    'order_channel',
  'creator handle':                   'creator_handle',
  'payment method':                   'payment_method',
  'tracking id':                      'tracking_id',
  'delivery option type':             'delivery_option_type',
  'delivery option':                  'delivery_option',
  'shipping provider name':           'shipping_provider',
  'seller note':                      'seller_note',
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
  
  // Guard: columna vacía — retornar marcador temporal
  // (sin este guard, ''.includes(pattern) matchea TODO debido a que cualquier
  // string incluye el string vacío, resultando en falsos positivos)
  if (!norm) return 'empty_column';
  
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
// Cubre: YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
// y las variantes con hora (incluye AM/PM del export de órdenes TikTok)
const DATE_STRING_RE = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(\s\d{1,2}:\d{2}(:\d{2})?)?$|^\d{1,2}[-/]\d{1,2}[-/]\d{4}(\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?)?$/i;

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

  // IDs largos (≥16 dígitos): preservar como string para no perder precisión
  // (Number.MAX_SAFE_INTEGER tiene 16 dígitos; IDs de TikTok tienen 18-19)
  if (/^\d{16,}$/.test(str)) return str;

  // Eliminar prefijo de código de moneda ISO 4217 (p.ej. "MXN 3,121.71" → "3,121.71")
  // y símbolos de moneda ($, €, £, ¥ con hasta 3 letras previas como "MX$")
  const cleaned = str
    .replace(/^[A-Z]{2,3}\s+/, '')       // "MXN ", "USD ", "EUR " al inicio
    .replace(/[A-Z]{0,3}[$€£¥]/g, '')   // "$", "MX$", "€", etc.
    .replace(/,(?=\d{3})/g, '')          // separadores de miles: "3,121" → "3121"
    .replace(',', '.');                   // coma decimal → punto
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
  /^date start:/i,
  /^tipo de contenido:/i,
  /^comparar:/i,
  /^\d{4}-\d{2}-\d{2}\s*~\s*\d{4}-\d{2}-\d{2}/,  // Fechas con o sin salto de línea
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
    
    // 4. Detectar filas de sub-headers agrupados (ej: "Todo", "LIVE del vendedor", "Afiliado")
    //    Estas filas tienen pocas palabras únicas repetidas muchas veces
    if (nonEmpty.length > 10) {
      const uniqueValues = new Set(nonEmpty);
      // Si hay más de 10 celdas no-vacías pero solo 1-5 valores únicos,
      // probablemente son categorías repetidas, no headers reales
      if (uniqueValues.size <= 5) {
        const repeatedLabels = /^(todo|live|video|afiliado|tarjeta|seller|creator|vendedor|product)/i;
        const mostAreLabels = nonEmpty.filter(c => repeatedLabels.test(c)).length / nonEmpty.length;
        if (mostAreLabels > 0.5) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Parsea el contenido de un CSV y devuelve los datos normalizados.
 * Ignora automáticamente filas vacías y de metadatos al inicio del archivo
 * (p.ej. "[Rango de fechas]: …") y detecta la cabecera real.
 * @param {string} csvContent - Contenido del archivo CSV como string
 * @returns {Promise<{ headers: string[], canonicalHeaders: string[], rows: Object[], dateRange: Object|null }>}
 */
async function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const delimiter = detectDelimiter(csvContent);
    const rows = [];
    let headers = [];
    let canonicalHeaders = [];
    const metadataLines = []; // Capturar líneas de metadatos

    const stream = Readable.from([csvContent]);

    stream.pipe(
      parse({
        bom: true,
        trim: true,
        skip_empty_lines: true,
        relax_column_count: true,
        delimiter,
      })
    )
    .on('data', (row) => {
      if (headers.length === 0) {
        // Saltar filas vacías y de metadatos hasta encontrar la cabecera real
        if (isMetadataRow(row)) {
          metadataLines.push(row); // Guardar para extraer fechas
          return;
        }
        headers = row;
        canonicalHeaders = row.map(resolveColumn);
        
        // Manejar duplicados especiales: "Product info, Product info" → product_id, product_name
        // Esto ocurre en Creator Product List donde la primera columna es ID y la segunda nombre
        for (let i = 0; i < canonicalHeaders.length - 1; i++) {
          if (canonicalHeaders[i] === 'product_name' && canonicalHeaders[i + 1] === 'product_name') {
            canonicalHeaders[i] = 'product_id';
            break; // Solo la primera ocurrencia
          }
        }
        
        // Manejar primera columna vacía en reportes de channel traffic
        // Si la primera columna es vacía y hay columnas típicas de métricas, interpretar como 'channel'
        if (canonicalHeaders[0] === 'empty_column') {
          const hasChannelMetrics = canonicalHeaders.includes('gmv') && 
                                   canonicalHeaders.includes('orders') &&
                                   (canonicalHeaders.includes('ctr') || canonicalHeaders.includes('clicks'));
          if (hasChannelMetrics) {
            canonicalHeaders[0] = 'channel';
          }
        }
        
        return;
      }
      const obj = {};
      canonicalHeaders.forEach((col, i) => {
        obj[col] = cleanValue(row[i]);
      });
      rows.push(obj);
    })
    .on('end', () => {
      // Extraer rango de fechas de metadatos
      const dateRange = extractDateRangeFromMetadata(metadataLines, rows);
      resolve({ headers, canonicalHeaders, rows, dateRange });
    })
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

  // XX/XX/YYYY con hora y AM/PM opcionales.
  // Si el 2° componente > 12 → inequívocamente M/D/YYYY (export US de órdenes TikTok).
  // Si el 1° componente > 12 → inequívocamente D/M/YYYY (español).
  // Ambos ≤ 12 → asumir D/M/YYYY (retrocompatibilidad con reportes en español).
  m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(\s+.+)?$/i);
  if (m) {
    const p1 = +m[1], p2 = +m[2], year = +m[3], hasTime = !!m[4];
    if (p2 > 12) {
      // M/D/YYYY — mes=p1, día=p2 (p.ej. "06/24/2026 10:09:42 PM" = 24 jun)
      if (hasTime) {
        const d = new Date(str); // el parser nativo maneja AM/PM
        if (!isNaN(d.getTime())) return d;
      }
      const d = new Date(Date.UTC(year, p1 - 1, p2));
      if (!isNaN(d.getTime())) return d;
    } else {
      // D/M/YYYY (español) o ambiguo — mantener comportamiento original
      const d = new Date(Date.UTC(year, p2 - 1, p1));
      if (!isNaN(d.getTime())) return d;
    }
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
 * Extrae rango de fechas de líneas de metadatos o filas de datos
 * @param {Array[]} metadataLines - Líneas crudas de metadatos
 * @param {Object[]} rows - Filas normalizadas
 * @returns {{ startDate: Date|null, endDate: Date|null }}
 */
function extractDateRangeFromMetadata(metadataLines, rows) {
  // 1. Intentar extraer del header/metadatos
  for (const row of metadataLines) {
    const lineStr = Array.isArray(row) ? row.join(',') : String(row);
    
    // Patrón: "Fecha del análisis: 29/05/2026~04/06/2026" o "29/05/2026 ~ 04/06/2026"
    const rangeMatch = lineStr.match(/(\d{2}\/\d{2}\/\d{4})\s*[~\-]\s*(\d{2}\/\d{2}\/\d{4})/);
    if (rangeMatch) {
      const start = parseDate(rangeMatch[1]);
      const end = parseDate(rangeMatch[2]);
      if (start && end) return { startDate: start, endDate: end };
    }
    
    // Patrón ISO: "2026-05-01 ~ 2026-05-31"
    const isoMatch = lineStr.match(/(\d{4}-\d{2}-\d{2})\s*[~\-]\s*(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const start = parseDate(isoMatch[1]);
      const end = parseDate(isoMatch[2]);
      if (start && end) return { startDate: start, endDate: end };
    }
  }
  
  // 2. Buscar en columna 'date' de las filas
  const dates = rows
    .map(r => r.date)
    .filter(Boolean)
    .map(d => parseDate(d))
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (dates.length === 0) return { startDate: null, endDate: null };
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

// Mantener compatibilidad con código existente
function extractDateRange(rows) {
  return extractDateRangeFromMetadata([], rows);
}

module.exports = { parseCSV, resolveColumn, cleanValue, extractDateRange, parseDate };
