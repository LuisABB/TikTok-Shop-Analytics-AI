/**
 * reimport-routing-fix.js — Re-importa los CSVs afectados por el fix de routing
 */
const { PrismaClient } = require('@prisma/client');
const { parseCSV, parseDate } = require('../src/services/csvParser.service');
const path = require('path');

const prisma = new PrismaClient();
const D = path.join(__dirname, '../../sample-csvs');

async function main() {
  // 1. Re-importar Core Stats (limpiar contaminación de Channel Stats)
  {
    const { rows } = await parseCSV(path.join(D, 'Core Stats_20260530163705.xlsx - Sheet1.csv'));
    await prisma.coreMetric.deleteMany();
    let n = 0;
    for (const row of rows) {
      const date = parseDate(row.date);
      if (!date) continue;
      await prisma.coreMetric.upsert({
        where: { report_date: date },
        update: {
          gmv: row.gmv ?? undefined,
          orders: row.orders != null ? Math.round(row.orders) : undefined,
          customers: row.customers != null ? Math.round(row.customers) : undefined,
          items_sold: row.items_sold != null ? Math.round(row.items_sold) : undefined,
          aov: row.aov ? row.aov : undefined,
          new_customers: row.new_customers != null ? Math.round(row.new_customers) : undefined,
          impressions: row.viewers != null ? Math.round(row.viewers) : undefined,
          clicks: row.clicks != null ? Math.round(row.clicks) : undefined,
          add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : undefined,
          conversion_rate: row.conversion_rate ?? undefined,
        },
        create: {
          report_date: date,
          gmv: row.gmv ?? null,
          orders: row.orders != null ? Math.round(row.orders) : null,
          customers: row.customers != null ? Math.round(row.customers) : null,
          items_sold: row.items_sold != null ? Math.round(row.items_sold) : null,
          aov: row.aov ? row.aov : null,
          new_customers: row.new_customers != null ? Math.round(row.new_customers) : null,
          impressions: row.viewers != null ? Math.round(row.viewers) : null,
          clicks: row.clicks != null ? Math.round(row.clicks) : null,
          add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : null,
          conversion_rate: row.conversion_rate ?? null,
        },
      });
      n++;
    }
    console.log('core_metrics reimportado:', n, 'filas');
    const s = await prisma.coreMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  check: 2026-05-01 clicks=' + s.clicks, '(csv esperado: 1)');
  }

  // 2. Re-importar Channel Stats → channel_search_metrics
  {
    const { rows } = await parseCSV(path.join(D, 'Channel Stats - Search_20260530163738.xlsx - Sheet1.csv'));
    await prisma.channelSearchMetric.deleteMany();
    let n = 0;
    for (const row of rows) {
      const date = parseDate(row.date);
      if (!date) continue;
      const impressions = row.impressions ?? row.viewers ?? null;
      const add_to_cart_u = row.add_to_cart_users ?? null;
      await prisma.channelSearchMetric.upsert({
        where: { report_date: date },
        update: {
          gmv: row.gmv ?? undefined,
          aov: row.aov ? row.aov : undefined,
          orders: row.orders != null ? Math.round(row.orders) : undefined,
          customers: row.customers != null ? Math.round(row.customers) : undefined,
          impressions: impressions != null ? Math.round(impressions) : undefined,
          clicks: row.clicks != null ? Math.round(row.clicks) : undefined,
          add_to_cart_users: add_to_cart_u != null ? Math.round(add_to_cart_u) : undefined,
          conversion_rate: row.conversion_rate ?? undefined,
          ctr: row.ctr ?? undefined,
        },
        create: {
          report_date: date,
          gmv: row.gmv ?? null,
          aov: row.aov ? row.aov : null,
          orders: row.orders != null ? Math.round(row.orders) : null,
          customers: row.customers != null ? Math.round(row.customers) : null,
          impressions: impressions != null ? Math.round(impressions) : null,
          clicks: row.clicks != null ? Math.round(row.clicks) : null,
          add_to_cart_users: add_to_cart_u != null ? Math.round(add_to_cart_u) : null,
          conversion_rate: row.conversion_rate ?? null,
          ctr: row.ctr ?? null,
        },
      });
      n++;
    }
    console.log('channel_search_metrics reimportado:', n, 'filas');
    const s = await prisma.channelSearchMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  check: 2026-05-01 impressions=' + s.impressions, 'clicks=' + s.clicks);
  }

  // 3. Re-importar Channel Product List → search_metrics
  {
    const { rows } = await parseCSV(path.join(D, 'Channel Product List - Search_20260530163752.xlsx - Sheet1.csv'));
    await prisma.searchMetric.deleteMany();
    const fallbackDate = new Date('2026-05-29T00:00:00.000Z');
    let n = 0;
    for (const row of rows) {
      const date = (row.date ? parseDate(row.date) : null) || fallbackDate;
      if (row.product_id) {
        await prisma.product.upsert({
          where: { product_id: String(row.product_id) },
          update: { product_name: row.product_name ?? undefined },
          create: { product_id: String(row.product_id), product_name: row.product_name ?? 'Sin nombre' },
        });
      }
      await prisma.searchMetric.create({
        data: {
          report_date: date,
          product_id: row.product_id ? String(row.product_id) : null,
          keyword: row.keyword ? String(row.keyword) : null,
          impressions: (row.search_impressions ?? row.impressions) != null
            ? Math.round(row.search_impressions ?? row.impressions) : null,
          clicks: (row.search_clicks ?? row.clicks) != null
            ? Math.round(row.search_clicks ?? row.clicks) : null,
          ctr: row.search_ctr ?? row.ctr ?? null,
          orders: (row.search_orders ?? row.orders) != null
            ? Math.round(row.search_orders ?? row.orders) : null,
          conversion_rate: row.search_conversion ?? row.conversion_rate ?? null,
          gmv: row.search_gmv ?? row.gmv ?? null,
        },
      });
      n++;
    }
    console.log('search_metrics reimportado:', n, 'filas');
    const s = await prisma.searchMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  check: product_id=' + s.product_id, 'impressions=' + s.impressions, 'orders=' + s.orders);
  }

  console.log('\n✔ Reimportación completada');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
