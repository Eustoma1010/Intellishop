import { API_BASE_URL, $, App, formatVND } from './config.js';
import { addToCart, proceedToCheckout } from './cart.js';

const VOICE_CONFIG = {
    silenceShortMs: 1100,
    silenceDefaultMs: 1550,
    silenceLongMs: 2100,
    stableInterimRepeats: 2,
    restartDelayMs: 280,
    duplicateSubmitWindowMs: 2500,
    minMeaningfulChars: 2,
    maxCommaDensity: 0.16,
};

const AI_PANEL_MODE = {
    COMPACT: 'compact',
    EXPANDED: 'expanded',
};

const ASSISTANT_MODE = 'shopping';
const ASSISTANT_GREETING = 'Chào bạn! Mình là chuyên viên tư vấn của Intellishop. Bạn cần tìm trang phục cho dịp nào ạ? ✨';

const AI_STORAGE_KEY = 'intellishop_ai_state_v1';

let aiPanelMode = AI_PANEL_MODE.COMPACT;
let lastUserPrompt = '';
const aiSuggestionCache = {
    signature: '',
    products: [],
};

function saveAIStateToStorage() {
    try {
        if (!App.ai) return;
        const payload = {
            activeAssistant: getActiveAssistantMode(),
            drafts: {
                shopping: App.ai?.drafts?.shopping || '',
            },
            history: {
                shopping: (App.ai?.history?.shopping || []).slice(-40),
            },
        };
        localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(payload));
    } catch (_e) {
        // Ignore storage errors (private mode/quota).
    }
}

function hydrateAIStateFromStorage() {
    try {
        const raw = localStorage.getItem(AI_STORAGE_KEY);
        if (!raw || !App.ai) return;
        const parsed = JSON.parse(raw);
        App.ai.activeAssistant = ASSISTANT_MODE;
        if (parsed?.drafts && typeof parsed.drafts === 'object') {
            App.ai.drafts.shopping = String(parsed.drafts.shopping || '');
        }
        if (parsed?.history && typeof parsed.history === 'object') {
            const safeShopping = Array.isArray(parsed.history.shopping) ? parsed.history.shopping : [];
            App.ai.history.shopping = safeShopping
                .filter((x) => x && (x.sender === 'user' || x.sender === 'bot'))
                .slice(-40);
        }
    } catch (_e) {
        // Ignore malformed persisted data.
    }
}

function getActiveAssistantMode() {
    return ASSISTANT_MODE;
}

function getAssistantHistory(mode = getActiveAssistantMode()) {
    if (!App.ai || !App.ai.history) return [];
    if (!Array.isArray(App.ai.history[mode])) {
        App.ai.history[mode] = [];
    }
    return App.ai.history[mode];
}

function ensureAssistantGreeting(mode = getActiveAssistantMode()) {
    const history = getAssistantHistory(mode);
    if (!history.length) {
        history.push({ sender: 'bot', text: ASSISTANT_GREETING });
    }
}

function getAssistantPlaceholder() {
    return 'Hỏi Intellishop AI...';
}

function setAssistantModeButtonState() {
    // Mode selector buttons removed — no-op
}

function persistDraftForActiveMode() {
    const inputField = $('chat-input');
    if (!inputField || !App.ai?.drafts) return;
    App.ai.drafts[getActiveAssistantMode()] = inputField.value || '';
    saveAIStateToStorage();
}

function restoreDraftForMode(mode = getActiveAssistantMode()) {
    const inputField = $('chat-input');
    if (!inputField || !App.ai?.drafts) return;
    inputField.value = App.ai.drafts[mode] || '';
    inputField.placeholder = getAssistantPlaceholder(mode);
}

function renderChatHistory(mode = getActiveAssistantMode()) {
    const chatMessages = $('chat-messages');
    if (!chatMessages) return;
    ensureAssistantGreeting(mode);
    chatMessages.innerHTML = '';

    getAssistantHistory(mode).forEach((entry) => {
        appendMessage(entry.sender, entry.text, false, true);
    });
}

function pushHistory(sender, text) {
    const history = getAssistantHistory(getActiveAssistantMode());
    history.push({ sender, text });
    if (history.length > 40) history.splice(0, history.length - 40);
    saveAIStateToStorage();
}

function normalizeTextForClipboard(htmlText) {
    const holder = document.createElement('div');
    holder.innerHTML = String(htmlText || '');
    return (holder.textContent || holder.innerText || '').trim();
}

function initChatFeedbackActions() {
    const chatMessages = $('chat-messages');
    if (!chatMessages || chatMessages.dataset.feedbackBound === '1') return;

    chatMessages.dataset.feedbackBound = '1';
    chatMessages.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-chat-action]');
        if (!button) return;

        const action = button.dataset.chatAction;
        const host = button.closest('.bot-feedback-row');
        if (!host) return;

        if (action === 'copy') {
            const messageRoot = button.closest('[data-message-id]');
            const contentEl = messageRoot?.querySelector('.bot-message-content');
            const text = normalizeTextForClipboard(contentEl?.innerHTML || '');
            if (!text) return;
            try {
                await navigator.clipboard.writeText(text);
                button.classList.add('is-active');
                setTimeout(() => button.classList.remove('is-active'), 1000);
            } catch (_err) {
                // Clipboard could be blocked by browser permissions.
            }
            return;
        }

        if (action === 'retry') {
            const retryPrompt = lastUserPrompt || '';
            if (!retryPrompt) return;
            const inputField = $('chat-input');
            if (inputField && !inputField.disabled) {
                inputField.value = retryPrompt;
                sendChatMessage();
            }
            return;
        }

        if (action === 'like' || action === 'dislike') {
            const likeBtn = host.querySelector('button[data-chat-action="like"]');
            const dislikeBtn = host.querySelector('button[data-chat-action="dislike"]');
            if (action === 'like') {
                likeBtn?.classList.toggle('is-active');
                dislikeBtn?.classList.remove('is-active');
            } else {
                dislikeBtn?.classList.toggle('is-active');
                likeBtn?.classList.remove('is-active');
            }
        }
    });
}

