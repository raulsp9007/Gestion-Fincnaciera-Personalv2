'use strict';

// ── App data (Inicio + custom menus) ─────────────────────
let _data = null;

function loadData() {
  if (_data) return _data;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    _data = raw ? JSON.parse(raw) : null;
  } catch { _data = null; }
  if (!_data) _data = structuredClone(DEFAULT_DATA);
  // Bootstrap categories if first run
  if (!_data.globalCats || !Object.keys(_data.globalCats.inc ?? {}).length) {
    _data.globalCats = structuredClone(DEFAULT_CATS);
  }
  return _data;
}

function saveData() {
  if (!_data) return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(_data));
}

// ── Transactions — Inicio ─────────────────────────────────
function getTxs() {
  return loadData().inicio;
}

function getTxsForMonth(ym) {
  return getTxs().filter(t => t.date.startsWith(ym));
}

function addTx(fields) {
  const d   = loadData();
  const txs = d.inicio;
  const id  = txs.length ? Math.max(...txs.map(t => t.id)) + 1 : 1;
  const tx  = { id, ...fields };
  txs.push(tx);
  saveData();
  return tx;
}

function updateTx(id, fields) {
  const d   = loadData();
  const idx = d.inicio.findIndex(t => t.id === id);
  if (idx < 0) return;
  d.inicio[idx] = { ...d.inicio[idx], ...fields };
  saveData();
}

function deleteTx(id) {
  const d = loadData();
  d.inicio = d.inicio.filter(t => t.id !== id);
  saveData();
}

// ── Custom Menus ──────────────────────────────────────────
function getCustomMenus() {
  return loadData().customMenus ?? [];
}

function getCustomMenu(menuId) {
  return getCustomMenus().find(m => m.id === menuId) ?? null;
}

function addCustomMenu(fields) {
  const d     = loadData();
  const menus = d.customMenus;
  const id    = menus.length ? Math.max(...menus.map(m => m.id)) + 1 : 1;
  const menu  = { id, data: [], nextDataId: 1, ...fields };
  menus.push(menu);
  d.navOrder.push('menu-' + id);
  saveData();
  return menu;
}

function updateCustomMenu(menuId, fields) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  Object.assign(m, fields);
  saveData();
}

function deleteCustomMenu(menuId) {
  const d = loadData();
  d.customMenus = d.customMenus.filter(m => m.id !== menuId);
  d.navOrder    = d.navOrder.filter(k => k !== 'menu-' + menuId);
  saveData();
}

// ── Custom Menu Transactions ──────────────────────────────
function getMenuTxs(menuId) {
  return getCustomMenu(menuId)?.data ?? [];
}

function addMenuTx(menuId, fields) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return null;
  const tx = { id: m.nextDataId++, ...fields };
  m.data.push(tx);
  saveData();
  return tx;
}

function updateMenuTx(menuId, txId, fields) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  const idx = m.data.findIndex(t => t.id === txId);
  if (idx < 0) return;
  m.data[idx] = { ...m.data[idx], ...fields };
  saveData();
}

function deleteMenuTx(menuId, txId) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  m.data = m.data.filter(t => t.id !== txId);
  saveData();
}
