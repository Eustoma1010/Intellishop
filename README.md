# 🦋 INTELLISHOP

### Nền tảng Thương mại Điện tử Đa Cửa hàng — Tích hợp Trợ lý AI

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-5.0-092E20?logo=django&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

**Intellishop** là hệ thống thương mại điện tử đa cửa hàng (multi-store) với giao diện Glassmorphism hiện đại, tích hợp **Trợ lý mua sắm AI** sử dụng Google Gemini + RAG (Retrieval-Augmented Generation) để tư vấn sản phẩm cá nhân hóa và hỗ trợ giọng nói tiếng Việt.

> **Demo live:** Frontend — [intelishop-frontend.vercel.app](https://intelishop-frontend.vercel.app) · Backend — [intelishop-backend.onrender.com](https://intelishop-backend.onrender.com)

---

## 📑 Mục lục

- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Cài đặt & Chạy dự án](#-cài-đặt--chạy-dự-án)
  - [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
  - [Cài đặt Backend](#2-cài-đặt-backend-django)
  - [Cấu hình biến môi trường](#3-cấu-hình-biến-môi-trường-env)
  - [Khởi tạo FAISS Index (AI Chatbot)](#4-khởi-tạo-faiss-index-ai-chatbot)
  - [Khởi động Frontend](#5-khởi-động-frontend)
- [Tài khoản & Vai trò](#-tài-khoản--vai-trò)
- [API Reference](#-api-reference)
- [Ảnh chụp giao diện](#-ảnh-chụp-giao-diện)
- [Triển khai Production](#-triển-khai-production)

---

## ✨ Tính năng

### 🛍️ Khách hàng (Customer)
- Duyệt sản phẩm đa cửa hàng, lọc theo danh mục, tìm kiếm realtime
- **Trợ lý AI** tư vấn sản phẩm bằng ngôn ngữ tự nhiên (hỗ trợ giọng nói tiếng Việt)
- Giỏ hàng, đặt hàng với tính năng voucher, xu Intellishop, bảo hiểm đơn hàng
- Đăng ký / đăng nhập bằng **Email + OTP** hoặc **Google OAuth**
- Sổ địa chỉ, danh sách yêu thích (wishlist), lịch sử đơn hàng
- Đánh giá cửa hàng & đánh giá hệ thống
- Quên mật khẩu qua OTP email

### 🏪 Người bán (Vendor)
- Đăng ký cửa hàng → Admin duyệt → Truy cập **Trung tâm Người bán**
- Quản lý hồ sơ cửa hàng (logo, ngành hàng, địa chỉ, giấy phép)
- CRUD sản phẩm (ảnh, mô tả, giá, tồn kho, danh mục, trạng thái)
- Quản lý voucher khuyến mãi (%, cố định, theo phạm vi)
- Dashboard doanh thu & thống kê đơn hàng
- Xác nhận đơn hàng → chuyển sang shipper

### 🚚 Đơn vị Vận chuyển (Shipper)
- Đăng ký đối tác vận chuyển → Admin duyệt
- Dashboard nhận đơn, cập nhật trạng thái giao hàng
- Luồng đơn: **Chờ nhận → Đang giao → Đã giao / Giao thất bại**

### 🛡️ Quản trị viên (Admin)
- Quản lý tài khoản người dùng (khoá/mở khoá, lọc theo vai trò)
- Phê duyệt đơn đăng ký Vendor & Shipper
- Kiểm duyệt sản phẩm mới (duyệt / từ chối)
- Trung tâm hỗ trợ — quản lý ticket (phản hồi, cập nhật trạng thái)
- Báo cáo hệ thống (đơn hàng, khiếu nại, đánh giá, biểu đồ 7 ngày)
- Quản lý dữ liệu qua **Django Admin** (hỗ trợ import/export Excel)

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────┐         REST API (JSON)         ┌─────────────────────────┐
│                     │  ◄──────────────────────────►   │                         │
│   FRONTEND          │                                  │   BACKEND (Django)      │
│   Vanilla JS + HTML │   GET  /api/data/                │                         │
│   Tailwind CSS      │   POST /api/chat/                │   ┌─────────────────┐   │
│   Glassmorphism UI  │   POST /api/order/               │   │  core/views.py  │   │
│                     │   POST /api/register/             │   │  core/models.py │   │
│   Modules:          │   ...                             │   │  core/admin.py  │   │
│   ├── config.js     │                                  │   └────────┬────────┘   │
│   ├── auth.js       │                                  │            │             │
│   ├── store.js      │                                  │   ┌────────▼────────┐   │
│   ├── cart.js       │                                  │   │   SQLite / PG   │   │
│   ├── chatbot.js    │                                  │   └─────────────────┘   │
│   ├── vendor.js     │                                  │                         │
│   ├── shipper.js    │                                  │   ┌─────────────────┐   │
│   ├── admin.js      │                                  │   │   Cloudinary    │   │
│   └── ui.js         │                                  │   │   (CDN Images)  │   │
│                     │                                  │   └─────────────────┘   │
└─────────────────────┘                                  │                         │
                                                         │   ┌─────────────────┐   │
                                                         │   │  Google Gemini  │   │
                                                         │   │  + FAISS (RAG)  │   │
                                                         │   │  + edge-tts     │   │
                                                         │   └─────────────────┘   │
                                                         └─────────────────────────┘
```

### Luồng AI Chatbot (RAG Pipeline)

```
Tin nhắn người dùng
    │
    ▼
retrieve_relevant_products()     ← FAISS vector search + Gemini Embedding
    │
    ▼
Inject sản phẩm phù hợp vào Prompt Gemini
    │
    ▼
Gemini trả về JSON { bot_reply, action, products }
    │
    ▼
edge-tts tổng hợp giọng nói tiếng Việt (vi-VN-HoaiMyNeural)
    │
    ▼
Response: { bot_reply, action, audio_url (base64 MP3) }
```

---

## 🔧 Công nghệ sử dụng

| Thành phần | Công nghệ |
|---|---|
| **Backend** | Python 3.10+, Django 5.0, Django REST Framework |
| **Frontend** | HTML5, CSS3, JavaScript (ES6 Modules), Tailwind CSS, Font Awesome |
| **Database** | SQLite (dev) · PostgreSQL (production via `dj-database-url`) |
| **Xác thực** | JWT (`djangorestframework-simplejwt`), Google OAuth (`django-allauth`) |
| **AI / NLP** | Google Gemini API (`gemini-3.1-flash-lite-preview`), FAISS (`faiss-cpu`) |
| **Giọng nói** | `edge-tts` (Vietnamese Neural Voice), Web Speech API (nhận diện giọng nói) |
| **Lưu trữ ảnh** | Cloudinary CDN (`django-cloudinary-storage`) |
| **Import/Export** | `django-import-export` (Excel cho sản phẩm) |
| **Deployment** | Vercel (frontend), Render (backend), Gunicorn + WhiteNoise |

---

## 📁 Cấu trúc dự án

```
Intelishop/
│
├── README.md                          # Tài liệu hướng dẫn (file này)
├── AGENTS.md                          # Hướng dẫn cho AI coding agents
│
├── intelishop_backend/                # ═══ BACKEND (Django) ═══
│   ├── .env                           # Biến môi trường (không commit lên Git)
│   ├── manage.py                      # Django CLI
│   ├── requirements.txt               # Danh sách thư viện Python
│   ├── setup_rag.py                   # Script tạo FAISS index cho AI chatbot
│   ├── product_vectors.index          # FAISS index file (generated)
│   ├── db.sqlite3                     # Database SQLite (dev)
│   │
│   ├── config/                        # Cấu hình Django project
│   │   ├── settings.py                #   Cài đặt chính (DB, JWT, CORS, Email...)
│   │   ├── urls.py                    #   Định tuyến API & phục vụ frontend
│   │   ├── wsgi.py                    #   WSGI entry point (production)
│   │   └── asgi.py                    #   ASGI entry point
│   │
│   ├── core/                          # App chính
│   │   ├── models.py                  #   Models: User, Store, Product, Order, Voucher...
│   │   ├── views.py                   #   Toàn bộ API views (Auth, CRUD, AI, Admin...)
│   │   ├── admin.py                   #   Django Admin (ImportExportModelAdmin)
│   │   ├── rag_manager.py             #   Quản lý FAISS index realtime (auto-rebuild)
│   │   └── migrations/                #   Database migrations
│   │
│   └── media/                         # File upload local (ảnh sản phẩm, avatar...)
│
├── intelishop_frontend/               # ═══ FRONTEND (Vanilla JS) ═══
│   ├── index.html                     # Single-page application (tất cả views)
│   ├── style.css                      # Custom CSS (Glassmorphism, animations)
│   ├── avatar.js                      # 3D Avatar (VRM)
│   │
│   ├── js/                            # JavaScript modules (ES6)
│   │   ├── config.js                  #   Global state (App), API URL, helpers
│   │   ├── main.js                    #   Entry point — init app, gắn window functions
│   │   ├── api.js                     #   HTTP client (fetch wrapper + retry + timeout)
│   │   ├── auth.js                    #   Đăng ký, đăng nhập, OTP, Google OAuth
│   │   ├── store.js                   #   Render cửa hàng, sản phẩm, danh mục, tìm kiếm
│   │   ├── cart.js                    #   Giỏ hàng, thanh toán, đặt hàng
│   │   ├── chatbot.js                 #   AI chatbot UI, giọng nói, gửi/nhận tin nhắn
│   │   ├── vendor.js                  #   Trung tâm Người bán (sản phẩm, voucher, báo cáo)
│   │   ├── shipper.js                 #   Dashboard Đơn vị vận chuyển
│   │   ├── admin.js                   #   Trung tâm Quản trị (tài khoản, phê duyệt, hỗ trợ)
│   │   └── ui.js                      #   Điều hướng views, thông báo, cập nhật UI
│   │
│   └── ui/                            # Ảnh chụp giao diện (screenshots)
│
└── demo/                              # File HTML demo (styleguide)
```

---

## 🚀 Cài đặt & Chạy dự án

### 1. Yêu cầu hệ thống

| Yêu cầu | Phiên bản |
|---|---|
| Python | 3.10 trở lên |
| pip | Mới nhất |
| Git | Bất kỳ |
| Trình duyệt | Chrome / Edge (hỗ trợ Web Speech API) |

Tài khoản dịch vụ (tuỳ chọn cho đầy đủ tính năng):
- [Google AI Studio](https://aistudio.google.com/) — lấy **Gemini API Key** (miễn phí)
- [Cloudinary](https://cloudinary.com/) — lưu trữ ảnh CDN (miễn phí)
- Gmail — tạo [App Password](https://myaccount.google.com/apppasswords) để gửi OTP

### 2. Cài đặt Backend (Django)

```bash
# Clone dự án
git clone https://github.com/<your-username>/Intelishop.git
cd Intelishop/intelishop_backend

# Tạo và kích hoạt môi trường ảo
python -m venv .venv

# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Windows CMD:
.venv\Scripts\activate
# macOS / Linux:
source .venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy migration tạo database
python manage.py migrate

# Tạo tài khoản Admin (SuperUser)
python manage.py createsuperuser

# Khởi động server
python manage.py runserver
```

Server chạy tại: **http://127.0.0.1:8000/**

### 3. Cấu hình biến môi trường (.env)

Tạo file `intelishop_backend/.env` với nội dung:

```env
# ── Cơ bản ──
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=127.0.0.1,localhost

# ── Database ──
# Local (SQLite) — dùng đường dẫn tuyệt đối:
DATABASE_URL=sqlite:///D:/path/to/Intelishop/intelishop_backend/db.sqlite3
# Production (PostgreSQL):
# DATABASE_URL=postgresql://user:pass@host:5432/dbname

# ── AI Chatbot ──
GEMINI_API_KEY=your-gemini-api-key

# ── Cloudinary (lưu trữ ảnh) ──
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# ── Email / OTP ──
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=your-email@gmail.com

# Bật hiển thị OTP trên giao diện khi dev (tự động tắt ở production):
OTP_DEBUG_RETURN_CODE=True

# Nếu KHÔNG cấu hình SMTP, hệ thống tự động in OTP ra terminal.
```

> ⚠️ **Quan trọng:** `DATABASE_URL` cho SQLite phải dùng **đường dẫn tuyệt đối** để tránh trỏ sai file DB tuỳ theo working directory.

### 4. AI Chatbot — FAISS Index (Tự động)

FAISS vector index được **tự động cập nhật realtime** khi sản phẩm thay đổi:

- **Khi server khởi động** → load index từ file `product_vectors.index` (nếu có), hoặc tự rebuild.
- **Khi sản phẩm thêm / sửa / xoá** → Django signal tự động trigger rebuild trong nền (debounce 5s).
- **Không cần chạy thủ công** `python setup_rag.py` nữa.

**Rebuild thủ công (nếu cần):**

```bash
# Cách 1: Qua Django Admin → chọn Products → Action "🔄 Rebuild AI Index"
# Cách 2: Qua script (lần đầu hoặc migration dữ liệu lớn)
cd intelishop_backend
python setup_rag.py
```

> ℹ️ File `setup_rag.py` vẫn hoạt động như cũ cho trường hợp migration dữ liệu ban đầu hoặc rebuild thủ công.

### 5. Khởi động Frontend

**Cách 1 — Qua Django (khuyến nghị):**

Frontend được Django tự động phục vụ tại `http://127.0.0.1:8000/`. Chỉ cần chạy `runserver`.

**Cách 2 — Live Server (VS Code):**

1. Cài extension **Live Server** trong VS Code
2. Mở thư mục `intelishop_frontend/`
3. Click chuột phải vào `index.html` → **Open with Live Server**
4. Giao diện mở tại `http://127.0.0.1:5500/`

> Frontend tự động phát hiện môi trường: nếu chạy trên `localhost` → gọi API tại `http://127.0.0.1:8000`, ngược lại gọi production URL.

---

## 👥 Tài khoản & Vai trò

| Vai trò | Cách tạo | Quyền hạn |
|---|---|---|
| **Customer** | Đăng ký tại giao diện (Email + OTP hoặc Google) | Mua hàng, AI chatbot, wishlist, đặt hàng |
| **Vendor** | Customer nộp đơn → Admin duyệt → tự động cấp quyền | Quản lý cửa hàng, sản phẩm, voucher, đơn hàng |
| **Shipper** | Customer nộp đơn → Admin duyệt → tự động cấp quyền | Nhận đơn, giao hàng, cập nhật trạng thái |
| **Admin** | `python manage.py createsuperuser` | Toàn quyền quản trị hệ thống |

**Luồng xác thực:**

```
Đăng ký Email       → Tạo tài khoản (chưa kích hoạt) → Gửi OTP → Xác thực → Kích hoạt
Đăng ký Google      → Kiểm tra email tồn tại? → Có: auto-login | Không: thu thập thông tin → Tạo TK
Đăng nhập           → Kiểm tra email + mật khẩu → Cấp JWT (Access 1 ngày + Refresh 7 ngày)
Quên mật khẩu       → Nhập email → Gửi OTP → Xác thực → Đặt mật khẩu mới
```

---

## 📡 API Reference

Tất cả endpoint có prefix `/api/`. Backend chạy tại `http://127.0.0.1:8000`.

### Xác thực (Auth)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/register/` | Đăng ký tài khoản (name, email, password, phone) |
| `POST` | `/api/register/verify-otp/` | Xác thực OTP kích hoạt tài khoản |
| `POST` | `/api/register/resend-otp/` | Gửi lại OTP đăng ký |
| `POST` | `/api/login/` | Đăng nhập (email, password) → JWT tokens |
| `POST` | `/api/forgot-password/send-otp/` | Gửi OTP đặt lại mật khẩu |
| `POST` | `/api/forgot-password/reset/` | Đặt lại mật khẩu (email, otp, new_password) |
| `POST` | `/api/social-check/` | Kiểm tra tài khoản Google (email, name, provider, uid) |
| `POST` | `/api/social-complete/` | Hoàn tất đăng ký Google (temp_token, password) |

### Hồ sơ & Địa chỉ

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/profile/?email=` | Lấy thông tin hồ sơ |
| `PUT` | `/api/profile/` | Cập nhật hồ sơ (full_name, phone, gender, birth_date) |
| `GET` | `/api/addresses/?email=` | Danh sách địa chỉ |
| `POST` | `/api/addresses/` | Thêm địa chỉ mới |
| `PUT` | `/api/addresses/<id>/` | Cập nhật địa chỉ |
| `DELETE` | `/api/addresses/<id>/` | Xoá địa chỉ |

### Dữ liệu & Sản phẩm

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/data/` | Lấy toàn bộ dữ liệu (stores, products, hotDeals, categories) |
| `GET` | `/api/products/<id>/` | Chi tiết sản phẩm |
| `GET` | `/api/stores/<id>/reviews/` | Đánh giá cửa hàng |

### Đơn hàng

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/checkout/calculate/` | Tính toán thanh toán (voucher, xu, phí ship...) |
| `POST` | `/api/order/` | Tạo đơn hàng |
| `POST` | `/api/user-orders/` | Lịch sử đơn hàng (email) |

### Wishlist

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/api/wishlist/?email=` | Danh sách yêu thích |
| `POST` | `/api/wishlist/` | Thêm vào yêu thích (email, product_id) |
| `DELETE` | `/api/wishlist/<id>/` | Xoá khỏi yêu thích |

### AI Chatbot

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/chat/` | Gửi tin nhắn cho AI (form-data: message, user_name, cart_items) |

### Vendor (Người bán)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/apply/vendor/` | Nộp đơn đăng ký Người bán |
| `GET` | `/api/apply/status/?email=` | Kiểm tra trạng thái đơn đăng ký |
| `GET/PUT` | `/api/vendor/store/` | Hồ sơ cửa hàng |
| `GET/POST` | `/api/vendor/products/` | Danh sách / Thêm sản phẩm |
| `PUT/DELETE` | `/api/vendor/products/<id>/` | Sửa / Ẩn sản phẩm |
| `GET/POST` | `/api/vendor/vouchers/` | Danh sách / Thêm voucher |
| `PUT/DELETE` | `/api/vendor/vouchers/<id>/` | Sửa / Xoá voucher |
| `GET` | `/api/vendor/reports/dashboard/` | Báo cáo doanh thu |
| `POST` | `/api/vendor/orders/<id>/ready/` | Xác nhận đơn → sẵn sàng giao |

### Shipper (Vận chuyển)

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/apply/shipper/` | Nộp đơn đăng ký Shipper |
| `GET` | `/api/shipper/dashboard/` | Dashboard đơn hàng |
| `POST` | `/api/shipper/orders/<id>/accept/` | Nhận đơn giao hàng |
| `POST` | `/api/shipper/orders/<id>/status/` | Cập nhật trạng thái (đang giao, đã giao, thất bại) |
| `GET` | `/api/shipper/orders/<id>/detail/` | Chi tiết đơn hàng |

### Admin (Quản trị)

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET/PATCH` | `/api/admin/users/` | Danh sách / Khoá-mở khoá tài khoản |
| `GET` | `/api/admin/approvals/pending/` | Đơn đăng ký & sản phẩm chờ duyệt |
| `POST` | `/api/admin/approvals/vendor/action/` | Duyệt/từ chối đơn Vendor |
| `POST` | `/api/admin/approvals/shipper/action/` | Duyệt/từ chối đơn Shipper |
| `POST` | `/api/admin/products/moderate/` | Kiểm duyệt sản phẩm (approve/reject) |
| `GET` | `/api/admin/reports/dashboard/` | Báo cáo hệ thống |

### Hỗ trợ & Đánh giá

| Method | Endpoint | Mô tả |
|---|---|---|
| `GET/POST` | `/api/support/tickets/` | Danh sách / Tạo ticket hỗ trợ |
| `POST` | `/api/support/tickets/<id>/reply/` | Admin phản hồi ticket |
| `GET/POST` | `/api/system/reviews/` | Đánh giá hệ thống |

---

## 📸 Ảnh chụp giao diện

<table>
<tr>
<td align="center"><img src="intelishop_frontend/ui/hoso_user.png" width="350"><br><b>Hồ sơ Khách hàng</b></td>
<td align="center"><img src="intelishop_frontend/ui/trangthanhtoan_user.png" width="350"><br><b>Trang Thanh toán</b></td>
</tr>
<tr>
<td align="center"><img src="intelishop_frontend/ui/quanly_vendor.png" width="350"><br><b>Trung tâm Người bán</b></td>
<td align="center"><img src="intelishop_frontend/ui/quanlysp_vendor.png" width="350"><br><b>Quản lý Sản phẩm</b></td>
</tr>
<tr>
<td align="center"><img src="intelishop_frontend/ui/tinhnang_vendor.png" width="350"><br><b>Tính năng Vendor</b></td>
<td align="center"><img src="intelishop_frontend/ui/dkycuahang_vendor.png" width="350"><br><b>Đăng ký Cửa hàng</b></td>
</tr>
<tr>
<td align="center"><img src="intelishop_frontend/ui/quanly_admin.png" width="350"><br><b>Quản trị Admin</b></td>
<td align="center"><img src="intelishop_frontend/ui/baocao_admin.png" width="350"><br><b>Báo cáo Admin</b></td>
</tr>
<tr>
<td align="center"><img src="intelishop_frontend/ui/hotro_admin.png" width="350"><br><b>Hỗ trợ Admin</b></td>
<td align="center"><img src="intelishop_frontend/ui/giaohang_xx.png" width="350"><br><b>Dashboard Shipper</b></td>
</tr>
<tr>
<td align="center" colspan="2"><img src="intelishop_frontend/ui/vanchuyen_xx.png" width="350"><br><b>Quản lý Vận chuyển</b></td>
</tr>
</table>

---

## ☁️ Triển khai Production

### Backend — Render

1. Tạo **Web Service** trên [Render](https://render.com) từ GitHub repo
2. Cài đặt:
   - **Build Command:** `pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate`
   - **Start Command:** `gunicorn config.wsgi:application`
3. Thêm **Environment Variables** trên Render Dashboard:
   ```
   DEBUG=False
   SECRET_KEY=<production-secret>
   DATABASE_URL=postgresql://...
   ALLOWED_HOSTS=intelishop-backend.onrender.com
   GEMINI_API_KEY=<key>
   CLOUDINARY_CLOUD_NAME=<name>
   CLOUDINARY_API_KEY=<key>
   CLOUDINARY_API_SECRET=<secret>
   FRONTEND_URL=https://intelishop-frontend.vercel.app
   ```

### Frontend — Vercel

1. Tạo project trên [Vercel](https://vercel.com) từ GitHub repo
2. **Root Directory:** `intelishop_frontend`
3. **Framework Preset:** Other
4. Deploy tự động mỗi khi push code

### Cập nhật FAISS Index (Production)

FAISS index tự động rebuild khi sản phẩm thay đổi. Nếu cần rebuild thủ công (migration dữ liệu lớn):

```bash
python setup_rag.py
```

Hoặc qua Django Admin → Products → Action **"🔄 Rebuild AI Index"**.

---

## 🔑 Quản trị Django Admin

Truy cập: **http://127.0.0.1:8000/admin/**

```bash
python manage.py createsuperuser
# Nhập email và mật khẩu
```

**Tính năng nổi bật của Admin Panel:**
- Import/Export sản phẩm hàng loạt qua **Excel** (tab Products)
- Quản lý Users, Stores, Orders, Categories, Vouchers, Applications
- Phê duyệt Vendor & Shipper trực tiếp

---

## 📋 Biến môi trường (.env)

| Biến | Bắt buộc | Mô tả | Mặc định |
|---|---|---|---|
| `SECRET_KEY` | ✅ | Khoá bảo mật Django | Fallback dev key |
| `DEBUG` | | Chế độ debug | `True` |
| `DATABASE_URL` | | URL kết nối database | SQLite local |
| `ALLOWED_HOSTS` | | Danh sách domain (phân cách bởi `,`) | `*` |
| `GEMINI_API_KEY` | ✅ | Google Gemini API Key | — |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary Cloud Name | — |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary API Key | — |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary API Secret | — |
| `EMAIL_HOST` | | SMTP server (VD: `smtp.gmail.com`) | Console backend |
| `EMAIL_PORT` | | SMTP port | `587` |
| `EMAIL_HOST_USER` | | Email người gửi | — |
| `EMAIL_HOST_PASSWORD` | | App Password (Gmail) | — |
| `DEFAULT_FROM_EMAIL` | | Email hiển thị cho người nhận | `no-reply@intellishop.local` |
| `OTP_DEBUG_RETURN_CODE` | | Hiển thị OTP trên frontend (dev) | Theo `DEBUG` |
| `OTP_EXPIRE_MINUTES` | | Thời gian hết hạn OTP | `10` |
| `FRONTEND_URL` | | URL frontend (cho CORS & OAuth callback) | Vercel URL |

---

## 🤝 Đóng góp

1. Fork dự án
2. Tạo branch tính năng: `git checkout -b feature/tinh-nang-moi`
3. Commit: `git commit -m "feat: mô tả tính năng"`
4. Push: `git push origin feature/tinh-nang-moi`
5. Tạo Pull Request

---

## 📄 License

Dự án được phát hành theo giấy phép [MIT](LICENSE).

---

<div align="center">

**Intellishop** — Xây dựng với ❤️ bằng Django & JavaScript

🦋 *Trải nghiệm mua sắm thông minh hơn với AI*

</div>

