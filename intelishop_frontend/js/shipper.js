import { API_BASE_URL, App, $, formatVND } from './config.js';
import { requestJson } from './api.js';
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
    uiBound: false,
    filters: {
        query: '',
        status: 'all',
    },
};

async function fetchApiJson(url, options = {}) {
    return requestJson(url, options, {
        retryGet: 1,
        onUnauthorized: () => {
            showNotification('Phiên đăng nhập shipper đã hết hạn. Vui lòng đăng nhập lại.', 'error');
            showLogin();
        },
    });
}

function ensureShipperLoggedIn() {
    if (!App.isLoggedIn || !App.currentUser?.email) {
        showNotification('Vui lòng đăng nhập trước.', 'error');
        showLogin();
        return false;
    }
    if (!App.currentUser?.can_shipper && App.currentUser?.role !== 'SHIPPER') {
        showNotification('Tài khoản chưa có quyền vận chuyển.', 'error');
        return false;
    }
    return true;
}

function renderShipperStats(stats = {}) {
    if ($('shipper-stat-pending')) $('shipper-stat-pending').innerText = String(stats.pending_delivery || 0);
    if ($('shipper-stat-ready')) $('shipper-stat-ready').innerText = String(stats.ready_for_pickup || 0);
    if ($('shipper-stat-assigned')) $('shipper-stat-assigned').innerText = String(stats.assigned_active || 0);
    if ($('shipper-stat-delivering')) $('shipper-stat-delivering').innerText = String(stats.delivering || 0);
    if ($('shipper-stat-delivered')) $('shipper-stat-delivered').innerText = String(stats.delivered || 0);
    if ($('shipper-stat-failed')) $('shipper-stat-failed').innerText = String(stats.failed || 0);
}

function renderShipperProfile(shipper = {}) {
    if ($('shipper-dashboard-company-name')) $('shipper-dashboard-company-name').innerText = shipper.company_name || 'Đơn vị vận chuyển';
    if ($('shipper-dashboard-company-contact')) {
        const contactParts = [shipper.contact_email, shipper.phone_number].filter(Boolean);
        $('shipper-dashboard-company-contact').innerText = contactParts.length
            ? contactParts.join(' • ')
            : 'Chưa cập nhật email hoặc số điện thoại liên hệ.';
    }
}

function getFilteredShipperOrders(orders = []) {
    const query = (shipperState.filters.query || '').trim().toLowerCase();
    const status = shipperState.filters.status || 'all';
    return orders.filter((order) => {
        const matchStatus = status === 'all' || order.status === status;
        const haystack = [
            order.order_code,
            order.customer_name,
            order.shipping_address,
            order.status_label,
            order.store_name,
            order.vendor_name,
            order.shipper_company_name,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        const matchQuery = !query || haystack.includes(query);
        return matchStatus && matchQuery;
    });
}

function renderShipperOrdersTable(orders = []) {
    const tbody = $('shipper-orders-table-body');
    if (!tbody) return;
    const rows = getFilteredShipperOrders(orders);
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-5 text-center text-gray-500">Chưa có đơn hàng nào phù hợp.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((order) => {
        const badgeClass = statusClassMap[order.status] || 'bg-gray-100 text-gray-700';

        let actionHtml = `<button onclick="openShipperOrderDetail(${order.id})" class="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Xem</button>`;
        if (order.can_accept) {
            actionHtml = `
                <button onclick="acceptShipperOrder(${order.id})" class="px-2 py-1 rounded bg-purple-600 text-white text-xs font-semibold">Nhận đơn</button>
                <button onclick="openShipperOrderDetail(${order.id})" class="ml-2 px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Xem</button>
            `;
        } else if (order.can_mark_delivered || order.can_mark_failed) {
            actionHtml = `
                <button onclick="markShipperOrderDelivered(${order.id})" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Đã giao</button>
                <button onclick="markShipperOrderFailed(${order.id})" class="ml-2 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold">Thất bại</button>
                <button onclick="openShipperOrderDetail(${order.id})" class="ml-2 px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Xem</button>
            `;
        }

        return `
            <tr class="border-b border-pink-50">
                <td class="py-3 px-2 font-semibold">${order.order_code}</td>
                <td class="py-3 px-2">
                    <div class="font-semibold text-gray-800">${order.store_name || 'Chưa rõ shop'}</div>
                    <div class="text-xs text-gray-500">${order.vendor_name || 'Chưa có người bán phụ trách'}</div>
                </td>
                <td class="py-3 px-2">
                    <div class="font-medium text-gray-800">${order.customer_name}</div>
                    <div class="text-xs text-gray-500">${order.customer_phone || 'Chưa có SĐT'}</div>
                </td>
                <td class="py-3 px-2 text-gray-600">${order.shipping_address}</td>
                <td class="py-3 px-2 text-gray-700">
                    <div class="font-bold text-pink-700">${formatVND(order.total_amount)}</div>
                    <div class="text-xs text-gray-500">${order.item_count || 0} sản phẩm</div>
                </td>
                <td class="py-3 px-2"><span class="px-2 py-1 rounded-full text-xs font-semibold ${badgeClass}">${order.status_label || order.status}</span></td>
                <td class="py-3 px-2">${actionHtml}</td>
            </tr>
        `;
    }).join('');
}

