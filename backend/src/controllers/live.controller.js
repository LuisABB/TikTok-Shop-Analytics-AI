'use strict';
const kpi = require('../services/kpi.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLiveKPIs(req, res) {
  const { start, end } = req.query;
  const data = await kpi.getLiveKPIs(start, end);
  res.json(data);
}

async function getLiveSessions(req, res) {
  const { limit = 20, start, end } = req.query;
  const where = {};
  if (start || end) {
    where.report_date = {};
    if (start) where.report_date.gte = new Date(start);
    if (end)   where.report_date.lte = new Date(end);
  }
  const sessions = await prisma.liveMetric.findMany({
    where: { ...where, sessions: { gt: 0 } },
    orderBy: { report_date: 'asc' },
    take: parseInt(limit),
  });
  res.json(sessions.map(s => ({
    ...s,
    gmv:  s.gmv  ? Number(s.gmv)  : null,
    ctr:  s.ctr  ? Number(s.ctr)  * 100 : null,
    ctor: s.ctor ? Number(s.ctor) * 100 : null,
  })));
}

module.exports = { getLiveKPIs, getLiveSessions };
