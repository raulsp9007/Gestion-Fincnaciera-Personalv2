'use strict';

// ── Sync state ────────────────────────────────────────────
let _syncInterval = null;
let _syncPaused   = false;

// ── Start (called from startApp) ──────────────────────────
function startSync() {
  _setupVisibilityListener();
  // Fase 6: arrancar poll periódico aquí
}

function _setupVisibilityListener() {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      _pauseSync();
    } else {
      _resumeSync();
    }
  });
}

function _pauseSync() {
  _syncPaused = true;
  clearInterval(_syncInterval);
  _syncInterval = null;
}

function _resumeSync() {
  _syncPaused = false;
  // Fase 6: reiniciar poll con POLL_INTERVAL_VISIBLE
}

// ── Manual sync (botón "Sincronizar ahora") ───────────────
async function forceSyncNow() {
  if (!getGasUrl()) {
    showToast('Configura la URL de GAS primero', 'var(--yellow)');
    return;
  }
  // Fase 6: push + pull de menús compartidos
  showToast('Próximamente — Fase 6', 'var(--yellow)');
}

// ── Sync badge ────────────────────────────────────────────
function setSyncBadge(state) {
  const badge = document.getElementById('sync-badge');
  const lbl   = document.getElementById('sync-lbl');
  if (!badge || !lbl) return;

  const map = {
    local:   { cls: 'local',   txt: 'Local' },
    saving:  { cls: 'saving',  txt: 'Guardando…' },
    ok:      { cls: 'ok',      txt: 'Sincronizado' },
    error:   { cls: 'error',   txt: 'Error sync' },
    offline: { cls: 'offline', txt: 'Sin conexión' },
  };
  const s = map[state] ?? map.local;
  badge.className = 'sync-badge ' + s.cls;
  lbl.textContent = s.txt;
}
