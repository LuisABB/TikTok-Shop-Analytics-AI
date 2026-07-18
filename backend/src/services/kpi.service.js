'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Motor de KPIs: calcula y agrega todas las métricas clave.
 * Todos los valores monetarios se devuelven como Number (JavaScript).
 */

// ── Helpers ────────────────────────────────────────────────────────────────────
const toNum = (val) => (val === null || val === undefined ? null : Number(val));
const rate  = (num, den) => (den && den !== 0 ? (num / den) * 100 : null);
const avg   = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

function buildDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return undefined;
  const filter = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate)   filter.lte = new Date(endDate);
  return filter;
}

// ── Ventas globales ────────────────────────────────────────────────────────────
async function getSalesKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const agg = await prisma.coreMetric.aggregate({
    where,
    _sum:  { gmv: true, orders: true, customers: true, items_sold: true },
    _avg:  { aov: true },
  });

  const gmv       = toNum(agg._sum.gmv)       || 0;
  const orders    = toNum(agg._sum.orders)    || 0;
  const customers = toNum(agg._sum.customers) || 0;
  const itemsSold = toNum(agg._sum.items_sold)|| 0;
  const aov       = orders > 0 ? gmv / orders : toNum(agg._avg.aov) || 0;

  return { gmv, orders, customers, itemsSold, aov };
}

// ── Tendencia de GMV diario ────────────────────────────────────────────────────
async function getGMVTrend(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const rows = await prisma.coreMetric.findMany({
    where,
    select: { report_date: true, gmv: true, orders: true },
    orderBy: { report_date: 'asc' },
  });

  return rows.map(r => ({
    date:   r.report_date.toISOString().split('T')[0],
    gmv:    toNum(r.gmv)    || 0,
    orders: toNum(r.orders) || 0,
  }));
}

// ── Embudo de conversión ───────────────────────────────────────────────────────
async function getConversionFunnel(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  // productCardDailyMetric tiene los datos reales del embudo (views, clicks, add_to_cart)
  // productMetric (product_list) tiene impressions pero clicks/add_to_cart son null
  const agg = await prisma.productCardDailyMetric.aggregate({
    where,
    _sum: {
      views:             true,
      clicks:            true,
      add_to_cart:       true,
      add_to_cart_users: true,
      orders:            true,
    },
  });

  const impressions = toNum(agg._sum.views)             || 0;
  const clicks      = toNum(agg._sum.clicks)            || 0;
  const cart        = toNum(agg._sum.add_to_cart)       || 0;
  const orders      = toNum(agg._sum.orders)            || 0;

  return {
    impressions,
    clicks,
    cart,
    orders,
    ctr:           rate(clicks, impressions),  // Vista → Clic
    cart_rate:     rate(cart,   clicks),       // Clic → Carrito
    purchase_rate: rate(orders, cart),         // Carrito → Compra
    overall_cvr:   rate(orders, impressions),  // Vista → Compra
  };
}

// ── Top productos ──────────────────────────────────────────────────────────────
async function getTopProducts(metric = 'gmv', limit = 10, startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const allowed = ['gmv', 'orders', 'customers', 'impressions', 'clicks'];
  const col = allowed.includes(metric) ? metric : 'gmv';

  const agg = await prisma.productMetric.groupBy({
    by: ['product_id'],
    where,
    _sum: { gmv: true, orders: true, customers: true, impressions: true, clicks: true, add_to_cart: true },
    orderBy: { _sum: { [col]: 'desc' } },
    take: limit,
  });

  // Enriquecer con nombre de producto
  const productIds = agg.map(r => r.product_id);
  const products = await prisma.product.findMany({
    where: { product_id: { in: productIds } },
    select: { product_id: true, product_name: true },
  });
  const nameMap = Object.fromEntries(products.map(p => [p.product_id, p.product_name]));

  return agg.map(r => ({
    product_id:   r.product_id,
    product_name: nameMap[r.product_id] || r.product_id,
    gmv:          toNum(r._sum.gmv)          || 0,
    orders:       toNum(r._sum.orders)       || 0,
    customers:    toNum(r._sum.customers)    || 0,
    impressions:  toNum(r._sum.impressions)  || 0,
    clicks:       toNum(r._sum.clicks)       || 0,
    add_to_cart:  toNum(r._sum.add_to_cart)  || 0,
    conversion_rate: rate(
      toNum(r._sum.orders)      || 0,
      toNum(r._sum.impressions) || 0
    ),
  }));
}

