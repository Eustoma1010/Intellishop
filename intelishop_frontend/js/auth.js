import { API_BASE_URL, GOOGLE_CLIENT_ID, App, $, formatVND } from './config.js';
import { requestJson } from './api.js';
import { showNotification, showLogin, showHome, updateAuthUI, hideAllViews, showVerifyRegister } from './ui.js';
import { updateCartCount } from './cart.js';
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.logout = logout;
window.togglePassword = togglePassword;
window.checkPasswordStrength = checkPasswordStrength;
window.checkPasswordMatch = checkPasswordMatch;
window.handleVerifyRegisterOtp = handleVerifyRegisterOtp;
window.resendRegisterOtp = resendRegisterOtp;
window.handleForgotPasswordSendOtp = handleForgotPasswordSendOtp;
window.handleForgotPasswordReset = handleForgotPasswordReset;
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

const setOtpDebugInfo = (containerId, otpInputId, data) => {
    const box = $(containerId);
    const otp = data?.dev_otp || '';
    const message = data?.otp_debug_message || '';

    if (!box) return;

    if (!otp) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const otpInput = $(otpInputId);
    if (otpInput) otpInput.value = otp;

    box.classList.remove('hidden');
    box.innerHTML = `
        <div class="font-semibold mb-1">Môi trường local/debug chưa gửi email thật.</div>
        <div>${message || 'OTP đang dùng backend debug.'}</div>
        <div class="mt-2">Mã OTP hiện tại: <span class="font-black tracking-[0.25em]">${otp}</span></div>
    `;
};

const REGISTER_MODE_LOCAL = 'local';
const REGISTER_MODE_GOOGLE = 'google';
const AUTH_REQUEST_TIMEOUT_MS = 15000;
const GOOGLE_INIT_MAX_RETRIES = 25;
const GOOGLE_INIT_RETRY_DELAY_MS = 300;

let googleInitAttempt = 0;
let googleButtonsInitialized = false;

function fetchApiJson(url, options = {}, config = {}) {
    return requestJson(url, options, {
        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
        retryGet: 1,
        ...config,
    });
}

function clearChatHistoryAfterAuthSuccess() {
    if (typeof window.clearChatHistory === 'function') {
        window.clearChatHistory();
    }
}

const getRegisterMode = () => sessionStorage.getItem('register_mode') || REGISTER_MODE_LOCAL;

const setRegisterMode = (mode) => {
    sessionStorage.setItem('register_mode', mode);
};

const setFieldLockedByGoogle = (inputId, iconId, isLocked) => {
    const input = $(inputId);
    const icon = $(iconId);
    if (!input) return;

    input.readOnly = isLocked;
    input.classList.toggle('text-gray-500', isLocked);
    input.classList.toggle('cursor-not-allowed', isLocked);
    input.classList.toggle('bg-gray-100', isLocked);
    if (icon) icon.classList.toggle('hidden', !isLocked);
};

function resetRegisterFormMode() {
    setRegisterMode(REGISTER_MODE_LOCAL);
    sessionStorage.removeItem('temp_social_token');
    sessionStorage.removeItem('social_register_intent');

    const title = $('register-title');
    const subtitle = $('register-subtitle');
    const badge = $('social-register-badge');
    const hint = $('social-register-hint');
    const submitBtn = $('btn-register-submit');

    if (title) title.textContent = 'Tạo Tài Khoản';
    if (subtitle) subtitle.textContent = 'Tham gia Intellishop để nhận nhiều ưu đãi!';
    if (badge) badge.classList.add('hidden');
    if (hint) {
        hint.classList.add('hidden');
        hint.textContent = '';
    }
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Đăng Ký';

    setFieldLockedByGoogle('reg-name', 'reg-name-provider-icon', false);
    setFieldLockedByGoogle('reg-email', 'reg-email-provider-icon', false);
}

