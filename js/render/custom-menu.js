'use strict';

// ── Per-menu active month ─────────────────────────────────
const _menuMonth = {};

// ── Main render ───────────────────────────────────────────
function renderCustomMenu(menuId) {
  const menu = getCustomMenu(menuId);
  if (!menu) { switchView('inicio'); return; }

  if (!_menuMonth[menuId]) _menuMonth[menuId] = new Date().toISOString().slice(0, 7);
  const ym   = _menuMonth[menuId];
  const cats = loadData().globalCats;
  const txs  = getMenuTxs(menuId).filter(t => t.date.startsWith(ym));
  const curr = menu.currency || '€';

  const inc = txs.filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
  const exp = txs.filter(t => t.type === 'exp').reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;

  const el = document.getElementById('view-custom');
  el.innerHTML = `
    <div class="menu-header">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:1.6rem">${esc(menu.icon ?? '📋')}</span>
        <h2 style="font-size:1.1rem;font-weight:700">${esc(menu.name)}</h2>
      </div>
      ${currentUser?.role === 'admin' ? `
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="openEditMenuModal(${menuId})">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--red)"
                  onclick="confirmDeleteMenu(${menuId})">🗑️</button>
        </div>` : ''}
    </div>
    ${_menuMonthTabs(menuId, ym)}
    <div class="cards">
      <div class="card green">
        <div class="label">Ingresos</div>
        <div class="value">${_fmtCurr(inc, curr)}</div>
      </div>
      <div class="card red">
        <div class="label">Gastos</div>
        <div class="value">${_fmtCurr(exp, curr)}</div>
      </div>
      <div class="card ${bal >= 0 ? 'blue' : 'red'}">
        <div class="label">Balance</div>
        <div class="value">${_fmtCurr(bal, curr)}</div>
      </div>
    </div>
    ${_menuTxTable(menuId, txs, cats, curr)}
  `;
}

function _fmtCurr(n, curr) {
  if (!curr || curr === '€') return fmtMoney(n);
  return `${(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${curr}`;
}

// ── Month tabs ────────────────────────────────────────────
function _menuMonthTabs(menuId, ym) {
  const now    = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return d.toISOString().slice(0, 7);
  });
  return `<div class="month-tabs">
    ${months.map(m => `
      <button class="month-tab ${m === ym ? 'active' : ''}"
              onclick="selectMenuMonth(${menuId},'${m}')">
        ${_monthLabel(m)}
      </button>`).join('')}
  </div>`;
}

function selectMenuMonth(menuId, ym) {
  _menuMonth[menuId] = ym;
  renderCustomMenu(menuId);
}

