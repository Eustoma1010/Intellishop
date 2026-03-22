import { API_BASE_URL, App, $, formatVND } from './config.js';
import { showNotification, showLogin, hideAllViews } from './ui.js';

let checkoutUiBound = false;
let isApplyingSavedAddress = false;

function triggerAvatarAction(action, duration = null) {
    if (typeof window.setAvatarAction === 'function') {
        window.setAvatarAction(action, duration);
    }
}

function findProductById(productId) {
    const numericId = Number(productId);
    const storeIds = Object.keys(App.storeProducts || {});
    for (let i = 0; i < storeIds.length; i += 1) {
        const product = (App.storeProducts[storeIds[i]] || []).find((item) => Number(item.id) === numericId);
        if (product) return product;
    }
    return null;
}

function getSelectedShippingProvider() {
    const providers = Array.isArray(App.shippingProviders) ? App.shippingProviders : [];
    if (!providers.length) return null;
    return providers.find((provider) => provider.code === App.selectedShipping) || providers[0];
}

function getSelectedShippingFee() {
    return Number(getSelectedShippingProvider()?.fee || 0);
}

function getInsuranceFee() {
    return $('fashion-insurance')?.checked ? 15000 : 0;
}

function splitFullName(fullName = '') {
    const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return { firstName: '', lastName: '' };
    return {
        firstName: parts.slice(0, -1).join(' ') || parts[0],
        lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    };
}

function splitAddressParts(fullAddress = '') {
    const parts = String(fullAddress).split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
        return {
            address: parts.slice(0, -2).join(', '),
            district: parts[parts.length - 2],
            city: parts[parts.length - 1],
        };
    }
    if (parts.length === 2) {
        return {
            address: parts[0],
            district: '',
            city: parts[1],
        };
    }
    return {
        address: fullAddress || '',
        district: '',
        city: '',
    };
}

function applyCheckoutAddress(addressObj) {
    if (!addressObj) return;
    isApplyingSavedAddress = true;
    App.selectedAddressId = addressObj.id || null;
    const { firstName, lastName } = splitFullName(addressObj.receiver_name || '');
    const parsedAddress = splitAddressParts(addressObj.full_address || '');
    if ($('first-name')) $('first-name').value = firstName;
    if ($('last-name')) $('last-name').value = lastName;
    if ($('phone')) $('phone').value = addressObj.receiver_phone || $('phone')?.value || '';
    if ($('address')) $('address').value = parsedAddress.address || addressObj.full_address || '';
    if ($('district')) $('district').value = parsedAddress.district || '';
    if ($('city')) $('city').value = parsedAddress.city || '';
    if ($('checkout-address-select')) $('checkout-address-select').value = String(addressObj.id || '');
    isApplyingSavedAddress = false;
}

function populateCheckoutAddressOptions() {
    const selectEl = $('checkout-address-select');
    if (!selectEl) return;
    const options = ['<option value="">Nhập địa chỉ thủ công</option>'];
    (App.addresses || []).forEach((addr) => {
        options.push(`<option value="${addr.id}">${addr.receiver_name} • ${addr.receiver_phone} • ${addr.full_address}${addr.is_default ? ' (Mặc định)' : ''}</option>`);
    });
    selectEl.innerHTML = options.join('');
    if (App.selectedAddressId) {
        selectEl.value = String(App.selectedAddressId);
    }
}

function clearCheckoutAddressSelection() {
    App.selectedAddressId = null;
    if ($('checkout-address-select')) $('checkout-address-select').value = '';
    if ($('address')) $('address').value = '';
    if ($('district')) $('district').value = '';
    if ($('city')) $('city').value = '';
}

function updateCartShippingProviderLabel() {
    const provider = getSelectedShippingProvider();
    if ($('cart-shipping-provider')) {
        $('cart-shipping-provider').innerText = provider
            ? `${provider.company_name} • ${provider.service_label || 'Vận chuyển'}`
            : 'Chưa chọn';
    }
}

