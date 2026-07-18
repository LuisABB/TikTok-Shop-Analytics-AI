'use strict';
const kpi        = require('../services/kpi.service');
const diagnostic = require('../services/diagnostic.service');

async function getExecutiveSummary(req, res) {
  const { start, end } = req.query;
  const [sales, funnel, video, live, search] = await Promise.all([
    kpi.getSalesKPIs(start, end),
    kpi.getConversionFunnel(start, end),
    kpi.getVideoKPIs(start, end),
    kpi.getLiveKPIs(start, end),
    kpi.getSearchKPIs(start, end),
  ]);
  res.json({ sales, funnel, video, live, search });
}

async function getGMVTrend(req, res) {
  const { start, end } = req.query;
  const trend = await kpi.getGMVTrend(start, end);
  res.json(trend);
}

async function getDiagnostics(req, res) {
  const { start, end } = req.query;
  const summary     = await kpi.getFullSummary(start, end);
  const diagnostics = diagnostic.generateDiagnostics(summary);
  res.json(diagnostics);
}

async function getAvailableDates(_req, res) {
  const data = await kpi.getAvailableDates();
  res.json(data);
}

module.exports = { getExecutiveSummary, getGMVTrend, getDiagnostics, getAvailableDates };
