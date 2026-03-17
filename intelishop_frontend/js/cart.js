import { API_BASE_URL, App, $ } from './config.js';
import { showNotification, showLogin, hideAllViews } from './ui.js';

export function addToCart(productId) {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để thêm vào giỏ hàng!');
        showLogin();
        return;
    }

    let product = null;
    for (const store in App.storeProducts) {
        product = App.storeProducts[store].find(p => p.id === productId);
        if (product) break;
    }
    if (!product) return;

    const existing = App.cart.find(item => item.id === productId);
    if (existing) existing.qty += 1;
    else App.cart.push({ ...product, qty: 1 });

    updateCartCount();
    showNotification(`Đã thêm ${product.name} vào giỏ hàng!`);
}

export function updateCartCount() {
    $('cart-count').innerText = App.cart.reduce((sum, item) => sum + item.qty, 0);
}

export function showCart() {
    if (!App.isLoggedIn) {
        showNotification('Vui lòng đăng nhập để xem giỏ hàng!');
        showLogin();
        return;
    }
    hideAllViews();
    $('view-cart').classList.remove('hide');
    renderCart();
}

export function renderCart() {
    const container = $('cart-items');
    if (App.cart.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 py-8">Giỏ hàng trống</p>';
        $('cart-subtotal').innerText = '$0.00';
        $('cart-total').innerText = '$0.00';
        return;
    }

    let subtotal = 0;
    container.innerHTML = App.cart.map((item, index) => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `
            <div class="flex items-center justify-between bg-white/70 p-4 rounded-xl">
                <div class="flex items-center space-x-4">
                    <div>
                        <h4 class="font-semibold">${item.name}</h4>
                        <p class="text-sm text-gray-500">$${item.price.toFixed(2)}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center border rounded-lg">
                        <button onclick="updateCartQty(${index}, -1)" class="px-3 py-1 hover:bg-pink-50">-</button>
                        <span class="px-3 py-1">${item.qty}</span>
                        <button onclick="updateCartQty(${index}, 1)" class="px-3 py-1 hover:bg-pink-50">+</button>
                    </div>
                    <span class="font-bold w-20 text-right">$${itemTotal.toFixed(2)}</span>
                    <button onclick="removeFromCart(${index})" class="text-red-500 hover:text-red-700"><i class="fa-regular fa-trash-can"></i></button>
                </div>
            </div>`;
    }).join('');

    const shipping = App.shippingFees[App.selectedShipping];
    $('cart-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    $('shipping-fee').innerText = `$${shipping.toFixed(2)}`;
    $('cart-total').innerText = `$${(subtotal + shipping).toFixed(2)}`;
}

export function updateCartQty(index, change) {
    App.cart[index].qty += change;
    if (App.cart[index].qty <= 0) App.cart.splice(index, 1);
    updateCartCount();
    renderCart();
}

export function removeFromCart(index) {
    App.cart.splice(index, 1);
    updateCartCount();
    renderCart();
}

// --- CHECKOUT FLOW ---
export function proceedToCheckout() {
    if (App.cart.length === 0) return alert('Giỏ hàng trống! Vui lòng thêm sản phẩm.');
    hideAllViews();
    $('view-checkout').classList.remove('hide');
    resetCheckout();
    updateCheckoutSummary();
}

export function resetCheckout() {
    $('checkout-step1').classList.remove('hide');
    $('checkout-step2').classList.add('hide');
    $('checkout-step3').classList.add('hide');
    $('step1').classList.add('active');
    $('step2').classList.remove('active');
    $('step3').classList.remove('active');
    $('line1').classList.add('active');
    $('line2').classList.remove('active');
}

export function nextStep(step) {
    if (step === 2) {
        if (!$('first-name').value || !$('last-name').value || !$('phone').value || !$('address').value) {
            return alert('Vui lòng điền đầy đủ thông tin giao hàng!');
        }
        $('checkout-step1').classList.add('hide');
        $('checkout-step2').classList.remove('hide');
        $('step1').classList.remove('active');
        $('step2').classList.add('active');
        $('line1').classList.add('active');
    } else if (step === 3) {
        $('checkout-step2').classList.add('hide');
        $('checkout-step3').classList.remove('hide');
        $('step2').classList.remove('active');
        $('step3').classList.add('active');
        $('line2').classList.add('active');
        updateOrderConfirmation();
    }
}

export function prevStep(step) {
    if (step === 1) {
        $('checkout-step2').classList.add('hide');
        $('checkout-step1').classList.remove('hide');
        $('step2').classList.remove('active');
        $('step1').classList.add('active');
        $('line1').classList.remove('active');
    } else if (step === 2) {
        $('checkout-step3').classList.add('hide');
        $('checkout-step2').classList.remove('hide');
        $('step3').classList.remove('active');
        $('step2').classList.add('active');
        $('line2').classList.remove('active');
    }
}

export function selectShipping(method) {
    App.selectedShipping = method;
    const shipping = App.shippingFees[method];
    if($('shipping-fee')) $('shipping-fee').innerText = `$${shipping.toFixed(2)}`;
    if($('checkout-shipping-fee')) $('checkout-shipping-fee').innerText = `$${shipping.toFixed(2)}`;
    if (!$('view-cart').classList.contains('hide')) renderCart();
    else if (!$('view-checkout').classList.contains('hide')) updateCheckoutSummary();
}