function computeCheckoutAmounts() {
    const subtotal = App.cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 0), 0);
    const shippingFee = getSelectedShippingFee();
    const shopVoucherDiscount = Math.max(0, Number($('shop-voucher-discount')?.value || 0));
    const intellishopVoucherDiscount = Math.max(0, Number($('intelishop-voucher-discount')?.value || 0));
    const coinUsed = Math.max(0, Number($('coin-used')?.value || 0));
    const insuranceFee = getInsuranceFee();
    const total = Math.max(0, subtotal - shopVoucherDiscount - intellishopVoucherDiscount - coinUsed + shippingFee + insuranceFee);
    return {
        subtotal,
        shippingFee,
        shopVoucherDiscount,
        intellishopVoucherDiscount,
        coinUsed,
        insuranceFee,
        total,
    };
}

function getStockState(product) {
    const stock = Number(product?.stock || 0);
    const isInStock = Boolean(product && product.in_stock !== false && product.status !== 'out_of_stock' && stock > 0);
    return {
        stock,
        isInStock,
    };
}

function syncCartInventory(showWarnings = false) {
    const nextCart = [];
    let changed = false;

    App.cart.forEach((item) => {
        const latest = findProductById(item.id);
        if (!latest) {
            changed = true;
            if (showWarnings) showNotification(`Sản phẩm ${item.name} không còn khả dụng.`, 'error');
            return;
        }

        const { stock, isInStock } = getStockState(latest);
        if (!isInStock) {
            changed = true;
            if (showWarnings) showNotification(`${latest.name} hiện đã hết hàng.`, 'error');
            return;
        }

        const qty = Math.min(Number(item.qty) || 1, stock);
        if (qty !== item.qty) {
            changed = true;
            if (showWarnings) showNotification(`${latest.name} chỉ còn ${stock} sản phẩm trong kho.`, 'error');
        }

        nextCart.push({ ...latest, qty });
    });

    if (changed) {
        App.cart = nextCart;
        updateCartCount();
    }
    return changed;
}

function bindCheckoutUI() {
    if (checkoutUiBound) return;
    ['shop-voucher-discount', 'intelishop-voucher-discount', 'coin-used', 'fashion-insurance'].forEach((id) => {
        const el = $(id);
        if (!el) return;
        const eventName = el.type === 'checkbox' ? 'change' : 'input';
        el.addEventListener(eventName, () => {
            updateCheckoutSummary();
            updateOrderConfirmation();
        });
    });

    $('checkout-address-select')?.addEventListener('change', (event) => {
        const addressId = Number(event.target.value || 0);
        if (!addressId) {
            App.selectedAddressId = null;
            return;
        }
        const selectedAddress = (App.addresses || []).find((addr) => Number(addr.id) === addressId);
        if (selectedAddress) applyCheckoutAddress(selectedAddress);
    });

    $('checkout-clear-address-btn')?.addEventListener('click', () => {
        clearCheckoutAddressSelection();
    });

    ['first-name', 'last-name', 'phone', 'address', 'district', 'city'].forEach((id) => {
        $(id)?.addEventListener('input', () => {
            if (isApplyingSavedAddress || !App.selectedAddressId) return;
            App.selectedAddressId = null;
            if ($('checkout-address-select')) $('checkout-address-select').value = '';
        });
    });

    checkoutUiBound = true;
}

