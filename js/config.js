'use strict';

// ── Versión y caché ───────────────────────────────────────
const APP_VERSION  = '2.0.0';
const CACHE_KEY    = 'cashmap_v2_data';
const USERS_KEY    = 'cashmap_v2_users';
const SESSION_KEY  = 'cashmap_v2_session';
const SYNC_QUEUE   = 'cashmap_v2_sync_queue';
const GAS_URL_KEY  = 'cashmap_v2_gas_url';

// ── Sync ──────────────────────────────────────────────────
const POLL_INTERVAL_VISIBLE    = 30_000;  // 30s
const POLL_INTERVAL_BACKGROUND = 300_000; // 5min
const SAVE_DEBOUNCE            = 0;       // sin debounce — push inmediato para menús compartidos

// ── Datos por defecto ─────────────────────────────────────
const DEFAULT_DATA = {
  version:     2,
  inicio:      [],
  customMenus: [],
  globalCats:  { inc: {}, exp: {} },
  budgets:     {},
  navOrder:    ['inicio'],
  config:      {}
};

// ── Categorías por defecto ────────────────────────────────
const DEFAULT_CATS = {
  inc: {
    salario:    { label: 'Salario',    color: '#22c55e' },
    freelance:  { label: 'Freelance',  color: '#3b82f6' },
    otros_ing:  { label: 'Otros',      color: '#a78bfa' }
  },
  exp: {
    comida:     { label: 'Comida',     color: '#ef4444' },
    transporte: { label: 'Transporte', color: '#f59e0b' },
    hogar:      { label: 'Hogar',      color: '#8b5cf6' },
    ocio:       { label: 'Ocio',       color: '#ec4899' },
    salud:      { label: 'Salud',      color: '#06b6d4' },
    otros:      { label: 'Otros',      color: '#64748b' }
  }
};
