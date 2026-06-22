'use strict';

let _syncInterval = null;
let _isSyncing    = false;

// ── Start (called from startApp) ──────────────────────────
function startSync() {
  _setupVisibilityListener();
  if (getGasUrl()) {
    connectAndSync();
    _startPoll();
  }
}

function _setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(_syncInterval);
      _syncInterval = null;
    } else if (getGasUrl()) {
      _startPoll();
      if (_hasSharedMenus()) syncAllSharedMenus();
    }
  });
}

function _startPoll() {
  clearInterval(_syncInterval);
  const ms = document.hidden ? POLL_INTERVAL_BACKGROUND : POLL_INTERVAL_VISIBLE;
  _syncInterval = setInterval(() => {
    if (_hasSharedMenus()) syncAllSharedMenus();
  }, ms);
}

function _hasSharedMenus() {
  return getCustomMenus().some(m => m.shared && m.sheetName);
}

// ── Connect + pull config ─────────────────────────────────
async function connectAndSync() {
  if (!getGasUrl() || !currentUser) return;
  try {
    setSyncBadge('saving');
    await _pullSharedConfig();
    await syncAllSharedMenus();
    setSyncBadge('ok');
  } catch (e) {
    setSyncBadge('error');
  }
}

async function _pullSharedConfig() {
  const r   = await callGas('getConfig');
  const raw = r.config?.shared_menus;
  if (!raw) return;

  let sharedMenus;
  try { sharedMenus = JSON.parse(raw); } catch { return; }

  const userName = currentUser?.name;
  const d = loadData();
  let changed = false;

  const isAdmin = currentUser?.role === 'admin';

  for (const sm of sharedMenus) {
    const access = sm.sharedWith?.find(u => u.name === userName);
    // Admin ve todos los menús compartidos aunque su nombre no esté en sharedWith
    if (!access && !isAdmin) continue;

    const existing = d.customMenus.find(m => m.sheetName === sm.sheetName);
    if (!existing) {
      const id = d.customMenus.length
        ? Math.max(...d.customMenus.map(m => m.id)) + 1 : 1;
      d.customMenus.push({
        id, name: sm.name, icon: sm.icon ?? '📋',
        currency: sm.currency ?? '€', data: [], nextDataId: 1,
        shared: true, sheetName: sm.sheetName,
        myRole: access?.role ?? 'admin', sharedWith: sm.sharedWith ?? [],
        lastPulledAt: null
      });
      d.navOrder.push('menu-' + id);
      changed = true;
    }
  }

  // Eliminar menús compartidos que ya no están en el servidor (descompartidos)
  const remoteSheets = new Set(sharedMenus.map(sm => sm.sheetName));
  const toRemove     = d.customMenus.filter(m => m.shared && m.sheetName && !remoteSheets.has(m.sheetName));
  if (toRemove.length) {
    const removeIds = new Set(toRemove.map(m => m.id));
    d.customMenus   = d.customMenus.filter(m => !removeIds.has(m.id));
    d.navOrder      = d.navOrder.filter(k => {
      const num = parseInt(k.replace('menu-', ''), 10);
      return isNaN(num) || !removeIds.has(num);
    });
    changed = true;
  }

  if (changed) { saveData(); buildNav(); }
}

// ── Pull all shared menus ─────────────────────────────────
async function syncAllSharedMenus() {
  if (_isSyncing) return;
  _isSyncing = true;
  try {
    for (const menu of getCustomMenus().filter(m => m.shared && m.sheetName)) {
      await _syncOneMenu(menu);
    }
  } finally {
    _isSyncing = false;
  }
}

async function _syncOneMenu(menu) {
  try {
    const r = await callGas('pullRows', { sheetName: menu.sheetName, since: menu.lastPulledAt });
    if (!r.rows?.length) return;
    mergeMenuRows(menu.id, r.rows);
    setMenuLastPulled(menu.id, r.pulledAt);
    if (typeof _currentView !== 'undefined' && _currentView === 'menu-' + menu.id) {
      renderCustomMenu(menu.id);
    }
    setSyncBadge('ok');
  } catch {
    setSyncBadge('error');
  }
}

// ── Push a menu's records to GAS ──────────────────────────
async function pushMenuToGas(menuId) {
  const menu = getCustomMenu(menuId);
  if (!menu?.shared || !menu.sheetName) return;
  setSyncBadge('saving');
  const rows = menu.data.map(tx => ({ ...tx, deleted: 0, updatedBy: currentUser?.name ?? '' }));
  await callGas('pushRows', { sheetName: menu.sheetName, rows });
  setSyncBadge('ok');
}

// ── Push single-record save ───────────────────────────────
async function onMenuSaved(menuId) {
  if (!getGasUrl()) return;
  try { await pushMenuToGas(menuId); } catch { setSyncBadge('error'); }
}

// ── Push delete to GAS ────────────────────────────────────
async function pushDeleteToGas(menuId, txId) {
  const menu = getCustomMenu(menuId);
  if (!menu?.shared || !menu.sheetName || !getGasUrl()) return;
  try {
    await callGas('deleteRow', { sheetName: menu.sheetName, id: txId, updatedBy: currentUser?.name ?? '' });
  } catch { /* non-fatal */ }
}

// ── Push shared config to _config sheet ──────────────────
async function pushSharedConfig() {
  const sharedMenus = getCustomMenus()
    .filter(m => m.shared && m.sheetName)
    .map(m => ({ sheetName: m.sheetName, name: m.name, icon: m.icon, currency: m.currency, sharedWith: m.sharedWith ?? [] }));
  await callGas('setConfig', { key: 'shared_menus', value: JSON.stringify(sharedMenus) });
}

// ── Manual sync button ────────────────────────────────────
async function forceSyncNow() {
  if (!getGasUrl()) { showToast('Configura la URL de GAS primero', 'var(--yellow)'); return; }
  try {
    await connectAndSync();
    showToast('Sincronizado');
  } catch (e) {
    showToast('Error: ' + e.message, 'var(--red)');
  }
}

// ── Sync badge ────────────────────────────────────────────
function setSyncBadge(state) {
  const badge = document.getElementById('sync-badge');
  const lbl   = document.getElementById('sync-lbl');
  if (!badge || !lbl) return;
  const map = {
    local:  { cls: 'local',  txt: 'Local' },
    saving: { cls: 'saving', txt: 'Guardando…' },
    ok:     { cls: 'ok',     txt: 'Sincronizado' },
    error:  { cls: 'error',  txt: 'Error sync' },
  };
  const s = map[state] ?? map.local;
  badge.className = s.cls;
  lbl.textContent = s.txt;
}
