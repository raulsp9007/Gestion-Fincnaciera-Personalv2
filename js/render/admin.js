'use strict';

// ── Panel Admin — modal principal ─────────────────────────
function openAdminPanel() {
  renderAdminUsers();
  renderGasSection();
  document.getElementById('admin-modal').classList.add('open');
}

function closeAdminPanel() {
  document.getElementById('admin-modal').classList.remove('open');
}

// ── Lista de usuarios ─────────────────────────────────────
function renderAdminUsers() {
  const users = loadUsers();
  const el    = document.getElementById('admin-users-list');

  if (!users.length) {
    el.innerHTML = '<div class="empty">Sin usuarios</div>';
    return;
  }

  el.innerHTML = users.map(u => `
    <div class="cat-row">
      <span class="cat-row-label" style="font-weight:600">${esc(u.name)}</span>
      <span class="role-chip ${u.role}">${u.role}</span>
      ${u.id !== currentUser.id ? `
        <div class="cat-row-actions">
          <button title="Editar" onclick="openEditUserForm(${u.id})">✏️</button>
          <button title="Eliminar" onclick="confirmDeleteUser(${u.id})">🗑️</button>
        </div>
      ` : '<span style="font-size:.72rem;color:var(--text2)">(tú)</span>'}
    </div>
  `).join('');
}

// ── Formulario crear usuario ──────────────────────────────
function openCreateUserForm() {
  document.getElementById('user-form-id').value        = '';
  document.getElementById('user-form-title').textContent = 'Nuevo usuario';
  document.getElementById('user-form-name').value      = '';
  document.getElementById('user-form-role').value      = 'viewer';
  document.getElementById('user-form-pin').value       = '';
  document.getElementById('user-form-pin2').value      = '';
  document.getElementById('user-form-pin-hint').textContent = 'Requerido';
  document.getElementById('user-form-error').textContent  = '';
  document.getElementById('user-form-modal').classList.add('open');
}

// ── Formulario editar usuario ─────────────────────────────
function openEditUserForm(userId) {
  const u = loadUsers().find(u => u.id === userId);
  if (!u) return;

  document.getElementById('user-form-id').value        = userId;
  document.getElementById('user-form-title').textContent = 'Editar usuario';
  document.getElementById('user-form-name').value      = u.name;
  document.getElementById('user-form-role').value      = u.role;
  document.getElementById('user-form-pin').value       = '';
  document.getElementById('user-form-pin2').value      = '';
  document.getElementById('user-form-pin-hint').textContent = 'Dejar vacío para no cambiar';
  document.getElementById('user-form-error').textContent  = '';
  document.getElementById('user-form-modal').classList.add('open');
}

function closeUserForm() {
  document.getElementById('user-form-modal').classList.remove('open');
}

// ── Guardar (crear o editar) ──────────────────────────────
async function submitUserForm() {
  const id    = document.getElementById('user-form-id').value;
  const name  = document.getElementById('user-form-name').value.trim();
  const role  = document.getElementById('user-form-role').value;
  const pin   = document.getElementById('user-form-pin').value;
  const pin2  = document.getElementById('user-form-pin2').value;
  const errEl = document.getElementById('user-form-error');
  errEl.textContent = '';

  if (!name) { errEl.textContent = 'Nombre obligatorio.'; return; }

  if (!id) {
    // Crear
    if (!/^\d{4,8}$/.test(pin)) { errEl.textContent = 'PIN debe ser 4–8 dígitos numéricos.'; return; }
    if (pin !== pin2)           { errEl.textContent = 'Los PINs no coinciden.'; return; }
    await createUser(name, pin, role);
  } else {
    // Editar
    const uid = parseInt(id, 10);
    updateUserName(uid, name);
    updateUserRole(uid, role);
    if (pin) {
      if (!/^\d{4,8}$/.test(pin)) { errEl.textContent = 'PIN debe ser 4–8 dígitos numéricos.'; return; }
      if (pin !== pin2)           { errEl.textContent = 'Los PINs no coinciden.'; return; }
      await updateUserPin(uid, pin);
    }
  }

  closeUserForm();
  renderAdminUsers();
  showToast(id ? 'Usuario actualizado' : 'Usuario creado');
}

// ── Sección GAS ───────────────────────────────────────────
function renderGasSection() {
  const url = getGasUrl();
  document.getElementById('admin-gas-url').value = url;
  _setGasStatus(url ? 'saved' : 'empty');
}

function _setGasStatus(state, msg) {
  const el = document.getElementById('admin-gas-status');
  const map = {
    empty:   { text: 'No configurada',  color: 'var(--text2)' },
    saved:   { text: 'URL guardada',    color: 'var(--yellow)' },
    testing: { text: 'Probando…',       color: 'var(--acc)' },
    ok:      { text: msg ?? 'Conectado ✓', color: 'var(--green)' },
    error:   { text: msg ?? 'Error',    color: 'var(--red)' },
  };
  const s = map[state] ?? map.empty;
  el.textContent = s.text;
  el.style.color = s.color;
}

function saveGasUrl() {
  const url = document.getElementById('admin-gas-url').value.trim();
  setGasUrl(url);
  _setGasStatus(url ? 'saved' : 'empty');
  showToast(url ? 'URL guardada' : 'URL eliminada');
}

async function testGasUrl() {
  const url = document.getElementById('admin-gas-url').value.trim();
  if (!url) { showToast('Introduce una URL primero', 'var(--yellow)'); return; }
  setGasUrl(url);
  _setGasStatus('testing');
  try {
    const r = await testGasConnection();
    _setGasStatus('ok', `Conectado ✓ (v${r.version ?? '?'})`);
  } catch (e) {
    _setGasStatus('error', 'Error: ' + e.message);
  }
}

// ── Importar datos ────────────────────────────────────────
function handleImportFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  input.value = '';

  const reader = new FileReader();
  reader.onload = e => {
    let raw;
    try { raw = JSON.parse(e.target.result); }
    catch { showToast('JSON inválido', 'var(--red)'); return; }

    const txCount     = (raw.txs ?? raw.inicio ?? []).length;
    const menuCount   = (raw.customMenus ?? []).length;
    const homeTxCount = (raw.homeTxs ?? []).length;

    let msg = '¿Importar datos?';
    const lines = [];
    if (txCount)     lines.push(`${txCount} movimientos de inicio`);
    if (menuCount)   lines.push(`${menuCount} menús personalizados`);
    if (homeTxCount) lines.push(`${homeTxCount} movimientos de hogar`);
    if (!lines.length) { showToast('Sin datos que importar', 'var(--yellow)'); return; }
    msg += '\n• ' + lines.join('\n• ');

    showConfirm(msg, () => {
      try {
        const stats = importV1Data(raw);
        buildNav();
        renderInicio();
        showToast(`Importado: ${stats.txs} mov, ${stats.menus} menús (${stats.menuTxs} registros)`);
      } catch (err) {
        showToast('Error: ' + err.message, 'var(--red)');
      }
    }, { icon: '📥', okLabel: 'Importar' });
  };
  reader.readAsText(file);
}

// ── Eliminar ──────────────────────────────────────────────
function confirmDeleteUser(userId) {
  const u = loadUsers().find(u => u.id === userId);
  if (!u) return;
  showConfirm(`¿Eliminar usuario "${u.name}"?`, () => {
    deleteUser(userId);
    renderAdminUsers();
    showToast('Usuario eliminado', 'var(--red)');
  }, { icon: '🗑️', okLabel: 'Eliminar' });
}
