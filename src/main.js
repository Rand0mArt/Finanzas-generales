// ==============================
// Finanzas Generales 1.0 — Main Entry Point
// ==============================
import './style.css';
import {
  getState, setState, subscribe, saveState,
  getActiveWallet, getWalletCategories,
  getMonthRange, applyMonthlyTheme
} from './state.js';
import { formatMonth, formatCurrency, formatDate } from './utils/formatters.js';
import {
  initSupabase, isConnected, saveSupabaseConfig,
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  fetchWallets, createWallet,
  fetchCategories, syncFromSupabase, subscribeToTransactions, searchHistoricalTransactions,
  fetchFixedExpenses, createFixedExpense, updateFixedExpense, deleteFixedExpense,
  fetchAnnualTransactions
} from './supabase.js';
import { suggestCategoryFromHistory, autoFillTransaction } from './auto-categorize.js';

// ==============================
import { $, showToast, confettiEffect, openModal, closeModal } from './utils/dom.js';
import { renderGoals, openGoalModal, submitGoal, submitAddFund } from './ui/goals.js';
import {
  initTransactionsUI, renderTransactionList, renderAllTransactions,
  startEditTransaction, submitTransaction, confirmDeleteTransaction, resetForm, toggleSort
} from './ui/transactions.js';
import { renderDashboard } from './ui/dashboard.js';

const walletSwitcher = $('walletSwitcher');
const monthLabel = $('monthLabel');
const recentTransactions = $('recentTransactions');
const allTransactions = $('allTransactions');
const categoryChips = $('categoryChips');
const autoSuggest = $('autoSuggest');
const quickEntryModal = $('quickEntryModal');
const addWalletModal = $('addWalletModal');
const addGoalModal = $('addGoalModal');
const settingsWallets = $('settingsWallets');
const toast = $('toast');

let categoryChart = null;
let currentFilter = 'all';
let currentYear = new Date().getFullYear();
let annualChart = null;


// ==============================
// Init
// ==============================
async function init() {
  window.addEventListener("unhandledrejection", (e) => { document.body.innerHTML = `<h1 style="color:red;z-index:9999;position:fixed">UNHANDLED: ${e.reason}</h1>`; });
  window.onerror = (msg, src, line) => { document.body.innerHTML = `<h1 style="color:red;z-index:9999;position:fixed">ERROR: ${msg} line ${line}</h1>`; };

  const state = getState();

  // Apply theme
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon(state.theme);
  applyMonthlyTheme();

  // Sync from Supabase if connected
  if (isConnected()) {
    const synced = await syncFromSupabase();
    if (synced) {
      setState({
        wallets: synced.wallets.map(w => ({
          id: w.id,
          name: w.name,
          emoji: w.emoji,
          color: w.color,
          wallet_type: w.wallet_type,
          monthly_budget: Number(w.monthly_budget) || 0,
        })),
        categories: Object.fromEntries(
          Object.entries(synced.categories).map(([wId, cats]) => [
            wId,
            cats.map(c => ({ id: c.id, name: c.name, icon: c.icon, type: c.type }))
          ])
        ),
        goals: (synced.goals || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        activeWalletId: synced.wallets[0]?.id || state.activeWalletId,
        supabaseConnected: true,
      });
    }
  }

  // Render wallet tabs
  renderWalletSwitcher();

  // Set date on form
  $('entryDate').value = new Date().toISOString().split('T')[0];

  // Set month
  updateMonthLabel();

  // Load data
  await refreshData();

  // Network status listeners
  window.addEventListener('online', () => {
    showToast('Conexión restaurada', null, null);
    $('submitEntry').disabled = false;
    refreshData();
  });

  window.addEventListener('offline', () => {
    showToast('Estás desconectado', null, null);
    $('submitEntry').disabled = true;
  });

  if (!navigator.onLine) {
    showToast('Sin conexión', null, null);
    $('submitEntry').disabled = true;
  }

  // Init Supabase UI
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('fg_supabase_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('fg_supabase_key') || '';
  if ($('supabaseUrl')) $('supabaseUrl').value = url;
  if ($('supabaseKey')) $('supabaseKey').value = key;

  // Load Profile
  const savedName = localStorage.getItem('fg_profileName') || 'Diego';
  updateProfileUI(savedName);
  if ($('profileName')) $('profileName').value = savedName;

  // Load avatar photo if saved
  const savedAvatar = localStorage.getItem('fg_avatarUrl');
  if (savedAvatar) applyAvatarImage(savedAvatar);

  // Bind events
  bindEvents();

  // Init Transactions UI
  initTransactionsUI({
    refresh: refreshData,
    resetForm: resetForm,
    renderCategoryChips: renderCategoryChips,
    filterCallback: () => renderAllTransactions(getState().transactions)
  });

  // Subscribe to state changes — only re-render lightweight UI
  subscribe((newState, changedKeys) => {
    if (changedKeys.has('activeWalletId') || changedKeys.has('wallets')) {
      renderWalletSwitcher();
      refreshData();
    }
    if (changedKeys.has('currentMonth')) {
      updateMonthLabel();
      refreshData();
    }
  });

  // Setup Realtime Subscription
  if (isConnected()) {
    subscribeToTransactions((payload) => {
      refreshData();
    });
  }
}

// ==============================
// Wallet Switcher
// ==============================
function renderWalletSwitcher() {
  const state = getState();
  walletSwitcher.innerHTML = state.wallets.map(w => `
    <button class="wallet-tab ${w.id === state.activeWalletId ? 'active' : ''}" data-wallet="${w.id}">
      <span class="emoji">${w.emoji}</span>
      <span>${w.name}</span>
    </button>
  `).join('') + `<button class="wallet-tab add-wallet" id="addWalletTab">+</button>`;

  walletSwitcher.querySelectorAll('.wallet-tab:not(.add-wallet)').forEach(tab => {
    tab.addEventListener('click', () => {
      setState({ activeWalletId: tab.dataset.wallet });
    });
  });

  const addTab = walletSwitcher.querySelector('.add-wallet');
  if (addTab) {
    addTab.addEventListener('click', () => openModal(addWalletModal));
  }
}

// ==============================
// Data Refresh
// ==============================
let isRefreshing = false;

async function refreshData() {
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const state = getState();
    const wallet = getActiveWallet();
    const { start, end } = getMonthRange();

    // Calculate Global Balance
    let allTxs = [];
    if (isConnected()) {
      allTxs = await fetchTransactions(null, start, end);
    } else {
      allTxs = state.transactions.filter(tx => tx.date >= start && tx.date <= end) || [];
    }
    const globalIncome = allTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const globalExpense = allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const globalLiquidity = globalIncome - globalExpense;

    // Fetch wallet transactions
    let transactions = [];
    if (isConnected()) {
      transactions = await fetchTransactions(wallet.id, start, end);
      state.transactions = transactions;
      saveState();
    } else {
      transactions = state.transactions.filter(tx =>
        tx.wallet_id === wallet.id && tx.date >= start && tx.date <= end
      );
    }

    // Apply view filter
    const visibleTransactions = currentFilter === 'all'
      ? transactions
      : transactions.filter(t => t.type === currentFilter);

    // Update view toggle button states
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === currentFilter);
    });

    renderDashboard(visibleTransactions, globalLiquidity, wallet);
    renderAllTransactions(visibleTransactions);
    renderTransactionList(recentTransactions, visibleTransactions);

    const modalOpen = quickEntryModal.classList.contains('active');
    if (!modalOpen) {
      renderCategoryChips();
    }

    // Render goals
    renderGoals();

    // Render fixed expenses
    await renderFixedExpenses(wallet.id);

    // Render settings wallets list
    renderSettings();
  } finally {
    isRefreshing = false;
  }
}


