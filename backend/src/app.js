'use strict';
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const routes  = require('./routes');

const app = express();

// ── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP desactivado para CDN en frontend

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Parseo de body ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Frontend estático ────────────────────────────────────────────────────────
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(path.join(frontendDir, 'public')));

// Fragmentos de página (SPA interna)
const VALID_PAGES = ['dashboard', 'import', 'products', 'videos', 'live', 'seo', 'ai'];
app.get('/pages/:page', (req, res) => {
  const { page } = req.params;
  if (!VALID_PAGES.includes(page)) {
    return res.status(404).json({ error: 'Página no encontrada' });
  }
  res.sendFile(path.join(frontendDir, 'pages', `${page}.html`));
});

// ── Rutas API ─────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── SPA fallback ──────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'public', 'index.html'));
});

// ── Manejo global de errores ──────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