function renderShippingProviders() {
    const container = $('shipping-providers-list');
    if (!container) return;

    const providers = Array.isArray(App.shippingProviders) ? App.shippingProviders : [];
    if (!providers.length) {
        container.innerHTML = '<div class="rounded-2xl border border-dashed border-pink-200 bg-white/70 p-5 text-sm text-gray-500">Hiện chưa có đơn vị vận chuyển khả dụng.</div>';
        return;
    }

    if (!App.selectedShipping || !providers.some((provider) => provider.code === App.selectedShipping)) {
        App.selectedShipping = providers[0].code;
    }

    container.innerHTML = providers.map((provider) => {
        const active = provider.code === App.selectedShipping;
        const initials = (provider.company_name || 'IS').split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
        return `
            <button type="button" onclick="selectShipping('${provider.code}')" class="w-full text-left rounded-2xl border p-4 transition ${active ? 'border-pink-500 bg-pink-50 shadow-md' : 'border-pink-100 bg-white/80 hover:border-pink-300 hover:bg-white'}">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex items-start gap-4">
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 text-white font-bold flex items-center justify-center shadow-sm shrink-0">${initials}</div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h4 class="font-bold text-gray-800">${provider.company_name}</h4>
                                <span class="text-[11px] font-bold px-2 py-1 rounded-full ${active ? 'bg-pink-600 text-white' : 'bg-pink-100 text-pink-700'}">${provider.service_label || 'Vận chuyển'}</span>
                            </div>
                            <p class="text-sm text-gray-500 mt-1">${provider.description || 'Dịch vụ giao hàng của đối tác'}</p>
                            <div class="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                <span><i class="fa-regular fa-clock mr-1"></i>${provider.eta || 'Cập nhật sau'}</span>
                                ${provider.phone_number ? `<span><i class="fa-solid fa-phone mr-1"></i>${provider.phone_number}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <div class="text-lg font-black text-pink-700">${formatVND(provider.fee || 0)}</div>
                        <div class="text-xs text-gray-500">Phí vận chuyển</div>
                    </div>
                </div>
            </button>
        `;
    }).join('');
}

async function prefillCheckoutInfo() {
    if (!App.currentUser?.email) return;
    try {
        const [profileRes, addrRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/profile/?email=${encodeURIComponent(App.currentUser.email)}`),
            fetch(`${API_BASE_URL}/api/addresses/?email=${encodeURIComponent(App.currentUser.email)}`),
        ]);
        const profileData = await profileRes.json();
        const addrData = await addrRes.json();

        if (profileData.success) {
            const user = profileData.user;
            const names = (user.full_name || '').trim().split(/\s+/);
            if ($('first-name')) $('first-name').value = names.slice(0, -1).join(' ') || user.full_name || '';
            if ($('last-name')) $('last-name').value = names.slice(-1).join(' ') || '';
            if ($('email')) $('email').value = user.email || App.currentUser.email;
            if ($('phone')) $('phone').value = user.phone_number || '';
            if ($('coin-used')) $('coin-used').max = String(user.intellishop_coin || 0);
        }

        if (addrData.success) {
            App.addresses = addrData.addresses || [];
            populateCheckoutAddressOptions();
            const defaultAddr = App.addresses.find(a => a.is_default) || App.addresses[0];
            if (defaultAddr) {
                applyCheckoutAddress(defaultAddr);
            }
        }
    } catch (_error) {
        // Keep checkout usable with manual input even if prefill fails.
    }
}

function getSelectedPaymentMethod() {
    const selected = document.querySelector('input[name="payment"]:checked');
    if (!selected) return 'COD';
    return selected.value || 'COD';
}

export function addToCart(productId) {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để thêm vào giỏ hàng!', 'error');
        showLogin();
        return;
    }

    const product = findProductById(productId);

    if (!product) {
        showNotification('Sản phẩm không tồn tại!', 'error');
        return;
    }

    const { stock, isInStock } = getStockState(product);
    if (!isInStock) {
        showNotification('Sản phẩm này hiện đã hết hàng, chưa thể thêm vào giỏ.', 'error');
        triggerAvatarAction('error', 1800);
        return;
    }

    const existing = App.cart.find(item => item.id === productId);
    if (existing) {
        if (existing.qty >= stock) {
            showNotification(`Sản phẩm chỉ còn ${stock} trong kho.`, 'error');
            triggerAvatarAction('error', 1800);
            return;
        }
        existing.qty += 1;
    } else {
        App.cart.push({ ...product, qty: 1 });
    }

    updateCartCount();
    showNotification(`Đã thêm ${product.name} vào giỏ hàng!`);
    triggerAvatarAction('cart_add');
}

export function updateCartCount() {
    const countEl = $('cart-count');
    if (countEl) {
        countEl.innerText = App.cart.reduce((sum, item) => sum + item.qty, 0);
    }
}

