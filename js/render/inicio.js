'use strict';

// ── Chart instances ───────────────────────────────────────
let _chart1 = null;
let _chart2 = null;

// ── Active month ──────────────────────────────────────────
let _inicioMonth = null;

// ── Helpers ───────────────────────────────────────────────
function fmtMoney(n) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency', currency: 'EUR', maximumFractionDigits: 2
  }).format(n ?? 0);
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function _monthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(+y, +m - 1, 1)
    .toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
}

function _ym() {
  return new Date().toISOString().slice(0, 7);
}

// ── Main render ───────────────────────────────────────────
function renderInicio() {
  if (!_inicioMonth) _inicioMonth = _ym();

  const el   = document.getElementById('view-inicio');
  const cats = loadData().globalCats;
  const txs  = getTxsForMonth(_inicioMonth);

  const inc = txs.filter(t => t.type === 'inc').reduce((s, t) => s + t.amount, 0);
  const exp = txs.filter(t => t.type === 'exp').reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;

  el.innerHTML = `
    ${_buildMonthTabs()}
    <div class="cards">
      <div class="card green">
        <div class="label">Ingresos</div>
        <div class="value">${fmtMoney(inc)}</div>
      </div>
      <div class="card red">
        <div class="label">Gastos</div>
        <div class="value">${fmtMoney(exp)}</div>
      </div>
      <div class="card ${bal >= 0 ? 'blue' : 'red'}">
        <div class="label">Balance</div>
        <div class="value">${fmtMoney(bal)}</div>
      </div>
    </div>
    ${_buildBudgetBars(txs)}
    <div class="charts">
      <div class="chart-box">
        <h3>Gastos por categoría</h3>
        <canvas id="inicio-doughnut" height="160"></canvas>
      </div>
      <div class="chart-box">
        <h3>Evolución mensual</h3>
        <canvas id="inicio-bar" height="160"></canvas>
      </div>
    </div>
    ${_buildTxTable(txs, cats)}
  `;

  _drawCharts(txs, cats);
}

// ── Month tabs ────────────────────────────────────────────
function _buildMonthTabs() {
  const months = [];
  const now    = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }
  return `<div class="month-tabs">
    ${months.map(ym => `
      <button class="month-tab ${ym === _inicioMonth ? 'active' : ''}"
              onclick="selectInicioMonth('${ym}')">
        ${_monthLabel(ym)}
      </button>
    `).join('')}
  </div>`;
}

function selectInicioMonth(ym) {
  _inicioMonth = ym;
  renderInicio();
}

