'use strict';

let _currentView = 'inicio';

// ── Build nav ─────────────────────────────────────────────
function buildNav() {
  _buildSidebar();
  _buildBottomNav();
}

function _buildSidebar() {
  const isAdmin = currentUser?.role === 'admin';
  const menus   = getCustomMenus();

  document.getElementById('sidebar-nav').innerHTML = `
    <a class="${_currentView === 'inicio' ? 'active' : ''}" onclick="switchView('inicio')">
      <span class="ico">🏠</span> Inicio
    </a>
    <a class="${_currentView === 'deudas' ? 'active' : ''}" onclick="switchView('deudas')">
      <span class="ico">💳</span> Deudas
    </a>
    ${menus.map(m => `
      <a class="${_currentView === 'menu-' + m.id ? 'active' : ''}"
         onclick="switchView('menu-${m.id}')">
        <span class="ico">${esc(m.icon ?? '📋')}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span>
        ${isAdmin ? `<span onclick="event.stopPropagation();confirmDeleteMenu(${m.id})"
                          title="Eliminar menú"
                          style="flex-shrink:0;padding:1px 5px;border-radius:5px;opacity:0;font-size:.75rem;color:var(--red);line-height:1;transition:.15s"
                          onmouseenter="this.style.opacity='1'"
                          onmouseleave="this.style.opacity='0'">🗑️</span>` : ''}
      </a>`).join('')}
    ${isAdmin ? `
    <a onclick="openNewMenuModal()">
      <span class="ico">➕</span> Nuevo menú
    </a>
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
  const menus   = getCustomMenus().slice(0, 2); // max 2 custom menus in bottom nav

  document.getElementById('bottom-nav').innerHTML = `
    <a class="${_currentView === 'inicio' ? 'active' : ''}" onclick="switchView('inicio')">
      <span class="bn-ico">🏠</span>
      <span>Inicio</span>
    </a>
    ${menus.map(m => `
      <a class="${_currentView === 'menu-' + m.id ? 'active' : ''}"
         onclick="switchView('menu-${m.id}')">
        <span class="bn-ico">${esc(m.icon ?? '📋')}</span>
        <span>${esc(m.name.slice(0, 8))}</span>
      </a>`).join('')}
    <a onclick="openUserMenu()">
      <span class="bn-ico bn-avatar">${initial}</span>
    </a>
  `;
}

// ── Routing ───────────────────────────────────────────────
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

  if (viewId.startsWith('menu-')) {
    document.getElementById('view-custom').classList.add('active');
    renderCustomMenu(parseInt(viewId.slice(5), 10));
  } else {
    document.getElementById('view-' + viewId)?.classList.add('active');
    if (viewId === 'inicio')  renderInicio();
    if (viewId === 'deudas')  renderDeudas();
  }

  _currentView = viewId;
  document.getElementById('topbar-title').textContent = _viewTitle(viewId);
  buildNav();
}

function _viewTitle(viewId) {
  if (viewId === 'inicio')  return 'Inicio';
  if (viewId === 'deudas')  return '💳 Deudas';
  if (viewId.startsWith('menu-')) {
    const m = getCustomMenu(parseInt(viewId.slice(5), 10));
    return m ? `${m.icon ?? '📋'} ${m.name}` : 'Menú';
  }
  return 'CashMap';
}
