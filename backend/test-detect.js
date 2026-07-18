const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./src/services/csvParser.service');
const { detectReportType } = require('./src/services/reportDetector.service');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Uso: node test-detect.js <ruta-al-csv>');
  process.exit(1);
}

const csvContent = fs.readFileSync(filePath, 'utf8');

parseCSV(csvContent).then(({ headers, canonicalHeaders, rows }) => {
  console.log('=== HEADERS ORIGINALES (primeros 10) ===');
  console.log(headers.slice(0, 10).join(', '));
  
  console.log('\n=== HEADERS CANÓNICOS (primeros 10) ===');
  console.log(canonicalHeaders.slice(0, 10).join(', '));
  
  console.log('\n=== DETECCIÓN ===');
  const result = detectReportType(canonicalHeaders, rows[0] || {});
  console.log('Tipo detectado:', result.type || 'NO DETECTADO');
  console.log('Nombre:', result.name || 'N/A');
  console.log('Score:', result.score);
  
  if (!result.type) {
    console.log('\nColumnas disponibles:', canonicalHeaders.join(', '));
  }
}).catch(err => {
  console.error('Error:', err.message);
  console.error(err.stack);
});