export function clearChatHistory() {
    try {
        localStorage.removeItem(AI_STORAGE_KEY);
    } catch (_e) { /* ignore */ }
    if (App.ai) {
        App.ai.history = { shopping: [] };
        App.ai.drafts = { shopping: '' };
    }
    lastUserPrompt = '';
    renderChatHistory(ASSISTANT_MODE);
}

export function switchAssistantMode() {
    // Mode selector removed — keep API stable for existing onclick bindings.
    if (!App.ai) return;
    ensureAssistantGreeting(ASSISTANT_MODE);
    setAssistantModeButtonState();
    renderChatHistory(ASSISTANT_MODE);
    renderAISuggestionPanel(lastUserPrompt, '');
    saveAIStateToStorage();
}

function bindInputDraftSync() {
    const inputField = $('chat-input');
    if (!inputField || inputField.dataset.aiDraftBound === '1') return;
    inputField.dataset.aiDraftBound = '1';
    inputField.addEventListener('input', () => {
        if (!App.ai?.drafts) return;
        App.ai.drafts[getActiveAssistantMode()] = inputField.value || '';
        saveAIStateToStorage();
    });
}

function normalizeAIKeywordText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildAISuggestionSignature() {
    const total = Object.values(App.storeProducts || {}).reduce((sum, list) => sum + ((list || []).length), 0);
    return `${Object.keys(App.storeProducts || {}).length}|${total}`;
}

function flattenCatalogProducts() {
    const signature = buildAISuggestionSignature();
    if (aiSuggestionCache.signature === signature && aiSuggestionCache.products.length) {
        return aiSuggestionCache.products;
    }

    aiSuggestionCache.products = Object.values(App.storeProducts || {})
        .flatMap((products) => products || [])
        .map((product) => ({
            ...product,
            __search_blob: normalizeAIKeywordText([
                product?.name,
                product?.description,
                product?.category,
                product?.store_name,
            ].filter(Boolean).join(' ')),
        }));
    aiSuggestionCache.signature = signature;
    return aiSuggestionCache.products;
}

function extractAIChips(userText, botText) {
    const source = normalizeAIKeywordText(`${userText || ''} ${botText || ''}`);
    const words = source.split(' ').filter((word) => word.length > 2);
    const deduped = [];
    for (const word of words) {
        if (!deduped.includes(word)) deduped.push(word);
        if (deduped.length >= 6) break;
    }
    return deduped;
}

function pickSuggestedProducts(userText, botText) {
    const userTokens = extractAIChips(userText, '');
    const contextTokens = extractAIChips(userText, botText);
    const products = flattenCatalogProducts();
    if (!products.length) return [];

    const scored = products.map((product) => {
        const userScore = userTokens.reduce((sum, token) => (product.__search_blob.includes(token) ? sum + 3 : sum), 0);
        const contextScore = contextTokens.reduce((sum, token) => (product.__search_blob.includes(token) ? sum + 1 : sum), 0);
        const score = userScore + contextScore;
        return { product, score };
    });

    const ranked = scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .map((item) => item.product);

    if (ranked.length) return ranked;
    if (userTokens.length) return [];
    return products.slice(0, 8);
}

function getProductImage(product) {
    const raw = product?.image || product?.image_url || product?.thumbnail || '';
    return getFullAssetUrl(raw);
}

function getFullAssetUrl(path) {
    if (!path) return '';
    if (String(path).startsWith('http')) return String(path);
    const base = String(API_BASE_URL || '').replace(/\/$/, '');
    return `${base}${String(path).startsWith('/') ? path : `/${path}`}`;
}

function getStoreLogoHtml(product) {
    const storeId = Number(product?.store || product?.store_id || 0);
    const storeName = getStoreNameByProduct(product);
    const icon = App.storeInfo?.[storeId]?.icon;
    if (icon) {
        return `<img src="${getFullAssetUrl(icon)}" alt="${escapeHTML(storeName)}" class="ai-mini-store-logo object-contain bg-white rounded-full border border-pink-100 p-1 shadow-sm">`;
    }
    const initials = String(storeName || 'IS').split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
    return `<div class="ai-mini-store-logo rounded-full bg-gradient-to-br from-pink-500 to-purple-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">${escapeHTML(initials || 'IS')}</div>`;
}

function getDeliveryLabel() {
    const eta = new Date();
    eta.setDate(eta.getDate() + 2);
    return `Giao ${eta.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}`;
}

function resolveProductById(productId) {
    const pid = Number(productId || 0);
    if (!pid) return null;
    return Object.values(App.storeProducts || {}).flat().find((product) => Number(product?.id || 0) === pid) || null;
}

function getStoreNameByProduct(product) {
    const storeId = Number(product?.store || product?.store_id || 0);
    return (App.storeInfo?.[storeId] || {}).name || 'Intellishop';
}

function renderAIProductDetail(productId) {
    // Deprecated: always use the main popup modal
    window.showProductDetail?.(productId);
}

function clearAIProductDetail() {
    // No-op: detail panel removed from DOM
}