function activateGoogleRegisterMode(email, name, tempToken, intent = 'register') {
    hideAllViews();
    const regView = document.getElementById('view-register');
    if (regView) regView.classList.remove('hide');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setRegisterMode(REGISTER_MODE_GOOGLE);
    sessionStorage.setItem('temp_social_token', tempToken);
    sessionStorage.setItem('social_register_intent', intent || 'register');

    if ($('reg-name')) $('reg-name').value = name || '';
    if ($('reg-email')) $('reg-email').value = email || '';

    setFieldLockedByGoogle('reg-name', 'reg-name-provider-icon', true);
    setFieldLockedByGoogle('reg-email', 'reg-email-provider-icon', true);

    const title = $('register-title');
    const subtitle = $('register-subtitle');
    const badge = $('social-register-badge');
    const hint = $('social-register-hint');
    const submitBtn = $('btn-register-submit');

    if (title) title.textContent = 'Hoàn Tất Đăng Ký';
    if (badge) badge.classList.remove('hidden');
    if (hint) {
        hint.classList.remove('hidden');
        hint.textContent = intent === 'login'
            ? 'Email chưa được đăng kí. Hoàn tất đăng ký bằng Google.'
            : 'Email và họ tên cung cấp từ Google';
    }
    if (submitBtn) submitBtn.innerHTML = '<i class="fa-brands fa-google"></i> Hoàn Tất Đăng Ký';
}

window.resetRegisterFormMode = resetRegisterFormMode;

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
    const isGoogleMode = getRegisterMode() === REGISTER_MODE_GOOGLE && !!sessionStorage.getItem('temp_social_token');
    setButtonLoading(btnId, true, isGoogleMode ? 'HOÀN TẤT ĐĂNG KÝ' : 'ĐĂNG KÝ');

    try {
        const payload = {
            name:     $('reg-name')?.value?.trim()     || '',
            email:    $('reg-email')?.value?.trim()    || '',
            password: $('reg-password')?.value         || '',
            phone:    $('reg-phone')?.value?.trim()    || '',
        };

        if (!payload.name || !payload.email || !payload.password || !payload.phone) {
            showNotification('Vui lòng điền đầy đủ Họ tên, Email, Số điện thoại và Mật khẩu!', 'error');
            return;
        }

        if (isGoogleMode) {
            const tempToken = sessionStorage.getItem('temp_social_token') || '';
            const data = await fetchApiJson(`${API_BASE_URL}/api/social-complete/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    temp_token: tempToken,
                    phone: payload.phone,
                    password: payload.password,
                }),
            }, { attachAuth: false, retryGet: 0 });

            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            App.currentUser = {
                email: data.user?.email || payload.email,
                name: data.user?.name || payload.name || '',
                role: data.user?.role || 'CUSTOMER',
            };
            localStorage.setItem('current_user_email', App.currentUser.email || '');
            App.isLoggedIn = true;
            clearChatHistoryAfterAuthSuccess();
            updateAuthUI();
            await loadAccountWorkspace();

            $('register-form')?.reset();
            resetRegisterFormMode();
            showNotification(data.message || 'Đăng ký Google thành công!');
            setTimeout(showHome, 300);
            return;
        }

        const data = await fetchApiJson(`${API_BASE_URL}/api/register/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { attachAuth: false, retryGet: 0 });

        const verifyEmail = data.email || payload.email;
        if ($('verify-reg-email')) $('verify-reg-email').value = verifyEmail;
        if ($('verify-reg-otp')) $('verify-reg-otp').value = '';
        showNotification(data.message || 'Vui lòng xác thực OTP để kích hoạt tài khoản.');
        showVerifyRegister();
        setOtpDebugInfo('register-otp-debug', 'verify-reg-otp', data);
        $('register-form')?.reset();
        checkPasswordStrength();
    } catch (error) {
        showNotification(error.message || 'Lỗi kết nối đến máy chủ!', 'error');
    } finally {
        setButtonLoading(btnId, false, isGoogleMode ? 'HOÀN TẤT ĐĂNG KÝ' : 'ĐĂNG KÝ');
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

        const data = await fetchApiJson(`${API_BASE_URL}/api/login/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { attachAuth: false, retryGet: 0 });

        if (data.success) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);

            App.currentUser = {
                email: data.user?.email || payload.email,
                name:  data.user?.name  || '',
                role:  data.user?.role  || 'CUSTOMER',
            };
            localStorage.setItem('current_user_email', App.currentUser.email || '');
            App.isLoggedIn = true;
            clearChatHistoryAfterAuthSuccess();
            updateAuthUI();
            await loadAccountWorkspace();

            showNotification(data.message);
            $('login-form').reset();
            setTimeout(showHome, 300);
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        showNotification(error.message || "Lỗi kết nối đến máy chủ!", 'error');
    } finally {
        setButtonLoading(btnId, false, 'ĐĂNG NHẬP');
    }
}

export async function handleVerifyRegisterOtp(event) {
    event.preventDefault();
    const email = $('verify-reg-email')?.value?.trim() || '';
    const otp = $('verify-reg-otp')?.value?.trim() || '';
    const btnId = 'btn-verify-reg-submit';
    setButtonLoading(btnId, true, 'XÁC THỰC OTP');

    try {
        const data = await fetchApiJson(`${API_BASE_URL}/api/register/verify-otp/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        }, { attachAuth: false, retryGet: 0 });

        localStorage.setItem('access_token', data.access_token);
        localStorage.setItem('refresh_token', data.refresh_token);
        App.currentUser = {
            email: data.user?.email || email,
            name: data.user?.name || '',
            role: data.user?.role || 'CUSTOMER',
        };
        localStorage.setItem('current_user_email', App.currentUser.email || '');
        App.isLoggedIn = true;
        clearChatHistoryAfterAuthSuccess();
        updateAuthUI();
        await loadAccountWorkspace();
        setOtpDebugInfo('register-otp-debug', 'verify-reg-otp', null);
        showNotification(data.message || 'Kích hoạt tài khoản thành công!');
        setTimeout(showHome, 250);
    } catch (error) {
        showNotification(error.message || 'Không thể xác thực OTP.', 'error');
    } finally {
        setButtonLoading(btnId, false, 'XÁC THỰC OTP');
    }
}

