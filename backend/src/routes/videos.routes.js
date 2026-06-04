'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/videos.controller');

router.get('/kpis', ctrl.getVideoKPIs);
router.get('/top',  ctrl.getTopVideos);

module.exports = router;
