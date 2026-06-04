'use strict';
const { PrismaClient } = require('@prisma/client');
const { parseCSV, extractDateRange, parseDate } = require('../src/services/csvParser.service');
const path = require('path');

const prisma = new PrismaClient();
const CSV_DIR = path.join(__dirname, '../../sample-csvs');

async function main() {
  // ── 1. Service Analysis ─────────────────────────────────────────────────
  console.log('\n── Limpiando service_metrics...');
  await prisma.serviceMetric.deleteMany();

  const serviceFile = path.join(CSV_DIR, 'Service Analysis 20260530163950.xlsx.xlsx - Sheet1.csv');
  const { rows: serviceRows } = await parseCSV(serviceFile);
  let saved = 0;
  for (const row of serviceRows) {
    const date = parseDate(row.date);
    if (!date) continue;
    const agentId = row.agent_id ? String(row.agent_id) : '';
    await prisma.serviceMetric.upsert({
      where: { report_date_agent_id: { report_date: date, agent_id: agentId } },
      update: {
        agent_alias: row.author ?? undefined,
        assigned_chats: row.assigned_chats != null ? Math.round(row.assigned_chats) : undefined,
        resolved_chats: row.resolved_chats != null ? Math.round(row.resolved_chats) : undefined,
        response_rate: row.response_rate ?? undefined,
        satisfaction_rate: row.satisfaction_rate ?? undefined,
        avg_response_time_s: row.avg_response_time ?? undefined,
      },
      create: {
        report_date: date, agent_id: agentId, agent_alias: row.author ?? null,
        assigned_chats: row.assigned_chats != null ? Math.round(row.assigned_chats) : null,
        resolved_chats: row.resolved_chats != null ? Math.round(row.resolved_chats) : null,
        response_rate: row.response_rate ?? null,
        satisfaction_rate: row.satisfaction_rate ?? null,
        avg_response_time_s: row.avg_response_time ?? null,
      },
    });
    saved++;
  }
  console.log(`  service_metrics: ${saved} filas guardadas`);

  // ── 2. Product Card Traffic (nuevo) ──────────────────────────────────────
  console.log('\n── Importando product_card_daily_metrics...');
  const cardFile = path.join(CSV_DIR, 'Product Card Traffic Stats_20260530163410.xlsx - Sheet1.csv');
  const { rows: cardRows, headers: cardHeaders } = await parseCSV(cardFile);
  const fallbackDate = new Date('2026-05-01');
  let cardSaved = 0;
  for (const row of cardRows) {
    const date = (row.date ? parseDate(row.date) : null) || fallbackDate;
    await prisma.productCardDailyMetric.upsert({
      where: { report_date: date },
      update: {
        views: row.views != null ? Math.round(row.views) : undefined,
        viewers: row.viewers != null ? Math.round(row.viewers) : undefined,
        clicks: row.clicks != null ? Math.round(row.clicks) : undefined,
        add_to_cart: row.add_to_cart != null ? Math.round(row.add_to_cart) : undefined,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : undefined,
        customers: row.customers != null ? Math.round(row.customers) : undefined,
        orders: row.orders != null ? Math.round(row.orders) : undefined,
        gmv: row.gmv ?? undefined,
        conversion_rate: row.conversion_rate ?? undefined,
        ctr: row.ctr ?? undefined,
      },
      create: {
        report_date: date,
        views: row.views != null ? Math.round(row.views) : null,
        viewers: row.viewers != null ? Math.round(row.viewers) : null,
        clicks: row.clicks != null ? Math.round(row.clicks) : null,
        add_to_cart: row.add_to_cart != null ? Math.round(row.add_to_cart) : null,
        add_to_cart_users: row.add_to_cart_users != null ? Math.round(row.add_to_cart_users) : null,
        customers: row.customers != null ? Math.round(row.customers) : null,
        orders: row.orders != null ? Math.round(row.orders) : null,
        gmv: row.gmv ?? null, conversion_rate: row.conversion_rate ?? null, ctr: row.ctr ?? null,
      },
    });
    cardSaved++;
  }
  console.log(`  product_card_daily_metrics: ${cardSaved} filas guardadas`);

  // ── 3. Video Performance (GMV fix) ────────────────────────────────────────
  console.log('\n── Limpiando video_metrics...');
  await prisma.videoMetric.deleteMany();
  const videoFile = path.join(CSV_DIR, 'Video Performance Core Stats_20260530163028.xlsx - Sheet1.csv');
  const { rows: videoRows } = await parseCSV(videoFile);
  let videoSaved = 0;
  for (const row of videoRows) {
    const date = row.date ? parseDate(row.date) : new Date('2026-05-01');
    await prisma.videoMetric.create({ data: {
      report_date: date,
      video_id: row.video_id ? String(row.video_id) : null,
      video_title: row.video_title ? String(row.video_title) : null,
      author: row.author ? String(row.author) : null,
      vv: row.vv != null ? Math.round(row.vv) : null,
      ctr: row.ctr ?? null, ctor: row.ctor ?? null,
      gmv: row.gmv ?? null, orders: row.orders != null ? Math.round(row.orders) : null,
      gpm: row.gpm ?? null,
    }});
    videoSaved++;
  }
  console.log(`  video_metrics: ${videoSaved} filas guardadas`);

  // ── 4. Live Performance (GMV fix) ─────────────────────────────────────────
  console.log('\n── Limpiando live_metrics...');
  await prisma.liveMetric.deleteMany();
  const liveFile = path.join(CSV_DIR, 'Live Performance Core Stats_20260530162857.xlsx - Sheet1.csv');
  const { rows: liveRows } = await parseCSV(liveFile);
  let liveSaved = 0;
  for (const row of liveRows) {
    const date = row.date ? parseDate(row.date) : new Date('2026-05-01');
    await prisma.liveMetric.create({ data: {
      report_date: date,
      live_id: null, live_title: null,
      viewers: row.viewers != null ? Math.round(row.viewers) : null,
      peak_viewers: null,
      ctr: row.ctr ?? null, ctor: row.ctor ?? null,
      gmv: row.gmv ?? null, orders: row.orders != null ? Math.round(row.orders) : null,
      duration_min: row.duration_min != null ? Math.round(row.duration_min) : null,
    }});
    liveSaved++;
  }
  console.log(`  live_metrics: ${liveSaved} filas guardadas`);

  // ── Verificar GMV fix ──────────────────────────────────────────────────────
  console.log('\n── Verificación GMV Video (primeras 3 filas):');
  const videos = await prisma.videoMetric.findMany({ take: 3, orderBy: { report_date: 'asc' } });
  for (const v of videos) console.log(`  ${v.report_date.toISOString().slice(0,10)} gmv=${v.gmv} orders=${v.orders} vv=${v.vv}`);

  console.log('\n── Verificación GMV Live (primeras 3 filas):');
  const lives = await prisma.liveMetric.findMany({ take: 3, orderBy: { report_date: 'asc' } });
  for (const l of lives) console.log(`  ${l.report_date.toISOString().slice(0,10)} gmv=${l.gmv} orders=${l.orders} viewers=${l.viewers}`);

  console.log('\n── Service metrics por agente (primeras 5):');
  const svcs = await prisma.serviceMetric.findMany({ take: 5, orderBy: { report_date: 'asc' } });
  for (const s of svcs) console.log(`  ${s.report_date.toISOString().slice(0,10)} agent="${s.agent_id}" alias="${s.agent_alias}" chats=${s.assigned_chats}`);

  console.log('\n── Product card daily (primeras 3):');
  const cards = await prisma.productCardDailyMetric.findMany({ take: 3, orderBy: { report_date: 'asc' } });
  for (const c of cards) console.log(`  ${c.report_date.toISOString().slice(0,10)} views=${c.views} clicks=${c.clicks} orders=${c.orders} gmv=${c.gmv}`);

  console.log('\n✔ Re-importación completada');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
