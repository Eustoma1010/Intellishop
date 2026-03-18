import { App, storeFeedback, $, API_BASE_URL } from './config.js';

// Tối ưu ghép chuỗi URL tĩnh
const getFullUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

export function renderStoreTabs() {
    const container = $('store-tabs-container');
    if (!container) return;

    // Tối ưu: map mảng sau đó gán 1 lần
    container.innerHTML = Object.keys(App.storeInfo).map((storeId, index) => {
        const info = App.storeInfo[storeId];
        const activeClass = App.currentStore == storeId ? 'active' : '';
        const textColor = index >= 3 ? 'text-white' : 'text-gray-800';

        const iconHtml = info.icon
            ? `<img src="${getFullUrl(info.icon)}" alt="${info.name}" class="w-12 h-12 object-contain bg-white rounded-full mb-2 border-2 border-pink-200 shadow-sm mx-auto p-1 transition-transform group-hover:scale-110">`
            : `<div class="w-12 h-12 bg-gray-200 rounded-full mb-2 mx-auto flex items-center justify-center text-gray-400"><i class="fa-solid fa-store"></i></div>`;

        return `
        <div class="store-card group ${activeClass}" id="store-tab-${storeId}" onclick="selectStore(${storeId})" style="background: ${info.bg_color}">
            ${iconHtml}
            <div class="store-name ${textColor} font-bold">${info.name}</div>
            <div class="store-stats ${textColor} opacity-90 text-xs mt-1"><i class="fa-solid fa-star text-yellow-300 mr-1"></i>${info.rating} • Đã bán ${info.sold}</div>
        </div>
        `;
    }).join('');
}