// ==============================
// Category Chips (Form)
// ==============================
function renderCategoryChips() {
  const state = getState();
  const type = document.querySelector('.type-btn.active')?.dataset.type || 'expense';
  const categories = getWalletCategories(state.activeWalletId, type);

  categoryChips.innerHTML = categories.map(c => `
    <button type="button" class="category-chip" data-category="${c.name}" data-icon="${c.icon}">
      ${c.icon} ${c.name}
    </button>
  `).join('');

  categoryChips.querySelectorAll('.category-chip').forEach(chip => {
    let pressTimer;
    let isLongPress = false;

    const startPress = (e) => {
      isLongPress = false;
      pressTimer = setTimeout(() => {
        isLongPress = true;
        openManageCategories(state.activeWalletId, true);
        if (navigator.vibrate) navigator.vibrate(50);
      }, 500);
    };

    const cancelPress = () => clearTimeout(pressTimer);

    chip.addEventListener('mousedown', startPress);
    chip.addEventListener('touchstart', startPress, { passive: true });
    chip.addEventListener('mouseup', cancelPress);
    chip.addEventListener('mouseleave', cancelPress);
    chip.addEventListener('touchend', cancelPress);
    chip.addEventListener('touchmove', cancelPress);
    chip.addEventListener('touchcancel', cancelPress);

    chip.addEventListener('click', (e) => {
      if (isLongPress) { e.preventDefault(); e.stopPropagation(); return; }
      categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      handleCategoryManualSelect(chip.dataset.category, type);
    });
  });
}

