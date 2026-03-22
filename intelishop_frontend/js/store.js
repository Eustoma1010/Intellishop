import { App, storeFeedback, $, API_BASE_URL, formatVND } from './config.js';

// Tối ưu ghép chuỗi URL tĩnh
const getFullUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const baseUrl = API_BASE_URL.replace(/\/$/, '');
    return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

const getStoreLogoHtml = (storeId, storeName, extraClass = 'w-10 h-10') => {
    const icon = App.storeInfo?.[storeId]?.icon;
    if (icon) {
        return `<img src="${getFullUrl(icon)}" alt="${storeName || 'Shop'}" class="${extraClass} object-contain bg-white rounded-full border border-pink-100 p-1 shadow-sm">`;
    }
    const initials = (storeName || 'IS').split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
    return `<div class="${extraClass} rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center shadow-sm">${initials}</div>`;
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
        container.innerHTML = '<div class="min-w-full py-10 text-center text-gray-400 bg-gray-50 rounded-2xl"><i class="fa-solid fa-box-open text-4xl mb-3"></i><p>Hiện tại chưa có Deal Hot nào.</p></div>';
        return;
    }

    container.innerHTML = App.hotDeals.map(p => {
        const price = Number(p.price) || 0;
        const oldPrice = Number(p.old_price) || 0;
        const stock = Number(p.stock || 0);
        const inStock = p.in_stock !== false && p.status !== 'out_of_stock' && stock > 0;
        const storeInfo = App.storeInfo?.[p.store] || {};
        let badgeHtml = '';
        let priceHtml = `<span class="text-xl font-black text-red-600">${formatVND(price)}</span>`;

        if (oldPrice > price && oldPrice > 0) {
            const percent = Math.round((1 - price / oldPrice) * 100);
            badgeHtml = `<span class="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">-${percent}%</span>`;
            priceHtml = `
                <span class="text-xl font-black text-red-600">${formatVND(price)}</span>
                <span class="text-xs text-gray-400 line-through block ml-1">${formatVND(oldPrice)}</span>
            `;
        }

        const imageHtml = p.image
            ? `<img loading="lazy" src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-contain transition-transform duration-500 hover:scale-110">`
            : `<div class="text-gray-300 text-4xl"><i class="fa-solid fa-image"></i></div>`;

        const isWishlisted = App.isLoggedIn && App.wishlist.some(w => w.product_id === p.id);
        const heartClass = isWishlisted ? 'fa-solid text-red-500' : 'fa-regular text-gray-400';
        const storeLogoHtml = getStoreLogoHtml(p.store, storeInfo.name || p.store_name, 'w-11 h-11');

        return `
        <div class="hot-deal-card bg-white p-3 rounded-2xl relative border border-red-100 hover:border-red-400 shadow-sm hover:shadow-lg transition-all cursor-pointer group flex flex-col h-full min-w-[280px] sm:min-w-[320px] max-w-[340px] snap-start" onclick="showProductDetail(${p.id})">
            ${badgeHtml}
            <div class="h-40 sm:h-48 rounded-xl overflow-hidden mb-3 bg-gray-50 flex items-center justify-center relative">
                ${imageHtml}
                <span class="absolute left-2 bottom-2 text-[11px] px-2 py-1 rounded-full font-bold ${inStock ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}">${inStock ? `Còn ${stock}` : 'Hết hàng'}</span>
                <button data-wishlist-id="${p.id}" onclick="event.stopPropagation(); toggleWishlist(${p.id})" title="Yêu thích" class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm w-7 h-7 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition z-10">
                    <i class="${heartClass} fa-heart text-xs"></i>
                </button>
            </div>
            <h3 class="font-bold text-gray-800 text-sm mb-2 line-clamp-2" title="${p.name}">${p.name}</h3>
            <div class="mt-auto flex items-end justify-between gap-3">
                <div>
                    ${priceHtml}
                    <div class="mt-3 flex items-center gap-2">
                        ${storeLogoHtml}
                        <div>
                            <p class="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">Cửa hàng</p>
                            <p class="text-sm font-bold text-gray-700 line-clamp-1">${storeInfo.name || p.store_name || 'Intellishop Shop'}</p>
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2 self-end">
                    <button onclick="event.stopPropagation(); showProductDetail(${p.id})" class="text-xs px-2 py-1 rounded border border-pink-200 text-pink-600 hover:bg-pink-50">Chi tiết</button>
                    <button onclick="event.stopPropagation(); addToCart(${p.id})" ${inStock ? '' : 'disabled'} class="bg-red-50 text-red-500 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition shadow-sm z-20 relative disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:text-gray-300">
                        <i class="fa-solid fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    setTimeout(() => checkHotDealScrollButtons(), 0);
}

export async function selectStore(storeId) {
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
    await loadStoreReviews(storeId);
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
    App.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderCatalog();
    renderProducts();
}

export function searchProducts(query) {
    App.searchQuery = query.trim();
    App.currentVisibleProducts = App.productsPerPage;
    renderProducts();
}

export function clearSearch() {
    App.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    renderProducts();
}

export function renderProducts() {
    const isSearchMode = App.searchQuery && App.searchQuery.length > 0;
    let allProducts;

    if (isSearchMode) {
        const query = App.searchQuery.toLowerCase();
        allProducts = Object.values(App.storeProducts)
            .flat()
            .filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));
    } else {
        allProducts = App.storeProducts[App.currentStore] || [];
        if (App.currentCategory !== 'all') {
            allProducts = allProducts.filter(p => p.category_id === App.currentCategory);
        }
    }

    const container = $('product-list');
    const loadMoreContainer = $('load-more-container');
    const searchHeader = $('search-results-header');

    if (searchHeader) {
        if (isSearchMode) {
            searchHeader.innerHTML = `
                <div class="flex items-center gap-3 mb-2 p-4 bg-pink-50 rounded-2xl border border-pink-100">
                    <i class="fa-solid fa-magnifying-glass text-pink-500 text-lg"></i>
                    <span class="font-semibold text-gray-700">Kết quả cho <span class="text-pink-600">"${App.searchQuery}"</span>: <b>${allProducts.length}</b> sản phẩm</span>
                    <button onclick="clearSearch()" class="ml-auto text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition font-semibold">
                        <i class="fa-solid fa-xmark"></i> Xóa
                    </button>
                </div>`;
            searchHeader.classList.remove('hidden');
        } else {
            searchHeader.innerHTML = '';
            searchHeader.classList.add('hidden');
        }
    }

    if (!container) return;

    if (allProducts.length === 0) {
        const emptyMsg = isSearchMode
            ? `<div class="col-span-full py-16 text-center text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"><i class="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-50"></i><p class="text-lg">Không tìm thấy sản phẩm nào cho "<b>${App.searchQuery}</b>".</p><button onclick="clearSearch()" class="mt-4 px-6 py-2 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition">Xóa tìm kiếm</button></div>`
            : '<div class="col-span-full py-16 text-center text-gray-400 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200"><i class="fa-solid fa-magnifying-glass text-5xl mb-4 opacity-50"></i><p class="text-lg">Không tìm thấy sản phẩm nào trong danh mục này.</p></div>';
        container.innerHTML = emptyMsg;
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        return;
    }

    const visibleProducts = allProducts.slice(0, App.currentVisibleProducts);

    container.innerHTML = visibleProducts.map(p => {
        const stock = Number(p.stock || 0);
        const inStock = p.in_stock !== false && p.status !== 'out_of_stock' && stock > 0;
        const imageHtml = p.image
            ? `<img loading="lazy" src="${getFullUrl(p.image)}" alt="${p.name}" class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105">`
            : `<div class="text-gray-200 text-5xl flex items-center justify-center h-full"><i class="fa-solid fa-image"></i></div>`;

        const isWishlisted = App.isLoggedIn && App.wishlist.some(w => w.product_id === p.id);
        const heartClass = isWishlisted ? 'fa-solid text-red-500' : 'fa-regular text-gray-400';
        const storeLabel = isSearchMode ? `<span class="text-[9px] text-gray-400 ml-1 normal-case font-normal">• ${(App.storeInfo[p.store] || {}).name || ''}</span>` : '';

        return `
        <div class="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative cursor-pointer" onclick="showProductDetail(${p.id})">
            <div class="h-64 sm:h-72 rounded-xl overflow-hidden mb-4 bg-gray-50 relative">
                ${imageHtml}
                <span class="absolute left-3 bottom-3 text-[11px] px-2 py-1 rounded-full font-bold ${inStock ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}">${inStock ? `Còn ${stock}` : 'Hết hàng'}</span>
                <div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button onclick="event.stopPropagation(); addToCart(${p.id})" ${inStock ? '' : 'disabled'} class="bg-white text-pink-600 px-6 py-2.5 rounded-full font-bold shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:bg-pink-600 hover:text-white flex items-center disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:text-gray-300">
                        <i class="fa-solid fa-cart-plus mr-2"></i> Thêm ngay
                    </button>
                </div>
                <button data-wishlist-id="${p.id}" onclick="event.stopPropagation(); toggleWishlist(${p.id})" title="Yêu thích" class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition z-10">
                    <i class="${heartClass} fa-heart text-sm"></i>
                </button>
            </div>
            <div class="flex flex-col flex-grow px-2 pb-2 text-left">
                <span class="text-[10px] font-bold text-pink-400 mb-1.5 uppercase tracking-wider bg-pink-50 inline-flex items-center w-max px-2 py-0.5 rounded">${p.category}${storeLabel}</span>
                <h3 class="font-semibold text-gray-800 text-base leading-tight mb-3 line-clamp-2" title="${p.name}">${p.name}</h3>
                <p class="text-xs ${inStock ? 'text-emerald-600' : 'text-red-500'} font-semibold mb-3">${inStock ? `Tồn kho: ${stock}` : 'Tạm hết hàng'}</p>

                <div class="mt-auto flex items-end justify-between">
                    <span class="text-xl font-black text-pink-600">${formatVND(p.price)}</span>
                    <div class="flex items-center gap-2">
                        <button onclick="event.stopPropagation(); showProductDetail(${p.id})" class="text-xs px-2 py-1 rounded border border-pink-200 text-pink-600 hover:bg-pink-50">Chi tiết</button>
                        <button onclick="event.stopPropagation(); addToCart(${p.id})" ${inStock ? '' : 'disabled'} class="lg:hidden bg-pink-50 text-pink-600 w-9 h-9 rounded-full flex items-center justify-center hover:bg-pink-600 hover:text-white transition disabled:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed disabled:hover:text-gray-300">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
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
    const reviewState = App.storeReviews[App.currentStore] || {};
    const feedbacks = reviewState.reviews || storeFeedback[App.currentStore] || [];
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
                    <h4 class="font-bold text-gray-800 text-sm">${f.user_name || f.name}</h4>
                    <div class="flex mt-0.5">${Array(5).fill(0).map((_, i) => `<i class="fa-solid fa-star ${i < f.rating ? 'text-yellow-400' : 'text-gray-200'} text-[10px]"></i>`).join('')}</div>
                </div>
            </div>
            <p class="text-gray-600 text-sm leading-relaxed">"${f.comment || ''}"</p>
            <p class="text-[11px] text-gray-400 mt-3 font-medium"><i class="fa-regular fa-clock mr-1"></i>${f.created_at || f.date || ''}</p>
        </div>
    `).join('');
}

