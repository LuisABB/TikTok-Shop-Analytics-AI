'use strict';
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const { parseCSV, parseDate } = require('../src/services/csvParser.service');
const p = new PrismaClient();

const W = '\x1b[37m', G = '\x1b[32m', R = '\x1b[31m', RESET = '\x1b[0m';
const ok  = '✔';
const err = '✘';

function chk(a, b, isInt) {
  if (a == null && b == null) return ok;
  if (a == null || b == null) return err;
  const diff = Math.abs(Number(a) - Number(b));
  return diff < (isInt ? 1 : 0.005) ? ok : err;
}

function row(date, field, csv, db, isInt) {
  const mark = chk(csv, db, isInt);
  const color = mark === ok ? G : R;
  return `${W}${(date+'').padEnd(12)}${RESET} | ${field.padEnd(15)} | ${String(csv ?? 'null').padEnd(13)} | ${String(db ?? 'null').padEnd(13)} | ${color}${mark}${RESET}`;
}

const CSV = path.join(__dirname, '../../sample-csvs');

async function main() {
  const header = () => {
    console.log(`${'─'.repeat(75)}`);
    console.log(`${'FECHA/ID'.padEnd(12)} | ${'CAMPO'.padEnd(15)} | ${'CSV'.padEnd(13)} | ${'DB'.padEnd(13)} | OK`);
    console.log(`${'─'.repeat(75)}`);
  };

  // ── core_metrics ─────────────────────────────────────────────────────────
  console.log(`\n\x1b[36m═══ core_metrics ← Shop Analytics\x1b[0m`);
  header();
  const { rows: cRows } = await parseCSV(path.join(CSV, 'Shop Analytics_Key metrics_20260530.xlsx - Sheet1.csv'));
  const cDB = await p.coreMetric.findMany({ orderBy: { report_date: 'asc' } });
  let n = 0;
  for (const r of cRows) {
    const d = parseDate(r.date);
    if (!d) continue;
    const key = d.toISOString().slice(0,10);
    const db = cDB.find(x => x.report_date.toISOString().slice(0,10) === key);
    if (!db) continue;
    console.log(row(key, 'gmv',       r.gmv,       db.gmv));
    console.log(row('',  'orders',    r.orders,    db.orders,     true));
    console.log(row('',  'customers', r.customers, db.customers,  true));
    console.log(row('',  'items_sold',r.items_sold,db.items_sold, true));
    console.log(row('',  'aov',       r.aov,       db.aov));
    console.log();
    if (++n >= 3) break;
  }

  // ── store_metrics ─────────────────────────────────────────────────────────
  console.log(`\x1b[36m═══ store_metrics ← Store Page Performance\x1b[0m`);
  header();
  const { rows: sRows } = await parseCSV(path.join(CSV, 'Store Page Performance_Overview_20260530163827.xlsx - Sheet1.csv'));
  const sDB = await p.storeMetric.findMany({ orderBy: { report_date: 'asc' } });
  n = 0;
  for (const r of sRows) {
    const d = parseDate(r.date);
    if (!d) continue;
    const key = d.toISOString().slice(0,10);
    const db = sDB.find(x => x.report_date.toISOString().slice(0,10) === key);
    if (!db) continue;
    console.log(row(key, 'visitors',  r.visitors,  db.visitors,  true));
    console.log(row('',  'page_views',r.views,     db.page_views,true));
    console.log(row('',  'gmv',       r.gmv,       db.gmv));
    console.log(row('',  'customers', r.customers, db.customers, true));
    console.log();
    if (++n >= 3) break;
  }

  // ── video_metrics ─────────────────────────────────────────────────────────
  console.log(`\x1b[36m═══ video_metrics ← Video Performance\x1b[0m`);
  header();
  const { rows: vRows } = await parseCSV(path.join(CSV, 'Video Performance Core Stats_20260530163028.xlsx - Sheet1.csv'));
  const vDB = await p.videoMetric.findMany({ orderBy: { report_date: 'asc' } });
  n = 0;
  for (const r of vRows) {
    const d = parseDate(r.date);
    if (!d) continue;
    const key = d.toISOString().slice(0,10);
    const db = vDB.find(x => x.report_date.toISOString().slice(0,10) === key);
    if (!db) continue;
    console.log(row(key, 'vv',    r.vv,    db.vv,    true));
    console.log(row('',  'gmv',   r.gmv,   db.gmv));
    console.log(row('',  'gpm',   r.gpm,   db.gpm));
    console.log(row('',  'ctor',  r.ctor,  db.ctor));
    console.log(row('',  'orders',r.orders,db.orders,true));
    console.log();
    if (++n >= 3) break;
  }

  // ── live_metrics ──────────────────────────────────────────────────────────
  console.log(`\x1b[36m═══ live_metrics ← Live Performance\x1b[0m`);
  header();
  const { rows: lRows } = await parseCSV(path.join(CSV, 'Live Performance Core Stats_20260530162857.xlsx - Sheet1.csv'));
  const lDB = await p.liveMetric.findMany({ orderBy: { report_date: 'asc' } });
  n = 0;
  for (const r of lRows) {
    const d = parseDate(r.date);
    if (!d) continue;
    const key = d.toISOString().slice(0,10);
    const db = lDB.find(x => x.report_date.toISOString().slice(0,10) === key);
    if (!db) continue;
    console.log(row(key, 'gmv',          r.gmv,          db.gmv));
    console.log(row('',  'ctor',         r.ctor,         db.ctor));
    console.log(row('',  'duration_min', r.duration_min, db.duration_min, true));
    console.log(row('',  'orders',       r.orders,       db.orders,       true));
    console.log();
    if (++n >= 3) break;
  }

  // ── service_metrics ───────────────────────────────────────────────────────
  console.log(`\x1b[36m═══ service_metrics ← Service Analysis\x1b[0m`);
  header();
  const { rows: svRows } = await parseCSV(path.join(CSV, 'Service Analysis 20260530163950.xlsx.xlsx - Sheet1.csv'));
  const svDB = await p.serviceMetric.findMany();
  for (const r of svRows) {
    const d = parseDate(r.date);
    if (!d) continue;
    const key = d.toISOString().slice(0,10);
    const db = svDB.find(x => x.report_date.toISOString().slice(0,10) === key);
    if (!db) continue;
    console.log(row(key, 'assigned_chats',    r.assigned_chats,    db.assigned_chats,    true));
    console.log(row('',  'response_rate',     r.response_rate,     db.response_rate));
    console.log(row('',  'satisfaction(null)',r.satisfaction_rate, db.satisfaction_rate));
    console.log(row('',  'avg_resp_time_s',   r.avg_response_time, db.avg_response_time_s, true));
    console.log();
  }

  // ── products ──────────────────────────────────────────────────────────────
  console.log(`\x1b[36m═══ products ← product_list\x1b[0m`);
  header();
  const { rows: pRows } = await parseCSV(path.join(CSV, 'product_list.xlsx - Sheet1.csv'));
  const pDB = await p.product.findMany();
  n = 0;
  for (const r of pRows) {
    if (!r.product_id) continue;
    const db = pDB.find(x => x.product_id === String(r.product_id));
    if (!db) continue;
    const nameOk = db.product_name === r.product_name ? ok : err;
    const color = nameOk === ok ? G : R;
    console.log(`${W}${String(r.product_id).slice(-10).padEnd(12)}${RESET} | ${'product_name'.padEnd(15)} | ${r.product_name.slice(0,13).padEnd(13)} | ${db.product_name.slice(0,13).padEnd(13)} | ${color}${nameOk}${RESET}`);
    if (++n >= 5) break;
  }

  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
