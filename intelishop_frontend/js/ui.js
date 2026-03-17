import { App, $ } from './config.js';

export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'fixed top-20 right-4 glass p-4 rounded-xl shadow-lg z-50 animate-bounce flex items-center';
    const icon = type === 'success' ? 'fa-circle-check text-green-600' : 'fa-circle-exclamation text-orange-500';
    notification.innerHTML = `<i class="fa-regular ${icon} text-xl mr-2"></i><span class="font-semibold text-gray-800">${message}</span>`;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 2500);
}

export const hideAllViews = () => {
    ['view-home', 'view-cart', 'view-checkout', 'view-success', 'view-login', 'view-register', 'view-account', 'view-orders'].forEach(id => {
        const el = $(id);
        if (el) el.classList.add('hide');
    });
};

export function updateAuthUI() {
    const authBtns = $('auth-buttons-container');
    const userProf = $('user-profile-container');
    if (App.isLoggedIn) {
        if(authBtns) authBtns.classList.add('hidden');
        if(userProf) userProf.classList.remove('hidden');
        if($('acc-name')) $('acc-name').value = App.currentUser.name;
        if($('acc-email')) $('acc-email').value = App.currentUser.email;
    } else {
        if(authBtns) authBtns.classList.remove('hidden');
        if(userProf) userProf.classList.add('hidden');
    }
}

// Chuyển trang kèm theo Scroll lên đầu trang
export const showHome = () => { hideAllViews(); $('view-home').classList.remove('hide'); window.scrollTo(0,0); };
export const showLogin = () => { hideAllViews(); $('view-login').classList.remove('hide'); window.scrollTo(0,0); };
export const showRegister = () => { hideAllViews(); $('view-register').classList.remove('hide'); window.scrollTo(0,0); };
export const showAccount = () => { hideAllViews(); $('view-account').classList.remove('hide'); window.scrollTo(0,0); };