export function showCart() {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để xem giỏ hàng!', 'error');
        showLogin();
        return;
    }
    hideAllViews();
    const cartView = $('view-cart');
    if (cartView) cartView.classList.remove('hide');
    renderCart();
}

export function renderCart() {
    const container = $('cart-items');
    if (!container) return;
    syncCartInventory();

    if (App.cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">Giỏ hàng trống</p>';
        if($('cart-subtotal')) $('cart-subtotal').innerText = formatVND(0);
        if($('shipping-fee')) $('shipping-fee').innerText = formatVND(0);
        if($('cart-total')) $('cart-total').innerText = formatVND(0);
        return;
    }

    let subtotal = 0;
    // Dùng mảng lưu trữ HTML sau đó join() để tối ưu bộ nhớ
    const htmlFragments = App.cart.map((item, index) => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        const latestProduct = findProductById(item.id) || item;
        const stock = Number(latestProduct.stock || 0);
        const canIncrease = item.qty < stock;
        return `
            <div class="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-pink-50">
                <div class="flex items-center space-x-4">
                    <div>
                        <h4 class="font-semibold text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-500">${formatVND(item.price)}</p>
                        <p class="text-xs ${stock > 0 ? 'text-emerald-600' : 'text-red-500'} mt-1">Tồn kho: ${stock}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center border border-pink-100 rounded-lg">
                        <button onclick="updateCartQty(${index}, -1)" class="px-3 py-1 hover:bg-pink-50 transition text-pink-600">-</button>
                        <span class="px-3 py-1 font-medium">${item.qty}</span>
                        <button onclick="updateCartQty(${index}, 1)" ${canIncrease ? '' : 'disabled'} class="px-3 py-1 hover:bg-pink-50 transition text-pink-600 disabled:text-gray-300 disabled:cursor-not-allowed">+</button>
                    </div>
                    <span class="font-bold w-20 text-right text-pink-700">${formatVND(itemTotal)}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-600 transition"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>`;
    });

    container.innerHTML = htmlFragments.join('');

    const shipping = getSelectedShippingFee();
    updateCartShippingProviderLabel();
    if($('cart-subtotal')) $('cart-subtotal').innerText = formatVND(subtotal);
    if($('shipping-fee')) $('shipping-fee').innerText = formatVND(shipping);
    if($('cart-total')) $('cart-total').innerText = formatVND(subtotal + shipping);
}

export function updateCartQty(index, change) {
    if (!App.cart[index]) return;
    const latestProduct = findProductById(App.cart[index].id) || App.cart[index];
    const { stock, isInStock } = getStockState(latestProduct);
    if (!isInStock) {
        showNotification(`${latestProduct.name} hiện đã hết hàng.`, 'error');
        App.cart.splice(index, 1);
        updateCartCount();
        renderCart();
        return;
    }

    if (change > 0 && App.cart[index].qty >= stock) {
        showNotification(`Sản phẩm chỉ còn ${stock} trong kho.`, 'error');
        return;
    }

    App.cart[index].qty += change;
    if (App.cart[index].qty <= 0) App.cart.splice(index, 1);
    updateCartCount();
    renderCart();
}

export function removeFromCart(index) {
    if (!App.cart[index]) return;
    App.cart.splice(index, 1);
    updateCartCount();
    renderCart();
}

// --- CHECKOUT FLOW ---
export async function proceedToCheckout() {
    syncCartInventory(true);
    if (App.cart.length === 0) {
        showNotification('Giỏ hàng trống! Vui lòng thêm sản phẩm.', 'error');
        triggerAvatarAction('error', 1800);
        return;
    }
    hideAllViews();
    const checkoutView = $('view-checkout');
    if(checkoutView) checkoutView.classList.remove('hide');
    resetCheckout();
    bindCheckoutUI();
    await prefillCheckoutInfo();
    renderShippingProviders();
    updateCheckoutSummary();
    triggerAvatarAction('checkout');
}

