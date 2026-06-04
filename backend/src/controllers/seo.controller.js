'use strict';
const kpi = require('../services/kpi.service');

async function getSearchKPIs(req, res) {
  const { start, end } = req.query;
  const data = await kpi.getSearchKPIs(start, end);
  res.json(data);
}

async function getTopSearchProducts(req, res) {
  const { limit = 10, start, end } = req.query;
  const data = await kpi.getTopSearchProducts(parseInt(limit), start, end);
  res.json(data);
}

module.exports = { getSearchKPIs, getTopSearchProducts };
