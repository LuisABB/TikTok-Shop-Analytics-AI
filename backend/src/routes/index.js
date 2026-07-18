'use strict';
const router = require('express').Router();

router.use('/import',    require('./import.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/products',  require('./products.routes'));
router.use('/videos',    require('./videos.routes'));
router.use('/live',      require('./live.routes'));
router.use('/seo',       require('./seo.routes'));
router.use('/ai',        require('./ai.routes'));
router.use('/analytics', require('./analytics.routes'));
router.use('/orders',    require('./orders.routes'));

router.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

module.exports = router;
