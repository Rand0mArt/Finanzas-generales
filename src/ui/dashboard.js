import Chart from 'chart.js/auto';
import { $ } from '../utils/dom.js';
// Actually, formatCurrency is in formatters.js
import { formatCurrency as formatCurrencyReal } from '../utils/formatters.js';

let categoryChart = null;

export function renderDashboard(transactions, globalLiquidity, wallet) {
    const totalIncome = $('totalIncome');
    const totalExpense = $('totalExpense');
    const totalBalance = $('totalBalance');
    const globalBalanceEl = $('globalBalance');
    const profitCard = $('profitCard');
    const profitAmount = $('profitAmount');
    const profitMargin = $('profitMargin');
    const budgetFill = $('budgetFill');
    const budgetSpent = $('budgetSpent');
    const budgetTotal = $('budgetTotal');
    const budgetSection = $('budgetSection');

    // Update Global Balance
    if (globalBalanceEl && globalLiquidity !== undefined) {
        globalBalanceEl.textContent = formatCurrencyReal(globalLiquidity);
        globalBalanceEl.className = `global-balance-amount ${globalLiquidity >= 0 ? 'income' : 'expense'}`;
    }

    // Calculate totals for active wallet & current month
    const income = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    const balance = income - expense;

    if (totalIncome) totalIncome.textContent = formatCurrencyReal(income);
    if (totalExpense) totalExpense.textContent = formatCurrencyReal(expense);
    if (totalBalance) {
        totalBalance.textContent = formatCurrencyReal(balance);
        totalBalance.className = `balance-amount ${balance >= 0 ? 'income' : 'expense'}`;
    }

    // Profit card for business wallets
    if (wallet && wallet.wallet_type === 'business' && profitCard) {
        profitCard.classList.remove('hidden');
        const margin = income > 0 ? ((balance / income) * 100).toFixed(1) : 0;
        if (profitAmount) profitAmount.textContent = formatCurrencyReal(balance);
        if (profitMargin) profitMargin.textContent = `${margin}%`;
        profitCard.className = `profit-card ${balance < 0 ? 'negative' : ''}`;
    } else if (profitCard) {
        profitCard.classList.add('hidden');
    }

    // Budget bar
    const budget = wallet?.monthly_budget || 0;
    if (budget > 0 && budgetSection) {
        const pct = Math.min((expense / budget) * 100, 100);
        if (budgetFill) {
            budgetFill.style.width = `${pct}%`;
            budgetFill.className = `budget-fill ${pct > 90 ? 'danger' : pct > 70 ? 'warning' : ''}`;
        }
        if (budgetSpent) budgetSpent.textContent = formatCurrencyReal(expense);
        if (budgetTotal) budgetTotal.textContent = formatCurrencyReal(budget);
        budgetSection.classList.remove('hidden');
    } else if (budgetSection) {
        budgetSection.classList.add('hidden');
    }

    // Render chart
    renderChart(transactions);
}

export function renderChart(transactions) {
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
                        label: ctx => ` ${ctx.label}: ${formatCurrencyReal(ctx.raw)}`
                    }
                }
            }
        }
    });
}
