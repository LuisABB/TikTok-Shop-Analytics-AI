/**
 * verify-quality.js — CSV vs DB data quality check
 * Ejecutar desde: backend/  →  node scripts/verify-quality.js
 */
const { PrismaClient } = require('@prisma/client');
const { parseCSV, parseDate } = require('../src/services/csvParser.service');
const path = require('path');

const prisma = new PrismaClient();
const D = path.join(__dirname, '../../sample-csvs');

// ── helpers ────────────────────────────────────────────────────────────────
const pct   = (a, b) => b === 0 ? 'n/a' : ((a / b) * 100).toFixed(1) + '%';
const fmt   = v => v == null ? 'NULL' : String(v);
const numEq = (a, b, tol = 0.01) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= tol;
};
const PASS = '✓';
const FAIL = '✗';

function checkRow(label, csvVal, dbVal, tol) {
  const ok = numEq(csvVal, dbVal, tol ?? 0.01);
  return `  ${ok ? PASS : FAIL} ${label}: csv=${fmt(csvVal)} db=${fmt(dbVal)}`;
}

let totalChecks = 0, totalFails = 0;
function report(label, issues) {
  totalChecks++;
  if (issues.length) {
    totalFails++;
    console.log(`\n[FAIL] ${label}`);
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log(`[PASS] ${label}`);
  }
}

