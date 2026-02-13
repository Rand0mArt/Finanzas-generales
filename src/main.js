// ==============================
// Finanzas Generales 1.0 — Main Entry Point
// ==============================
import './style.css';
import Chart from 'chart.js/auto';
import {
  getState, setState, subscribe, saveState,
  getActiveWallet, getWalletCategories,
  formatMonth, formatCurrency, formatDate,
  getMonthRange,
  saveDraft, loadDraft, clearDraft
} from './state.js';
import {
  initSupabase, isConnected, saveSupabaseConfig,
  fetchTransactions, createTransaction, deleteTransaction,
  fetchWallets, createWallet,
  fetchDebts, createDebt,
  fetchAccounts, fetchCategories, syncFromSupabase
} from './supabase.js';
import { suggestCategory, getSuggestions, autoFillTransaction } from './auto-categorize.js';

// ==============================
// DOM References
// ==============================
const $ = id => document.getElementById(id);

const walletSwitcher = $('walletSwitcher');
const monthLabel = $('monthLabel');
const totalIncome = $('totalIncome');
const totalExpense = $('totalExpense');
const totalBalance = $('totalBalance');
const profitCard = $('profitCard');
const profitAmount = $('profitAmount');
const profitMargin = $('profitMargin');
const budgetFill = $('budgetFill');
const budgetSpent = $('budgetSpent');
const budgetTotal = $('budgetTotal');
const recentTransactions = $('recentTransactions');
const allTransactions = $('allTransactions');
const categoryChips = $('categoryChips');
const autoSuggest = $('autoSuggest');
const quickEntryModal = $('quickEntryModal');
const addWalletModal = $('addWalletModal');
const addDebtModal = $('addDebtModal');
const debtsList = $('debtsList');
const accountsList = $('accountsList');
const settingsWallets = $('settingsWallets');
const toast = $('toast');

let categoryChart = null;
let currentFilter = 'all';

// ==============================
// Init
// ==============================
async function init() {
  const state = getState();

  // Apply theme
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon(state.theme);

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

  // Check for draft
  checkDraft();

  // Init Supabase UI
  const url = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('fg_supabase_url') || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('fg_supabase_key') || '';
  $('supabaseUrl').value = url;
  $('supabaseKey').value = key;

  // Bind events
  bindEvents();

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

    // Calculate totals
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;

    totalIncome.textContent = formatCurrency(income);
    totalExpense.textContent = formatCurrency(expense);
    totalBalance.textContent = formatCurrency(balance);
    totalBalance.className = `balance-amount ${balance >= 0 ? 'income' : 'expense'}`;

    // Profit card for business wallets
    if (wallet.wallet_type === 'business') {
      profitCard.classList.remove('hidden');
      const margin = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
      profitAmount.textContent = formatCurrency(balance);
      profitMargin.textContent = `${margin}%`;
      profitCard.className = `profit-card ${balance < 0 ? 'negative' : ''}`;
    } else {
      profitCard.classList.add('hidden');
    }

    // Budget bar
    const budget = wallet.monthly_budget || 0;
    if (budget > 0) {
      const pct = Math.min((expense / budget) * 100, 100);
      budgetFill.style.width = `${pct}%`;
      budgetFill.className = `budget-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}`;
      budgetSpent.textContent = formatCurrency(expense);
      budgetTotal.textContent = formatCurrency(budget);
      $('budgetSection').classList.remove('hidden');
    } else {
      $('budgetSection').classList.add('hidden');
    }

    // Render chart
    renderChart(transactions);

    // Render recent transactions
    renderTransactionList(recentTransactions, transactions.slice(0, 8));

    // Only render form elements if modal is NOT open (avoids flicker)
    const modalOpen = quickEntryModal.classList.contains('active');
    if (!modalOpen) {
      renderCategoryChips();
      renderAccountSelector();
    }

    // Render all transactions page
    renderAllTransactions(transactions);

    // Render debts
    renderDebts();

    // Render accounts
    renderAccounts();

    // Render settings
    renderSettings();
  } finally {
    isRefreshing = false;
  }
}

