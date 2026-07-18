'use strict';
const fs      = require('fs');
const { PrismaClient } = require('@prisma/client');
const { parseCSV, extractDateRange, parseDate } = require('../services/csvParser.service');
const { detectReportType }           = require('../services/reportDetector.service');

const prisma = new PrismaClient();

// Lee CSV soportando UTF-8 y UTF-16 (comun al guardar desde Excel).
function readCSVFileContent(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer || buffer.length === 0) return '';

  // BOM UTF-16 LE/BE
  const hasUtf16LEBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const hasUtf16BEBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;

  if (hasUtf16LEBom || hasUtf16BEBom) {
    // Node no decodifica utf16be directamente; la gran mayoria de exports usan LE.
    return buffer.toString('utf16le');
  }

  // Heuristica: si hay muchos null bytes en posiciones impares, probablemente es UTF-16 LE.
  const sampleLen = Math.min(buffer.length, 4096);
  let nullOdd = 0;
  let oddCount = 0;
  for (let i = 1; i < sampleLen; i += 2) {
    oddCount++;
    if (buffer[i] === 0x00) nullOdd++;
  }

  if (oddCount > 0 && (nullOdd / oddCount) > 0.2) {
    return buffer.toString('utf16le');
  }

  return buffer.toString('utf8');
}

// ── Limpia el archivo temporal en disco ───────────────────────────────────────
function cleanup(filePath) {
  try { fs.unlinkSync(filePath); } catch (_e) { /* ignorar */ }
}

// ── Handlers por tipo de reporte ──────────────────────────────────────────────

