import { App, $ } from './config.js';

// Quản lý thông báo (Notification) không bị tràn màn hình nếu bấm liên tục
export function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-white' : 'bg-red-50';
    const icon = type === 'success' ? 'fa-circle-check text-green-600' : 'fa-circle-exclamation text-orange-500';

    notification.className = `fixed top-20 right-4 ${bgClass} p-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] z-[9999] animate-bounce flex items-center border ${type === 'success' ? 'border-green-100' : 'border-red-200'}`;
    notification.innerHTML = `<i class="fa-regular ${icon} text-xl mr-3"></i><span class="font-semibold text-gray-800">${message}</span>`;

    document.body.appendChild(notification);

    // Tự động xóa mượt mà
    setTimeout(() => {
        notification.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => notification.remove(), 500);
    }, 2500);
}

// Tối ưu hàm ẩn tất cả các view chỉ với 1 vòng lặp an toàn
export const hideAllViews = () => {
    const views = ['view-home', 'view-cart', 'view-checkout', 'view-success', 'view-login', 'view-register', 'view-account', 'view-orders'];
    views.forEach(id => {
        const el = $(id);
        if (el) el.classList.add('hide');
    });
};

// Cập nhật giao diện xác thực an toàn
export function updateAuthUI() {
    const authBtns = $('auth-buttons-container');
    const userProf = $('user-profile-container');

    if (App.isLoggedIn) {
        if (authBtns) authBtns.classList.add('hidden');
        if (userProf) userProf.classList.remove('hidden');
        if ($('acc-name')) $('acc-name').value = App.currentUser?.name || '';
        if ($('acc-email')) $('acc-email').value = App.currentUser?.email || '';
    } else {
        if (authBtns) authBtns.classList.remove('hidden');
        if (userProf) userProf.classList.add('hidden');
    }
}

// Hàm tiện ích chuyển trang (Tái sử dụng logic chung)
const switchView = (viewId) => {
    hideAllViews();
    const view = $(viewId);
    if(view) view.classList.remove('hide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

export const showHome = () => switchView('view-home');
export const showLogin = () => switchView('view-login');
export const showRegister = () => switchView('view-register');
export const showAccount = () => switchView('view-account');