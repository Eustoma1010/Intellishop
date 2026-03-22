import { API_BASE_URL, App } from './config.js';
import * as UI from './ui.js';
import * as Auth from './auth.js';
import * as Store from './store.js';
import * as Cart from './cart.js';
import * as Chatbot from './chatbot.js';
import * as Vendor from './vendor.js';
import * as Shipper from './shipper.js';
import * as Admin from './admin.js';

// =======================================================
// GẮN TOÀN BỘ HÀM LÊN WINDOW ĐỂ HTML ONCLICK GỌI ĐƯỢC
// =======================================================

// UI Navigation
window.showHome = UI.showHome;
window.showLogin = UI.showLogin;
window.showRegister = UI.showRegister;
window.showLocalRegister = UI.showLocalRegister;
window.showVerifyRegister = UI.showVerifyRegister;
window.showForgotPassword = UI.showForgotPassword;
window.showAccount = UI.showAccount;
window.showVendorApply = UI.showVendorApply;
window.showShipperApply = UI.showShipperApply;
window.showAdminDashboard = UI.showAdminDashboard;
window.showVendorCenter = Vendor.showVendorCenter;
window.showShipperDashboard = Shipper.showShipperDashboard;
window.openAdminDashboard = Admin.openAdminDashboard;

// Auth
window.handleRegister = Auth.handleRegister;
window.handleLogin = Auth.handleLogin;
window.logout = Auth.logout;
window.checkPasswordStrength = Auth.checkPasswordStrength;
window.checkPasswordMatch = Auth.checkPasswordMatch;
window.togglePassword = Auth.togglePassword;
window.loadAccountWorkspace = Auth.loadAccountWorkspace;
window.saveProfile = Auth.saveProfile;
window.createAddress = Auth.createAddress;
window.setDefaultAddress = Auth.setDefaultAddress;
window.deleteAddress = Auth.deleteAddress;
window.submitVendorApplication = Auth.submitVendorApplication;
window.submitShipperApplication = Auth.submitShipperApplication;

// Store & Products
window.selectStore = Store.selectStore;
window.loadMoreProducts = Store.loadMoreProducts;
window.scrollStoreTabs = Store.scrollStoreTabs;
window.scrollHotDeals = Store.scrollHotDeals;
window.checkScrollButtons = Store.checkScrollButtons;
window.checkHotDealScrollButtons = Store.checkHotDealScrollButtons;
window.filterByCategory = Store.filterByCategory;
window.searchProducts = Store.searchProducts;
window.clearSearch = Store.clearSearch;
window.showProductDetail = Store.showProductDetail;
window.closeProductDetail = Store.closeProductDetail;
window.submitStoreReview = Store.submitStoreReview;

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
window.toggleAIPanelExpand = Chatbot.toggleAIPanelExpand;
window.switchAssistantMode = Chatbot.switchAssistantMode;
window.handleChatKeyPress = Chatbot.handleChatKeyPress;
window.sendChatMessage = Chatbot.sendChatMessage;
window.toggleVoiceRecording = Chatbot.toggleVoiceRecording;
window.clearChatHistory = Chatbot.clearChatHistory;

// Wishlist
window.toggleWishlist = Auth.toggleWishlist;

// =======================================================
// KHỞI TẠO ỨNG DỤNG KHI TRÌNH DUYỆT TẢI XONG
// =======================================================
async function initApp() {
    try {
        // 1. Kiểm tra trạng thái đăng nhập (JWT Token)
        const token = localStorage.getItem('access_token');
        if (token) {
            App.isLoggedIn = true;
            try {
                const savedEmail = localStorage.getItem('current_user_email') || '';
                if (savedEmail) {
                    App.currentUser.email = savedEmail;
                }
                await Auth.loadAccountWorkspace();
            } catch (_err) {
                App.currentUser = { name: "Khách hàng", email: "user@email.com", role: 'CUSTOMER' };
            }
        }

        // 2. Fetch data (Sử dụng cách thức fetch an toàn)
        const response = await fetch(`${API_BASE_URL}/api/data/`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Tối ưu: Dùng Object.assign để nạp state gọn gàng hơn
            Object.assign(App, {
                storeInfo: data.storeInfo,
                storeProducts: data.storeProducts,
                hotDeals: data.hotDeals,
                categories: data.categories,
                shippingProviders: Array.isArray(data.shippingProviders) ? data.shippingProviders : []
            });

            if (!App.selectedShipping && App.shippingProviders.length > 0) {
                App.selectedShipping = App.shippingProviders[0].code;
            }

            // Tự động sinh giao diện
            Store.renderStoreTabs();
            Store.renderHotDeals();
            Store.renderCatalog();

            // Lấy ID của cửa hàng đầu tiên để chọn mặc định an toàn
            const firstStoreId = Object.keys(data.storeInfo)[0];
            if (firstStoreId) {
                Store.selectStore(firstStoreId);
            }

            UI.updateAuthUI();
            UI.showHome();
            Auth.initGoogleAuthButtons();

            // Gắn sự kiện tìm kiếm với debounce 300ms
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                let searchDebounce;
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchDebounce);
                    searchDebounce = setTimeout(() => {
                        const query = e.target.value.trim();
                        Store.searchProducts(query);
                        // Cuộn xuống khu vực sản phẩm khi tìm kiếm
                        if (query) {
                            const productsSection = document.getElementById('product-list');
                            if (productsSection) productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 300);
                });
                searchInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') Store.clearSearch();
                });
            }

            console.log("✅ Đã khởi tạo Intellishop thành công!");
        } else {
            throw new Error(data.message || "Dữ liệu server trả về không hợp lệ");
        }

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu từ server:", error);
        // Fallback UI nếu server sập
        if (typeof UI.showNotification === "function") {
            UI.showNotification("Không thể kết nối máy chủ! Đang thử lại...", "error");
        }
        Auth.initGoogleAuthButtons();
    }
}

// Kích hoạt app an toàn
document.addEventListener('DOMContentLoaded', initApp);