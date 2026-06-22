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

// ── Categorías por defecto — orden idéntico a v1 ───────────
const DEFAULT_CATS = {
  inc: {
    ingresos:  { label: '💰 Ingresos generales', color: '#4ade80' },
    ventas:    { label: '💱 Ventas',              color: '#06b6d4' },
    envios:    { label: '📦 Envíos recibidos',    color: '#7dd3fc' },
    salario:   { label: '💼 Salario',             color: '#22c55e' },
    freelance: { label: '💻 Freelance/Extra',     color: '#34d399' },
    pension:   { label: '🏦 Pensión/Beneficio',   color: '#c084fc' },
    renta_inc: { label: '🏠 Renta recibida',      color: '#fb923c' },
    bono:      { label: '🎁 Bono/Premio',         color: '#fbbf24' },
    otros_inc: { label: '📌 Otros ingresos',      color: '#94a3b8' }
  },
  exp: {
    compras:      { label: '🛒 Compras',            color: '#f97316' },
    prestamos:    { label: '🤝 Préstamos',          color: '#f87171' },
    deuda:        { label: '💳 Deuda',              color: '#ef4444' },
    servicios:    { label: '🔧 Servicios',          color: '#60a5fa' },
    otros:        { label: '📌 Otros',              color: '#64748b' },
    alquiler:     { label: '🏠 Alquiler/Renta',    color: '#fca5a5' },
    internet:     { label: '📡 Internet/Teléfono', color: '#22d3ee' },
    mercado:      { label: '🛒 Mercado/Despensa',   color: '#a3e635' },
    comida_fuera: { label: '🍽️ Comida fuera',       color: '#f59e0b' },
    delivery:     { label: '🛵 Delivery',           color: '#fcd34d' },
    transporte:   { label: '🚗 Transporte',         color: '#a78bfa' },
    salud:        { label: '🏥 Salud/Medicinas',    color: '#f43f5e' },
    educacion:    { label: '📚 Educación',          color: '#818cf8' },
    entrete:      { label: '🎬 Entretenimiento',    color: '#e879f9' },
    ropa:         { label: '👕 Ropa/Calzado',       color: '#f472b6' },
    manten:       { label: '🔧 Mantenimiento',      color: '#9ca3af' },
    deudas_pago:  { label: '💳 Pago de deudas',    color: '#dc2626' },
    ahorro:       { label: '🏦 Ahorro',             color: '#16a34a' },
    otros_exp:    { label: '📌 Otros gastos',       color: '#475569' }
  }
};