// ── Transaction table ─────────────────────────────────────
function _menuTxTable(menuId, txs, cats, curr) {
  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date));

  if (!sorted.length) return `
    <div class="tbl-wrap">
      <div class="empty">
        Sin movimientos este mes.<br>
        <button class="btn btn-primary btn-sm" style="margin-top:14px"
                onclick="openNewRecordModal()">+ Añadir primero</button>
      </div>
    </div>`;

  return `
    <div class="tbl-wrap">
      <div class="tbl-header"><h3>Movimientos</h3></div>
      <div class="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Descripción</th><th>Categoría</th>
              <th style="text-align:right">Importe</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(tx => _menuTxRow(menuId, tx, cats, curr)).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _menuTxRow(menuId, tx, cats, curr) {
  const catMap = cats[tx.type] ?? {};
  const cat    = catMap[tx.category] ?? { label: tx.category ?? '—', color: '#64748b' };
  const sign   = tx.type === 'inc' ? '+' : '-';
  const col    = tx.type === 'inc' ? 'var(--green)' : 'var(--red)';

  return `<tr>
    <td style="color:var(--text2);white-space:nowrap">${fmtDate(tx.date)}</td>
    <td>
      <div style="font-weight:500">${esc(tx.description)}</div>
      ${tx.notes ? `<div style="font-size:.72rem;color:var(--text2)">${esc(tx.notes)}</div>` : ''}
    </td>
    <td>
      <span style="padding:2px 8px;border-radius:99px;font-size:.73rem;font-weight:600;
                   background:${cat.color}22;color:${cat.color}">${esc(cat.label)}</span>
    </td>
    <td style="text-align:right;font-weight:700;color:${col};white-space:nowrap">
      ${sign}${_fmtCurr(tx.amount, curr)}
    </td>
    <td style="text-align:right;white-space:nowrap">
      <button class="btn-icon" onclick="openEditMenuTxModal(${menuId},${tx.id})">✏️</button>
      <button class="btn-icon" onclick="confirmDeleteMenuTx(${menuId},${tx.id})">🗑️</button>
    </td>
  </tr>`;
}

// ── Menu tx modal (edit) ──────────────────────────────────
function openEditMenuTxModal(menuId, txId) {
  const tx = getMenuTxs(menuId).find(t => t.id === txId);
  if (!tx) return;
  _txContext = { src: 'custom', menuId };
  _txType    = tx.type;
  document.getElementById('tx-id').value              = txId;
  document.getElementById('tx-modal-title').textContent = 'Editar movimiento';
  document.getElementById('tx-date').value            = tx.date;
  document.getElementById('tx-amount').value          = tx.amount;
  document.getElementById('tx-desc').value            = tx.description;
  document.getElementById('tx-notes').value           = tx.notes ?? '';
  document.getElementById('tx-error').textContent     = '';
  _setTxTypeUI(tx.type);
  _updateTxCatOptions();
  document.getElementById('tx-cat').value = tx.category;
  document.getElementById('tx-modal').classList.add('open');
}

function confirmDeleteMenuTx(menuId, txId) {
  const tx = getMenuTxs(menuId).find(t => t.id === txId);
  if (!tx) return;
  showConfirm(`¿Eliminar "${esc(tx.description)}"?`, () => {
    deleteMenuTx(menuId, txId);
    renderCustomMenu(menuId);
    showToast('Movimiento eliminado', 'var(--red)');
  }, { icon: '🗑️', okLabel: 'Eliminar' });
}

// ── Menu create/edit modal ────────────────────────────────
function openNewMenuModal() {
  document.getElementById('menu-modal-id').value          = '';
  document.getElementById('menu-modal-title').textContent = 'Nuevo menú';
  document.getElementById('menu-name').value              = '';
  document.getElementById('menu-icon').value              = '📋';
  document.getElementById('menu-currency').value          = '€';
  document.getElementById('menu-error').textContent       = '';
  document.getElementById('menu-modal').classList.add('open');
}

function openEditMenuModal(menuId) {
  const m = getCustomMenu(menuId);
  if (!m) return;
  document.getElementById('menu-modal-id').value          = menuId;
  document.getElementById('menu-modal-title').textContent = 'Editar menú';
  document.getElementById('menu-name').value              = m.name;
  document.getElementById('menu-icon').value              = m.icon ?? '📋';
  document.getElementById('menu-currency').value          = m.currency ?? '€';
  document.getElementById('menu-error').textContent       = '';
  document.getElementById('menu-modal').classList.add('open');
}

function closeMenuModal() {
  document.getElementById('menu-modal').classList.remove('open');
}

function saveMenuModal() {
  const id   = document.getElementById('menu-modal-id').value;
  const name = document.getElementById('menu-name').value.trim();
  const icon = document.getElementById('menu-icon').value.trim() || '📋';
  const curr = document.getElementById('menu-currency').value.trim() || '€';
  const err  = document.getElementById('menu-error');
  err.textContent = '';

  if (!name) { err.textContent = 'Nombre obligatorio.'; return; }

  if (id) {
    const mid = parseInt(id, 10);
    updateCustomMenu(mid, { name, icon, currency: curr });
    closeMenuModal();
    buildNav();
    renderCustomMenu(mid);
    showToast('Menú actualizado');
  } else {
    const menu = addCustomMenu({ name, icon, currency: curr });
    closeMenuModal();
    buildNav();
    switchView('menu-' + menu.id);
    showToast('Menú creado');
  }
}

// ── Menu delete ───────────────────────────────────────────
function confirmDeleteMenu(menuId) {
  const m = getCustomMenu(menuId);
  if (!m) return;
  showConfirm(`¿Eliminar menú "${m.name}" y todos sus datos?`, () => {
    deleteCustomMenu(menuId);
    buildNav();
    switchView('inicio');
    showToast('Menú eliminado', 'var(--red)');
  }, { icon: '🗑️', okLabel: 'Eliminar' });
}
