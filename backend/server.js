'use strict';
require('dotenv').config();
require('express-async-errors');

const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🚀 TikTok Shop Analytics`);
  console.log(`   Servidor: http://localhost:${PORT}`);
  console.log(`   API:      http://localhost:${PORT}/api`);
  console.log(`   Entorno:  ${process.env.NODE_ENV || 'development'}\n`);
});