export async function resendRegisterOtp() {
    const email = $('verify-reg-email')?.value?.trim() || '';
    if (!email) {
        showNotification('Vui lòng nhập email để gửi lại OTP.', 'error');
        return;
    }
    try {
        const data = await fetchApiJson(`${API_BASE_URL}/api/register/resend-otp/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        }, { attachAuth: false, retryGet: 0 });
        setOtpDebugInfo('register-otp-debug', 'verify-reg-otp', data);
        showNotification(data.message || 'Đã gửi lại OTP.');
    } catch (error) {
        showNotification(error.message || 'Không thể gửi lại OTP.', 'error');
    }
}

export async function handleForgotPasswordSendOtp(event) {
    event.preventDefault();
    const email = $('forgot-email')?.value?.trim() || '';
    const btnId = 'btn-forgot-send';
    setButtonLoading(btnId, true, 'GỬI OTP');

    try {
        const data = await fetchApiJson(`${API_BASE_URL}/api/forgot-password/send-otp/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        }, { attachAuth: false, retryGet: 0 });

        const sendStep = document.getElementById('forgot-step-send');
        const resetStep = document.getElementById('forgot-step-reset');
        if (sendStep) sendStep.classList.add('hidden');
        if (resetStep) resetStep.classList.remove('hidden');
        setOtpDebugInfo('forgot-otp-debug', 'forgot-otp', data);
        showNotification(data.message || 'OTP đã được gửi.');
    } catch (error) {
        showNotification(error.message || 'Không thể gửi OTP.', 'error');
    } finally {
        setButtonLoading(btnId, false, 'GỬI OTP');
    }
}

