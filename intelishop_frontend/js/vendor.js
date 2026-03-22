import { API_BASE_URL, App, $, formatVND } from './config.js';
import { requestJson } from './api.js';
import { hideAllViews, showLogin, showNotification } from './ui.js';


const safeLower = (value) => (value || '').toString().trim().toLowerCase();
const REQUEST_TIMEOUT_MS = 15000;

const vendorLocks = {
    savingStore: false,
    savingProduct: false,
    savingVoucher: false,
    deletingProductIds: new Set(),
    deletingVoucherIds: new Set(),
};

const requestTokens = {
    products: 0,
    vouchers: 0,
    report: 0,
};

const escapeHtml = (value) => (value || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const uiTimers = {
    productSearch: null,
    voucherSearch: null,
};
const VENDOR_LAST_TAB_KEY = 'vendor_last_tab';
const VENDOR_FILTERS_KEY = 'vendor_filters';
const VENDOR_TABS = ['store', 'products', 'vouchers', 'report'];

function normalizeVendorTab(tab) {
    const normalized = (tab || '').toString().trim().toLowerCase();
    return VENDOR_TABS.includes(normalized) ? normalized : 'products';
}

function formatStoreAddress(storeAddress, city) {
    const address = (storeAddress || '').trim();
    const cityValue = (city || '').trim();
    if (!address) return cityValue;
    if (!cityValue) return address;

    // Avoid duplicating city when backend already includes it in the full address.
    const addressLower = safeLower(address);
    const cityLower = safeLower(cityValue);
    if (addressLower.endsWith(cityLower) || addressLower.includes(`, ${cityLower}`)) {
        return address;
    }
    return `${address}, ${cityValue}`;
}

function persistVendorFilters() {
    try {
        localStorage.setItem(VENDOR_FILTERS_KEY, JSON.stringify(App.vendor.filters || {}));
    } catch (_error) {
        // Ignore storage errors.
    }
}

function hydrateVendorFilters() {
    try {
        const raw = localStorage.getItem(VENDOR_FILTERS_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        App.vendor.filters = {
            ...App.vendor.filters,
            ...parsed,
            productInStockOnly: !!parsed.productInStockOnly,
        };
    } catch (_error) {
        // Ignore malformed localStorage data.
    }
}

function setElementLoading(id, isLoading, idleText, loadingText = 'Đang xử lý...') {
    const el = $(id);
    if (!el) return;
    if (isLoading) {
        el.dataset.prevText = el.innerHTML;
        el.disabled = true;
        el.classList.add('opacity-70', 'cursor-not-allowed');
        el.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i>${loadingText}`;
        return;
    }
    el.disabled = false;
    el.classList.remove('opacity-70', 'cursor-not-allowed');
    el.innerHTML = idleText || el.dataset.prevText || el.innerHTML;
}

async function fetchApiJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    return requestJson(url, options, {
        timeoutMs,
        retryGet: 1,
        onUnauthorized: () => {
            showNotification('Phiên đăng nhập người bán đã hết hạn. Vui lòng đăng nhập lại.', 'error');
            showLogin();
        },
    });
}

// ==================================================
// VIETNAM ADDRESS CASCADING SELECTS
// ==================================================
const VN_API = 'https://provinces.open-api.vn/api';
let _vnProvincesCache = null;

async function _fetchVNProvinces() {
    if (_vnProvincesCache) return _vnProvincesCache;
    try {
        const res = await fetch(`${VN_API}/p/`);
        _vnProvincesCache = await res.json();
        return _vnProvincesCache;
    } catch (e) { return []; }
}

async function _fetchVNDistricts(code) {
    try {
        const res = await fetch(`${VN_API}/p/${code}?depth=2`);
        const d = await res.json();
        return d.districts || [];
    } catch (e) { return []; }
}

async function _fetchVNWards(code) {
    try {
        const res = await fetch(`${VN_API}/d/${code}?depth=2`);
        const d = await res.json();
        return d.wards || [];
    } catch (e) { return []; }
}

function _selectText(id) {
    const el = document.getElementById(id);
    return el?.value ? (el.selectedOptions[0]?.text || '') : '';
}

function _buildAddress({ provinceId, districtId, wardId, streetId }) {
    const province = _selectText(provinceId);
    const district = _selectText(districtId);
    const ward = _selectText(wardId);
    const street = (document.getElementById(streetId)?.value || '').trim();
    if (!province) return { city: '', full_address: '' };
    const parts = [street, ward, district].filter(Boolean);
    return {
        city: province,
        full_address: parts.length ? `${parts.join(', ')}, ${province}` : province,
    };
}

async function _initCascadeSelects({ provinceId, districtId, wardId }) {
    const pEl = document.getElementById(provinceId);
    const dEl = document.getElementById(districtId);
    const wEl = document.getElementById(wardId);
    if (!pEl) return;

    const provinces = await _fetchVNProvinces();
    pEl.innerHTML = '<option value="">-- Tỉnh / Thành phố --</option>' +
        provinces.map(p => `<option value="${p.code}">${p.name}</option>`).join('');

    const loadDistricts = async (code) => {
        if (!dEl) return;
        dEl.innerHTML = '<option value="">-- Quận / Huyện --</option>';
        if (wEl) wEl.innerHTML = '<option value="">-- Phường / Xã --</option>';
        if (!code) return;
        const districts = await _fetchVNDistricts(code);
        dEl.innerHTML = '<option value="">-- Quận / Huyện --</option>' +
            districts.map(d => `<option value="${d.code}">${d.name}</option>`).join('');
    };

    const loadWards = async (code) => {
        if (!wEl) return;
        wEl.innerHTML = '<option value="">-- Phường / Xã --</option>';
        if (!code) return;
        const wards = await _fetchVNWards(code);
        wEl.innerHTML = '<option value="">-- Phường / Xã --</option>' +
            wards.map(w => `<option value="${w.code}">${w.name}</option>`).join('');
    };

    pEl.addEventListener('change', () => loadDistricts(pEl.value));
    if (dEl) dEl.addEventListener('change', () => loadWards(dEl.value));
}

let _vendorApplyAddrInited = false;

export async function initVendorApplyAddress() {
    if (_vendorApplyAddrInited) return;
    _vendorApplyAddrInited = true;
    await _initCascadeSelects({
        provinceId: 'vendor-province-select',
        districtId: 'vendor-district-select',
        wardId: 'vendor-ward-select',
    });
}

export function getVendorApplyAddressData() {
    return _buildAddress({
        provinceId: 'vendor-province-select',
        districtId: 'vendor-district-select',
        wardId: 'vendor-ward-select',
        streetId: 'vendor-street-input',
    });
}

function setStoreLogoPreview(src) {
    const img = $('vendor-store-profile-icon-preview');
    if (!img) return;
    if (!src) {
        img.src = '';
        img.classList.add('hidden');
        return;
    }
    img.src = src;
    img.classList.remove('hidden');
}

function ensureVendorLoggedIn() {
    if (!App.isLoggedIn || !App.currentUser?.email) {
        showNotification('Vui lòng đăng nhập trước.', 'error');
        showLogin();
        return false;
    }
    const canVendor = !!App.currentUser?.can_vendor || App.currentUser?.role === 'VENDOR';
    if (!canVendor) {
        showNotification('Tài khoản chưa có quyền quản lý gian hàng.', 'error');
        return false;
    }
    return true;
}

function getStatusLabel(status) {
    const map = {
        in_stock: 'Còn hàng',
        out_of_stock: 'Hết hàng',
        hidden: 'Bị ẩn',
        upcoming: 'Sắp diễn ra',
        running: 'Đang chạy',
        ended: 'Đã kết thúc',
        PENDING: 'Chờ shop xác nhận',
        READY_FOR_PICKUP: 'Chờ shipper lấy hàng',
        DELIVERING: 'Đang giao',
        DELIVERED: 'Đã giao',
        FAILED: 'Giao thất bại',
    };
    return map[status] || status;
}

export async function showVendorCenter(tab) {
    if (!ensureVendorLoggedIn()) return;
    try {
        hydrateVendorFilters();
        bindVendorCenterUI();
        hideAllViews();
        const view = $('view-vendor-center');
        if (view) view.classList.remove('hide');
        const rememberedTab = normalizeVendorTab(localStorage.getItem(VENDOR_LAST_TAB_KEY));
        const targetTab = normalizeVendorTab(tab || rememberedTab);
        App.vendor.activeTab = targetTab;
        await loadVendorStore();
        await loadVendorTab(targetTab);
    } catch (error) {
        showNotification(error.message || 'Không tải được trung tâm người bán.', 'error');
    }
}

export async function loadVendorStore() {
    const email = encodeURIComponent(App.currentUser.email || '');
    const data = await fetchApiJson(`${API_BASE_URL}/api/vendor/store/?email=${email}`);
    App.vendor.store = data.store;

    if ($('vendor-center-store-name')) $('vendor-center-store-name').innerText = data.store?.name || 'Cửa hàng';
    if ($('vendor-center-store-meta')) {
        const stateText = data.store?.is_active ? 'Đang hoạt động' : 'Chờ duyệt';
        $('vendor-center-store-meta').innerText = `${data.store?.business_category || 'Ngành hàng'} | ${stateText}`;
    }
    if ($('vendor-center-pending-banner')) {
        $('vendor-center-pending-banner').classList.toggle('hidden', !data.is_pending_approval);
    }

    if ($('vendor-store-profile-name')) $('vendor-store-profile-name').value = data.store?.name || '';
    if ($('vendor-store-profile-phone')) $('vendor-store-profile-phone').value = data.store?.business_phone || '';
    // Auto-select category option that matches stored value
    const catEl = $('vendor-store-profile-category');
    if (catEl) {
        const storedCat = data.store?.business_category || '';
        const matchingOpt = Array.from(catEl.options).find(o => o.value === storedCat);
        catEl.value = matchingOpt ? storedCat : '';
    }
    setStoreLogoPreview(data.store?.icon || '');

    // Address display + hidden fallbacks
    const cityVal = data.store?.city || '';
    const addrVal = data.store?.store_address || '';
    const addrText = $('vendor-store-current-address-text');
    if (addrText) addrText.textContent = formatStoreAddress(addrVal, cityVal) || 'Chưa cập nhật';
    const hCity = $('store-profile-current-city');
    const hAddr = $('store-profile-current-address');
    if (hCity) hCity.value = cityVal;
    if (hAddr) hAddr.value = addrVal;
}

export async function loadVendorTab(tab) {
    const normalizedTab = normalizeVendorTab(tab);
    App.vendor.activeTab = normalizedTab;
    localStorage.setItem(VENDOR_LAST_TAB_KEY, normalizedTab);
    ['store', 'products', 'vouchers', 'report'].forEach((key) => {
        const pane = $(`vendor-tab-${key}`);
        if (pane) pane.classList.toggle('hidden', key !== normalizedTab);
        const btn = $(`btn-vendor-tab-${key}`);
        if (btn) {
            btn.classList.toggle('bg-gradient-to-r', key === normalizedTab);
            btn.classList.toggle('from-pink-600', key === normalizedTab);
            btn.classList.toggle('to-purple-600', key === normalizedTab);
            btn.classList.toggle('text-white', key === normalizedTab);
        }
    });

    if (normalizedTab === 'store') return;
    if (normalizedTab === 'products') await loadVendorProducts();
    if (normalizedTab === 'vouchers') await loadVendorVouchers();
    if (normalizedTab === 'report') await loadVendorReport();
}

async function saveVendorStoreProfile(event) {
    event.preventDefault();
    if (vendorLocks.savingStore) return;
    vendorLocks.savingStore = true;
    setElementLoading('vendor-store-profile-submit', true, 'Lưu thông tin');
    try {
        const newAddr = _buildAddress({
            provinceId: 'store-profile-province-select',
            districtId: 'store-profile-district-select',
            wardId: 'store-profile-ward-select',
            streetId: 'store-profile-street-input',
        });
        const city = newAddr.city || $('store-profile-current-city')?.value || '';
        const store_address = newAddr.city
            ? newAddr.full_address
            : ($('store-profile-current-address')?.value || '');

        const payload = {
            email: App.currentUser.email,
            name: ($('vendor-store-profile-name')?.value || '').trim(),
            business_category: ($('vendor-store-profile-category')?.value || '').trim(),
            business_phone: ($('vendor-store-profile-phone')?.value || '').trim(),
            city,
            store_address,
            description: ($('vendor-store-profile-description')?.value || '').trim(),
        };
        const iconFile = $('vendor-store-profile-icon')?.files?.[0];

        if (!payload.name) {
            showNotification('Vui lòng nhập tên cửa hàng.', 'error');
            return;
        }

        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
            formData.append(key, value);
        });
        if (iconFile) {
            formData.append('icon', iconFile);
        }

        const data = await fetchApiJson(`${API_BASE_URL}/api/vendor/store/`, {
            method: 'PUT',
            body: formData,
        });

        await loadVendorStore();
        if ($('vendor-store-profile-icon')) $('vendor-store-profile-icon').value = '';
        showNotification(data.message || 'Đã cập nhật thông tin cửa hàng.');
    } catch (error) {
        showNotification(error.message || 'Lỗi cập nhật thông tin cửa hàng.', 'error');
    } finally {
        vendorLocks.savingStore = false;
        setElementLoading('vendor-store-profile-submit', false, 'Lưu thông tin');
    }
}

export async function loadVendorProducts() {
    const token = ++requestTokens.products;
    const email = encodeURIComponent(App.currentUser.email || '');
    const data = await fetchApiJson(`${API_BASE_URL}/api/vendor/products/?email=${email}`);
    if (token !== requestTokens.products) return;
    App.vendor.products = data.products || [];
    renderVendorProducts();
}

function filterVendorProducts() {
    const query = safeLower(App.vendor.filters?.productQuery);
    const status = App.vendor.filters?.productStatus || 'all';
    const inStockOnly = !!App.vendor.filters?.productInStockOnly;
    const sortBy = App.vendor.filters?.productSort || 'newest';

    const rows = (App.vendor.products || []).filter((item) => {
        const matchQuery = !query
            || safeLower(item.name).includes(query)
            || safeLower(item.category_name).includes(query);
        const matchStatus = status === 'all' || item.status === status;
        const matchInStock = !inStockOnly || item.status === 'in_stock';
        return matchQuery && matchStatus && matchInStock;
    });

    const sorted = [...rows];
    if (sortBy === 'price_asc') sorted.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price_desc') sorted.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === 'stock_asc') sorted.sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
    if (sortBy === 'stock_desc') sorted.sort((a, b) => Number(b.stock || 0) - Number(a.stock || 0));
    if (sortBy === 'name_asc') sorted.sort((a, b) => safeLower(a.name).localeCompare(safeLower(b.name)));
    return sorted;
}

function renderVendorProducts() {
    const rows = filterVendorProducts();

    const tbody = $('vendor-products-table-body');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-5 text-center text-gray-500">Chưa có sản phẩm.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((p) => `
        <tr class="border-b border-pink-50">
            <td class="py-3 px-2 font-semibold">${escapeHtml(p.name)}</td>
            <td class="py-3 px-2">${formatVND(p.price)}</td>
            <td class="py-3 px-2">${p.stock}</td>
            <td class="py-3 px-2">${getStatusLabel(p.status)}</td>
            <td class="py-3 px-2 text-sm text-gray-500">${escapeHtml(p.category_name || '-')}</td>
            <td class="py-3 px-2">
                <button onclick="editVendorProduct(${p.id})" class="px-2 py-1 rounded border border-pink-300 text-pink-700 text-sm">Sửa</button>
                <button onclick="softDeleteVendorProduct(${p.id})" class="ml-2 px-2 py-1 rounded border border-red-300 text-red-600 text-sm">Ẩn</button>
            </td>
        </tr>
    `).join('');
}

export async function createVendorProduct() {
    App.vendor.productEditingId = null;
    if ($('vendor-product-modal-title')) $('vendor-product-modal-title').innerText = 'Thêm sản phẩm';
    if ($('vendor-product-submit')) $('vendor-product-submit').innerText = 'Lưu sản phẩm';
    if ($('vendor-product-form')) $('vendor-product-form').reset();
    if ($('vendor-product-status')) $('vendor-product-status').value = 'in_stock';
    if ($('vendor-product-category')) {
        const categories = App.categories || [];
        $('vendor-product-category').innerHTML = '<option value="">Chọn danh mục</option>'
            + categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    }
    if ($('vendor-product-image-preview')) {
        $('vendor-product-image-preview').classList.add('hidden');
        $('vendor-product-image-preview').src = '';
    }
    $('vendor-product-modal')?.classList.remove('hidden');
}

export async function editVendorProduct(productId) {
    const product = (App.vendor.products || []).find((p) => p.id === productId);
    if (!product) return;
    App.vendor.productEditingId = productId;
    if ($('vendor-product-modal-title')) $('vendor-product-modal-title').innerText = 'Sửa sản phẩm';
    if ($('vendor-product-submit')) $('vendor-product-submit').innerText = 'Cập nhật sản phẩm';
    if ($('vendor-product-name')) $('vendor-product-name').value = product.name || '';
    if ($('vendor-product-description')) $('vendor-product-description').value = product.description || '';
    if ($('vendor-product-price')) $('vendor-product-price').value = Math.round(Number(product.price) || 0);
    if ($('vendor-product-stock')) $('vendor-product-stock').value = Number(product.stock) || 0;
    if ($('vendor-product-status')) $('vendor-product-status').value = product.status || 'in_stock';
    if ($('vendor-product-category')) {
        const categories = App.categories || [];
        $('vendor-product-category').innerHTML = '<option value="">Chọn danh mục</option>'
            + categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
        $('vendor-product-category').value = product.category_id || '';
    }
    if ($('vendor-product-image-preview')) {
        if (product.image) {
            $('vendor-product-image-preview').src = product.image;
            $('vendor-product-image-preview').classList.remove('hidden');
        } else {
            $('vendor-product-image-preview').classList.add('hidden');
            $('vendor-product-image-preview').src = '';
        }
    }
    $('vendor-product-modal')?.classList.remove('hidden');
}

function closeVendorProductModal() {
    $('vendor-product-modal')?.classList.add('hidden');
    App.vendor.productEditingId = null;
}

async function submitVendorProductForm(event) {
    event.preventDefault();
    if (vendorLocks.savingProduct) return;
    vendorLocks.savingProduct = true;
    const isEdit = !!App.vendor.productEditingId;
    setElementLoading('vendor-product-submit', true, isEdit ? 'Cập nhật sản phẩm' : 'Lưu sản phẩm');
    try {
        const payload = {
            email: App.currentUser.email,
            name: ($('vendor-product-name')?.value || '').trim(),
            description: ($('vendor-product-description')?.value || '').trim(),
            price: Number($('vendor-product-price')?.value || 0),
            stock: Number($('vendor-product-stock')?.value || 0),
            status: $('vendor-product-status')?.value || 'in_stock',
            category_id: $('vendor-product-category')?.value || '',
        };
        const imageFile = $('vendor-product-image')?.files?.[0];

        if (!payload.name) {
            showNotification('Vui lòng nhập tên sản phẩm.', 'error');
            return;
        }
        if (payload.price < 0 || payload.stock < 0) {
            showNotification('Giá và tồn kho phải lớn hơn hoặc bằng 0.', 'error');
            return;
        }

        const endpoint = isEdit
            ? `${API_BASE_URL}/api/vendor/products/${App.vendor.productEditingId}/`
            : `${API_BASE_URL}/api/vendor/products/`;
        const method = isEdit ? 'PUT' : 'POST';

        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
        if (imageFile) formData.append('image', imageFile);

        const data = await fetchApiJson(endpoint, {
            method,
            body: formData,
        });
        closeVendorProductModal();
        showNotification(isEdit ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
        await loadVendorProducts();
    } catch (error) {
        showNotification(error.message || 'Lỗi thao tác sản phẩm.', 'error');
    } finally {
        vendorLocks.savingProduct = false;
        setElementLoading('vendor-product-submit', false, isEdit ? 'Cập nhật sản phẩm' : 'Lưu sản phẩm');
    }
}

export async function softDeleteVendorProduct(productId) {
    if (!confirm('Ẩn sản phẩm này?')) return;
    if (vendorLocks.deletingProductIds.has(productId)) return;
    vendorLocks.deletingProductIds.add(productId);
    try {
        await fetchApiJson(`${API_BASE_URL}/api/vendor/products/${productId}/?email=${encodeURIComponent(App.currentUser.email || '')}`, {
            method: 'DELETE',
        });
        showNotification('Đã ẩn sản phẩm.');
        await loadVendorProducts();
    } catch (error) {
        showNotification(error.message || 'Lỗi ẩn sản phẩm.', 'error');
    } finally {
        vendorLocks.deletingProductIds.delete(productId);
    }
}

export async function loadVendorVouchers() {
    const token = ++requestTokens.vouchers;
    const email = encodeURIComponent(App.currentUser.email || '');
    const data = await fetchApiJson(`${API_BASE_URL}/api/vendor/vouchers/?email=${email}`);
    if (token !== requestTokens.vouchers) return;
    App.vendor.vouchers = data.vouchers || [];
    renderVendorVouchers();
}

function filterVendorVouchers() {
    const query = safeLower(App.vendor.filters?.voucherQuery);
    const status = App.vendor.filters?.voucherStatus || 'all';
    const sortBy = App.vendor.filters?.voucherSort || 'newest';

    const rows = (App.vendor.vouchers || []).filter((item) => {
        const matchQuery = !query
            || safeLower(item.code).includes(query)
            || safeLower(item.name).includes(query);
        const matchStatus = status === 'all' || item.status === status;
        return matchQuery && matchStatus;
    });

    const sorted = [...rows];
    if (sortBy === 'discount_desc') sorted.sort((a, b) => Number(b.discount_value || 0) - Number(a.discount_value || 0));
    if (sortBy === 'code_asc') sorted.sort((a, b) => safeLower(a.code).localeCompare(safeLower(b.code)));
    if (sortBy === 'end_asc') sorted.sort((a, b) => safeLower(a.end_date).localeCompare(safeLower(b.end_date)));
    if (sortBy === 'start_desc') sorted.sort((a, b) => safeLower(b.start_date).localeCompare(safeLower(a.start_date)));
    return sorted;
}

function renderVendorVouchers() {
    const rows = filterVendorVouchers();

    const tbody = $('vendor-vouchers-table-body');
    if (!tbody) return;
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="py-5 text-center text-gray-500">Chưa có voucher.</td></tr>';
        return;
    }

    tbody.innerHTML = rows.map((v) => `
        <tr class="border-b border-pink-50">
            <td class="py-3 px-2 font-semibold">${escapeHtml(v.code)}</td>
            <td class="py-3 px-2">${escapeHtml(v.name)}</td>
            <td class="py-3 px-2">${v.discount_type === 'percent' ? `${Math.round(v.discount_value)}%` : formatVND(v.discount_value)}</td>
            <td class="py-3 px-2">${v.start_date} - ${v.end_date}</td>
            <td class="py-3 px-2">${getStatusLabel(v.status)}</td>
            <td class="py-3 px-2">${v.scope === 'store' ? 'Toàn shop' : 'Sản phẩm cụ thể'}</td>
            <td class="py-3 px-2">
                <button onclick="editVendorVoucher(${v.id})" class="px-2 py-1 rounded border border-pink-300 text-pink-700 text-sm">Sửa</button>
                <button onclick="deleteVendorVoucher(${v.id})" class="ml-2 px-2 py-1 rounded border border-red-300 text-red-600 text-sm">Xóa</button>
            </td>
        </tr>
    `).join('');
}

export async function createVendorVoucher() {
    App.vendor.voucherEditingId = null;
    if ($('vendor-voucher-modal-title')) $('vendor-voucher-modal-title').innerText = 'Tạo khuyến mãi';
    if ($('vendor-voucher-submit')) $('vendor-voucher-submit').innerText = 'Lưu khuyến mãi';
    if ($('vendor-voucher-form')) $('vendor-voucher-form').reset();
    if ($('vendor-voucher-discount-type')) $('vendor-voucher-discount-type').value = 'percent';
    if ($('vendor-voucher-scope')) $('vendor-voucher-scope').value = 'store';
    $('vendor-voucher-modal')?.classList.remove('hidden');
}

export async function editVendorVoucher(voucherId) {
    const voucher = (App.vendor.vouchers || []).find((v) => v.id === voucherId);
    if (!voucher) return;
    App.vendor.voucherEditingId = voucherId;
    if ($('vendor-voucher-modal-title')) $('vendor-voucher-modal-title').innerText = 'Sửa khuyến mãi';
    if ($('vendor-voucher-submit')) $('vendor-voucher-submit').innerText = 'Cập nhật khuyến mãi';
    if ($('vendor-voucher-code')) $('vendor-voucher-code').value = voucher.code || '';
    if ($('vendor-voucher-name')) $('vendor-voucher-name').value = voucher.name || '';
    if ($('vendor-voucher-discount-type')) $('vendor-voucher-discount-type').value = voucher.discount_type || 'percent';
    if ($('vendor-voucher-discount-value')) $('vendor-voucher-discount-value').value = Math.round(Number(voucher.discount_value) || 0);
    if ($('vendor-voucher-start')) $('vendor-voucher-start').value = voucher.start_date || '';
    if ($('vendor-voucher-end')) $('vendor-voucher-end').value = voucher.end_date || '';
    if ($('vendor-voucher-scope')) $('vendor-voucher-scope').value = voucher.scope || 'store';
    $('vendor-voucher-modal')?.classList.remove('hidden');
}

function closeVendorVoucherModal() {
    $('vendor-voucher-modal')?.classList.add('hidden');
    App.vendor.voucherEditingId = null;
}

async function submitVendorVoucherForm(event) {
    event.preventDefault();
    if (vendorLocks.savingVoucher) return;
    vendorLocks.savingVoucher = true;
    const isEdit = !!App.vendor.voucherEditingId;
    setElementLoading('vendor-voucher-submit', true, isEdit ? 'Cập nhật khuyến mãi' : 'Lưu khuyến mãi');
    try {
        const payload = {
            email: App.currentUser.email,
            code: ($('vendor-voucher-code')?.value || '').trim().toUpperCase(),
            name: ($('vendor-voucher-name')?.value || '').trim(),
            discount_type: $('vendor-voucher-discount-type')?.value || 'percent',
            discount_value: Number($('vendor-voucher-discount-value')?.value || 0),
            start_date: $('vendor-voucher-start')?.value || '',
            end_date: $('vendor-voucher-end')?.value || '',
            scope: $('vendor-voucher-scope')?.value || 'store',
        };

        if (!payload.code || !payload.name) {
            showNotification('Vui lòng nhập đầy đủ thông tin voucher.', 'error');
            return;
        }
        if (!payload.start_date || !payload.end_date) {
            showNotification('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.', 'error');
            return;
        }

        const startTs = Date.parse(payload.start_date);
        const endTs = Date.parse(payload.end_date);
        if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
            showNotification('Định dạng ngày không hợp lệ.', 'error');
            return;
        }
        if (endTs < startTs) {
            showNotification('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.', 'error');
            return;
        }
        if (payload.discount_type === 'percent' && (payload.discount_value <= 0 || payload.discount_value > 100)) {
            showNotification('Voucher theo % phải nằm trong khoảng 1-100.', 'error');
            return;
        }
        if (payload.discount_type === 'fixed' && payload.discount_value <= 0) {
            showNotification('Giá trị giảm phải lớn hơn 0.', 'error');
            return;
        }

        const endpoint = isEdit
            ? `${API_BASE_URL}/api/vendor/vouchers/${App.vendor.voucherEditingId}/`
            : `${API_BASE_URL}/api/vendor/vouchers/`;
        const method = isEdit ? 'PUT' : 'POST';

        const data = await fetchApiJson(endpoint, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        closeVendorVoucherModal();
        showNotification(isEdit ? 'Đã cập nhật voucher.' : 'Đã tạo voucher.');
        await loadVendorVouchers();
    } catch (error) {
        showNotification(error.message || 'Lỗi thao tác voucher.', 'error');
    } finally {
        vendorLocks.savingVoucher = false;
        setElementLoading('vendor-voucher-submit', false, isEdit ? 'Cập nhật khuyến mãi' : 'Lưu khuyến mãi');
    }
}

export async function deleteVendorVoucher(voucherId) {
    if (!confirm('Xóa voucher này?')) return;
    if (vendorLocks.deletingVoucherIds.has(voucherId)) return;
    vendorLocks.deletingVoucherIds.add(voucherId);
    try {
        await fetchApiJson(`${API_BASE_URL}/api/vendor/vouchers/${voucherId}/?email=${encodeURIComponent(App.currentUser.email || '')}`, {
            method: 'DELETE',
        });
        showNotification('Đã xóa voucher.');
        await loadVendorVouchers();
    } catch (error) {
        showNotification(error.message || 'Lỗi xóa voucher.', 'error');
    } finally {
        vendorLocks.deletingVoucherIds.delete(voucherId);
    }
}

export async function loadVendorReport() {
    const token = ++requestTokens.report;
    try {
        if ($('vendor-report-total-revenue')) $('vendor-report-total-revenue').innerText = '...';
        if ($('vendor-report-total-orders')) $('vendor-report-total-orders').innerText = '...';
        if ($('vendor-report-cancel-rate')) $('vendor-report-cancel-rate').innerText = '...';
        if ($('vendor-report-total-items')) $('vendor-report-total-items').innerText = '...';
        if ($('vendor-report-top-products')) $('vendor-report-top-products').innerHTML = '<li class="py-1 text-gray-400">Đang tải dữ liệu...</li>';
        if ($('vendor-report-orders-body')) $('vendor-report-orders-body').innerHTML = '<tr><td colspan="6" class="py-4 text-center text-gray-400">Đang tải dữ liệu...</td></tr>';

        const email = encodeURIComponent(App.currentUser.email || '');
        const data = await fetchApiJson(`${API_BASE_URL}/api/vendor/reports/dashboard/?email=${email}`);
        if (token !== requestTokens.report) return;
        App.vendor.report = data;

        if ($('vendor-report-total-revenue')) $('vendor-report-total-revenue').innerText = formatVND(data.overview?.total_revenue || 0);
        if ($('vendor-report-total-orders')) $('vendor-report-total-orders').innerText = String(data.overview?.total_orders || 0);
        if ($('vendor-report-cancel-rate')) $('vendor-report-cancel-rate').innerText = `${data.overview?.cancel_rate || 0}%`;
        if ($('vendor-report-total-items')) $('vendor-report-total-items').innerText = String(data.overview?.total_items_sold || 0);

        const topList = $('vendor-report-top-products');
        if (topList) {
            const topProducts = data.top_products || [];
            topList.innerHTML = topProducts.length
                ? topProducts.map((row) => `<li class="py-1 flex justify-between"><span>${escapeHtml(row.product_name)}</span><span class="font-semibold">${formatVND(row.total_revenue)}</span></li>`).join('')
                : '<li class="py-1 text-gray-500">Chưa có dữ liệu top sản phẩm.</li>';
        }

        const recentBody = $('vendor-report-orders-body');
        if (recentBody) {
            const rows = data.recent_orders || [];
            recentBody.innerHTML = rows.length
                ? rows.map((row) => `
                    <tr class="border-b border-pink-50">
                        <td class="py-2 px-2">${escapeHtml(row.order_code)}</td>
                        <td class="py-2 px-2">${row.created_at}</td>
                        <td class="py-2 px-2">${escapeHtml(row.status_label || row.status)}</td>
                        <td class="py-2 px-2">${escapeHtml(row.payment_method)}</td>
                        <td class="py-2 px-2 text-right">${formatVND(row.amount)}</td>
                        <td class="py-2 px-2 text-center">
                            ${row.can_mark_ready
                                ? `<button onclick="markVendorOrderReady(${row.id})" class="px-2 py-1 rounded bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700">Đóng gói xong</button>`
                                : '<span class="text-xs text-gray-400">-</span>'}
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="6" class="py-4 text-center text-gray-500">Chưa có đơn hàng để thống kê.</td></tr>';
        }
    } catch (error) {
        if ($('vendor-report-total-revenue')) $('vendor-report-total-revenue').innerText = '0₫';
        if ($('vendor-report-total-orders')) $('vendor-report-total-orders').innerText = '0';
        if ($('vendor-report-cancel-rate')) $('vendor-report-cancel-rate').innerText = '0%';
        if ($('vendor-report-total-items')) $('vendor-report-total-items').innerText = '0';
        if ($('vendor-report-top-products')) $('vendor-report-top-products').innerHTML = '<li class="py-1 text-red-500">Không tải được báo cáo.</li>';
        if ($('vendor-report-orders-body')) $('vendor-report-orders-body').innerHTML = '<tr><td colspan="6" class="py-4 text-center text-red-500">Lỗi tải dữ liệu báo cáo.</td></tr>';
        throw error;
    }
}

export async function markVendorOrderReady(orderId) {
    try {
        await fetchApiJson(`${API_BASE_URL}/api/vendor/orders/${orderId}/ready/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: App.currentUser.email }),
        });
        showNotification('Đã cập nhật đơn hàng sang trạng thái chờ shipper lấy hàng.');
        await loadVendorReport();
    } catch (error) {
        showNotification(error.message || 'Không thể cập nhật đơn hàng.', 'error');
    }
}

export async function refreshVendorReport() {
    if (App.vendor.activeTab !== 'report') {
        await loadVendorTab('report');
        return;
    }
    await loadVendorReport();
}

function bindVendorCenterUI() {
    if (App.vendor.uiBound) return;

    const productSearch = $('vendor-products-search');
    const productStatus = $('vendor-products-status-filter');
    const productSort = $('vendor-products-sort');
    const productInStockOnly = $('vendor-products-instock-only');
    const voucherSearch = $('vendor-vouchers-search');
    const voucherStatus = $('vendor-vouchers-status-filter');
    const voucherSort = $('vendor-vouchers-sort');
    const productForm = $('vendor-product-form');
    const voucherForm = $('vendor-voucher-form');
    const storeForm = $('vendor-store-form');
    const storeIconInput = $('vendor-store-profile-icon');
    const productImageInput = $('vendor-product-image');
    const productModal = $('vendor-product-modal');
    const voucherModal = $('vendor-voucher-modal');

    if (productSearch) {
        productSearch.value = App.vendor.filters.productQuery || '';
        productSearch.addEventListener('input', (event) => {
            clearTimeout(uiTimers.productSearch);
            const value = event.target.value || '';
            uiTimers.productSearch = setTimeout(() => {
                App.vendor.filters.productQuery = value;
                persistVendorFilters();
                renderVendorProducts();
            }, 250);
        });
    }
    if (productStatus) {
        productStatus.value = App.vendor.filters.productStatus || 'all';
        productStatus.addEventListener('change', (event) => {
            App.vendor.filters.productStatus = event.target.value || 'all';
            persistVendorFilters();
            renderVendorProducts();
        });
    }
    if (productSort) {
        productSort.value = App.vendor.filters.productSort || 'newest';
        productSort.addEventListener('change', (event) => {
            App.vendor.filters.productSort = event.target.value || 'newest';
            persistVendorFilters();
            renderVendorProducts();
        });
    }
    if (productInStockOnly) {
        productInStockOnly.checked = !!App.vendor.filters.productInStockOnly;
        productInStockOnly.addEventListener('change', (event) => {
            App.vendor.filters.productInStockOnly = !!event.target.checked;
            persistVendorFilters();
            renderVendorProducts();
        });
    }
    if (voucherSearch) {
        voucherSearch.value = App.vendor.filters.voucherQuery || '';
        voucherSearch.addEventListener('input', (event) => {
            clearTimeout(uiTimers.voucherSearch);
            const value = event.target.value || '';
            uiTimers.voucherSearch = setTimeout(() => {
                App.vendor.filters.voucherQuery = value;
                persistVendorFilters();
                renderVendorVouchers();
            }, 250);
        });
    }
    if (voucherStatus) {
        voucherStatus.value = App.vendor.filters.voucherStatus || 'all';
        voucherStatus.addEventListener('change', (event) => {
            App.vendor.filters.voucherStatus = event.target.value || 'all';
            persistVendorFilters();
            renderVendorVouchers();
        });
    }
    if (voucherSort) {
        voucherSort.value = App.vendor.filters.voucherSort || 'newest';
        voucherSort.addEventListener('change', (event) => {
            App.vendor.filters.voucherSort = event.target.value || 'newest';
            persistVendorFilters();
            renderVendorVouchers();
        });
    }
    if (productForm) {
        productForm.addEventListener('submit', submitVendorProductForm);
    }
    if (voucherForm) {
        voucherForm.addEventListener('submit', submitVendorVoucherForm);
    }
    if (storeForm) {
        storeForm.addEventListener('submit', saveVendorStoreProfile);
    }
    if (storeIconInput) {
        storeIconInput.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setStoreLogoPreview(reader.result);
            reader.readAsDataURL(file);
        });
    }
    if (productImageInput) {
        productImageInput.addEventListener('change', (event) => {
            const file = event.target?.files?.[0];
            const preview = $('vendor-product-image-preview');
            if (!preview) return;
            if (!file) {
                preview.classList.add('hidden');
                preview.src = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                preview.src = reader.result;
                preview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        });
    }

    if (productModal) {
        productModal.addEventListener('click', (event) => {
            if (event.target === productModal) closeVendorProductModal();
        });
    }
    if (voucherModal) {
        voucherModal.addEventListener('click', (event) => {
            if (event.target === voucherModal) closeVendorVoucherModal();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        if (!$('vendor-product-modal')?.classList.contains('hidden')) closeVendorProductModal();
        if (!$('vendor-voucher-modal')?.classList.contains('hidden')) closeVendorVoucherModal();
    });

    // Init cascading address selects for store profile
    _initCascadeSelects({
        provinceId: 'store-profile-province-select',
        districtId: 'store-profile-district-select',
        wardId: 'store-profile-ward-select',
    });

    App.vendor.uiBound = true;
}

window.showVendorCenter = showVendorCenter;
window.loadVendorTab = async (tab) => {
    try {
        await loadVendorTab(tab);
    } catch (error) {
        showNotification(error.message || 'Không tải được dữ liệu vendor.', 'error');
    }
};
window.createVendorProduct = createVendorProduct;
window.editVendorProduct = editVendorProduct;
window.softDeleteVendorProduct = softDeleteVendorProduct;
window.createVendorVoucher = createVendorVoucher;
window.editVendorVoucher = editVendorVoucher;
window.deleteVendorVoucher = deleteVendorVoucher;
window.closeVendorProductModal = closeVendorProductModal;
window.closeVendorVoucherModal = closeVendorVoucherModal;
window.initVendorApplyAddress = initVendorApplyAddress;
window.getVendorApplyAddressData = getVendorApplyAddressData;
window.refreshVendorReport = refreshVendorReport;
window.markVendorOrderReady = markVendorOrderReady;

