/**
 * pages/import.js — Módulo de importación de CSV (múltiples archivos).
 */
const ImportPage = (() => {

  // Cola de archivos: [{ file, status: 'pending'|'uploading'|'ok'|'error', msg }]
  let fileQueue = [];

  function init() {
    const zone     = document.getElementById('uploadZone');
    const input    = document.getElementById('fileInput');
    const btnSel   = document.getElementById('btnSelectFile');
    const btnImp   = document.getElementById('btnImport');
    const btnClear = document.getElementById('btnClearFile');
    const btnRef   = document.getElementById('btnRefreshHistory');

    if (!zone) return;

    btnSel?.addEventListener('click', () => input.click());

    input?.addEventListener('change', () => {
      if (input.files.length) addFiles(Array.from(input.files));
    });

    // Drag & drop (admite múltiples)
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
      if (files.length) addFiles(files);
      else showToast('Solo se aceptan archivos .csv', 'error');
    });

    btnImp?.addEventListener('click', doImportAll);
    btnClear?.addEventListener('click', clearAll);
    btnRef?.addEventListener('click', loadHistory);

    loadHistory();
  }

  function addFiles(files) {
    let added = 0;
    for (const f of files) {
      if (!f.name.endsWith('.csv')) continue;
      // Evitar duplicados por nombre
      if (fileQueue.some(q => q.file.name === f.file)) {
        // allow same name from different selection
      }
      fileQueue.push({ file: f, status: 'pending', msg: '' });
      added++;
    }
    if (!added) { showToast('No se encontraron CSV válidos', 'error'); return; }
    renderQueue();
    document.getElementById('fileQueue').style.display = 'block';
    document.getElementById('importResult').innerHTML = '';
    // Update button label
    const btn = document.getElementById('btnImport');
    if (btn) btn.innerHTML = `<i class="bi bi-upload me-2"></i>Importar ${fileQueue.length} CSV`;
  }

  function removeFromQueue(index) {
    fileQueue.splice(index, 1);
    if (!fileQueue.length) {
      clearAll();
    } else {
      renderQueue();
      const btn = document.getElementById('btnImport');
      if (btn) btn.innerHTML = `<i class="bi bi-upload me-2"></i>Importar ${fileQueue.length} CSV`;
    }
  }

  function renderQueue() {
    const list = document.getElementById('fileList');
    if (!list) return;
    list.innerHTML = fileQueue.map((item, i) => {
      const iconClass = item.status === 'ok'       ? 'bi-check-circle-fill text-success'
                      : item.status === 'error'    ? 'bi-x-circle-fill text-danger'
                      : item.status === 'uploading'? 'spinner-border spinner-border-sm text-primary'
                      :                              'bi-file-earmark-spreadsheet text-muted';
      const isSpinner = item.status === 'uploading';
      const sizeKB = (item.file.size / 1024).toFixed(1);
      return `
        <div class="d-flex align-items-center gap-2 border rounded px-3 py-2 mb-1 bg-white">
          ${isSpinner
            ? `<span class="spinner-border spinner-border-sm text-primary" style="flex-shrink:0"></span>`
            : `<i class="bi ${iconClass}" style="flex-shrink:0;font-size:1.1rem"></i>`}
          <div class="flex-grow-1 overflow-hidden">
            <div class="small fw-semibold text-truncate">${item.file.name}</div>
            <div class="text-muted" style="font-size:.75rem">${sizeKB} KB${item.msg ? ' · ' + item.msg : ''}</div>
          </div>
          ${item.status === 'pending'
            ? `<button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="ImportPage._removeFile(${i})" title="Quitar"><i class="bi bi-x-lg"></i></button>`
            : ''}
        </div>`;
    }).join('');
  }

  function clearAll() {
    fileQueue = [];
    document.getElementById('fileQueue').style.display = 'none';
    document.getElementById('fileList').innerHTML = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('importResult').innerHTML = '';
  }

  async function doImportAll() {
    const pending = fileQueue.filter(q => q.status === 'pending');
    if (!pending.length) return;

    const btn = document.getElementById('btnImport');
    btn.disabled = true;

    let successCount = 0;
    let errorCount   = 0;

    for (const item of pending) {
      item.status = 'uploading';
      item.msg = '';
      renderQueue();
      btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Importando ${item.file.name}…`;

      try {
        const result = await API.uploadCSV(item.file);
        item.status = 'ok';
        item.msg = `${formatType(result.report_type)} · ${result.rows_saved} filas`;
        successCount++;
      } catch (e) {
        item.status = 'error';
        item.msg = e.message;
        errorCount++;
      }
      renderQueue();
    }

    // Resumen final
    const resultEl = document.getElementById('importResult');
    if (errorCount === 0) {
      resultEl.innerHTML = `<div class="alert alert-success"><i class="bi bi-check-circle-fill me-2"></i><strong>${successCount} CSV importados correctamente.</strong></div>`;
      showToast(`${successCount} archivos importados`, 'success');
    } else {
      resultEl.innerHTML = `<div class="alert alert-warning"><i class="bi bi-exclamation-triangle-fill me-2"></i><strong>${successCount} importados, ${errorCount} con error.</strong> Revisa los detalles arriba.</div>`;
      showToast(`${successCount} ok · ${errorCount} errores`, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = `<i class="bi bi-upload me-2"></i>Importar ${fileQueue.filter(q => q.status === 'pending').length} CSV`;
    loadHistory();
  }

  async function loadHistory() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-3"><div class="spinner-border spinner-border-sm"></div></td></tr>';
    try {
      const history = await API.getImportHistory();
      if (!history.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4 small">Sin importaciones aún.</td></tr>';
        return;
      }
      tbody.innerHTML = history.map(r => `
        <tr>
          <td><span class="badge bg-light text-dark border small">${formatType(r.report_type)}</span></td>
          <td class="small text-muted" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.filename}">${r.filename}</td>
          <td class="text-center small">${r.row_count ?? '—'}</td>
          <td class="small text-muted">${fmt.date(r.import_date)}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="ImportPage._deleteReport(${r.id})" title="Eliminar registro">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>`).join('');
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger small py-3">Error cargando historial.</td></tr>';
    }
  }

  async function _deleteReport(id) {
    if (!confirm('¿Eliminar este registro del historial?')) return;
    try {
      await API.deleteImport(id);
      showToast('Registro eliminado', 'info');
      loadHistory();
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    }
  }

  function formatType(type) {
    const map = {
      CORE_STATS: 'Core Stats',
      SHOP_KEY_METRICS: 'Key Metrics',
      STORE_PAGE_OVERVIEW: 'Store Page',
      PRODUCT_LIST: 'Product List',
      PRODUCTS_CARD_LIST: 'Card List',
      PRODUCT_CARD_TRAFFIC: 'Card Traffic',
      VIDEO_PERFORMANCE: 'Video',
      LIVE_PERFORMANCE: 'LIVE',
      SERVICE_ANALYSIS: 'Servicio',
      CHANNEL_PRODUCT_SEARCH: 'Search (Prod)',
      CHANNEL_STATS_SEARCH: 'Search (Stats)',
    };
    return map[type] || type;
  }

  return { init, _deleteReport, _removeFile: removeFromQueue };
})();
