'use strict';

// ── Per-menu active month ─────────────────────────────────
const _menuMonth = {};

// ── Per-menu chart instances ──────────────────────────────
const _menuCharts = {};

// ── Main render ───────────────────────────────────────────
function renderCustomMenu(menuId) {
  const menu = getCustomMenu(menuId);
  if (!menu) { switchView('inicio'); return; }

  if (!_menuMonth[menuId]) _menuMonth[menuId] = new Date().toISOString().slice(0, 7);
  const ym      = _menuMonth[menuId];
  const cats    = loadData().globalCats;
  const allTxs  = getMenuTxs(menuId);
  const monthTxs = allTxs.filter(t => t.date.startsWith(ym));
  const curr    = menu.currency || '€';

  // Read filter state before wiping innerHTML
  const fSearch = document.getElementById(`cmf-s-${menuId}`)?.value ?? '';
  const fType   = document.getElementById(`cmf-t-${menuId}`)?.value ?? '';
  const fCat    = document.getElementById(`cmf-c-${menuId}`)?.value ?? '';
  const fFrom   = document.getElementById(`cmf-f-${menuId}`)?.value ?? '';
  const fTo     = document.getElementById(`cmf-to-${menuId}`)?.value ?? '';

  const inc = monthTxs.filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
  const exp = monthTxs.filter(t => t.type === 'exp').reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;

  // 4th card: projection for current month, else record count
  const thisYM = new Date().toISOString().slice(0, 7);
  let fourthCard;
  if (ym === thisYM) {
    const today      = new Date();
    const daysIn     = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOf      = today.getDate();
    const projExp    = dayOf > 0 ? Math.round((exp / dayOf) * daysIn * 100) / 100 : exp;
    const projNet    = inc - projExp;
    fourthCard = `<div class="card ${projNet >= 0 ? '' : 'red'}">
      <div class="label">Proyección al ${daysIn}</div>
      <div class="value" style="font-size:1.15rem;color:var(--text2)">${projNet >= 0 ? '+' : ''}${_fmtCurr(Math.abs(projNet), curr)}</div>
      <div style="font-size:.72rem;color:var(--text2);margin-top:2px">gasto est. ${_fmtCurr(projExp, curr)}</div>
    </div>`;
  } else {
    fourthCard = `<div class="card blue">
      <div class="label">Registros</div>
      <div class="value" style="font-size:1.6rem">${monthTxs.length}</div>
      <div style="font-size:.72rem;color:var(--text2);margin-top:2px">de ${allTxs.length} total</div>
    </div>`;
  }

  // Category options for filter
  const allCatsHtml = [
    ...Object.entries(cats.inc ?? {}).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`),
    ...Object.entries(cats.exp ?? {}).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)
  ].join('');

  const el = document.getElementById('view-custom');
  el.innerHTML = `
    <div class="menu-header">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:1.6rem">${esc(menu.icon ?? '📋')}</span>
        <h2 style="font-size:1.1rem;font-weight:700">${esc(menu.name)}</h2>
        ${menu.shared ? `<span style="font-size:.68rem;padding:2px 7px;border-radius:99px;background:var(--acc)22;color:var(--acc);font-weight:600">Compartido</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${_canWriteMenuTxs(menu) ? `
          <button class="btn btn-ghost btn-sm" onclick="openMenuImportPicker(${menuId})">📥 Importar</button>
        ` : ''}
        ${_canEditMenu(menu) ? `
          ${!menu.shared ? `
            <button class="btn btn-ghost btn-sm" onclick="openEditMenuModal(${menuId})">✏️ Editar</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="confirmDeleteMenu(${menuId})">🗑️</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm" onclick="openShareModal(${menuId})">🔗 ${menu.shared ? 'Acceso' : 'Compartir'}</button>
        ` : ''}
      </div>
    </div>
    ${_menuMonthTabs(menuId, ym)}
    <div class="cards">
      <div class="card green"><div class="label">Ingresos</div><div class="value">${_fmtCurr(inc, curr)}</div></div>
      <div class="card red"><div class="label">Gastos</div><div class="value">${_fmtCurr(exp, curr)}</div></div>
      <div class="card ${bal >= 0 ? 'blue' : 'red'}"><div class="label">Balance</div><div class="value">${_fmtCurr(bal, curr)}</div></div>
      ${fourthCard}
    </div>
    <div class="charts">
      <div class="chart-box">
        <h3>Ingresos vs Gastos (${esc(menu.name)})</h3>
        <canvas id="cm-chart-bar-${menuId}" height="160"></canvas>
      </div>
      <div class="chart-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h3 style="margin:0">Gastos por categoría</h3>
          <button class="btn btn-ghost btn-sm" onclick="openMenuCatColors(${menuId})">🎨 Colores</button>
        </div>
        <canvas id="cm-chart-cat-${menuId}" height="160"></canvas>
      </div>
    </div>
    ${_menuTxTable(menu, monthTxs, cats, curr, fSearch, fType, fCat, fFrom, fTo)}
  `;

  _drawMenuCharts(menuId, allTxs, cats, curr);
}

// ── Menu charts ───────────────────────────────────────────
function _drawMenuCharts(menuId, allTxs, cats, curr) {
  if (!_menuCharts[menuId]) _menuCharts[menuId] = {};
  if (_menuCharts[menuId].bar) { _menuCharts[menuId].bar.destroy(); _menuCharts[menuId].bar = null; }
  if (_menuCharts[menuId].cat) { _menuCharts[menuId].cat.destroy(); _menuCharts[menuId].cat = null; }
  if (typeof Chart === 'undefined') return;

  // Bar — monthly inc vs exp (all months in data)
  const months = [...new Set(allTxs.map(t => t.date.slice(0, 7)))].sort();
  const barInc = months.map(ym => allTxs.filter(t => t.type === 'inc' && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0));
  const barExp = months.map(ym => allTxs.filter(t => t.type === 'exp' && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0));
  const ctx1   = document.getElementById(`cm-chart-bar-${menuId}`);
  if (ctx1 && months.length) {
    _menuCharts[menuId].bar = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: months.map(ym => _monthLabel(ym)),
        datasets: [
          { label: 'Ingresos', data: barInc, backgroundColor: '#22c55e99', borderRadius: 4 },
          { label: 'Gastos',   data: barExp, backgroundColor: '#ef444499', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${_fmtCurr(c.raw, curr)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#1e293b' } }
        }
      }
    });
  }

  // Doughnut — top expense cats
  const catTotals = {};
  for (const t of allTxs.filter(t => t.type === 'exp')) {
    catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
  }
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const ctx2   = document.getElementById(`cm-chart-cat-${menuId}`);
  if (ctx2 && sorted.length) {
    const expCats = cats.exp ?? {};
    _menuCharts[menuId].cat = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: sorted.map(([k]) => expCats[k]?.label ?? k),
        datasets: [{ data: sorted.map(([, v]) => v), backgroundColor: sorted.map(([k]) => _getCatColor(k)), borderWidth: 2, borderColor: '#1e293b' }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${_fmtCurr(c.raw, curr)}` } }
        }
      }
    });
  }
}

