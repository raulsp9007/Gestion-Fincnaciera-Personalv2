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
  const tx  = { id, ...fields, updatedAt: new Date().toISOString() };
  txs.push(tx);
  saveData();
  return tx;
}

function updateTx(id, fields) {
  const d   = loadData();
  const idx = d.inicio.findIndex(t => t.id === id);
  if (idx < 0) return;
  d.inicio[idx] = { ...d.inicio[idx], ...fields, updatedAt: new Date().toISOString() };
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
  const d  = loadData();
  const m  = d.customMenus.find(m => m.id === menuId);
  if (!m) return null;
  const tx = { id: m.nextDataId++, updatedAt: new Date().toISOString(), ...fields };
  m.data.push(tx);
  saveData();
  return tx;
}

function updateMenuTx(menuId, txId, fields) {
  const d   = loadData();
  const m   = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  const idx = m.data.findIndex(t => t.id === txId);
  if (idx < 0) return;
  m.data[idx] = { ...m.data[idx], ...fields, updatedAt: new Date().toISOString() };
  saveData();
}

function deleteMenuTx(menuId, txId) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  m.data = m.data.filter(t => t.id !== txId);
  saveData();
}

// ── Share helpers ─────────────────────────────────────────
function shareMenu(menuId, sheetName, sharedWith) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  Object.assign(m, { shared: true, sheetName, sharedWith, myRole: m.myRole ?? 'admin' });
  saveData();
}

function unshareMenu(menuId) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  Object.assign(m, { shared: false, sheetName: null, sharedWith: [] });
  saveData();
}

function setMenuLastPulled(menuId, ts) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;
  m.lastPulledAt = ts;
  saveData();
}

// LWW merge — remote rows with newer updatedAt win
function mergeMenuRows(menuId, remoteRows) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return;

  const map = new Map(m.data.map(r => [String(r.id), { ...r }]));

  for (const remote of remoteRows) {
    const key      = String(remote.id);
    const local    = map.get(key);
    const remoteTs = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
    const localTs  = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0;

    if (!local) {
      if (!Number(remote.deleted)) map.set(key, _gasRowToTx(remote));
    } else if (remoteTs > localTs) {
      if (Number(remote.deleted)) map.delete(key);
      else map.set(key, _gasRowToTx(remote));
    }
  }

  m.data = [...map.values()];
  const maxId = m.data.reduce((mx, t) => Math.max(mx, t.id), 0);
  if (m.nextDataId <= maxId) m.nextDataId = maxId + 1;
  saveData();
}

function _gasRowToTx(row) {
  return {
    id:          parseInt(row.id, 10),
    date:        String(row.date || '').slice(0, 10),
    amount:      parseFloat(row.amount) || 0,
    description: String(row.description || ''),
    type:        String(row.type || 'exp'),
    category:    String(row.category || ''),
    notes:       String(row.notes || ''),
    updatedAt:   String(row.updatedAt || '')
  };
}

