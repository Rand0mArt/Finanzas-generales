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
  fetchAccounts, fetchCategories, syncFromSupabase, subscribeToTransactions, searchHistoricalTransactions
} from './supabase.js';
import { suggestCategoryFromHistory, autoFillTransaction } from './auto-categorize.js';

// ==============================
import { $, showToast, confettiEffect, openModal, closeModal } from './utils/dom.js';
import { renderGoals, openGoalModal, submitGoal, submitAddFund } from './ui/goals.js';
import {
  initTransactionsUI, renderTransactionList, renderAllTransactions,
  startEditTransaction, submitTransaction, confirmDeleteTransaction, resetForm
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
const accountsList = $('accountsList');
const settingsWallets = $('settingsWallets');
const toast = $('toast');

let categoryChart = null;
let currentFilter = 'all';
let currentSort = 'desc'; // 'asc' or 'desc'

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
  applyMonthlyTheme(); // Feature 1: Dynamic Theming

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
        accounts: synced.accounts.map(a => ({
          id: a.id,
          name: a.name,
          institution: a.institution || '',
          balance: Number(a.balance) || 0,
          currency: a.currency || 'MXN',
        })),
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
  // refreshData is called explicitly where needed to avoid infinite loops
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
      // Refresh data when table changes
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

  // Rebind wallet click events
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
  // Guard against re-entrant calls (infinite loop via subscribe)
  if (isRefreshing) return;
  isRefreshing = true;

  try {
    const state = getState();
    const wallet = getActiveWallet();
    const { start, end } = getMonthRange();

    // Calculate Global Balance (Only for current month)
    let allTransactions = [];
    if (isConnected()) {
      allTransactions = await fetchTransactions(null, start, end);
    } else {
      allTransactions = state.transactions.filter(tx => tx.date >= start && tx.date <= end) || [];
    }
    const globalIncome = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const globalExpense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const globalLiquidity = globalIncome - globalExpense;

    // Try Supabase first, fallback to local
    let transactions = [];
    if (isConnected()) {
      transactions = await fetchTransactions(wallet.id, start, end);
      // Store without triggering subscribe loop
      state.transactions = transactions;
      saveState();
    } else {
      transactions = state.transactions.filter(tx =>
        tx.wallet_id === wallet.id && tx.date >= start && tx.date <= end
      );
    }

    renderDashboard(transactions, globalLiquidity, wallet);
    renderAllTransactions(transactions);

    // Only render form elements if modal is NOT open (avoids flicker)
    const modalOpen = quickEntryModal.classList.contains('active');
    if (!modalOpen) {
      renderCategoryChips();
      renderAccountSelector();
    }

    // Render goals
    renderGoals();

    // Render accounts
    renderAccounts();

    // Render settings
    renderSettings();
  } finally {
    isRefreshing = false;
  }
}


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

    const cancelPress = () => {
      clearTimeout(pressTimer);
    };

    chip.addEventListener('mousedown', startPress);
    chip.addEventListener('touchstart', startPress, { passive: true });

    chip.addEventListener('mouseup', cancelPress);
    chip.addEventListener('mouseleave', cancelPress);
    chip.addEventListener('touchend', cancelPress);
    chip.addEventListener('touchmove', cancelPress);
    chip.addEventListener('touchcancel', cancelPress);

    chip.addEventListener('click', (e) => {
      if (isLongPress) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      // Learning Loop Hook
      handleCategoryManualSelect(chip.dataset.category, type);
    });
  });
}

// ==============================
// Account Selector
// ==============================
function renderAccountSelector() {
  const state = getState();
  const select = $('entryAccount');
  select.innerHTML = `<option value="">Seleccionar cuenta…</option>` +
    state.accounts.map(a => `<option value="${a.name}">${a.name}</option>`).join('');
}

