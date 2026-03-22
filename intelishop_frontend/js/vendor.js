import { API_BASE_URL, App, $ } from './config.js';
import { hideAllViews, showLogin, showNotification } from './ui.js';

const formatVND = (value) => `${Math.round(Number(value) || 0).toLocaleString('en-US')}₫`;

function ensureVendorLoggedIn() {
    if (!App.isLoggedIn || !App.currentUser?.email) {
        showNotification('Vui lòng đăng nhập trước.', 'error');
        showLogin();
        return false;
    }
    if (App.currentUser.role !== 'VENDOR') {
        showNotification('Tài khoản chưa là Người bán.', 'error');
        return false;
    }
    return true;
}

function getStatusLabel(status) {
    const map = {
        in_stock: 'Con hang',
        out_of_stock: 'Het hang',
        hidden: 'Bi an',
        upcoming: 'Sap dien ra',
        running: 'Dang chay',
        ended: 'Da ket thuc',
    };
    return map[status] || status;
}

export async function showVendorCenter(tab = 'products') {
    if (!ensureVendorLoggedIn()) return;
    hideAllViews();
    const view = $('view-vendor-center');
    if (view) view.classList.remove('hide');
    App.vendor.activeTab = tab;
    await loadVendorStore();
    await loadVendorTab(tab);
}

export async function loadVendorStore() {
    const email = encodeURIComponent(App.currentUser.email || '');
    const response = await fetch(`${API_BASE_URL}/api/vendor/store/?email=${email}`);
    const data = await response.json();
    if (!data.success) {
        throw new Error(data.message || 'Không tải được thông tin cửa hàng.');
    }
    App.vendor.store = data.store;

    if ($('vendor-center-store-name')) $('vendor-center-store-name').innerText = data.store?.name || 'Cua hang';
    if ($('vendor-center-store-meta')) {
        const stateText = data.store?.is_active ? 'Dang hoat dong' : 'Cho duyet';
        $('vendor-center-store-meta').innerText = `${data.store?.business_category || 'Nganh hang'} | ${stateText}`;
    }
    if ($('vendor-center-pending-banner')) {
        $('vendor-center-pending-banner').classList.toggle('hidden', !data.is_pending_approval);
    }
}

export async function loadVendorTab(tab) {
    App.vendor.activeTab = tab;
    ['products', 'vouchers', 'report'].forEach((key) => {
        const pane = $(`vendor-tab-${key}`);
        if (pane) pane.classList.toggle('hidden', key !== tab);
        const btn = $(`btn-vendor-tab-${key}`);
        if (btn) {
            btn.classList.toggle('bg-gradient-to-r', key === tab);
            btn.classList.toggle('from-pink-600', key === tab);
            btn.classList.toggle('to-purple-600', key === tab);
            btn.classList.toggle('text-white', key === tab);
        }
    });

    if (tab === 'products') await loadVendorProducts();
    if (tab === 'vouchers') await loadVendorVouchers();
    if (tab === 'report') await loadVendorReport();
}

export async function loadVendorProducts() {
    const email = encodeURIComponent(App.currentUser.email || '');
    const response = await fetch(`${API_BASE_URL}/api/vendor/products/?email=${email}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Không tải được sản phẩm.');
    App.vendor.products = data.products || [];

    const tbody = $('vendor-products-table-body');
    if (!tbody) return;
    if (!App.vendor.products.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-5 text-center text-gray-500">Chua co san pham.</td></tr>';
        return;
    }

    tbody.innerHTML = App.vendor.products.map((p) => `
        <tr class="border-b border-pink-50">
            <td class="py-3 px-2 font-semibold">${p.name}</td>
            <td class="py-3 px-2">${formatVND(p.price)}</td>
            <td class="py-3 px-2">${p.stock}</td>
            <td class="py-3 px-2">${getStatusLabel(p.status)}</td>
            <td class="py-3 px-2 text-sm text-gray-500">${p.category_name || '-'}</td>
            <td class="py-3 px-2">
                <button onclick="editVendorProduct(${p.id})" class="px-2 py-1 rounded border border-pink-300 text-pink-700 text-sm">Sua</button>
                <button onclick="softDeleteVendorProduct(${p.id})" class="ml-2 px-2 py-1 rounded border border-red-300 text-red-600 text-sm">An</button>
            </td>
        </tr>
    `).join('');
}

export async function createVendorProduct() {
    try {
        const name = prompt('Ten san pham:') || '';
        if (!name.trim()) return;
        const price = Number(prompt('Gia ban:') || 0);
        const stock = Number(prompt('Ton kho:') || 0);
        const payload = {
            email: App.currentUser.email,
            name: name.trim(),
            description: '',
            price,
            stock,
            status: stock > 0 ? 'in_stock' : 'out_of_stock',
        };
        const response = await fetch(`${API_BASE_URL}/api/vendor/products/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể thêm sản phẩm.');
        showNotification('Da them san pham.');
        await loadVendorProducts();
    } catch (error) {
        showNotification(error.message || 'Loi thao tac san pham.', 'error');
    }
}