// ==============================
// Chart
// ==============================
function renderChart(transactions) {
  const expenseByCategory = {};
  transactions.filter(t => t.type === 'expense').forEach(t => {
    const catName = t.categories?.name || t.category_name || 'Sin categoría';
    expenseByCategory[catName] = (expenseByCategory[catName] || 0) + Number(t.amount);
  });

  const labels = Object.keys(expenseByCategory);
  const data = Object.values(expenseByCategory);

  const colors = [
    '#C8B560', '#6EC6A0', '#E07A5F', '#7BA3C9', '#B88BA5',
    '#8B9D83', '#D4A853', '#A3A3C9', '#C9946B', '#8BC99B',
    '#C96B8B', '#6BC9C9'
  ];

  if (categoryChart) categoryChart.destroy();

  const canvas = $('categoryChart');
  if (!canvas) return;

  if (labels.length === 0) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.slice(0, labels.length),
        borderWidth: 0,
        borderRadius: 4,
        spacing: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 8,
            font: { family: "'Inter', 'DM Sans', sans-serif", size: 11 },
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim()
          }
        },
        tooltip: {
          backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
          titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text').trim(),
          bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim(),
          padding: 12,
          cornerRadius: 8,
          titleFont: { family: "'Inter', 'DM Sans', sans-serif" },
          bodyFont: { family: "'DM Sans', sans-serif" },
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      }
    }
  });
}

// ==============================
// Transaction List
// ==============================
function renderTransactionList(container, transactions) {
  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="tx-empty">
        <span class="empty-icon">📭</span>
        <p>No hay registros este mes</p>
        <p style="margin-top:4px;font-size:0.75rem;">Toca + para agregar uno</p>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  transactions.forEach(tx => {
    const dateKey = tx.date;
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(tx);
  });

  container.innerHTML = Object.entries(groups).map(([date, txs]) => `
    <div class="tx-date-group">
      <div class="tx-date-header">${formatDate(date)}</div>
      ${txs.map(tx => {
    const catName = tx.categories?.name || tx.category_name || '';
    const catIcon = tx.categories?.icon || tx.category_icon || '📁';
    return `
          <div class="tx-item" data-id="${tx.id}">
            <div class="tx-icon ${tx.type}">${catIcon}</div>
            <div class="tx-info">
              <div class="tx-description">${tx.description || catName || 'Sin descripción'}</div>
              <div class="tx-category">${catName}${tx.account ? ' · ' + tx.account : ''}</div>
            </div>
            <div class="tx-amount ${tx.type}">
              ${tx.type === 'expense' ? '-' : '+'}${formatCurrency(tx.amount)}
            </div>
          </div>`;
  }).join('')}
    </div>
  `).join('');
}