// ==============================
// Accounts
// ==============================
async function renderAccounts() {
  const state = getState();
  let accounts = state.accounts;

  if (isConnected()) {
    const fetched = await fetchAccounts();
    if (fetched.length > 0) accounts = fetched;
  }

  accountsList.innerHTML = accounts.map(a => `
    <div class="account-card">
      <div class="account-icon">🏦</div>
      <div class="account-info">
        <div class="account-name">${a.name}</div>
        <div class="account-inst">${a.institution || ''}</div>
      </div>
      <div class="account-balance">${formatCurrency(a.balance || 0)}</div>
    </div>
  `).join('');
}

// ==============================
// Settings
// ==============================
function renderSettings() {
  const state = getState();
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

  // Bind edit events
  settingsWallets.querySelectorAll('.edit-wallet-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditWalletModal(btn.dataset.id);
    });
  });
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

  // Setup Delete Button
  const deleteBtn = $('deleteWalletBtn');
  deleteBtn.onclick = () => confirmDeleteWallet(walletId);

  // Setup Manage Categories
  const manageBtn = $('manageCategoriesBtn');
  manageBtn.onclick = () => openManageCategories(walletId);
}

function openManageCategories(walletId, fromQuickEntry = false) {
  if (!fromQuickEntry) closeModal($('editWalletModal'));
  openModal($('manageCategoriesModal'));
  renderManageCategoriesList(walletId);

  // Back button
  $('backToEditWallet').onclick = () => {
    closeModal($('manageCategoriesModal'));
    if (!fromQuickEntry) {
      openEditWalletModal(walletId);
    } else {
      renderCategoryChips();
    }
  };

  // Also override close button if from quick entry
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

  // Manage Category State inside this scope
  let editingCatId = null;
  const submitBtn = addForm.querySelector('button[type="submit"]');

  // Reset function inside to reset editing state safely
  const resetCatEditState = () => {
    $('newCatName').value = '';
    $('newCatEmoji').value = '';
    editingCatId = null;
    if (submitBtn) submitBtn.textContent = '＋';
  };

  // We expose the edit handler so renderManageCategoriesList can attach it
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

    const currentType = fromQuickEntry
      ? (document.querySelector('.type-btn.active')?.dataset.type || 'expense')
      : 'expense';

    if (editingCatId) {
      // ==== UPDATE FLOW ====
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
      renderManageCategoriesList(walletId);
      resetCatEditState();
      return;
    }

    // ==== CREATE FLOW ====
    if (isConnected()) {
      const { createCategory } = await import('./supabase.js');
      const newCat = await createCategory({
        wallet_id: walletId,
        name,
        icon: emoji,
        type: currentType
      });
      if (newCat) {
        const state = getState();
        if (!state.categories[walletId]) state.categories[walletId] = [];
        state.categories[walletId].push(newCat);
        saveState();
        renderManageCategoriesList(walletId);
        $('newCatName').value = '';
        $('newCatEmoji').value = '';
      }
    } else {
      // Local fallback
      const state = getState();
      if (!state.categories[walletId]) state.categories[walletId] = [];
      state.categories[walletId].push({
        id: crypto.randomUUID(),
        name,
        icon: emoji,
        type: currentType
      });
      saveState();
      renderManageCategoriesList(walletId);
      resetCatEditState();
    }
  };
}

