import { $, showToast, closeModal, openModal } from '../utils/dom.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { getState, setState, saveState, getWalletCategories } from '../state.js';
import { isConnected } from '../supabase.js';
import { autoFillTransaction } from '../auto-categorize.js';

// Global variables currently shared with main.js
export let editingTransaction = null;
export let currentFilter = 'all';
export let currentSort = 'desc';

let uiCallbacks = {};

export function initTransactionsUI(callbacks) {
    uiCallbacks = callbacks;
}

export function toggleSort() {
    currentSort = currentSort === 'desc' ? 'asc' : 'desc';
    const sortBtn = document.getElementById('sortTxBtn');
    if (sortBtn) sortBtn.textContent = currentSort === 'desc' ? '⬇️' : '⬆️';
}

export function resetForm() {
    editingTransaction = null;
    const quickEntryForm = $('quickEntryForm');
    if (quickEntryForm) quickEntryForm.reset();

    const entryDate = $('entryDate');
    if (entryDate) entryDate.value = new Date().toISOString().split('T')[0];

    const categoryChips = $('categoryChips');
    if (categoryChips) categoryChips.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));

    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === 'expense');
    });

    // Remove move button if exists
    const moveBtn = $('moveTransactionBtn');
    if (moveBtn) moveBtn.remove();

    if (uiCallbacks.renderCategoryChips) uiCallbacks.renderCategoryChips();

    // Reset modal title and button
    const quickEntryModal = $('quickEntryModal');
    const modalTitle = quickEntryModal?.querySelector('.modal-header h2');
    const submitText = $('submitEntry')?.querySelector('.btn-text');
    if (modalTitle) modalTitle.textContent = 'Nuevo Registro';
    if (submitText) submitText.textContent = 'Guardar';
}

// ==============================
// Transaction List
// ==============================
export function renderTransactionList(container, transactions) {
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

    // Detect recurrences across all global loaded transactions
    // We'll mark a transaction as recurring if there's another transaction older than 20 days with the same description/amount
    const isRecurring = (tx) => {
        if (!tx.description) return false;
        const txDate = new Date(tx.date);
        return transactions.some(other => {
            if (other.id === tx.id) return false;
            if (other.description?.toLowerCase() !== tx.description.toLowerCase()) return false;
            const otherDate = new Date(other.date);
            const diffDays = (txDate - otherDate) / (1000 * 60 * 60 * 24);
            return diffDays > 20 && diffDays < 40; // Roughly 1 month ago
        });
    };

    const sortedDates = Object.keys(groups).sort((a, b) => {
        return currentSort === 'desc' ? new Date(b) - new Date(a) : new Date(a) - new Date(b);
    });

    container.innerHTML = sortedDates.map(date => {
        let txs = groups[date];
        // Sort individual transactions within the day to match currentSort
        txs = txs.sort((t1, t2) => {
            return currentSort === 'desc' ? new Date(t2.created_at) - new Date(t1.created_at) : new Date(t1.created_at) - new Date(t2.created_at);
        });

        const txsHtml = txs.map(tx => {
            const catName = tx.categories?.name || tx.category_name || '';
            const catIcon = tx.categories?.icon || tx.category_icon || '📁';
            const recurringHtml = isRecurring(tx) ? '<span class="recurring-tag tooltip-trigger" title="Recurrente Mensual">🔁</span>' : '';
            return `
          <div class="tx-item-wrapper" data-id="${tx.id}">
            <div class="tx-item">
              <div class="tx-icon ${tx.type}">${catIcon}</div>
              <div class="tx-info">
                <div class="tx-description">
                  ${tx.description || catName || 'Sin descripción'}
                  ${tx.is_fixed ? '<span class="fixed-tag" title="Gasto Fijo">📌</span>' : ''}
                  ${recurringHtml}
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
        }).join('');

        return `
      <div class="tx-date-group">
        <div class="tx-date-header">${formatDate(date)}</div>
        ${txsHtml}
      </div>`;
    }).join('');

    // Attach action button listeners
    container.querySelectorAll('.tx-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); startEditTransaction(btn.dataset.id, uiCallbacks); });
    });
    container.querySelectorAll('.tx-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteTransaction(btn.dataset.id, uiCallbacks); });
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

export function renderAllTransactions(transactions, filterCallback) {
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
                if (uiCallbacks.filterCallback) uiCallbacks.filterCallback();
            });
        });
    }
}

export function startEditTransaction(id, callbacks) {
    const state = getState();
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;

    editingTransaction = tx;
    const quickEntryModal = $('quickEntryModal');
    const categoryChips = $('categoryChips');

    // Populate form fields
    $('entryAmount').value = Math.abs(tx.amount);
    $('entryDescription').value = tx.description || '';
    $('entryAccount').value = tx.account || '';
    $('entryDate').value = tx.date;
    $('entryNotes').value = tx.notes || '';
    $('entryFixed').checked = !!tx.is_fixed;

    // Set category chip
    const catName = tx.categories?.name || tx.category_name || '';
    if (callbacks.renderCategoryChips) callbacks.renderCategoryChips(); // Refresh chips first
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
    moveBtn.onclick = () => moveTransaction(editingTransaction, callbacks.refresh);
    $('quickEntryForm').appendChild(moveBtn);

    // Update UI Text
    const modalTitle = quickEntryModal.querySelector('.modal-header h2');
    const submitText = $('submitEntry').querySelector('.btn-text');
    if (modalTitle) modalTitle.textContent = 'Editar Registro';
    if (submitText) submitText.textContent = 'Actualizar';

    openModal(quickEntryModal);
}

async function moveTransaction(tx, refreshCallback) {
    const state = getState();
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
                await executeMove(tx, w.id, refreshCallback);
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

async function executeMove(tx, targetWalletId, refreshCallback) {
    if (isConnected()) {
        const { getSupabase } = await import('../supabase.js');
        await getSupabase().from('transactions').update({ wallet_id: targetWalletId }).eq('id', tx.id);
    }

    // Local update
    const state = getState();
    // Remove from current view if active wallet is source
    if (state.activeWalletId === tx.wallet_id) {
        state.transactions = state.transactions.filter(t => t.id !== tx.id);
    }

    closeModal($('quickEntryModal'));
    refreshCallback();
    showToast('Transacción movida');
}

export async function submitTransaction(callbacks) {
    const state = getState();
    const categoryChips = $('categoryChips');
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
            const { updateTransaction } = await import('../supabase.js');
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
            const { createTransaction } = await import('../supabase.js');
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

    if (callbacks.resetForm) callbacks.resetForm();
    closeModal($('quickEntryModal'));

    submitBtn.querySelector('.btn-text').classList.remove('hidden');
    submitBtn.querySelector('.btn-loading').classList.add('hidden');
    submitBtn.disabled = false;
    editingTransaction = null;

    if (callbacks.refresh) callbacks.refresh();
}

export async function confirmDeleteTransaction(txId, callbacks) {
    const state = getState();
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;

    const desc = tx.description || tx.categories?.name || 'esta transacción';
    const amt = formatCurrency(tx.amount);

    if (!confirm(`¿Eliminar "${desc}" (${tx.type === 'expense' ? '-' : '+'}${amt})?`)) return;

    if (isConnected()) {
        const { deleteTransaction } = await import('../supabase.js');
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

    if (callbacks.refresh) callbacks.refresh();
}
