'use strict';
const express = require('express');
const router = express.Router();
const funnelService = require('../services/funnel.service');

/**
 * GET /api/analytics/funnel
 * Análisis completo del embudo de conversión
 * Query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD&channel=all
 */
router.get('/funnel', async (req, res, next) => {
  try {
    const { start, end, channel = 'all' } = req.query;
    const data = await funnelService.getFunnelAnalysis(start, end, channel);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/top-funnel-products
 * Top productos por performance en el embudo
 * Query params: ?metric=ctor&limit=10&start=YYYY-MM-DD&end=YYYY-MM-DD
 * metrics: ctr, add_to_cart_rate, ctor, unique_ctr, unique_ctor, impressions, clicks, add_to_cart, orders
 */
router.get('/top-funnel-products', async (req, res, next) => {
  try {
    const { metric = 'ctor', limit = 10, start, end } = req.query;
    const data = await funnelService.getTopProductsByFunnel(metric, parseInt(limit), start, end);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/financial
 * Análisis financiero completo
 * Query params: ?start=YYYY-MM-DD&end=YYYY-MM-DD&channel=all
 */
router.get('/financial', async (req, res, next) => {
  try {
    const { start, end, channel = 'all' } = req.query;
    const data = await funnelService.getFinancialAnalysis(start, end, channel);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/leakage
 * Productos con mayor pérdida en el embudo
 * Query params: ?stage=click_to_cart&limit=10&start=YYYY-MM-DD&end=YYYY-MM-DD
 * stages: impression_to_click, click_to_cart, cart_to_order
 */
router.get('/leakage', async (req, res, next) => {
  try {
    const { stage = 'click_to_cart', limit = 10, start, end } = req.query;
    const data = await funnelService.getProductsWithHighestLeakage(stage, parseInt(limit), start, end);
    res.json(data);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