// ── 1. core_metrics ────────────────────────────────────────────────────────
async function checkCore() {
  const { rows } = await parseCSV(path.join(D, 'Core Stats_20260530163705.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbRows  = await prisma.coreMetric.findMany({ orderBy: { report_date: 'asc' } });

  const issues = [];
  if (csvRows.length !== dbRows.length)
    issues.push(`row count: csv=${csvRows.length} db=${dbRows.length}`);

  // Spot-check first, middle, last
  for (const idx of [0, Math.floor(csvRows.length / 2), csvRows.length - 1]) {
    const c = csvRows[idx];
    const d = dbRows[idx];
    if (!c || !d) continue;
    const label = c.date;
    if (!numEq(c.gmv, d.gmv))       issues.push(`${label} gmv: csv=${c.gmv} db=${d.gmv}`);
    if (!numEq(c.orders, d.orders)) issues.push(`${label} orders: csv=${c.orders} db=${d.orders}`);
    if (!numEq(c.viewers, d.impressions)) issues.push(`${label} impressions(viewers): csv=${c.viewers} db=${d.impressions}`);
    if (!numEq(c.clicks, d.clicks)) issues.push(`${label} clicks: csv=${c.clicks} db=${d.clicks}`);
    if (!numEq(c.add_to_cart_users, d.add_to_cart_users)) issues.push(`${label} add_to_cart_users: csv=${c.add_to_cart_users} db=${d.add_to_cart_users}`);
    // aov=0 should be null
    if (c.aov == 0 && d.aov != null) issues.push(`${label} aov=0 should be null, db=${d.aov}`);
  }

  // Check no aov=0 in DB
  const zeroAov = await prisma.coreMetric.count({ where: { aov: 0 } });
  if (zeroAov > 0) issues.push(`${zeroAov} rows with aov=0 (should be null)`);

  report('core_metrics (' + dbRows.length + ' filas)', issues);
}

// ── 2. store_metrics ───────────────────────────────────────────────────────
async function checkStore() {
  const { rows } = await parseCSV(path.join(D, 'Store Page Performance_Overview_20260530163827.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbRows  = await prisma.storeMetric.findMany({ orderBy: { report_date: 'asc' } });

  const issues = [];
  if (csvRows.length !== dbRows.length)
    issues.push(`row count: csv=${csvRows.length} db=${dbRows.length}`);

  for (const idx of [0, Math.floor(csvRows.length / 2), csvRows.length - 1]) {
    const c = csvRows[idx]; const d = dbRows[idx];
    if (!c || !d) continue;
    if (!numEq(c.visitors, d.visitors)) issues.push(`${c.date} visitors: csv=${c.visitors} db=${d.visitors}`);
    if (!numEq(c.ctr, d.ctr, 0.0001)) issues.push(`${c.date} ctr: csv=${c.ctr} db=${d.ctr}`);
    if (!numEq(c.gmv, d.gmv))         issues.push(`${c.date} gmv: csv=${c.gmv} db=${d.gmv}`);
  }
  report('store_metrics (' + dbRows.length + ' filas)', issues);
}

// ── 3. live_metrics ────────────────────────────────────────────────────────
async function checkLive() {
  const { rows } = await parseCSV(path.join(D, 'Live Performance Core Stats_20260530162857.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbRows  = await prisma.liveMetric.findMany({ orderBy: { report_date: 'asc' } });

  const issues = [];
  if (csvRows.length !== dbRows.length)
    issues.push(`row count: csv=${csvRows.length} db=${dbRows.length}`);

  for (const idx of [0, Math.floor(csvRows.length / 2), csvRows.length - 1]) {
    const c = csvRows[idx]; const d = dbRows[idx];
    if (!c || !d) continue;
    if (!numEq(c.gmv, d.gmv))         issues.push(`${c.date} gmv: csv=${c.gmv} db=${d.gmv}`);
    if (!numEq(c.orders, d.orders))   issues.push(`${c.date} orders: csv=${c.orders} db=${d.orders}`);
    if (!numEq(c.gpm, d.gpm, 0.001))  issues.push(`${c.date} gpm: csv=${c.gpm} db=${d.gpm}`);
    if (!numEq(c.duration_min, d.duration_sec)) issues.push(`${c.date} duration_sec: csv=${c.duration_min} db=${d.duration_sec}`);
    if (!numEq(c.viewers, d.viewers)) issues.push(`${c.date} viewers: csv=${c.viewers} db=${d.viewers}`);
  }
  report('live_metrics (' + dbRows.length + ' filas)', issues);
}

// ── 4. video_metrics ───────────────────────────────────────────────────────
async function checkVideo() {
  const { rows } = await parseCSV(path.join(D, 'Video Performance Core Stats_20260530163028.xlsx - Sheet1.csv'));
  const dbCount = await prisma.videoMetric.count();
  const issues  = [];

  if (rows.length !== dbCount)
    issues.push(`row count: csv=${rows.length} db=${dbCount}`);

  // Check GMV attribution: only row.gmv (not gmv_attributed/indirect) saved
  const dbRow = await prisma.videoMetric.findFirst({ orderBy: { report_date: 'asc' } });
  const csvRow = rows[0];
  if (dbRow && csvRow) {
    if (!numEq(csvRow.gmv, dbRow.gmv)) issues.push(`row0 gmv: csv=${csvRow.gmv} db=${dbRow.gmv}`);
    if (!numEq(csvRow.orders, dbRow.orders)) issues.push(`row0 orders: csv=${csvRow.orders} db=${dbRow.orders}`);
    if (!numEq(csvRow.gpm, dbRow.gpm, 0.001)) issues.push(`row0 gpm: csv=${csvRow.gpm} db=${dbRow.gpm}`);
  }
  report('video_metrics (' + dbCount + ' filas)', issues);
}

// ── 5. service_metrics ─────────────────────────────────────────────────────
async function checkService() {
  const { rows } = await parseCSV(path.join(D, 'Service Analysis 20260530163950.xlsx.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbCount = await prisma.serviceMetric.count();
  const issues  = [];

  // CSV has multiple agents per day; DB should have one row per (date, agent)
  const uniquePairs = new Set(csvRows.map(r => `${r.date}__${r.agent_id ?? ''}`));
  if (uniquePairs.size !== dbCount)
    issues.push(`unique (date,agent) pairs: csv=${uniquePairs.size} db=${dbCount}`);

  // Spot-check: verify agent_alias is saved
  const withAlias = await prisma.serviceMetric.count({ where: { agent_alias: { not: null } } });
  if (withAlias === 0) issues.push('no rows have agent_alias (alias no guardado)');

  // Check avg_response_time_s is Float (non-integer value exists)
  const floatCheck = await prisma.serviceMetric.findFirst({ where: { avg_response_time_s: { not: null } } });
  if (floatCheck && Number.isInteger(floatCheck.avg_response_time_s))
    issues.push(`avg_response_time_s looks like integer: ${floatCheck.avg_response_time_s}`);

  report('service_metrics (' + dbCount + ' filas)', issues);
}

// ── 6. product_card_daily_metrics ──────────────────────────────────────────
async function checkProductCard() {
  const { rows } = await parseCSV(path.join(D, 'Product Card Traffic Stats_20260530163410.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbCount = await prisma.productCardDailyMetric.count();
  const issues  = [];

  if (csvRows.length !== dbCount)
    issues.push(`row count: csv=${csvRows.length} db=${dbCount}`);

  const sample = await prisma.productCardDailyMetric.findFirst({ orderBy: { report_date: 'asc' } });
  const csvSample = csvRows[0];
  if (sample && csvSample) {
    if (!numEq(csvSample.views, sample.views))   issues.push(`row0 views: csv=${csvSample.views} db=${sample.views}`);
    if (!numEq(csvSample.clicks, sample.clicks)) issues.push(`row0 clicks: csv=${csvSample.clicks} db=${sample.clicks}`);
    if (!numEq(csvSample.orders, sample.orders)) issues.push(`row0 orders: csv=${csvSample.orders} db=${sample.orders}`);
  }
  report('product_card_daily_metrics (' + dbCount + ' filas)', issues);
}

// ── 7. channel_search_metrics ──────────────────────────────────────────────
async function checkChannelSearch() {
  const { rows } = await parseCSV(path.join(D, 'Channel Stats - Search_20260530163738.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => parseDate(r.date));
  const dbCount = await prisma.channelSearchMetric.count();
  const issues  = [];

  if (csvRows.length !== dbCount)
    issues.push(`row count: csv=${csvRows.length} db=${dbCount}`);

  // Check impressions saved (from 'viewers' canonical)
  const withImpressions = await prisma.channelSearchMetric.count({ where: { impressions: { not: null } } });
  if (withImpressions === 0) issues.push('impressions all null (Espectadores not mapped)');

  const sample = await prisma.channelSearchMetric.findFirst({ orderBy: { report_date: 'asc' } });
  const csvSample = csvRows[0];
  if (sample && csvSample) {
    const csvImpressions = csvSample.impressions ?? csvSample.viewers ?? null;
    if (!numEq(csvImpressions, sample.impressions)) issues.push(`row0 impressions: csv=${csvImpressions} db=${sample.impressions}`);
    if (!numEq(csvSample.clicks, sample.clicks)) issues.push(`row0 clicks: csv=${csvSample.clicks} db=${sample.clicks}`);
    // aov=0 should be null
    if (csvSample.aov == 0 && sample.aov != null) issues.push(`row0 aov=0 should be null, db=${sample.aov}`);
  }
  report('channel_search_metrics (' + dbCount + ' filas)', issues);
}

// ── 8. products + product_metrics ─────────────────────────────────────────
async function checkProducts() {
  const { rows } = await parseCSV(path.join(D, 'product_list.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => r.product_id);
  const dbCount = await prisma.product.count();
  const metricsCount = await prisma.productMetric.count({ where: { channel: 'all' } });
  const issues  = [];

  if (csvRows.length !== dbCount)
    issues.push(`product count: csv=${csvRows.length} db=${dbCount}`);

  const withMetrics = await prisma.productMetric.count({ where: { channel: 'all', impressions: { not: null } } });
  if (withMetrics === 0) issues.push('product_metrics: ningún producto tiene impressions guardadas');

  const topCsv = [...csvRows].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0];
  if (topCsv) {
    const dbMetric = await prisma.productMetric.findFirst({
      where: { product_id: String(topCsv.product_id), channel: 'all' },
    });
    if (!dbMetric) {
      issues.push(`producto top (${topCsv.product_id}) sin metrics en DB`);
    } else {
      if (!numEq(topCsv.impressions, dbMetric.impressions))
        issues.push(`top product impressions: csv=${topCsv.impressions} db=${dbMetric.impressions}`);
      if (!numEq(topCsv.ctr, dbMetric.ctr, 0.001))
        issues.push(`top product ctr: csv=${topCsv.ctr} db=${dbMetric.ctr}`);
    }
  }
  report(`products (${dbCount}) + product_metrics channel=all (${metricsCount})`, issues);
}

// ── 9. search_metrics ─────────────────────────────────────────────────────
async function checkSearch() {
  const { rows } = await parseCSV(path.join(D, 'Channel Product List - Search_20260530163752.xlsx - Sheet1.csv'));
  const dbCount = await prisma.searchMetric.count();
  const issues  = [];
  if (rows.length !== dbCount)
    issues.push(`row count: csv=${rows.length} db=${dbCount}`);
  const withKeyword = await prisma.searchMetric.count({ where: { keyword: { not: null } } });
  if (withKeyword === 0 && rows.some(r => r.keyword))
    issues.push('keywords no guardados');
  report('search_metrics (' + dbCount + ' filas)', issues);
}

// ── 10. products_card_list (PRODUCTS_CARD_LIST) ───────────────────────────
async function checkProductsCardList() {
  const { rows } = await parseCSV(path.join(D, 'Products Card List_20260530163420.xlsx - Sheet1.csv'));
  const csvRows = rows.filter(r => r.product_id);
  // Estos van a product_metrics, channel= whatever date they came from
  const dbCount = await prisma.productMetric.count();
  const issues  = [];
  if (csvRows.length === 0) issues.push('CSV sin filas con product_id');
  // Just verify there are product_metrics rows
  if (dbCount === 0) issues.push('product_metrics vacío');
  report(`products_card_list (csv=${csvRows.length} filas con pid, product_metrics total=${dbCount})`, issues);
}

// ── main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  VERIFICACIÓN DE CALIDAD: CSV  →  BD');
  console.log('═══════════════════════════════════════════════════════\n');

  await checkCore();
  await checkStore();
  await checkLive();
  await checkVideo();
  await checkService();
  await checkProductCard();
  await checkChannelSearch();
  await checkProducts();
  await checkSearch();
  await checkProductsCardList();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Resultado: ${totalChecks - totalFails}/${totalChecks} tablas OK` +
    (totalFails ? `  ← ${totalFails} con problemas` : '  ✔ Sin problemas'));
  console.log('═══════════════════════════════════════════════════════');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