export function resetCheckout() {
    const setClass = (id, action, cls) => { const el = $(id); if(el) el.classList[action](cls); };

    setClass('checkout-step1', 'remove', 'hide');
    setClass('checkout-step2', 'add', 'hide');
    setClass('checkout-step3', 'add', 'hide');

    setClass('step1', 'add', 'active');
    setClass('step2', 'remove', 'active');
    setClass('step3', 'remove', 'active');

    setClass('line1', 'add', 'active');
    setClass('line2', 'remove', 'active');

    if (!App.selectedShipping && Array.isArray(App.shippingProviders) && App.shippingProviders.length > 0) {
        App.selectedShipping = App.shippingProviders[0].code;
    }
}

export function nextStep(step) {
    const setClass = (id, action, cls) => { const el = $(id); if(el) el.classList[action](cls); };

    if (step === 2) {
        const requiredFields = ['first-name', 'last-name', 'phone', 'address'];
        const isValid = requiredFields.every(id => $(id) && $(id).value.trim() !== '');

        if (!isValid) {
            showNotification('Vui lòng điền đầy đủ thông tin giao hàng!', 'error');
            return;
        }
        setClass('checkout-step1', 'add', 'hide');
        setClass('checkout-step2', 'remove', 'hide');
        setClass('step1', 'remove', 'active');
        setClass('step2', 'add', 'active');
        setClass('line1', 'add', 'active');
    } else if (step === 3) {
        if (!getSelectedShippingProvider()) {
            showNotification('Vui lòng chọn đơn vị vận chuyển!', 'error');
            return;
        }
        setClass('checkout-step2', 'add', 'hide');
        setClass('checkout-step3', 'remove', 'hide');
        setClass('step2', 'remove', 'active');
        setClass('step3', 'add', 'active');
        setClass('line2', 'add', 'active');
        updateOrderConfirmation();
    }
}

export function prevStep(step) {
    const setClass = (id, action, cls) => { const el = $(id); if(el) el.classList[action](cls); };

    if (step === 1) {
        setClass('checkout-step2', 'add', 'hide');
        setClass('checkout-step1', 'remove', 'hide');
        setClass('step2', 'remove', 'active');
        setClass('step1', 'add', 'active');
        setClass('line1', 'remove', 'active');
    } else if (step === 2) {
        setClass('checkout-step3', 'add', 'hide');
        setClass('checkout-step2', 'remove', 'hide');
        setClass('step3', 'remove', 'active');
        setClass('step2', 'add', 'active');
        setClass('line2', 'remove', 'active');
    }
}

export function selectShipping(method) {
    App.selectedShipping = method;
    renderShippingProviders();
    updateCartShippingProviderLabel();
    const shipping = getSelectedShippingFee();

    if($('shipping-fee')) $('shipping-fee').innerText = formatVND(shipping);
    if($('checkout-shipping-fee')) $('checkout-shipping-fee').innerText = formatVND(shipping);

    if ($('view-cart') && !$('view-cart').classList.contains('hide')) renderCart();
    else if ($('view-checkout') && !$('view-checkout').classList.contains('hide')) {
        updateCheckoutSummary();
        updateOrderConfirmation();
    }
}

export function updateCheckoutSummary() {
    const summaryContainer = $('checkout-summary-items');
    if (!summaryContainer) return;

    summaryContainer.innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        return `<div class="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-200 last:border-0"><span class="text-gray-600">${item.name} <b class="text-pink-500">x${item.qty}</b></span><span class="font-semibold text-gray-800">${formatVND(itemTotal)}</span></div>`;
    }).join('');

    const amounts = computeCheckoutAmounts();
    const provider = getSelectedShippingProvider();
    if($('checkout-subtotal')) $('checkout-subtotal').innerText = formatVND(amounts.subtotal);
    if($('checkout-shipping-fee')) $('checkout-shipping-fee').innerText = formatVND(amounts.shippingFee);
    if($('checkout-shipping-provider-name')) $('checkout-shipping-provider-name').innerText = provider ? `${provider.company_name} • ${provider.eta || ''}` : 'Chưa chọn';
    if($('checkout-total')) $('checkout-total').innerText = formatVND(amounts.total);
}