function renderAllTransactions(transactions) {
  let filtered = [...transactions];
  const searchVal = $('searchTx')?.value?.toLowerCase() || '';

  if (searchVal) {
    filtered = filtered.filter(tx =>
      (tx.description || '').toLowerCase().includes(searchVal) ||
      (tx.categories?.name || tx.category_name || '').toLowerCase().includes(searchVal)
    );
  }

  if (currentFilter !== 'all') {
    filtered = filtered.filter(tx =>
      (tx.categories?.name || tx.category_name) === currentFilter
    );
  }

  renderTransactionList(allTransactions, filtered);

  // Render filter chips
  const categories = [...new Set(transactions.map(t => t.categories?.name || t.category_name).filter(Boolean))];
  const filterChips = $('filterChips');
  if (filterChips) {
    filterChips.innerHTML = `
      <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">Todas</button>
      ${categories.map(c => `
        <button class="filter-chip ${currentFilter === c ? 'active' : ''}" data-filter="${c}">${c}</button>
      `).join('')}
    `;
    filterChips.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        currentFilter = chip.dataset.filter;
        renderAllTransactions(transactions);
      });
    });
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
    chip.addEventListener('click', () => {
      categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      saveDraftFromForm();
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
// Debts
// ==============================
async function renderDebts() {
  const state = getState();
  let debts = [];

  if (isConnected()) {
    debts = await fetchDebts(state.activeWalletId);
  } else {
    debts = state.debts.filter(d => d.wallet_id === state.activeWalletId);
  }

  if (debts.length === 0) {
    debtsList.innerHTML = `
      <div class="tx-empty">
        <span class="empty-icon">✅</span>
        <p>No hay deudas registradas</p>
      </div>`;
    return;
  }

  debtsList.innerHTML = debts.map(d => {
    const pct = d.total_amount > 0 ? ((d.paid_amount / d.total_amount) * 100).toFixed(1) : 0;
    return `
      <div class="debt-card">
        <div class="debt-header">
          <span class="debt-name">${d.name}</span>
          <span class="debt-status ${d.status}">${d.status === 'paid' ? 'Pagada' : 'Activa'}</span>
        </div>
        <div class="debt-progress">
          <div class="debt-progress-fill" style="width: ${pct}%"></div>
        </div>
        <div class="debt-details">
          <span>${formatCurrency(d.paid_amount)} / ${formatCurrency(d.total_amount)}</span>
          <span>${pct}%</span>
        </div>
        ${d.monthly_payment ? `<div class="debt-details" style="margin-top:4px;"><span>Pago mensual: ${formatCurrency(d.monthly_payment)}</span></div>` : ''}
      </div>`;
  }).join('');
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
    <div class="settings-wallet-item">
      <div class="settings-wallet-info">
        <span>${w.emoji}</span>
        <span>${w.name}</span>
        <span style="color:var(--text-muted);font-size:0.75rem;">${w.wallet_type === 'business' ? 'Negocio' : 'Personal'}</span>
      </div>
      <span style="color:var(--text-muted);font-size:0.75rem;">${formatCurrency(w.monthly_budget || 0)}/mes</span>
    </div>
  `).join('');
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
}

// ==============================
// Modal Helpers
// ==============================
function openModal(modal) {
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ==============================
// Draft Persistence
// ==============================
function saveDraftFromForm() {
  const activeChip = categoryChips.querySelector('.category-chip.active');
  saveDraft({
    type: document.querySelector('.type-btn.active')?.dataset.type || 'expense',
    amount: $('entryAmount').value,
    description: $('entryDescription').value,
    category: activeChip?.dataset.category || '',
    categoryIcon: activeChip?.dataset.icon || '',
    account: $('entryAccount').value,
    date: $('entryDate').value,
    notes: $('entryNotes').value,
    walletId: getState().activeWalletId,
  });
  $('draftIndicator').classList.remove('hidden');
}

function checkDraft() {
  const draft = loadDraft();
  if (draft && draft.walletId === getState().activeWalletId) {
    // Restore form
    $('entryAmount').value = draft.amount || '';
    $('entryDescription').value = draft.description || '';
    $('entryAccount').value = draft.account || '';
    $('entryDate').value = draft.date || new Date().toISOString().split('T')[0];
    $('entryNotes').value = draft.notes || '';

    // Set type
    document.querySelectorAll('.type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === draft.type);
    });
    renderCategoryChips();

    // Set category chip
    setTimeout(() => {
      if (draft.category) {
        const chip = categoryChips.querySelector(`[data-category="${draft.category}"]`);
        if (chip) chip.classList.add('active');
      }
    }, 100);

    $('draftIndicator').classList.remove('hidden');
  }
}

function resetForm() {
  $('quickEntryForm').reset();
  $('entryDate').value = new Date().toISOString().split('T')[0];
  categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'expense');
  });
  $('draftIndicator').classList.add('hidden');
  clearDraft();
  renderCategoryChips();
}

// ==============================
// Page Navigation
// ==============================
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = $(pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
}

// ==============================
// Toast
// ==============================
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

// ==============================
// Theme Toggle
// ==============================
function updateThemeIcon(theme) {
  const icon = $('themeToggle').querySelector('.icon');
  icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ==============================
// Event Bindings
// ==============================
function bindEvents() {
  // Theme toggle
  $('themeToggle').addEventListener('click', () => {
    const state = getState();
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    setState({ theme: newTheme });
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
    // Update meta theme color
    document.querySelector('meta[name="theme-color"]').setAttribute('content',
      newTheme === 'dark' ? '#111110' : '#FAF8F5');
    // Re-render chart to pick up new computed CSS colors
    refreshData();
  });

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

  document.querySelectorAll('.close-debt-modal').forEach(btn => {
    btn.addEventListener('click', () => closeModal(addDebtModal));
  });
  addDebtModal.addEventListener('click', e => {
    if (e.target === addDebtModal) closeModal(addDebtModal);
  });

  // Type toggle
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCategoryChips();
      saveDraftFromForm();
    });
  });

  // Auto-categorize on description change
  $('entryDescription').addEventListener('input', e => {
    const val = e.target.value;
    const state = getState();
    const type = document.querySelector('.type-btn.active')?.dataset.type || 'expense';
    const categories = getWalletCategories(state.activeWalletId, type);

    // Auto-suggest
    const suggestions = getSuggestions(val, state.transactions.map(t => t.description).filter(Boolean));
    if (suggestions.length > 0) {
      autoSuggest.innerHTML = suggestions.map(s => `
        <div class="auto-suggest-item">${s}</div>
      `).join('');
      autoSuggest.classList.add('visible');
      autoSuggest.querySelectorAll('.auto-suggest-item').forEach(item => {
        item.addEventListener('click', () => {
          $('entryDescription').value = item.textContent;
          autoSuggest.classList.remove('visible');
          // Trigger auto-categorize
          triggerAutoCategory(item.textContent, categories);
        });
      });
    } else {
      autoSuggest.classList.remove('visible');
    }

    // Auto-categorize
    triggerAutoCategory(val, categories);

    saveDraftFromForm();
  });

  // Hide auto-suggest on blur
  $('entryDescription').addEventListener('blur', () => {
    setTimeout(() => autoSuggest.classList.remove('visible'), 200);
  });

  // Save draft on field changes
  ['entryAmount', 'entryAccount', 'entryDate', 'entryNotes'].forEach(id => {
    $(id)?.addEventListener('input', saveDraftFromForm);
  });

  // Clear draft
  $('clearDraft')?.addEventListener('click', () => {
    resetForm();
    showToast('Borrador descartado');
  });

  // Submit transaction
  $('quickEntryForm').addEventListener('submit', async e => {
    e.preventDefault();
    await submitTransaction();
  });

  // Bottom nav
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  // View all transactions
  $('viewAllTx')?.addEventListener('click', () => showPage('pageTransactions'));

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

  // Add debt button
  $('addDebtBtn')?.addEventListener('click', () => openModal(addDebtModal));

  // Add debt form
  $('addDebtForm').addEventListener('submit', async e => {
    e.preventDefault();
    await submitDebt();
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

  // Export CSV
  $('exportCSV')?.addEventListener('click', exportToCSV);

  // Clear drafts
  $('clearDrafts')?.addEventListener('click', () => {
    clearDraft();
    showToast('Borradores eliminados');
  });

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
function triggerAutoCategory(text, categories) {
  const suggestion = suggestCategory(text, categories);
  if (suggestion.category) {
    categoryChips.querySelectorAll('.category-chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === suggestion.category);
    });
  }
}

// ==============================
// Submit Transaction
// ==============================
async function submitTransaction() {
  const state = getState();
  const type = document.querySelector('.type-btn.active')?.dataset.type || 'expense';
  const amount = parseFloat($('entryAmount').value);
  const description = $('entryDescription').value.trim();
  const activeChip = categoryChips.querySelector('.category-chip.active');
  const category_name = activeChip?.dataset.category || '';
  const category_icon = activeChip?.dataset.icon || '📁';
  const account = $('entryAccount').value;
  const date = $('entryDate').value;
  const notes = $('entryNotes').value.trim();

  if (!amount || amount <= 0) {
    showToast('Ingresa un monto válido');
    return;
  }

  const submitBtn = $('submitEntry');
  submitBtn.querySelector('.btn-text').classList.add('hidden');
  submitBtn.querySelector('.btn-loading').classList.remove('hidden');
  submitBtn.disabled = true;

  const txData = {
    wallet_id: state.activeWalletId,
    type,
    amount,
    description: description || category_name,
    date: date || new Date().toISOString().split('T')[0],
    account,
    notes,
    created_at: new Date().toISOString(),
  };

  // Find category_id for Supabase
  const walletCats = state.categories[state.activeWalletId] || [];
  const matchedCat = walletCats.find(c => c.name === category_name);
  if (matchedCat?.id) {
    txData.category_id = matchedCat.id;
  }

  // Auto-fill missing fields
  const filled = autoFillTransaction(txData, getWalletCategories(state.activeWalletId));
  Object.assign(txData, filled);

  // Try Supabase first
  if (isConnected()) {
    // Strip local-only fields that don't exist in the DB schema
    const { created_at, category_name: _cn, category_icon: _ci, ...supaData } = txData;
    const result = await createTransaction(supaData);
    if (result) {
      // Push the Supabase result (with joined categories) into local state
      state.transactions = [result, ...state.transactions];
      saveState();
      showToast(`${type === 'income' ? '💰' : '💸'} ${formatCurrency(amount)} registrado`);
    } else {
      // Save locally as fallback
      txData.id = crypto.randomUUID();
      txData.category_name = category_name;
      txData.category_icon = category_icon;
      const newTransactions = [txData, ...state.transactions];
      setState({ transactions: newTransactions });
      showToast('⚠️ Guardado localmente (error Supabase)');
    }
  } else {
    // Offline: save locally
    txData.id = crypto.randomUUID();
    txData.category_name = category_name;
    txData.category_icon = category_icon;
    const newTransactions = [txData, ...state.transactions];
    setState({ transactions: newTransactions });
    showToast(`${type === 'income' ? '💰' : '💸'} ${formatCurrency(amount)} registrado`);
  }

  // Clear form and draft
  clearDraft();
  resetForm();
  closeModal(quickEntryModal);

  submitBtn.querySelector('.btn-text').classList.remove('hidden');
  submitBtn.querySelector('.btn-loading').classList.add('hidden');
  submitBtn.disabled = false;

  refreshData();
}

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
async function submitDebt() {
  const state = getState();
  const debt = {
    id: crypto.randomUUID(),
    wallet_id: state.activeWalletId,
    name: $('debtName').value.trim(),
    total_amount: parseFloat($('debtTotal').value) || 0,
    paid_amount: parseFloat($('debtPaid').value) || 0,
    monthly_payment: parseFloat($('debtMonthly').value) || 0,
    interest_rate: parseFloat($('debtInterest').value) || 0,
    due_date: $('debtDueDate').value || null,
    status: 'active',
    notes: $('debtNotes').value.trim(),
    created_at: new Date().toISOString(),
  };

  if (!debt.name || !debt.total_amount) {
    showToast('Completa nombre y monto');
    return;
  }

  setState({ debts: [...state.debts, debt] });

  if (isConnected()) {
    const { id, ...data } = debt;
    await createDebt(data);
  }

  $('addDebtForm').reset();
  closeModal(addDebtModal);
  showToast('💳 Deuda registrada');
  renderDebts();
}

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
// ==============================
document.addEventListener('DOMContentLoaded', init);
