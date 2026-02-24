// ==============================
// State Management + localStorage
// ==============================

const STORAGE_KEY = 'fg_state';

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
    goals: [],
    activeWalletId: 'hogar',
    currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
    theme: 'dark',
    userRules: [], // [{ keyword: 'starbucks', category: 'Comida', type: 'expense' }]
    supabaseConnected: false,
};

// Monthly Theme Palette (Dark Premium)
const MONTHLY_THEMES = {
    '01': { accent: '#A0C4FF', name: 'Ice Blue' },       // Enero: Invierno/Inicio
    '02': { accent: '#C8B560', name: 'Golden Olive' },   // Febrero: Elegancia (Actual)
    '03': { accent: '#9B7EC8', name: 'Amethyst' },       // Marzo: Creatividad
    '04': { accent: '#FFADAD', name: 'Cherry Blossom' }, // Abril: Primavera
    '05': { accent: '#80ED99', name: 'Fresh Green' },    // Mayo: Vida
    '06': { accent: '#E7C6FF', name: 'Lavender' },       // Junio: Calma
    '07': { accent: '#FFD6A5', name: 'Sunset' },         // Julio: Verano
    '08': { accent: '#FDFFB6', name: 'Lemon' },          // Agosto: Brillante
    '09': { accent: '#FF9B85', name: 'Terracotta' },     // Septiembre: Otoño
    '10': { accent: '#D4A853', name: 'Harvest Gold' },   // Octubre: Riqueza
    '11': { accent: '#48CAE4', name: 'Frost' },          // Noviembre: Frio
    '12': { accent: '#FF6B6B', name: 'Festive Red' },    // Diciembre: Fiestas
};

export function applyMonthlyTheme() {
    const month = state.currentMonth.split('-')[1]; // "02"
    const theme = MONTHLY_THEMES[month] || MONTHLY_THEMES['01'];

    // Set CSS Variables
    const root = document.documentElement;
    root.style.setProperty('--accent', theme.accent);

    // Generate derived colors (approximate)
    // We use a simple opacity approach for ease, or could use color-mix in CSS
    root.style.setProperty('--accent-light', `color-mix(in srgb, ${theme.accent}, transparent 88%)`);
    root.style.setProperty('--accent-glow', `color-mix(in srgb, ${theme.accent}, transparent 75%)`);

    // Update gradient to match accent (keeping gold structure but shifting hue if needed)
    // For now, we keeps gold structure but assume accent fits. 
    // Ideally, --grad-gold should typically be gold, but let's make it dynamic for "Full" effect.
    // Let's keep the gold gradient as a "Premium" standard, but update the "Accent" gradient.

    console.log(`Applied theme for ${month}: ${theme.name}`);
}

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

        // Ensure all categories have an id (esp default ones)
        let modified = false;
        Object.keys(state.categories).forEach(wId => {
            state.categories[wId].forEach(c => {
                if (!c.id) {
                    c.id = crypto.randomUUID();
                    modified = true;
                }
            });
        });
        if (modified) saveState();
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
    const isNegative = amount < 0;
    const formatted = new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    return isNegative ? `-${formatted}` : formatted;
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
