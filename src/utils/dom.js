export const $ = id => document.getElementById(id);

export function openModal(modal) {
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

export function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

let toastTimeout;
export function showToast(msg, actionText = null, actionCallback = null) {
    const toast = $('toast');
    if (!toast) return;

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

export function confettiEffect() {
    const confettiContainer = document.createElement('div');
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100vw';
    confettiContainer.style.height = '100vh';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '9999';

    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'][Math.floor(Math.random() * 5)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-10px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';

        const animDuration = Math.random() * 2 + 1;
        confetti.style.transition = `top ${animDuration}s linear, transform ${animDuration}s ease-in`;

        confettiContainer.appendChild(confetti);

        setTimeout(() => {
            confetti.style.top = '100vh';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        }, 50);
    }

    document.body.appendChild(confettiContainer);
    setTimeout(() => confettiContainer.remove(), 3000);
}
