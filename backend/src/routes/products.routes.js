'use strict';
const router = require('express').Router();
const ctrl   = require('../controllers/products.controller');

router.get('/top',          ctrl.getTopProducts);
router.get('/no-sales',     ctrl.getProductsWithoutSales);

module.exports = router;