export function renderHotDeals() {
    const container = $('hot-deals-container');
    if (!container) return;

    if (!App.hotDeals || App.hotDeals.length === 0) {
        container.innerHTML = '<div class="col-span-full py-10 text-center text-gray-400 bg-gray-50 rounded-2xl"><i class="fa-solid fa-box-open text-4xl mb-3"></i><p>Hiện tại chưa có Deal Hot nào.</p></div>';
        return;
    }

    container.innerHTML = App.hotDeals.map(p => {
        let badgeHtml = '';
        let priceHtml = `<span class="text-xl font-black text-red-600">${p.price.toLocaleString('en-US')}₫</span>`;

        if (p.old_price && p.old_price > p.price) {
            const percent = Math.round((1 - p.price / p.old_price) * 100);
            badgeHtml = `<span class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">-${percent}%</span>`;
            priceHtml = `
                <span class="text-xl font-black text-red-600">${p.price.toLocaleString('en-US')}₫</span>
                <span class="text-xs text-gray-400 line-through block ml-1">${p.old_price.toLocaleString('en-US')}₫</span>
            `;
        }

        const imageHtml = p.image
            ? `<img loading="lazy" src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">`
            : `<div class="text-gray-300 text-4xl"><i class="fa-solid fa-image"></i></div>`;

        return `
        <div class="bg-white p-3 rounded-2xl relative border border-red-100 hover:border-red-400 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full">
            ${badgeHtml}
            <div class="h-40 sm:h-48 rounded-xl overflow-hidden mb-3 bg-gray-50 flex items-center justify-center relative">
                ${imageHtml}
            </div>
            <h3 class="font-bold text-gray-800 text-sm mb-2 line-clamp-2" title="${p.name}">${p.name}</h3>
            <div class="mt-auto flex items-end justify-between">
                <div>${priceHtml}</div>
                <button onclick="addToCart(${p.id})" class="bg-red-50 text-red-500 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm z-20 relative">
                    <i class="fa-solid fa-cart-plus"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');
}

export function selectStore(storeId) {
    document.querySelectorAll('.store-card').forEach(card => card.classList.remove('active'));
    const activeTab = $(`store-tab-${storeId}`);
    if (activeTab) activeTab.classList.add('active');

    App.currentStore = storeId;
    App.currentVisibleProducts = App.productsPerPage;

    const info = App.storeInfo[storeId];
    if (!info) return;

    const iconDisplay = $('store-icon-display');
    if (iconDisplay) {
        iconDisplay.innerHTML = info.icon
            ? `<img src="${getFullUrl(info.icon)}" alt="${info.name}" class="w-14 h-14 object-contain bg-white rounded-full border border-pink-100 p-1 shadow-sm">`
            : `<div class="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center"><i class="fa-solid fa-store text-pink-400 text-xl"></i></div>`;
    }

    if($('store-name-display')) $('store-name-display').textContent = info.name;
    if($('store-desc-display')) $('store-desc-display').textContent = info.desc;
    if($('store-stats-display')) {
        $('store-stats-display').innerHTML = `
            <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-star text-yellow-500 mr-1"></i>${info.rating}</span>
            <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-box mr-1"></i>Đã bán ${info.sold}</span>
            <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-comment mr-1"></i>${info.reviews} đánh giá</span>
        `;
    }
    if($('feedback-title')) $('feedback-title').textContent = `ĐÁNH GIÁ TỪ KHÁCH HÀNG - ${info.name.toUpperCase()}`;

    renderProducts();
    renderFeedback();
}

export function renderCatalog() {
    const container = $('catalog-filter-container');
    if (!container) return;

    let html = `
        <button onclick="filterByCategory('all')"
            class="px-6 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all shadow-sm ${App.currentCategory === 'all' ? 'bg-pink-600 text-white shadow-pink-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-pink-50 hover:text-pink-600'}">
            Tất cả
        </button>
    `;

    if (App.categories && App.categories.length > 0) {
        html += App.categories.map(c => `
            <button onclick="filterByCategory(${c.id})"
                class="px-6 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all shadow-sm ${App.currentCategory === c.id ? 'bg-pink-600 text-white shadow-pink-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-pink-50 hover:text-pink-600'}">
                ${c.icon ? `<i class="${c.icon} mr-2"></i>` : ''}${c.name}
            </button>
        `).join('');
    }

    container.innerHTML = html;
}

export function filterByCategory(categoryId) {
    App.currentCategory = categoryId;
    App.currentVisibleProducts = App.productsPerPage;
    renderCatalog();
    renderProducts();
}

export function renderProducts() {
    let allProducts = App.storeProducts[App.currentStore] || [];
    if (App.currentCategory !== 'all') {
        allProducts = allProducts.filter(p => p.category_id === App.currentCategory);
    }

    const container = $('product-list');
    const loadMoreContainer = $('load-more-container');
    if (!container) return;

    if (allProducts.length === 0) {
        container.innerHTML = '<div class="col-span-full py-16 text-center text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"><i class="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-50"></i><p class="text-lg">Không tìm thấy sản phẩm nào trong danh mục này.</p></div>';
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        return;
    }

    const visibleProducts = allProducts.slice(0, App.currentVisibleProducts);

    container.innerHTML = visibleProducts.map(p => {
        const imageHtml = p.image
            ? `<img loading="lazy" src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105">`
            : `<div class="text-gray-200 text-5xl flex items-center justify-center h-full"><i class="fa-solid fa-image"></i></div>`;

        return `
        <div class="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative">
            <div class="h-64 sm:h-72 rounded-xl overflow-hidden mb-4 bg-gray-50 relative">
                ${imageHtml}
                <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button onclick="addToCart(${p.id})" class="bg-white text-pink-600 px-6 py-2.5 rounded-full font-bold shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-pink-600 hover:text-white flex items-center">
                        <i class="fa-solid fa-cart-plus mr-2"></i> Thêm ngay
                    </button>
                </div>
            </div>

            <div class="flex flex-col flex-grow px-2 pb-2 text-left">
                <span class="text-[10px] font-bold text-pink-400 mb-1.5 uppercase tracking-wider bg-pink-50 inline-block w-max px-2 py-0.5 rounded">${p.category}</span>
                <h3 class="font-semibold text-gray-800 text-base leading-tight mb-3 line-clamp-2" title="${p.name}">${p.name}</h3>

                <div class="mt-auto flex items-end justify-between">
                    <span class="text-xl font-black text-pink-600">${p.price.toLocaleString('en-US')}₫</span>
                    <button onclick="addToCart(${p.id})" class="lg:hidden bg-pink-50 text-pink-600 w-9 h-9 rounded-full flex items-center justify-center hover:bg-pink-600 hover:text-white transition">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    if (loadMoreContainer) {
        if (App.currentVisibleProducts < allProducts.length) {
            loadMoreContainer.innerHTML = `
                <button onclick="loadMoreProducts()" class="px-8 py-3 bg-white border border-gray-200 text-gray-700 rounded-full font-semibold hover:bg-gray-50 hover:text-pink-600 transition shadow-sm hover:shadow flex items-center mx-auto">
                    Hiển thị thêm sản phẩm <i class="fa-solid fa-chevron-down ml-2"></i>
                </button>
            `;
        } else {
            loadMoreContainer.innerHTML = '';
        }
    }
}

export function loadMoreProducts() {
    App.currentVisibleProducts += App.productsPerPage;
    renderProducts();
}

export function renderFeedback() {
    const feedbacks = storeFeedback[App.currentStore] || [];
    const container = $('feedback-list');
    if (!container) return;

    if(feedbacks.length === 0) {
         container.innerHTML = '<p class="text-gray-400 italic text-sm">Chưa có đánh giá nào.</p>';
         return;
    }

    container.innerHTML = feedbacks.map(f => `
        <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow transition">
            <div class="flex items-center mb-3">
                <div class="w-10 h-10 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-3 shadow-sm">${f.avatar}</div>
                <div>
                    <h4 class="font-bold text-gray-800 text-sm">${f.name}</h4>
                    <div class="flex mt-0.5">${Array(5).fill(0).map((_, i) => `<i class="fa-solid fa-star ${i < f.rating ? 'text-yellow-400' : 'text-gray-200'} text-[10px]"></i>`).join('')}</div>
                </div>
            </div>
            <p class="text-gray-600 text-sm leading-relaxed">"${f.comment}"</p>
            <p class="text-[11px] text-gray-400 mt-3 font-medium"><i class="fa-regular fa-clock mr-1"></i>${f.date}</p>
        </div>
    `).join('');
}

export function scrollStoreTabs(direction) {
    const container = $('store-tabs-container');
    if (!container) return;
    const scrollAmount = 320;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

export function checkScrollButtons() {
    const container = $('store-tabs-container');
    const btnLeft = $('btn-scroll-left');
    const btnRight = $('btn-scroll-right');

    if (!container || !btnLeft || !btnRight) return;

    btnLeft.disabled = container.scrollLeft <= 5;
    btnLeft.style.opacity = btnLeft.disabled ? '0.3' : '1';

    btnRight.disabled = container.scrollLeft >= (container.scrollWidth - container.clientWidth) - 5;
    btnRight.style.opacity = btnRight.disabled ? '0.3' : '1';
}