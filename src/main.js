// ==============================
// Finanzas Generales 1.0 — Main Entry Point
// ==============================
import './style.css';
import Chart from 'chart.js/auto';
import {
  getState, setState, subscribe, saveState,
  getActiveWallet, getWalletCategories,
  formatMonth, formatCurrency, formatDate,
  getMonthRange, applyMonthlyTheme
} from './state.js';
import {
  initSupabase, isConnected, saveSupabaseConfig,
  fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  fetchWallets, createWallet,
  fetchAccounts, fetchCategories, syncFromSupabase, subscribeToTransactions, searchHistoricalTransactions
} from './supabase.js';
import { suggestCategoryFromHistory, autoFillTransaction } from './auto-categorize.js';

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
const addGoalModal = $('addGoalModal');
const accountsList = $('accountsList');
const settingsWallets = $('settingsWallets');
const toast = $('toast');

let categoryChart = null;
let currentFilter = 'all';
let currentSort = 'desc'; // 'asc' or 'desc'
let editingTransaction = null; // holds tx being edited

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

    // Calculate Global Balance
    let allTransactions = [];
    if (isConnected()) {
      allTransactions = await fetchTransactions(null, null, null);
    } else {
      allTransactions = state.transactions || [];
    }
    const globalIncome = allTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const globalExpense = allTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const globalLiquidity = globalIncome - globalExpense;
    const globalBalanceEl = $('globalBalance');
    if (globalBalanceEl) {
      globalBalanceEl.textContent = formatCurrency(globalLiquidity);
      globalBalanceEl.className = `global-balance-amount ${globalLiquidity >= 0 ? 'income' : 'expense'}`;
    }

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
        hoverOffset: 10,
        borderRadius: 8,
        spacing: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%', // Thinner ring for crypto look
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { family: "'Inter', sans-serif", size: 12 },
            color: '#9BA1A6'
          }
        },
        tooltip: {
          backgroundColor: 'rgba(5, 5, 5, 0.95)',
          titleColor: '#F8F9FA',
          bodyColor: '#9BA1A6',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          padding: 16,
          cornerRadius: 12,
          displayColors: true,
          boxPadding: 8,
          titleFont: { family: "'Inter', sans-serif", size: 13, weight: 'bold' },
          bodyFont: { family: "'Inter', sans-serif", size: 14 },
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
          <div class="tx-item-wrapper" data-id="${tx.id}">
            <div class="tx-item">
              <div class="tx-icon ${tx.type}">${catIcon}</div>
              <div class="tx-info">
                <div class="tx-description">
                  ${tx.description || catName || 'Sin descripción'}
                  ${tx.is_fixed ? '<span class="fixed-tag" title="Gasto Fijo">📌</span>' : ''}
                </div>
                <div class="tx-category">${catName}${tx.account ? ' · ' + tx.account : ''}</div>
              </div>
              <div class="tx-amount ${tx.type}">
                ${tx.type === 'expense' ? '-' : '+'}${formatCurrency(Math.abs(tx.amount))}
              </div>
            </div>
            <div class="tx-actions">
              <button class="tx-action-btn tx-edit-btn" data-id="${tx.id}" title="Editar">✏️</button>
              <button class="tx-action-btn tx-delete-btn" data-id="${tx.id}" title="Eliminar">🗑️</button>
            </div>
          </div>`;
  }).join('')}
    </div>
  `).join('');

  // Attach action button listeners
  container.querySelectorAll('.tx-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); startEditTransaction(btn.dataset.id); });
  });
  container.querySelectorAll('.tx-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteTransaction(btn.dataset.id); });
  });

  // Mobile: tap item to reveal actions
  container.querySelectorAll('.tx-item-wrapper').forEach(wrapper => {
    wrapper.querySelector('.tx-item').addEventListener('click', (e) => {
      // Close any other open wrappers
      container.querySelectorAll('.tx-item-wrapper.active').forEach(w => {
        if (w !== wrapper) w.classList.remove('active');
      });
      wrapper.classList.toggle('active');
    });
  });
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

  // Sort
  filtered.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    if (currentSort === 'asc') {
      return dateA - dateB;
    } else {
      return dateB - dateA;
    }
  });

  renderTransactionList($('allTransactions'), filtered);

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
// Goals (Replacing Debts)
// ==============================
async function renderGoals() {
  const state = getState();
  let goals = [];

  if (isConnected()) {
    const { fetchGoals } = await import('./supabase.js');
    goals = await fetchGoals(state.activeWalletId);
  } else {
    goals = state.goals.filter(g => g.wallet_id === state.activeWalletId);
  }

  const goalsList = $('goalsList');
  if (!goalsList) return;

  if (goals.length === 0) {
    goalsList.innerHTML = `
      <div class="tx-empty">
        <span class="empty-icon">🎯</span>
        <p>No hay metas activas</p>
      </div>`;
    return;
  }

  goalsList.innerHTML = goals.map(g => {
    const progressVal = Math.min((g.current_amount / g.target_amount) * 100, 100);
    const progress = progressVal.toFixed(1);
    const isCompleted = g.current_amount >= g.target_amount;

    let progressColor = '#10B981'; // Green
    if (progressVal < 30) progressColor = '#EF4444'; // Red
    else if (progressVal < 70) progressColor = '#F59E0B'; // Yellow

    return `
      <div class="goal-card ${isCompleted ? 'completed-goal glow-effect' : ''}">
        <div class="goal-header">
          <div class="goal-info-left">
            <span class="goal-icon">${g.icon || '🎯'}</span>
            <div class="goal-titles">
              <span class="goal-name">${g.name}</span>
              ${g.category_type ? `<span class="goal-type">${g.category_type}</span>` : ''}
            </div>
          </div>
          <div class="goal-score" style="color: ${progressColor}; text-shadow: 0 0 10px ${progressColor}40;">
            ${Math.round(progress)}%
          </div>
        </div>
        
        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width: ${progress}%; background: ${progressColor}; box-shadow: 0 0 12px ${progressColor}60;"></div>
        </div>
        
        <div class="goal-footer">
          <span class="goal-amounts">${formatCurrency(g.current_amount)} / ${formatCurrency(g.target_amount)}</span>
          ${!isCompleted ? `
            <button class="add-fund-btn" data-id="${g.id}">+</button>
          ` : '<span class="goal-done-icon">🎉</span>'}
        </div>
        ${g.deadline ? `<div class="goal-deadline">📅 Límite: ${formatDate(g.deadline)}</div>` : ''}
      </div>`;
  }).join('');

  // Attach Add Fund Listeners
  goalsList.querySelectorAll('.add-fund-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openAddFundModal(btn.dataset.id);
    };
  });
}

