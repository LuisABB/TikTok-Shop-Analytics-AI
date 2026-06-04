'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/dashboard.controller');

router.get('/summary',     ctrl.getExecutiveSummary);
router.get('/gmv-trend',   ctrl.getGMVTrend);
router.get('/diagnostics', ctrl.getDiagnostics);

module.exports = router;