export async function handleForgotPasswordReset(event) {
    event.preventDefault();
    const email = $('forgot-email')?.value?.trim() || '';
    const otp = $('forgot-otp')?.value?.trim() || '';
    const new_password = $('forgot-new-password')?.value || '';
    const btnId = 'btn-forgot-reset';
    setButtonLoading(btnId, true, 'ĐẶT LẠI MẬT KHẨU');

    try {
        const data = await fetchApiJson(`${API_BASE_URL}/api/forgot-password/reset/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, new_password }),
        }, { attachAuth: false, retryGet: 0 });

        showNotification(data.message || 'Đặt lại mật khẩu thành công.');
        setOtpDebugInfo('forgot-otp-debug', 'forgot-otp', null);
        if ($('forgot-otp')) $('forgot-otp').value = '';
        if ($('forgot-new-password')) $('forgot-new-password').value = '';
        setTimeout(showLogin, 250);
    } catch (error) {
        showNotification(error.message || 'Không thể đặt lại mật khẩu.', 'error');
    } finally {
        setButtonLoading(btnId, false, 'ĐẶT LẠI MẬT KHẨU');
    }
}

export function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('current_user_email');
    App.isLoggedIn = false;
    App.cart = [];
    App.hasActiveOrder = false;

    updateCartCount();
    updateAuthUI();
    showNotification('Đã đăng xuất tài khoản!');
    showHome();
}

function renderAddresses() {
    const listEl = $('acc-address-list');
    if (!listEl) return;
    if (!App.addresses || App.addresses.length === 0) {
        listEl.innerHTML = '<p class="text-sm text-gray-500">Chưa có địa chỉ nào.</p>';
        return;
    }

    listEl.innerHTML = App.addresses.map(addr => `
        <div class="border border-pink-100 rounded-xl p-3 bg-white/70">
            <div class="flex justify-between items-start gap-3">
                <div>
                    <p class="font-semibold text-gray-800">${addr.receiver_name} - ${addr.receiver_phone}</p>
                    <p class="text-sm text-gray-600">${addr.full_address}</p>
                </div>
                <div class="flex gap-2">
                    ${addr.is_default ? '<span class="text-xs px-2 py-1 rounded-full bg-pink-100 text-pink-700 font-semibold">Mặc định</span>' : `<button onclick="setDefaultAddress(${addr.id})" class="text-xs px-2 py-1 rounded-full border border-pink-300 text-pink-600">Đặt mặc định</button>`}
                    <button onclick="deleteAddress(${addr.id})" class="text-xs px-2 py-1 rounded-full border border-red-200 text-red-500">Xóa</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderApplicationStatus(statusData) {
    const box = $('application-status-box');
    if (!box) return;
    const vendor = statusData?.vendor_application;
    const shipper = statusData?.shipper_application;
    const roles = statusData?.roles?.length ? statusData.roles.join(' + ') : (statusData?.role || App.currentUser?.role || 'CUSTOMER');
    const quickActions = `
        <div class="pt-3 mt-3 border-t border-pink-100 flex flex-wrap gap-2">
            ${statusData?.can_vendor ? '<button onclick="showVendorApply()" class="px-3 py-1.5 rounded-lg bg-pink-50 text-pink-700 border border-pink-200 text-xs font-semibold">Quản lý gian hàng</button>' : ''}
            ${statusData?.can_shipper ? '<button onclick="showShipperApply()" class="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">Dashboard vận chuyển</button>' : ''}
        </div>
    `;
    box.innerHTML = `
        <div class="text-sm text-gray-700 space-y-2">
            <p><b>Vai trò hiện tại:</b> ${roles}</p>
            <p><b>Đơn Người bán:</b> ${vendor ? vendor.status : 'Chưa nộp'}</p>
            <p><b>Đơn Đơn vị vận chuyển:</b> ${shipper ? shipper.status : 'Chưa nộp'}</p>
            <p><b>Cửa hàng:</b> ${statusData?.store?.name || 'Chưa tạo'} ${statusData?.store ? (statusData.store.is_active ? '(Hoạt động)' : '(Chờ duyệt)') : ''}</p>
            ${quickActions}
        </div>
    `;
}

export async function loadAccountWorkspace() {
    if (!App.isLoggedIn || !App.currentUser?.email) return;
    try {
        const userEmail = encodeURIComponent(App.currentUser.email);
        const [profileData, addrData, appData, wishlistData] = await Promise.all([
            fetchApiJson(`${API_BASE_URL}/api/profile/?email=${userEmail}`),
            fetchApiJson(`${API_BASE_URL}/api/addresses/?email=${userEmail}`),
            fetchApiJson(`${API_BASE_URL}/api/apply/status/?email=${userEmail}`),
            fetchApiJson(`${API_BASE_URL}/api/wishlist/?email=${userEmail}`),
        ]);

        if (profileData.success) {
            const u = profileData.user;
            App.currentUser.name = u.full_name || App.currentUser.name;
            App.currentUser.intellishop_coin = u.intellishop_coin || 0;
            App.currentUser.role = App.currentUser.role || 'CUSTOMER';

            if ($('acc-name')) $('acc-name').value = u.full_name || '';
            if ($('acc-email')) $('acc-email').value = u.email || '';
            if ($('acc-phone')) $('acc-phone').value = u.phone_number || '';
            if ($('acc-gender')) $('acc-gender').value = u.gender || 'other';
            if ($('acc-birth-date')) $('acc-birth-date').value = u.birth_date || '';
            if ($('coin-balance')) $('coin-balance').innerText = `${u.intellishop_coin || 0} xu`;
        }

        if (addrData.success) {
            App.addresses = addrData.addresses || [];
            renderAddresses();
        }

        if (appData.success) {
            App.currentUser.role = appData.role || App.currentUser.role;
            App.currentUser.can_vendor = !!appData.can_vendor;
            App.currentUser.can_shipper = !!appData.can_shipper;
            renderApplicationStatus(appData);
            updateAuthUI();
        }

        if (wishlistData.success) {
            App.wishlist = wishlistData.wishlist || [];
            renderWishlistSection();
        }
    } catch (_error) {
        showNotification('Không tải được thông tin tài khoản.', 'error');
    }
}

function renderWishlistSection() {
    const container = $('acc-wishlist-list');
    if (!container) return;
    if (!App.wishlist || App.wishlist.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 italic py-2">Chưa có sản phẩm yêu thích nào.</p>';
        return;
    }
    container.innerHTML = App.wishlist.map(item => `
        <div class="flex items-center justify-between bg-white/70 border border-pink-100 rounded-xl p-3 hover:shadow-sm transition">
            <div class="flex items-center gap-3 min-w-0">
                ${item.image
                    ? `<img src="${item.image}" alt="${item.product_name}" class="w-12 h-12 object-cover rounded-lg shrink-0 border border-pink-100">`
                    : `<div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center shrink-0 border border-pink-100"><i class="fa-solid fa-image text-gray-300"></i></div>`}
                <div class="min-w-0">
                    <p class="font-semibold text-gray-800 text-sm line-clamp-1">${item.product_name}</p>
                    <p class="text-pink-600 font-bold text-sm">${formatVND(item.price)}</p>
                </div>
            </div>
            <div class="flex gap-2 shrink-0 ml-2">
                <button onclick="addToCart(${item.product_id})" class="text-xs px-2 py-1.5 rounded-lg bg-pink-50 text-pink-600 border border-pink-200 hover:bg-pink-600 hover:text-white transition font-semibold">
                    <i class="fa-solid fa-cart-plus mr-1"></i>Giỏ
                </button>
                <button onclick="toggleWishlist(${item.product_id})" class="text-xs px-2 py-1.5 rounded-lg bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition">
                    <i class="fa-solid fa-trash text-xs"></i>
                </button>
            </div>
        </div>
    `).join('');
}

export async function toggleWishlist(productId) {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để thêm vào yêu thích!', 'error');
        showLogin();
        return;
    }
    const existingItem = App.wishlist.find(w => w.product_id === productId);
    try {
        if (existingItem) {
            const data = await fetchApiJson(`${API_BASE_URL}/api/wishlist/${existingItem.id}/`, { method: 'DELETE' });
            if (data.success) {
                App.wishlist = App.wishlist.filter(w => w.id !== existingItem.id);
                _updateWishlistButtons(productId, false);
                renderWishlistSection();
                showNotification('Đã xóa khỏi danh sách yêu thích.');
            }
        } else {
            const data = await fetchApiJson(`${API_BASE_URL}/api/wishlist/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: App.currentUser.email, product_id: productId }),
            });
            if (data.success) {
                // Reload full wishlist to get image/price data
                const wData = await fetchApiJson(`${API_BASE_URL}/api/wishlist/?email=${encodeURIComponent(App.currentUser.email)}`);
                if (wData.success) App.wishlist = wData.wishlist || [];
                _updateWishlistButtons(productId, true);
                renderWishlistSection();
                showNotification('Đã thêm vào danh sách yêu thích! ❤️');
            }
        }
    } catch (_error) {
        showNotification('Không thể cập nhật yêu thích.', 'error');
    }
}