function escapeHTML(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderAISuggestionPanel(userText = '', botText = '', backendProducts = null) {
    const productContainer = $('ai-suggested-products');
    const intentLabel = $('ai-intent-label');
    if (!productContainer || !intentLabel) return;

    intentLabel.textContent = userText ? `Bạn đang tìm: ${userText}` : 'Chưa có câu hỏi';
    productContainer.dataset.mode = aiPanelMode;

    // Ưu tiên sản phẩm từ backend (RAG + Gemini) → fallback client-side
    const suggested = (Array.isArray(backendProducts) && backendProducts.length > 0)
        ? backendProducts
        : pickSuggestedProducts(userText, botText);
    if (!suggested.length) {
        productContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-8 text-center gap-2">
                <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: rgba(252,231,243,0.7);">
                    <i class="fa-regular fa-face-smile text-2xl text-pink-300"></i>
                </div>
                <p class="text-xs text-pink-400 font-medium">Đặt câu hỏi để nhận<br>gợi ý sản phẩm phù hợp</p>
            </div>`;
        return;
    }

    productContainer.innerHTML = suggested.map((product) => {
        const pid = Number(product?.id || product?.product_id || 0);
        const image = getProductImage(product);
        const safeName = escapeHTML(product?.name || 'Sản phẩm');
        const safeStore = escapeHTML(getStoreNameByProduct(product));
        const stock = Number(product?.stock || 0);
        const inStock = product?.in_stock !== false && product?.status !== 'out_of_stock' && stock > 0;
        const price = formatVND(product?.price || 0);
        return `
            <div class="ai-suggestion-card group" data-product-id="${pid}">
                <div class="ai-suggestion-img-wrap">
                    ${image
                        ? `<img src="${image}" alt="${safeName}" class="ai-suggestion-img">`
                        : `<div class="ai-suggestion-placeholder"><i class="fa-regular fa-image"></i></div>`}
                    <span class="ai-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">${inStock ? `Còn ${stock}` : 'Hết hàng'}</span>
                </div>
                <div class="ai-suggestion-content">
                    <h4 class="ai-suggestion-title" title="${safeName}">${safeName}</h4>

                    <div class="ai-suggestion-store">
                        ${getStoreLogoHtml(product)}
                        <span class="ai-suggestion-store-name">${safeStore}</span>
                    </div>

                    <div class="ai-suggestion-price">${price}</div>

                    <div class="ai-suggestion-actions">
                        <button type="button" class="action-btn detail-btn" data-ai-action="view-detail" data-product-id="${pid}">
                            <i class="fa-regular fa-eye"></i> Xem chi tiết
                        </button>
                        <button type="button" class="action-btn cart-btn" data-ai-action="add-cart" data-product-id="${pid}" ${inStock ? '' : 'disabled'} title="${inStock ? 'Thêm vào giỏ' : 'Hết hàng'}">
                            <i class="fa-solid fa-cart-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function appendInlineProductStrip(userText = '', botText = '', backendProducts = null) {
    const allPicks = (Array.isArray(backendProducts) && backendProducts.length > 0)
        ? backendProducts
        : pickSuggestedProducts(userText, botText);
    const picks = allPicks.slice(0, 4);
    if (!picks.length) return;

    const thumbs = picks.slice(0, 3).map((product) => {
        const image = getProductImage(product);
        const safeName = escapeHTML(product?.name || 'Sản phẩm');
        if (!image) {
            return '<div class="ai-inline-thumb flex items-center justify-center text-slate-300"><i class="fa-regular fa-image"></i></div>';
        }
        return `<img src="${image}" alt="${safeName}" class="ai-inline-thumb">`;
    }).join('');

    const overflowCount = Math.max(0, picks.length - 3);
    const intentText = escapeHTML((userText || '').slice(0, 80)) || 'xem sản phẩm';

    appendMessage('bot', `
        <div class="ai-inline-product-strip">
            ${thumbs}
            ${overflowCount > 0 ? `<div class="ai-inline-overflow">+${overflowCount}</div>` : ''}
            <button class="ai-inline-cta" onclick="searchProducts('${intentText}')">Xem sản phẩm</button>
        </div>
    `);
}

function setAIPanelMode(mode = AI_PANEL_MODE.COMPACT) {
    const panel = $('ai-side-panel');
    const expandIcon = $('ai-expand-icon');
    if (!panel) return;

    aiPanelMode = mode;
    panel.classList.toggle('ai-mode-expanded', mode === AI_PANEL_MODE.EXPANDED);
    panel.classList.toggle('ai-mode-compact', mode !== AI_PANEL_MODE.EXPANDED);

    if (expandIcon) {
        expandIcon.className = mode === AI_PANEL_MODE.EXPANDED
            ? 'fa-solid fa-compress text-lg'
            : 'fa-solid fa-up-right-and-down-left-from-center text-lg';
    }

    if (window.setAvatarViewMode) {
        window.setAvatarViewMode(mode === AI_PANEL_MODE.EXPANDED ? 'full_body' : 'torso');
    }

    if (mode !== AI_PANEL_MODE.EXPANDED) {
        clearAIProductDetail();
    }
}

export function toggleAIPanelExpand() {
    const nextMode = aiPanelMode === AI_PANEL_MODE.EXPANDED ? AI_PANEL_MODE.COMPACT : AI_PANEL_MODE.EXPANDED;
    setAIPanelMode(nextMode);
}

function bindAISuggestionActions() {
    const suggestionRoot = $('ai-suggested-products');
    if (!suggestionRoot || suggestionRoot.dataset.bound === '1') return;
    suggestionRoot.dataset.bound = '1';

    suggestionRoot.addEventListener('click', (event) => {
        const button = event.target.closest('[data-ai-action][data-product-id]');
        if (!button) return;
        const action = button.dataset.aiAction;
        const productId = Number(button.dataset.productId || 0);
        if (!productId) return;

        if (action === 'add-cart') {
            addToCart(productId);
            if (window.setAvatarAction) window.setAvatarAction('cart_add');
            return;
        }

        if (action === 'view-detail') {
            // Always use the main popup modal (z-[200]) so it appears on top of the AI panel
            window.showProductDetail?.(productId);
            return;
        }

        if (action === 'toggle-wishlist') {
            window.toggleWishlist?.(productId);
        }
    });

    suggestionRoot.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const target = event.target.closest('[data-ai-action="view-detail"][data-product-id]');
        if (!target) return;
        event.preventDefault();
        const productId = Number(target.dataset.productId || 0);
        if (!productId) return;
        window.showProductDetail?.(productId);
    });
}

const VOICE_FILLER_REGEX = /(^|\s)(dạ|ờm|ừm|ờ|à|ờ à|ơ|ờ ha|ha|hừm|um|uh|ah|ừ)(?=\s|$)/gi;