// Add Fund Logic - Prompt for amount
async function openAddFundModal(goalId) {
  const amountStr = prompt("Monto a agregar:");
  if (!amountStr) return;
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return;

  const state = getState();
  const goal = state.goals.find(g => g.id === goalId) || (await import('./supabase.js')).fetchGoals(state.activeWalletId).then(gs => gs.find(g => g.id === goalId));

  if (!goal) return;

  const newAmount = parseFloat(goal.current_amount) + amount;

  if (isConnected()) {
    const { updateGoal } = await import('./supabase.js');
    await updateGoal(goalId, { current_amount: newAmount });
    // Optimistic update
    const idx = state.goals.findIndex(g => g.id === goalId);
    if (idx !== -1) state.goals[idx].current_amount = newAmount;
  } else {
    goal.current_amount = newAmount;
    saveState();
  }

  // Confetti if reached 100%
  if (newAmount >= goal.target_amount) {
    showToast('🎉 ¡Felicidades! Meta alcanzada');
    confettiEffect();
  } else {
    showToast(`💰 Agregado ${formatCurrency(amount)} a ${goal.name}`);
  }

  renderGoals();
}

function confettiEffect() {
  // Simple pure CSS/JS confetti or just a visual cue
  const confettiContainer = document.createElement('div');
  confettiContainer.style.position = 'fixed';
  confettiContainer.style.top = '0';
  confettiContainer.style.left = '0';
  confettiContainer.style.width = '100vw';
  confettiContainer.style.height = '100vh';
  confettiContainer.style.pointerEvents = 'none';
  confettiContainer.style.zIndex = '9999';
  confettiContainer.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;font-size:5rem;">🎊 🥳 🎊</div>';
  document.body.appendChild(confettiContainer);
  setTimeout(() => confettiContainer.remove(), 3000);
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

function openManageCategories(walletId) {
  closeModal($('editWalletModal'));
  openModal($('manageCategoriesModal'));
  renderManageCategoriesList(walletId);

  // Back button
  $('backToEditWallet').onclick = () => {
    closeModal($('manageCategoriesModal'));
    openEditWalletModal(walletId);
  };

  // Add Category Form
  const addForm = $('addCategoryForm');
  addForm.onsubmit = async (e) => {
    e.preventDefault();
    const name = $('newCatName').value.trim();
    const emoji = $('newCatEmoji').value.trim() || '🏷️';
    if (!name) return;

    if (isConnected()) {
      const { createCategory } = await import('./supabase.js');
      const newCat = await createCategory({
        wallet_id: walletId,
        name,
        icon: emoji,
        type: 'expense' // Default to expense for now
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
        type: 'expense'
      });
      saveState();
      renderManageCategoriesList(walletId);
      $('newCatName').value = '';
      $('newCatEmoji').value = '';
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
      <button class="icon-btn delete-cat-btn" data-id="${c.id}">🗑️</button>
    </div>
  `).join('');

  list.querySelectorAll('.delete-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(walletId, btn.dataset.id));
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


function resetForm() {
  editingTransaction = null;
  $('quickEntryForm').reset();
  $('entryDate').value = new Date().toISOString().split('T')[0];
  categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === 'expense');
  });
  // Remove move button if exists
  const moveBtn = $('moveTransactionBtn');
  if (moveBtn) moveBtn.remove();

  renderCategoryChips();

  // Reset modal title and button
  const modalTitle = quickEntryModal.querySelector('.modal-header h2');
  const submitText = $('submitEntry')?.querySelector('.btn-text');
  if (modalTitle) modalTitle.textContent = 'Nuevo Registro';
  if (submitText) submitText.textContent = 'Guardar';
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

  // Move to wallet button
  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'secondary-btn full-width mt-4';
  moveBtn.id = 'moveTransactionBtn';
  moveBtn.innerText = 'Mover a otra cartera';
  moveBtn.onclick = () => moveTransaction(editingTransaction);

  const existingMoveBtn = $('moveTransactionBtn');
  if (existingMoveBtn) existingMoveBtn.remove();

  if (editingTransaction) {
    $('quickEntryForm').appendChild(moveBtn);
  }
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === pageId);
  });
}

// ==============================
// Toast with Action
// ==============================
let toastTimeout;
function showToast(msg, actionText = null, actionCallback = null) {
  toast.innerHTML = `<span>${msg}</span>`;

  if (actionText && actionCallback) {
    const btn = document.createElement('button');
    btn.className = 'toast-action';
    btn.textContent = actionText;
    btn.onclick = () => {
      actionCallback();
      toast.classList.remove('visible');
    };
    toast.appendChild(btn);
  }

  toast.classList.add('visible');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 4000);
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
    // Reset move button when adding new
    const existingMoveBtn = $('moveTransactionBtn');
    if (existingMoveBtn) existingMoveBtn.remove();

    editingTransaction = null;
    resetForm();

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
      openModal(addGoalModal);
      $('goalName').focus();
    });
  }

  // Add Goal Form
  $('addGoalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await submitGoal();
  });

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
    await submitTransaction();
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
      renderAllTransactions(getState().transactions); // Re-render with current state
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

function startEditTransaction(id) {
  const state = getState();
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;

  editingTransaction = tx;

  // Populate form fields
  $('entryAmount').value = Math.abs(tx.amount);
  $('entryDescription').value = tx.description || '';
  $('entryAccount').value = tx.account || '';
  $('entryDate').value = tx.date;
  $('entryNotes').value = tx.notes || '';
  $('entryFixed').checked = !!tx.is_fixed;

  // Set category chip
  const catName = tx.categories?.name || tx.category_name || '';
  renderCategoryChips(); // Refresh chips first
  const chip = categoryChips.querySelector(`.category-chip[data-category="${catName}"]`);
  if (chip) {
    categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  }

  // Set type
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === tx.type);
  });

  // Update logic to render Move Button
  const existingMoveBtn = $('moveTransactionBtn');
  if (existingMoveBtn) existingMoveBtn.remove();

  const moveBtn = document.createElement('button');
  moveBtn.type = 'button';
  moveBtn.className = 'secondary-btn full-width mt-4';
  moveBtn.id = 'moveTransactionBtn';
  moveBtn.innerText = 'Mover a otra cartera';
  moveBtn.onclick = () => moveTransaction(editingTransaction);
  $('quickEntryForm').appendChild(moveBtn);

  // Update UI Text
  const modalTitle = quickEntryModal.querySelector('.modal-header h2');
  const submitText = $('submitEntry').querySelector('.btn-text');
  if (modalTitle) modalTitle.textContent = 'Editar Registro';
  if (submitText) submitText.textContent = 'Actualizar';

  openModal(quickEntryModal);
}
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
  // ... (previous submit logic) ...

  async function moveTransaction(tx) {
    const state = getState();
    const targetWalletId = prompt('Ingresa el ID de la cartera destino:'); // Simple implementation for now
    // Real implementation needs a proper selector modal
    // For this step, we will use a confirm dialog iterating wallets

    // Create a selector overlay dynamically
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '10000';

    const sheet = document.createElement('div');
    sheet.className = 'modal-sheet small';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h2>Mover a...</h2><button class="icon-btn">✕</button>';
    header.querySelector('button').onclick = () => overlay.remove();

    const list = document.createElement('div');
    list.className = 'wallet-selector-list';

    state.wallets.filter(w => w.id !== tx.wallet_id).forEach(w => {
      const btn = document.createElement('button');
      btn.className = 'wallet-select-item';
      btn.innerHTML = `<span>${w.emoji}</span><span>${w.name}</span>`;
      btn.onclick = async () => {
        if (confirm(`¿Mover transacción a ${w.name}?`)) {
          await executeMove(tx, w.id);
          overlay.remove();
        }
      };
      list.appendChild(btn);
    });

    sheet.appendChild(header);
    sheet.appendChild(list);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
  }

  async function executeMove(tx, targetWalletId) {
    if (isConnected()) {
      const { getSupabase } = await import('./supabase.js');
      await getSupabase().from('transactions').update({ wallet_id: targetWalletId }).eq('id', tx.id);
    }

    // Local update
    const state = getState();
    // Remove from current view if active wallet is source
    if (state.activeWalletId === tx.wallet_id) {
      state.transactions = state.transactions.filter(t => t.id !== tx.id);
    }

    closeModal(quickEntryModal);
    refreshData();
    showToast('Transacción movida');
  }

  // Find category_id for Supabase
  const walletCats = state.categories[state.activeWalletId] || [];
  const matchedCat = walletCats.find(c => c.name === category_name);

  // ── EDIT MODE ──
  if (editingTransaction) {
    const updates = {
      type,
      amount,
      description: description || category_name,
      date: date || new Date().toISOString().split('T')[0],
      account,
      notes,
      is_fixed: $('entryFixed')?.checked || false,
    };
    if (matchedCat?.id) updates.category_id = matchedCat.id;

    if (isConnected()) {
      const result = await updateTransaction(editingTransaction.id, updates);
      if (result) {
        state.transactions = state.transactions.map(t =>
          t.id === editingTransaction.id ? result : t
        );
        saveState();
        showToast('✅ Transacción actualizada');
      } else {
        // Update locally as fallback
        state.transactions = state.transactions.map(t =>
          t.id === editingTransaction.id
            ? { ...t, ...updates, category_name, category_icon }
            : t
        );
        saveState();
        showToast('⚠️ Actualizado localmente');
      }
    } else {
      state.transactions = state.transactions.map(t =>
        t.id === editingTransaction.id
          ? { ...t, ...updates, category_name, category_icon }
          : t
      );
      saveState();
      showToast('✅ Transacción actualizada');
    }
  } else {
    // ── CREATE MODE ──
    const txData = {
      wallet_id: state.activeWalletId,
      type,
      amount,
      description: description || category_name,
      date: date || new Date().toISOString().split('T')[0],
      account,
      notes,
      is_fixed: $('entryFixed')?.checked || false,
      created_at: new Date().toISOString(),
    };

    if (matchedCat?.id) txData.category_id = matchedCat.id;

    // Auto-fill missing fields
    const filled = autoFillTransaction(txData, getWalletCategories(state.activeWalletId), state.userRules || [], state.transactions || []);
    Object.assign(txData, filled);

    if (isConnected()) {
      const { created_at, category_name: _cn, category_icon: _ci, ...supaData } = txData;
      const result = await createTransaction(supaData);
      if (result) {
        state.transactions = [result, ...state.transactions];
        saveState();
        showToast(`${type === 'income' ? '💰' : '💸'} ${formatCurrency(amount)} registrado`);
      } else {
        txData.id = crypto.randomUUID();
        txData.category_name = category_name;
        txData.category_icon = category_icon;
        const newTransactions = [txData, ...state.transactions];
        setState({ transactions: newTransactions });
        showToast('⚠️ Guardado localmente (error Supabase)');
      }
    } else {
      txData.id = crypto.randomUUID();
      txData.category_name = category_name;
      txData.category_icon = category_icon;
      const newTransactions = [txData, ...state.transactions];
      setState({ transactions: newTransactions });
      showToast(`${type === 'income' ? '💰' : '💸'} ${formatCurrency(amount)} registrado`);
    }
  }

  resetForm();
  closeModal(quickEntryModal);

  submitBtn.querySelector('.btn-text').classList.remove('hidden');
  submitBtn.querySelector('.btn-loading').classList.add('hidden');
  submitBtn.disabled = false;

  refreshData();
}



// ==============================
// Delete Transaction
// ==============================
async function confirmDeleteTransaction(txId) {
  const state = getState();
  const tx = state.transactions.find(t => t.id === txId);
  if (!tx) return;

  const desc = tx.description || tx.categories?.name || 'esta transacción';
  const amt = formatCurrency(tx.amount);

  if (!confirm(`¿Eliminar "${desc}" (${tx.type === 'expense' ? '-' : '+'}${amt})?`)) return;

  if (isConnected()) {
    const ok = await deleteTransaction(txId);
    if (ok) {
      state.transactions = state.transactions.filter(t => t.id !== txId);
      saveState();
      showToast('🗑️ Transacción eliminada');
    } else {
      showToast('❌ Error al eliminar en Supabase');
      return;
    }
  } else {
    state.transactions = state.transactions.filter(t => t.id !== txId);
    saveState();
    showToast('🗑️ Transacción eliminada');
  }

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
// ==============================
// Submit Goal
// ==============================
async function submitGoal() {
  const state = getState();
  const goal = {
    id: crypto.randomUUID(),
    wallet_id: state.activeWalletId,
    name: $('goalName').value.trim(),
    target_amount: parseFloat($('goalTarget').value) || 0,
    current_amount: 0,
    category_type: $('goalType')?.value || 'Ahorro',
    deadline: $('goalDeadline').value || null,
    status: 'active',
    icon: $('goalIcon').value || '🎯',
    created_at: new Date().toISOString(),
  };

  if (!goal.name || !goal.target_amount) {
    showToast('Completa nombre y monto');
    return;
  }

  // Optimistic update
  setState({ goals: [...state.goals, goal] });

  if (isConnected()) {
    const { createGoal } = await import('./supabase.js');
    const { id, ...data } = goal;
    await createGoal(data);
  }

  $('addGoalForm').reset();
  closeModal(addGoalModal);
  showToast('🎯 Meta creada');
  renderGoals();
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
};

console.log('Main.js executing...');
init();
initSwipeNavigation();