export async function loadStoreReviews(storeId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stores/${storeId}/reviews/`);
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không tải được đánh giá.');
        App.storeReviews[storeId] = {
            stats: data.stats || { avg_rating: 0, total_reviews: 0 },
            reviews: data.reviews || [],
        };

        const info = App.storeInfo[storeId];
        if (info) {
            info.rating = data.stats?.avg_rating ?? info.rating;
            info.reviews = data.stats?.total_reviews ?? info.reviews;
            renderStoreTabs();
            if ($('store-stats-display')) {
                $('store-stats-display').innerHTML = `
                    <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-star text-yellow-500 mr-1"></i>${info.rating || 0}</span>
                    <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-box mr-1"></i>Đã bán ${info.sold || 0}</span>
                    <span class="bg-pink-50 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold border border-pink-100"><i class="fa-solid fa-comment mr-1"></i>${info.reviews || 0} đánh giá</span>
                `;
            }
        }
        renderFeedback();
    } catch (_error) {
        renderFeedback();
    }
}

export async function submitStoreReview(event) {
    event.preventDefault();
    if (!App.isLoggedIn || !App.currentUser?.email) {
        window.showLogin?.();
        return;
    }
    try {
        const payload = {
            email: App.currentUser.email,
            rating: Number($('store-review-rating')?.value || 5),
            comment: ($('store-review-comment')?.value || '').trim(),
        };
        const response = await fetch(`${API_BASE_URL}/api/stores/${App.currentStore}/reviews/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Không thể gửi đánh giá.');
        if ($('store-review-comment')) $('store-review-comment').value = '';
        await loadStoreReviews(App.currentStore);
    } catch (_error) {}
}