const VOICE_REPLACEMENTS = [
    { pattern: /\b(check\s*out|check out|ch[eé]c\s*ao|ch[eé]ck\s*ao|ch[eé]c ao)\b/gi, replacement: 'thanh toán' },
    { pattern: /\b(cart|c[aạ]t|gi[oỏ]\s*đồ)\b/gi, replacement: 'giỏ hàng' },
    { pattern: /\b(voucher|vaucher|vâu chờ|vâu chơ|vou chơ|vou cher|vót chơ)\b/gi, replacement: 'voucher' },
    { pattern: /\b(sale off|sell off|seo off|sêu off)\b/gi, replacement: 'sale off' },
    { pattern: /\b(feed\s*back|feedback|ph[ií]t\s*b[aá]ch|phi[tế]\s*b[aá]ch)\b/gi, replacement: 'feedback' },
    { pattern: /\b(review|ri\s*view|rì\s*viu|reviews)\b/gi, replacement: 'review' },
    { pattern: /\b(local\s*brand|l[oô] cồ\s*brand|lô cồ\s*brand|lâu cồ\s*brand|local\s*brain|local\s*bran)\b/gi, replacement: 'local brand' },
    { pattern: /\b(hoodie|hoodi|hudi|hu đi|hú đi|hút đi|hút đì)\b/gi, replacement: 'hoodie' },
    { pattern: /\b(basic\s*tee|basic tee|b[eê]\s*sic\s*tee|b[eê]\s*sịch\s*tee|basic\s*ti)\b/gi, replacement: 'basic tee' },
    { pattern: /\b(t[-\s]?shirt|tee\s*shirt|ti\s*shirt|ti\s*sơt|t-shirt)\b/gi, replacement: 'áo thun' },
    { pattern: /\b(oversize|over size|ô vơ size|ô vơ sai)\b/gi, replacement: 'oversize' },
    { pattern: /\b(sneaker|snekers|snicker|sneker|xni kơ)\b/gi, replacement: 'sneaker' },
    { pattern: /\b(crop\s*top|cờ rốp\s*tóp|c[rơ]op top)\b/gi, replacement: 'crop top' },
    { pattern: /\b(blazer|bờ\s*l[eâ]i\s*dờ|bờ lai dơ)\b/gi, replacement: 'blazer' },
    { pattern: /\b(cardigan|ca\s*đi\s*gan|car\s*đì\s*gan)\b/gi, replacement: 'cardigan' },
    { pattern: /\b(tote\s*bag|tút\s*b[eé]ch|totebag)\b/gi, replacement: 'tote bag' },
    { pattern: /\b(size\s*mờ|sai\s*em|sai em|size em)\b/gi, replacement: 'size M' },
    { pattern: /\b(size\s*lờ|sai\s*eo|size eo)\b/gi, replacement: 'size L' },
    { pattern: /\b(size\s*e[sx]|size\s*ích\s*ét|sai ích ét)\b/gi, replacement: 'size XS' },
    { pattern: /\b(size\s*xl|size\s*ích eo|sai ích eo)\b/gi, replacement: 'size XL' },
    { pattern: /\b(i\s*phone|ai\s*phone|ai\s*phôn|iphone)\b/gi, replacement: 'iPhone' },
    { pattern: /\b(pro\s*max|pờ\s*rô\s*m[aá]ch|pờ rô max)\b/gi, replacement: 'Pro Max' },
    { pattern: /\b(i\s*pad|ai\s*p[ae]t|ipad)\b/gi, replacement: 'iPad' },
    { pattern: /\b(mac\s*book|m[aá]c\s*búc|macbook)\b/gi, replacement: 'MacBook' },
    { pattern: /\b(air\s*pod|air\s*pods|e\s*pod|eo\s*pót|airpod)\b/gi, replacement: 'AirPods' },
    { pattern: /\b(mag\s*safe|m[aá]c\s*s[eê]p|m[aá]c\s*safe|magsafe)\b/gi, replacement: 'MagSafe' },
    { pattern: /\b(case|k[eê]i[sx]|cây\s*sờ|kei[sx])\b/gi, replacement: 'ốp lưng' },
    { pattern: /\b(samsung|sam sung|xam\s*xung|sam\s*xung)\b/gi, replacement: 'Samsung' },
    { pattern: /\b(full\s*box|phun\s*bóc|fullbox)\b/gi, replacement: 'full box' },
    { pattern: /\b(authentic|authen|ô\s*then\s*tích|o ten tích)\b/gi, replacement: 'chính hãng' },
    { pattern: /\b(ship\s*nhanh|si[pb]\s*nhanh|shipping\s*nhanh)\b/gi, replacement: 'giao nhanh' },
    { pattern: /\b(free\s*ship|phi\s*sip|fri\s*ship|freeship)\b/gi, replacement: 'miễn phí vận chuyển' },
    { pattern: /\b(combo|com\s*bo|côm\s*bô)\b/gi, replacement: 'combo' },
    { pattern: /\b(set\s*đồ|sét\s*đồ|set do)\b/gi, replacement: 'set đồ' },
    { pattern: /\b(order|o\s*đơ|o đờ|oder)\b/gi, replacement: 'đơn hàng' },
    { pattern: /\b(cancel|c[aâ]n\s*sồ|h[uỷy]\s*đơn)\b/gi, replacement: 'hủy đơn' },
    { pattern: /\b(return|đổi\s*trả|ri\s*tơn|refund|ri\s*phăn)\b/gi, replacement: 'đổi trả' },
    { pattern: /\b(cod|c\s*o\s*d|tiền\s*mặt)\b/gi, replacement: 'thanh toán khi nhận hàng' },
    { pattern: /\b(online\s*payment|pay\s*online|pây\s*on\s*lai|chuyển\s*khoản)\b/gi, replacement: 'thanh toán online' },
    { pattern: /\b(promo\s*code|promotion|pro\s*mô\s*c[oô]t|mã\s*giảm\s*giá)\b/gi, replacement: 'mã giảm giá' },
    { pattern: /\b(jean|jeans|jin|quần\s*jin)\b/gi, replacement: 'quần jeans' },
    { pattern: /\b(denim|de\s*nim|đe\s*nim)\b/gi, replacement: 'denim' },
    { pattern: /\b(jacket|ja\s*kẹt|áo\s*khoác)\b/gi, replacement: 'áo khoác' },
    { pattern: /\b(sweater|sweter|suê\s*tơ|áo\s*len)\b/gi, replacement: 'sweater' },
    { pattern: /\b(bomber|bom\s*bơ)\b/gi, replacement: 'bomber' },
    { pattern: /\b(unisex|uni\s*sex|iu\s*ni\s*sex)\b/gi, replacement: 'unisex' },
    { pattern: /\b(slim\s*fit|slimfit|xlim\s*fit)\b/gi, replacement: 'slim fit' },
    { pattern: /\b(regular\s*fit|r[eê]\s*gu\s*la\s*fit|r[eê]gular fit)\b/gi, replacement: 'regular fit' },
    { pattern: /\b(keyboard|ki\s*b[oọ]t|bàn\s*phím)\b/gi, replacement: 'bàn phím' },
    { pattern: /\b(mouse|m[aau]\s*sơ|chuột\s*máy\s*tính)\b/gi, replacement: 'chuột máy tính' },
    { pattern: /\b(bluetooth|blu\s*tút|blue\s*tooth)\b/gi, replacement: 'bluetooth' },
    { pattern: /\b(earphone|tai\s*nghe|ia\s*phôn|headphone|h[eé]t\s*phôn)\b/gi, replacement: 'tai nghe' },
    { pattern: /\b(charger|sạc|cha\s*giờ|củ\s*sạc)\b/gi, replacement: 'sạc' },
    { pattern: /\b(power\s*bank|pau\s*beng|pin\s*dự\s*phòng)\b/gi, replacement: 'pin dự phòng' },
    { pattern: /\b(smart\s*watch|smartwatch|đồng\s*hồ\s*thông\s*minh)\b/gi, replacement: 'đồng hồ thông minh' },
];

