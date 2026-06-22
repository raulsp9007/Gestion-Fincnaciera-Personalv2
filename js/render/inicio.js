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
              <th>Descripción</th>
              <th>Categoría</th>
              <th style="text-align:right">Importe</th>
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
                   background:${cat.color}22;color:${cat.color}">
        ${esc(cat.label)}
      </span>
    </td>
    <td style="text-align:right;font-weight:700;color:${col};white-space:nowrap">
      ${sign}${fmtMoney(tx.amount)}
    </td>
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
let _txType    = 'exp';
let _txContext = { src: 'inicio', menuId: null }; // shared with custom-menu.js

function openNewRecordModal() {
  // Detect context from current view (defined in nav.js)
  if (typeof _currentView !== 'undefined' && _currentView.startsWith('menu-')) {
    _txContext = { src: 'custom', menuId: parseInt(_currentView.slice(5), 10) };
  } else {
    _txContext = { src: 'inicio', menuId: null };
  }
  _txType = 'exp';
  document.getElementById('tx-id').value              = '';
  document.getElementById('tx-modal-title').textContent = 'Nuevo movimiento';
  document.getElementById('tx-date').value            = new Date().toISOString().slice(0, 10);
  document.getElementById('tx-amount').value          = '';
  document.getElementById('tx-desc').value            = '';
  document.getElementById('tx-notes').value           = '';
  document.getElementById('tx-error').textContent     = '';
  _setTxTypeUI('exp');
  _updateTxCatOptions();
  document.getElementById('tx-modal').classList.add('open');
}

function openEditTxModal(txId) {
  _txContext = { src: 'inicio', menuId: null };
  const tx   = getTxs().find(t => t.id === txId);
  if (!tx) return;
  _txType = tx.type;
  document.getElementById('tx-id').value              = txId;
  document.getElementById('tx-modal-title').textContent = 'Editar movimiento';
  document.getElementById('tx-date').value            = tx.date;
  document.getElementById('tx-amount').value          = tx.amount;
  document.getElementById('tx-desc').value            = tx.description;
  document.getElementById('tx-notes').value           = tx.notes ?? '';
  document.getElementById('tx-error').textContent     = '';
  _setTxTypeUI(tx.type);
  _updateTxCatOptions();                              // 3. populate
  document.getElementById('tx-cat').value = tx.category; // 4. restore
  document.getElementById('tx-modal').classList.add('open');
}

function setTxType(type) {
  _txType = type;
  _setTxTypeUI(type);
  _updateTxCatOptions();
}

function _setTxTypeUI(type) {
  document.getElementById('tx-type-inc').classList.toggle('active', type === 'inc');
  document.getElementById('tx-type-exp').classList.toggle('active', type === 'exp');
}

function _updateTxCatOptions() {
  const cats = loadData().globalCats[_txType] ?? {};
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
  const cat    = document.getElementById('tx-cat').value;
  const desc   = document.getElementById('tx-desc').value.trim();
  const notes  = document.getElementById('tx-notes').value.trim();
  const errEl  = document.getElementById('tx-error');
  errEl.textContent = '';

  if (!date)                 { errEl.textContent = 'Fecha obligatoria.'; return; }
  if (!amount || amount <= 0){ errEl.textContent = 'Importe debe ser mayor que 0.'; return; }
  if (!desc)                 { errEl.textContent = 'Descripción obligatoria.'; return; }

  const fields = { date, amount, description: desc, type: _txType, category: cat, notes };

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

function confirmDeleteTx(txId) {
  const tx = getTxs().find(t => t.id === txId);
  if (!tx) return;
  showConfirm(`¿Eliminar "${esc(tx.description)}"?`, () => {
    deleteTx(txId);
    renderInicio();
    showToast('Movimiento eliminado', 'var(--red)');
  }, { icon: '🗑️', okLabel: 'Eliminar' });
}
