# 🚀 Hướng Dẫn Deploy Intelishop lên Render (Free Plan — Không cần Shell)

## Tình huống
- PostgreSQL cũ trên Render có schema không khớp code mới
- Bản Free không có Render Shell → mọi thứ phải **tự động trong build.sh**
- `build.sh` sẽ tự: install → migrate → load data → tạo superuser

---

## 📋 Các Bước Thực Hiện

### Bước 1: Xóa PostgreSQL Database Cũ trên Render
1. Vào **Render Dashboard** → **Databases**
2. Chọn database cũ → **Settings** → **Delete Database**

### Bước 2: Tạo PostgreSQL Database Mới
1. **New** → **PostgreSQL**
2. Cấu hình:
   - **Name**: `intelishop-db`
   - **Database**: `intelishop_db`
   - **User**: `intelishop_db_user`
   - **Region**: Singapore
   - **Plan**: Free
3. Chờ tạo xong → **Copy Internal Database URL**

### Bước 3: Set Environment Variables trên Web Service
Vào **Web Service** → **Environment** → Thêm tất cả biến sau:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `postgresql://...` ← Paste URL mới từ bước 2 |
| `DEBUG` | `False` |
| `SECRET_KEY` | Tạo chuỗi ngẫu nhiên dài |
| `ALLOWED_HOSTS` | `intelishop-backend.onrender.com` |
| `FRONTEND_URL` | `https://intelishop-frontend.vercel.app` |
| `GEMINI_API_KEY` | API key của bạn |
| `CLOUDINARY_CLOUD_NAME` | Cloud name |
| `CLOUDINARY_API_KEY` | API key |
| `CLOUDINARY_API_SECRET` | API secret |
| `DJANGO_SUPERUSER_EMAIL` | `admin@intelishop.com` ← Email admin muốn tạo |
| `DJANGO_SUPERUSER_PASSWORD` | `your-secure-password` ← Mật khẩu admin |

### Bước 4: Cấu hình Web Service
- **Root Directory**: `intelishop_backend`
- **Build Command**: `./build.sh`
- **Start Command**: `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT`

### Bước 5: Push Code & Deploy
```bash
git add .
git commit -m "Setup deployment: build.sh, data fixture, auto superuser"
git push origin main
```
Render sẽ tự động:
1. ✅ `pip install -r requirements.txt`
2. ✅ `collectstatic`
3. ✅ `migrate` (tạo toàn bộ bảng mới trên PostgreSQL)
4. ✅ `load_exported_data` (nạp 84 products, 9 stores, 14 users, 3 orders...)
5. ✅ `auto_createsuperuser` (tạo admin từ env vars)

### Bước 6: Verify
1. Truy cập `https://intelishop-backend.onrender.com/admin/` → Login
2. `https://intelishop-backend.onrender.com/api/data/` → Kiểm tra data
3. Frontend: test chatbot, cart, checkout

---

## ⚠️ Lưu Ý Quan Trọng

### Redeploy an toàn
- `load_exported_data` tự **skip** nếu DB đã có data (kiểm tra Product table)
- `auto_createsuperuser` tự **skip** nếu email đã tồn tại
- → Redeploy bao nhiêu lần cũng không bị duplicate

### File `.env` local KHÔNG thay đổi
Local vẫn dùng SQLite. Render dùng env vars riêng.

### File `backup_intelishop.json` cũ
File cũ dùng `auth.user` (không tương thích). Dùng `data_export.json` mới.

### Sau này thêm/sửa model
1. `python manage.py makemigrations` (local)
2. Commit migration file
3. Push → Render tự chạy `migrate` trong `build.sh`

### FAISS Index
Tự rebuild khi server start qua `rag_manager.initialize()`.

---

## 📁 Files
| File | Mục đích |
|------|----------|
| `build.sh` | Auto build: install → migrate → load data → superuser |
| `runtime.txt` | Python 3.10.11 |
| `render.yaml` | Render Blueprint (optional) |
| `data_export.json` | Dữ liệu fixture (56.5 KB) — commit vào repo |
| `export_data.py` | Script export SQLite → JSON (đã chạy xong) |
| `core/management/commands/load_exported_data.py` | Auto load data, skip if exists |
| `core/management/commands/auto_createsuperuser.py` | Auto tạo admin từ env vars |
