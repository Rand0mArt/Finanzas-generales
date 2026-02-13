// ==============================
// State Management + localStorage
// ==============================

const STORAGE_KEY = 'fg_state';
const DRAFT_KEY = 'fg_draft_tx';

// Default wallets based on user's existing structure
const DEFAULT_WALLETS = [
    { id: 'hogar', name: 'Hogar', emoji: '🧡', color: '#E8956E', wallet_type: 'personal', monthly_budget: 20000 },
    { id: 'random', name: 'Random', emoji: '💚', color: '#5B8C5A', wallet_type: 'business', monthly_budget: 5000 },
    { id: 'dhash', name: 'Dhash', emoji: '💜', color: '#9B7EC8', wallet_type: 'business', monthly_budget: 10000 },
];

const DEFAULT_CATEGORIES = {
    hogar: [
        { name: 'Renta', icon: '🏠', type: 'expense' },
        { name: 'Comida', icon: '🍽️', type: 'expense' },
        { name: 'Salud', icon: '💊', type: 'expense' },
        { name: 'Bebé', icon: '👶', type: 'expense' },
        { name: 'Mantenimiento', icon: '🔧', type: 'expense' },
        { name: 'Transporte', icon: '🚗', type: 'expense' },
        { name: 'Servicios', icon: '💡', type: 'expense' },
        { name: 'Personal', icon: '🧑', type: 'expense' },
        { name: 'Mascotas', icon: '🐾', type: 'expense' },
        { name: 'Suscripciones', icon: '📱', type: 'expense' },
        { name: 'Entretenimiento', icon: '🎬', type: 'expense' },
        { name: 'Otro Ingreso', icon: '💰', type: 'income' },
    ],
    random: [
        { name: 'Servicios', icon: '🎨', type: 'income' },
        { name: 'Comisiones', icon: '🤝', type: 'income' },
        { name: 'Ventas', icon: '📦', type: 'income' },
        { name: 'Renta', icon: '🏢', type: 'expense' },
        { name: 'Contabilidad', icon: '📊', type: 'expense' },
        { name: 'Servicios Op.', icon: '⚡', type: 'expense' },
        { name: 'Suscripciones', icon: '📱', type: 'expense' },
        { name: 'Marketing', icon: '📣', type: 'expense' },
        { name: 'Materiales', icon: '🎨', type: 'expense' },
        { name: 'Otros', icon: '📁', type: 'expense' },
    ],
    dhash: [
        { name: 'Cuadros', icon: '🖼️', type: 'income' },
        { name: 'Murales', icon: '🎨', type: 'income' },
        { name: 'Tattoo', icon: '✒️', type: 'income' },
        { name: 'Diseño', icon: '🎯', type: 'income' },
        { name: 'Materiales', icon: '🎨', type: 'expense' },
        { name: 'Sueldos', icon: '👥', type: 'expense' },
        { name: 'Gastos Operativos', icon: '⚡', type: 'expense' },
        { name: 'Suscripciones', icon: '📱', type: 'expense' },
        { name: 'Transporte', icon: '🚗', type: 'expense' },
        { name: 'Otros', icon: '📁', type: 'expense' },
    ],
};

const DEFAULT_ACCOUNTS = [
    { id: 'mp-hogar', name: 'Mercado Pago (Hogar)', institution: 'Mercado Pago', balance: 0, currency: 'MXN' },
    { id: 'mp-dhash', name: 'Mercado Pago (Dhash)', institution: 'Mercado Pago', balance: 0, currency: 'MXN' },
    { id: 'mp-random', name: 'Mercado Pago (Random)', institution: 'Mercado Pago', balance: 0, currency: 'MXN' },
    { id: 'bbva', name: 'BBVA', institution: 'BBVA', balance: 0, currency: 'MXN' },
];

// Reactive state
let state = {
    wallets: [...DEFAULT_WALLETS],
    categories: { ...DEFAULT_CATEGORIES },
    accounts: [...DEFAULT_ACCOUNTS],
    transactions: [],
    debts: [],
    activeWalletId: 'hogar',
    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    theme: 'dark',
    supabaseConnected: false,
};

// Listeners for reactivity
const listeners = new Set();

/**
 * Load state from localStorage
 */
export function loadState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        }
    } catch (e) {
        console.warn('Failed to load state:', e);
    }
    return state;
}

/**
 * Save state to localStorage
 */
export function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save state:', e);
    }
}

/**
 * Get current state
 */
export function getState() {
    return state;
}

/**
 * Update state and notify listeners
 */
export function setState(updates) {
    const changedKeys = new Set(Object.keys(updates));
    Object.assign(state, updates);
    saveState();
    listeners.forEach(fn => fn(state, changedKeys));
}

/**
 * Subscribe to state changes
 */
export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// ==============================
// Draft Persistence
// ==============================

export function saveDraft(formData) {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
            ...formData,
            savedAt: Date.now()
        }));
    } catch (e) { console.warn('Draft save failed:', e); }
}

export function loadDraft() {
    try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) return JSON.parse(saved);
    } catch (e) { console.warn('Draft load failed:', e); }
    return null;
}

export function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

// ==============================
// Helpers
// ==============================

export function getActiveWallet() {
    return state.wallets.find(w => w.id === state.activeWalletId) || state.wallets[0];
}

export function getWalletCategories(walletId, type) {
    const cats = state.categories[walletId] || [];
    if (type) return cats.filter(c => c.type === type);
    return cats;
}

export function getCurrentMonth() {
    const [y, m] = state.currentMonth.split('-').map(Number);
    return { year: y, month: m };
}

export function getMonthRange() {
    const { year, month } = getCurrentMonth();
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    return { start, end };
}

export function formatMonth(dateStr) {
    const [y, m] = dateStr.split('-').map(Number);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[m - 1]} ${y}`;
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Hoy';
    if (d.toDateString() === yesterday.toDateString()) return 'Ayer';

    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

// Initialize
loadState();
