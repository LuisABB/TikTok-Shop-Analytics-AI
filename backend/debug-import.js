const fs = require('fs');
const path = require('path');

// Simular la función readCSVFileContent del import.controller.js
function readCSVFileContent(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer || buffer.length === 0) {
    console.log('❌ Buffer vacío');
    return '';
  }
  
  console.log('📦 Buffer size:', buffer.length, 'bytes');
  console.log('📦 Primeros 10 bytes:', Array.from(buffer.slice(0, 10)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
  
  // Check for UTF-16 BOM
  const hasUtf16LEBom = buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe;
  const hasUtf16BEBom = buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff;
  
  if (hasUtf16LEBom) {
    console.log('✅ Detectado UTF-16 LE BOM');
    return buffer.toString('utf16le');
  }
  if (hasUtf16BEBom) {
    console.log('✅ Detectado UTF-16 BE BOM');
    return buffer.toString('utf16le');
  }
  
  // Heuristic: check for null bytes at odd positions (UTF-16 LE pattern)
  const sampleLen = Math.min(buffer.length, 4096);
  let nullOdd = 0;
  let oddCount = 0;
  
  for (let i = 1; i < sampleLen; i += 2) {
    oddCount++;
    if (buffer[i] === 0x00) {
      nullOdd++;
    }
  }
  
  const nullRatio = oddCount > 0 ? (nullOdd / oddCount) : 0;
  console.log('📊 Null bytes en posiciones impares:', nullOdd, '/', oddCount, '=', (nullRatio * 100).toFixed(1) + '%');
  
  if (nullRatio > 0.2) {
    console.log('✅ Detectado UTF-16 LE por heurística');
    return buffer.toString('utf16le');
  }
  
  console.log('✅ Usando UTF-8');
  return buffer.toString('utf8');
}

async function debugImport() {
  console.log('═══════════════════════════════════════════════');
  console.log('🔍 DEBUG: Simulando importación de CSV');
  console.log('═══════════════════════════════════════════════\n');
  
  const csvPath = path.join(__dirname, '../sample-csvs/Creator-Live-Performance_20260604180014.xlsx - Sheet1.csv');
  
  console.log('1️⃣ PASO 1: Leer archivo');
  console.log('   Ruta:', csvPath);
  console.log('   Existe:', fs.existsSync(csvPath) ? '✅' : '❌');
  
  if (!fs.existsSync(csvPath)) {
    console.log('❌ El archivo no existe');
    return;
  }
  
  console.log('\n2️⃣ PASO 2: Detectar encoding y leer contenido');
  const csvContent = readCSVFileContent(csvPath);
  
  console.log('\n3️⃣ PASO 3: Mostrar primeras líneas del contenido');
  const lines = csvContent.split(/\r?\n/).slice(0, 5);
  lines.forEach((line, i) => {
    console.log(`   Línea ${i + 1}: ${line.substring(0, 120)}${line.length > 120 ? '...' : ''}`);
  });
  
  console.log('\n4️⃣ PASO 4: Parsear CSV con csvParser.service');
  const { parseCSV } = require('./src/services/csvParser.service');
  const parsed = await parseCSV(csvContent);
  
  console.log('   Headers originales (primeros 8):');
  parsed.headers.slice(0, 8).forEach((h, i) => {
    console.log(`     ${i + 1}. "${h}"`);
  });
  
  console.log('\n   Headers canónicos (primeros 8):');
  parsed.canonicalHeaders.slice(0, 8).forEach((h, i) => {
    console.log(`     ${i + 1}. "${h}"`);
  });
  
  console.log('\n   Número de filas de datos:', parsed.rows.length);
  
  console.log('\n5️⃣ PASO 5: Detectar tipo de reporte');
  const { detectReportType } = require('./src/services/reportDetector.service');
  const detected = detectReportType(parsed.canonicalHeaders);
  
  if (detected) {
    console.log('   ✅ Tipo detectado:', detected.type);
    console.log('   ✅ Nombre:', detected.name);
    console.log('   ✅ Score:', detected.score);
    console.log('   ✅ Ambiguo:', detected.ambiguous ? 'Sí' : 'No');
  } else {
    console.log('   ❌ NO SE PUDO DETECTAR EL TIPO');
    console.log('\n   🔍 Headers canónicos completos:');
    parsed.canonicalHeaders.forEach((h, i) => {
      console.log(`     ${i + 1}. "${h}"`);
    });
  }
  
  console.log('\n6️⃣ PASO 6: Verificar firma LIVE_SESSION_LIST');
  const required = ['live_title', 'start_time', 'duration', 'views'];
  console.log('   Campos requeridos:', required);
  required.forEach(field => {
    const found = parsed.canonicalHeaders.includes(field);
    console.log(`     ${found ? '✅' : '❌'} ${field}`);
  });
  
  console.log('\n═══════════════════════════════════════════════');
  console.log('✨ Debug completado');
  console.log('═══════════════════════════════════════════════');
}

debugImport().catch(err => {
  console.error('\n❌ ERROR DURANTE DEBUG:', err);
  console.error(err.stack);
});