// ── Import from v1 / backup JSON ──────────────────────────
function importV1Data(raw) {
  const isV1 = Array.isArray(raw.txs);
  const isV2 = raw.version === 2 || Array.isArray(raw.inicio);
  if (!isV1 && !isV2) throw new Error('Formato no reconocido');

  const d = loadData();
  const stats = { txs: 0, menus: 0, menuTxs: 0 };

  // ── Transacciones principales ─────────────────────────
  const srcTxs = isV1 ? (raw.txs ?? []) : (raw.inicio ?? []);
  let nextTxId = d.inicio.length ? Math.max(...d.inicio.map(t => t.id)) + 1 : 1;
  for (const tx of srcTxs) {
    d.inicio.push({
      id:          nextTxId++,
      date:        String(tx.date || '').slice(0, 10),
      amount:      Number(tx.amount) || 0,
      description: String(tx.description || ''),
      type:        _normType(tx.type),
      category:    String(tx.category || ''),
      notes:       String(tx.notes || '')
    });
    stats.txs++;
  }

  // ── Categorías — merge sin sobreescribir ──────────────
  if (raw.globalCats) {
    for (const type of ['inc', 'exp']) {
      if (!d.globalCats[type]) d.globalCats[type] = {};
      for (const [key, cat] of Object.entries(raw.globalCats[type] ?? {})) {
        if (!d.globalCats[type][key]) d.globalCats[type][key] = cat;
      }
    }
  }

  // ── Presupuestos — merge sin sobreescribir ────────────
  if (raw.budgets) {
    for (const [key, val] of Object.entries(raw.budgets)) {
      if (!d.budgets[key]) d.budgets[key] = val;
    }
  }

  // ── Menús personalizados ──────────────────────────────
  let nextMenuId = d.customMenus.length ? Math.max(...d.customMenus.map(m => m.id)) + 1 : 1;
  for (const menu of (raw.customMenus ?? [])) {
    const newMenuId = nextMenuId++;
    let nextDataId  = 1;
    const data = (menu.data ?? []).map(tx => ({
      id:          nextDataId++,
      date:        String(tx.date || '').slice(0, 10),
      amount:      Number(tx.amount) || 0,
      description: String(tx.description || ''),
      type:        _normType(tx.type),
      category:    String(tx.category || ''),
      notes:       String(tx.notes || ''),
      updatedAt:   tx.updatedAt ?? new Date().toISOString()
    }));
    d.customMenus.push({
      id: newMenuId, name: menu.name, icon: menu.icon ?? '📋',
      currency: menu.currency ?? '€', data, nextDataId, shared: false
    });
    d.navOrder.push('menu-' + newMenuId);
    stats.menus++;
    stats.menuTxs += data.length;
  }

  // ── Deudas (v1) ──────────────────────────────────────
  if (raw.deudas?.length) {
    if (!d.deudas) d.deudas = [];
    let nextDeudaId = d.deudas.length ? Math.max(...d.deudas.map(x => x.id)) + 1 : 1;
    for (const dv1 of raw.deudas) {
      d.deudas.push({
        id:          nextDeudaId++,
        date:        String(dv1.date || '').slice(0, 10),
        amount:      Number(dv1.amount) || 0,
        persona:     String(dv1.persona || ''),
        description: String(dv1.description || ''),
        type:        dv1.type === 'por_pagar' ? 'por_pagar' : 'por_cobrar',
        status:      dv1.status ?? 'pendiente',
        notes:       String(dv1.notes || ''),
        currency:    String(dv1.currency || '$'),
        paid:        Number(dv1.paid) || 0,
        payments:    (dv1.payments ?? []).map(p => ({
          datetime: p.datetime ?? p.date ?? '',
          amount:   Number(p.amount) || 0,
          notes:    String(p.notes || '')
        })),
        updatedAt:   dv1.updatedAt ?? new Date().toISOString()
      });
      stats.deudas = (stats.deudas ?? 0) + 1;
    }
  }

  // ── homeTxs (v1) → menú "Hogar (importado)" ──────────
  if (isV1 && raw.homeTxs?.length) {
    const newMenuId = nextMenuId++;
    let nextDataId  = 1;
    const data = raw.homeTxs.map(tx => ({
      id:          nextDataId++,
      date:        String(tx.date || '').slice(0, 10),
      amount:      Number(tx.amount) || 0,
      description: String(tx.description || ''),
      type:        _normType(tx.type),
      category:    String(tx.category || ''),
      notes:       String(tx.notes || ''),
      updatedAt:   new Date().toISOString()
    }));
    d.customMenus.push({
      id: newMenuId, name: 'Hogar (importado)', icon: '🏠',
      currency: '€', data, nextDataId, shared: false
    });
    d.navOrder.push('menu-' + newMenuId);
    stats.menus++;
    stats.menuTxs += data.length;
  }

  saveData();
  return stats;
}

// ── Normalizar tipo v1→v2 ────────────────────────────────
function _normType(t) {
  if (t === 'income')  return 'inc';
  if (t === 'expense') return 'exp';
  return (t === 'inc' || t === 'exp') ? t : 'exp';
}