export function showProductDetail(productId) {
    // Fix: Use loose equality (==) to match string/number IDs
    const product = Object.values(App.storeProducts || {}).flat().find((p) => p.id == productId);
    if (!product) {
        console.warn(`[showProductDetail] Không tìm thấy sản phẩm ID: ${productId}`);
        return;
    }
    const stock = Number(product.stock || 0);
    const inStock = product.in_stock !== false && product.status !== 'out_of_stock' && stock > 0;

    App.currentProductDetail = product;
    if ($('product-detail-image')) $('product-detail-image').src = getFullUrl(product.image || '');
    if ($('product-detail-name')) $('product-detail-name').innerText = product.name || '';
    if ($('product-detail-category')) $('product-detail-category').innerText = product.category || '';
    if ($('product-detail-price')) $('product-detail-price').innerText = formatVND(product.price);
    if ($('product-detail-store')) $('product-detail-store').innerText = `Cửa hàng: ${(App.storeInfo[product.store] || {}).name || ''}`;
    if ($('product-detail-stock')) $('product-detail-stock').innerText = inStock ? `Tồn kho: ${stock} sản phẩm` : 'Sản phẩm hiện đang hết hàng';
    if ($('product-detail-description')) $('product-detail-description').innerText = product.description || 'Chưa có mô tả chi tiết.';
    if ($('product-detail-add-cart')) {
        $('product-detail-add-cart').onclick = () => {
            window.addToCart?.(product.id);
            if (inStock) closeProductDetail();
        };
        $('product-detail-add-cart').disabled = !inStock;
        $('product-detail-add-cart').innerText = inStock ? 'Thêm vào giỏ' : 'Tạm hết hàng';
        $('product-detail-add-cart').classList.toggle('opacity-60', !inStock);
        $('product-detail-add-cart').classList.toggle('cursor-not-allowed', !inStock);
    }
    $('product-detail-modal')?.classList.remove('hidden');
}

export function closeProductDetail() {
    $('product-detail-modal')?.classList.add('hidden');
}

export function scrollStoreTabs(direction) {
    const container = $('store-tabs-container');
    if (!container) return;
    const scrollAmount = 320;
    container.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

export function scrollHotDeals(direction) {
    const container = $('hot-deals-container');
    if (!container) return;
    container.scrollBy({ left: direction * 340, behavior: 'smooth' });
}

export function checkHotDealScrollButtons() {
    const container = $('hot-deals-container');
    const btnLeft = $('btn-hotdeal-left');
    const btnRight = $('btn-hotdeal-right');
    if (!container || !btnLeft || !btnRight) return;

    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    btnLeft.disabled = container.scrollLeft <= 5;
    btnRight.disabled = container.scrollLeft >= maxScrollLeft - 5;
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