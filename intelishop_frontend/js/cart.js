import { API_BASE_URL, App, $ } from './config.js';
import { showNotification, showLogin, hideAllViews } from './ui.js';

export function addToCart(productId) {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để thêm vào giỏ hàng!', 'error');
        showLogin();
        return;
    }

    // Tối ưu thuật toán tìm kiếm sản phẩm: Dừng ngay khi tìm thấy
    let product = null;
    const storeIds = Object.keys(App.storeProducts);
    for (let i = 0; i < storeIds.length; i++) {
        product = App.storeProducts[storeIds[i]].find(p => p.id === productId);
        if (product) break;
    }

    if (!product) {
        showNotification('Sản phẩm không tồn tại!', 'error');
        return;
    }

    const existing = App.cart.find(item => item.id === productId);
    if (existing) {
        existing.qty += 1;
    } else {
        App.cart.push({ ...product, qty: 1 });
    }

    updateCartCount();
    showNotification(`Đã thêm ${product.name} vào giỏ hàng!`);
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

    if (App.cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">Giỏ hàng trống</p>';
        if($('cart-subtotal')) $('cart-subtotal').innerText = '$0.00';
        if($('cart-total')) $('cart-total').innerText = '$0.00';
        return;
    }

    let subtotal = 0;
    // Dùng mảng lưu trữ HTML sau đó join() để tối ưu bộ nhớ
    const htmlFragments = App.cart.map((item, index) => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `
            <div class="flex items-center justify-between bg-white p-4 rounded-xl shadow-sm border border-pink-50">
                <div class="flex items-center space-x-4">
                    <div>
                        <h4 class="font-semibold text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-500">$${item.price.toFixed(2)}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center border border-pink-100 rounded-lg">
                        <button onclick="updateCartQty(${index}, -1)" class="px-3 py-1 hover:bg-pink-50 transition text-pink-600">-</button>
                        <span class="px-3 py-1 font-medium">${item.qty}</span>
                        <button onclick="updateCartQty(${index}, 1)" class="px-3 py-1 hover:bg-pink-50 transition text-pink-600">+</button>
                    </div>
                    <span class="font-bold w-20 text-right text-pink-700">$${itemTotal.toFixed(2)}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-600 transition"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>`;
    });

    container.innerHTML = htmlFragments.join('');

    const shipping = App.shippingFees[App.selectedShipping] || 0;
    if($('cart-subtotal')) $('cart-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    if($('shipping-fee')) $('shipping-fee').innerText = `$${shipping.toFixed(2)}`;
    if($('cart-total')) $('cart-total').innerText = `$${(subtotal + shipping).toFixed(2)}`;
}

export function updateCartQty(index, change) {
    if (!App.cart[index]) return;
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
export function proceedToCheckout() {
    if (App.cart.length === 0) {
        showNotification('Giỏ hàng trống! Vui lòng thêm sản phẩm.', 'error');
        return;
    }
    hideAllViews();
    const checkoutView = $('view-checkout');
    if(checkoutView) checkoutView.classList.remove('hide');
    resetCheckout();
    updateCheckoutSummary();
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
    if (!App.shippingFees.hasOwnProperty(method)) return;

    App.selectedShipping = method;
    const shipping = App.shippingFees[method];

    if($('shipping-fee')) $('shipping-fee').innerText = `$${shipping.toFixed(2)}`;
    if($('checkout-shipping-fee')) $('checkout-shipping-fee').innerText = `$${shipping.toFixed(2)}`;

    if ($('view-cart') && !$('view-cart').classList.contains('hide')) renderCart();
    else if ($('view-checkout') && !$('view-checkout').classList.contains('hide')) updateCheckoutSummary();
}

export function updateCheckoutSummary() {
    const summaryContainer = $('checkout-summary-items');
    if (!summaryContainer) return;

    let subtotal = 0;
    summaryContainer.innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `<div class="flex justify-between items-center text-sm py-1 border-b border-dashed border-gray-200 last:border-0"><span class="text-gray-600">${item.name} <b class="text-pink-500">x${item.qty}</b></span><span class="font-semibold text-gray-800">$${itemTotal.toFixed(2)}</span></div>`;
    }).join('');

    const total = subtotal + (App.shippingFees[App.selectedShipping] || 0);
    if($('checkout-subtotal')) $('checkout-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    if($('checkout-total')) $('checkout-total').innerText = `$${total.toFixed(2)}`;
}

