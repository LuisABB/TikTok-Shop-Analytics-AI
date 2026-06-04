'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/live.controller');

router.get('/kpis',     ctrl.getLiveKPIs);
router.get('/sessions', ctrl.getLiveSessions);

module.exports = router;
