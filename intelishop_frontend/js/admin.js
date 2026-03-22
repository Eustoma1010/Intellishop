import { API_BASE_URL, App, $, formatVND } from './config.js';
import { hideAllViews, showLogin, showNotification } from './ui.js';

const adminState = {
    activeTab: 'accounts',
};

function isAdmin() {
    const role = (App.currentUser?.role || '').toUpperCase();
    return role === 'ADMIN';
}

async function fetchApiJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success === false) {
        throw new Error(data?.message || `Yeu cau that bai (${response.status})`);
    }
    return data;
}

function getAdminEmail() {
    return App.currentUser?.email || '';
}

function ensureAdmin() {
    if (!App.isLoggedIn || !App.currentUser?.email) {
        showNotification('Vui long dang nhap tai khoan admin.', 'error');
        showLogin();
        return false;
    }
    if (!isAdmin()) {
        showNotification('Ban khong co quyen truy cap trung tam quan tri.', 'error');
        return false;
    }
    return true;
}

function setActiveTabButton(tabName) {
    ['accounts', 'support', 'reports'].forEach((name) => {
        const btn = $(`admin-tab-btn-${name}`);
        if (!btn) return;
        if (name === tabName) {
            btn.classList.add('bg-purple-600', 'text-white');
            btn.classList.remove('text-purple-700');
        } else {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('text-purple-700');
        }
    });
}

function toggleTabPanels(tabName) {
    ['accounts', 'support', 'reports'].forEach((name) => {
        const panel = $(`admin-tab-${name}`);
        if (!panel) return;
        panel.classList.toggle('hide', name !== tabName);
    });
}

function renderUsers(users = []) {
    const tbody = $('admin-users-table-body');
    if (!tbody) return;
    if (!users.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 px-2 text-gray-500 text-center">Khong co tai khoan phu hop.</td></tr>';
        return;
    }

    tbody.innerHTML = users.map((u) => {
        const activeText = u.is_active ? 'Hoat dong' : 'Tam khoa';
        const activeClass = u.is_active ? 'text-green-700 bg-green-100' : 'text-red-700 bg-red-100';
        const actionLabel = u.is_active ? 'Khoa' : 'Mo khoa';
        const nextActive = !u.is_active;
        return `
            <tr class="border-b border-pink-50">
                <td class="py-2 px-2">U${u.id}</td>
                <td class="py-2 px-2">${u.full_name || '-'}</td>
                <td class="py-2 px-2">${u.email}</td>
                <td class="py-2 px-2">${u.role}</td>
                <td class="py-2 px-2"><span class="px-2 py-1 rounded-full text-xs font-semibold ${activeClass}">${activeText}</span></td>
                <td class="py-2 px-2">
                    <button onclick="adminToggleUserActive(${u.id}, ${nextActive ? 'true' : 'false'})" class="px-2 py-1 rounded bg-orange-500 text-white text-xs font-semibold">${actionLabel}</button>
                </td>
            </tr>
        `;
    }).join('');
}

function renderPendingProducts(products = []) {
    const tbody = $('admin-pending-products-body');
    if (!tbody) return;
    if (!products.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="py-4 px-2 text-gray-500 text-center">Khong co san pham cho duyet.</td></tr>';
        return;
    }

    tbody.innerHTML = products.map((p) => `
        <tr class="border-b border-pink-50">
            <td class="py-2 px-2">P${p.id}</td>
            <td class="py-2 px-2">${p.name}</td>
            <td class="py-2 px-2">${p.store_name || '-'}</td>
            <td class="py-2 px-2">${formatVND(p.price)}</td>
            <td class="py-2 px-2">
                <button onclick="adminModerateProduct(${p.id}, 'approve')" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Duyet</button>
                <button onclick="adminModerateProduct(${p.id}, 'reject')" class="ml-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold">Tu choi</button>
            </td>
        </tr>
    `).join('');
}

function renderVendorApps(apps = []) {
    const tbody = $('admin-vendor-apps-body');
    if (!tbody) return;
    if (!apps.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-gray-500 text-center">Khong co don dang ky vendor.</td></tr>';
        return;
    }

    tbody.innerHTML = apps.map((app) => `
        <tr class="border-b border-pink-50">
            <td class="py-2 px-2">RS${app.id}</td>
            <td class="py-2 px-2">${app.store_name}</td>
            <td class="py-2 px-2">${app.user_email}</td>
            <td class="py-2 px-2">
                <button onclick="adminHandleVendorApplication(${app.id}, 'approve')" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Duyet</button>
                <button onclick="adminHandleVendorApplication(${app.id}, 'reject')" class="ml-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold">Tu choi</button>
            </td>
        </tr>
    `).join('');
}