export function updateOrderConfirmation() {
    const confirmContainer = $('order-confirmation-items');
    if (!confirmContainer) return;

    let subtotal = 0;
    confirmContainer.innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `<div class="flex justify-between text-sm text-gray-600 mb-2"><span>${item.name} <span class="font-bold text-pink-500 bg-pink-50 px-2 py-0.5 rounded">x${item.qty}</span></span><span class="font-medium">$${itemTotal.toFixed(2)}</span></div>`;
    }).join('');

    const shipping = App.shippingFees[App.selectedShipping] || 0;
    if($('final-subtotal')) $('final-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    if($('final-shipping')) $('final-shipping').innerText = `$${shipping.toFixed(2)}`;
    if($('final-total')) $('final-total').innerText = `$${(subtotal + shipping).toFixed(2)}`;
}

export async function placeOrder() {
    const btnPlaceOrder = document.querySelector('button[onclick="placeOrder()"]');
    if(btnPlaceOrder) {
        btnPlaceOrder.disabled = true;
        btnPlaceOrder.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i> Đang xử lý...';
    }

    try {
        const customerInfo = {
            firstName: $('first-name')?.value || '',
            lastName: $('last-name')?.value || '',
            phone: $('phone')?.value || '',
            email: $('email')?.value || '',
            address: $('address')?.value || '',
            city: $('city')?.value || '',
            district: $('district')?.value || ''
        };

        const subtotal = App.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const total = subtotal + (App.shippingFees[App.selectedShipping] || 0);

        const response = await fetch(`${API_BASE_URL}/api/order/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cart: App.cart, customer: customerInfo, total })
        });
        const data = await response.json();

        if (data.success) {
            App.cart = [];
            updateCartCount();
            App.hasActiveOrder = true;
            showNotification("🎉 Đặt hàng thành công!");
            showOrders(true);
        } else {
            showNotification("Lỗi khi đặt hàng: " + data.message, 'error');
        }
    } catch (error) {
        showNotification("Không thể kết nối đến máy chủ!", 'error');
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
                    let width = '15%', step2 = 'bg-gray-200 text-gray-400', step2Text = 'text-gray-500';
                    if (order.status === 'Đang đóng gói') { width = '50%'; step2 = 'bg-pink-500 text-white animate-bounce'; step2Text = 'text-pink-600'; }
                    if (order.status === 'Hoàn thành') { width = '100%'; step2 = 'bg-pink-500 text-white'; step2Text = 'text-pink-600'; }

                    return `
                        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-pink-100 mb-6 hover:shadow-md transition">
                            <div class="flex flex-col md:flex-row justify-between items-center border-b border-pink-100 pb-4 mb-6">
                                <div>
                                    <p class="text-sm text-gray-500 uppercase tracking-wider">Mã đơn hàng</p>
                                    <p class="text-2xl font-black text-pink-700 tracking-tight">${order.order_code}</p>
                                </div>
                                <div class="text-left md:text-right mt-4 md:mt-0 w-full md:w-auto">
                                    <p class="text-sm text-gray-500">Ngày đặt hàng</p>
                                    <p class="font-semibold text-gray-800">${order.created_at}</p>
                                    <p class="font-bold text-pink-600 mt-1 text-lg">Tổng tiền: $${order.total_amount}</p>
                                </div>
                            </div>
                            <div class="relative py-4 px-2 sm:px-8">
                                <div class="absolute top-1/2 left-0 sm:left-8 right-0 sm:right-8 h-2 bg-gray-100 rounded-full -translate-y-1/2"></div>
                                <div class="absolute top-1/2 left-0 sm:left-8 h-2 bg-gradient-to-r from-green-400 to-pink-500 rounded-full -translate-y-1/2 transition-all duration-1000" style="width: ${width};"></div>
                                <div class="relative flex justify-between">
                                    <div class="flex flex-col items-center"><div class="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-lg sm:text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-check"></i></div><span class="mt-2 font-bold text-green-600 text-xs sm:text-sm text-center">Đã xác nhận</span></div>
                                    <div class="flex flex-col items-center"><div class="w-10 h-10 sm:w-12 sm:h-12 ${step2} rounded-full flex items-center justify-center text-lg sm:text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-box-open"></i></div><span class="mt-2 font-bold ${step2Text} text-xs sm:text-sm text-center">Đang đóng gói</span></div>
                                    <div class="flex flex-col items-center"><div class="w-10 h-10 sm:w-12 sm:h-12 ${order.status === 'Hoàn thành' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'} rounded-full flex items-center justify-center text-lg sm:text-xl border-4 border-white z-10"><i class="fa-solid fa-house"></i></div><span class="mt-2 font-semibold text-gray-500 text-xs sm:text-sm text-center">Hoàn thành</span></div>
                                </div>
                            </div>
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