// Migración única: corrige income/expense guardados en localStorage
function migrateTypes() {
  const d = loadData();
  let changed = false;
  for (const tx of d.inicio) {
    const fixed = _normType(tx.type);
    if (fixed !== tx.type) { tx.type = fixed; changed = true; }
  }
  for (const m of d.customMenus) {
    for (const tx of m.data) {
      const fixed = _normType(tx.type);
      if (fixed !== tx.type) { tx.type = fixed; changed = true; }
    }
  }
  if (changed) saveData();
}

// ── Recurrencia ───────────────────────────────────────────
function nextOccurrence(dateStr, period) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  if (period === 'semanal')      d.setDate(d.getDate() + 7);
  else if (period === 'mensual') d.setMonth(d.getMonth() + 1);
  else if (period === 'anual')   d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString().slice(0, 10);
}

function processRecurringTxs() {
  const d     = loadData();
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toISOString();
  let changed = false;

  const _dedup = (arr, templateId, date, desc, amount, type) =>
    arr.some(x => x.id !== templateId && x.date === date &&
                  x.description === desc && x.amount === amount && x.type === type);

  // Inicio txs
  let nextTxId = d.inicio.length ? Math.max(...d.inicio.map(t => t.id)) + 1 : 1;
  d.inicio.filter(t => t.recurring && t.recurringNext).forEach(t => {
    while (t.recurringNext && t.recurringNext <= today) {
      const due = t.recurringNext;
      if (!_dedup(d.inicio, t.id, due, t.description, t.amount, t.type)) {
        const { recurringNext: _rn, ...base } = t;
        d.inicio.push({ ...base, id: nextTxId++, date: due, updatedAt: now });
        changed = true;
      }
      t.recurringNext = nextOccurrence(due, t.recurring);
    }
  });

  // Custom menu txs
  for (const m of d.customMenus) {
    m.data.filter(t => t.recurring && t.recurringNext).forEach(t => {
      while (t.recurringNext && t.recurringNext <= today) {
        const due = t.recurringNext;
        if (!_dedup(m.data, t.id, due, t.description, t.amount, t.type)) {
          const { recurringNext: _rn, ...base } = t;
          m.data.push({ ...base, id: m.nextDataId++, date: due, updatedAt: now });
          changed = true;
        }
        t.recurringNext = nextOccurrence(due, t.recurring);
      }
    });
  }

  if (changed) saveData();
}

// ── Import transactions into a specific menu ──────────────
function importMenuTxs(menuId, rawTxs) {
  const d = loadData();
  const m = d.customMenus.find(m => m.id === menuId);
  if (!m) return 0;
  let nextId = m.nextDataId;
  let count  = 0;
  for (const tx of rawTxs) {
    const date = String(tx.date || '').slice(0, 10);
    if (!date) continue;
    m.data.push({
      id:          nextId++,
      date,
      amount:      Number(tx.amount) || 0,
      description: String(tx.description || ''),
      type:        _normType(tx.type),
      category:    String(tx.category || ''),
      notes:       String(tx.notes || ''),
      updatedAt:   new Date().toISOString()
    });
    count++;
  }
  m.nextDataId = nextId;
  saveData();
  return count;
}

// ── Merge globalCats from external JSON ───────────────────
function mergeImportedCats(raw) {
  if (!raw.globalCats) return;
  const d = loadData();
  for (const side of ['inc', 'exp']) {
    if (!d.globalCats[side]) d.globalCats[side] = {};
    for (const [key, cat] of Object.entries(raw.globalCats[side] ?? {})) {
      if (!d.globalCats[side][key]) d.globalCats[side][key] = cat;
    }
  }
  saveData();
}

// ── Presupuestos ──────────────────────────────────────────
function getBudgets() {
  return loadData().budgets ?? {};
}

function setBudget(catKey, monthly) {
  const d = loadData();
  if (!d.budgets) d.budgets = {};
  if (!monthly || monthly <= 0) delete d.budgets[catKey];
  else d.budgets[catKey] = { monthly };
  saveData();
}
