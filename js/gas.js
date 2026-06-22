'use strict';

// ── GAS URL ───────────────────────────────────────────────
function getGasUrl() {
  return localStorage.getItem(GAS_URL_KEY) ?? '';
}

function setGasUrl(url) {
  const trimmed = (url ?? '').trim();
  if (trimmed) localStorage.setItem(GAS_URL_KEY, trimmed);
  else         localStorage.removeItem(GAS_URL_KEY);
}

// ── HTTP client ───────────────────────────────────────────
// Content-Type: text/plain avoids CORS preflight — GAS doPost reads body as string.
async function callGas(action, payload = {}) {
  const url = getGasUrl();
  if (!url) throw new Error('URL de GAS no configurada');

  const resp = await fetch(url, {
    method:   'POST',
    redirect: 'follow',
    headers:  { 'Content-Type': 'text/plain;charset=utf-8' },
    body:     JSON.stringify({ action, payload })
  });

  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error ?? 'Error desconocido del servidor');
  return data;
}

// ── Test connection (GET para evitar CORS redirect con POST) ─
async function testGasConnection() {
  const url = getGasUrl();
  if (!url) throw new Error('URL de GAS no configurada');
  const resp = await fetch(url + '?action=ping', { method: 'GET', redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data = await resp.json();
  if (!data.ok) throw new Error(data.error ?? 'Error desconocido');
  return data;
}
