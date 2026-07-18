'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper para convertir Decimal a número
const toNum = (val) => (val ? parseFloat(val) : 0);

// Helper para construir filtro de fecha
function buildDateFilter(startDate, endDate) {
  if (!startDate && !endDate) return null;
  const filter = {};
  if (startDate) filter.gte = new Date(startDate);
  if (endDate)   filter.lte = new Date(endDate);
  return filter;
}

/**
 * Analiza el embudo de conversión completo
 * Retorna métricas agregadas del embudo: Impresiones → Clics → Add to Cart → Pedidos
 */
async function getFunnelAnalysis(startDate, endDate, channel = 'all') {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = { channel };
  if (dateFilter) where.report_date = dateFilter;

  const agg = await prisma.productMetric.aggregate({
    where,
    _sum: {
      impressions: true,
      clicks: true,
      add_to_cart: true,
      orders: true,
      unique_impressions: true,
      unique_clicks: true,
      unique_add_to_cart_users: true,
    },
    _avg: {
      ctr: true,
      add_to_cart_rate: true,
      ctor: true,
      unique_ctr: true,
      unique_add_to_cart_rate: true,
      unique_ctor: true,
    },
  });

  const impressions = toNum(agg._sum.impressions) || 0;
  const clicks = toNum(agg._sum.clicks) || 0;
  const addToCart = toNum(agg._sum.add_to_cart) || 0;
  const orders = toNum(agg._sum.orders) || 0;

  const uniqueImpressions = toNum(agg._sum.unique_impressions) || 0;
  const uniqueClicks = toNum(agg._sum.unique_clicks) || 0;
  const uniqueAddToCart = toNum(agg._sum.unique_add_to_cart_users) || 0;

  return {
    // Métricas totales
    total: {
      impressions,
      clicks,
      add_to_cart: addToCart,
      orders,
      // Tasas de conversión entre etapas
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      add_to_cart_rate: clicks > 0 ? (addToCart / clicks) * 100 : 0,
      ctor: clicks > 0 ? (orders / clicks) * 100 : 0,
      overall_conversion: impressions > 0 ? (orders / impressions) * 100 : 0,
    },
    // Métricas únicas (usuarios únicos)
    unique: {
      impressions: uniqueImpressions,
      clicks: uniqueClicks,
      add_to_cart: uniqueAddToCart,
      // Tasas basadas en usuarios únicos
      ctr: uniqueImpressions > 0 ? (uniqueClicks / uniqueImpressions) * 100 : 0,
      add_to_cart_rate: uniqueClicks > 0 ? (uniqueAddToCart / uniqueClicks) * 100 : 0,
      overall_conversion: uniqueImpressions > 0 ? (orders / uniqueImpressions) * 100 : 0,
    },
    // Pérdidas en cada etapa (leakage)
    leakage: {
      impression_to_click: impressions > 0 ? ((impressions - clicks) / impressions) * 100 : 0,
      click_to_cart: clicks > 0 ? ((clicks - addToCart) / clicks) * 100 : 0,
      cart_to_order: addToCart > 0 ? ((addToCart - orders) / addToCart) * 100 : 0,
    },
    // Promedios
    averages: {
      ctr: agg._avg.ctr ? toNum(agg._avg.ctr) * 100 : 0,
      add_to_cart_rate: agg._avg.add_to_cart_rate ? toNum(agg._avg.add_to_cart_rate) * 100 : 0,
      ctor: agg._avg.ctor ? toNum(agg._avg.ctor) * 100 : 0,
      unique_ctr: agg._avg.unique_ctr ? toNum(agg._avg.unique_ctr) * 100 : 0,
      unique_add_to_cart_rate: agg._avg.unique_add_to_cart_rate ? toNum(agg._avg.unique_add_to_cart_rate) * 100 : 0,
      unique_ctor: agg._avg.unique_ctor ? toNum(agg._avg.unique_ctor) * 100 : 0,
    },
  };
}

