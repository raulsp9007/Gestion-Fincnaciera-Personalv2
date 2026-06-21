'use strict';

// ── Globals ───────────────────────────────────────────────
let currentUser = null;

// ── Stubs pendientes de implementación ───────────────────
function submitSetup()       { /* Fase 2 */ }
function submitLogin()       { /* Fase 2 */ }
function logout()            { /* Fase 2 */ }
function openUserMenu()      { /* Fase 2 */ }
function openAdminPanel()    { /* Fase 2 */ }
function openCatsModal()     { /* Fase 2 */ }
function openAdminSheet()    { /* Fase 2 */ }
function closeAdminSheet()   { document.getElementById('admin-sheet').classList.remove('open'); }
function openNewRecordModal(){ /* Fase 3 */ }
function forceSyncNow()      { /* Fase 5 */ }
function closeConfirm()      { document.getElementById('confirm-overlay').classList.remove('open'); }

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, color = 'var(--green)', ms = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = color;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), ms);
}

// ── Init ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Fase 1: mostrar setup screen para validar shell y CSS
  document.getElementById('setup-screen').classList.remove('hidden');
});