function _updateWishlistButtons(productId, isWishlisted) {
    document.querySelectorAll(`[data-wishlist-id="${productId}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isWishlisted) {
            btn.classList.add('text-red-500');
            btn.classList.remove('text-gray-400');
            if (icon) { icon.className = icon.className.replace('fa-regular', 'fa-solid'); }
        } else {
            btn.classList.remove('text-red-500');
            btn.classList.add('text-gray-400');
            if (icon) { icon.className = icon.className.replace('fa-solid', 'fa-regular'); }
        }
    });
}

export async function saveProfile() {
    if (!App.currentUser?.email) return;
    try {
        const payload = {
            email: App.currentUser.email,
            full_name: $('acc-name')?.value || '',
            phone_number: $('acc-phone')?.value || '',
            gender: $('acc-gender')?.value || 'other',
            birth_date: $('acc-birth-date')?.value || null,
        };
        const data = await fetchApiJson(`${API_BASE_URL}/api/profile/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        App.currentUser.name = data.user?.full_name || App.currentUser.name;
        updateAuthUI();
        showNotification('Đã lưu hồ sơ.');
    } catch (error) {
        showNotification(error.message || 'Không thể lưu hồ sơ.', 'error');
    }
}

export async function createAddress() {
    if (!App.currentUser?.email) return;
    try {
        const payload = {
            email: App.currentUser.email,
            receiver_name: $('addr-receiver-name')?.value || App.currentUser.name || 'Khách hàng',
            receiver_phone: $('addr-receiver-phone')?.value || $('acc-phone')?.value || '',
            full_address: $('addr-full-address')?.value || '',
            is_default: Boolean($('addr-is-default')?.checked),
        };
        if (!payload.full_address.trim()) {
            showNotification('Vui lòng nhập địa chỉ.', 'error');
            return;
        }
        const data = await fetchApiJson(`${API_BASE_URL}/api/addresses/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        $('addr-full-address').value = '';
        if ($('addr-is-default')) $('addr-is-default').checked = false;
        await loadAccountWorkspace();
        showNotification('Đã thêm địa chỉ.');
    } catch (error) {
        showNotification(error.message || 'Không thể thêm địa chỉ.', 'error');
    }
}

export async function setDefaultAddress(addressId) {
    const address = (App.addresses || []).find(a => a.id === addressId);
    if (!address) return;
    try {
        await fetchApiJson(`${API_BASE_URL}/api/addresses/${addressId}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...address, is_default: true }),
        });
        await loadAccountWorkspace();
    } catch (error) {
        showNotification(error.message || 'Không thể đặt địa chỉ mặc định.', 'error');
    }
}