function bindShipperDashboardUI() {
    if (shipperState.uiBound) return;
    const searchInput = $('shipper-orders-search');
    const statusSelect = $('shipper-orders-status-filter');

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            shipperState.filters.query = event.target.value || '';
            renderShipperOrdersTable(shipperState.orders);
        });
    }
    if (statusSelect) {
        statusSelect.addEventListener('change', (event) => {
            shipperState.filters.status = event.target.value || 'all';
            renderShipperOrdersTable(shipperState.orders);
        });
    }
    shipperState.uiBound = true;
}

export async function loadShipperDashboard() {
    if (!ensureShipperLoggedIn()) return;
    if (shipperState.loading) return;
    shipperState.loading = true;
    try {
        const email = encodeURIComponent(App.currentUser.email || '');
        const data = await fetchApiJson(`${API_BASE_URL}/api/shipper/dashboard/?email=${email}`);
        shipperState.orders = data.orders || [];
        renderShipperProfile(data.shipper || {});
        renderShipperStats(data.stats || {});
        renderShipperOrdersTable(shipperState.orders);
    } catch (error) {
        showNotification(error.message || 'Không tải được dashboard shipper.', 'error');
    } finally {
        shipperState.loading = false;
    }
}

export async function showShipperDashboard() {
    if (!ensureShipperLoggedIn()) return;
    bindShipperDashboardUI();
    hideAllViews();
    const view = $('view-shipper-dashboard');
    if (view) view.classList.remove('hide');
    if ($('shipper-orders-search')) $('shipper-orders-search').value = shipperState.filters.query || '';
    if ($('shipper-orders-status-filter')) $('shipper-orders-status-filter').value = shipperState.filters.status || 'all';
    await loadShipperDashboard();
}

export async function acceptShipperOrder(orderId) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/shipper/orders/${orderId}/accept/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email }),
        });
        showNotification('Đã nhận đơn thành công.');
        await loadShipperDashboard();
    } catch (error) {
        showNotification(error.message || 'Không thể nhận đơn.', 'error');
    }
}

async function updateShipperOrderStatus(orderId, status) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/shipper/orders/${orderId}/status/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email, status }),
        });
        showNotification('Đã cập nhật trạng thái đơn hàng.');
        await loadShipperDashboard();
    } catch (error) {
        showNotification(error.message || 'Không thể cập nhật trạng thái.', 'error');
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <p><b>Mã đơn:</b> ${order.order_code}</p>
                <p><b>Trạng thái:</b> ${order.status_label}</p>
                <p><b>Khách hàng:</b> ${order.customer_name}</p>
                <p><b>Số điện thoại:</b> ${order.customer_phone}</p>
                <p><b>Email:</b> ${order.customer_email}</p>
                <p><b>Thanh toán:</b> ${order.payment_method}</p>
                <p><b>Shop:</b> ${(order.store_names || []).join(', ') || 'Chưa rõ'}</p>
                <p><b>Người bán phụ trách:</b> ${order.vendor_name || 'Chưa có'}</p>
                <p><b>Đơn vị giao:</b> ${order.shipper_company_name || 'Chưa nhận đơn'}</p>
                <p><b>Tổng tiền:</b> ${formatVND(order.total_amount)}</p>
            </div>
            <div class="pt-3 mt-3 border-t border-pink-100 space-y-2">
                <p><b>Địa chỉ giao:</b> ${order.shipping_address}</p>
                ${order.note ? `<p><b>Ghi chú:</b> ${order.note}</p>` : ''}
            </div>
            <div class="pt-3 border-t border-pink-100 mt-3">
                <p class="font-semibold mb-2">Sản phẩm:</p>
                ${(order.items || []).map((item) => `
                    <div class="flex items-center justify-between gap-3 py-2 border-b border-pink-50 last:border-0">
                        <div>
                            <div class="font-medium text-gray-800">${item.product_name}</div>
                            <div class="text-xs text-gray-500">${item.variant ? `${item.variant} • ` : ''}SL: ${item.quantity}</div>
                        </div>
                        <div class="font-semibold text-pink-700">${formatVND(item.price)}</div>
                    </div>
                `).join('') || '<div>Không có dữ liệu.</div>'}
            </div>
        `;
        if ($('shipper-order-detail-content')) $('shipper-order-detail-content').innerHTML = detailHtml;
        $('shipper-order-detail-modal')?.classList.remove('hidden');
    } catch (error) {
        showNotification(error.message || 'Không tải được chi tiết đơn hàng.', 'error');
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

