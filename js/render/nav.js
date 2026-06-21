'use strict';

let _currentView = 'inicio';

// ── Construir nav completo ────────────────────────────────
function buildNav() {
  _buildSidebar();
  _buildBottomNav();
}

function _buildSidebar() {
  const isAdmin = currentUser?.role === 'admin';
  document.getElementById('sidebar-nav').innerHTML = `
    <a class="${_currentView === 'inicio' ? 'active' : ''}" onclick="switchView('inicio')">
      <span class="ico">🏠</span> Inicio
    </a>
    ${isAdmin ? `
    <a onclick="openAdminPanel()">
      <span class="ico">⚙️</span> Admin
    </a>` : ''}
    <a class="nav-logout" onclick="logout()">
      <span class="ico">🚪</span> Cerrar sesión
    </a>
  `;
}

function _buildBottomNav() {
  const initial = (currentUser?.name ?? '?').charAt(0).toUpperCase();
  document.getElementById('bottom-nav').innerHTML = `
    <a class="${_currentView === 'inicio' ? 'active' : ''}" onclick="switchView('inicio')">
      <span class="bn-ico">🏠</span>
      <span>Inicio</span>
    </a>
    <a onclick="openUserMenu()">
      <span class="bn-ico bn-avatar">${initial}</span>
    </a>
  `;
}

// ── Routing ───────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + viewId);
  if (target) target.classList.add('active');
  _currentView = viewId;
  document.getElementById('topbar-title').textContent = viewId === 'inicio' ? 'Inicio' : 'CashMap';
  buildNav();
}
