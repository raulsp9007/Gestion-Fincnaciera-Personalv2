// ── CashMap v2 — Google Apps Script backend ───────────────
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Abre script.google.com → Nuevo proyecto (vinculado a un Google Sheet)
// 2. Pega este código en Code.gs
// 3. Implementar → Nueva implementación → Tipo: App web
//    - Ejecutar como: Yo (Me)
//    - Quién tiene acceso: Cualquier usuario
// 4. Copia la URL y pégala en CashMap → Admin → URL del servidor

// ── Punto de entrada GET (ping / diagnóstico) ─────────────
function doGet(e) {
  const action = (e?.parameter?.action ?? 'ping');
  if (action === 'ping') return _json({ ok: true, pong: true, method: 'GET' });
  return _json({ ok: false, error: 'Solo ping está disponible por GET' });
}

// ── Punto de entrada POST ─────────────────────────────────
function doPost(e) {
  try {
    const body    = JSON.parse(e.postData.contents);
    const action  = body.action;
    const payload = body.payload ?? {};

    let result;
    switch (action) {
      case 'ping':      result = { ok: true, pong: true };    break;
      case 'getConfig': result = _getConfig(payload);          break;
      case 'setConfig': result = _setConfig(payload);          break;
      case 'pullRows':  result = _pullRows(payload);           break;
      case 'pushRows':  result = _pushRows(payload);           break;
      case 'deleteRow': result = _deleteRow(payload);          break;
      default:          throw new Error('Acción desconocida: ' + action);
    }

    return _json(result);
  } catch (err) {
    return _json({ ok: false, error: err.message });
  }
}

// ── Sheet _config (clave/valor global) ───────────────────
const CONFIG_SHEET = '_config';

function _getConfig() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) return { ok: true, config: {} };

  const data   = sheet.getDataRange().getValues();
  const config = {};
  for (const row of data) {
    const key = String(row[0] ?? '').trim();
    if (key && key !== 'key') config[key] = String(row[1] ?? '');
  }
  return { ok: true, config };
}

function _setConfig({ key, value }) {
  if (!key) throw new Error('key requerido');
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG_SHEET);
    sheet.appendRow(['key', 'value']);
  }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return { ok: true };
    }
  }
  sheet.appendRow([key, value]);
  return { ok: true };
}

// ── Sheets de datos de menú ───────────────────────────────
const DATA_HEADERS = [
  'id', 'date', 'amount', 'description',
  'type', 'category', 'notes',
  'updatedAt', 'updatedBy', 'deleted'
];

function _ensureSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(DATA_HEADERS);
    sheet.setFrozenRows(1);
    // Estilo de encabezado
    sheet.getRange(1, 1, 1, DATA_HEADERS.length)
         .setBackground('#1e293b')
         .setFontColor('#94a3b8')
         .setFontWeight('bold');
  }
  return sheet;
}

// Devuelve filas modificadas después de `since` (ISO string).
// Sin `since` devuelve todas las filas no eliminadas.
function _pullRows({ sheetName, since }) {
  if (!sheetName) throw new Error('sheetName requerido');
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: true, rows: [], pulledAt: new Date().toISOString() };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, rows: [], pulledAt: new Date().toISOString() };

  const headers = data[0].map(String);
  const sinceTs = since ? new Date(since).getTime() : 0;
  const rows    = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    const rowTs = row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    if (!since || rowTs > sinceTs) rows.push(row);
  }

  return { ok: true, rows, pulledAt: new Date().toISOString() };
}

// Upsert de filas por id.
function _pushRows({ sheetName, rows }) {
  if (!sheetName)               throw new Error('sheetName requerido');
  if (!Array.isArray(rows))     throw new Error('rows debe ser array');
  if (!rows.length)             return { ok: true, upserted: 0 };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = _ensureSheet(ss, sheetName);

  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const idCol   = headers.indexOf('id');

  // Construir mapa id → número de fila (1-based)
  const idMap = {};
  for (let i = 1; i < data.length; i++) {
    idMap[String(data[i][idCol])] = i + 1;
  }

  let upserted = 0;
  for (const row of rows) {
    const rowArr = DATA_HEADERS.map(h => {
      const v = row[h];
      return (v === null || v === undefined) ? '' : v;
    });
    const key = String(row.id);

    if (idMap[key]) {
      sheet.getRange(idMap[key], 1, 1, DATA_HEADERS.length).setValues([rowArr]);
    } else {
      sheet.appendRow(rowArr);
      idMap[key] = sheet.getLastRow();
    }
    upserted++;
  }

  return { ok: true, upserted };
}

// Marca una fila como deleted:1 (tombstone — no borra la fila).
function _deleteRow({ sheetName, id, updatedBy }) {
  if (!sheetName) throw new Error('sheetName requerido');
  if (!id)        throw new Error('id requerido');

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { ok: true }; // no-op si el sheet no existe

  const data    = sheet.getDataRange().getValues();
  const headers = data[0].map(String);
  const idCol   = headers.indexOf('id');
  const delCol  = headers.indexOf('deleted');
  const tsCol   = headers.indexOf('updatedAt');
  const byCol   = headers.indexOf('updatedBy');
  const now     = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(id)) {
      if (delCol >= 0) sheet.getRange(i + 1, delCol + 1).setValue(1);
      if (tsCol  >= 0) sheet.getRange(i + 1, tsCol  + 1).setValue(now);
      if (byCol  >= 0) sheet.getRange(i + 1, byCol  + 1).setValue(updatedBy ?? '');
      return { ok: true };
    }
  }

  return { ok: true }; // fila no encontrada → no-op
}

// ── Respuesta JSON ────────────────────────────────────────
function _json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