// ── Productos sin ventas ────────────────────────────────────────────────────────
async function getProductsWithoutSales(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  // Productos con impresiones pero 0 pedidos
  const withTraffic = await prisma.productMetric.groupBy({
    by: ['product_id'],
    where: { ...where, impressions: { gt: 0 }, orders: { equals: 0 } },
    _sum: { impressions: true, clicks: true },
    orderBy: { _sum: { impressions: 'desc' } },
    take: 20,
  });

  const productIds = withTraffic.map(r => r.product_id);
  const products = await prisma.product.findMany({
    where: { product_id: { in: productIds } },
    select: { product_id: true, product_name: true },
  });
  const nameMap = Object.fromEntries(products.map(p => [p.product_id, p.product_name]));

  return withTraffic.map(r => ({
    product_id:   r.product_id,
    product_name: nameMap[r.product_id] || r.product_id,
    impressions:  toNum(r._sum.impressions) || 0,
    clicks:       toNum(r._sum.clicks)      || 0,
  }));
}

// ── KPIs de Video ──────────────────────────────────────────────────────────────
async function getVideoKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const agg = await prisma.videoMetric.aggregate({
    where,
    _sum: { vv: true, gmv: true, orders: true },
    _avg: { ctr: true, ctor: true, gpm: true },
  });

  return {
    vv:    toNum(agg._sum.vv)    || 0,
    gmv:   toNum(agg._sum.gmv)   || 0,
    orders: toNum(agg._sum.orders)|| 0,
    avg_ctr:  toNum(agg._avg.ctr)  ? toNum(agg._avg.ctr) * 100  : null,
    avg_ctor: toNum(agg._avg.ctor) ? toNum(agg._avg.ctor) * 100 : null,
    avg_gpm:  toNum(agg._avg.gpm),
  };
}

// ── Top videos ─────────────────────────────────────────────────────────────────
async function getTopVideos(limit = 10, startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  return prisma.videoMetric.findMany({
    where,
    orderBy: { gmv: 'desc' },
    take: limit,
    select: {
      video_id: true, video_title: true, author: true,
      vv: true, ctr: true, ctor: true, gmv: true, orders: true, gpm: true,
      report_date: true,
    },
  }).then(rows => rows.map(r => ({
    ...r,
    gmv:  toNum(r.gmv),
    ctr:  r.ctr  ? toNum(r.ctr)  * 100 : null,
    ctor: r.ctor ? toNum(r.ctor) * 100 : null,
    gpm:  toNum(r.gpm),
  })));
}

// ── KPIs de LIVE ────────────────────────────────────────────────────────────────
async function getLiveKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const agg = await prisma.liveMetric.aggregate({
    where,
    _sum: { viewers: true, gmv: true, orders: true, sessions: true },
    _avg: { ctr: true, ctor: true, peak_viewers: true },
  });

  return {
    total_sessions: toNum(agg._sum.sessions) || 0,
    total_viewers:  toNum(agg._sum.viewers)      || 0,
    gmv:            toNum(agg._sum.gmv)           || 0,
    orders:         toNum(agg._sum.orders)        || 0,
    avg_ctr:  agg._avg.ctr  ? (toNum(agg._avg.ctr)  > 0 ? toNum(agg._avg.ctr)  * 100 : null) : null,
    avg_ctor: agg._avg.ctor ? (toNum(agg._avg.ctor) > 0 ? toNum(agg._avg.ctor) * 100 : null) : null,
    avg_peak_viewers: toNum(agg._avg.peak_viewers),
  };
}

// ── KPIs de Búsqueda/SEO ───────────────────────────────────────────────────────
async function getSearchKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  // channelSearchMetric tiene las impresiones y el CTR real del canal (diario)
  // searchMetric tiene el detalle por producto (GMV, pedidos)
  const [csAgg, smAgg] = await Promise.all([
    prisma.channelSearchMetric.aggregate({
      where,
      _sum: { impressions: true, clicks: true },
      _avg: { ctr: true },
    }),
    prisma.searchMetric.aggregate({
      where,
      _sum: { orders: true, gmv: true },
    }),
  ]);

  const avgCtr = toNum(csAgg._avg.ctr);
  return {
    impressions: toNum(csAgg._sum.impressions) || 0,
    clicks:      toNum(csAgg._sum.clicks)      || 0,
    orders:      toNum(smAgg._sum.orders)      || 0,
    gmv:         toNum(smAgg._sum.gmv)         || 0,
    avg_ctr:        avgCtr > 0 ? avgCtr * 100 : null,
    avg_conversion: null,
  };
}

