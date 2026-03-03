import { $, showToast, confettiEffect, openModal, closeModal } from '../utils/dom.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { getState, setState } from '../state.js';
import { isConnected } from '../supabase.js';

let draggedGoalId = null;
export let editingGoalId = null;

export async function renderGoals() {
    const state = getState();
    let goals = [...state.goals];
    goals.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

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
        const target = parseFloat(g.target_amount) || 0;
        const current = parseFloat(g.current_amount) || 0;
        const progressVal = target > 0 ? Math.min((current / target) * 100, 100) : 0;
        const progress = progressVal.toFixed(1);
        const isCompleted = current >= target && target > 0;

        let progressColor = '#10B981';
        if (progressVal < 30) progressColor = '#EF4444';
        else if (progressVal < 70) progressColor = '#F59E0B';

        let pColor = 'var(--text-secondary)';
        let pLabel = '';
        if (g.priority === 'high') { pColor = '#EF4444'; pLabel = '🔺 Alta'; }
        if (g.priority === 'medium') { pColor = '#F59E0B'; pLabel = '➖ Media'; }
        if (g.priority === 'low') { pColor = '#3B82F6'; pLabel = '🔻 Baja'; }

        // Milestone markers — show which ones are unlocked
        const milestones = [25, 50, 75, 100];
        const milestonesHtml = milestones.map(m => `
          <div class="milestone-dot ${progressVal >= m ? 'reached' : ''}" title="${m}%">
            ${progressVal >= m ? '⭐' : '○'}
          </div>
        `).join('');

        return `
      <div class="goal-card ${isCompleted ? 'completed-goal' : ''}" data-id="${g.id}" draggable="true" style="border-left: 4px solid ${pColor}">
        <div class="goal-header">
          <div class="goal-icon-wrap">${g.icon || '🎯'}</div>
          <div class="goal-titles">
            <span class="goal-name">${g.name}</span>
            <span class="goal-type-label">${g.category_type || 'Meta'}</span>
          </div>
          <div class="goal-header-right">
            ${pLabel ? `<span class="goal-priority-badge" style="color:${pColor};border-color:${pColor}">${pLabel}</span>` : ''}
            <button class="icon-btn edit-goal-btn" data-id="${g.id}" title="Editar meta">✏️</button>
          </div>
        </div>

        ${g.notes ? `<div class="goal-notes">📝 ${g.notes}</div>` : ''}

        <div class="goal-progress-section">
          <div class="goal-progress-track">
            <div class="goal-progress-fill" style="width: ${progress}%; background: ${progressColor}; box-shadow: 0 0 8px ${progressColor}60;"></div>
          </div>
          <div class="goal-milestones">${milestonesHtml}</div>
        </div>

        <div class="goal-footer">
          <div class="goal-amounts-block">
            <span class="goal-current">${formatCurrency(current)}</span>
            <span class="goal-separator"> / </span>
            <span class="goal-target">${formatCurrency(target)}</span>
          </div>
          <div class="goal-score-block" style="color:${progressColor}">
            ${Math.round(progress)}%
          </div>
          ${!isCompleted ? `
            <button class="add-fund-btn" data-id="${g.id}">+ Abonar</button>
          ` : '<span class="goal-done-icon">🎉 Completada</span>'}
        </div>

        ${g.deadline ? `<div class="goal-deadline">📅 Límite: ${formatDate(g.deadline)}</div>` : ''}

        <div class="goal-history-section" data-id="${g.id}">
          <button class="goal-history-toggle" data-id="${g.id}">
            <span class="history-icon">📋</span> Historial de abonos
          </button>
          <div class="goal-history-list hidden" id="history-${g.id}"></div>
        </div>
      </div>`;
    }).join('');

    goalsList.querySelectorAll('.goal-card').forEach(card => {
        const goalId = card.dataset.id;

        // Add Fund button
        const btn = card.querySelector('.add-fund-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                openAddFundModal(btn.dataset.id);
            };
        }

        // Edit button
        const editBtn = card.querySelector('.edit-goal-btn');
        if (editBtn) {
            editBtn.onclick = (e) => {
                e.stopPropagation();
                openGoalModal(editBtn.dataset.id);
            };
        }

        // History toggle
        const histToggle = card.querySelector('.goal-history-toggle');
        if (histToggle) {
            histToggle.onclick = async (e) => {
                e.stopPropagation();
                const listEl = document.getElementById(`history-${goalId}`);
                if (!listEl) return;

                if (!listEl.classList.contains('hidden')) {
                    listEl.classList.add('hidden');
                    return;
                }

                // Fetch and render history
                let history = [];
                if (isConnected()) {
                    const { fetchGoalHistory } = await import('../supabase.js');
                    history = await fetchGoalHistory(goalId);
                }

                if (history.length === 0) {
                    listEl.innerHTML = `<p class="history-empty">Sin abonos registrados</p>`;
                } else {
                    listEl.innerHTML = history.map(h => `
                      <div class="history-entry">
                        <span class="history-date">${formatDate(h.date)}</span>
                        <span class="history-amount income">+${formatCurrency(h.amount)}</span>
                        ${h.notes ? `<span class="history-notes">${h.notes}</span>` : ''}
                      </div>
                    `).join('');
                }

                listEl.classList.remove('hidden');
            };
        }

        // Long press for edit (mobile)
        let pressTimer;
        let isLongPress = false;
        const startPress = (e) => {
            if (e.target.closest('.add-fund-btn') || e.target.closest('.edit-goal-btn') || e.target.closest('.goal-history-toggle')) return;
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                openGoalModal(card.dataset.id);
                if (navigator.vibrate) navigator.vibrate(50);
            }, 600);
        };
        const cancelPress = () => clearTimeout(pressTimer);

        card.addEventListener('touchstart', startPress, { passive: true });
        card.addEventListener('touchend', cancelPress);
        card.addEventListener('touchmove', cancelPress);
        card.addEventListener('mousedown', startPress);
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('mouseleave', cancelPress);

        // Drag and Drop
        card.addEventListener('dragstart', (e) => {
            cancelPress();
            draggedGoalId = card.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => { card.style.opacity = '1'; });
        card.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        card.addEventListener('drop', async (e) => {
            e.preventDefault();
            const targetId = card.dataset.id;
            if (draggedGoalId && draggedGoalId !== targetId) {
                await handleGoalReorder(draggedGoalId, targetId);
            }
        });
    });
}

