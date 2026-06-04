'use strict';
const kpi = require('../services/kpi.service');

async function getTopProducts(req, res) {
  const { metric = 'gmv', limit = 10, start, end } = req.query;
  const data = await kpi.getTopProducts(metric, parseInt(limit), start, end);
  res.json(data);
}

async function getProductsWithoutSales(req, res) {
  const { start, end } = req.query;
  const data = await kpi.getProductsWithoutSales(start, end);
  res.json(data);
}

module.exports = { getTopProducts, getProductsWithoutSales };
