import { API_BASE_URL, App } from './config.js';
import { showHome, showLogin, showRegister, showAccount, updateAuthUI } from './ui.js';
import { handleRegister, handleLogin, logout } from './auth.js';
import { selectStore, renderStoreTabs, renderHotDeals, loadMoreProducts, scrollStoreTabs, checkScrollButtons, renderCatalog, filterByCategory } from './store.js';
import { addToCart, showCart, updateCartQty, removeFromCart, proceedToCheckout, nextStep, prevStep, selectShipping, placeOrder, showOrders } from './cart.js';
import { toggleAIPanel, handleChatKeyPress, sendChatMessage, toggleVoiceRecording } from './chatbot.js';

// Gắn các hàm lên window để HTML gọi được (Giải quyết lỗi Function is not defined)
window.showHome = showHome;
window.showLogin = showLogin;
window.scrollStoreTabs = scrollStoreTabs;
window.checkScrollButtons = checkScrollButtons;
window.showRegister = showRegister;
window.showAccount = showAccount;
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.logout = logout;
window.selectStore = selectStore;
window.loadMoreProducts = loadMoreProducts;
window.selectStore = selectStore;
window.addToCart = addToCart;
window.showCart = showCart;
window.updateCartQty = updateCartQty;
window.removeFromCart = removeFromCart;
window.proceedToCheckout = proceedToCheckout;
window.nextStep = nextStep;
window.filterByCategory = filterByCategory;
window.prevStep = prevStep;
window.selectShipping = selectShipping;
window.placeOrder = placeOrder;
window.showOrders = showOrders;

window.toggleAIPanel = toggleAIPanel;
window.handleChatKeyPress = handleChatKeyPress;
window.sendChatMessage = sendChatMessage;
window.toggleVoiceRecording = toggleVoiceRecording;

async function initApp() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/data/`);
        const data = await response.json();

        if (data.success) {
            App.storeInfo = data.storeInfo;
            App.storeProducts = data.storeProducts;
            App.hotDeals = data.hotDeals; // Nhận data Deal Hot
            App.categories = data.categories;

            // Tự động sinh giao diện
            renderStoreTabs();
            renderHotDeals();
            renderCatalog();

            // Lấy ID của cửa hàng đầu tiên trong danh sách để chọn mặc định
            const firstStoreId = Object.keys(data.storeInfo)[0];
            if(firstStoreId) selectStore(firstStoreId);

            updateAuthUI();
            console.log("✅ Đã render UI bằng dữ liệu động từ Django!");
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu từ server:", error);
    }
}

initApp();