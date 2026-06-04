'use strict';
/**
 * verify-db.js  —  Compara los datos de los CSV con lo que está en la BD
 * Uso: node scripts/verify-db.js
 */
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { parseCSV, extractDateRange, parseDate } = require('../src/services/csvParser.service');
const { detectReportType } = require('../src/services/reportDetector.service');

const prisma = new PrismaClient();
const CSV_DIR = path.join(__dirname, '../../sample-csvs');

// ── Utilidades de salida ──────────────────────────────────────────────────────
const R = '\x1b[31m'; const G = '\x1b[32m'; const Y = '\x1b[33m';
const C = '\x1b[36m'; const W = '\x1b[37m'; const RESET = '\x1b[0m';
const ok  = (s) => `${G}✔ ${s}${RESET}`;
const err = (s) => `${R}✘ ${s}${RESET}`;
const warn = (s) => `${Y}⚠ ${s}${RESET}`;
const section = (s) => `\n${C}${'─'.repeat(60)}\n  ${s}\n${'─'.repeat(60)}${RESET}`;

let totalChecks = 0, totalOk = 0, totalFail = 0, totalSkip = 0;

function near(a, b, tol = 0.005) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) <= tol;
}

function checkField(label, csvVal, dbVal, isPercent = false) {
  totalChecks++;
  const csvN = csvVal == null ? null : Number(csvVal);
  const dbN  = dbVal  == null ? null : Number(dbVal);
  const tol  = isPercent ? 0.005 : (Math.abs(csvN || 0) > 1000 ? 1 : 0.01);
  if (near(csvN, dbN, tol)) {
    totalOk++;
    return null; // sin error
  }
  totalFail++;
  return `  ${label}: CSV=${csvVal} vs DB=${dbVal}`;
}

function fmtDate(d) {
  return d ? d.toISOString().slice(0, 10) : 'null';
}

// ── CSV → mapa canonico de filas ─────────────────────────────────────────────

async function loadCSV(filename) {
  const fp = path.join(CSV_DIR, filename);
  const { headers, rows } = await parseCSV(fp);
  const detected = detectReportType(headers);
  const { startDate } = extractDateRange(rows);
  return { headers, rows, detected, fallbackDate: startDate || new Date() };
}

// ── 1. core_metrics ──────────────────────────────────────────────────────────

async function verifyCoreMetrics() {
  console.log(section('core_metrics  ←  Core Stats + Shop Analytics'));

  const files = [
    'Core Stats_20260530163705.xlsx - Sheet1.csv',
    'Shop Analytics_Key metrics_20260530.xlsx - Sheet1.csv',
  ];

  // Reconstruir el mismo mapa que handleCoreStats usaría
  const csvMap = new Map(); // report_date ISO → row
  for (const f of files) {
    const { rows } = await loadCSV(f);
    for (const row of rows) {
      const d = parseDate(row.date);
      if (!d) continue;
      const key = fmtDate(d);
      const existing = csvMap.get(key) || {};
      // upsert los campos (shop analytics sobreescribe core stats para mismas fechas)
      csvMap.set(key, {
        gmv:        row.gmv        ?? existing.gmv,
        orders:     row.orders     ?? existing.orders,
        customers:  row.customers  ?? existing.customers,
        items_sold: row.items_sold ?? existing.items_sold,
        aov:        row.aov        ?? existing.aov,
      });
    }
  }

  const dbRows = await prisma.coreMetric.findMany({ orderBy: { report_date: 'asc' } });
  console.log(`  CSV: ${csvMap.size} fechas  |  DB: ${dbRows.length} filas`);

  let fails = 0;
  for (const db of dbRows) {
    const key = fmtDate(db.report_date);
    const csv = csvMap.get(key);
    if (!csv) {
      console.log(warn(`  ${key} → en DB pero NO en CSV`));
      totalSkip++; continue;
    }
    const errs = [
      checkField('gmv',       csv.gmv,       db.gmv),
      checkField('orders',    csv.orders,     db.orders),
      checkField('customers', csv.customers,  db.customers),
      checkField('items_sold',csv.items_sold, db.items_sold),
      checkField('aov',       csv.aov,        db.aov),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ${key}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ${key}`)); }
  }
  console.log(`  → ${dbRows.length - fails} correctos, ${fails} con diferencias\n`);
}

// ── 2. store_metrics ─────────────────────────────────────────────────────────

async function verifyStoreMetrics() {
  console.log(section('store_metrics  ←  Store Page Performance'));

  const { rows } = await loadCSV('Store Page Performance_Overview_20260530163827.xlsx - Sheet1.csv');

  // Construir mapa CSV (misma lógica que handleStoreOverview)
  const csvMap = new Map();
  for (const row of rows) {
    const d = parseDate(row.date);
    if (!d) continue;
    csvMap.set(fmtDate(d), {
      visitors:   row.visitors,
      page_views: row.views,
      gmv:        row.gmv,
      customers:  row.customers,
    });
  }

  const dbRows = await prisma.storeMetric.findMany({ orderBy: { report_date: 'asc' } });
  console.log(`  CSV: ${csvMap.size} fechas  |  DB: ${dbRows.length} filas`);

  let fails = 0;
  for (const db of dbRows) {
    const key = fmtDate(db.report_date);
    const csv = csvMap.get(key);
    if (!csv) { console.log(warn(`  ${key} → en DB pero NO en CSV`)); totalSkip++; continue; }
    const errs = [
      checkField('visitors',  csv.visitors,  db.visitors),
      checkField('page_views',csv.page_views, db.page_views),
      checkField('gmv',       csv.gmv,       db.gmv),
      checkField('customers', csv.customers, db.customers),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ${key}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ${key}`)); }
  }
  console.log(`  → ${dbRows.length - fails} correctos, ${fails} con diferencias\n`);
}

