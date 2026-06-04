'use strict';
const fs      = require('fs');
const { PrismaClient } = require('@prisma/client');
const { parseCSV, extractDateRange, parseDate } = require('../services/csvParser.service');
const { detectReportType }           = require('../services/reportDetector.service');

const prisma = new PrismaClient();

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
          conversion_rate: row.conversion_rate ?? null,
          ctr:             row.ctr             ?? null,
        },
      });
    }

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

    await prisma.searchMetric.create({
      data: {
        report_date:     date,
        product_id:      row.product_id ? String(row.product_id) : null,
        keyword:         row.keyword    ? String(row.keyword)    : null,
        impressions:     (row.search_impressions ?? row.impressions) != null
                           ? Math.round(row.search_impressions ?? row.impressions) : null,
        clicks:          (row.search_clicks ?? row.clicks) != null
                           ? Math.round(row.search_clicks ?? row.clicks) : null,
        ctr:             row.search_ctr ?? row.ctr ?? null,
        orders:          (row.search_orders ?? row.orders) != null
                           ? Math.round(row.search_orders ?? row.orders) : null,
        conversion_rate: row.search_conversion ?? row.conversion_rate ?? null,
        gmv:             row.search_gmv ?? row.gmv ?? null,
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
    const { headers, rows } = await parseCSV(filePath);

    if (!headers.length) {
      cleanup(filePath);
      return res.status(422).json({ error: 'El archivo CSV está vacío o no tiene cabeceras.' });
    }

    const detected = detectReportType(headers);
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

    const { startDate, endDate } = extractDateRange(rows);
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
