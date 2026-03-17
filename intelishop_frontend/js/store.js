// Thêm API_BASE_URL vào danh sách import
import { App, storeFeedback, $, API_BASE_URL } from './config.js';

// HÀM MỚI: Tự động ghép nối URL của Backend vào đường dẫn ảnh
const getFullUrl = (path) => {
    if (!path) return '';
    // Nếu path đã là link đầy đủ (ví dụ avatar Google) thì trả về luôn
    if (path.startsWith('http')) return path;

    // Loại bỏ dấu '/' ở cuối API_BASE_URL (nếu có) để tránh lỗi //
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    // Đảm bảo đường dẫn path luôn bắt đầu bằng dấu '/'
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${baseUrl}${cleanPath}`;
};

// 1. RENDER DANH SÁCH THƯƠNG HIỆU
export function renderStoreTabs() {
    const container = $('store-tabs-container');
    if (!container) return;

    container.innerHTML = Object.keys(App.storeInfo).map((storeId, index) => {
        const info = App.storeInfo[storeId];
        const activeClass = App.currentStore == storeId ? 'active' : '';
        const textColor = index >= 3 ? 'text-white' : 'text-gray-800';

        // Cập nhật lấy link ảnh đầy đủ
        const iconHtml = info.icon
            ? `<img src="${getFullUrl(info.icon)}" alt="${info.name}" class="w-12 h-12 object-contain bg-white rounded-full mb-2 border-2 border-pink-200 shadow-sm mx-auto p-1">`
            : `<div class="w-12 h-12 bg-gray-200 rounded-full mb-2 mx-auto flex items-center justify-center text-gray-400"><i class="fa-solid fa-store"></i></div>`;

        return `
        <div class="store-card ${activeClass}" id="store-tab-${storeId}" onclick="selectStore(${storeId})" style="background: ${info.bg_color}">
            ${iconHtml}
            <div class="store-name ${textColor}">${info.name}</div>
            <div class="store-stats ${textColor} opacity-80">${info.rating}★ • Đã bán ${info.sold}</div>
        </div>
        `;
    }).join('');
}

// 2. RENDER VÙNG DEAL HOT
export function renderHotDeals() {
    const container = $('hot-deals-container');
    if (!container) return;

    if (App.hotDeals.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic col-span-4 text-center">Hiện tại chưa có Deal Hot nào.</p>';
        return;
    }

    container.innerHTML = App.hotDeals.map(p => {
        let badgeHtml = '';
        let priceHtml = `<span class="text-xl font-black text-red-600">${p.price.toLocaleString('en-US')}₫</span>`;

        if (p.old_price && p.old_price > p.price) {
            const percent = Math.round((1 - p.price / p.old_price) * 100);
            badgeHtml = `<span class="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md z-10">-${percent}%</span>`;
            priceHtml = `
                <span class="text-xl font-black text-red-600">${p.price.toLocaleString('en-US')}₫</span>
                <span class="text-sm text-gray-400 line-through block">${p.old_price.toLocaleString('en-US')}₫</span>
            `;
        }

        // Cập nhật lấy link ảnh đầy đủ
        const imageHtml = p.image
            ? `<img src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">`
            : `<div class="text-gray-300 text-4xl"><i class="fa-solid fa-image"></i></div>`;

        return `
        <div class="glass-card p-4 relative border border-red-200 hover:border-red-400 overflow-hidden cursor-pointer group">
            ${badgeHtml}
            <div class="h-48 rounded-2xl overflow-hidden mb-4 bg-gray-50 flex items-center justify-center relative">
                ${imageHtml}
            </div>
            <h3 class="font-bold text-gray-800 truncate" title="${p.name}">${p.name}</h3>
            <div class="flex items-center justify-between mt-2">
                <div>${priceHtml}</div>
                <button onclick="addToCart(${p.id})" class="bg-red-100 text-red-600 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition z-20 relative">
                    <i class="fa-solid fa-cart-plus"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// 3. XỬ LÝ KHI CLICK CHỌN THƯƠNG HIỆU
export function selectStore(storeId) {
    document.querySelectorAll('.store-card').forEach(card => card.classList.remove('active'));
    const activeTab = $(`store-tab-${storeId}`);
    if (activeTab) activeTab.classList.add('active');

    App.currentStore = storeId;

    // ĐẶT LẠI SỐ LƯỢNG SẢN PHẨM HIỂN THỊ KHI ĐỔI TAB
    App.currentVisibleProducts = App.productsPerPage;

    const info = App.storeInfo[storeId];
    if (!info) return;

    const iconDisplay = $('store-icon-display');
    if (iconDisplay) {
        iconDisplay.innerHTML = info.icon
            ? `<img src="${getFullUrl(info.icon)}" alt="${info.name}" class="w-12 h-12 object-contain bg-white rounded-full border border-pink-200 p-1">`
            : `<i class="fa-solid fa-store text-pink-500"></i>`;
    }

    if($('store-name-display')) $('store-name-display').textContent = info.name;
    if($('store-desc-display')) $('store-desc-display').textContent = info.desc;
    if($('store-stats-display')) {
        $('store-stats-display').innerHTML = `
            <span class="bg-pink-100 px-3 py-1 rounded-full text-sm font-semibold">${info.rating}★</span>
            <span class="bg-pink-100 px-3 py-1 rounded-full text-sm font-semibold">Đã bán ${info.sold}</span>
            <span class="bg-pink-100 px-3 py-1 rounded-full text-sm font-semibold">${info.reviews} đánh giá</span>
        `;
    }
    if($('feedback-title')) $('feedback-title').textContent = `ĐÁNH GIÁ TỪ KHÁCH HÀNG - ${info.name.toUpperCase()}`;

    renderProducts();
    renderFeedback();
}

export function renderCatalog() {
    const container = $('catalog-filter-container');
    if (!container) return;

    // Nút "Tất cả" mặc định
    let html = `
        <button onclick="filterByCategory('all')"
            class="px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${App.currentCategory === 'all' ? 'bg-pink-600 text-white shadow-md' : 'bg-white text-gray-600 border border-pink-100 hover:bg-pink-50'}">
            Tất cả
        </button>
    `;

    // Vẽ các nút Danh mục lấy từ Database
    html += App.categories.map(c => `
        <button onclick="filterByCategory(${c.id})"
            class="px-6 py-2 rounded-full font-bold whitespace-nowrap transition-all ${App.currentCategory === c.id ? 'bg-pink-600 text-white shadow-md' : 'bg-white text-gray-600 border border-pink-100 hover:bg-pink-50'}">
            ${c.icon ? `<i class="${c.icon} mr-2"></i>` : ''}${c.name}
        </button>
    `).join('');

    container.innerHTML = html;
}

// HÀM XỬ LÝ KHI BẤM NÚT LỌC DANH MỤC
export function filterByCategory(categoryId) {
    App.currentCategory = categoryId;
    App.currentVisibleProducts = App.productsPerPage; // Reset lại số lượng hiển thị (phân trang)
    renderCatalog(); // Đổi màu nút đang chọn
    renderProducts(); // Render lại lưới sản phẩm
}
// CẬP NHẬT HÀM RENDER ĐỂ CHỈ HIỂN THỊ MỘT PHẦN SẢN PHẨM
// CẬP NHẬT HÀM RENDER ĐỂ CHỈ HIỂN THỊ MỘT PHẦN SẢN PHẨM
export function renderProducts() {
    let allProducts = App.storeProducts[App.currentStore] || [];
    if (App.currentCategory !== 'all') {
            allProducts = allProducts.filter(p => p.category_id === App.currentCategory);
        }

    const container = $('product-list');
    const loadMoreContainer = $('load-more-container');
    if (!container) return;
    if (allProducts.length === 0) {
        container.innerHTML = '<p class="text-gray-500 italic col-span-full text-center py-10">Thương hiệu này chưa có sản phẩm nào.</p>';
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        return;
    }

    const visibleProducts = allProducts.slice(0, App.currentVisibleProducts);

    container.innerHTML = visibleProducts.map(p => {
        // Thiết lập ảnh dài chuẩn thời trang (object-top)
        const imageHtml = p.image
            ? `<img src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110">`
            : `<div class="text-gray-300 text-5xl flex items-center justify-center h-full"><i class="fa-solid fa-image"></i></div>`;

        return `
        <div class="bg-white/80 backdrop-blur-md rounded-3xl p-3 border border-pink-100 shadow-sm hover:shadow-[0_20px_40px_rgba(236,72,153,0.15)] transition-all duration-300 group flex flex-col h-full relative">

            <div class="h-64 sm:h-80 rounded-2xl overflow-hidden mb-4 bg-gray-50 relative">
                ${imageHtml}

                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button onclick="addToCart(${p.id})" class="bg-white text-pink-600 px-6 py-3 rounded-full font-bold shadow-2xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-pink-600 hover:text-white flex items-center">
                        <i class="fa-solid fa-cart-plus mr-2 text-lg"></i> Thêm vào giỏ
                    </button>
                </div>
            </div>

            <div class="flex flex-col flex-grow px-2 pb-2 text-left">
                <span class="text-xs font-bold text-pink-400 mb-1 uppercase tracking-wider">${p.category}</span>
                <h3 class="font-bold text-gray-800 text-lg leading-tight mb-3 line-clamp-2" title="${p.name}">${p.name}</h3>

                <div class="mt-auto flex items-end justify-between">
                    <span class="text-2xl font-black text-pink-700">${p.price.toLocaleString('en-US')}₫</span>
                    <button onclick="addToCart(${p.id})" class="lg:hidden bg-pink-100 text-pink-600 w-10 h-10 rounded-full flex items-center justify-center active:bg-pink-300 transition">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    // HIỂN THỊ HOẶC ẨN NÚT "XEM THÊM"
    if (loadMoreContainer) {
        if (App.currentVisibleProducts < allProducts.length) {
            loadMoreContainer.innerHTML = `
                <button onclick="loadMoreProducts()" class="px-8 py-3 bg-white border-2 border-pink-400 text-pink-600 rounded-full font-bold hover:bg-pink-50 transition hover:shadow-md flex items-center">
                    Hiển thị thêm sản phẩm <i class="fa-solid fa-chevron-down ml-2"></i>
                </button>
            `;
        } else {
            loadMoreContainer.innerHTML = '';
        }
    }
}

// HÀM MỚI ĐỂ XỬ LÝ KHI BẤM NÚT "HIỂN THỊ THÊM"
export function loadMoreProducts() {
    App.currentVisibleProducts += App.productsPerPage;
    renderProducts();
}

// 5. RENDER ĐÁNH GIÁ
export function renderFeedback() {
    const feedbacks = storeFeedback[App.currentStore] || [];
    const container = $('feedback-list');
    if (!container) return;

    container.innerHTML = feedbacks.map(f => `
        <div class="feedback-card">
            <div class="flex items-center mb-3">
                <div class="w-10 h-10 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold mr-3 shadow-md">${f.avatar}</div>
                <div>
                    <h4 class="font-bold text-gray-800">${f.name}</h4>
                    <div class="flex">${Array(5).fill(0).map((_, i) => `<i class="fa-solid fa-star ${i < f.rating ? 'text-yellow-400' : 'text-gray-300'} text-xs"></i>`).join('')}</div>
                </div>
            </div>
            <p class="text-gray-600 text-sm">"${f.comment}"</p>
            <p class="text-xs text-gray-400 mt-2 font-medium">${f.date}</p>
        </div>
    `).join('');
}
// HÀM CUỘN CAROUSEL
export function scrollStoreTabs(direction) {
    const container = $('store-tabs-container');
    if (!container) return;

    // Cuộn đi một khoảng bằng độ rộng của 1 thẻ + gap (khoảng 300px)
    const scrollAmount = 300;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// HÀM KIỂM TRA ĐỂ ẨN/HIỆN NÚT TRÁI PHẢI
export function checkScrollButtons() {
    const container = $('store-tabs-container');
    const btnLeft = $('btn-scroll-left');
    const btnRight = $('btn-scroll-right');

    if (!container || !btnLeft || !btnRight) return;

    // Nếu cuộn sát lề trái thì vô hiệu hóa nút trái
    btnLeft.disabled = container.scrollLeft <= 5;

    // Nếu cuộn sát lề phải thì vô hiệu hóa nút phải
    // (Lấy tổng độ rộng cuộn trừ đi độ rộng hiển thị)
    btnRight.disabled = container.scrollLeft >= (container.scrollWidth - container.clientWidth) - 5;
}