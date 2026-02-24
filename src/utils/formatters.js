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