/**
 * Retorna top productos por performance en el embudo
 * Permite ordenar por diferentes métricas del embudo
 */
async function getTopProductsByFunnel(metric = 'ctor', limit = 10, startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = { channel: 'all' };
  if (dateFilter) where.report_date = dateFilter;

  // Mapeo de métricas válidas para ordenamiento
  const orderByMap = {
    ctr: { ctr: 'desc' },
    add_to_cart_rate: { add_to_cart_rate: 'desc' },
    ctor: { ctor: 'desc' },
    unique_ctr: { unique_ctr: 'desc' },
    unique_ctor: { unique_ctor: 'desc' },
    impressions: { impressions: 'desc' },
    clicks: { clicks: 'desc' },
    add_to_cart: { add_to_cart: 'desc' },
    orders: { orders: 'desc' },
  };

  const orderBy = orderByMap[metric] || { ctor: 'desc' };

  const metrics = await prisma.productMetric.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      product_id: true,
      impressions: true,
      clicks: true,
      add_to_cart: true,
      orders: true,
      ctr: true,
      add_to_cart_rate: true,
      ctor: true,
      unique_impressions: true,
      unique_clicks: true,
      unique_add_to_cart_users: true,
      unique_ctr: true,
      unique_add_to_cart_rate: true,
      unique_ctor: true,
      product: {
        select: {
          product_name: true,
        },
      },
    },
  });

  return metrics.map(m => ({
    product_id: m.product_id,
    product_name: m.product?.product_name || 'Sin nombre',
    impressions: m.impressions || 0,
    clicks: m.clicks || 0,
    add_to_cart: m.add_to_cart || 0,
    orders: m.orders || 0,
    ctr: m.ctr ? toNum(m.ctr) * 100 : 0,
    add_to_cart_rate: m.add_to_cart_rate ? toNum(m.add_to_cart_rate) * 100 : 0,
    ctor: m.ctor ? toNum(m.ctor) * 100 : 0,
    unique_impressions: m.unique_impressions || 0,
    unique_clicks: m.unique_clicks || 0,
    unique_add_to_cart: m.unique_add_to_cart_users || 0,
    unique_ctr: m.unique_ctr ? toNum(m.unique_ctr) * 100 : 0,
    unique_add_to_cart_rate: m.unique_add_to_cart_rate ? toNum(m.unique_add_to_cart_rate) * 100 : 0,
    unique_ctor: m.unique_ctor ? toNum(m.unique_ctor) * 100 : 0,
  }));
}

/**
 * Análisis financiero completo
 * Considera GMV, impuestos, subsidios, envíos, reembolsos
 */
