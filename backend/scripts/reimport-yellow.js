// Re-import script for 🟡 fixes
const { PrismaClient } = require('@prisma/client');
const { parseCSV, parseDate } = require('../src/services/csvParser.service');
const path = require('path');

const prisma = new PrismaClient();
const D = path.join(__dirname, '../../sample-csvs');

async function main() {
  // ── 🟡5 Core Stats: impressions/clicks/add_to_cart_users ─────────────────
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
          gmv:              row.gmv              ?? undefined,
          orders:           row.orders           != null ? Math.round(row.orders)           : undefined,
          customers:        row.customers        != null ? Math.round(row.customers)        : undefined,
          aov:              row.aov ? row.aov : undefined,
          impressions:      row.viewers          != null ? Math.round(row.viewers)          : undefined,
          clicks:           row.clicks           != null ? Math.round(row.clicks)           : undefined,
          add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : undefined,
          conversion_rate:  row.conversion_rate  ?? undefined,
        },
        create: {
          report_date:      date,
          gmv:              row.gmv              ?? null,
          orders:           row.orders           != null ? Math.round(row.orders)           : null,
          customers:        row.customers        != null ? Math.round(row.customers)        : null,
          aov:              row.aov ? row.aov : null,
          impressions:      row.viewers          != null ? Math.round(row.viewers)          : null,
          clicks:           row.clicks           != null ? Math.round(row.clicks)           : null,
          add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : null,
          conversion_rate:  row.conversion_rate  ?? null,
        },
      });
      n++;
    }
    console.log('core_metrics:', n, 'filas');
    const s = await prisma.coreMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  sample:', s.report_date.toISOString().slice(0, 10),
      'impressions=' + s.impressions, 'clicks=' + s.clicks, 'add_to_cart_users=' + s.add_to_cart_users);
  }

  // ── 🟡6 Live: gpm ────────────────────────────────────────────────────────
  {
    const { rows } = await parseCSV(path.join(D, 'Live Performance Core Stats_20260530162857.xlsx - Sheet1.csv'));
    await prisma.liveMetric.deleteMany();
    let n = 0;
    for (const row of rows) {
      const date = parseDate(row.date) || new Date();
      await prisma.liveMetric.create({
        data: {
          report_date:  date,
          live_id:      row.live_id     ? String(row.live_id)    : null,
          live_title:   row.live_title  ? String(row.live_title) : null,
          viewers:      row.viewers     != null ? Math.round(row.viewers)      : null,
          peak_viewers: row.peak_viewers != null ? Math.round(row.peak_viewers) : null,
          sessions:     row.sessions    != null ? Math.round(row.sessions)     : null,
          ctr:          row.ctr         ?? null,
          ctor:         row.ctor        ?? null,
          gmv:          row.gmv         ?? null,
          orders:       row.orders      != null ? Math.round(row.orders)       : null,
          gpm:          row.gpm         ?? null,
          duration_sec: row.duration_min != null ? Math.round(row.duration_min) : null,
        },
      });
      n++;
    }
    console.log('live_metrics:', n, 'filas');
    const s = await prisma.liveMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  sample: gpm=' + s.gpm, 'gmv=' + s.gmv);
  }

  // ── 🟡7 Product List: save metrics to product_metrics ─────────────────────
  {
    const { rows } = await parseCSV(path.join(D, 'product_list.xlsx - Sheet1.csv'));
    const reportDate = new Date('2026-05-29T00:00:00.000Z');
    let n = 0;
    for (const row of rows) {
      if (!row.product_id) continue;
      await prisma.product.upsert({
        where: { product_id: String(row.product_id) },
        update: { product_name: row.product_name ?? undefined },
        create: { product_id: String(row.product_id), product_name: row.product_name ?? 'Sin nombre' },
      });
      const hasMetrics = row.gmv != null || row.orders != null || row.impressions != null;
      if (hasMetrics) {
        await prisma.productMetric.upsert({
          where: {
            product_id_report_date_channel: {
              product_id: String(row.product_id),
              report_date: reportDate,
              channel: 'all',
            },
          },
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
      n++;
    }
    console.log('product_metrics (from product_list):', n, 'productos');
    const s = await prisma.productMetric.findFirst({ where: { channel: 'all' }, orderBy: { impressions: 'desc' } });
    if (s) console.log('  top impressions:', s.impressions, 'ctr=' + s.ctr, 'gmv=' + s.gmv);
  }

  // ── 🟡8 Store: CTR ────────────────────────────────────────────────────────
  {
    const { rows } = await parseCSV(path.join(D, 'Store Page Performance_Overview_20260530163827.xlsx - Sheet1.csv'));
    await prisma.storeMetric.deleteMany();
    let n = 0;
    for (const row of rows) {
      const date = parseDate(row.date);
      if (!date) continue;
      await prisma.storeMetric.upsert({
        where: { report_date: date },
        update: {
          visitors:        row.visitors   != null ? Math.round(row.visitors)   : undefined,
          page_views:      row.views      != null ? Math.round(row.views)      : undefined,
          gmv:             row.gmv        ?? undefined,
          orders:          row.orders     != null ? Math.round(row.orders)     : undefined,
          customers:       row.customers  != null ? Math.round(row.customers)  : undefined,
          ctr:             row.ctr        ?? undefined,
        },
        create: {
          report_date:     date,
          visitors:        row.visitors   != null ? Math.round(row.visitors)   : null,
          page_views:      row.views      != null ? Math.round(row.views)      : null,
          gmv:             row.gmv        ?? null,
          orders:          row.orders     != null ? Math.round(row.orders)     : null,
          customers:       row.customers  != null ? Math.round(row.customers)  : null,
          ctr:             row.ctr        ?? null,
        },
      });
      n++;
    }
    console.log('store_metrics:', n, 'filas');
    const s = await prisma.storeMetric.findFirst({ orderBy: { report_date: 'asc' } });
    if (s) console.log('  sample: visitors=' + s.visitors, 'ctr=' + s.ctr, 'gmv=' + s.gmv);
  }

  console.log('\n✔ Re-importación 🟡 completada');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