const CATALOG_MAX_PHRASE_WORDS = 5;
const CATALOG_TERM_LIMIT = 420;
const CATALOG_SINGLE_WORD_BLOCKLIST = new Set([
    'áo', 'quần', 'shop', 'store', 'hàng', 'sản phẩm', 'khác', 'mới', 'hot', 'deal', 'combo', 'set',
]);

const catalogVoiceIndex = {
    signature: '',
    exactMap: new Map(),
};

function stripDiacritics(text) {
    return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCatalogKey(text) {
    const cleaned = stripDiacritics(String(text || '').toLowerCase())
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return cleaned;
}

function getCatalogVoiceSignature() {
    const storeCount = Object.keys(App.storeInfo || {}).length;
    const categoryCount = Array.isArray(App.categories) ? App.categories.length : 0;
    const productCount = Object.values(App.storeProducts || {}).reduce((sum, list) => sum + ((list || []).length), 0);
    return `${storeCount}|${categoryCount}|${productCount}`;
}

function addCatalogTerm(map, rawTerm) {
    const canonical = dedupeWhitespace(String(rawTerm || ''));
    if (!canonical) return;

    const words = canonical.split(/\s+/).filter(Boolean);
    const oneWordLower = canonical.toLowerCase();
    if (words.length === 1 && (canonical.length < 5 || CATALOG_SINGLE_WORD_BLOCKLIST.has(oneWordLower))) return;

    const key = normalizeCatalogKey(canonical);
    if (!key || key.length < 3 || map.has(key)) return;
    map.set(key, canonical);
}

function rebuildCatalogVoiceIndex() {
    const nextMap = new Map();

    Object.values(App.storeProducts || {}).forEach((products) => {
        (products || []).forEach((product) => {
            addCatalogTerm(nextMap, product?.name || '');
            addCatalogTerm(nextMap, product?.category || '');
            addCatalogTerm(nextMap, product?.store_name || '');
        });
    });

    Object.values(App.storeInfo || {}).forEach((store) => {
        addCatalogTerm(nextMap, store?.name || '');
    });

    (App.categories || []).forEach((category) => {
        addCatalogTerm(nextMap, category?.name || '');
    });

    if (nextMap.size > CATALOG_TERM_LIMIT) {
        const trimmed = new Map();
        Array.from(nextMap.entries()).slice(0, CATALOG_TERM_LIMIT).forEach(([k, v]) => trimmed.set(k, v));
        catalogVoiceIndex.exactMap = trimmed;
    } else {
        catalogVoiceIndex.exactMap = nextMap;
    }
    catalogVoiceIndex.signature = getCatalogVoiceSignature();
}

function ensureCatalogVoiceIndexFresh() {
    const currentSignature = getCatalogVoiceSignature();
    if (catalogVoiceIndex.signature !== currentSignature) {
        rebuildCatalogVoiceIndex();
    }
}

function correctCatalogPhrases(text) {
    ensureCatalogVoiceIndexFresh();
    if (!catalogVoiceIndex.exactMap.size) return text;

    const words = dedupeWhitespace(text).split(' ').filter(Boolean);
    if (!words.length) return text;

    const corrected = [];
    for (let i = 0; i < words.length;) {
        let matched = null;
        const maxWindow = Math.min(CATALOG_MAX_PHRASE_WORDS, words.length - i);
        for (let span = maxWindow; span >= 1; span -= 1) {
            const candidate = words.slice(i, i + span).join(' ');
            const key = normalizeCatalogKey(candidate);
            const canonical = catalogVoiceIndex.exactMap.get(key);
            if (canonical) {
                matched = { canonical, span };
                break;
            }
        }

        if (matched) {
            corrected.push(matched.canonical);
            i += matched.span;
        } else {
            corrected.push(words[i]);
            i += 1;
        }
    }

    return corrected.join(' ');
}

function dedupeWhitespace(text) {
    return text.replace(/\s+/g, ' ').trim();
}

function cleanupVoicePunctuation(text) {
    return text
        .replace(/\s*[,،]+\s*/g, ', ')
        .replace(/,{2,}/g, ',')
        .replace(/\s+([,.;!?])/g, '$1')
        .replace(/([,.;!?])(?!\s|$)/g, '$1 ')
        .replace(/^\s*[,.;!?]+\s*/g, '')
        .replace(/\s*[,.;!?]+\s*$/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function removePauseCommaArtifacts(text) {
    if (!text) return '';
    let normalized = String(text);

    normalized = normalized
        // Safari/Chrome speech often emits repetitive commas when user pauses.
        .replace(/\s*[,،]+\s*/g, ', ')
        .replace(/(^|\s),(?=\s|$)/g, ' ')
        .replace(/\s+,/g, ',')
        .replace(/,(\s*,)+/g, ', ')
        .replace(/([\p{L}\d]{1,3})\s*,\s+(?=[\p{L}\d]{1,3}\b)/gu, '$1 ')
        .replace(/\b(và|với|hoặc|rồi|xong|cho|còn|mà|nhưng)\s*,\s*/gi, '$1 ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    const words = normalized.split(/\s+/).filter(Boolean);
    const commaCount = (normalized.match(/,/g) || []).length;
    const commaDensity = words.length ? commaCount / words.length : 0;
    if (commaDensity > VOICE_CONFIG.maxCommaDensity && words.length < 16) {
        normalized = normalized.replace(/,/g, ' ');
    }

    return dedupeWhitespace(normalized);
}

function removeVoiceFillers(text) {
    return dedupeWhitespace(text.replace(VOICE_FILLER_REGEX, ' '));
}

function normalizeCommonVietnameseMishears(text) {
    let normalized = text;
    VOICE_REPLACEMENTS.forEach(({ pattern, replacement }) => {
        normalized = normalized.replace(pattern, replacement);
    });
    return normalized;
}

export function normalizeVoiceTranscript(input) {
    if (!input) return '';
    let text = String(input)
        .normalize('NFC')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"');

    text = removeVoiceFillers(text);
    text = removePauseCommaArtifacts(text);
    text = normalizeCommonVietnameseMishears(text);
    text = correctCatalogPhrases(text);
    text = text
        .replace(/\bgi[oỏ]\s*h[aà]ng\s*h[aà]ng\b/gi, 'giỏ hàng')
        .replace(/\bthanh\s*to[aá]n\s*ngay\s*ngay\b/gi, 'thanh toán ngay')
        .replace(/\b(iphone)\s*(\d{2})\b/gi, 'iPhone $2')
        .replace(/\b(size)\s*([xmls]{1,3})\b/gi, (_m, prefix, value) => `${prefix} ${String(value).toUpperCase()}`)
        .replace(/\b(pro max)\b/gi, 'Pro Max');

    return cleanupVoicePunctuation(dedupeWhitespace(text));
}

function normalizeInterimSegment(input) {
    const cleaned = removePauseCommaArtifacts(String(input || ''));
    return normalizeVoiceTranscript(cleaned);
}

function isMeaningfulTranscript(input) {
    const normalized = normalizeForComparison(input || '');
    const compact = normalized.replace(/\s+/g, '');
    return compact.length >= VOICE_CONFIG.minMeaningfulChars;
}

function finalizeVoiceTranscriptFromBuffers(sourceText = '') {
    // Fix: Prioritize sourceText if available to avoid duplication
    if (sourceText) {
        return normalizeVoiceTranscript(dedupeWhitespace(sourceText));
    }
    const raw = dedupeWhitespace([
        finalMessageBuffer,
        lastStableInterim,
        $('chat-input')?.value || '',
    ].filter(Boolean).join(' '));
    return normalizeVoiceTranscript(raw);
}

function normalizeForComparison(input) {
    return normalizeVoiceTranscript(input)
        .toLowerCase()
        .replace(/[.,!?;:]/g, '')
        .trim();
}

function appendFinalSegment(buffer, segment) {
    const cleanedSegment = normalizeInterimSegment(segment);
    if (!cleanedSegment) return buffer;
    const current = dedupeWhitespace(buffer);
    const currentCompare = normalizeForComparison(current);
    const segmentCompare = normalizeForComparison(cleanedSegment);
    if (!segmentCompare) return current;
    if (currentCompare.endsWith(segmentCompare)) return current;
    return dedupeWhitespace([current, cleanedSegment].filter(Boolean).join(' '));
}

function estimateSilenceTimeout(transcript) {
    const text = normalizeVoiceTranscript(transcript);
    const wordCount = text ? text.split(/\s+/).length : 0;
    const trailingContinuation = /(và|với|hoặc|rồi|xong|cho|còn|mà|nhưng)$/i.test(text);
    if (trailingContinuation || wordCount >= 12) return VOICE_CONFIG.silenceLongMs;
    if (wordCount <= 3) return VOICE_CONFIG.silenceShortMs;
    return VOICE_CONFIG.silenceDefaultMs;
}

function setMicVisualState(isListening) {
    const micBtn = $('mic-btn');
    if (!micBtn) return;
    if (isListening) {
        micBtn.classList.remove('text-pink-500', 'hover:bg-pink-50');
        micBtn.classList.add('bg-gradient-to-r', 'from-pink-500', 'to-purple-500', 'text-white', 'animate-pulse');
    } else {
        micBtn.classList.remove('bg-gradient-to-r', 'from-pink-500', 'to-purple-500', 'text-white', 'animate-pulse');
        micBtn.classList.add('text-pink-500', 'hover:bg-pink-50');
    }
}

function clearVoiceTimers() {
    if (silenceTimeout) clearTimeout(silenceTimeout);
    if (recognitionRestartTimeout) clearTimeout(recognitionRestartTimeout);
    silenceTimeout = null;
    recognitionRestartTimeout = null;
}

function resetVoiceBuffers() {
    finalMessageBuffer = '';
    lastStableInterim = '';
    lastInterimNormalized = '';
    stableInterimRepeatCount = 0;
}

function setInputState(isDisabled, placeholderText) {
    const inputField = $('chat-input');
    const sendBtn = document.querySelector('button[onclick="sendChatMessage()"]');
    if (!inputField) return;

    inputField.disabled = isDisabled;
    if (placeholderText) inputField.placeholder = placeholderText;

    if (isDisabled) {
        inputField.classList.add('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
        inputField.classList.remove('bg-pink-50/50');
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.remove('hover:shadow-lg', 'hover:scale-105', 'hover:opacity-90');
        }
    } else {
        inputField.classList.remove('bg-gray-100', 'cursor-not-allowed', 'opacity-80');
        inputField.classList.add('bg-white');
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            sendBtn.classList.add('hover:shadow-lg', 'hover:scale-105');
        }
    }
}

export function toggleAIPanel() {
    const panel = $('ai-side-panel');
    const toggleBtn = $('chat-toggle-btn');
    const backdrop = $('ai-panel-backdrop');
    if (!panel || !toggleBtn) return;

    if (panel.classList.contains('translate-x-full')) {
        panel.classList.remove('translate-x-full');
        toggleBtn.classList.add('hidden');
        if (backdrop) backdrop.classList.remove('hidden');
        setAssistantModeButtonState(getActiveAssistantMode());
        restoreDraftForMode(getActiveAssistantMode());
        setAIPanelMode(aiPanelMode);
        if (getActiveAssistantMode() === ASSISTANT_MODE) {
            renderAISuggestionPanel(lastUserPrompt, '');
        }
        setTimeout(() => { const input = $('chat-input'); if(input) input.focus(); }, 300);
    } else {
        panel.classList.add('translate-x-full');
        toggleBtn.classList.remove('hidden');
        if (backdrop) backdrop.classList.add('hidden');
        setAIPanelMode(aiPanelMode);
    }
}

export function handleChatKeyPress(event) {
    if (event.key === 'Enter') sendChatMessage();
}

export async function sendChatMessage() {
    const inputField = $('chat-input');
    if (!inputField) return;

    const message = inputField.value.trim();
    if (!message || inputField.disabled) return;

    lastUserPrompt = message;
    appendMessage('user', message);
    pushHistory('user', message);
    inputField.value = '';
    if (App.ai?.drafts) App.ai.drafts[getActiveAssistantMode()] = '';
    saveAIStateToStorage();

    const formData = new FormData();
    formData.append('message', message);
    await processAIRequest(formData);
}

// KHỞI TẠO SPEECH API AN TOÀN
let recognition = null;
let isCallMode = false;
let silenceTimeout = null;
let recognitionRestartTimeout = null;
let finalMessageBuffer = '';
let lastStableInterim = '';
let lastInterimNormalized = '';
let stableInterimRepeatCount = 0;
let isVoiceWaitingForAI = false;
let lastSubmittedVoiceMessage = '';
let lastSubmittedVoiceAt = 0;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 3;
}

export async function toggleVoiceRecording() {
    const inputField = $('chat-input');
    if (!inputField) return;

    if (!recognition) {
        alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome.");
        return;
    }

    if (isCallMode) {
        isCallMode = false;
        isVoiceWaitingForAI = false;
        try { recognition.stop(); } catch(e) {}
        clearVoiceTimers();
        resetVoiceBuffers();

        setMicVisualState(false);
        if (window.setAvatarAction) window.setAvatarAction('idle');
        setInputState(false, "Nhập tin nhắn...");
        inputField.value = '';
        return;
    }

    isCallMode = true;
    isVoiceWaitingForAI = false;
    resetVoiceBuffers();
    inputField.value = "";

    setMicVisualState(true);
    if (window.setAvatarAction) window.setAvatarAction('listening');
    setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");

    try { recognition.start(); } catch (e) { console.warn("Mic đã đang bật."); }
}

function submitRecognizedVoiceMessage(sourceText) {
    const inputField = $('chat-input');
    const finalMessage = finalizeVoiceTranscriptFromBuffers(sourceText);
    if (!isMeaningfulTranscript(finalMessage)) return;

    const normalizedCompare = normalizeForComparison(finalMessage);
    const now = Date.now();
    if (normalizedCompare && normalizedCompare === lastSubmittedVoiceMessage && (now - lastSubmittedVoiceAt) < VOICE_CONFIG.duplicateSubmitWindowMs) {
        return;
    }

    lastSubmittedVoiceMessage = normalizedCompare;
    lastSubmittedVoiceAt = now;
    isVoiceWaitingForAI = true;
    clearVoiceTimers();
    try { recognition.stop(); } catch (_e) {}

    if (inputField) inputField.value = '';
    resetVoiceBuffers();

    lastUserPrompt = finalMessage;
    appendMessage('user', finalMessage);
    pushHistory('user', finalMessage);
    const formData = new FormData();
    formData.append('message', finalMessage);
    processAIRequest(formData, true);
}

if (recognition) {
    recognition.onresult = (event) => {
        if (!isCallMode || isVoiceWaitingForAI) return;
        clearVoiceTimers();

        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
                finalMessageBuffer = appendFinalSegment(finalMessageBuffer, transcript);
            } else {
                interimTranscript += ` ${transcript}`;
            }
        }

        const normalizedInterim = normalizeInterimSegment(interimTranscript);
        if (normalizedInterim && normalizedInterim === lastInterimNormalized) {
            stableInterimRepeatCount += 1;
        } else {
            lastInterimNormalized = normalizedInterim;
            stableInterimRepeatCount = normalizedInterim ? 1 : 0;
        }

        if (stableInterimRepeatCount >= VOICE_CONFIG.stableInterimRepeats) {
            lastStableInterim = normalizedInterim;
        }

        const displayText = normalizeVoiceTranscript(dedupeWhitespace([finalMessageBuffer, lastStableInterim || normalizedInterim].filter(Boolean).join(' ')));
        const inputField = $('chat-input');
        if (inputField) inputField.value = displayText;

        if (isMeaningfulTranscript(displayText)) {
            const timeoutMs = estimateSilenceTimeout(displayText);
            silenceTimeout = setTimeout(() => submitRecognizedVoiceMessage(displayText), timeoutMs);
        }
    };

    recognition.onerror = (event) => {
        if (!isCallMode) return;
        if (event.error && !['no-speech', 'aborted'].includes(event.error)) {
            console.warn('Lỗi mic:', event.error);
        }

        if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) {
            isCallMode = false;
            isVoiceWaitingForAI = false;
            clearVoiceTimers();
            resetVoiceBuffers();
            setMicVisualState(false);
            setInputState(false, 'Nhập tin nhắn...');
        }
    };

    recognition.onend = () => {
        if (!isCallMode || isVoiceWaitingForAI) return;
        recognitionRestartTimeout = setTimeout(() => {
            if (!isCallMode || isVoiceWaitingForAI) return;
            try { recognition.start(); } catch (_e) {}
        }, VOICE_CONFIG.restartDelayMs);
    };
}

