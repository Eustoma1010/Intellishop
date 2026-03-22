import { API_BASE_URL, App, $ } from './config.js';
import { hideAllViews, showLogin, showNotification } from './ui.js';

const statusClassMap = {
    READY_FOR_PICKUP: 'bg-amber-100 text-amber-700',
    DELIVERING: 'bg-blue-100 text-blue-700',
    DELIVERED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    PENDING: 'bg-gray-100 text-gray-700',
};

const shipperState = {
    loading: false,
    orders: [],
};

async function fetchApiJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || `Yeu cau that bai (${response.status})`);
    }
    return data;
}

function ensureShipperLoggedIn() {
    if (!App.isLoggedIn || !App.currentUser?.email) {
        showNotification('Vui long dang nhap truoc.', 'error');
        showLogin();
        return false;
    }
    if (!App.currentUser?.can_shipper && App.currentUser?.role !== 'SHIPPER') {
        showNotification('Tai khoan chua co quyen van chuyen.', 'error');
        return false;
    }
    return true;
}

function renderShipperStats(stats = {}) {
    if ($('shipper-stat-pending')) $('shipper-stat-pending').innerText = String(stats.pending_delivery || 0);
    if ($('shipper-stat-delivering')) $('shipper-stat-delivering').innerText = String(stats.delivering || 0);
    if ($('shipper-stat-delivered')) $('shipper-stat-delivered').innerText = String(stats.delivered || 0);
    if ($('shipper-stat-failed')) $('shipper-stat-failed').innerText = String(stats.failed || 0);
}

function renderShipperOrdersTable(orders = []) {
    const tbody = $('shipper-orders-table-body');
    if (!tbody) return;
    if (!orders.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-5 text-center text-gray-500">Chua co don hang nao.</td></tr>';
        return;
    }

    tbody.innerHTML = orders.map((order) => {
        const badgeClass = statusClassMap[order.status] || 'bg-gray-100 text-gray-700';

        let actionHtml = `<button onclick="openShipperOrderDetail(${order.id})" class="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Xem</button>`;
        if (order.can_accept) {
            actionHtml = `<button onclick="acceptShipperOrder(${order.id})" class="px-2 py-1 rounded bg-purple-600 text-white text-xs font-semibold">Nhan don</button>`;
        } else if (order.can_mark_delivered || order.can_mark_failed) {
            actionHtml = `
                <button onclick="markShipperOrderDelivered(${order.id})" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Da giao</button>
                <button onclick="markShipperOrderFailed(${order.id})" class="ml-2 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold">That bai</button>
                <button onclick="openShipperOrderDetail(${order.id})" class="ml-2 px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Xem</button>
            `;
        }

        return `
            <tr class="border-b border-pink-50">
                <td class="py-3 px-2 font-semibold">${order.order_code}</td>
                <td class="py-3 px-2">${order.customer_name}</td>
                <td class="py-3 px-2 text-gray-600">${order.shipping_address}</td>
                <td class="py-3 px-2"><span class="px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}">${order.status_label || order.status}</span></td>
                <td class="py-3 px-2">${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

export async function loadShipperDashboard() {
    if (!ensureShipperLoggedIn()) return;
    if (shipperState.loading) return;
    shipperState.loading = true;
    try {
        const email = encodeURIComponent(App.currentUser.email || '');
        const data = await fetchApiJson(`${API_BASE_URL}/api/shipper/dashboard/?email=${email}`);
        shipperState.orders = data.orders || [];
        renderShipperStats(data.stats || {});
        renderShipperOrdersTable(shipperState.orders);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc dashboard shipper.', 'error');
    } finally {
        shipperState.loading = false;
    }
}

export async function showShipperDashboard() {
    if (!ensureShipperLoggedIn()) return;
    hideAllViews();
    const view = $('view-shipper-dashboard');
    if (view) view.classList.remove('hide');
    await loadShipperDashboard();
}

export async function acceptShipperOrder(orderId) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/shipper/orders/${orderId}/accept/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email }),
        });
        showNotification('Da nhan don thanh cong.');
        await loadShipperDashboard();
    } catch (error) {
        showNotification(error.message || 'Khong the nhan don.', 'error');
    }
}

async function updateShipperOrderStatus(orderId, status) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/shipper/orders/${orderId}/status/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email, status }),
        });
        showNotification('Da cap nhat trang thai don hang.');
        await loadShipperDashboard();
    } catch (error) {
        showNotification(error.message || 'Khong the cap nhat trang thai.', 'error');
    }
}

export async function markShipperOrderDelivered(orderId) {
    await updateShipperOrderStatus(orderId, 'DELIVERED');
}

export async function markShipperOrderFailed(orderId) {
    await updateShipperOrderStatus(orderId, 'FAILED');
}

export async function openShipperOrderDetail(orderId) {
    try {
        const email = encodeURIComponent(App.currentUser.email || '');
        const data = await fetchApiJson(`${API_BASE_URL}/api/shipper/orders/${orderId}/detail/?email=${email}`);
        const order = data.order;
        const detailHtml = `
            <p><b>Ma don:</b> ${order.order_code}</p>
            <p><b>Khach hang:</b> ${order.customer_name}</p>
            <p><b>So dien thoai:</b> ${order.customer_phone}</p>
            <p><b>Email:</b> ${order.customer_email}</p>
            <p><b>Dia chi giao:</b> ${order.shipping_address}</p>
            <p><b>Trang thai:</b> ${order.status_label}</p>
            <p><b>Thanh toan:</b> ${order.payment_method}</p>
            <div class="pt-2 border-t border-pink-100 mt-2">
                <p class="font-semibold mb-1">San pham:</p>
                ${(order.items || []).map((item) => `<div>- ${item.product_name} ${item.variant ? `(${item.variant})` : ''} x${item.quantity}</div>`).join('') || '<div>Khong co du lieu.</div>'}
            </div>
        `;
        if ($('shipper-order-detail-content')) $('shipper-order-detail-content').innerHTML = detailHtml;
        $('shipper-order-detail-modal')?.classList.remove('hidden');
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc chi tiet don hang.', 'error');
    }
}

export function closeShipperOrderDetail() {
    $('shipper-order-detail-modal')?.classList.add('hidden');
}

window.showShipperDashboard = showShipperDashboard;
window.loadShipperDashboard = loadShipperDashboard;
window.acceptShipperOrder = acceptShipperOrder;
window.markShipperOrderDelivered = markShipperOrderDelivered;
window.markShipperOrderFailed = markShipperOrderFailed;
window.openShipperOrderDetail = openShipperOrderDetail;
window.closeShipperOrderDetail = closeShipperOrderDetail;

