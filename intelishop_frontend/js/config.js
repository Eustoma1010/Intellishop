// ==================================================
// 1. CẤU HÌNH MÔI TRƯỜNG & KẾT NỐI API
// ==================================================
// Tự động chuyển đổi API dựa trên môi trường chạy (Local vs Production)
const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
export const API_BASE_URL = isLocalhost 
    ? 'http://127.0.0.1:8000' 
    : 'https://intelishop-backend.onrender.com';

// ==================================================
// 2. HELPER FUNCTIONS (TIỆN ÍCH)
// ==================================================
// Tối ưu hàm lấy Element: Tích hợp cảnh báo rủi ro (Defensive Programming)
export const $ = (id) => {
    const el = document.getElementById(id);
    if (!el && isLocalhost) {
        console.warn(`[Cảnh báo UI]: Không tìm thấy phần tử có ID '${id}' trên giao diện.`);
    }
    return el;
};

// ==================================================
// 3. TRẠNG THÁI ỨNG DỤNG (GLOBAL STATE)
// ==================================================
export const App = {
    // Dữ liệu sản phẩm
    storeProducts: {},
    storeInfo: {},
    hotDeals: [],
    categories: [],         
    currentCategory: 'all',

    // Cấu hình phân trang / Hiển thị
    currentStore: 1,
    productsPerPage: 8, 
    currentVisibleProducts: 8, 

    // Giỏ hàng & Thanh toán
    cart: [],
    selectedShipping: 'standard',
    shippingFees: { standard: 7.99, express: 17.99, 'express-plus': 29.99 },
    hasActiveOrder: false,

    // Trạng thái người dùng
    isLoggedIn: false,
    currentUser: { name: "Khách hàng", email: "user@email.com" },
};

// ==================================================
// 4. MOCK DATA (DỮ LIỆU TĨNH)
// ==================================================
// Dữ liệu tĩnh Đánh giá cửa hàng
export const storeFeedback = {
    1: [
        { name: 'Sarah H.', rating: 5, comment: 'Chất lượng tuyệt vời, form áo cực kỳ ưng ý!', avatar: 'SH', date: '2 ngày trước' },
        { name: 'Jessica L.', rating: 5, comment: 'Đồ siêu đẹp! Giao hàng cực nhanh!', avatar: 'JL', date: '1 tuần trước' },
        { name: 'Michael T.', rating: 5, comment: 'Chất liệu xịn xò, chắc chắn sẽ mua lại!', avatar: 'MT', date: '3 ngày trước' },
        { name: 'Emma L.', rating: 5, comment: 'Thiết kế tinh tế, mặc đi tiệc rất thoải mái!', avatar: 'EL', date: '5 ngày trước' }
    ],
    2: [
        { name: 'David B.', rating: 5, comment: 'Chuẩn phong cách street style! Cực thích!', avatar: 'DB', date: '1 ngày trước' },
        { name: 'Anna K.', rating: 4, comment: 'Thiết kế rất ngầu, giá cả hợp lý.', avatar: 'AK', date: '3 ngày trước' },
        { name: 'Tom W.', rating: 5, comment: 'Cửa hàng streetwear đỉnh nhất!', avatar: 'TW', date: '1 tuần trước' },
        { name: 'Lisa M.', rating: 5, comment: 'Đồ độc lạ, mặc ra đường luôn được khen!', avatar: 'LM', date: '2 tuần trước' }
    ],
    3: [
        { name: 'Jennifer P.', rating: 5, comment: 'Chất lượng xuất sắc, xứng đáng từng xu!', avatar: 'JP', date: '3 ngày trước' },
        { name: 'Robert C.', rating: 5, comment: 'Đỉnh cao của sự sang trọng, đóng gói kỹ.', avatar: 'RC', date: '1 tuần trước' },
        { name: 'Victoria S.', rating: 5, comment: 'Dịch vụ chăm sóc khách hàng cực kỳ tốt!', avatar: 'VS', date: '2 tuần trước' },
        { name: 'James L.', rating: 4, comment: 'Sản phẩm cao cấp, trải nghiệm tuyệt vời.', avatar: 'JL', date: '3 tuần trước' }
    ],
    4: [
        { name: 'John A.', rating: 5, comment: 'Hàng chính hãng chuẩn Apple, siêu tốc!', avatar: 'JA', date: '1 ngày trước' },
        { name: 'Mary B.', rating: 5, comment: 'Mức giá quá tốt cho iPhone 15 Pro!', avatar: 'MB', date: '2 ngày trước' },
        { name: 'Steve J.', rating: 5, comment: 'Trải nghiệm mua sắm tuyệt vời.', avatar: 'SJ', date: '5 ngày trước' },
        { name: 'Helen T.', rating: 4, comment: 'Chất lượng không chê vào đâu được.', avatar: 'HT', date: '1 tuần trước' }
    ],
    5: [
        { name: 'Mike R.', rating: 5, comment: 'S24 Ultra quá đỉnh! Mua ở đây siêu hời.', avatar: 'MR', date: '1 ngày trước' },
        { name: 'Sarah K.', rating: 5, comment: 'Rất ưng em Z Flip 5 mới tậu.', avatar: 'SK', date: '3 ngày trước' },
        { name: 'Chris P.', rating: 5, comment: 'Cửa hàng Samsung xịn nhất.', avatar: 'CP', date: '1 tuần trước' },
        { name: 'Linda W.', rating: 4, comment: 'Dịch vụ tốt, hỗ trợ kỹ thuật nhanh.', avatar: 'LW', date: '2 tuần trước' }
    ]
};