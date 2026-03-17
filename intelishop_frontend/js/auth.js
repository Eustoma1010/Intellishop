import { API_BASE_URL, App, $ } from './config.js';
import { showNotification, showLogin, showHome, updateAuthUI } from './ui.js';
import { updateCartCount } from './cart.js'; // Import để reset giỏ hàng khi đăng xuất

export async function handleRegister(event) {
    event.preventDefault();
    const nameInput = $('reg-name').value || "Người dùng mới";
    const emailInput = $('reg-email').value;
    const passwordInput = $('reg-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameInput, email: emailInput, password: passwordInput })
        });
        const data = await response.json();

        if (data.success) {
            showNotification(data.message);
            showLogin();
            $('reg-password').value = '';
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối đến Backend Django!");
    }
}

export async function handleLogin(event) {
    event.preventDefault();
    const emailInput = $('login-email').value;
    const passwordInput = $('login-password').value;

    try {
        const response = await fetch(`${API_BASE_URL}/api/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailInput, password: passwordInput })
        });
        const data = await response.json();

        if (data.success) {
            App.currentUser = { email: data.email, name: data.name };
            App.isLoggedIn = true;
            updateAuthUI();
            showNotification(data.message);
            $('login-password').value = '';
            setTimeout(showHome, 1000);
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert("Lỗi kết nối đến Backend Django!");
    }
}

export function logout() {
    App.isLoggedIn = false;
    App.cart = [];
    App.hasActiveOrder = false;
    updateCartCount();
    updateAuthUI();
    showNotification('Đã đăng xuất tài khoản!');
    showHome();
}