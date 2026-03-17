# 🦋 Intelishop - Hệ thống Thương mại Điện tử Tích hợp AI

* Intelishop là một dự án ứng dụng web thương mại điện tử đa cửa hàng (Multi-store E-commerce) được phát triển với giao diện hiện đại (Glassmorphism) và tích hợp Trợ lý ảo AI (Google Gemini) để tư vấn sản phẩm cá nhân hóa cho khách hàng.

## 🛠️ Công nghệ sử dụng

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla), Tailwind CSS, FontAwesome.
* **Backend:** Python, Django, Django CORS Headers.
* **Database:** SQLite (Mặc định của Django).
* **AI Integration:** Google Generative AI (Gemini 2.5 Flash).

---

## 📁 Cấu trúc dự án

Dự án được chia làm 2 thư mục chính hoạt động độc lập nhưng giao tiếp qua REST API:

```text
Intelishop_Project/
│
├── intelishop_frontend/    # Giao diện người dùng
│   ├── main.html           # Trang chủ & toàn bộ view
│   ├── style.css           # Custom CSS (Glassmorphism, Animations)
│   └── script.js           # Xử lý logic giao diện & gọi API
│
├── intelishop_backend/     # Máy chủ xử lý dữ liệu (Django)
│   ├── config/             # Cấu hình project (settings, urls)
│   ├── core/               # App chính xử lý logic (views, models)
│   ├── manage.py           # File thực thi lệnh Django
│   └── venv/               # Môi trường ảo (Được loại bỏ trên GitHub)
│
├── .gitignore              # Cấu hình loại bỏ file rác khi push code
└── README.md               # Tài liệu hướng dẫn dự án
```

## Hướng dẫn Cài đặt & Chạy dự án (Local)

## 1.Khởi động Backend (Django)
* Mở terminal (hoặc Git Bash / PyCharm Terminal) và di chuyển vào thư mục intelishop_backend:

```text
# 1. Tạo môi trường ảo (Virtual Environment)
python -m venv venv

# 2. Kích hoạt môi trường ảo
# Trên Windows:
venv\Scripts\activate
# Trên macOS/Linux:
source venv/bin/activate

# 3. Cài đặt các thư viện cần thiết
pip install django django-cors-headers google-generativeai

# 4. Cập nhật cơ sở dữ liệu (Migrations)
python manage.py makemigrations
python manage.py migrate

# 5. Khởi động Server
python manage.py runserver
Server Backend sẽ chạy tại địa chỉ: http://127.0.0.1:8000/
```

## 2. Cấu hình AI Chatbot (Gemini API)
* Để chức năng tư vấn AI hoạt động, bạn cần có API Key từ Google:
```
Truy cập Google AI Studio để tạo API Key miễn phí.

Mở file intelishop_backend/core/views.py.

Tìm dòng genai.configure(api_key="YOUR_API_KEY_HERE") và thay thế bằng key thực tế của bạn.
```

## 3. Khởi động Frontend

* Mở thư mục intelishop_frontend bằng VS Code hoặc PyCharm. 
* Sử dụng extension Live Server (trên VS Code) hoặc tính năng Preview trình duyệt (trên PyCharm) để chạy file main.html. 
* Giao diện web sẽ mở ra tại địa chỉ cổng của trình duyệt (ví dụ: http://127.0.0.1:5500/).

## 🔑 Quản trị viên (Admin Panel)

Để truy cập vào khu vực quản lý dữ liệu (Sản phẩm, Cửa hàng, Đơn hàng, Người dùng):

Mở terminal của Backend (đảm bảo môi trường ảo đang bật), chạy lệnh tạo tài khoản Admin:

```
python manage.py createsuperuser
Điền Username, Email (có thể bỏ qua) và Password.
```
Truy cập: http://127.0.0.1:8000/admin/ và đăng nhập.