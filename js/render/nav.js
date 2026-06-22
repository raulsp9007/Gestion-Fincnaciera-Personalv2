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
    ${getSharedDeudasMenus().map(m => `
      <a class="${_currentView === 'sdeudas-' + m.id ? 'active' : ''}"
         onclick="switchView('sdeudas-${m.id}')">
        <span class="ico">💳</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span>
        <span title="Compartido" style="font-size:.6rem;padding:1px 6px;border-radius:99px;background:#22c55e22;color:#22c55e;font-weight:700;flex-shrink:0;line-height:1.6">Sync</span>
      </a>`).join('')}
    ${menus.map(m => `
      <a class="${_currentView === 'menu-' + m.id ? 'active' : ''}"
         onclick="switchView('menu-${m.id}')">
        <span class="ico">${esc(m.icon ?? '📋')}</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</span>
        ${m.shared ? `<span title="Compartido" style="font-size:.6rem;padding:1px 6px;border-radius:99px;background:#22c55e22;color:#22c55e;font-weight:700;flex-shrink:0;line-height:1.6">Sync</span>` : ''}
        ${isAdmin ? `<span onclick="event.stopPropagation();confirmDeleteMenu(${m.id})"
                          title="Eliminar menú"
                          style="flex-shrink:0;padding:1px 5px;border-radius:5px;opacity:0;font-size:.75rem;color:var(--red);line-height:1;transition:.15s"
                          onmouseenter="this.style.opacity='1'"
                          onmouseleave="this.style.opacity='0'">🗑️</span>` : ''}
      </a>`).join('')}
    ${isAdmin || currentUser?.role === 'editor' ? `
    <a onclick="openNewMenuModal()">
      <span class="ico">➕</span> Nuevo menú
    </a>` : ''}
    ${isAdmin ? `
    <a onclick="openAdminPanel()">
      <span class="ico">⚙️</span> Admin
    </a>` : ''}
    ${_buildGasIdentityNav()}
    <a class="nav-logout" onclick="logout()">
      <span class="ico">🚪</span> Cerrar sesión
    </a>
  `;
}

function _buildBottomNav() {
  const initial     = (currentUser?.name ?? '?').charAt(0).toUpperCase();
  const menus       = getCustomMenus();
  const sharedDe    = getSharedDeudasMenus();

  document.getElementById('bottom-nav').innerHTML = `
    <a class="${_currentView === 'inicio' ? 'active' : ''}" onclick="switchView('inicio')">
      <span class="bn-ico">🏠</span>
      <span>Inicio</span>
    </a>
    <a class="${_currentView === 'deudas' ? 'active' : ''}" onclick="switchView('deudas')">
      <span class="bn-ico">💳</span>
      <span>Deudas</span>
    </a>
    ${sharedDe.map(m => `
      <a class="${_currentView === 'sdeudas-' + m.id ? 'active' : ''}"
         onclick="switchView('sdeudas-${m.id}')">
        <span class="bn-ico">💳</span>
        <span>${esc(m.name.slice(0, 8))}</span>
      </a>`).join('')}
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
  } else if (viewId.startsWith('sdeudas-')) {
    document.getElementById('view-deudas').classList.add('active');
    renderDeudas(parseInt(viewId.slice(8), 10));
  } else {
    document.getElementById('view-' + viewId)?.classList.add('active');
    if (viewId === 'inicio')  renderInicio();
    if (viewId === 'deudas')  { renderDeudas('local'); }
  }

  _currentView = viewId;
  document.getElementById('topbar-title').textContent = _viewTitle(viewId);
  buildNav();
}

function _buildGasIdentityNav() {
  const id = (typeof getGasIdentity === 'function') ? getGasIdentity() : null;
  if (id) {
    return `
      <div style="margin:8px 0 4px;padding:8px 12px;background:var(--bg2);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:.65rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Servidor conectado</div>
        <div style="font-size:.78rem;font-weight:600;color:var(--green);margin-bottom:6px">🔗 ${esc(id.username)}</div>
        <a onclick="disconnectGasIdentity()" style="font-size:.7rem;color:var(--red);cursor:pointer;text-decoration:none;display:block">Desconectar</a>
      </div>`;
  }
  return `
    <a onclick="openGasConnectModal()" style="color:var(--text2);font-size:.82rem">
      <span class="ico">🔗</span> Conectar servidor
    </a>`;
}

function _viewTitle(viewId) {
  if (viewId === 'inicio')  return 'Inicio';
  if (viewId === 'deudas')  return '💳 Deudas';
  if (viewId.startsWith('sdeudas-')) {
    const m = getSharedDeudasMenu(parseInt(viewId.slice(8), 10));
    return m ? `💳 ${m.name}` : 'Deudas';
  }
  if (viewId.startsWith('menu-')) {
    const m = getCustomMenu(parseInt(viewId.slice(5), 10));
    return m ? `${m.icon ?? '📋'} ${m.name}` : 'Menú';
  }
  return 'CashMap';
}