export function updateCheckoutSummary() {
    let subtotal = 0;
    $('checkout-summary-items').innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `<div class="flex justify-between items-center text-sm"><span>${item.name} x${item.qty}</span><span class="font-semibold">$${itemTotal.toFixed(2)}</span></div>`;
    }).join('');

    const total = subtotal + App.shippingFees[App.selectedShipping];
    $('checkout-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    if($('checkout-total')) $('checkout-total').innerText = `$${total.toFixed(2)}`;
}

export function updateOrderConfirmation() {
    let subtotal = 0;
    $('order-confirmation-items').innerHTML = App.cart.map(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        return `<div class="flex justify-between text-sm text-gray-600 mb-1"><span>${item.name} <span class="font-bold text-pink-500">x${item.qty}</span></span><span class="font-medium">$${itemTotal.toFixed(2)}</span></div>`;
    }).join('');

    const shipping = App.shippingFees[App.selectedShipping];
    $('final-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    $('final-shipping').innerText = `$${shipping.toFixed(2)}`;
    $('final-total').innerText = `$${(subtotal + shipping).toFixed(2)}`;
}

export async function placeOrder() {
    const customerInfo = {
        firstName: $('first-name').value, lastName: $('last-name').value,
        phone: $('phone').value, email: $('email').value,
        address: $('address').value, city: $('city').value, district: $('district').value
    };

    const subtotal = App.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const total = subtotal + App.shippingFees[App.selectedShipping];

    try {
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
            showNotification("Đặt hàng thành công!");
            showOrders(true);
        } else {
            alert("Lỗi khi đặt hàng: " + data.message);
        }
    } catch (error) {
        console.error("Chi tiết lỗi:", error);
        alert("Không thể kết nối đến máy chủ!");
    }
}

export async function showOrders(isJustOrdered = false) {
    hideAllViews();
    $('view-orders').classList.remove('hide');

    if (!App.isLoggedIn) {
        $('has-order-container').classList.add('hide');
        $('no-order-msg').classList.remove('hide');
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
            $('has-order-container').classList.remove('hide');
            $('no-order-msg').classList.add('hide');
            $('order-success-msg').classList.toggle('hide', !isJustOrdered);

            $('orders-list-container').innerHTML = data.orders.map(order => {
                let width = '15%', step2 = 'bg-gray-200 text-gray-400', step2Text = 'text-gray-500';
                if (order.status === 'Đang đóng gói') { width = '50%'; step2 = 'bg-pink-500 text-white animate-bounce'; step2Text = 'text-pink-600'; }
                if (order.status === 'Hoàn thành') { width = '100%'; step2 = 'bg-pink-500 text-white'; step2Text = 'text-pink-600'; }

                return `
                    <div class="bg-white/80 rounded-3xl p-8 shadow-sm border border-pink-100 mb-6">
                        <div class="flex flex-col md:flex-row justify-between items-center border-b border-pink-200 pb-4 mb-6">
                            <div><p class="text-sm text-gray-500">Mã đơn hàng</p><p class="text-2xl font-bold text-pink-700">${order.order_code}</p></div>
                            <div class="text-right mt-4 md:mt-0"><p class="text-sm text-gray-500">Ngày đặt hàng</p><p class="font-semibold text-gray-800">${order.created_at}</p><p class="font-bold text-pink-600 mt-1">Tổng tiền: $${order.total_amount}</p></div>
                        </div>
                        <div class="relative py-4">
                            <div class="absolute top-1/2 left-0 w-full h-2 bg-gray-200 rounded-full -translate-y-1/2"></div>
                            <div class="absolute top-1/2 left-0 h-2 bg-gradient-to-r from-green-400 to-pink-500 rounded-full -translate-y-1/2 transition-all duration-1000" style="width: ${width};"></div>
                            <div class="relative flex justify-between">
                                <div class="flex flex-col items-center"><div class="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-check"></i></div><span class="mt-3 font-bold text-green-600 text-sm">Đã xác nhận</span></div>
                                <div class="flex flex-col items-center"><div class="w-12 h-12 ${step2} rounded-full flex items-center justify-center text-xl shadow-lg border-4 border-white z-10"><i class="fa-solid fa-box-open"></i></div><span class="mt-3 font-bold ${step2Text} text-sm">Đang đóng gói</span></div>
                                <div class="flex flex-col items-center"><div class="w-12 h-12 ${order.status === 'Hoàn thành' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'} rounded-full flex items-center justify-center text-xl border-4 border-white z-10"><i class="fa-solid fa-house"></i></div><span class="mt-3 font-semibold text-gray-500 text-sm">Hoàn thành</span></div>
                            </div>
                        </div>
                    </div>`;
            }).join('');
        } else {
            $('has-order-container').classList.add('hide');
            $('no-order-msg').classList.remove('hide');
        }
    } catch (error) {
        console.error("Lỗi tải đơn hàng:", error);
    }
}