export async function editVendorProduct(productId) {
    const product = (App.vendor.products || []).find((p) => p.id === productId);
    if (!product) return;
    try {
        const name = prompt('Ten san pham:', product.name) || product.name;
        const price = Number(prompt('Gia ban:', product.price) || product.price);
        const stock = Number(prompt('Ton kho:', product.stock) || product.stock);
        const payload = {
            email: App.currentUser.email,
            name: name.trim(),
            price,
            stock,
            status: stock > 0 ? 'in_stock' : 'out_of_stock',
        };
        const response = await fetch(`${API_BASE_URL}/api/vendor/products/${productId}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể sửa sản phẩm.');
        showNotification('Da cap nhat san pham.');
        await loadVendorProducts();
    } catch (error) {
        showNotification(error.message || 'Loi cap nhat san pham.', 'error');
    }
}

export async function softDeleteVendorProduct(productId) {
    if (!confirm('An san pham nay?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/vendor/products/${productId}/?email=${encodeURIComponent(App.currentUser.email || '')}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể ẩn sản phẩm.');
        showNotification('Da an san pham.');
        await loadVendorProducts();
    } catch (error) {
        showNotification(error.message || 'Loi an san pham.', 'error');
    }
}

export async function loadVendorVouchers() {
    const email = encodeURIComponent(App.currentUser.email || '');
    const response = await fetch(`${API_BASE_URL}/api/vendor/vouchers/?email=${email}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Không tải được voucher.');
    App.vendor.vouchers = data.vouchers || [];

    const tbody = $('vendor-vouchers-table-body');
    if (!tbody) return;
    if (!App.vendor.vouchers.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-5 text-center text-gray-500">Chua co voucher.</td></tr>';
        return;
    }

    tbody.innerHTML = App.vendor.vouchers.map((v) => `
        <tr class="border-b border-pink-50">
            <td class="py-3 px-2 font-semibold">${v.code}</td>
            <td class="py-3 px-2">${v.name}</td>
            <td class="py-3 px-2">${v.discount_type === 'percent' ? `${Math.round(v.discount_value)}%` : formatVND(v.discount_value)}</td>
            <td class="py-3 px-2">${v.start_date} - ${v.end_date}</td>
            <td class="py-3 px-2">${getStatusLabel(v.status)}</td>
            <td class="py-3 px-2">${v.scope === 'store' ? 'Toan shop' : 'San pham cu the'}</td>
            <td class="py-3 px-2">
                <button onclick="editVendorVoucher(${v.id})" class="px-2 py-1 rounded border border-pink-300 text-pink-700 text-sm">Sua</button>
                <button onclick="deleteVendorVoucher(${v.id})" class="ml-2 px-2 py-1 rounded border border-red-300 text-red-600 text-sm">Xoa</button>
            </td>
        </tr>
    `).join('');
}

export async function createVendorVoucher() {
    try {
        const code = (prompt('Ma voucher (VD: SALE10):') || '').trim().toUpperCase();
        if (!code) return;
        const name = (prompt('Ten chuong trinh:') || '').trim();
        const discountPercent = Number(prompt('Giam bao nhieu %?') || 0);
        const startDate = prompt('Ngay bat dau (YYYY-MM-DD):') || '';
        const endDate = prompt('Ngay ket thuc (YYYY-MM-DD):') || '';

        const payload = {
            email: App.currentUser.email,
            code,
            name: name || code,
            discount_type: 'percent',
            discount_value: discountPercent,
            start_date: startDate,
            end_date: endDate,
            scope: 'store',
        };

        const response = await fetch(`${API_BASE_URL}/api/vendor/vouchers/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể tạo voucher.');
        showNotification('Da tao voucher.');
        await loadVendorVouchers();
    } catch (error) {
        showNotification(error.message || 'Loi tao voucher.', 'error');
    }
}

export async function editVendorVoucher(voucherId) {
    const voucher = (App.vendor.vouchers || []).find((v) => v.id === voucherId);
    if (!voucher) return;
    try {
        const name = (prompt('Ten voucher:', voucher.name) || voucher.name).trim();
        const discountValue = Number(prompt('Gia tri giam:', voucher.discount_value) || voucher.discount_value);
        const endDate = prompt('Ngay ket thuc (YYYY-MM-DD):', voucher.end_date) || voucher.end_date;
        const payload = {
            email: App.currentUser.email,
            code: voucher.code,
            name,
            discount_type: voucher.discount_type,
            discount_value: discountValue,
            start_date: voucher.start_date,
            end_date: endDate,
            scope: voucher.scope,
        };
        const response = await fetch(`${API_BASE_URL}/api/vendor/vouchers/${voucherId}/`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể cập nhật voucher.');
        showNotification('Da cap nhat voucher.');
        await loadVendorVouchers();
    } catch (error) {
        showNotification(error.message || 'Loi cap nhat voucher.', 'error');
    }
}

export async function deleteVendorVoucher(voucherId) {
    if (!confirm('Xoa voucher nay?')) return;
    try {
        const response = await fetch(`${API_BASE_URL}/api/vendor/vouchers/${voucherId}/?email=${encodeURIComponent(App.currentUser.email || '')}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể xóa voucher.');
        showNotification('Da xoa voucher.');
        await loadVendorVouchers();
    } catch (error) {
        showNotification(error.message || 'Loi xoa voucher.', 'error');
    }
}

export async function loadVendorReport() {
    const email = encodeURIComponent(App.currentUser.email || '');
    const response = await fetch(`${API_BASE_URL}/api/vendor/reports/dashboard/?email=${email}`);
    const data = await response.json();
    if (!data.success) throw new Error(data.message || 'Không tải được báo cáo.');
    App.vendor.report = data;

    if ($('vendor-report-total-revenue')) $('vendor-report-total-revenue').innerText = formatVND(data.overview?.total_revenue || 0);
    if ($('vendor-report-total-orders')) $('vendor-report-total-orders').innerText = String(data.overview?.total_orders || 0);
    if ($('vendor-report-cancel-rate')) $('vendor-report-cancel-rate').innerText = `${data.overview?.cancel_rate || 0}%`;
    if ($('vendor-report-total-items')) $('vendor-report-total-items').innerText = String(data.overview?.total_items_sold || 0);

    const topList = $('vendor-report-top-products');
    if (topList) {
        const topProducts = data.top_products || [];
        topList.innerHTML = topProducts.length
            ? topProducts.map((row) => `<li class="py-1 flex justify-between"><span>${row.product_name}</span><span class="font-semibold">${formatVND(row.total_revenue)}</span></li>`).join('')
            : '<li class="py-1 text-gray-500">Chua co du lieu.</li>';
    }

    const recentBody = $('vendor-report-orders-body');
    if (recentBody) {
        const rows = data.recent_orders || [];
        recentBody.innerHTML = rows.length
            ? rows.map((row) => `
                <tr class="border-b border-pink-50">
                    <td class="py-2 px-2">${row.order_code}</td>
                    <td class="py-2 px-2">${row.created_at}</td>
                    <td class="py-2 px-2">${row.status}</td>
                    <td class="py-2 px-2">${row.payment_method}</td>
                    <td class="py-2 px-2 text-right">${formatVND(row.amount)}</td>
                </tr>
            `).join('')
            : '<tr><td colspan="5" class="py-4 text-center text-gray-500">Chua co don hang.</td></tr>';
    }
}

window.showVendorCenter = showVendorCenter;
window.loadVendorTab = async (tab) => {
    try {
        await loadVendorTab(tab);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc du lieu vendor.', 'error');
    }
};
window.createVendorProduct = createVendorProduct;
window.editVendorProduct = editVendorProduct;
window.softDeleteVendorProduct = softDeleteVendorProduct;
window.createVendorVoucher = createVendorVoucher;
window.editVendorVoucher = editVendorVoucher;
window.deleteVendorVoucher = deleteVendorVoucher;