export async function processAIRequest(formData, isVoice = false) {
    const userPrompt = String(formData.get('message') || '').trim();
    if (userPrompt) {
        lastUserPrompt = userPrompt;
    }
    if (isVoice) {
        isVoiceWaitingForAI = true;
    }
    setInputState(true, "AI đang suy nghĩ...");
    const typingId = appendMessage('bot', '<i class="fa-solid fa-circle-notch fa-spin text-pink-400"></i> Đang phân tích...', true);
    if (window.setAvatarAction) window.setAvatarAction('thinking');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error("Server Error");

        const data = await response.json();
        removeMessage(typingId);

        if (data.success) {
            const formattedReply = data.reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<b class="text-pink-700">$1</b>');
            appendMessage('bot', formattedReply);
            pushHistory('bot', formattedReply);

            // Sử dụng sản phẩm gợi ý từ backend (RAG + Gemini) thay vì client-side matching
            const serverProducts = Array.isArray(data.suggested_products) ? data.suggested_products : null;

            if (getActiveAssistantMode() === ASSISTANT_MODE) {
                renderAISuggestionPanel(lastUserPrompt, data.reply || '', serverProducts);
                appendInlineProductStrip(lastUserPrompt, data.reply || '', serverProducts);
            }

            if (data.action && data.action.type !== 'none') {
                if (data.action.type === 'add_to_cart' && data.action.product_id) {
                    addToCart(data.action.product_id);
                    if (window.setAvatarAction) window.setAvatarAction('cart_add');
                    const autoAddedMsg = `<i class="text-green-600 text-sm">*Đã tự động thêm vào giỏ hàng*</i>`;
                    appendMessage('bot', autoAddedMsg);
                    pushHistory('bot', autoAddedMsg);
                } else if (data.action.type === 'checkout') {
                    if (window.setAvatarAction) window.setAvatarAction('checkout');
                    proceedToCheckout();
                }
            }

            if (data.audio_url) {
                if (window.setAvatarAction) window.setAvatarAction('explaining');
                setInputState(true, "AI đang trả lời...");

                if (window.playAvatarAudio) {
                    window.playAvatarAudio(data.audio_url);
                } else {
                    const audio = new Audio(data.audio_url);
                    audio.play().catch(e => console.error("Autoplay bị chặn", e));
                    audio.onended = () => window.dispatchEvent(new Event('ai-audio-ended'));
                }
            } else {
                if (window.setAvatarAction) window.setAvatarAction('idle');
                window.dispatchEvent(new Event('ai-audio-ended'));
            }
        } else {
             const errorReply = 'Hệ thống báo lỗi: ' + data.reply;
             appendMessage('bot', errorReply);
             pushHistory('bot', errorReply);
             if (window.setAvatarAction) window.setAvatarAction('error', 3000);
             window.dispatchEvent(new Event('ai-audio-ended'));
        }
    } catch (error) {
        removeMessage(typingId);
        const failMsg = '<span class="text-red-500">Lỗi kết nối đến máy chủ AI!</span>';
        appendMessage('bot', failMsg);
        pushHistory('bot', failMsg);
        if (window.setAvatarAction) window.setAvatarAction('error', 3000);
        window.dispatchEvent(new Event('ai-audio-ended'));
    }
}