// ── Top productos por búsqueda ──────────────────────────────────────────────────
async function getTopSearchProducts(limit = 10, startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const agg = await prisma.searchMetric.groupBy({
    by: ['product_id'],
    where: { ...where, product_id: { not: null } },
    _sum:  { impressions: true, clicks: true, orders: true, gmv: true },
  });

  const productIds = agg.map(r => r.product_id).filter(Boolean);
  const products = await prisma.product.findMany({
    where: { product_id: { in: productIds } },
    select: { product_id: true, product_name: true },
  });
  const nameMap = Object.fromEntries(products.map(p => [p.product_id, p.product_name]));

  return agg
    .map(r => {
      const impressions = toNum(r._sum.impressions) || 0;
      const clicks      = toNum(r._sum.clicks)      || 0;
      const orders      = toNum(r._sum.orders)      || 0;
      return {
        product_id:      r.product_id,
        product_name:    nameMap[r.product_id] || r.product_id,
        impressions,
        clicks,
        orders,
        gmv:             toNum(r._sum.gmv) || 0,
        avg_ctr:         impressions > 0 ? (clicks  / impressions * 100) : null,
        avg_conversion:  clicks      > 0 ? (orders  / clicks      * 100) : null,
      };
    })
    .filter(r => r.impressions > 0 || r.clicks > 0)
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, limit);
}

// ── KPIs de Servicio ───────────────────────────────────────────────────────────
async function getServiceKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = dateFilter ? { report_date: dateFilter } : {};

  const agg = await prisma.serviceMetric.aggregate({
    where,
    _sum: { assigned_chats: true, resolved_chats: true },
    _avg: { response_rate: true, satisfaction_rate: true, avg_response_time_s: true },
  });

  return {
    total_chats:         toNum(agg._sum.assigned_chats)    || 0,
    total_resolved:      toNum(agg._sum.resolved_chats)    || 0,
    avg_response_rate:   agg._avg.response_rate    ? toNum(agg._avg.response_rate)    * 100 : null,
    avg_satisfaction:    agg._avg.satisfaction_rate ? toNum(agg._avg.satisfaction_rate) * 100 : null,
    avg_response_time_s: toNum(agg._avg.avg_response_time_s),
  };
}