// ── 3. products ──────────────────────────────────────────────────────────────

async function verifyProducts() {
  console.log(section('products  ←  product_list + Products Card List'));

  const files = [
    'product_list.xlsx - Sheet1.csv',
    'Products Card List_20260530163420.xlsx - Sheet1.csv',
    'Products Card List_20260530163528.xlsx - Sheet1.csv',
  ];
  const csvMap = new Map();
  for (const f of files) {
    const { rows } = await loadCSV(f);
    for (const row of rows) {
      if (!row.product_id) continue;
      const id = String(row.product_id);
      const existing = csvMap.get(id) || {};
      csvMap.set(id, {
        product_name: row.product_name || existing.product_name,
        status:       row.status       || existing.status,
      });
    }
  }

  const dbRows = await prisma.product.findMany();
  console.log(`  CSV: ${csvMap.size} productos  |  DB: ${dbRows.length} filas`);

  let missing = 0, nameOk = 0, nameFail = 0;
  for (const db of dbRows) {
    totalChecks++;
    const csv = csvMap.get(db.product_id);
    if (!csv) {
      missing++;
      console.log(warn(`  ${db.product_id.slice(-8)} → en DB pero NO en CSV`));
      continue;
    }
    const nameMatch = !csv.product_name || db.product_name === csv.product_name;
    if (nameMatch) { nameOk++; totalOk++; }
    else {
      nameFail++; totalFail++;
      console.log(err(`  ${db.product_id.slice(-8)}: nombre difiere\n    CSV="${csv.product_name}"\n    DB ="${db.product_name}"`));
    }
  }

  // Productos en CSV pero no en DB
  let csvOnly = 0;
  for (const [id] of csvMap) {
    if (!dbRows.find(d => d.product_id === id)) { csvOnly++; totalSkip++; }
  }
  console.log(`  → ${nameOk} nombres OK, ${nameFail} diferencias, ${missing} en DB sin CSV, ${csvOnly} en CSV sin DB\n`);
}

// ── 4. video_metrics ─────────────────────────────────────────────────────────