function renderShipperApps(apps = []) {
    const tbody = $('admin-shipper-apps-body');
    if (!tbody) return;
    if (!apps.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-gray-500 text-center">Khong co don dang ky shipper.</td></tr>';
        return;
    }

    tbody.innerHTML = apps.map((app) => `
        <tr class="border-b border-pink-50">
            <td class="py-2 px-2">DL${app.id}</td>
            <td class="py-2 px-2">${app.company_name}</td>
            <td class="py-2 px-2">${app.user_email}</td>
            <td class="py-2 px-2">
                <button onclick="adminHandleShipperApplication(${app.id}, 'approve')" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Duyet</button>
                <button onclick="adminHandleShipperApplication(${app.id}, 'reject')" class="ml-1 px-2 py-1 rounded bg-red-600 text-white text-xs font-semibold">Tu choi</button>
            </td>
        </tr>
    `).join('');
}

function renderSupportTickets(tickets = []) {
    const tbody = $('admin-support-tickets-body');
    if (!tbody) return;
    if (!tickets.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="py-4 px-2 text-gray-500 text-center">Khong co ticket nao.</td></tr>';
        return;
    }

    tbody.innerHTML = tickets.map((ticket) => {
        const statusClass = ticket.status === 'RESOLVED'
            ? 'bg-green-100 text-green-700'
            : ticket.status === 'IN_PROGRESS'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-yellow-100 text-yellow-700';
        return `
            <tr class="border-b border-pink-50 align-top">
                <td class="py-2 px-2">${ticket.ticket_code || ticket.id}</td>
                <td class="py-2 px-2">${ticket.sender?.full_name || ticket.sender?.email || '-'}</td>
                <td class="py-2 px-2">${ticket.ticket_type}</td>
                <td class="py-2 px-2">${ticket.content}</td>
                <td class="py-2 px-2"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusClass}">${ticket.status}</span></td>
                <td class="py-2 px-2 space-y-2">
                    <textarea id="admin-ticket-reply-${ticket.id}" rows="2" class="w-full border border-pink-200 rounded px-2 py-1 text-xs" placeholder="Nhap phan hoi..."></textarea>
                    <div class="flex gap-1">
                        <button onclick="adminReplyTicket(${ticket.id}, 'IN_PROGRESS')" class="px-2 py-1 rounded bg-purple-600 text-white text-xs font-semibold">Dang xu ly</button>
                        <button onclick="adminReplyTicket(${ticket.id}, 'RESOLVED')" class="px-2 py-1 rounded bg-green-600 text-white text-xs font-semibold">Da giai quyet</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderReport(data = {}) {
    if ($('admin-report-total-orders')) $('admin-report-total-orders').innerText = String(data.overview?.total_orders || 0);
    if ($('admin-report-complaints')) $('admin-report-complaints').innerText = String(data.overview?.complaint_count || 0);
    if ($('admin-report-support')) $('admin-report-support').innerText = String(data.overview?.support_request_count || 0);
    if ($('admin-report-rating')) $('admin-report-rating').innerText = String(data.overview?.avg_system_rating || 0);

    const seriesBody = $('admin-report-series-body');
    if (seriesBody) {
        const labels = data.line_chart?.labels || [];
        const orders = data.line_chart?.orders || [];
        const tickets = data.line_chart?.support_tickets || [];
        if (!labels.length) {
            seriesBody.innerHTML = '<tr><td colspan="3" class="py-4 px-2 text-center text-gray-500">Chua co du lieu 7 ngay.</td></tr>';
        } else {
            seriesBody.innerHTML = labels.map((label, idx) => `
                <tr class="border-b border-pink-50">
                    <td class="py-2 px-2">${label}</td>
                    <td class="py-2 px-2">${orders[idx] || 0}</td>
                    <td class="py-2 px-2">${tickets[idx] || 0}</td>
                </tr>
            `).join('');
        }
    }
}

function renderSystemReviews(reviews = []) {
    const tbody = $('admin-system-reviews-body');
    if (!tbody) return;
    if (!reviews.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="py-4 px-2 text-center text-gray-500">Chua co phan hoi he thong.</td></tr>';
        return;
    }

    tbody.innerHTML = reviews.map((review) => `
        <tr class="border-b border-pink-50">
            <td class="py-2 px-2">${review.user_name || review.user_email}</td>
            <td class="py-2 px-2">${review.rating}★</td>
            <td class="py-2 px-2">${review.comment || '-'}</td>
            <td class="py-2 px-2">${review.created_at}</td>
        </tr>
    `).join('');
}

export async function loadAdminUsers() {
    if (!ensureAdmin()) return;
    try {
        const q = encodeURIComponent($('admin-users-q')?.value || '');
        const role = encodeURIComponent($('admin-users-role-filter')?.value || '');
        const email = encodeURIComponent(getAdminEmail());
        const data = await fetchApiJson(`${API_BASE_URL}/api/admin/users/?email=${email}&q=${q}&role=${role}`);
        renderUsers(data.users || []);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc danh sach tai khoan.', 'error');
    }
}

async function loadAdminPendingApprovals() {
    if (!ensureAdmin()) return;
    try {
        const email = encodeURIComponent(getAdminEmail());
        const data = await fetchApiJson(`${API_BASE_URL}/api/admin/approvals/pending/?email=${email}`);
        renderPendingProducts(data.pending_products || []);
        renderVendorApps(data.vendor_applications || []);
        renderShipperApps(data.shipper_applications || []);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc du lieu phe duyet.', 'error');
    }
}

export async function loadAdminSupportTickets() {
    if (!ensureAdmin()) return;
    try {
        const email = encodeURIComponent(getAdminEmail());
        const status = encodeURIComponent($('admin-ticket-status-filter')?.value || '');
        const senderRole = encodeURIComponent($('admin-ticket-role-filter')?.value || '');
        const data = await fetchApiJson(`${API_BASE_URL}/api/support/tickets/?email=${email}&status=${status}&sender_role=${senderRole}`);
        renderSupportTickets(data.tickets || []);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc danh sach ticket.', 'error');
    }
}

async function loadAdminReports() {
    if (!ensureAdmin()) return;
    try {
        const email = encodeURIComponent(getAdminEmail());
        const [reportData, reviewData] = await Promise.all([
            fetchApiJson(`${API_BASE_URL}/api/admin/reports/dashboard/?email=${email}`),
            fetchApiJson(`${API_BASE_URL}/api/system/reviews/`),
        ]);
        renderReport(reportData || {});
        renderSystemReviews(reviewData.reviews || []);
    } catch (error) {
        showNotification(error.message || 'Khong tai duoc bao cao he thong.', 'error');
    }
}

export async function adminToggleUserActive(userId, isActive) {
    if (!ensureAdmin()) return;
    try {
        await fetchApiJson(`${API_BASE_URL}/api/admin/users/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: getAdminEmail(), user_id: userId, is_active: isActive }),
        });
        showNotification('Da cap nhat trang thai tai khoan.');
        await loadAdminUsers();
    } catch (error) {
        showNotification(error.message || 'Khong the cap nhat tai khoan.', 'error');
    }
}