// ── KPIs desde órdenes reales (Order List) ────────────────────────────────────
// Orden válida = pagada (paid_at IS NOT NULL) y no cancelada.
async function getOrderKPIs(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const paidFilter = dateFilter ? { gte: dateFilter.gte, lte: dateFilter.lte } : undefined;

  const baseWhere = `status != 'Cancelado' AND paid_at IS NOT NULL`;
  const dateWhereRaw = paidFilter
    ? prisma.$queryRaw`AND paid_at >= ${paidFilter.gte ?? new Date('2000-01-01')} AND paid_at <= ${paidFilter.lte ?? new Date('2099-12-31')}`
    : prisma.$queryRaw``;

  const [agg, distinctCounts] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status:  { not: 'Cancelado' },
        paid_at: { not: null },
        ...(paidFilter ? { paid_at: paidFilter } : {}),
      },
      _sum:   { order_amount: true, refund_amount: true },
      _count: { order_id: true },
    }),
    (async () => {
      const args = [
        'Cancelado',
        ...(paidFilter ? [paidFilter.gte ?? new Date('2000-01-01'), paidFilter.lte ?? new Date('2099-12-31')] : []),
      ];
      if (paidFilter) {
        return prisma.$queryRaw`
          SELECT
            COUNT(DISTINCT order_id)::int        AS orders_count,
            COUNT(DISTINCT buyer_username)::int   AS customers_count
          FROM orders
          WHERE status != 'Cancelado'
            AND paid_at IS NOT NULL
            AND paid_at >= ${paidFilter.gte ?? new Date('2000-01-01')}
            AND paid_at <= ${paidFilter.lte ?? new Date('2099-12-31')}
        `;
      }
      return prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT order_id)::int        AS orders_count,
          COUNT(DISTINCT buyer_username)::int   AS customers_count
        FROM orders
        WHERE status != 'Cancelado'
          AND paid_at IS NOT NULL
      `;
    })(),
  ]);

  const gmv       = toNum(agg._sum.order_amount)  || 0;
  const refunds   = toNum(agg._sum.refund_amount) || 0;
  const orders    = Number(distinctCounts[0]?.orders_count    ?? 0);
  const customers = Number(distinctCounts[0]?.customers_count ?? 0);
  const aovVal    = orders > 0 ? gmv / orders : 0;

  // Desglose por canal
  const channelBreakdown = await prisma.order.groupBy({
    by:    ['order_channel'],
    where: {
      status:  { not: 'Cancelado' },
      paid_at: { not: null },
      ...(paidFilter ? { paid_at: paidFilter } : {}),
    },
    _sum:   { order_amount: true },
    _count: { order_id: true },
  });

  const channels = {};
  for (const c of channelBreakdown) {
    const key = c.order_channel || 'Desconocido';
    channels[key] = {
      gmv:    toNum(c._sum.order_amount) || 0,
      orders: c._count.order_id,
    };
  }

  return { gmv, orders, customers, aov: aovVal, refunds, channels, has_data: orders > 0 };
}

// ── Tendencia GMV diaria desde órdenes reales ─────────────────────────────────
async function getOrderGMVTrend(startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const paidFilter = dateFilter ? { gte: dateFilter.gte, lte: dateFilter.lte } : undefined;

  let rows;
  if (paidFilter) {
    rows = await prisma.$queryRaw`
      SELECT
        DATE(paid_at) AS date,
        COUNT(DISTINCT order_id)::int AS orders,
        SUM(order_amount)             AS gmv
      FROM orders
      WHERE status != 'Cancelado'
        AND paid_at IS NOT NULL
        AND paid_at >= ${paidFilter.gte ?? new Date('2000-01-01')}
        AND paid_at <= ${paidFilter.lte ?? new Date('2099-12-31')}
      GROUP BY DATE(paid_at)
      ORDER BY date ASC
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT
        DATE(paid_at) AS date,
        COUNT(DISTINCT order_id)::int AS orders,
        SUM(order_amount)             AS gmv
      FROM orders
      WHERE status != 'Cancelado'
        AND paid_at IS NOT NULL
      GROUP BY DATE(paid_at)
      ORDER BY date ASC
    `;
  }

  return rows.map(r => ({
    date:   r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    orders: Number(r.orders) || 0,
    gmv:    toNum(r.gmv)     || 0,
  }));
}

// ── Fechas con datos importados ────────────────────────────────────────────────
async function getAvailableDates() {
  const rows = await prisma.$queryRaw`
    SELECT DISTINCT d::date AS date FROM (
      SELECT report_date AS d FROM core_metrics
      UNION SELECT report_date FROM store_metrics
      UNION SELECT report_date FROM product_metrics
      UNION SELECT report_date FROM product_card_daily_metrics
      UNION SELECT report_date FROM channel_search_metrics
      UNION SELECT report_date FROM search_metrics
      UNION SELECT report_date FROM video_metrics
      UNION SELECT report_date FROM live_metrics
      UNION SELECT report_date FROM service_metrics
      UNION SELECT report_date FROM channel_performance      UNION SELECT paid_at FROM orders WHERE paid_at IS NOT NULL    ) AS all_dates
    ORDER BY date ASC
  `;

  const dates = rows.map(r => {
    const d = r.date instanceof Date ? r.date : new Date(r.date);
    return d.toISOString().slice(0, 10);
  });

  return {
    dates,
    min: dates[0] ?? null,
    max: dates[dates.length - 1] ?? null,
  };
}

// ── Resumen completo (para IA y diagnóstico) ───────────────────────────────────
async function getFullSummary(startDate, endDate) {
  const [sales, funnel, video, live, search, service] = await Promise.all([
    getSalesKPIs(startDate, endDate),
    getConversionFunnel(startDate, endDate),
    getVideoKPIs(startDate, endDate),
    getLiveKPIs(startDate, endDate),
    getSearchKPIs(startDate, endDate),
    getServiceKPIs(startDate, endDate),
  ]);
  return { sales, funnel, video, live, search, service };
}

module.exports = {
  getSalesKPIs,
  getGMVTrend,
  getConversionFunnel,
  getTopProducts,
  getProductsWithoutSales,
  getVideoKPIs,
  getTopVideos,
  getLiveKPIs,
  getSearchKPIs,
  getTopSearchProducts,
  getServiceKPIs,
  getOrderKPIs,
  getOrderGMVTrend,
  getAvailableDates,
  getFullSummary,
};
