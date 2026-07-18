'use strict';
const router = require('express').Router();
const kpi    = require('../services/kpi.service');

// GET /api/orders/kpis?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/kpis', async (req, res) => {
  try {
    const { start, end } = req.query;
    const data = await kpi.getOrderKPIs(start, end);
    res.json(data);
  } catch (err) {
    console.error('[orders/kpis]', err);
    res.status(500).json({ error: 'Error al obtener KPIs de pedidos' });
  }
});

// GET /api/orders/gmv-trend?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/gmv-trend', async (req, res) => {
  try {
    const { start, end } = req.query;
    const data = await kpi.getOrderGMVTrend(start, end);
    res.json(data);
  } catch (err) {
    console.error('[orders/gmv-trend]', err);
    res.status(500).json({ error: 'Error al obtener tendencia GMV de pedidos' });
  }
});

module.exports = router;
