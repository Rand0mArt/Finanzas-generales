import { $, showToast, confettiEffect, openModal, closeModal } from '../utils/dom.js';
import { formatCurrency, formatDate } from '../utils/formatters.js';
import { getState, setState } from '../state.js';
import { isConnected } from '../supabase.js';

let draggedGoalId = null;
export let editingGoalId = null;

export async function renderGoals() {
    const state = getState();
    let goals = [];

    if (isConnected()) {
        const { fetchGoals } = await import('../supabase.js');
        goals = await fetchGoals();
        setState({ goals }); // FIX: update state so local additions work optimally
    } else {
        goals = state.goals; // Global goals, no wallet filter needed
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

        let pColor = 'transparent';
        if (g.priority === 'high') pColor = '#EF4444';
        if (g.priority === 'medium') pColor = '#F59E0B';
        if (g.priority === 'low') pColor = '#3B82F6';

        return `
      <div class="goal-card ${isCompleted ? 'completed-goal glow-effect' : ''}" data-id="${g.id}" draggable="true" style="border-left: 4px solid ${pColor}">
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
        
        ${g.notes ? `<div class="goal-notes">${g.notes}</div>` : ''}
        
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

    goalsList.querySelectorAll('.goal-card').forEach(card => {
        // Add Fund Listeners
        const btn = card.querySelector('.add-fund-btn');
        if (btn) {
            btn.onclick = (e) => {
                e.stopPropagation();
                openAddFundModal(btn.dataset.id);
            };
        }

        // Long press logic for editing
        let pressTimer;
        let isLongPress = false;

        const startPress = (e) => {
            if (e.target.closest('.add-fund-btn')) return;
            isLongPress = false;
            pressTimer = setTimeout(() => {
                isLongPress = true;
                openGoalModal(card.dataset.id);
                if (navigator.vibrate) navigator.vibrate(50);
            }, 500);
        };

        const cancelPress = () => clearTimeout(pressTimer);

        card.addEventListener('touchstart', startPress, { passive: true });
        card.addEventListener('touchend', cancelPress);
        card.addEventListener('touchmove', cancelPress);
        card.addEventListener('mousedown', startPress);
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('mouseleave', cancelPress);
        card.addEventListener('click', (e) => {
            if (isLongPress) e.preventDefault();
        });

        // Drag and Drop
        card.addEventListener('dragstart', (e) => {
            cancelPress();
            draggedGoalId = card.dataset.id;
            e.dataTransfer.effectAllowed = 'move';
            card.style.opacity = '0.5';
        });
        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
        });
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
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

    // Reorder array
    const [removed] = goals.splice(draggedIdx, 1);
    goals.splice(targetIdx, 0, removed);

    // Re-assign sort_orders
    goals.forEach((g, i) => g.sort_order = i);

    // Optimistic save
    setState({ goals });
    renderGoals();

    // Cloud sync
    if (isConnected()) {
        const { updateGoal } = await import('../supabase.js');
        await Promise.all(goals.map(g => updateGoal(g.id, { sort_order: g.sort_order })));
    }
}

// Add Fund Logic - Prompt for amount
export function openAddFundModal(goalId) {
    const modal = $('addFundModal');
    if (!modal) return;

    $('fundGoalId').value = goalId;
    $('fundAmount').value = '';
    openModal(modal);
    setTimeout(() => $('fundAmount').focus(), 50);
}

export async function submitAddFund() {
    const goalId = $('fundGoalId').value;
    const amountStr = $('fundAmount').value;

    if (!amountStr || !goalId) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return;

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
        const { updateGoal } = await import('../supabase.js');
        await updateGoal(goalId, { current_amount: newAmount });
        // Optimistic update
        const idx = state.goals.findIndex(g => g.id === goalId);
        if (idx !== -1) state.goals[idx].current_amount = newAmount;
    } else {
        goal.current_amount = newAmount;
        // We would need saveState here, but setState triggers it.
        setState({ goals: state.goals });
    }

    // Confetti if reached 100%
    if (newAmount >= goal.target_amount) {
        showToast('🎉 ¡Felicidades! Meta alcanzada');
        confettiEffect();
    } else {
        showToast(`💰 Agregado ${formatCurrency(amount)} a ${goal.name}`);
    }

    closeModal($('addFundModal'));
    $('addFundForm').reset();
    renderGoals();
}

export function openGoalModal(goalId = null) {
    editingGoalId = goalId;
    const form = $('addGoalForm');
    form.reset();

    // Update header text
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
        priority: priority,
        notes: notes,
        sort_order: existingGoal ? (existingGoal.sort_order || 0) : state.goals.length,
        created_at: existingGoal ? existingGoal.created_at : new Date().toISOString(),
    };

    if (!goal.name || !goal.target_amount) {
        showToast('Completa nombre y monto');
        return;
    }

    // Optimistic update
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