async function handleGoalReorder(draggedId, targetId) {
    const state = getState();
    const goals = [...state.goals];
    const draggedIdx = goals.findIndex(g => g.id === draggedId);
    const targetIdx = goals.findIndex(g => g.id === targetId);
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [removed] = goals.splice(draggedIdx, 1);
    goals.splice(targetIdx, 0, removed);
    goals.forEach((g, i) => g.sort_order = i);

    setState({ goals });
    renderGoals();

    if (isConnected()) {
        const { updateGoal } = await import('../supabase.js');
        await Promise.all(goals.map(g => updateGoal(g.id, { sort_order: g.sort_order })));
    }
}

// ==============================
// Add Fund Modal
// ==============================
export function openAddFundModal(goalId) {
    const modal = $('addFundModal');
    if (!modal) return;

    $('fundGoalId').value = goalId;
    $('fundAmount').value = '';
    if ($('fundNotes')) $('fundNotes').value = '';
    if ($('fundDate')) $('fundDate').value = new Date().toISOString().split('T')[0];
    openModal(modal);
    setTimeout(() => $('fundAmount').focus(), 50);
}

export async function submitAddFund() {
    const goalId = $('fundGoalId').value;
    const amountStr = $('fundAmount').value;
    if (!amountStr || !goalId) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    const notes = $('fundNotes')?.value?.trim() || '';
    const date = $('fundDate')?.value || new Date().toISOString().split('T')[0];

    const state = getState();
    let goal = state.goals.find(g => g.id === goalId);

    if (!goal && isConnected()) {
        const { fetchGoals } = await import('../supabase.js');
        const gs = await fetchGoals();
        goal = gs.find(g => g.id === goalId);
    }

    if (!goal) return;

    const newAmount = parseFloat(goal.current_amount) + amount;

    if (isConnected()) {
        const { addGoalFundWithHistory } = await import('../supabase.js');
        await addGoalFundWithHistory(goalId, amount, notes, date);
        // Optimistic update
        const idx = state.goals.findIndex(g => g.id === goalId);
        if (idx !== -1) state.goals[idx].current_amount = newAmount;
    } else {
        goal.current_amount = newAmount;
        setState({ goals: state.goals });
    }

    if (newAmount >= parseFloat(goal.target_amount)) {
        showToast('🎉 ¡Felicidades! Meta alcanzada');
        confettiEffect();
    } else {
        showToast(`💰 Abono de ${formatCurrency(amount)} registrado`);
    }

    closeModal($('addFundModal'));
    if ($('addFundForm')) $('addFundForm').reset();
    renderGoals();
}

