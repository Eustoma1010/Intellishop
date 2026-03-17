export const API_BASE_URL = 'https://intelishop-backend.onrender.com'; //http://127.0.0.1:8000

// Helper: Tối ưu việc lấy Element
export const $ = id => document.getElementById(id);

export const App = {
    storeProducts: {},
    storeInfo: {},
    currentStore: 1,
    productsPerPage: 8, // Số sản phẩm hiển thị ban đầu (VD: 8 cái = 2 hàng)
    currentVisibleProducts: 8, // Số sản phẩm đang được hiển thị thực tế
    cart: [],
    selectedShipping: 'standard',
    shippingFees: { standard: 7.99, express: 17.99, 'express-plus': 29.99 },
    isLoggedIn: false,
    hasActiveOrder: false,
    currentUser: { name: "Khách hàng", email: "user@email.com" },
    hotDeals: [],
    categories: [],         // Mảng chứa danh mục từ DB
    currentCategory: 'all',
};

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
