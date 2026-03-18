import { API_BASE_URL, App, $ } from './config.js';
import { showNotification, showLogin, showHome, updateAuthUI } from './ui.js';
import { updateCartCount } from './cart.js';

// Cập nhật trạng thái nút bấm (Loading state)
const setButtonLoading = (btnId, isLoading, originalText) => {
    const btn = $(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
        btn.classList.add('opacity-70', 'cursor-not-allowed');
        btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xử lý...`;
    } else {
        btn.classList.remove('opacity-70', 'cursor-not-allowed');
        btn.innerHTML = originalText;
    }
};

export function checkPasswordStrength() {
    const password = $('reg-password')?.value || '';
    const bars = [$('strength-bar-1'), $('strength-bar-2'), $('strength-bar-3')];
    const texts = [$('strength-text-1'), $('strength-text-2'), $('strength-text-3')];
    if (!bars[0] || !texts[0]) return;

    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.match(/(?=.*[a-z])(?=.*[A-Z])/)) strength += 1;
    if (password.match(/(?=.*\d)(?=.*[\W_])/)) strength += 1;

    bars.forEach(bar => bar.className = 'h-full w-1/3 transition-colors duration-300 bg-transparent');
    texts.forEach(txt => txt.className = 'text-gray-400 transition-colors');

    if (strength === 0 && password.length > 0) {
        bars[0].classList.replace('bg-transparent', 'bg-red-500');
        texts[0].classList.replace('text-gray-400', 'text-red-500');
    } else if (strength === 1) {
        bars.slice(0, 2).forEach(bar => bar.classList.replace('bg-transparent', 'bg-orange-500'));
        texts.slice(0, 2).forEach(txt => txt.classList.replace('text-gray-400', 'text-orange-500'));
    } else if (strength >= 2) {
        bars.forEach(bar => bar.classList.replace('bg-transparent', 'bg-green-500'));
        texts.forEach(txt => txt.classList.replace('text-gray-400', 'text-green-500'));
    }
    checkPasswordMatch();
}

export function checkPasswordMatch() {
    const password = $('reg-password')?.value || '';
    const confirm = $('reg-password-confirm')?.value || '';
    const msg = $('password-match-msg');
    const btnSubmit = $('btn-register-submit');

    if (!msg || !btnSubmit) return;

    if (confirm.length > 0 && password !== confirm) {
        msg.classList.remove('hidden');
        btnSubmit.disabled = true;
        btnSubmit.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        msg.classList.add('hidden');
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

export function togglePassword(inputId) {
    const input = $(inputId);
    if (!input) return;
    const icon = input.nextElementSibling?.querySelector('i');
    if (!icon) return;

    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
        icon.classList.add('text-pink-500');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
        icon.classList.remove('text-pink-500');
    }
}

export async function handleRegister(event) {
    event.preventDefault();
    const btnId = 'btn-register-submit';
    setButtonLoading(btnId, true, 'ĐĂNG KÝ');

    try {
        const payload = {
            name: $('reg-name').value,
            email: $('reg-email').value,
            phone: $('reg-phone').value,
            password: $('reg-password').value,
            gender: document.querySelector('input[name="gender"]:checked')?.value || 'other'
        };

        const response = await fetch(`${API_BASE_URL}/api/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Đăng ký thành công! Vui lòng đăng nhập.');
            showLogin();
            $('register-form').reset();
            checkPasswordStrength();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification("Lỗi kết nối đến máy chủ!", 'error');
    } finally {
        setButtonLoading(btnId, false, 'ĐĂNG KÝ');
    }
}

export async function handleLogin(event) {
    event.preventDefault();
    const btnId = 'btn-login-submit'; // Giả sử nút submit của bạn có id này, nếu ko hãy gán id cho nó
    setButtonLoading(btnId, true, 'ĐĂNG NHẬP');

    try {
        const payload = {
            email: $('login-email').value,
            password: $('login-password').value
        };

        const response = await fetch(`${API_BASE_URL}/api/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (data.success) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            App.currentUser = { email: data.email, name: data.name };
            App.isLoggedIn = true;
            updateAuthUI();

            showNotification(data.message);
            $('login-form').reset();
            setTimeout(showHome, 300);
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification("Lỗi kết nối đến máy chủ!", 'error');
    } finally {
        setButtonLoading(btnId, false, 'ĐĂNG NHẬP');
    }
}

export function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    App.isLoggedIn = false;
    App.cart = [];
    App.hasActiveOrder = false;

    updateCartCount();
    updateAuthUI();
    showNotification('Đã đăng xuất tài khoản!');
    showHome();
}