import { API_BASE_URL, App, $ } from './config.js';
import { showNotification, showLogin, showHome, updateAuthUI } from './ui.js';
import { updateCartCount } from './cart.js';

// 1. Đo sức mạnh mật khẩu
export function checkPasswordStrength() {
    const password = $('reg-password').value;
    const bars = [$('strength-bar-1'), $('strength-bar-2'), $('strength-bar-3')];
    const texts = [$('strength-text-1'), $('strength-text-2'), $('strength-text-3')];

    let strength = 0;
    if (password.length >= 6) strength += 1;
    if (password.match(/(?=.*[a-z])(?=.*[A-Z])/)) strength += 1;
    if (password.match(/(?=.*\d)(?=.*[\W_])/)) strength += 1;

    // Reset giao diện
    bars.forEach(bar => bar.className = 'h-full w-1/3 transition-colors duration-300 bg-transparent');
    texts.forEach(txt => txt.className = 'text-gray-400 transition-colors');

    if (strength === 0 && password.length > 0) {
        bars[0].classList.replace('bg-transparent', 'bg-red-500');
        texts[0].classList.replace('text-gray-400', 'text-red-500');
    } else if (strength === 1) {
        bars[0].classList.replace('bg-transparent', 'bg-orange-500');
        bars[1].classList.replace('bg-transparent', 'bg-orange-500');
        texts[0].classList.replace('text-gray-400', 'text-orange-500');
        texts[1].classList.replace('text-gray-400', 'text-orange-500');
    } else if (strength >= 2) {
        bars.forEach(bar => bar.classList.replace('bg-transparent', 'bg-green-500'));
        texts.forEach(txt => txt.classList.replace('text-gray-400', 'text-green-500'));
    }
    checkPasswordMatch();
}

// 2. Kiểm tra mật khẩu khớp nhau
export function checkPasswordMatch() {
    const password = $('reg-password').value;
    const confirm = $('reg-password-confirm').value;
    const msg = $('password-match-msg');
    const btnSubmit = $('btn-register-submit');

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

// 3. Ẩn/Hiện mật khẩu
export function togglePassword(inputId) {
    const input = $(inputId);
    const icon = input.nextElementSibling.querySelector('i');

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

// 4. Xử lý Đăng ký
export async function handleRegister(event) {
    event.preventDefault();
    const password = $('reg-password').value;
    const nameInput = $('reg-name').value;
    const emailInput = $('reg-email').value;
    const phoneInput = $('reg-phone').value;
    const genderInput = document.querySelector('input[name="gender"]:checked')?.value || 'other';

    try {
        const response = await fetch(`${API_BASE_URL}/api/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameInput, email: emailInput, phone: phoneInput, password: password, gender: genderInput })
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Đăng ký thành công! Vui lòng đăng nhập.');
            showLogin();
            $('register-form').reset();
            checkPasswordStrength(); // Reset thanh đo
        } else alert(data.message);
    } catch (error) {
        alert("Lỗi kết nối đến Backend Django!");
    }
}

// 5. Xử lý Đăng nhập & Lưu JWT
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
            // Lưu token JWT vào trình duyệt
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            App.currentUser = { email: data.email, name: data.name };
            App.isLoggedIn = true;
            updateAuthUI();

            showNotification(data.message);
            $('login-form').reset();
            setTimeout(showHome, 500);
        } else alert(data.message);
    } catch (error) {
        alert("Lỗi kết nối đến Backend Django!");
    }
}

// 6. Xử lý Đăng xuất
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