// ── Recurring badge (v1 style) ────────────────────────────
function _recBadge(tx) {
  if (!tx.recurring) return '';
  const lbl = { semanal: 'Semanal', mensual: 'Mensual', anual: 'Anual' }[tx.recurring] || tx.recurring;
  let nextStr = '';
  if (tx.recurringNext) {
    const d = new Date(tx.recurringNext + 'T00:00:00');
    nextStr = ' · ' + d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
  const title = `Recurrencia: ${lbl}${tx.recurringNext ? ' — Próxima: ' + tx.recurringNext : ''}`;
  return `<span class="rec-badge" title="${esc(title)}">🔄 ${lbl}${nextStr}</span>`;
}

// ── Expandable note (v1 style) ────────────────────────────
function _renderNote(note) {
  if (!note || !note.trim()) return '<span style="color:var(--text2);font-size:.78rem">—</span>';
  if (note.length <= 40) return `<span style="color:var(--text2);font-size:.78rem">${esc(note)}</span>`;
  const uid = 'n' + Math.random().toString(36).slice(2, 8);
  return `<span id="${uid}t" style="color:var(--text2);font-size:.78rem;cursor:pointer"
    onclick="this.style.display='none';document.getElementById('${uid}f').style.display='inline'"
    >${esc(note.slice(0, 40))}…</span><span id="${uid}f"
    style="display:none;color:var(--text2);font-size:.78rem;cursor:pointer"
    onclick="this.style.display='none';document.getElementById('${uid}t').style.display='inline'"
    >${esc(note)}</span>`;
}

// ── Transaction table ─────────────────────────────────────
function _buildTxTable(txs, cats) {
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
      <div class="tbl-header">
        <h3>Movimientos</h3>
      </div>
      <div class="tbl-scroll">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Monto</th>
              <th>Descripción</th>
              <th>Tipo</th>
              <th>Categoría</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map(tx => _buildTxRow(tx, cats)).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function _buildTxRow(tx, cats) {
  const catMap    = cats[tx.type] ?? {};
  const cat       = catMap[tx.category] ?? { label: tx.category ?? '—', color: '#a78bfa' };
  const typeLabel = tx.type === 'inc' ? 'Ingreso' : 'Gasto';
  const sign      = tx.type === 'inc' ? '+' : '-';

  return `<tr>
    <td style="color:var(--text2);white-space:nowrap">${fmtDate(tx.date)}</td>
    <td class="amount ${tx.type}" style="white-space:nowrap">
      ${sign}${fmtMoney(tx.amount)}${_recBadge(tx)}
    </td>
    <td style="font-weight:500">${esc(tx.description)}</td>
    <td><span class="badge ${tx.type}">${typeLabel}</span></td>
    <td>
      <span class="cat-dot" style="background:${cat.color}"></span>
      <span class="home-cat-badge">${esc(cat.label)}</span>
    </td>
    <td>${_renderNote(tx.notes)}</td>
    <td style="text-align:right;white-space:nowrap">
      <button class="btn-icon" title="Editar"   onclick="openEditTxModal(${tx.id})">✏️</button>
      <button class="btn-icon" title="Eliminar" onclick="confirmDeleteTx(${tx.id})">🗑️</button>
    </td>
  </tr>`;
}

// ── Charts ────────────────────────────────────────────────
function _drawCharts(txs, cats) {
  if (_chart1) { _chart1.destroy(); _chart1 = null; }
  if (_chart2) { _chart2.destroy(); _chart2 = null; }
  if (typeof Chart === 'undefined') return;

  // Doughnut — expenses by category
  const expCats  = cats.exp ?? {};
  const catTotals = {};
  for (const t of txs.filter(t => t.type === 'exp')) {
    catTotals[t.category] = (catTotals[t.category] ?? 0) + t.amount;
  }
  const dLabels = Object.keys(catTotals).map(k => expCats[k]?.label ?? k);
  const dValues = Object.values(catTotals);
  const dColors = Object.keys(catTotals).map(k => expCats[k]?.color ?? '#64748b');

  const ctx1 = document.getElementById('inicio-doughnut');
  if (ctx1) {
    _chart1 = new Chart(ctx1, {
      type: 'doughnut',
      data: { labels: dLabels, datasets: [{ data: dValues, backgroundColor: dColors, borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, padding: 10 } },
          tooltip: { callbacks: { label: c => ` ${fmtMoney(c.raw)}` } }
        }
      }
    });
  }

  // Bar — inc vs exp last 6 months
  const allTxs = getTxs();
  const [selY, selM] = _inicioMonth.split('-').map(Number);
  const barMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(selY, selM - 1 - (5 - i), 1);
    return d.toISOString().slice(0, 7);
  });
  const barInc = barMonths.map(ym =>
    allTxs.filter(t => t.type === 'inc' && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0));
  const barExp = barMonths.map(ym =>
    allTxs.filter(t => t.type === 'exp' && t.date.startsWith(ym)).reduce((s, t) => s + t.amount, 0));

  const ctx2 = document.getElementById('inicio-bar');
  if (ctx2) {
    _chart2 = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: barMonths.map(ym => _monthLabel(ym)),
        datasets: [
          { label: 'Ingresos', data: barInc, backgroundColor: '#22c55e99', borderRadius: 4 },
          { label: 'Gastos',   data: barExp, backgroundColor: '#ef444499', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 10, padding: 8 } },
          tooltip: { callbacks: { label: c => ` ${fmtMoney(c.raw)}` } }
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 10 }, callback: v => '€' + v }, grid: { color: '#1e293b' } }
        }
      }
    });
  }
}

// ── Tx modal — shared state ───────────────────────────────
let _txContext = { src: 'inicio', menuId: null }; // shared with custom-menu.js

// ── Category color helpers ────────────────────────────────
function _getCatColor(catKey) {
  const cats = loadData().globalCats;
  return cats.inc[catKey]?.color ?? cats.exp[catKey]?.color ?? '#64748b';
}

function _updateCatColorPicker() {
  const inp = document.getElementById('tx-cat-color');
  if (!inp) return;
  const catKey = document.getElementById('tx-cat').value;
  inp.value = _getCatColor(catKey);
}

function _saveCatColor() {
  const catKey = document.getElementById('tx-cat').value;
  const color  = document.getElementById('tx-cat-color').value;
  if (!catKey || !color) return;
  const d    = loadData();
  const side = d.globalCats.inc[catKey] ? 'inc' : 'exp';
  if (d.globalCats[side]?.[catKey]) {
    d.globalCats[side][catKey].color = color;
    saveData();
    showToast('Color guardado');
  }
}

// ── Modal open / close ────────────────────────────────────
function openNewRecordModal() {
  if (typeof _currentView !== 'undefined' && _currentView.startsWith('menu-')) {
    _txContext = { src: 'custom', menuId: parseInt(_currentView.slice(5), 10) };
  } else {
    _txContext = { src: 'inicio', menuId: null };
  }
  const curr = _txContext.menuId ? (getCustomMenu(_txContext.menuId)?.currency ?? '€') : '€';
  document.getElementById('tx-modal-curr').textContent = `(${curr})`;
  document.getElementById('tx-id').value              = '';
  document.getElementById('tx-modal-title').textContent = 'Nuevo movimiento';
  document.getElementById('tx-date').value            = new Date().toISOString().slice(0, 10);
  document.getElementById('tx-amount').value          = '';
  document.getElementById('tx-desc').value            = '';
  document.getElementById('tx-notes').value           = '';
  document.getElementById('tx-recurring').value       = '';
  document.getElementById('tx-error').textContent     = '';
  document.getElementById('tx-type').value            = 'exp';
  _updateTxCatOptions();
  _updateCatColorPicker();
  document.getElementById('tx-modal').classList.add('open');
}