export function updateOrderConfirmation() {
    const confirmContainer = $('order-confirmation-items');
    if (!confirmContainer) return;

    confirmContainer.innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        return `<div class="flex justify-between text-sm text-gray-600 mb-2"><span>${item.name} <span class="font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded">x${item.qty}</span></span><span class="font-medium">${formatVND(itemTotal)}</span></div>`;
    }).join('');

    const amounts = computeCheckoutAmounts();
    const provider = getSelectedShippingProvider();
    if($('final-subtotal')) $('final-subtotal').innerText = formatVND(amounts.subtotal);
    if($('final-shop-voucher')) $('final-shop-voucher').innerText = `-${formatVND(amounts.shopVoucherDiscount)}`;
    if($('final-system-voucher')) $('final-system-voucher').innerText = `-${formatVND(amounts.intellishopVoucherDiscount)}`;
    if($('final-coins-used')) $('final-coins-used').innerText = `-${formatVND(amounts.coinUsed)}`;
    if($('final-insurance')) $('final-insurance').innerText = formatVND(amounts.insuranceFee);
    if($('final-shipping-provider-label')) $('final-shipping-provider-label').innerText = provider ? `${provider.company_name} • ${provider.service_label || 'Vận chuyển'}` : 'Chưa chọn';
    if($('final-shipping')) $('final-shipping').innerText = formatVND(amounts.shippingFee);
    if($('final-total')) $('final-total').innerText = formatVND(amounts.total);
}

export async function placeOrder() {
    const btnPlaceOrder = document.querySelector('button[onclick="placeOrder()"]');
    if(btnPlaceOrder) {
        btnPlaceOrder.disabled = true;
        btnPlaceOrder.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xử lý...';
    }

    try {
        syncCartInventory(true);
        if (App.cart.length === 0) {
            showNotification('Giỏ hàng hiện không còn sản phẩm hợp lệ để đặt.', 'error');
            triggerAvatarAction('error', 1800);
            return;
        }

        const selectedProvider = getSelectedShippingProvider();
        if (!selectedProvider) {
            showNotification('Vui lòng chọn đơn vị vận chuyển.', 'error');
            triggerAvatarAction('error', 1800);
            return;
        }

        const shopVoucherDiscount = parseFloat($('shop-voucher-discount')?.value || '0') || 0;
        const intellishopVoucherDiscount = parseFloat($('intelishop-voucher-discount')?.value || '0') || 0;
        const coinUsed = parseInt($('coin-used')?.value || '0', 10) || 0;
        const insuranceChecked = Boolean($('fashion-insurance')?.checked);
        const insuranceFee = insuranceChecked ? 15000 : 0;
        const shippingFee = getSelectedShippingFee();

        const customerInfo = {
            firstName: $('first-name')?.value || '',
            lastName: $('last-name')?.value || '',
            phone: $('phone')?.value || '',
            email: $('email')?.value || '',
            address: $('address')?.value || '',
            city: $('city')?.value || '',
            district: $('district')?.value || '',
            full_name: `${$('first-name')?.value || ''} ${$('last-name')?.value || ''}`.trim()
        };

        const checkoutResponse = await fetch(`${API_BASE_URL}/api/checkout/calculate/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_email: App.currentUser.email,
                items: App.cart,
                shop_voucher_discount: shopVoucherDiscount,
                intellishop_voucher_discount: intellishopVoucherDiscount,
                coin_used: coinUsed,
                shipping_fee: shippingFee,
                insurance_fee: insuranceFee,
                add_fashion_insurance: insuranceChecked,
                shipping_provider_code: selectedProvider.code,
                shipping_provider_name: selectedProvider.company_name,
            })
        });
        const checkoutData = await checkoutResponse.json();
        if (!checkoutData.success) {
            showNotification(checkoutData.message || 'Không thể tính tổng tiền thanh toán.', 'error');
            triggerAvatarAction('error', 2200);
            return;
        }

        const checkout = checkoutData.checkout;
        const total = parseFloat(checkout.total_amount || '0');

        const response = await fetch(`${API_BASE_URL}/api/order/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cart: App.cart,
                customer: customerInfo,
                user_email: App.currentUser.email,
                address_id: App.selectedAddressId || null,
                total,
                payment_method: getSelectedPaymentMethod(),
                note: [
                    $('order-note')?.value || '',
                    `Đơn vị giao hàng ưu tiên: ${selectedProvider.company_name}`,
                ].filter(Boolean).join('\n'),
                shipping_fee: checkout.shipping_fee,
                shop_voucher_discount: checkout.shop_voucher_discount,
                intellishop_voucher_discount: checkout.intellishop_voucher_discount,
                coin_used: checkout.coin_used,
                insurance_fee: checkout.insurance_fee,
                shipping_provider_code: selectedProvider.code,
                shipping_provider_name: selectedProvider.company_name,
            })
        });
        const data = await response.json();

        if (data.success) {
            App.cart = [];
            updateCartCount();
            App.hasActiveOrder = true;
            showNotification("🎉 Đặt hàng thành công!");
            triggerAvatarAction('success');
            showOrders(true);
        } else {
            showNotification("Lỗi khi đặt hàng: " + data.message, 'error');
            triggerAvatarAction('error', 2400);
        }
    } catch (error) {
        showNotification("Không thể kết nối đến máy chủ!", 'error');
        triggerAvatarAction('error', 2400);
    } finally {
        if(btnPlaceOrder) {
            btnPlaceOrder.disabled = false;
            btnPlaceOrder.innerHTML = 'Xác Nhận Đặt Hàng';
        }
    }
}