export function openGoalModal(goalId = null) {
    editingGoalId = goalId;
    const form = $('addGoalForm');
    form.reset();

    const headerText = $('addGoalModal').querySelector('.modal-header h2');
    headerText.textContent = goalId ? 'Editar Meta' : 'Nueva Meta';

    if (goalId) {
        const goal = getState().goals.find(g => g.id === goalId);
        if (goal) {
            $('goalName').value = goal.name || '';
            $('goalType').value = goal.category_type || 'Ahorro';
            $('goalTarget').value = goal.target_amount || '';
            if (goal.deadline) $('goalDeadline').value = goal.deadline;
            $('goalIcon').value = goal.icon || '🎯';
            if ($('goalPriority')) $('goalPriority').value = goal.priority || 'medium';
            if ($('goalNotes')) $('goalNotes').value = goal.notes || '';
        }
    }
    openModal($('addGoalModal'));
    setTimeout(() => $('goalName').focus(), 50);

    // Wire delete button inside modal
    const deleteBtn = $('addGoalModal').querySelector('.delete-goal-btn');
    if (deleteBtn) {
        deleteBtn.style.display = goalId ? 'inline-flex' : 'none';
        deleteBtn.onclick = () => confirmDeleteGoal(goalId);
    }
}

async function confirmDeleteGoal(goalId) {
    if (!confirm('¿Eliminar esta meta?')) return;
    const state = getState();
    setState({ goals: state.goals.filter(g => g.id !== goalId) });

    if (isConnected()) {
        const { deleteGoal } = await import('../supabase.js');
        await deleteGoal(goalId);
    }

    closeModal($('addGoalModal'));
    showToast('Meta eliminada');
    renderGoals();
}

export async function submitGoal() {
    const state = getState();
    const existingGoal = editingGoalId ? state.goals.find(g => g.id === editingGoalId) : null;

    const priority = $('goalPriority')?.value || 'medium';
    const notes = $('goalNotes')?.value || '';

    const goal = {
        id: editingGoalId || crypto.randomUUID(),
        wallet_id: existingGoal ? existingGoal.wallet_id : state.activeWalletId,
        name: $('goalName').value.trim(),
        target_amount: parseFloat($('goalTarget').value) || 0,
        current_amount: existingGoal ? existingGoal.current_amount : 0,
        category_type: $('goalType')?.value || 'Ahorro',
        deadline: $('goalDeadline').value || null,
        status: 'active',
        icon: $('goalIcon').value || '🎯',
        priority,
        notes,
        sort_order: existingGoal ? (existingGoal.sort_order || 0) : state.goals.length,
        created_at: existingGoal ? existingGoal.created_at : new Date().toISOString(),
    };

    if (!goal.name || !goal.target_amount) {
        showToast('Completa nombre y monto');
        return;
    }

    if (editingGoalId) {
        const idx = state.goals.findIndex(g => g.id === editingGoalId);
        if (idx !== -1) state.goals[idx] = goal;
    } else {
        setState({ goals: [...state.goals, goal] });
    }

    if (isConnected()) {
        if (editingGoalId) {
            const { updateGoal } = await import('../supabase.js');
            await updateGoal(goal.id, goal);
        } else {
            const { createGoal } = await import('../supabase.js');
            const { id, ...data } = goal;
            await createGoal(data);
        }
    }

    $('addGoalForm').reset();
    closeModal($('addGoalModal'));
    showToast(editingGoalId ? '🎯 Meta actualizada' : '🎯 Meta creada');
    editingGoalId = null;
    renderGoals();
}