function openEditTxModal(txId) {
  _txContext = { src: 'inicio', menuId: null };
  const tx   = getTxs().find(t => t.id === txId);
  if (!tx) return;
  document.getElementById('tx-modal-curr').textContent = '(€)';
  document.getElementById('tx-id').value              = txId;
  document.getElementById('tx-modal-title').textContent = 'Editar movimiento';
  document.getElementById('tx-date').value            = tx.date;
  document.getElementById('tx-amount').value          = tx.amount;
  document.getElementById('tx-desc').value            = tx.description;
  document.getElementById('tx-notes').value           = tx.notes ?? '';
  document.getElementById('tx-recurring').value       = tx.recurring || '';
  document.getElementById('tx-error').textContent     = '';
  document.getElementById('tx-type').value            = tx.type;  // 1. set type
  _updateTxCatOptions();                                           // 2. populate cats
  document.getElementById('tx-cat').value             = tx.category; // 3. restore cat
  _updateCatColorPicker();
  document.getElementById('tx-modal').classList.add('open');
}

function onTxTypeChange() {
  _updateTxCatOptions();
  _updateCatColorPicker();
}

function _updateTxCatOptions() {
  const type = document.getElementById('tx-type')?.value ?? 'exp';
  const cats = loadData().globalCats[type] ?? {};
  document.getElementById('tx-cat').innerHTML =
    Object.entries(cats).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('');
}

function closeTxModal() {
  document.getElementById('tx-modal').classList.remove('open');
}

function saveTx() {
  const id     = document.getElementById('tx-id').value;
  const date   = document.getElementById('tx-date').value;
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const type   = document.getElementById('tx-type').value;
  const cat    = document.getElementById('tx-cat').value;
  const desc   = document.getElementById('tx-desc').value.trim();
  const notes  = document.getElementById('tx-notes').value.trim();
  const errEl  = document.getElementById('tx-error');
  errEl.textContent = '';

  if (!date)                 { errEl.textContent = 'Fecha obligatoria.'; return; }
  if (!amount || amount <= 0){ errEl.textContent = 'Importe debe ser mayor que 0.'; return; }
  if (!desc)                 { errEl.textContent = 'Descripción obligatoria.'; return; }

  const recurring     = document.getElementById('tx-recurring').value || false;
  const recurringNext = recurring ? nextOccurrence(date, recurring) : undefined;
  const fields = { date, amount, description: desc, type, category: cat, notes,
                   recurring, recurringNext };

  if (_txContext.src === 'custom') {
    const mid = _txContext.menuId;
    if (id) updateMenuTx(mid, parseInt(id, 10), fields);
    else    addMenuTx(mid, fields);
    closeTxModal();
    renderCustomMenu(mid);
    onMenuSaved(mid);
  } else {
    if (id) updateTx(parseInt(id, 10), fields);
    else    addTx(fields);
    closeTxModal();
    renderInicio();
  }
  showToast(id ? 'Movimiento actualizado' : 'Movimiento guardado');
}

// ── Budget progress bars ──────────────────────────────────
function _buildBudgetBars(txs) {
  const budgets = getBudgets();
  const entries = Object.entries(budgets);
  if (!entries.length) return '';

  const cats     = loadData().globalCats.exp ?? {};
  const expByCat = {};
  for (const tx of txs.filter(t => t.type === 'exp')) {
    expByCat[tx.category] = (expByCat[tx.category] ?? 0) + tx.amount;
  }

  const bars = entries.map(([key, { monthly }]) => {
    const cat   = cats[key] ?? { label: key, color: '#64748b' };
    const spent = expByCat[key] ?? 0;
    const pct   = Math.min(100, Math.round((spent / monthly) * 100));
    const col   = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--yellow)' : 'var(--green)';
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:4px">
        <span style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${cat.color};display:inline-block;flex-shrink:0"></span>
          ${esc(cat.label)}
        </span>
        <span style="color:${col};font-weight:600">${fmtMoney(spent)} / ${fmtMoney(monthly)}</span>
      </div>
      <div style="height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:3px;transition:width .4s"></div>
      </div>
    </div>`;
  }).join('');

  return `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:24px">
    <h3 style="font-size:.85rem;font-weight:600;margin-bottom:14px;color:var(--text2)">Presupuestos del mes</h3>
    ${bars}
  </div>`;
}

function confirmDeleteTx(txId) {
  const tx = getTxs().find(t => t.id === txId);
  if (!tx) return;
  showConfirm(`¿Eliminar "${esc(tx.description)}"?`, () => {
    deleteTx(txId);
    renderInicio();
    showToast('Movimiento eliminado', 'var(--red)');
  }, { icon: '🗑️', okLabel: 'Eliminar' });
}
