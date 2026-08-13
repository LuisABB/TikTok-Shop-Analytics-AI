'use strict';
const kpi = require('../services/kpi.service');

async function getVideoKPIs(req, res) {
  const { start, end } = req.query;
  const data = await kpi.getVideoKPIs(start, end);
  res.json(data);
}

async function getTopVideos(req, res) {
  const { limit = 10, start, end } = req.query;
  const data = await kpi.getTopVideos(parseInt(limit), start, end);
  res.json(data);
}

async function getVideoList(req, res) {
  const { limit = 15, start, end, q } = req.query;
  const data = await kpi.getVideoList(parseInt(limit), start, end, q);
  res.json(data);
}

module.exports = { getVideoKPIs, getTopVideos, getVideoList };
