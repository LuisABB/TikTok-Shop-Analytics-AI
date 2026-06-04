'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/ai.controller');

router.get('/recommendations', ctrl.getRecommendations);

module.exports = router;