// ── Cat color modal (simplified) ──────────────────────────
function openMenuCatColors(menuId) {
  const allTxs = getMenuTxs(menuId);
  const cats   = loadData().globalCats;
  const totals = {};
  for (const t of allTxs.filter(t => t.type === 'exp')) {
    totals[t.category] = (totals[t.category] ?? 0) + t.amount;
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const curr   = getCustomMenu(menuId)?.currency ?? '€';

  const rows = sorted.map(([key, amt]) => {
    const label = (cats.inc[key] ?? cats.exp[key])?.label ?? key;
    const color = _getCatColor(key);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="color" value="${color}" data-key="${key}"
             oninput="_setCatColorFromPicker('${key}',this.value)"
             style="width:36px;height:36px;border:none;background:none;cursor:pointer;border-radius:6px;padding:0">
      <span style="flex:1;font-size:.88rem">${esc(label)}</span>
      <span style="font-size:.75rem;color:var(--text2)">${_fmtCurr(amt, curr)}</span>
    </div>`;
  }).join('');

  const overlay = document.getElementById('catcolors-overlay');
  if (!overlay) {
    // Create overlay on first use
    const div = document.createElement('div');
    div.id        = 'catcolors-overlay';
    div.className = 'modal-overlay';
    div.innerHTML = `<div class="modal" style="max-width:400px">
      <h3>🎨 Colores de categorías</h3>
      <div id="catcolors-body"></div>
      <div class="modal-actions" style="margin-top:12px">
        <button class="btn btn-primary" onclick="document.getElementById('catcolors-overlay').classList.remove('open');renderCustomMenu(${menuId})">Listo</button>
      </div>
    </div>`;
    document.body.appendChild(div);
  } else {
    // Update close button for current menuId
    const btn = overlay.querySelector('.modal-actions .btn-primary');
    if (btn) btn.onclick = () => { overlay.classList.remove('open'); renderCustomMenu(menuId); };
  }
  document.getElementById('catcolors-body').innerHTML = rows || '<p style="color:var(--text2);font-size:.82rem;padding:12px 0">Sin gastos registrados.</p>';
  document.getElementById('catcolors-overlay').classList.add('open');
}

function _setCatColorFromPicker(catKey, color) {
  const d    = loadData();
  const side = d.globalCats.inc[catKey] ? 'inc' : d.globalCats.exp[catKey] ? 'exp' : null;
  if (!side) return;
  d.globalCats[side][catKey].color = color;
  saveData();
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
function _menuTxTable(menu, txs, cats, curr, fSearch = '', fType = '', fCat = '', fFrom = '', fTo = '') {
  const menuId = menu.id;

  // Apply filters
  let list = [...txs];
  if (fSearch) list = list.filter(t => t.description.toLowerCase().includes(fSearch.toLowerCase()) || (t.notes ?? '').toLowerCase().includes(fSearch.toLowerCase()));
  if (fType)   list = list.filter(t => t.type === fType);
  if (fCat)    list = list.filter(t => t.category === fCat);
  if (fFrom)   list = list.filter(t => t.date >= fFrom);
  if (fTo)     list = list.filter(t => t.date <= fTo);

  const sorted = list.sort((a, b) => b.date.localeCompare(a.date));

  // Category options for filter dropdown
  const catsHtml = [
    ...Object.entries(cats.inc ?? {}).map(([k, v]) => `<option value="${k}" ${fCat === k ? 'selected' : ''}>${esc(v.label)}</option>`),
    ...Object.entries(cats.exp ?? {}).map(([k, v]) => `<option value="${k}" ${fCat === k ? 'selected' : ''}>${esc(v.label)}</option>`)
  ].join('');

  const emptyMsg = sorted.length === 0 ? `
    <div class="empty">
      ${fSearch || fType || fCat || fFrom || fTo ? 'Sin resultados con estos filtros.' : 'Sin movimientos este mes.'}
      ${!fSearch && !fType && !fCat && !fFrom && !fTo && _canWriteMenuTxs(menu) ? `<br>
        <button class="btn btn-primary btn-sm" style="margin-top:14px"
                onclick="openNewRecordModal()">+ Añadir primero</button>` : ''}
    </div>` : '';

  return `
    <div class="tbl-wrap">
      <div class="filters">
        <input type="text" id="cmf-s-${menuId}" value="${esc(fSearch)}" placeholder="🔍 Buscar..."
               oninput="renderCustomMenu(${menuId})">
        <select id="cmf-t-${menuId}" onchange="renderCustomMenu(${menuId})">
          <option value="" ${!fType ? 'selected' : ''}>Todos</option>
          <option value="inc" ${fType === 'inc' ? 'selected' : ''}>💚 Ingresos</option>
          <option value="exp" ${fType === 'exp' ? 'selected' : ''}>🔴 Gastos</option>
        </select>
        <select id="cmf-c-${menuId}" onchange="renderCustomMenu(${menuId})">
          <option value="">Todas las categorías</option>
          ${catsHtml}
        </select>
        <input type="date" id="cmf-f-${menuId}"  value="${esc(fFrom)}" title="Desde"
               oninput="renderCustomMenu(${menuId})">
        <input type="date" id="cmf-to-${menuId}" value="${esc(fTo)}"   title="Hasta"
               oninput="renderCustomMenu(${menuId})">
      </div>
      <div class="tbl-header">
        <h3>Movimientos</h3>
        <span style="font-size:.78rem;color:var(--text2)">${sorted.length} registro(s)</span>
      </div>
      ${emptyMsg}
      ${sorted.length ? `<div class="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Monto</th><th>Descripción</th>
              <th>Tipo</th><th>Categoría</th><th>Notas</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(tx => _menuTxRow(menu, tx, cats, curr)).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;
}

function _menuTxRow(menu, tx, cats, curr) {
  const menuId    = menu.id;
  const catMap    = cats[tx.type] ?? {};
  const cat       = catMap[tx.category] ?? { label: tx.category ?? '—', color: '#a78bfa' };
  const typeLabel = tx.type === 'inc' ? 'Ingreso' : 'Gasto';
  const sign      = tx.type === 'inc' ? '+' : '-';

  return `<tr>
    <td style="color:var(--text2);white-space:nowrap">${fmtDate(tx.date)}</td>
    <td class="amount ${tx.type}" style="white-space:nowrap">
      ${sign}${_fmtCurr(tx.amount, curr)}${_recBadge(tx)}
    </td>
    <td style="font-weight:500">${esc(tx.description)} ${attachBadge(tx.attachments)}</td>
    <td><span class="badge ${tx.type}">${typeLabel}</span></td>
    <td>
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span class="home-cat-badge">${esc(cat.label)}</span>
    </td>
    <td>${_renderNote(tx.notes)}</td>
    <td style="text-align:right;white-space:nowrap">
      ${_canWriteMenuTxs(menu) ? `
        <button class="btn-icon" onclick="openEditMenuTxModal(${menuId},${tx.id})">✏️</button>
        <button class="btn-icon" onclick="confirmDeleteMenuTx(${menuId},${tx.id})">🗑️</button>
      ` : ''}
    </td>
  </tr>`;
}

// ── Menu tx modal (edit) ──────────────────────────────────
function openEditMenuTxModal(menuId, txId) {
  const tx   = getMenuTxs(menuId).find(t => t.id === txId);
  if (!tx) return;
  const menu = getCustomMenu(menuId);
  _txContext  = { src: 'custom', menuId };
  document.getElementById('tx-modal-curr').textContent  = `(${menu?.currency ?? '€'})`;
  document.getElementById('tx-id').value                = txId;
  document.getElementById('tx-modal-title').textContent = 'Editar movimiento';
  document.getElementById('tx-date').value              = tx.date;
  document.getElementById('tx-amount').value            = tx.amount;
  document.getElementById('tx-desc').value              = tx.description;
  document.getElementById('tx-notes').value             = tx.notes ?? '';
  document.getElementById('tx-recurring').value         = tx.recurring || '';
  document.getElementById('tx-error').textContent       = '';
  document.getElementById('tx-type').value              = tx.type;  // 1. set type
  _updateTxCatOptions();                                            // 2. populate cats
  document.getElementById('tx-cat').value               = tx.category; // 3. restore cat
  _updateCatColorPicker();
  initAttachModal(tx.attachments ?? []);
  document.getElementById('tx-modal').classList.add('open');
}

function confirmDeleteMenuTx(menuId, txId) {
  const tx = getMenuTxs(menuId).find(t => t.id === txId);
  if (!tx) return;
  showConfirm(`¿Eliminar "${esc(tx.description)}"?`, () => {
    deleteMenuTx(menuId, txId);
    pushDeleteToGas(menuId, txId);
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

// ── Import from v1 JSON into this menu ───────────────────
function openMenuImportPicker(menuId) {
  const inp = document.getElementById('menu-import-file');
  inp.dataset.menuId = menuId;
  inp.value = '';
  inp.click();
}

function handleMenuImportFile(input) {
  const menuId = parseInt(input.dataset.menuId, 10);
  const file   = input.files?.[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    let raw;
    try { raw = JSON.parse(e.target.result); }
    catch { showToast('JSON inválido', 'var(--red)'); return; }

    // Collect importable transaction groups
    // v1 format: transactions / home / customMenus:{name:[]}
    // v2 format: txs / homeTxs / customMenus:[{data:[]}]  or inicio[]
    const groups = [];

    const mainTxs = raw.transactions ?? raw.txs ?? raw.inicio ?? [];
    if (mainTxs.length) groups.push({ label: `${mainTxs.length} movimientos principales`, data: mainTxs });

    const homeTxs = raw.home ?? raw.homeTxs ?? [];
    if (homeTxs.length) groups.push({ label: `${homeTxs.length} movimientos de hogar`, data: homeTxs });

    // v1: customMenus es un objeto { nombreMenu: [txs] }
    // v2: customMenus es un array  [ { name, data:[txs] } ]
    const cms = raw.customMenus;
    if (cms && !Array.isArray(cms)) {
      for (const [name, data] of Object.entries(cms)) {
        if (Array.isArray(data) && data.length) groups.push({ label: `${data.length} registros de "${name}"`, data });
      }
    } else if (Array.isArray(cms)) {
      for (const cm of cms) {
        if (cm.data?.length) groups.push({ label: `${cm.data.length} registros de "${cm.name}"`, data: cm.data });
      }
    }

    if (!groups.length) { showToast('Sin movimientos que importar', 'var(--yellow)'); return; }

    const allTxs = groups.flatMap(g => g.data);
    const menu   = getCustomMenu(menuId);
    const catCount = Object.keys(raw.globalCats?.inc ?? {}).length
                   + Object.keys(raw.globalCats?.exp ?? {}).length;
    const catNote  = catCount ? ` + ${catCount} categorías` : '';

    showConfirm(
      `¿Importar ${allTxs.length} movimientos${catNote} al menú "${menu?.name ?? ''}"?\n• ` + groups.map(g => g.label).join('\n• '),
      () => {
        mergeImportedCats(raw);
        const count = importMenuTxs(menuId, allTxs);
        renderCustomMenu(menuId);
        showToast(`Importados ${count} movimientos${catNote} ✓`);
      },
      { icon: '📥', okLabel: 'Importar' }
    );
  };
  reader.readAsText(file);
}

// ── Role helpers ──────────────────────────────────────────
function _canEditMenu(menu) {
  return menu.shared ? menu.myRole === 'admin' : currentUser?.role === 'admin';
}

function _canWriteMenuTxs(menu) {
  return menu.shared ? menu.myRole !== 'viewer' : currentUser?.role !== 'viewer';
}

// ── Share modal ───────────────────────────────────────────
function openShareModal(menuId) {
  const menu = getCustomMenu(menuId);
  if (!menu) return;
  document.getElementById('share-modal-menu-id').value      = menuId;
  document.getElementById('share-modal-title').textContent  =
    menu.shared ? 'Gestionar acceso compartido' : 'Compartir menú';
  document.getElementById('share-sheet-name').value         = menu.sheetName ?? '';
  document.getElementById('share-error').textContent        = '';
  _renderShareUsers(menu);
  document.getElementById('share-modal').classList.add('open');
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('open');
}

function _renderShareUsers(menu) {
  const users = loadUsers().filter(u => u.id !== currentUser?.id);
  const el    = document.getElementById('share-users-list');
  if (!users.length) {
    el.innerHTML = '<div class="empty" style="font-size:.82rem;padding:12px 0">Sin otros usuarios registrados</div>';
    return;
  }
  el.innerHTML = users.map(u => {
    const sw      = menu.sharedWith?.find(s => s.name === u.name);
    const checked = sw ? 'checked' : '';
    const role    = sw?.role ?? 'viewer';
    return `<div class="cat-row" style="gap:8px;align-items:center">
      <input type="checkbox" id="share-chk-${u.id}" value="${u.id}" ${checked}
             onchange="document.getElementById('share-role-${u.id}').disabled=!this.checked"
             style="margin:0;width:16px;height:16px;cursor:pointer;accent-color:var(--acc)">
      <label for="share-chk-${u.id}" style="flex:1;cursor:pointer">${esc(u.name)}</label>
      <select id="share-role-${u.id}" ${checked ? '' : 'disabled'}
              style="width:auto;padding:4px 8px;font-size:.8rem">
        <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Visitante</option>
        <option value="editor" ${role === 'editor' ? 'selected' : ''}>Editor</option>
        <option value="admin"  ${role === 'admin'  ? 'selected' : ''}>Admin</option>
      </select>
    </div>`;
  }).join('');
}

async function saveShareModal() {
  const menuId    = parseInt(document.getElementById('share-modal-menu-id').value, 10);
  const sheetName = document.getElementById('share-sheet-name').value.trim();
  const errEl     = document.getElementById('share-error');
  errEl.textContent = '';

  if (!sheetName)    { errEl.textContent = 'Nombre de hoja obligatorio.'; return; }
  if (!getGasUrl())  { errEl.textContent = 'Configura la URL de GAS en el panel Admin.'; return; }

  const users      = loadUsers().filter(u => u.id !== currentUser?.id);
  const sharedWith = users
    .filter(u => document.getElementById(`share-chk-${u.id}`)?.checked)
    .map(u => ({ name: u.name, role: document.getElementById(`share-role-${u.id}`)?.value ?? 'viewer' }));

  shareMenu(menuId, sheetName, sharedWith);

  try {
    setSyncBadge('saving');
    await pushSharedConfig();
    setSyncBadge('ok');
    closeShareModal();
    buildNav();
    renderCustomMenu(menuId);
    showToast('Menú compartido ✓');
  } catch (e) {
    setSyncBadge('error');
    errEl.textContent = 'Error al sincronizar: ' + e.message;
  }
}
