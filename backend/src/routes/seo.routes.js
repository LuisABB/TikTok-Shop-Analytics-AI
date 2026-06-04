'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/seo.controller');

router.get('/kpis',     ctrl.getSearchKPIs);
router.get('/products', ctrl.getTopSearchProducts);

module.exports = router;
