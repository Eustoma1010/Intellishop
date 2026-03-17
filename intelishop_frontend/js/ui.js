import { App, $ } from './config.js';

export function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 glass p-4 rounded-xl shadow-lg z-50 animate-bounce flex items-center';
    notification.innerHTML = `<i class="fa-regular fa-circle-check text-green-600 text-xl mr-2"></i><span>${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2000);
}

export const hideAllViews = () => {
    ['view-home', 'view-cart', 'view-checkout', 'view-success', 'view-login', 'view-register', 'view-account', 'view-orders'].forEach(id => {
        const el = $(id);
        if (el) el.classList.add('hide');
    });
};

export function updateAuthUI() {
    if (App.isLoggedIn) {
        $('auth-buttons-container').classList.add('hidden');
        $('user-profile-container').classList.remove('hidden');
        $('acc-name').value = App.currentUser.name;
        $('acc-email').value = App.currentUser.email;
    } else {
        $('auth-buttons-container').classList.remove('hidden');
        $('user-profile-container').classList.add('hidden');
    }
}

export const showHome = () => { hideAllViews(); $('view-home').classList.remove('hide'); };
export const showLogin = () => { hideAllViews(); $('view-login').classList.remove('hide'); };
export const showRegister = () => { hideAllViews(); $('view-register').classList.remove('hide'); };
export const showAccount = () => { hideAllViews(); $('view-account').classList.remove('hide'); };