export async function deleteAddress(addressId) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/addresses/${addressId}/`, { method: 'DELETE' });
        await loadAccountWorkspace();
    } catch (error) {
        showNotification(error.message || 'Không thể xóa địa chỉ.', 'error');
    }
}

export async function submitVendorApplication(event) {
    event.preventDefault();
    if (!App.currentUser?.email) return;
    if (App.currentUser?.can_vendor) {
        showNotification('Bạn đã có quyền Người bán. Vui lòng vào Quản lý gian hàng.', 'success');
        return;
    }
    try {
        const addrData = typeof window.getVendorApplyAddressData === 'function'
            ? window.getVendorApplyAddressData()
            : { city: '', full_address: '' };

        const payload = new FormData();
        payload.append('email', App.currentUser.email);
        payload.append('store_name', $('vendor-store-name')?.value || '');
        payload.append('business_category', $('vendor-business-category')?.value || '');
        payload.append('business_phone', $('vendor-business-phone')?.value || '');
        payload.append('store_address', addrData.full_address || '');
        payload.append('city', addrData.city || '');
        payload.append('description', $('vendor-description')?.value || '');
        const licenseFile = $('vendor-business-license')?.files?.[0];
        if (licenseFile) payload.append('business_license', licenseFile);

        const data = await fetchApiJson(`${API_BASE_URL}/api/apply/vendor/`, {
            method: 'POST',
            body: payload,
        });
        showNotification('Đã gửi đơn Người bán. Cửa hàng ở trạng thái chờ duyệt.', 'success');
        $('vendor-apply-form')?.reset();
        await loadAccountWorkspace();
    } catch (error) {
        showNotification(error.message || 'Không thể gửi đơn.', 'error');
    }
}

export async function submitShipperApplication(event) {
    event.preventDefault();
    if (!App.currentUser?.email) return;
    if (App.currentUser?.can_shipper) {
        showNotification('Bạn đã có quyền Đơn vị vận chuyển.', 'success');
        return;
    }
    try {
        const payload = new FormData();
        payload.append('email', App.currentUser.email);
        payload.append('company_name', $('shipper-apply-company-name')?.value || '');
        payload.append('vehicle_type', $('shipper-service-type')?.value || 'Giao hang tieu chuan');
        payload.append('service_area', $('shipper-service-area')?.value || 'Toan quoc');
        payload.append('description', $('shipper-description')?.value || '');
        payload.append('representative_name', $('shipper-representative-name')?.value || '');
        payload.append('contact_email', $('shipper-contact-email')?.value || App.currentUser.email || '');
        payload.append('phone_number', $('shipper-phone-number')?.value || '');
        payload.append('company_address', $('shipper-company-address')?.value || '');
        payload.append('service_type', $('shipper-service-type')?.value || '');
        const licenseFile = $('shipper-business-license')?.files?.[0];
        if (licenseFile) payload.append('business_license', licenseFile);

        const data = await fetchApiJson(`${API_BASE_URL}/api/apply/shipper/`, {
            method: 'POST',
            body: payload,
        });
        showNotification('Đã gửi đơn Đơn vị vận chuyển, chờ duyệt.');
        $('shipper-apply-form')?.reset();
        await loadAccountWorkspace();
    } catch (error) {
        showNotification(error.message || 'Không thể gửi đơn.', 'error');
    }
}

// ==============================================================================
// XỬ LÝ SOCIAL LOGIN (GỘP TÀI KHOẢN & BỔ SUNG THÔNG TIN)
// ==============================================================================

// Giải mã Token của Google
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const jsonPayload = decodeURIComponent(atob(padded).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

// Chuyển sang trạng thái hoàn tất đăng ký Google trên chính form đăng ký cũ.
function showCompleteRegistration(email, name, tempToken, intent = 'register') {
    activateGoogleRegisterMode(email, name, tempToken, intent);
}

function bindGoogleIntentOnMount(mountId, intent) {
    const mount = document.getElementById(mountId);
    if (!mount || mount.dataset.intentBound === '1') return;
    mount.dataset.intentBound = '1';
    mount.addEventListener('click', () => {
        window.__googleAuthIntent = intent;
    });
}

function canUseGoogleIdentity() {
    return !!(window.google && window.google.accounts && window.google.accounts.id);
}

function renderGoogleButton(mountId, text, width, intent) {
    const mount = document.getElementById(mountId);
    if (!mount) return;
    mount.dataset.googleIntent = intent;
    mount.innerHTML = '';
    window.google.accounts.id.renderButton(mount, {
        theme: 'outline',
        size: 'large',
        text,
        shape: 'pill',
        width,
        click_listener: () => {
            window.__googleAuthIntent = intent;
        },
    });
    bindGoogleIntentOnMount(mountId, intent);
}

function tryInitGoogleButtons() {
    if (googleButtonsInitialized) return;

    if (!GOOGLE_CLIENT_ID) {
        console.error('[Google Auth] Missing GOOGLE_CLIENT_ID. Set window.__INTELLISHOP_GOOGLE_CLIENT_ID or <meta name="google-client-id" ...>.');
        return;
    }

    if (!canUseGoogleIdentity()) {
        googleInitAttempt += 1;
        if (googleInitAttempt <= GOOGLE_INIT_MAX_RETRIES) {
            setTimeout(tryInitGoogleButtons, GOOGLE_INIT_RETRY_DELAY_MS);
        }
        return;
    }

    try {
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: window.handleGoogleCallback,
        });
    } catch (error) {
        console.error('[Google Auth] initialize() failed', {
            origin: window.location.origin,
            clientId: GOOGLE_CLIENT_ID,
            error,
        });
        showNotification('Google Sign-In lỗi cấu hình origin/client ID. Vui lòng kiểm tra Google Cloud Console.', 'error');
        return;
    }

    console.info('[Google Auth] Initialized', { origin: window.location.origin, clientId: GOOGLE_CLIENT_ID });

    renderGoogleButton('google-login-btn', 'signin_with', 320, 'login');
    renderGoogleButton('google-register-btn', 'signup_with', 320, 'register');
    googleButtonsInitialized = true;
}

export function initGoogleAuthButtons() {
    googleInitAttempt = 0;
    tryInitGoogleButtons();
}

function resolveGoogleAuthIntent() {
    const explicitIntent = String(window.__googleAuthIntent || '').toLowerCase();
    if (explicitIntent === 'register' || explicitIntent === 'login') return explicitIntent;

    const activeView = document.querySelector('section[id^="view-"]:not(.hide)');
    const activeId = activeView?.id || '';
    if (activeId === 'view-register') return 'register';
    if (activeId === 'view-login') return 'login';
    return 'login';
}

// Gửi thông tin Google cho Backend kiểm tra
async function processSocialPayload(payload) {
    try {
        const data = await fetchApiJson(`${API_BASE_URL}/api/social-check/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, { attachAuth: false, retryGet: 0 });

        if (data.action === 'login') {
            // Backend báo đã có tài khoản -> Đăng nhập ngay
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            App.currentUser = {
                email: data.user?.email || payload.email,
                name: data.user?.name || payload.name || '',
                role: data.user?.role || 'CUSTOMER'
            };
            localStorage.setItem('current_user_email', App.currentUser.email || '');
            App.isLoggedIn = true;
            clearChatHistoryAfterAuthSuccess();
            updateAuthUI();
            await loadAccountWorkspace();
            showNotification(data.message || 'Đăng nhập với Google thành công!');
            setTimeout(showHome, 300);
            return;
        } else if (data.action === 'requires_info') {
            // Backend báo User mới -> Yêu cầu nhập thêm thông tin hồ sơ
            const warningMessage = payload.auth_intent === 'login'
                ? 'Email chưa được đăng kí. Chuyển sang đăng ký bằng Google.'
                : 'Vui lòng bổ sung SĐT và mật khẩu để hoàn tất đăng ký.';
            showNotification(data.message || warningMessage, 'error');
            showCompleteRegistration(data.email, data.name, data.temp_token, payload.auth_intent);
            return;
        }

        showNotification(data.message || 'Không xử lý được phản hồi đăng nhập Google.', 'error');
    } catch (error) {
        showNotification(error.message || 'Lỗi xử lý đăng nhập Google!', 'error');
    }
}

window.handleGoogleCallback = async (response) => {
    if (!response.credential) return;
    const decoded = decodeJWT(response.credential);
    if (!decoded?.email) return showNotification("Lỗi lấy email từ Google", "error");

    const authIntent = resolveGoogleAuthIntent();

    await processSocialPayload({
        provider: 'google',
        uid: decoded.sub,
        email: decoded.email,
        name: decoded.name,
        auth_intent: authIntent
    });

    window.__googleAuthIntent = '';
};