function renderManageCategoriesList(walletId) {
  const state = getState();
  const categories = state.categories[walletId] || [];
  const list = $('manageCategoriesList');

  list.innerHTML = categories.map(c => `
    <div class="category-manage-item">
      <span>${c.icon} ${c.name}</span>
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

  // Optimistic update
  const state = getState();
  state.categories[walletId] = state.categories[walletId].filter(c => c.id !== catId);
  saveState();
  renderManageCategoriesList(walletId);

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

  // Update local state
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

  // Theme Color Updates on Month Change
  applyMonthlyTheme();
}

// ==============================
// Modal Helpers
// ==============================



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
}

// ==============================
// Learning Loop
// ==============================
function handleCategoryManualSelect(categoryName, type) {
  const description = $('entryDescription').value.trim();
  if (!description) return;

  const state = getState();
  const categories = getWalletCategories(state.activeWalletId, type);

  // What would we have predicted?
  const prediction = suggestCategoryFromHistory(description, categories, state.userRules || [], state.transactions || []);

  // If prediction is different (or null), prompt to learn
  if (prediction.category !== categoryName) {
    // Determine the keyword to save (simple approach: use the full description)
    // improved: use the first word if long, or full if short
    const keyword = description.length < 20 ? description.toLowerCase() : description.split(' ')[0].toLowerCase();

    showToast(`¿Recordar para "${keyword}"?`, 'Guardar', () => {
      const newRule = {
        keywords: [keyword],
        category: categoryName,
        type: type
      };
      const newRules = [...(state.userRules || []), newRule];
      setState({ userRules: newRules });
      showToast('✅ Regla guardada');
    });
  }
}

// ==============================
// Profile Logic
// ==============================
function updateProfileUI(name) {
  const userNameEl = document.querySelector('.user-name');
  if (userNameEl) userNameEl.textContent = name;
  const userAvatarEl = document.querySelector('.user-avatar-placeholder');
  if (userAvatarEl) userAvatarEl.textContent = name.charAt(0).toUpperCase();
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
// Event Bindings
// ==============================
function bindEvents() {
  // Theme toggle removed from header in V2.1

  // Month nav
  $('prevMonth').addEventListener('click', () => changeMonth(-1));
  $('nextMonth').addEventListener('click', () => changeMonth(1));

  // FAB
  $('fabAdd').addEventListener('click', () => {
    renderCategoryChips();
    renderAccountSelector();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

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
    addGoalBtn.addEventListener('click', () => {
      openGoalModal();
    });
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

  // Type toggle
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
      // Fetch historical searches to feed into autocomplete and categorization
      let historicalMatches = [];
      if (isConnected()) {
        historicalMatches = await searchHistoricalTransactions(val, 5);
      } else {
        historicalMatches = state.transactions.filter(t => t.description && t.description.toLowerCase().includes(val.toLowerCase())).slice(0, 5);
      }

      // Auto-suggest UI
      const uniqueDescriptions = [...new Set(historicalMatches.map(t => t.description))];
      if (uniqueDescriptions.length > 0) {
        autoSuggest.innerHTML = uniqueDescriptions.map(s => `
          <div class="auto-suggest-item">${s}</div>
        `).join('');
        autoSuggest.classList.add('visible');
        autoSuggest.querySelectorAll('.auto-suggest-item').forEach(item => {
          item.addEventListener('click', () => {
            $('entryDescription').value = item.textContent;
            autoSuggest.classList.remove('visible');
            // Trigger auto-categorize explicitly
            triggerAutoCategory(item.textContent, categories, historicalMatches);
          });
        });
      } else {
        autoSuggest.classList.remove('visible');
      }

      // Trigger auto category
      triggerAutoCategory(val, categories, historicalMatches);

    }, 300);
  });

  // Hide auto-suggest on blur
  $('entryDescription').addEventListener('blur', () => {
    setTimeout(() => autoSuggest.classList.remove('visible'), 200);
  });

  // Clear draft removed in V2.1

  // Submit transaction
  $('quickEntryForm').addEventListener('submit', async e => {
    e.preventDefault();
    // This is now handled by ui/transactions.js
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
      currentSort = currentSort === 'desc' ? 'asc' : 'desc';
      sortBtn.textContent = currentSort === 'desc' ? '⬇️' : '⬆️';
      // This is now handled by ui/transactions.js
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

  // Add wallet button in settings
  $('addWalletBtn')?.addEventListener('click', () => openModal(addWalletModal));



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

  // Save Profile config
  $('saveProfileBtn')?.addEventListener('click', () => {
    const name = $('profileName').value.trim();
    if (name) {
      localStorage.setItem('fg_profileName', name);
      updateProfileUI(name);
      showToast('✅ Perfil actualizado');
    }
  });

  // Export CSV
  $('exportCSV')?.addEventListener('click', exportToCSV);

  // Quick Actions
  $('qaExpense')?.addEventListener('click', () => {
    renderCategoryChips();
    // Set type to expense
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="expense"]')?.classList.add('active');
    renderCategoryChips();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

  $('qaIncome')?.addEventListener('click', () => {
    // Set type to income
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.type-btn[data-type="income"]')?.classList.add('active');
    renderCategoryChips();
    openModal(quickEntryModal);
    $('entryAmount').focus();
  });

  $('qaTransactions')?.addEventListener('click', () => {
    showPage('pageTransactions');
  });
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

    // Auto-select account/wallet if needed (optional enrichment layer)
    if (suggestion.walletId && suggestion.walletId !== state.activeWalletId) {
      // Future implementation could prompt the user to switch wallet
    }
  }
}

// Helper to inject Button when opening edit mode (called from startEditTransaction)
// Use startEditTransaction instead of just showing modal



// ==============================
// Submit Wallet
// ==============================
async function submitWallet() {
  const name = $('walletName').value.trim();
  const emoji = $('walletEmoji').value.trim() || '💰';
  const wallet_type = $('walletType').value;
  const monthly_budget = parseFloat($('walletBudget').value) || 0;

  if (!name) {
    showToast('Ingresa un nombre');
    return;
  }

  const wallet = {
    name,
    emoji,
    wallet_type,
    monthly_budget,
    color: '#C8B560',
  };

  if (isConnected()) {
    const created = await createWallet(wallet);
    if (created) {
      // Re-sync from Supabase to get proper UUIDs
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
    // Offline fallback
    wallet.id = name.toLowerCase().replace(/\s+/g, '-');
    const state = getState();
    setState({
      wallets: [...state.wallets, wallet],
      categories: {
        ...state.categories,
        [wallet.id]: wallet_type === 'business'
          ? [
            { name: 'Ingresos', icon: '💰', type: 'income' },
            { name: 'Gastos', icon: '📁', type: 'expense' },
          ]
          : [
            { name: 'General', icon: '📁', type: 'expense' },
            { name: 'Ingreso', icon: '💰', type: 'income' },
          ]
      }
    });
  }

  $('addWalletForm').reset();
  closeModal(addWalletModal);
  showToast(`${emoji} ${name} creada`);
}

// ==============================
// Submit Debt
// ==============================

// ==============================
// Export CSV
// ==============================
function exportToCSV() {
  const state = getState();
  const wallet = getActiveWallet();
  const txs = state.transactions.filter(t => t.wallet_id === wallet.id);

  if (txs.length === 0) {
    showToast('No hay datos para exportar');
    return;
  }

  const headers = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Cuenta', 'Notas'];
  const rows = txs.map(t => [
    t.date,
    t.type === 'income' ? 'Ingreso' : 'Gasto',
    t.category_name || '',
    t.description || '',
    t.amount,
    t.account || '',
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
// Initialize
// ==============================// ==============================
// Swipe Navigation
// ==============================
function initSwipeNavigation() {
  let touchStartX = 0;
  let touchStartY = 0;
  const minSwipeDistance = 50;
  const maxVerticalDistance = 30;

  document.addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Check if swipe is primarily horizontal and long enough
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < maxVerticalDistance) {
      // Only apply on Dashboard or Transactions page if needed
      // For now, let's limit to Dashboard where the month view is central
      if (!document.getElementById('pageDashboard').classList.contains('active')) return;

      if (deltaX > 0) {
        // Swipe Right -> Previous Month
        changeMonth(-1);
      } else {
        // Swipe Left -> Next Month
        changeMonth(1);
      }
    }
  }, { passive: true });
}

// ==============================
// Debug
// ==============================
window.fgDebug = {
  getState,
  setState,
  renderSettings,
  refreshData,
  init
}

// Removed temporary wipe script to avoid dynamic import errors

console.log('Main.js executing...');
init();
initSwipeNavigation();
