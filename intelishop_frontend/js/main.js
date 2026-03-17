import { API_BASE_URL, App } from './config.js';
import * as UI from './ui.js';
import * as Auth from './auth.js';
import * as Store from './store.js';
import * as Cart from './cart.js';
import * as Chatbot from './chatbot.js';

// =======================================================
// GẮN TOÀN BỘ HÀM LÊN WINDOW ĐỂ HTML ONCLICK GỌI ĐƯỢC
// =======================================================

// UI Navigation
window.showHome = UI.showHome;
window.showLogin = UI.showLogin;
window.showRegister = UI.showRegister;
window.showAccount = UI.showAccount;

// Auth
window.handleRegister = Auth.handleRegister;
window.handleLogin = Auth.handleLogin;
window.logout = Auth.logout;
window.checkPasswordStrength = Auth.checkPasswordStrength;
window.checkPasswordMatch = Auth.checkPasswordMatch;
window.togglePassword = Auth.togglePassword;

// Store & Products
window.selectStore = Store.selectStore;
window.loadMoreProducts = Store.loadMoreProducts;
window.scrollStoreTabs = Store.scrollStoreTabs;
window.checkScrollButtons = Store.checkScrollButtons;
window.filterByCategory = Store.filterByCategory;

// Cart & Checkout
window.addToCart = Cart.addToCart;
window.showCart = Cart.showCart;
window.updateCartQty = Cart.updateCartQty;
window.removeFromCart = Cart.removeFromCart;
window.proceedToCheckout = Cart.proceedToCheckout;
window.nextStep = Cart.nextStep;
window.prevStep = Cart.prevStep;
window.selectShipping = Cart.selectShipping;
window.placeOrder = Cart.placeOrder;
window.showOrders = Cart.showOrders;

// Chatbot
window.toggleAIPanel = Chatbot.toggleAIPanel;
window.handleChatKeyPress = Chatbot.handleChatKeyPress;
window.sendChatMessage = Chatbot.sendChatMessage;
window.toggleVoiceRecording = Chatbot.toggleVoiceRecording;

// =======================================================
// KHỞI TẠO ỨNG DỤNG KHI TRÌNH DUYỆT TẢI XONG
// =======================================================
async function initApp() {
    try {
        // 1. Kiểm tra trạng thái đăng nhập (JWT Token)
        const token = localStorage.getItem('access_token');
        if (token) {
            App.isLoggedIn = true;
            // (Tương lai bạn có thể gọi API /api/me/ để lấy Tên từ Token)
            App.currentUser = { name: "Khách hàng", email: "user@email.com" };
        }

        // 2. Lấy dữ liệu cửa hàng từ Backend Django
        const response = await fetch(`${API_BASE_URL}/api/data/`);
        const data = await response.json();

        if (data.success) {
            App.storeInfo = data.storeInfo;
            App.storeProducts = data.storeProducts;
            App.hotDeals = data.hotDeals;
            App.categories = data.categories;

            // Tự động sinh giao diện
            Store.renderStoreTabs();
            Store.renderHotDeals();
            Store.renderCatalog();

            // Lấy ID của cửa hàng đầu tiên để chọn mặc định
            const firstStoreId = Object.keys(data.storeInfo)[0];
            if(firstStoreId) Store.selectStore(firstStoreId);

            UI.updateAuthUI();
            UI.showHome(); // Mặc định hiển thị trang chủ
            console.log("✅ Đã khởi tạo Intelishop thành công!");
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu từ server:", error);
        UI.showNotification("Không thể kết nối máy chủ!", "error");
    }
}

// Kích hoạt app
document.addEventListener('DOMContentLoaded', initApp);