async function handleCoreStats(rows) {
  let saved = 0;
  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;

    await prisma.coreMetric.upsert({
      where: { report_date: date },
      update: {
        gmv:              row.gmv          ?? undefined,
        orders:           row.orders       != null ? Math.round(row.orders)       : undefined,
        customers:        row.customers    != null ? Math.round(row.customers)    : undefined,
        items_sold:       row.items_sold   != null ? Math.round(row.items_sold)   : undefined,
        aov:              row.aov ? row.aov : undefined,
        new_customers:    row.new_customers != null ? Math.round(row.new_customers) : undefined,
        impressions:      row.viewers      != null ? Math.round(row.viewers)      : undefined,
        clicks:           row.clicks       != null ? Math.round(row.clicks)       : undefined,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : undefined,
        conversion_rate:  row.conversion_rate ?? undefined,
      },
      create: {
        report_date:      date,
        gmv:              row.gmv          ?? null,
        orders:           row.orders       != null ? Math.round(row.orders)       : null,
        customers:        row.customers    != null ? Math.round(row.customers)    : null,
        items_sold:       row.items_sold   != null ? Math.round(row.items_sold)   : null,
        aov:              row.aov ? row.aov : null,
        new_customers:    row.new_customers != null ? Math.round(row.new_customers) : null,
        impressions:      row.viewers      != null ? Math.round(row.viewers)      : null,
        clicks:           row.clicks       != null ? Math.round(row.clicks)       : null,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : null,
        conversion_rate:  row.conversion_rate ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleStoreOverview(rows) {
  let saved = 0;
  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;

    await prisma.storeMetric.upsert({
      where: { report_date: date },
      update: {
        visitors:        row.visitors   != null ? Math.round(row.visitors)   : undefined,
        page_views:      row.views      != null ? Math.round(row.views)      : undefined,
        conversion_rate: row.conversion_rate ?? undefined,
        gmv:             row.gmv        ?? undefined,
        orders:          row.orders     != null ? Math.round(row.orders)     : undefined,
        customers:       row.customers  != null ? Math.round(row.customers)  : undefined,
        ctr:             row.ctr        ?? undefined,
      },
      create: {
        report_date:     date,
        visitors:        row.visitors   != null ? Math.round(row.visitors)   : null,
        page_views:      row.views      != null ? Math.round(row.views)      : null,
        conversion_rate: row.conversion_rate ?? null,
        gmv:             row.gmv        ?? null,
        orders:          row.orders     != null ? Math.round(row.orders)     : null,
        customers:       row.customers  != null ? Math.round(row.customers)  : null,
        ctr:             row.ctr        ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleProductList(rows, fallbackDate) {
  let saved = 0;
  const reportDate = fallbackDate || new Date();
  for (const row of rows) {
    if (!row.product_id) continue;
    await prisma.product.upsert({
      where: { product_id: String(row.product_id) },
      update: {
        product_name: row.product_name ?? undefined,
        status:       row.status       ?? undefined,
        category:     row.category     ?? undefined,
        price:        row.price        ?? undefined,
      },
      create: {
        product_id:   String(row.product_id),
        product_name: row.product_name ?? 'Sin nombre',
        status:       row.status       ?? null,
        category:     row.category     ?? null,
        price:        row.price        ?? null,
      },
    });

    // Save aggregated channel metrics for the report period
    const hasMetrics = row.gmv != null || row.orders != null || row.impressions != null;
    if (hasMetrics) {
      await prisma.productMetric.upsert({
        where: { product_id_report_date_channel: {
          product_id: String(row.product_id),
          report_date: reportDate,
          channel: 'all',
        }},
        update: {
          gmv:             row.gmv             ?? undefined,
          orders:          row.orders          != null ? Math.round(row.orders)      : undefined,
          customers:       row.customers       != null ? Math.round(row.customers)   : undefined,
          impressions:     row.impressions     != null ? Math.round(row.impressions) : undefined,
          views:           row.views           != null ? Math.round(row.views)       : undefined,
          clicks:          row.clicks          != null ? Math.round(row.clicks)      : undefined,
          add_to_cart:     row.add_to_cart     != null ? Math.round(row.add_to_cart) : undefined,
          conversion_rate: row.conversion_rate ?? undefined,
          ctr:             row.ctr             ?? undefined,
        },
        create: {
          product_id:      String(row.product_id),
          report_date:     reportDate,
          channel:         'all',
          gmv:             row.gmv             ?? null,
          orders:          row.orders          != null ? Math.round(row.orders)      : null,
          customers:       row.customers       != null ? Math.round(row.customers)   : null,
          impressions:     row.impressions     != null ? Math.round(row.impressions) : null,
          views:           row.views           != null ? Math.round(row.views)       : null,
          clicks:          row.clicks          != null ? Math.round(row.clicks)      : null,
          add_to_cart:     row.add_to_cart     != null ? Math.round(row.add_to_cart) : null,
          conversion_rate: row.conversion_rate ?? null,
          ctr:             row.ctr             ?? null,
        },
      });
    }

    saved++;
  }
  return saved;
}

/**
 * Handler para Product Traffic Key Metrics - Reporte completo con métricas avanzadas
 * Incluye: métricas únicas, embudo completo, datos fiscales, reembolsos
 */
async function handleProductTrafficKeyMetrics(rows, fallbackDate) {
  let saved = 0;
  const reportDate = fallbackDate || new Date();
  
  for (const row of rows) {
    if (!row.product_id) continue;
    
    // Upsert product info first
    await prisma.product.upsert({
      where: { product_id: String(row.product_id) },
      update: {
        product_name: row.product_name ?? undefined,
        status:       row.status       ?? undefined,
        category:     row.category     ?? undefined,
        price:        row.price        ?? undefined,
      },
      create: {
        product_id:   String(row.product_id),
        product_name: row.product_name ?? 'Sin nombre',
        status:       row.status       ?? null,
        category:     row.category     ?? null,
        price:        row.price        ?? null,
      },
    });

    // Save complete metrics with all extended fields
    await prisma.productMetric.upsert({
      where: { product_id_report_date_channel: {
        product_id: String(row.product_id),
        report_date: reportDate,
        channel: 'all',
      }},
      update: {
        // Ventas básicas
        gmv:                     row.gmv                     ?? undefined,
        orders:                  row.orders                  != null ? Math.round(row.orders)      : undefined,
        sku_orders:              row.sku_orders              != null ? Math.round(row.sku_orders)  : undefined,
        items_sold:              row.items_sold              != null ? Math.round(row.items_sold)  : undefined,
        customers:               row.customers               != null ? Math.round(row.customers)   : undefined,
        aov:                     row.aov                     ?? undefined,
        
        // Tráfico total
        impressions:             row.impressions             != null ? Math.round(row.impressions) : undefined,
        views:                   row.views                   != null ? Math.round(row.views)       : undefined,
        clicks:                  row.clicks                  != null ? Math.round(row.clicks)      : undefined,
        add_to_cart:             row.add_to_cart             != null ? Math.round(row.add_to_cart) : undefined,
        ctr:                     row.ctr                     ?? undefined,
        add_to_cart_rate:        row.add_to_cart_rate        ?? undefined,
        ctor:                    row.ctor                    ?? undefined,
        conversion_rate:         row.conversion_rate         ?? undefined,
        
        // Métricas únicas
        unique_impressions:      row.unique_impressions      != null ? Math.round(row.unique_impressions)      : undefined,
        unique_clicks:           row.unique_clicks           != null ? Math.round(row.unique_clicks)           : undefined,
        unique_ctr:              row.unique_ctr              ?? undefined,
        unique_add_to_cart_users:row.unique_add_to_cart_users!= null ? Math.round(row.unique_add_to_cart_users): undefined,
        unique_add_to_cart_rate: row.unique_add_to_cart_rate ?? undefined,
        unique_ctor:             row.unique_ctor             ?? undefined,
        
        // Financieras
        gmv_with_tax:            row.gmv_with_tax            ?? undefined,
        tax:                     row.tax                     ?? undefined,
        gmv_with_subsidy:        row.gmv_with_subsidy        ?? undefined,
        shipping_fees:           row.shipping_fees           ?? undefined,
        
        // Devoluciones
        refunds:                 row.refunds                 ?? undefined,
        refunded_items:          row.refunded_items          != null ? Math.round(row.refunded_items)     : undefined,
        refunded_customers:      row.refunded_customers      != null ? Math.round(row.refunded_customers) : undefined,
      },
      create: {
        product_id:              String(row.product_id),
        report_date:             reportDate,
        channel:                 'all',
        
        // Ventas básicas
        gmv:                     row.gmv                     ?? null,
        orders:                  row.orders                  != null ? Math.round(row.orders)      : null,
        sku_orders:              row.sku_orders              != null ? Math.round(row.sku_orders)  : null,
        items_sold:              row.items_sold              != null ? Math.round(row.items_sold)  : null,
        customers:               row.customers               != null ? Math.round(row.customers)   : null,
        aov:                     row.aov                     ?? null,
        
        // Tráfico total
        impressions:             row.impressions             != null ? Math.round(row.impressions) : null,
        views:                   row.views                   != null ? Math.round(row.views)       : null,
        clicks:                  row.clicks                  != null ? Math.round(row.clicks)      : null,
        add_to_cart:             row.add_to_cart             != null ? Math.round(row.add_to_cart) : null,
        ctr:                     row.ctr                     ?? null,
        add_to_cart_rate:        row.add_to_cart_rate        ?? null,
        ctor:                    row.ctor                    ?? null,
        conversion_rate:         row.conversion_rate         ?? null,
        
        // Métricas únicas
        unique_impressions:      row.unique_impressions      != null ? Math.round(row.unique_impressions)      : null,
        unique_clicks:           row.unique_clicks           != null ? Math.round(row.unique_clicks)           : null,
        unique_ctr:              row.unique_ctr              ?? null,
        unique_add_to_cart_users:row.unique_add_to_cart_users!= null ? Math.round(row.unique_add_to_cart_users): null,
        unique_add_to_cart_rate: row.unique_add_to_cart_rate ?? null,
        unique_ctor:             row.unique_ctor             ?? null,
        
        // Financieras
        gmv_with_tax:            row.gmv_with_tax            ?? null,
        tax:                     row.tax                     ?? null,
        gmv_with_subsidy:        row.gmv_with_subsidy        ?? null,
        shipping_fees:           row.shipping_fees           ?? null,
        
        // Devoluciones
        refunds:                 row.refunds                 ?? null,
        refunded_items:          row.refunded_items          != null ? Math.round(row.refunded_items)     : null,
        refunded_customers:      row.refunded_customers      != null ? Math.round(row.refunded_customers) : null,
      },
    });

    saved++;
  }
  return saved;
}

async function handleProductCardTraffic(rows, reportDate) {
  let saved = 0;
  const fallbackDate = reportDate || new Date();

  for (const row of rows) {
    if (!row.product_id) continue;
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;

    // Asegurar que el producto exista
    await prisma.product.upsert({
      where: { product_id: String(row.product_id) },
      update: { product_name: row.product_name ?? undefined },
      create: { product_id: String(row.product_id), product_name: row.product_name ?? 'Sin nombre' },
    });

    await prisma.productMetric.upsert({
      where: { product_id_report_date_channel: {
        product_id: String(row.product_id),
        report_date: date,
        channel: 'all',
      }},
      update: {
        gmv:             row.gmv             ?? undefined,
        orders:          row.orders          != null ? Math.round(row.orders)         : undefined,
        customers:       row.customers       != null ? Math.round(row.customers)      : undefined,
        impressions:     row.impressions     != null ? Math.round(row.impressions)    : undefined,
        views:           row.views           != null ? Math.round(row.views)          : undefined,
        clicks:          row.clicks          != null ? Math.round(row.clicks)         : undefined,
        add_to_cart:     row.add_to_cart     != null ? Math.round(row.add_to_cart)    : undefined,
        conversion_rate: row.conversion_rate ?? undefined,
        ctr:             row.ctr             ?? undefined,
      },
      create: {
        product_id:      String(row.product_id),
        report_date:     date,
        channel:         'all',
        gmv:             row.gmv             ?? null,
        orders:          row.orders          != null ? Math.round(row.orders)         : null,
        customers:       row.customers       != null ? Math.round(row.customers)      : null,
        impressions:     row.impressions     != null ? Math.round(row.impressions)    : null,
        views:           row.views           != null ? Math.round(row.views)          : null,
        clicks:          row.clicks          != null ? Math.round(row.clicks)         : null,
        add_to_cart:     row.add_to_cart     != null ? Math.round(row.add_to_cart)    : null,
        conversion_rate: row.conversion_rate ?? null,
        ctr:             row.ctr             ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleVideoPerformance(rows, reportDate) {
  let saved = 0;
  const fallbackDate = reportDate || new Date();

  for (const row of rows) {
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;
    await prisma.videoMetric.create({
      data: {
        report_date: date,
        video_id:    row.video_id    ? String(row.video_id)    : null,
        video_title: row.video_title ? String(row.video_title) : null,
        author:      row.author      ? String(row.author)      : null,
        vv:          row.vv          != null ? Math.round(row.vv)     : null,
        ctr:         row.ctr         ?? null,
        ctor:        row.ctor        ?? null,
        gmv:         row.gmv         ?? null,
        orders:      row.orders      != null ? Math.round(row.orders) : null,
        gpm:         row.gpm         ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleLivePerformance(rows, reportDate) {
  let saved = 0;
  const fallbackDate = reportDate || new Date();

  for (const row of rows) {
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;
    await prisma.liveMetric.create({
      data: {
        report_date:  date,
        live_id:      row.live_id    ? String(row.live_id)    : null,
        live_title:   row.live_title ? String(row.live_title) : null,
        viewers:      row.viewers    != null ? Math.round(row.viewers)      : null,
        peak_viewers: row.peak_viewers != null ? Math.round(row.peak_viewers) : null,
        sessions:     row.sessions    != null ? Math.round(row.sessions)     : null,
        ctr:          row.ctr        ?? null,
        ctor:         row.ctor       ?? null,
        gmv:          row.gmv        ?? null,
        orders:       row.orders     != null ? Math.round(row.orders)       : null,
        gpm:          row.gpm        ?? null,
        duration_sec: row.duration_min != null ? Math.round(row.duration_min) : null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleServiceAnalysis(rows) {
  let saved = 0;
  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;

    // agent_id viene de "Identificación del agente"; usar '' como fallback para
    // que el unique index (report_date, agent_id) funcione con filas sin agente.
    const agentId    = row.agent_id ? String(row.agent_id) : '';
    const agentAlias = row.author   ? String(row.author)   : null; // "Alias" → canonical 'author'

    await prisma.serviceMetric.upsert({
      where: { report_date_agent_id: { report_date: date, agent_id: agentId } },
      update: {
        agent_alias:         agentAlias ?? undefined,
        assigned_chats:      row.assigned_chats    != null ? Math.round(row.assigned_chats)   : undefined,
        resolved_chats:      row.resolved_chats    != null ? Math.round(row.resolved_chats)   : undefined,
        response_rate:       row.response_rate     ?? undefined,
        satisfaction_rate:   row.satisfaction_rate ?? undefined,
        avg_response_time_s: row.avg_response_time ?? undefined,
      },
      create: {
        report_date:         date,
        agent_id:            agentId,
        agent_alias:         agentAlias,
        assigned_chats:      row.assigned_chats    != null ? Math.round(row.assigned_chats)   : null,
        resolved_chats:      row.resolved_chats    != null ? Math.round(row.resolved_chats)   : null,
        response_rate:       row.response_rate     ?? null,
        satisfaction_rate:   row.satisfaction_rate ?? null,
        avg_response_time_s: row.avg_response_time ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleChannelSearchStats(rows) {
  let saved = 0;
  for (const row of rows) {
    const date = parseDate(row.date);
    if (!date) continue;

    // "Espectadores de productos" → ahora mapea a canonical 'impressions' directamente (EXACT_MAP)
    const impressions = row.impressions ?? null;
    const add_to_cart_u  = row.add_to_cart_users ?? null;

    await prisma.channelSearchMetric.upsert({
      where: { report_date: date },
      update: {
        gmv:              row.gmv              ?? undefined,
        aov:              row.aov ? row.aov : undefined,
        orders:           row.orders           != null ? Math.round(row.orders)    : undefined,
        customers:        row.customers        != null ? Math.round(row.customers) : undefined,
        impressions:      impressions          != null ? Math.round(impressions)   : undefined,
        clicks:           row.clicks           != null ? Math.round(row.clicks)    : undefined,
        add_to_cart_users: add_to_cart_u       != null ? Math.round(add_to_cart_u) : undefined,
        conversion_rate:  row.conversion_rate  ?? undefined,
        ctr:              row.ctr              ?? undefined,
      },
      create: {
        report_date:      date,
        gmv:              row.gmv              ?? null,
        aov:              row.aov ? row.aov : null,
        orders:           row.orders           != null ? Math.round(row.orders)    : null,
        customers:        row.customers        != null ? Math.round(row.customers) : null,
        impressions:      impressions          != null ? Math.round(impressions)   : null,
        clicks:           row.clicks           != null ? Math.round(row.clicks)    : null,
        add_to_cart_users: add_to_cart_u       != null ? Math.round(add_to_cart_u) : null,
        conversion_rate:  row.conversion_rate  ?? null,
        ctr:              row.ctr              ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleProductCardTrafficAggregated(rows, reportDate) {
  let saved = 0;
  const fallbackDate = reportDate || new Date();

  for (const row of rows) {
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;

    await prisma.productCardDailyMetric.upsert({
      where: { report_date: date },
      update: {
        views:            row.views            != null ? Math.round(row.views)            : undefined,
        viewers:          row.viewers          != null ? Math.round(row.viewers)          : undefined,
        clicks:           row.clicks           != null ? Math.round(row.clicks)           : undefined,
        add_to_cart:      row.add_to_cart      != null ? Math.round(row.add_to_cart)      : undefined,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : undefined,
        customers:        row.customers        != null ? Math.round(row.customers)        : undefined,
        orders:           row.orders           != null ? Math.round(row.orders)           : undefined,
        gmv:              row.gmv              ?? undefined,
        conversion_rate:  row.conversion_rate  ?? undefined,
        ctr:              row.ctr              ?? undefined,
      },
      create: {
        report_date:      date,
        views:            row.views            != null ? Math.round(row.views)            : null,
        viewers:          row.viewers          != null ? Math.round(row.viewers)          : null,
        clicks:           row.clicks           != null ? Math.round(row.clicks)           : null,
        add_to_cart:      row.add_to_cart      != null ? Math.round(row.add_to_cart)      : null,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : null,
        customers:        row.customers        != null ? Math.round(row.customers)        : null,
        orders:           row.orders           != null ? Math.round(row.orders)           : null,
        gmv:              row.gmv              ?? null,
        conversion_rate:  row.conversion_rate  ?? null,
        ctr:              row.ctr              ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleSearchStats(rows, reportDate) {
  let saved = 0;
  const fallbackDate = reportDate || new Date();

  for (const row of rows) {
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;

    // Asegurar producto si viene con product_id
    if (row.product_id) {
      await prisma.product.upsert({
        where: { product_id: String(row.product_id) },
        update: { product_name: row.product_name ?? undefined },
        create: { product_id: String(row.product_id), product_name: row.product_name ?? 'Sin nombre' },
      });
    }

    const impressions = (row.search_impressions ?? row.impressions) != null
      ? Math.round(row.search_impressions ?? row.impressions) : null;
    const clicks = (row.search_clicks ?? row.clicks) != null
      ? Math.round(row.search_clicks ?? row.clicks) : null;
    const orders = (row.search_orders ?? row.orders) != null
      ? Math.round(row.search_orders ?? row.orders) : null;
    const gmv = row.search_gmv ?? row.gmv ?? null;

    // TikTok exporta "-" cuando no hay tráfico; no crear filas vacías que oculten datos reales
    const hasMetrics = impressions != null || clicks != null
      || (orders != null && orders > 0) || (gmv != null && Number(gmv) > 0);
    if (!hasMetrics) continue;

    await prisma.searchMetric.create({
      data: {
        report_date:     date,
        product_id:      row.product_id ? String(row.product_id) : null,
        keyword:         row.keyword    ? String(row.keyword)    : null,
        impressions,
        clicks,
        ctr:             row.search_ctr ?? row.ctr ?? null,
        orders,
        conversion_rate: row.search_conversion ?? row.conversion_rate ?? null,
        gmv,
      },
    });
    saved++;
  }
  return saved;
}

// ──────────────────────────────────────────────────────────────────────────────
// NUEVOS HANDLERS PARA REPORTES ADICIONALES
// ──────────────────────────────────────────────────────────────────────────────

async function handleVideoPerformanceList(rows) {
  let saved = 0;
  for (const row of rows) {
    if (!row.video_id) continue;
    
    // Parsear fecha de publicación
    const publishedAt = parseDate(row.hora || row.start_time || row.published_at);
    if (!publishedAt) continue;

    // Parsear productos del campo "Productos" (formato: "Nombre(ID)")
    const productsField = row.productos || row.products || '';
    const productMatch = productsField.match(/\((\d+)\)/);
    const productId = productMatch ? productMatch[1] : null;

    await prisma.video.upsert({
      where: { video_id: String(row.video_id) },
      update: {
        video_title:         row.video_title ?? undefined,
        video_caption:       row.video_caption ?? row.informacion_del_video ?? undefined,
        creator_name:        row.creator_name ?? row.nombre_del_creador ?? undefined,
        creator_id:          (row.creator_id || row.id_del_creador) != null ? String(row.creator_id ?? row.id_del_creador) : undefined,
        vv:                  row.vv != null ? Math.round(row.vv) : undefined,
        completion_rate:     row.completion_rate ?? row.tasa_de_finalizacion ?? undefined,
        likes:               row.likes != null ? Math.round(row.likes) : undefined,
        comments:            row.comments != null ? Math.round(row.comments) : undefined,
        shares:              row.shares != null ? Math.round(row.shares) : undefined,
        new_followers:       row.new_followers != null ? Math.round(row.new_followers) : undefined,
        product_impressions: row.product_impressions != null ? Math.round(row.product_impressions) : undefined,
        product_clicks:      row.product_clicks != null ? Math.round(row.product_clicks) : undefined,
        ctr:                 row.ctr ?? undefined,
        ctor:                row.ctor ?? undefined,
        gmv:                 row.gmv ?? undefined,
        orders:              row.orders != null ? Math.round(row.orders) : undefined,
        gpm:                 row.gpm ?? undefined,
        video_to_live_clicks: row.video_to_live_clicks != null ? Math.round(row.video_to_live_clicks) : undefined,
        video_to_live_rate:  row.video_to_live_rate ?? row.tasa_video_a_transmision ?? undefined,
        diagnosis:           row.diagnosis ?? row.diagnostico ?? undefined,
      },
      create: {
        video_id:            String(row.video_id),
        video_title:         row.video_title ?? null,
        video_caption:       row.video_caption ?? row.informacion_del_video ?? null,
        creator_name:        row.creator_name ?? row.nombre_del_creador ?? null,
        creator_id:          (row.creator_id || row.id_del_creador) != null ? String(row.creator_id ?? row.id_del_creador) : null,
        published_at:        publishedAt,
        vv:                  row.vv != null ? Math.round(row.vv) : null,
        completion_rate:     row.completion_rate ?? row.tasa_de_finalizacion ?? null,
        likes:               row.likes != null ? Math.round(row.likes) : null,
        comments:            row.comments != null ? Math.round(row.comments) : null,
        shares:              row.shares != null ? Math.round(row.shares) : null,
        new_followers:       row.new_followers != null ? Math.round(row.new_followers) : null,
        product_impressions: row.product_impressions != null ? Math.round(row.product_impressions) : null,
        product_clicks:      row.product_clicks != null ? Math.round(row.product_clicks) : null,
        ctr:                 row.ctr ?? null,
        ctor:                row.ctor ?? null,
        gmv:                 row.gmv ?? null,
        orders:              row.orders != null ? Math.round(row.orders) : null,
        gpm:                 row.gpm ?? null,
        video_to_live_clicks: row.video_to_live_clicks != null ? Math.round(row.video_to_live_clicks) : null,
        video_to_live_rate:  row.video_to_live_rate ?? row.tasa_video_a_transmision ?? null,
        diagnosis:           row.diagnosis ?? row.diagnostico ?? null,
      },
    });

    // Crear relación video-producto si existe
    if (productId) {
      await prisma.videoProduct.upsert({
        where: { 
          video_id_product_id: {
            video_id: String(row.video_id),
            product_id: String(productId)
          }
        },
        update: {},
        create: {
          video_id: String(row.video_id),
          product_id: String(productId),
        },
      }).catch(() => {}); // Ignorar si el producto no existe aún
    }

    saved++;
  }
  return saved;
}

async function handleLiveSessionList(rows) {
  let saved = 0;
  for (const row of rows) {
    // Parsear fecha de inicio
    const startTime = parseDate(row.start_time || row.hora);
    if (!startTime) continue;

    // Generar ID único si no existe
    const liveId = row.live_id || `${startTime.getTime()}_${row.live_title || 'session'}`;

    await prisma.liveSession.upsert({
      where: { live_id: String(liveId) },
      update: {
        session_title:            row.live_title ?? row.livestream ?? undefined,
        duration_sec:             row.duration != null ? Math.round(row.duration) : undefined,
        viewers:                  row.viewers != null ? Math.round(row.viewers) : undefined,
        avg_viewing_duration_sec: row.avg_viewing_duration ?? undefined,
        avg_viewing_per_viewer:   row.avg_viewing_per_viewer ?? undefined,
        likes:                    row.likes != null ? Math.round(row.likes) : undefined,
        comments:                 row.comments != null ? Math.round(row.comments) : undefined,
        shares:                   row.shares != null ? Math.round(row.shares) : undefined,
        new_followers:            row.new_followers != null ? Math.round(row.new_followers) : undefined,
        follow_rate:              row.follow_rate ?? undefined,
        comment_rate:             row.comment_rate ?? undefined,
        share_rate:               row.share_rate ?? undefined,
        like_rate:                row.like_rate ?? undefined,
        product_impressions:      row.product_impressions != null ? Math.round(row.product_impressions) : undefined,
        product_clicks:           row.product_clicks != null ? Math.round(row.product_clicks) : undefined,
        impressions_per_hour:     row.impressions_per_hour != null ? Math.round(row.impressions_per_hour) : undefined,
        gmv:                      row.gmv ?? undefined,
        gmv_per_hour:             row.gmv_per_hour ?? undefined,
        show_gpm:                 row.show_gpm ?? undefined,
        watch_gpm:                row.watch_gpm ?? undefined,
        orders:                   row.orders != null ? Math.round(row.orders) : undefined,
        items_sold:               row.items_sold != null ? Math.round(row.items_sold) : undefined,
        customers:                row.customers != null ? Math.round(row.customers) : undefined,
        aov:                      row.aov ?? undefined,
        ctr:                      row.ctr ?? undefined,
        ctor:                     row.ctor ?? undefined,
        ads_roas:                 row.ads_roas ?? undefined,
        ads_cost:                 row.ads_cost ?? undefined,
        ads_gmv:                  row.ads_gmv ?? undefined,
      },
      create: {
        live_id:                  String(liveId),
        session_title:            row.live_title ?? row.livestream ?? null,
        start_time:               startTime,
        duration_sec:             row.duration != null ? Math.round(row.duration) : null,
        viewers:                  row.viewers != null ? Math.round(row.viewers) : null,
        avg_viewing_duration_sec: row.avg_viewing_duration ?? null,
        avg_viewing_per_viewer:   row.avg_viewing_per_viewer ?? null,
        likes:                    row.likes != null ? Math.round(row.likes) : null,
        comments:                 row.comments != null ? Math.round(row.comments) : null,
        shares:                   row.shares != null ? Math.round(row.shares) : null,
        new_followers:            row.new_followers != null ? Math.round(row.new_followers) : null,
        follow_rate:              row.follow_rate ?? null,
        comment_rate:             row.comment_rate ?? null,
        share_rate:               row.share_rate ?? null,
        like_rate:                row.like_rate ?? null,
        product_impressions:      row.product_impressions != null ? Math.round(row.product_impressions) : null,
        product_clicks:           row.product_clicks != null ? Math.round(row.product_clicks) : null,
        impressions_per_hour:     row.impressions_per_hour != null ? Math.round(row.impressions_per_hour) : null,
        gmv:                      row.gmv ?? null,
        gmv_per_hour:             row.gmv_per_hour ?? null,
        show_gpm:                 row.show_gpm ?? null,
        watch_gpm:                row.watch_gpm ?? null,
        orders:                   row.orders != null ? Math.round(row.orders) : null,
        items_sold:               row.items_sold != null ? Math.round(row.items_sold) : null,
        customers:                row.customers != null ? Math.round(row.customers) : null,
        aov:                      row.aov ?? null,
        ctr:                      row.ctr ?? null,
        ctor:                     row.ctor ?? null,
        ads_roas:                 row.ads_roas ?? null,
        ads_cost:                 row.ads_cost ?? null,
        ads_gmv:                  row.ads_gmv ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleChannelTrafficList(rows, reportDate) {
  let saved = 0;
  const date = reportDate || new Date();
  
  for (const row of rows) {
    // El canal viene en la primera columna (puede ser nombre del canal directamente)
    const channelRaw = row.channel || row.tipo_de_contenido || '';
    let channel = 'unknown';
    
    if (channelRaw.toLowerCase().includes('afiliado')) channel = 'affiliate';
    else if (channelRaw.toLowerCase().includes('live')) channel = 'live';
    else if (channelRaw.toLowerCase().includes('tarjeta') || channelRaw.toLowerCase().includes('card')) channel = 'product_card';
    else if (channelRaw.toLowerCase().includes('video')) channel = 'video';

    await prisma.channelPerformance.upsert({
      where: { 
        report_date_channel: {
          report_date: date,
          channel: channel
        }
      },
      update: {
        gmv:         row.gmv ?? undefined,
        orders:      row.orders != null ? Math.round(row.orders) : undefined,
        items_sold:  row.items_sold != null ? Math.round(row.items_sold) : undefined,
        customers:   row.customers != null ? Math.round(row.customers) : undefined,
        aov:         row.aov ?? undefined,
        impressions: row.impressions != null ? Math.round(row.impressions) : undefined,
        clicks:      row.clicks != null ? Math.round(row.clicks) : undefined,
        ctr:         row.ctr ?? undefined,
        add_to_cart: row.add_to_cart != null ? Math.round(row.add_to_cart) : undefined,
        ctor:        row.ctor ?? undefined,
      },
      create: {
        report_date: date,
        channel:     channel,
        gmv:         row.gmv ?? null,
        orders:      row.orders != null ? Math.round(row.orders) : null,
        items_sold:  row.items_sold != null ? Math.round(row.items_sold) : null,
        customers:   row.customers != null ? Math.round(row.customers) : null,
        aov:         row.aov ?? null,
        impressions: row.impressions != null ? Math.round(row.impressions) : null,
        clicks:      row.clicks != null ? Math.round(row.clicks) : null,
        ctr:         row.ctr ?? null,
        add_to_cart: row.add_to_cart != null ? Math.round(row.add_to_cart) : null,
        ctor:        row.ctor ?? null,
      },
    });
    saved++;
  }
  return saved;
}

async function handleCreatorProductList(rows, startDate, endDate) {
  let saved = 0;
  const reportPeriod = startDate && endDate 
    ? `${startDate.toISOString().split('T')[0]} ~ ${endDate.toISOString().split('T')[0]}`
    : 'unknown';

  for (const row of rows) {
    if (!row.product_id) continue;

    await prisma.product.upsert({
      where: { product_id: String(row.product_id) },
      update: {
        product_name: row.product_name ?? undefined,
      },
      create: {
        product_id:   String(row.product_id),
        product_name: row.product_name ?? 'Sin nombre',
      },
    });

    await prisma.affiliateProduct.upsert({
      where: {
        product_id_report_period: {
          product_id: String(row.product_id),
          report_period: reportPeriod
        }
      },
      update: {
        gross_revenue: row.gross_revenue ?? undefined,
        commission:    row.commission ?? undefined,
        unit_sales:    row.unit_sales != null ? Math.round(row.unit_sales) : undefined,
      },
      create: {
        product_id:    String(row.product_id),
        report_period: reportPeriod,
        gross_revenue: row.gross_revenue ?? null,
        commission:    row.commission ?? null,
        unit_sales:    row.unit_sales != null ? Math.round(row.unit_sales) : null,
      },
    });
    saved++;
  }
  return saved;
}

// ── Router principal de importación ──────────────────────────────────────────

async function importCSV(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ningún archivo CSV.' });
  }

  const filePath = req.file.path;
  const filename = req.file.originalname;

  try {
    const csvContent = readCSVFileContent(filePath);
    const { headers, canonicalHeaders, rows, dateRange } = await parseCSV(csvContent);

    if (!headers.length) {
      cleanup(filePath);
      return res.status(422).json({ error: 'El archivo CSV está vacío o no tiene cabeceras.' });
    }

    const detected = detectReportType(canonicalHeaders);
    if (!detected) {
      cleanup(filePath);
      return res.status(422).json({
        error: 'No se pudo identificar el tipo de reporte. Verifica que sea un CSV exportado de TikTok Shop.',
        headers,
      });
    }

    // Cuando la detección es ambígua entre CORE_STATS y CHANNEL_STATS_SEARCH
    // (estructura idéntica), el nombre de archivo decide.
    if (detected.ambiguous) {
      const nameLower = filename.toLowerCase();
      if (nameLower.includes('channel stats') || nameLower.includes('channel_stats')) {
        detected.type = 'CHANNEL_STATS_SEARCH';
      } else {
        detected.type = 'CORE_STATS';
      }
      detected.ambiguous = false;
    }

    // Usar rango de fechas extraído de metadatos (header del CSV) o filas
    const { startDate, endDate } = dateRange || { startDate: null, endDate: null };
    const fallbackDate = startDate || new Date();
    let rowsSaved = 0;

    switch (detected.type) {
      case 'SHOP_KEY_METRICS':
      case 'CORE_STATS':
        rowsSaved = await handleCoreStats(rows);
        break;
      case 'STORE_PAGE_OVERVIEW':
        rowsSaved = await handleStoreOverview(rows);
        break;
      case 'PRODUCT_LIST':
        rowsSaved = await handleProductList(rows, fallbackDate);
        break;
      case 'PRODUCT_TRAFFIC_KEY_METRICS':
        rowsSaved = await handleProductTrafficKeyMetrics(rows, fallbackDate);
        break;
      case 'PRODUCTS_CARD_LIST':
        rowsSaved = await handleProductCardTraffic(rows, fallbackDate);
        break;
      case 'PRODUCT_CARD_TRAFFIC':
        rowsSaved = await handleProductCardTrafficAggregated(rows, fallbackDate);
        break;
      case 'VIDEO_PERFORMANCE':
        rowsSaved = await handleVideoPerformance(rows, fallbackDate);
        break;
      case 'LIVE_PERFORMANCE':
        rowsSaved = await handleLivePerformance(rows, fallbackDate);
        break;
      case 'SERVICE_ANALYSIS':
        rowsSaved = await handleServiceAnalysis(rows);
        break;
      case 'CHANNEL_PRODUCT_SEARCH':
        rowsSaved = await handleSearchStats(rows, fallbackDate);
        break;
      case 'CHANNEL_STATS_SEARCH':
        rowsSaved = await handleChannelSearchStats(rows);
        break;
      case 'VIDEO_PERFORMANCE_LIST':
        rowsSaved = await handleVideoPerformanceList(rows);
        break;
      case 'LIVE_SESSION_LIST':
        rowsSaved = await handleLiveSessionList(rows);
        break;
      case 'CHANNEL_TRAFFIC_LIST':
        rowsSaved = await handleChannelTrafficList(rows, fallbackDate);
        break;
      case 'CREATOR_PRODUCT_LIST':
        rowsSaved = await handleCreatorProductList(rows, startDate, endDate);
        break;
      default:
        cleanup(filePath);
        return res.status(422).json({
          error: `Tipo de reporte "${detected.name}" detectado pero sin handler implementado.`,
        });
    }

    // Registrar importación
    await prisma.report.create({
      data: {
        report_type: detected.type,
        filename,
        start_date:  startDate || null,
        end_date:    endDate   || null,
        row_count:   rowsSaved,
      },
    });

    cleanup(filePath);

    return res.json({
      success: true,
      report_type: detected.name,
      rows_saved: rowsSaved,
      start_date: startDate,
      end_date:   endDate,
    });

  } catch (err) {
    cleanup(filePath);
    throw err;
  }
}

async function getImportHistory(req, res) {
  const reports = await prisma.report.findMany({
    orderBy: { import_date: 'desc' },
    take: 50,
  });
  res.json(reports);
}

async function deleteReport(req, res) {
  const { id } = req.params;
  const report = await prisma.report.findUnique({ where: { id: parseInt(id) } });
  if (!report) return res.status(404).json({ error: 'Reporte no encontrado.' });

  await prisma.report.delete({ where: { id: parseInt(id) } });
  res.json({ success: true });
}

module.exports = { importCSV, getImportHistory, deleteReport };
