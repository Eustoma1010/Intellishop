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
    const views = [
        'view-home',
        'view-cart',
        'view-checkout',
        'view-success',
        'view-login',
        'view-register',
        'view-verify-register',
        'view-forgot-password',
        'view-account',
        'view-orders',
        'view-vendor-apply',
        'view-shipper-apply',
        'view-vendor-center',
        'view-shipper-dashboard',
        'view-admin-dashboard'
    ];
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
        const roleBadge = $('user-role-badge');
        if (roleBadge) {
            const roles = [];
            if (App.currentUser?.can_vendor) roles.push('VENDOR');
            if (App.currentUser?.can_shipper) roles.push('SHIPPER');
            const roleText = roles.length ? roles.join(' + ') : (App.currentUser?.role || 'CUSTOMER');
            roleBadge.textContent = roleText;
        }

        const navVendorLink = $('nav-vendor-link');
        if (navVendorLink) {
            navVendorLink.innerHTML = App.currentUser?.can_vendor
                ? '<i class="fa-solid fa-store mr-2 text-pink-500"></i> Quản lý gian hàng'
                : '<i class="fa-solid fa-store mr-2 text-pink-500"></i> Đăng ký người bán';
        }
        const accountVendorBtn = $('account-vendor-btn');
        if (accountVendorBtn) {
            accountVendorBtn.textContent = App.currentUser?.can_vendor ? 'Quản lý gian hàng' : 'Đăng ký người bán';
        }
        const navShipperLink = $('nav-shipper-link');
        if (navShipperLink) {
            navShipperLink.innerHTML = App.currentUser?.can_shipper
                ? '<i class="fa-solid fa-truck mr-2 text-pink-500"></i> Quản lý vận chuyển'
                : '<i class="fa-solid fa-truck mr-2 text-pink-500"></i> Đăng ký vận chuyển';
        }
        const accountShipperBtn = $('account-shipper-btn');
        if (accountShipperBtn) {
            accountShipperBtn.textContent = App.currentUser?.can_shipper ? 'Quản lý vận chuyển' : 'Đăng ký shipper';
        }

        const isAdmin = (App.currentUser?.role || '').toUpperCase() === 'ADMIN';
        const navAdminLink = $('nav-admin-link');
        if (navAdminLink) {
            navAdminLink.classList.toggle('hidden', !isAdmin);
        }
        const accountAdminBtn = $('account-admin-btn');
        if (accountAdminBtn) {
            accountAdminBtn.classList.toggle('hidden', !isAdmin);
        }
    } else {
        if (authBtns) authBtns.classList.remove('hidden');
        if (userProf) userProf.classList.add('hidden');

        const navAdminLink = $('nav-admin-link');
        if (navAdminLink) navAdminLink.classList.add('hidden');
        const accountAdminBtn = $('account-admin-btn');
        if (accountAdminBtn) accountAdminBtn.classList.add('hidden');
    }
}

// Hàm tiện ích chuyển trang (Tái sử dụng logic chung)
const switchView = (viewId) => {
    hideAllViews();
    const view = $(viewId);
    if(view) view.classList.remove('hide');
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

const resetRegisterPanels = () => {
    const localPanel = document.getElementById('register-form-panel');
    const googlePanel = document.getElementById('google-complete-panel');
    if (localPanel) localPanel.classList.remove('hidden');
    if (googlePanel) googlePanel.classList.add('hidden');
    if (typeof window.resetRegisterFormMode === 'function') {
        window.resetRegisterFormMode();
    }
};

export const showHome = () => switchView('view-home');
export const showLogin = () => switchView('view-login');
export const showRegister = () => {
    switchView('view-register');
    resetRegisterPanels();
};
export const showVerifyRegister = () => switchView('view-verify-register');
export const showForgotPassword = () => {
    switchView('view-forgot-password');
    const sendStep = document.getElementById('forgot-step-send');
    const resetStep = document.getElementById('forgot-step-reset');
    if (sendStep) sendStep.classList.remove('hidden');
    if (resetStep) resetStep.classList.add('hidden');
};
export const showAccount = () => {
    switchView('view-account');
    if (typeof window.loadAccountWorkspace === 'function') {
        window.loadAccountWorkspace();
    }
};
export const showVendorApply = () => {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập trước khi nộp đơn Người bán.', 'error');
        showLogin();
        return;
    }
    if (App.currentUser?.can_vendor && typeof window.showVendorCenter === 'function') {
        window.showVendorCenter('products');
        return;
    }
    switchView('view-vendor-apply');
    if ($('vendor-owner-name')) $('vendor-owner-name').value = App.currentUser?.name || '';
    if ($('vendor-owner-email')) $('vendor-owner-email').value = App.currentUser?.email || '';
    if (typeof window.initVendorApplyAddress === 'function') {
        window.initVendorApplyAddress();
    }
};
export const showShipperApply = () => {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập trước khi nộp đơn vận chuyển.', 'error');
        showLogin();
        return;
    }
    if (App.currentUser?.can_shipper) {
        if (typeof window.showShipperDashboard === 'function') {
            window.showShipperDashboard();
            return;
        }
        showNotification('Tài khoản đã có quyền Đơn vị vận chuyển.', 'success');
        return;
    }
    switchView('view-shipper-apply');
    if ($('shipper-contact-email')) $('shipper-contact-email').value = App.currentUser?.email || '';
};
export const showAdminDashboard = () => {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập tài khoản admin trước.', 'error');
        showLogin();
        return;
    }
    if ((App.currentUser?.role || '').toUpperCase() !== 'ADMIN') {
        showNotification('Bạn không có quyền truy cập khu vực quản trị.', 'error');
        return;
    }
    if (typeof window.openAdminDashboard === 'function') {
        window.openAdminDashboard('accounts');
    }
};
export const showLocalRegister = () => {
    showRegister();
};