async function verifyVideoMetrics() {
  console.log(section('video_metrics  ←  Video Performance Core Stats'));

  const { rows } = await loadCSV('Video Performance Core Stats_20260530163028.xlsx - Sheet1.csv');

  // Agrupar por fecha (puede haber múltiples filas por fecha si se importó varias veces)
  const csvMap = new Map();
  for (const row of rows) {
    const d = parseDate(row.date);
    if (!d) continue;
    csvMap.set(fmtDate(d), {
      vv:    row.vv,
      gmv:   row.gmv,
      gpm:   row.gpm,
      ctor:  row.ctor,
      orders: row.orders,
    });
  }

  // En video_metrics no hay unique por date (hay create, no upsert) → tomamos 1 por fecha
  const dbRows = await prisma.videoMetric.findMany({ orderBy: { report_date: 'asc' } });
  // Deduplicar: quedarse con la primera ocurrencia por fecha
  const dbMap = new Map();
  for (const db of dbRows) {
    const k = fmtDate(db.report_date);
    if (!dbMap.has(k)) dbMap.set(k, db);
  }
  console.log(`  CSV: ${csvMap.size} fechas  |  DB: ${dbRows.length} filas (${dbMap.size} fechas únicas)`);

  let fails = 0;
  for (const [key, csv] of csvMap) {
    const db = dbMap.get(key);
    if (!db) { console.log(warn(`  ${key} → en CSV pero NO en DB`)); totalSkip++; continue; }
    const errs = [
      checkField('vv',    csv.vv,    db.vv),
      checkField('gmv',   csv.gmv,   db.gmv),
      checkField('gpm',   csv.gpm,   db.gpm),
      checkField('ctor',  csv.ctor,  db.ctor,  true),
      checkField('orders',csv.orders,db.orders),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ${key}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ${key}`)); }
  }
  console.log(`  → ${csvMap.size - fails} correctos, ${fails} con diferencias\n`);
}

// ── 5. live_metrics ──────────────────────────────────────────────────────────

async function verifyLiveMetrics() {
  console.log(section('live_metrics  ←  Live Performance Core Stats'));

  const { rows, fallbackDate } = await loadCSV('Live Performance Core Stats_20260530162857.xlsx - Sheet1.csv');

  const csvMap = new Map();
  for (const row of rows) {
    const d = (row.date ? parseDate(row.date) : null) || fallbackDate;
    const key = fmtDate(d);
    // La primera GMV disponible por fecha (última escritura gana en import)
    const existing = csvMap.get(key) || {};
    csvMap.set(key, {
      gmv:          row.gmv          ?? existing.gmv,
      ctor:         row.ctor         ?? existing.ctor,
      duration_min: row.duration_min ?? existing.duration_min,
      orders:       row.orders       ?? existing.orders,
    });
  }

  const dbRows = await prisma.liveMetric.findMany({ orderBy: { report_date: 'asc' } });
  const dbMap = new Map();
  for (const db of dbRows) {
    const k = fmtDate(db.report_date);
    if (!dbMap.has(k)) dbMap.set(k, db);
  }
  console.log(`  CSV: ${csvMap.size} fechas  |  DB: ${dbRows.length} filas (${dbMap.size} fechas únicas)`);

  let fails = 0;
  for (const [key, csv] of csvMap) {
    const db = dbMap.get(key);
    if (!db) { console.log(warn(`  ${key} → en CSV pero NO en DB`)); totalSkip++; continue; }
    const errs = [
      checkField('gmv',          csv.gmv,          db.gmv),
      checkField('ctor',         csv.ctor,         db.ctor,  true),
      checkField('duration_min', csv.duration_min, db.duration_min),
      checkField('orders',       csv.orders,       db.orders),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ${key}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ${key}`)); }
  }
  console.log(`  → ${csvMap.size - fails} correctos, ${fails} con diferencias\n`);
}

// ── 6. service_metrics ───────────────────────────────────────────────────────