export async function showOrders(isJustOrdered = false) {
    hideAllViews();
    const ordersView = $('view-orders');
    if(ordersView) ordersView.classList.remove('hide');

    if (!App.isLoggedIn) {
        if($('has-order-container')) $('has-order-container').classList.add('hide');
        if($('no-order-msg')) $('no-order-msg').classList.remove('hide');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/user-orders/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email })
        });
        const data = await response.json();

        if (data.success && data.orders.length > 0) {
            if($('has-order-container')) $('has-order-container').classList.remove('hide');
            if($('no-order-msg')) $('no-order-msg').classList.add('hide');
            if($('order-success-msg')) $('order-success-msg').classList.toggle('hide', !isJustOrdered);

            const listContainer = $('orders-list-container');
            if (listContainer) {
                listContainer.innerHTML = data.orders.map(order => {
                    // Map trạng thái thực tế từ backend
                    let width = '15%',
                        step2Class = 'bg-gray-200 text-gray-400',
                        step2Text = 'text-gray-500',
                        step3Class = 'bg-gray-200 text-gray-400';

                    const status = order.status;
                    const isDelivering = status === 'Đang giao' || status === 'DELIVERING';
                    const isDelivered = status === 'Hoàn thành' || status === 'DELIVERED';
                    const isFailed = status === 'Hủy' || status === 'FAILED';
                    const isReadyForPickup = status === 'READY_FOR_PICKUP';

                    if (isDelivering) {
                        width = '60%';
                        step2Class = 'bg-pink-500 text-white animate-bounce';
                        step2Text = 'text-pink-600';
                    } else if (isReadyForPickup) {
                        width = '40%';
                        step2Class = 'bg-amber-400 text-white';
                        step2Text = 'text-amber-600';
                    } else if (isDelivered) {
                        width = '100%';
                        step2Class = 'bg-pink-500 text-white';
                        step2Text = 'text-pink-600';
                        step3Class = 'bg-blue-500 text-white';
                    } else if (isFailed) {
                        width = '0%';
                        step2Class = 'bg-red-200 text-red-400';
                        step2Text = 'text-red-400';
                    }

                    const statusBadgeColor = isDelivered ? 'bg-green-100 text-green-700'
                        : isFailed ? 'bg-red-100 text-red-600'
                        : isDelivering ? 'bg-blue-100 text-blue-700'
                        : isReadyForPickup ? 'bg-amber-100 text-amber-700'
                        : 'bg-yellow-100 text-yellow-700';

                    const statusText = order.status_label
                        || (status === 'DELIVERING' ? 'Đang giao'
                            : status === 'DELIVERED' ? 'Hoàn thành'
                                : status === 'FAILED' ? 'Hủy'
                                    : status === 'READY_FOR_PICKUP' ? 'Chờ lấy hàng'
                                        : status === 'PENDING' ? 'Chờ duyệt'
                                            : status);

                    const itemsHtml = order.items && order.items.length > 0
                        ? `<div class="mt-4 pt-4 border-t border-pink-50 space-y-1.5">
                            <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"><i class="fa-solid fa-box mr-1 text-pink-400"></i>Sản phẩm đặt mua:</p>
                            ${order.items.map(item => `
                                <div class="flex justify-between items-center text-sm text-gray-600">
                                    <span class="line-clamp-1">${item.product_name} ${item.variant ? `<span class="text-xs text-gray-400">(${item.variant})</span>` : ''} <span class="font-bold text-pink-500">×${item.quantity}</span></span>
                                    <span class="font-semibold text-gray-800 ml-3 shrink-0">${formatVND(item.price)}</span>
                                </div>`).join('')}
                          </div>`
                        : '';

                    return `
                        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100 mb-6 hover:shadow-md transition">
                            <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-pink-100 pb-4 mb-6 gap-3">
                                <div>
                                    <p class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Mã đơn hàng</p>
                                    <p class="text-2xl font-black text-pink-700 tracking-tight">${order.order_code}</p>
                                </div>
                                <div class="text-left md:text-right">
                                    <p class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Ngày đặt</p>
                                    <p class="font-semibold text-gray-800">${order.created_at}</p>
                                    <div class="flex items-center gap-2 mt-1 md:justify-end">
                                        <span class="text-xs px-2 py-0.5 rounded-full font-bold ${statusBadgeColor}">${statusText}</span>
                                        <span class="font-bold text-pink-600">${formatVND(order.total_amount)}</span>
                                    </div>
                                    ${order.shipper_company_name ? `<p class="text-xs text-gray-500 mt-1">Đơn vị vận chuyển: <b>${order.shipper_company_name}</b></p>` : ''}
                                </div>
                            </div>
                            <div class="relative py-4 px-2 sm:px-8">
                                <div class="absolute top-1/2 left-0 sm:left-8 right-0 sm:right-8 h-2 bg-gray-100 rounded-full -translate-y-1/2"></div>
                                <div class="absolute top-1/2 left-0 sm:left-8 h-2 bg-gradient-to-r from-green-400 to-pink-500 rounded-full -translate-y-1/2 transition-all duration-1000" style="width: ${width};"></div>
                                <div class="relative flex justify-between">
                                    <div class="flex flex-col items-center">
                                        <div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-lg sm:text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-check"></i></div>
                                        <span class="mt-2 font-bold text-green-600 text-xs sm:text-sm text-center">Đã xác nhận</span>
                                    </div>
                                    <div class="flex flex-col items-center">
                                        <div class="w-10 h-10 sm:w-12 sm:h-12 ${step2Class} rounded-full flex items-center justify-center text-lg sm:text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-truck"></i></div>
                                        <span class="mt-2 font-bold ${step2Text} text-xs sm:text-sm text-center">Đang giao</span>
                                    </div>
                                    <div class="flex flex-col items-center">
                                        <div class="w-10 h-10 sm:w-12 sm:h-12 ${step3Class} rounded-full flex items-center justify-center text-lg sm:text-xl border-4 border-white z-10"><i class="fa-solid fa-house"></i></div>
                                        <span class="mt-2 font-semibold text-gray-500 text-xs sm:text-sm text-center">Hoàn thành</span>
                                    </div>
                                </div>
                            </div>
                            ${itemsHtml}
                        </div>`;
                }).join('');
            }
        } else {
            if($('has-order-container')) $('has-order-container').classList.add('hide');
            if($('no-order-msg')) $('no-order-msg').classList.remove('hide');
        }
    } catch (error) {
        showNotification("Lỗi tải lịch sử đơn hàng!", 'error');
    }
}