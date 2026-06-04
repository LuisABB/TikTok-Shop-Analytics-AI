'use strict';
const kpi        = require('../services/kpi.service');
const diagnostic = require('../services/diagnostic.service');
const ai         = require('../services/ai.service');

async function getRecommendations(req, res) {
  const { start, end } = req.query;

  const summary     = await kpi.getFullSummary(start, end);
  const diagnostics = diagnostic.generateDiagnostics(summary);

  const recommendations = await ai.generateRecommendations(summary, diagnostics, start, end);

  res.json({ recommendations, diagnostics, generated_at: new Date() });
}

module.exports = { getRecommendations };