// ==============================
// Fixed Expenses
// ==============================
async function renderFixedExpenses(walletId) {
  const container = $('fixedExpensesList');
  const section = $('fixedExpensesSection');
  if (!container) return;

  let items = [];
  if (isConnected()) {
    items = await fetchFixedExpenses(walletId);
  }

  if (!items || items.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = 'block';

  const today = new Date().getDate();

  container.innerHTML = items.map(fe => {
    const lastPaid = fe.last_paid_date ? formatDate(fe.last_paid_date) : 'Nunca';
    const isDue = fe.day_of_month && fe.day_of_month <= today && !fe.paid_this_month;
    return `
      <div class="fixed-expense-item ${isDue ? 'due' : ''}" data-id="${fe.id}">
        <div class="fe-left">
          <label class="fe-checkbox-wrap">
            <input type="checkbox" class="fe-checkbox" data-id="${fe.id}" ${fe.paid_this_month ? 'checked' : ''}>
            <span class="fe-checkmark"></span>
          </label>
          <div class="fe-info">
            <span class="fe-name ${fe.paid_this_month ? 'paid' : ''}">${fe.emoji || '📌'} ${fe.name}</span>
            <span class="fe-meta">Día ${fe.day_of_month || '–'} · Último: ${lastPaid}</span>
          </div>
        </div>
        <div class="fe-right">
          <span class="fe-amount">${formatCurrency(fe.amount)}</span>
          <button class="fe-delete icon-btn" data-id="${fe.id}" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind checkbox toggle
  container.querySelectorAll('.fe-checkbox').forEach(cb => {
    cb.addEventListener('change', async () => {
      const id = cb.dataset.id;
      const paid = cb.checked;
      const date = paid ? new Date().toISOString().split('T')[0] : null;
      if (isConnected()) {
        await updateFixedExpense(id, {
          paid_this_month: paid,
          last_paid_date: paid ? date : undefined
        });
      }
      renderFixedExpenses(walletId);
    });
  });

  // Bind delete
  container.querySelectorAll('.fe-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar gasto fijo?')) return;
      if (isConnected()) await deleteFixedExpense(btn.dataset.id);
      renderFixedExpenses(walletId);
    });
  });
}

// ==============================
// Annual View
// ==============================
async function renderAnnualView(year) {
  const yearEl = $('currentYear');
  if (yearEl) yearEl.textContent = year;

  const wallet = getActiveWallet();
  if (!wallet) return;

  let transactions = [];
  if (isConnected()) {
    transactions = await fetchAnnualTransactions(wallet.id, year);
  } else {
    const state = getState();
    transactions = (state.transactions || []).filter(t => {
      const y = parseInt(t.date?.split('-')[0]);
      return t.wallet_id === wallet.id && y === year;
    });
  }

  const months = Array.from({ length: 12 }, (_, i) => ({
    label: new Date(year, i, 1).toLocaleString('es-MX', { month: 'short' }),
    income: 0,
    expense: 0
  }));

  transactions.forEach(t => {
    const m = parseInt(t.date?.split('-')[1]) - 1;
    if (m < 0 || m > 11) return;
    if (t.type === 'income') months[m].income += Number(t.amount);
    else months[m].expense += Number(t.amount);
  });

  // Total summary
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);
  const annualSummary = $('annualSummary');
  if (annualSummary) {
    annualSummary.innerHTML = `
      <div class="annual-summary-card income">
        <span class="summary-label">Ingresos totales</span>
        <span class="summary-amount">${formatCurrency(totalIncome)}</span>
      </div>
      <div class="annual-summary-card expense">
        <span class="summary-label">Gastos totales</span>
        <span class="summary-amount">${formatCurrency(totalExpense)}</span>
      </div>
      <div class="annual-summary-card balance">
        <span class="summary-label">Balance anual</span>
        <span class="summary-amount ${totalIncome - totalExpense >= 0 ? 'income' : 'expense'}">${formatCurrency(totalIncome - totalExpense)}</span>
      </div>
    `;
  }

  // Monthly breakdown list
  const annualMonths = $('annualMonths');
  if (annualMonths) {
    annualMonths.innerHTML = months.map((m, i) => {
      const balance = m.income - m.expense;
      const hasData = m.income > 0 || m.expense > 0;
      return `
        <div class="annual-month-row ${!hasData ? 'empty-month' : ''}">
          <span class="am-label">${m.label}</span>
          <div class="am-bars">
            <div class="am-bar income-bar" style="width:${m.income > 0 ? Math.min((m.income / Math.max(totalIncome / 12 * 2, 1)) * 100, 100) : 0}%"></div>
            <div class="am-bar expense-bar" style="width:${m.expense > 0 ? Math.min((m.expense / Math.max(totalExpense / 12 * 2, 1)) * 100, 100) : 0}%"></div>
          </div>
          <span class="am-balance ${balance >= 0 ? 'income' : 'expense'}">${hasData ? formatCurrency(balance) : '–'}</span>
        </div>
      `;
    }).join('');
  }

  // Bar chart
  const canvas = $('annualChart');
  if (!canvas) return;

  const { Chart } = await import('chart.js/auto');
  if (annualChart) annualChart.destroy();

  annualChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Ingresos',
          data: months.map(m => m.income),
          backgroundColor: 'rgba(110, 198, 160, 0.8)',
          borderRadius: 6,
          borderSkipped: false,
        },
        {
          label: 'Gastos',
          data: months.map(m => m.expense),
          backgroundColor: 'rgba(224, 122, 95, 0.8)',
          borderRadius: 6,
          borderSkipped: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#9BA1A6',
            font: { family: "'Inter', sans-serif", size: 12 },
            usePointStyle: true,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(5,5,5,0.95)',
          titleColor: '#F8F9FA',
          bodyColor: '#9BA1A6',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9BA1A6', font: { size: 11 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: {
            color: '#9BA1A6',
            font: { size: 11 },
            callback: v => formatCurrency(v)
          }
        }
      }
    }
  });
}

// ==============================
// Settings
// ==============================
function renderSettings() {
  const state = getState();
  if (!settingsWallets) return;
  settingsWallets.innerHTML = state.wallets.map(w => `
    <div class="settings-wallet-item" data-id="${w.id}">
      <div class="settings-wallet-info">
        <span>${w.emoji}</span>
        <span>${w.name}</span>
        <span style="color:var(--text-muted);font-size:0.75rem;">${w.wallet_type === 'business' ? 'Negocio' : 'Personal'}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="color:var(--text-muted);font-size:0.75rem;">${formatCurrency(w.monthly_budget || 0)}/mes</span>
        <button class="icon-btn edit-wallet-btn" data-id="${w.id}">✏️</button>
      </div>
    </div>
  `).join('');

  settingsWallets.querySelectorAll('.edit-wallet-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditWalletModal(btn.dataset.id);
    });
  });
}

// ==============================
// Profile UI
// ==============================
function updateProfileUI(name) {
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = name;
  const userAvatarEl = document.querySelector('.user-avatar-placeholder');
  if (userAvatarEl && !userAvatarEl.querySelector('img')) {
    userAvatarEl.textContent = name.charAt(0).toUpperCase();
  }
}

function applyAvatarImage(url) {
  const avatarEls = document.querySelectorAll('.user-avatar-placeholder');
  avatarEls.forEach(el => {
    el.innerHTML = `<img src="${url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  });
  const bigAvatar = $('profileAvatarBig');
  if (bigAvatar) {
    bigAvatar.innerHTML = `<img src="${url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }
}

// ==============================
// Theme Toggle
// ==============================
function updateThemeIcon(theme) {
  const toggle = $('themeToggle');
  if (!toggle) return;
  const icon = toggle.querySelector('.icon');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ==============================
// Month Navigation
// ==============================
function updateMonthLabel() {
  const state = getState();
  monthLabel.textContent = formatMonth(state.currentMonth);
}

function changeMonth(delta) {
  const state = getState();
  const [y, m] = state.currentMonth.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  setState({
    currentMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  });
  updateMonthLabel();
  applyMonthlyTheme();
}

// ==============================
// Page Navigation
// ==============================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = $(pageId);
  if (page) page.classList.add('active');

  const appHeader = $('appHeader');
  if (appHeader) {
    appHeader.style.display = pageId === 'pageDashboard' ? 'block' : 'none';
  }

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });

  // Load annual view on demand
  if (pageId === 'pageAnnual') {
    renderAnnualView(currentYear);
  }
}

// ==============================
// Wallet / Category Management
// ==============================
function openEditWalletModal(walletId) {
  const state = getState();
  const wallet = state.wallets.find(w => w.id === walletId);
  if (!wallet) return;

  $('editWalletId').value = wallet.id;
  $('editWalletName').value = wallet.name;
  $('editWalletEmoji').value = wallet.emoji;
  $('editWalletBudget').value = wallet.monthly_budget;

  openModal($('editWalletModal'));

  const deleteBtn = $('deleteWalletBtn');
  deleteBtn.onclick = () => confirmDeleteWallet(walletId);

  const manageBtn = $('manageCategoriesBtn');
  manageBtn.onclick = () => openManageCategories(walletId);
}

function openManageCategories(walletId, fromQuickEntry = false) {
  if (!fromQuickEntry) closeModal($('editWalletModal'));
  openModal($('manageCategoriesModal'));

  // Determine initial type filter
  let activeCatType = fromQuickEntry
    ? (document.querySelector('.type-btn.active')?.dataset.type || 'expense')
    : 'expense';

  renderManageCategoriesList(walletId, activeCatType);

  // Bind catTypeFilter tabs
  const filterContainer = $('catTypeFilter');
  if (filterContainer) {
    // Set initial active tab
    filterContainer.querySelectorAll('.cat-type-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.type === activeCatType);
      tab.onclick = () => {
        activeCatType = tab.dataset.type;
        filterContainer.querySelectorAll('.cat-type-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderManageCategoriesList(walletId, activeCatType);
      };
    });
  }

  // Back button
  $('backToEditWallet').onclick = () => {
    closeModal($('manageCategoriesModal'));
    if (!fromQuickEntry) {
      openEditWalletModal(walletId);
    } else {
      renderCategoryChips();
    }
  };

  const closeBtn = $('closeCategoriesModal');
  const overlay = $('manageCategoriesModal');
  const closeFunc = (e) => {
    if (e && e.target !== closeBtn && e.target !== overlay) return;
    closeModal(overlay);
    if (fromQuickEntry) renderCategoryChips();
  };
  closeBtn.onclick = closeFunc;
  overlay.onclick = closeFunc;

  // Add Category Form
  const addForm = $('addCategoryForm');
  let editingCatId = null;
  const submitBtn = addForm.querySelector('button[type="submit"]');

  const resetCatEditState = () => {
    $('newCatName').value = '';
    $('newCatEmoji').value = '';
    editingCatId = null;
    if (submitBtn) submitBtn.textContent = '＋';
  };

  window.editCatTrigger = (catId, name, icon) => {
    editingCatId = catId;
    $('newCatName').value = name;
    $('newCatEmoji').value = icon;
    if (submitBtn) submitBtn.textContent = '💾';
  };

  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = $('newCatName').value.trim();
    const emoji = $('newCatEmoji').value.trim() || '🏷️';
    if (!name) return;

    const typeForNewCat = activeCatType === 'both' ? 'both' : activeCatType;

    if (editingCatId) {
      if (isConnected()) {
        const { getSupabase } = await import('./supabase.js');
        await getSupabase().from('categories').update({ name, icon: emoji }).eq('id', editingCatId);
      }
      const state = getState();
      const cIdx = state.categories[walletId].findIndex(c => c.id === editingCatId);
      if (cIdx !== -1) {
        state.categories[walletId][cIdx] = { ...state.categories[walletId][cIdx], name, icon: emoji };
      }
      saveState();
      renderManageCategoriesList(walletId, activeCatType);
      resetCatEditState();
      return;
    }

    if (isConnected()) {
      const { createCategory } = await import('./supabase.js');
      const newCat = await createCategory({
        wallet_id: walletId,
        name,
        icon: emoji,
        type: typeForNewCat
      });
      if (newCat) {
        const state = getState();
        if (!state.categories[walletId]) state.categories[walletId] = [];
        state.categories[walletId].push(newCat);
        saveState();
        renderManageCategoriesList(walletId, activeCatType);
        $('newCatName').value = '';
        $('newCatEmoji').value = '';
      }
    } else {
      const state = getState();
      if (!state.categories[walletId]) state.categories[walletId] = [];
      state.categories[walletId].push({
        id: crypto.randomUUID(),
        name,
        icon: emoji,
        type: typeForNewCat
      });
      saveState();
      renderManageCategoriesList(walletId, activeCatType);
      resetCatEditState();
    }
  };
}

function renderManageCategoriesList(walletId, typeFilter = 'expense') {
  const state = getState();
  const allCats = state.categories[walletId] || [];

  // Filter by type — 'both' categories appear in all views
  const categories = typeFilter === 'all'
    ? allCats
    : allCats.filter(c => c.type === typeFilter || c.type === 'both');

  const list = $('manageCategoriesList');

  if (categories.length === 0) {
    list.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:1rem;font-size:0.85rem;">No hay categorías de este tipo</p>`;
    return;
  }

  list.innerHTML = categories.map(c => `
    <div class="category-manage-item">
      <span>${c.icon} ${c.name}${c.type === 'both' ? ' <span style="font-size:0.7rem;opacity:0.6">(ambos)</span>' : ''}</span>
      <div style="display: flex; gap: var(--space-xs);">
        <button class="icon-btn edit-cat-btn" data-id="${c.id}" data-name="${c.name}" data-icon="${c.icon}">✏️</button>
        <button class="icon-btn delete-cat-btn" data-id="${c.id}">🗑️</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(walletId, btn.dataset.id));
  });

  list.querySelectorAll('.edit-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.editCatTrigger) {
        window.editCatTrigger(btn.dataset.id, btn.dataset.name, btn.dataset.icon);
      }
    });
  });
}

async function deleteCategory(walletId, catId) {
  if (!confirm('¿Eliminar categoría?')) return;

  const state = getState();
  state.categories[walletId] = state.categories[walletId].filter(c => c.id !== catId);
  saveState();
  const activeCatType = $('catTypeFilter')?.querySelector('.cat-type-tab.active')?.dataset.type || 'expense';
  renderManageCategoriesList(walletId, activeCatType);

  if (isConnected()) {
    const { getSupabase } = await import('./supabase.js');
    await getSupabase().from('categories').delete().eq('id', catId);
  }
}

async function confirmDeleteWallet(walletId) {
  const state = getState();
  const wallet = state.wallets.find(w => w.id === walletId);
  if (!confirm(`¿Estás seguro de eliminar la cartera "${wallet.name}" y todas sus transacciones?`)) return;

  if (isConnected()) {
    const { getSupabase } = await import('./supabase.js');
    await getSupabase().from('wallets').delete().eq('id', walletId);
  }

  state.wallets = state.wallets.filter(w => w.id !== walletId);
  if (state.activeWalletId === walletId) {
    state.activeWalletId = state.wallets[0]?.id || null;
  }
  saveState();

  closeModal($('editWalletModal'));
  renderWalletSwitcher();
  refreshData();
  renderSettings();
  showToast('Cartera eliminada');
}

// Save Wallet Edits
$('editWalletForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('editWalletId').value;
  const updates = {
    name: $('editWalletName').value,
    emoji: $('editWalletEmoji').value,
    monthly_budget: Number($('editWalletBudget').value)
  };

  if (isConnected()) {
    const { getSupabase } = await import('./supabase.js');
    await getSupabase().from('wallets').update(updates).eq('id', id);
  }

  const state = getState();
  const wIndex = state.wallets.findIndex(w => w.id === id);
  if (wIndex >= 0) {
    state.wallets[wIndex] = { ...state.wallets[wIndex], ...updates };
    saveState();
  }

  closeModal($('editWalletModal'));
  renderWalletSwitcher();
  renderSettings();
  showToast('Cartera actualizada');
});


// ==============================
// Learning Loop
// ==============================
function handleCategoryManualSelect(categoryName, type) {
  const description = $('entryDescription').value.trim();
  if (!description) return;

  const state = getState();
  const categories = getWalletCategories(state.activeWalletId, type);
  const prediction = suggestCategoryFromHistory(description, categories, state.userRules || [], state.transactions || []);

  if (prediction.category !== categoryName) {
    const keyword = description.length < 20 ? description.toLowerCase() : description.split(' ')[0].toLowerCase();
    showToast(`¿Recordar para "${keyword}"?`, 'Guardar', () => {
      const newRule = { keywords: [keyword], category: categoryName, type };
      const newRules = [...(state.userRules || []), newRule];
      setState({ userRules: newRules });
      showToast('✅ Regla guardada');
    });
  }
}

// ==============================
// Event Bindings
// ==============================
function bindEvents() {
  // Month nav
  $('prevMonth').addEventListener('click', () => changeMonth(-1));
  $('nextMonth').addEventListener('click', () => changeMonth(1));

  // View toggle buttons
  const viewToggle = $('viewToggle');
  if (viewToggle) {
    viewToggle.addEventListener('click', (e) => {
      const btn = e.target.closest('.view-btn');
      if (!btn) return;
      currentFilter = btn.dataset.view || 'all';
      refreshData();
    });
  }

  // Tappable balance items
  const tapIncome = $('tapIncome');
  if (tapIncome) {
    tapIncome.addEventListener('click', () => {
      currentFilter = currentFilter === 'income' ? 'all' : 'income';
      refreshData();
    });
  }

  const tapExpense = $('tapExpense');
  if (tapExpense) {
    tapExpense.addEventListener('click', () => {
      currentFilter = currentFilter === 'expense' ? 'all' : 'expense';
      refreshData();
    });
  }

  // Avatar click → Settings page
  const userAvatar = $('userAvatar');
  if (userAvatar) {
    userAvatar.addEventListener('click', () => showPage('pageSettings'));
  }

  // Back from settings
  const backFromSettings = $('backFromSettings');
  if (backFromSettings) {
    backFromSettings.addEventListener('click', () => showPage('pageDashboard'));
  }

  // FAB — clean form on open
  $('fabAdd').addEventListener('click', () => {
    // Reset form to clean state
    $('entryAmount').value = '';
    $('entryDescription').value = '';
    if ($('entryNotes')) $('entryNotes').value = '';
    $('entryDate').value = new Date().toISOString().split('T')[0];
    // Reset type to expense
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="expense"]')?.classList.add('active');
    renderCategoryChips();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

  // Quick manage categories button inside entry modal
  const manageCatQuickBtn = $('manageCatQuickBtn');
  if (manageCatQuickBtn) {
    manageCatQuickBtn.addEventListener('click', () => {
      const state = getState();
      openManageCategories(state.activeWalletId, true);
    });
  }

  // Close modals
  $('closeModal').addEventListener('click', () => closeModal(quickEntryModal));
  quickEntryModal.addEventListener('click', e => {
    if (e.target === quickEntryModal) closeModal(quickEntryModal);
  });

  document.querySelectorAll('.close-wallet-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(addWalletModal));
  });
  addWalletModal.addEventListener('click', e => {
    if (e.target === addWalletModal) closeModal(addWalletModal);
  });

  document.querySelectorAll('.close-goal-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(addGoalModal));
  });
  addGoalModal.addEventListener('click', e => {
    if (e.target === addGoalModal) closeModal(addGoalModal);
  });

  // Add Goal Button
  const addGoalBtn = $('addGoalBtn');
  if (addGoalBtn) {
    addGoalBtn.addEventListener('click', () => openGoalModal());
  }

  // Add Goal Form
  $('addGoalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitGoal();
  });

  // Add Fund Modal
  const addFundModal = $('addFundModal');
  if ($('closeFundModal')) {
    $('closeFundModal').addEventListener('click', () => closeModal(addFundModal));
  }
  if (addFundModal) {
    addFundModal.addEventListener('click', e => {
      if (e.target === addFundModal) closeModal(addFundModal);
    });
  }
  if ($('addFundForm')) {
    $('addFundForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitAddFund();
    });
  }

  // Add Fixed Expense Modal
  const addFixedBtn = $('addFixedBtn');
  const addFixedModal = $('addFixedModal');
  if (addFixedBtn && addFixedModal) {
    addFixedBtn.addEventListener('click', () => openModal(addFixedModal));
    addFixedModal.addEventListener('click', e => {
      if (e.target === addFixedModal) closeModal(addFixedModal);
    });
  }
  const closeFixedModal = $('closeFixedModal');
  if (closeFixedModal) {
    closeFixedModal.addEventListener('click', () => closeModal(addFixedModal));
  }

  const addFixedForm = $('addFixedForm');
  if (addFixedForm) {
    addFixedForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const wallet = getActiveWallet();
      const name = $('fixedName').value.trim();
      const amount = parseFloat($('fixedAmount').value) || 0;
      const day = parseInt($('fixedDay').value) || 1;
      const emoji = $('fixedEmoji')?.value?.trim() || '📌';
      if (!name || amount <= 0) return;

      if (isConnected()) {
        await createFixedExpense({
          wallet_id: wallet.id,
          name,
          amount,
          day_of_month: day,
          emoji,
          is_active: true,
          paid_this_month: false
        });
      }
      addFixedForm.reset();
      closeModal(addFixedModal);
      renderFixedExpenses(wallet.id);
      showToast(`📌 Gasto fijo "${name}" agregado`);
    });
  }

  // Edit Wallet Modal
  $('closeEditWalletModal').addEventListener('click', () => closeModal($('editWalletModal')));
  $('editWalletModal').addEventListener('click', e => {
    if (e.target === $('editWalletModal')) closeModal($('editWalletModal'));
  });

  // Categories Modal
  $('closeCategoriesModal').addEventListener('click', () => closeModal($('manageCategoriesModal')));
  $('manageCategoriesModal').addEventListener('click', e => {
    if (e.target === $('manageCategoriesModal')) closeModal($('manageCategoriesModal'));
  });

  // Type toggle (entry form)
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCategoryChips();
    });
  });

  // Auto-categorize on description change
  let descDebounceTimeout;
  $('entryDescription').addEventListener('input', e => {
    clearTimeout(descDebounceTimeout);
    const val = e.target.value.trim();
    if (!val || val.length < 2) {
      autoSuggest.classList.remove('visible');
      return;
    }
    const state = getState();
    const type = document.querySelector('.type-btn.active')?.dataset.type || 'expense';
    const categories = getWalletCategories(state.activeWalletId, type);

    descDebounceTimeout = setTimeout(async () => {
      let historicalMatches = [];
      if (isConnected()) {
        historicalMatches = await searchHistoricalTransactions(val, 5);
      } else {
        historicalMatches = state.transactions.filter(t => t.description && t.description.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      }
      const uniqueDescriptions = [...new Set(historicalMatches.map(t => t.description))];
      if (uniqueDescriptions.length > 0) {
        autoSuggest.innerHTML = uniqueDescriptions.map(s => `<div class="auto-suggest-item">${s}</div>`).join('');
        autoSuggest.classList.add('visible');
        autoSuggest.querySelectorAll('.auto-suggest-item').forEach(item => {
          item.addEventListener('click', () => {
            $('entryDescription').value = item.textContent;
            autoSuggest.classList.remove('visible');
            triggerAutoCategory(item.textContent, categories, historicalMatches);
          });
        });
      } else {
        autoSuggest.classList.remove('visible');
      }
      triggerAutoCategory(val, categories, historicalMatches);
    }, 300);
  });

  $('entryDescription').addEventListener('blur', () => {
    setTimeout(() => autoSuggest.classList.remove('visible'), 200);
  });

  // Submit transaction
  $('quickEntryForm').addEventListener('submit', async e => {
    e.preventDefault();
    await submitTransaction({ refresh: refreshData, renderCategoryChips });
  });

  // Bottom nav
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  // View all transactions
  $('viewAllTx')?.addEventListener('click', () => showPage('pageTransactions'));

  // Sort Button
  const sortBtn = $('sortTxBtn');
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      toggleSort();
      refreshData();
    });
  }

  // Back from transactions
  $('backFromTx')?.addEventListener('click', () => showPage('pageDashboard'));

  // Search
  $('searchTx')?.addEventListener('input', () => refreshData());

  // Add wallet form
  $('addWalletForm').addEventListener('submit', async e => {
    e.preventDefault();
    await submitWallet();
  });

  $('addWalletBtn')?.addEventListener('click', () => openModal(addWalletModal));

  // Annual year navigation
  $('prevYear')?.addEventListener('click', () => {
    currentYear--;
    renderAnnualView(currentYear);
  });
  $('nextYear')?.addEventListener('click', () => {
    currentYear++;
    renderAnnualView(currentYear);
  });

  // Save Supabase config
  $('saveSupabase')?.addEventListener('click', () => {
    const url = $('supabaseUrl').value.trim();
    const key = $('supabaseKey').value.trim();
    if (url && key) {
      const ok = saveSupabaseConfig(url, key);
      if (ok) {
        setState({ supabaseConnected: true });
        showToast('✅ Supabase conectado');
        refreshData();
      } else {
        showToast('❌ Error de conexión');
      }
    }
  });

  // Save Profile
  $('saveProfileBtn')?.addEventListener('click', () => {
    const name = $('profileName').value.trim();
    if (name) {
      localStorage.setItem('fg_profileName', name);
      updateProfileUI(name);
      showToast('✅ Perfil actualizado');
    }
  });

  // Avatar photo upload
  const avatarFileInput = $('avatarFileInput');
  const profileAvatarBig = $('profileAvatarBig');
  if (profileAvatarBig) {
    profileAvatarBig.addEventListener('click', () => avatarFileInput?.click());
  }
  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target.result;
        localStorage.setItem('fg_avatarUrl', url);
        applyAvatarImage(url);
        showToast('📷 Foto actualizada');
      };
      reader.readAsDataURL(file);
    });
  }

  // Export CSV
  $('exportCSV')?.addEventListener('click', exportToCSV);

  // Quick Actions
  $('qaExpense')?.addEventListener('click', () => {
    $('entryAmount').value = '';
    $('entryDescription').value = '';
    if ($('entryNotes')) $('entryNotes').value = '';
    $('entryDate').value = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="expense"]')?.classList.add('active');
    renderCategoryChips();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

  $('qaIncome')?.addEventListener('click', () => {
    $('entryAmount').value = '';
    $('entryDescription').value = '';
    if ($('entryNotes')) $('entryNotes').value = '';
    $('entryDate').value = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="income"]')?.classList.add('active');
    renderCategoryChips();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

  $('qaTransactions')?.addEventListener('click', () => showPage('pageTransactions'));
}

// ==============================
// Auto-categorize helper
// ==============================
function triggerAutoCategory(text, categories, historicalMatches = []) {
  const state = getState();
  const suggestion = suggestCategoryFromHistory(text, categories, state.userRules || [], historicalMatches);
  if (suggestion.category) {
    categoryChips.querySelectorAll('.category-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === suggestion.category);
    });
    if (suggestion.isFallback) {
      showToast('⚠️ Categoría no detectada, asignando "Por Clasificar"');
    }
  }
}

// ==============================
// Submit Wallet
// ==============================
async function submitWallet() {
  const name = $('walletName').value.trim();
  const emoji = $('walletEmoji').value.trim() || '💰';
  const wallet_type = $('walletType').value;
  const monthly_budget = parseFloat($('walletBudget').value) || 0;

  if (!name) { showToast('Ingresa un nombre'); return; }

  const wallet = { name, emoji, wallet_type, monthly_budget, color: '#C8B560' };

  if (isConnected()) {
    const created = await createWallet(wallet);
    if (created) {
      const synced = await syncFromSupabase();
      if (synced) {
        setState({
          wallets: synced.wallets.map(w => ({
            id: w.id, name: w.name, emoji: w.emoji, color: w.color,
            wallet_type: w.wallet_type, monthly_budget: Number(w.monthly_budget) || 0,
          })),
          categories: Object.fromEntries(
            Object.entries(synced.categories).map(([wId, cats]) => [
              wId, cats.map(c => ({ id: c.id, name: c.name, icon: c.icon, type: c.type }))
            ])
          ),
        });
      }
    }
  } else {
    wallet.id = name.toLowerCase().replace(/\s+/g, '-');
    const state = getState();
    setState({
      wallets: [...state.wallets, wallet],
      categories: {
        ...state.categories,
        [wallet.id]: wallet_type === 'business'
          ? [{ name: 'Ingresos', icon: '💰', type: 'income' }, { name: 'Gastos', icon: '📁', type: 'expense' }]
          : [{ name: 'General', icon: '📁', type: 'expense' }, { name: 'Ingreso', icon: '💰', type: 'income' }]
      }
    });
  }

  $('addWalletForm').reset();
  closeModal(addWalletModal);
  showToast(`${emoji} ${name} creada`);
}

// ==============================
// Export CSV
// ==============================
function exportToCSV() {
  const state = getState();
  const wallet = getActiveWallet();
  const txs = state.transactions.filter(t => t.wallet_id === wallet.id);

  if (txs.length === 0) { showToast('No hay datos para exportar'); return; }

  const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Notas'];
  const rows = txs.map(t => [
    t.date,
    t.type === 'income' ? 'Ingreso' : 'Gasto',
    t.category_name || '',
    t.description || '',
    t.amount,
    t.notes || ''
  ]);

  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fg_${wallet.name}_${state.currentMonth}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('📤 CSV exportado');
}

// ==============================
// Debug
// ==============================
window.fgDebug = { getState, setState, renderSettings, refreshData, init };

console.log('Main.js executing...');
init();