async function getFinancialAnalysis(startDate, endDate, channel = 'all') {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = { channel };
  if (dateFilter) where.report_date = dateFilter;

  const agg = await prisma.productMetric.aggregate({
    where,
    _sum: {
      gmv: true,
      gmv_with_tax: true,
      tax: true,
      gmv_with_subsidy: true,
      shipping_fees: true,
      refunds: true,
      orders: true,
      sku_orders: true,
      items_sold: true,
      refunded_items: true,
      refunded_customers: true,
    },
    _avg: {
      aov: true,
    },
  });

  const rawGmv = toNum(agg._sum.gmv);
  const gmvWithTax = toNum(agg._sum.gmv_with_tax);
  const tax = toNum(agg._sum.tax);
  const gmvWithSubsidy = toNum(agg._sum.gmv_with_subsidy);
  const shippingFees = toNum(agg._sum.shipping_fees);
  const refunds = toNum(agg._sum.refunds);
  const orders = toNum(agg._sum.orders);
  const skuOrders = toNum(agg._sum.sku_orders);
  const itemsSold = toNum(agg._sum.items_sold);
  const refundedItems = toNum(agg._sum.refunded_items);
  const refundedCustomers = toNum(agg._sum.refunded_customers);
  const avgAov = toNum(agg._avg.aov);

  // Si gmv está vacío pero hay gmv_with_tax (Product Traffic Key Metrics), usar ese total
  const displayGmv = rawGmv > 0 ? rawGmv : gmvWithTax;
  const gmvIncludesTax = rawGmv <= 0 && gmvWithTax > 0;

  const netRevenue = gmvIncludesTax
    ? gmvWithTax - refunds - shippingFees
    : displayGmv - refunds;
  const effectiveRevenue = gmvWithSubsidy > 0 ? gmvWithSubsidy - refunds : netRevenue;
  const refundRate = displayGmv > 0 ? (refunds / displayGmv) * 100 : 0;
  const itemRefundRate = itemsSold > 0 ? (refundedItems / itemsSold) * 100 : 0;
  const subsidyImpact = gmvWithSubsidy > 0 ? gmvWithSubsidy - displayGmv : 0;

  return {
    // Ventas brutas (displayGmv ya incluye fallback a gmv_with_tax)
    gmv: displayGmv,
    gmv_raw: rawGmv,
    gmv_with_tax: gmvWithTax,
    gmv_with_subsidy: gmvWithSubsidy,
    gmv_includes_tax: gmvIncludesTax,
    
    // Costos y deducciones
    tax,
    shipping_fees: shippingFees,
    refunds,
    
    // Ingresos netos
    net_revenue: netRevenue,
    effective_revenue: effectiveRevenue,
    
    // Métricas de pedidos
    orders,
    sku_orders: skuOrders,
    items_sold: itemsSold,
    avg_aov: avgAov,
    
    // Devoluciones
    refunded_items: refundedItems,
    refunded_customers: refundedCustomers,
    refund_rate: refundRate,
    item_refund_rate: itemRefundRate,
    
    // Impacto de subsidios
    subsidy_impact: subsidyImpact,
    subsidy_percentage: displayGmv > 0 ? (subsidyImpact / displayGmv) * 100 : 0,
  };
}

/**
 * Identifica productos con mayor pérdida en el embudo
 * Útil para optimización
 */
async function getProductsWithHighestLeakage(stage = 'click_to_cart', limit = 10, startDate, endDate) {
  const dateFilter = buildDateFilter(startDate, endDate);
  const where = { channel: 'all' };
  if (dateFilter) where.report_date = dateFilter;

  const products = await prisma.productMetric.findMany({
    where,
    select: {
      product_id: true,
      impressions: true,
      clicks: true,
      add_to_cart: true,
      orders: true,
      product: {
        select: {
          product_name: true,
        },
      },
    },
  });

  // Calcular pérdidas para cada producto
  const withLeakage = products.map(p => {
    const impressions = p.impressions || 0;
    const clicks = p.clicks || 0;
    const addToCart = p.add_to_cart || 0;
    const orders = p.orders || 0;

    const impressionToClick = impressions > 0 ? ((impressions - clicks) / impressions) * 100 : 0;
    const clickToCart = clicks > 0 ? ((clicks - addToCart) / clicks) * 100 : 0;
    const cartToOrder = addToCart > 0 ? ((addToCart - orders) / addToCart) * 100 : 0;

    return {
      product_id: p.product_id,
      product_name: p.product?.product_name || 'Sin nombre',
      impressions,
      clicks,
      add_to_cart: addToCart,
      orders,
      leakage: {
        impression_to_click: impressionToClick,
        click_to_cart: clickToCart,
        cart_to_order: cartToOrder,
      },
      selected_leakage: stage === 'impression_to_click' ? impressionToClick
                      : stage === 'click_to_cart' ? clickToCart
                      : cartToOrder,
    };
  });

  // Ordenar por la pérdida seleccionada y retornar top
  return withLeakage
    .sort((a, b) => b.selected_leakage - a.selected_leakage)
    .slice(0, limit);
}

module.exports = {
  getFunnelAnalysis,
  getTopProductsByFunnel,
  getFinancialAnalysis,
  getProductsWithHighestLeakage,
};