async function verifyServiceMetrics() {
  console.log(section('service_metrics  ←  Service Analysis'));

  const { rows } = await loadCSV('Service Analysis 20260530163950.xlsx.xlsx - Sheet1.csv');

  const csvMap = new Map();
  for (const row of rows) {
    const d = parseDate(row.date);
    if (!d) continue;
    const key = fmtDate(d);
    const existing = csvMap.get(key) || {};
    csvMap.set(key, {
      assigned_chats:      (row.assigned_chats    != null ? Math.round(row.assigned_chats)    : existing.assigned_chats),
      response_rate:       (row.response_rate     ?? existing.response_rate),
      satisfaction_rate:   (row.satisfaction_rate ?? existing.satisfaction_rate),
      avg_response_time_s: (row.avg_response_time != null ? Math.round(row.avg_response_time) : existing.avg_response_time_s),
    });
  }

  const dbRows = await prisma.serviceMetric.findMany({ orderBy: { report_date: 'asc' } });
  console.log(`  CSV: ${csvMap.size} fechas  |  DB: ${dbRows.length} filas`);

  let fails = 0;
  for (const db of dbRows) {
    const key = fmtDate(db.report_date);
    const csv = csvMap.get(key);
    if (!csv) { console.log(warn(`  ${key} → en DB pero NO en CSV`)); totalSkip++; continue; }
    const errs = [
      checkField('assigned_chats',    csv.assigned_chats,    db.assigned_chats),
      checkField('response_rate',     csv.response_rate,     db.response_rate,     true),
      checkField('satisfaction_rate', csv.satisfaction_rate, db.satisfaction_rate, true),
      checkField('avg_response_time_s', csv.avg_response_time_s, db.avg_response_time_s),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ${key}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ${key}`)); }
  }
  console.log(`  → ${dbRows.length - fails} correctos, ${fails} con diferencias\n`);
}

// ── 7. search_metrics ────────────────────────────────────────────────────────

async function verifySearchMetrics() {
  console.log(section('search_metrics  ←  Products Card List (17 cols)'));

  // Solo el CSV con 17 columnas se importa en search_metrics
  const { rows, fallbackDate } = await loadCSV('Products Card List_20260530163528.xlsx - Sheet1.csv');

  const csvMap = new Map(); // product_id → row
  for (const row of rows) {
    if (!row.product_id) continue;
    csvMap.set(String(row.product_id), {
      gmv:             row.gmv,
      orders:          row.orders,
      conversion_rate: row.conversion_rate,
      clicks:          row.clicks,
    });
  }

  // Hay múltiples imports y múltiples fuentes (Channel Product List tiene keywords distintas).
  // Comparamos agrupando GMV/orders/clicks de todas las filas del DB por product_id
  // sin keyword (que son las de Products Card List) vs el CSV.
  const dbRows = await prisma.searchMetric.findMany({
    where: { keyword: null },   // Products Card List no tiene keywords
    orderBy: { id: 'desc' },    // más reciente primero
  });

  // Agrupar por product_id: primera ocurrencia = la más reciente (id desc)
  const dbMap = new Map();
  for (const db of dbRows) {
    if (!db.product_id) continue;
    if (!dbMap.has(db.product_id)) dbMap.set(db.product_id, db);
  }
  console.log(`  CSV: ${csvMap.size} productos  |  DB (sin keyword): ${dbRows.length} filas (${dbMap.size} product_ids únicos)`);
  console.log(`  Nota: clicks y conversion_rate solo se verifican en filas sin keyword (origen: Card List)`);

  let fails = 0;
  for (const [pid, csv] of csvMap) {
    const db = dbMap.get(pid);
    if (!db) { console.log(warn(`  ${pid.slice(-8)} → en CSV pero NO en DB`)); totalSkip++; continue; }
    const errs = [
      checkField('gmv',             csv.gmv,             db.gmv),
      checkField('orders',          csv.orders,          db.orders),
      checkField('conversion_rate', csv.conversion_rate, db.conversion_rate, true),
      checkField('clicks',          csv.clicks,          db.clicks),
    ].filter(Boolean);

    if (errs.length) { fails++; console.log(err(`  ...${pid.slice(-8)}`) + '\n' + errs.join('\n')); }
    else { console.log(ok(`  ...${pid.slice(-8)}`)); }
  }
  console.log(`  → ${csvMap.size - fails} correctos, ${fails} con diferencias\n`);
}

// ── 8. product_metrics  (esperamos 0 filas) ───────────────────────────────────

async function verifyProductMetrics() {
  console.log(section('product_metrics  ←  Product Card Traffic (sin product_id en CSV)'));
  const count = await prisma.productMetric.count();
  if (count === 0) {
    console.log(ok('  0 filas en DB — esperado (CSV no tiene columna product_id)'));
    totalOk++;
  } else {
    console.log(err(`  ${count} filas en DB — inesperado (CSV no tiene product_id)`));
    totalFail++;
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${W}${'═'.repeat(60)}`);
  console.log('  VERIFICACIÓN DE CALIDAD: CSV ↔ Base de Datos');
  console.log(`${'═'.repeat(60)}${RESET}`);

  try {
    await verifyCoreMetrics();
    await verifyStoreMetrics();
    await verifyProducts();
    await verifyVideoMetrics();
    await verifyLiveMetrics();
    await verifyServiceMetrics();
    await verifySearchMetrics();
    await verifyProductMetrics();
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${W}${'═'.repeat(60)}`);
  console.log('  RESUMEN FINAL');
  console.log(`${'═'.repeat(60)}${RESET}`);
  console.log(`  ${G}✔ Correctos : ${totalOk}${RESET}`);
  console.log(`  ${R}✘ Diferencias: ${totalFail}${RESET}`);
  console.log(`  ${Y}⚠ Omitidos  : ${totalSkip}${RESET}`);
  console.log(`  Total checks: ${totalChecks}`);

  if (totalFail === 0) {
    console.log(`\n  ${G}✔ La base de datos coincide con los CSV.${RESET}\n`);
  } else {
    console.log(`\n  ${R}✘ Hay ${totalFail} valores que no coinciden. Revisa arriba.${RESET}\n`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
