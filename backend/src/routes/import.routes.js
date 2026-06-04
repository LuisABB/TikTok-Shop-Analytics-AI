'use strict';
const router = require('express').Router();
const upload = require('../middleware/upload.middleware');
const ctrl   = require('../controllers/import.controller');

router.post('/',        upload.single('file'), ctrl.importCSV);
router.get('/history',  ctrl.getImportHistory);
router.delete('/:id',   ctrl.deleteReport);

module.exports = router;