export async function adminHandleVendorApplication(applicationId, action) {
    if (!ensureAdmin()) return;
    try {
        await fetchApiJson(`${API_BASE_URL}/api/admin/approvals/vendor/action/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: getAdminEmail(), application_id: applicationId, action }),
        });
        showNotification('Da xu ly don dang ky nguoi ban.');
        await loadAdminPendingApprovals();
    } catch (error) {
        showNotification(error.message || 'Khong the xu ly don vendor.', 'error');
    }
}

export async function adminHandleShipperApplication(applicationId, action) {
    if (!ensureAdmin()) return;
    try {
        await fetchApiJson(`${API_BASE_URL}/api/admin/approvals/shipper/action/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: getAdminEmail(), application_id: applicationId, action }),
        });
        showNotification('Da xu ly don dang ky van chuyen.');
        await loadAdminPendingApprovals();
    } catch (error) {
        showNotification(error.message || 'Khong the xu ly don shipper.', 'error');
    }
}

export async function adminModerateProduct(productId, action) {
    if (!ensureAdmin()) return;
    try {
        await fetchApiJson(`${API_BASE_URL}/api/admin/products/moderate/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: getAdminEmail(), product_id: productId, action }),
        });
        showNotification('Da cap nhat kiem duyet san pham.');
        await loadAdminPendingApprovals();
    } catch (error) {
        showNotification(error.message || 'Khong the kiem duyet san pham.', 'error');
    }
}

export async function adminReplyTicket(ticketId, nextStatus) {
    if (!ensureAdmin()) return;
    try {
        const response = $(`admin-ticket-reply-${ticketId}`)?.value || '';
        await fetchApiJson(`${API_BASE_URL}/api/support/tickets/${ticketId}/reply/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: getAdminEmail(),
                response,
                status: nextStatus,
                send_email: true,
            }),
        });
        showNotification('Da phan hoi ticket.');
        await loadAdminSupportTickets();
    } catch (error) {
        showNotification(error.message || 'Khong the phan hoi ticket.', 'error');
    }
}

export async function loadAdminTab(tabName) {
    adminState.activeTab = tabName;
    setActiveTabButton(tabName);
    toggleTabPanels(tabName);

    if (tabName === 'accounts') {
        await Promise.all([loadAdminUsers(), loadAdminPendingApprovals()]);
    } else if (tabName === 'support') {
        await loadAdminSupportTickets();
    } else if (tabName === 'reports') {
        await loadAdminReports();
    }
}

export async function openAdminDashboard(defaultTab = 'accounts') {
    if (!ensureAdmin()) return;
    hideAllViews();
    const view = $('view-admin-dashboard');
    if (view) view.classList.remove('hide');
    await loadAdminTab(defaultTab);
}

window.openAdminDashboard = openAdminDashboard;
window.loadAdminTab = loadAdminTab;
window.loadAdminUsers = loadAdminUsers;
window.loadAdminSupportTickets = loadAdminSupportTickets;
window.adminToggleUserActive = adminToggleUserActive;
window.adminHandleVendorApplication = adminHandleVendorApplication;
window.adminHandleShipperApplication = adminHandleShipperApplication;
window.adminModerateProduct = adminModerateProduct;
window.adminReplyTicket = adminReplyTicket;