window.addEventListener('ai-audio-ended', () => {
    if (isCallMode) {
        isVoiceWaitingForAI = false;
        resetVoiceBuffers();
        if (window.setAvatarAction) window.setAvatarAction('listening');
        setInputState(true, "Đang nghe... (Tự động gửi khi bạn dừng nói)");
        recognitionRestartTimeout = setTimeout(() => {
            try { recognition.start(); } catch (_e) {}
        }, VOICE_CONFIG.restartDelayMs);
    } else {
        isVoiceWaitingForAI = false;
        if (window.setAvatarAction) window.setAvatarAction('idle');
        setMicVisualState(false);
        setInputState(false, "Nhập tin nhắn...");
    }
});

export function appendMessage(sender, text, isTyping = false, skipHistoryRender = false) {
    const chatMessages = $('chat-messages');
    if (!chatMessages) return null;

    const msgDiv = document.createElement('div');
    const msgId = `msg-${Date.now()}`;
    msgDiv.id = msgId;

    if (sender === 'user') {
        msgDiv.className = 'flex items-start justify-end space-x-2 mb-4';
        msgDiv.innerHTML = `<div class="text-white p-3.5 rounded-2xl rounded-tr-none shadow-sm text-sm max-w-[85%] break-words" style="background: linear-gradient(135deg, #ec4899, #a855f7);">${text}</div>`;
    } else {
        msgDiv.className = `flex items-start space-x-3 mb-4 ${isTyping ? 'opacity-70' : ''} animate-fade-in-up`;
        msgDiv.innerHTML = `
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 shadow-sm" style="background: linear-gradient(135deg, #ec4899, #a855f7);"><i class="fa-solid fa-robot"></i></div>
            <div class="max-w-[85%]" data-message-id="${msgId}">
                <div class="bot-message-content p-3.5 rounded-2xl rounded-tl-none shadow-sm text-sm text-pink-900 break-words leading-relaxed" style="background: rgba(255,255,255,0.9); border: 1px solid rgba(244,114,182,0.2);">${text}</div>
                ${isTyping ? '' : `
                    <div class="bot-feedback-row">
                        <button type="button" data-chat-action="copy" title="Sao chép"><i class="fa-regular fa-copy"></i></button>
                        <button type="button" data-chat-action="like" title="Hữu ích"><i class="fa-regular fa-thumbs-up"></i></button>
                        <button type="button" data-chat-action="dislike" title="Chưa tốt"><i class="fa-regular fa-thumbs-down"></i></button>
                        <button type="button" data-chat-action="retry" title="Gửi lại câu vừa hỏi"><i class="fa-solid fa-rotate-right"></i></button>
                    </div>
                `}
            </div>
        `;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });

    if (!skipHistoryRender && !isTyping) {
        // keep chat input placeholder aligned with active assistant mode
        const inputField = $('chat-input');
        if (inputField) inputField.placeholder = getAssistantPlaceholder(getActiveAssistantMode());
    }

    return msgId;
}

export function removeMessage(id) {
    const el = $(id);
    if (el) el.remove();
}

// Ensure panel starts in compact mode and renders initial suggestions.
hydrateAIStateFromStorage();
ensureAssistantGreeting(ASSISTANT_MODE);
setAssistantModeButtonState();
initChatFeedbackActions();
bindAISuggestionActions();
bindInputDraftSync();
renderChatHistory(ASSISTANT_MODE);
restoreDraftForMode(ASSISTANT_MODE);
setAIPanelMode(AI_PANEL_MODE.COMPACT);
renderAISuggestionPanel('', '');
