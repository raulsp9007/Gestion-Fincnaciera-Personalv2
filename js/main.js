'use strict';

// ── Globals ───────────────────────────────────────────────
let currentUser = null;

// ── Utilidad ─────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, color = 'var(--green)', ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

// ── Confirm dialog ────────────────────────────────────────
let _confirmCb = null;

function showConfirm(msg, onOk, { icon = '⚠️', okLabel = 'Confirmar' } = {}) {
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-msg').textContent  = msg;
  document.getElementById('confirm-ok-btn').textContent = okLabel;
  _confirmCb = onOk;
  document.getElementById('confirm-overlay').classList.add('open');
}

function closeConfirm() {
  document.getElementById('confirm-overlay').classList.remove('open');
  _confirmCb = null;
}

function confirmOk() {
  if (_confirmCb) _confirmCb();
  closeConfirm();
}

// ── Admin action sheet (mobile) ───────────────────────────
function openAdminSheet() {
  const el = document.getElementById('admin-sheet');
  document.getElementById('admin-sheet-name').textContent = currentUser?.name ?? '';
  const chip = document.getElementById('admin-sheet-role');
  chip.textContent = currentUser?.role ?? '';
  chip.className = 'role-chip ' + (currentUser?.role ?? '');
  // Mostrar opción admin solo a admins
  const adminBtn = el.querySelector('.admin-sheet-btn[data-admin]');
  if (adminBtn) adminBtn.style.display = currentUser?.role === 'admin' ? '' : 'none';
  el.classList.add('open');
}

function closeAdminSheet() {
  document.getElementById('admin-sheet').classList.remove('open');
}

// ── User menu ─────────────────────────────────────────────
function openUserMenu() {
  if (window.innerWidth <= 767) {
    openAdminSheet();
  } else {
    if (currentUser?.role === 'admin') openAdminPanel();
  }
}

// ── Stubs de fases futuras ────────────────────────────────
function openCatsModal() { showToast('Próximamente', 'var(--yellow)'); }

// ── PWA install prompt ────────────────────────────────────
let _deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = '';
});

window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  const btn = document.getElementById('btn-install');
  if (btn) btn.style.display = 'none';
});

async function installPwa() {
  if (!_deferredPrompt) return;
  _deferredPrompt.prompt();
  const { outcome } = await _deferredPrompt.userChoice;
  _deferredPrompt = null;
  if (outcome === 'accepted') {
    const btn = document.getElementById('btn-install');
    if (btn) btn.style.display = 'none';
  }
}

// ── Pantallas ─────────────────────────────────────────────
function _hideAllScreens() {
  ['setup-screen','login-screen'].forEach(id =>
    document.getElementById(id).classList.add('hidden'));
}

function showLoginScreen() {
  _hideAllScreens();
  const users = loadUsers();
  const sel   = document.getElementById('login-user-sel');
  sel.innerHTML = users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('');
  document.getElementById('login-pin').value      = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── Setup (primer admin) ──────────────────────────────────
async function submitSetup() {
  const name  = document.getElementById('setup-name').value.trim();
  const pin   = document.getElementById('setup-pin').value;
  const pin2  = document.getElementById('setup-pin2').value;
  const errEl = document.getElementById('setup-error');
  errEl.textContent = '';

  if (!name)                     { errEl.textContent = 'El nombre es obligatorio.'; return; }
  if (!/^\d{4,8}$/.test(pin))   { errEl.textContent = 'PIN debe ser 4–8 dígitos numéricos.'; return; }
  if (pin !== pin2)              { errEl.textContent = 'Los PINs no coinciden.'; return; }

  const user = await createUser(name, pin, 'admin');
  currentUser = user;
  saveSession(user);
  _hideAllScreens();
  startApp();
}

// ── Login ─────────────────────────────────────────────────
async function submitLogin() {
  const userId = parseInt(document.getElementById('login-user-sel').value, 10);
  const pin    = document.getElementById('login-pin').value;
  const errEl  = document.getElementById('login-error');
  errEl.textContent = '';

  const user = await validateLogin(userId, pin);
  if (!user) { errEl.textContent = 'PIN incorrecto.'; return; }

  currentUser = user;
  saveSession(user);
  document.getElementById('login-screen').classList.add('hidden');
  startApp();
}

// ── Logout ────────────────────────────────────────────────
function logout() {
  currentUser = null;
  clearSession();
  document.getElementById('app').classList.add('hidden');
  showLoginScreen();
}

// ── App start ─────────────────────────────────────────────
function startApp() {
  // Aplicar rol a <body> para control CSS
  document.body.classList.remove('is-admin','is-editor','is-viewer');
  document.body.classList.add('is-' + currentUser.role);

  // Actualizar topbar / sidebar user info
  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('topbar-user-name').textContent  = currentUser.name;
  const chip = document.getElementById('topbar-role-chip');
  chip.textContent = currentUser.role;
  chip.className   = 'role-chip ' + currentUser.role;

  // Botón admin
  const btnAdmin = document.getElementById('btn-admin');
  if (btnAdmin) btnAdmin.style.display = currentUser.role === 'admin' ? '' : 'none';

  buildNav();
  switchView('inicio');
  renderInicio();
  startSync();

  document.getElementById('app').classList.remove('hidden');
}

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const users = loadUsers();

  if (!users.length) {
    // Primera vez
    document.getElementById('setup-screen').classList.remove('hidden');
    return;
  }

  // Intentar reanudar sesión guardada
  const sess = loadSession();
  if (sess) {
    const u = users.find(u => u.id === sess.id);
    if (u) {
      currentUser = u;
      startApp();
      return;
    }
  }

  showLoginScreen();
});
