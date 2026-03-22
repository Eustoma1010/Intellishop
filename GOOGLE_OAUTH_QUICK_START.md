# 🔐 GOOGLE OAUTH INTEGRATION - QUICK START

Hướng dẫn nhanh để kết nối Google Account vào Intelishop.

## ⚡ Quick Setup (5 phút)

### 1️⃣ Tạo Google OAuth Credentials

```
Truy cập: https://console.cloud.google.com/
→ Create New Project: "Intelishop"
→ Consent Screen > External > Create
→ Credentials > OAuth 2.0 Client IDs > Web application

Authorized origins:
- http://localhost:5500
- http://127.0.0.1:5500

Authorized redirect URIs:
- http://localhost:8000/accounts/google/login/callback/
- http://127.0.0.1:8000/accounts/google/login/callback/

Copy: CLIENT_ID & CLIENT_SECRET
```

### 2️⃣ Update Backend .env

```bash
cd intelishop_backend
cp .env.example .env
# Cập nhật file .env:
GOOGLE_OAUTH_CLIENT_ID=your-client-id-here
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret-here
FRONTEND_URL=http://localhost:5500
```

### 3️⃣ Setup Django Admin

```bash
# Chắc chắn Backend đang chạy
python manage.py runserver

# Vào http://127.0.0.1:8000/admin/
# 1. SITES: Cập nhật domain thành 'localhost:8000'
# 2. SOCIAL APPLICATIONS: Add Google OAuth
#    - Provider: Google
#    - Client ID & Secret từ Google Cloud
#    - Sites: localhost:8000
```

### 4️⃣ Update Frontend

```html
<!-- File: intelishop_frontend/index.html -->
<!-- Tìm dòng và thay bằng Client ID thực -->

<script>
  window.onload = function () {
    google.accounts.id.initialize({
      client_id: 'YOUR_GOOGLE_CLIENT_ID_HERE', // ← THAY ĐÂY
      callback: handleGoogleCallback
    });
    google.accounts.id.renderButton(
      document.querySelector('.g_id_signin'),
      { theme: 'outline', size: 'large' }
    );
  };
</script>
```

### 5️⃣ Test

```
1. Mở Frontend: http://localhost:5500/
2. Click 'Đăng Nhập'
3. Click button Google
4. Chọn Gmail account
5. ✅ Bạn sẽ được đăng nhập!
```

## 📁 Files được cập nhật / tạo mới

| File | Mục đích |
|------|---------|
| `GOOGLE_LOGIN_SETUP.md` | 📖 Hướng dẫn chi tiết 25 bước |
| `.env.example` | 📋 Template cho tất cả environment variables |
| `SETUP_GOOGLE_OAUTH.sh` | 🚀 Script tự động (Linux/Mac) |
| `intelishop_frontend/index.html` | ✏️ Cập nhật Google SDK |
| `intelishop_backend/config/urls.py` | ✏️ Cập nhật callback URLs |

## 🎯 Frontend Code Changes

### ✅ Trước (Không hoạt động)
```html
<button class="pointer-events-none">
    <i class="fa-brands fa-google"></i> Google
</button>
<div class="g_id_signin opacity-0"></div>
```

### ✅ Sau (Hoạt động đúng)
```html
<div class="g_id_signin" data-type="standard" data-size="large"></div>

<script>
  google.accounts.id.renderButton(
    document.querySelector('.g_id_signin'),
    { theme: 'outline', size: 'large' }
  );
</script>
```

## 🎯 Backend Code Changes

### ✅ Trước (Hardcoded localhost)
```python
class GoogleLogin(SocialLoginView):
    callback_url = "http://localhost:63342"  # ❌ Cố định
```

### ✅ Sau (Environment variable)
```python
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5500')

class GoogleLogin(SocialLoginView):
    callback_url = f"{FRONTEND_URL}/"  # ✅ Linh hoạt
```

## 🔍 Kiểm tra hoạt động

### Backend Check
```bash
# 1. Verify Django Social Application
http://127.0.0.1:8000/admin/socialaccount/socialapplication/

# 2. Verify Users created via Google
http://127.0.0.1:8000/admin/core/user/
```

### Frontend Check
```javascript
// F12 Console → check for errors
handleGoogleCallback
google.accounts.id

// Network tab → check /api/social-check/ POST
```

## ❌ Sự cố thường gặp

### 1. "Callback URL không hợp lệ"
```
❌ Google Cloud > Authorized redirect URIs sai

✅ Fix:
1. Vào Google Cloud Console
2. Credentials > OAuth 2.0 Client IDs
3. Kiểm tra URIs khớp: 
   http://localhost:8000/accounts/google/login/callback/
```

### 2. "Client ID không tìm thấy"
```
❌ Frontend HTML chưa cập nhật Client ID

✅ Fix:
1. Mở index.html
2. Tìm 'YOUR_GOOGLE_CLIENT_ID_HERE'
3. Thay bằng Client ID từ Google Cloud
```

### 3. "Domain mismatch"
```
❌ Django SITES domain sai

✅ Fix:
1. http://127.0.0.1:8000/admin/sites/site/
2. Update domain name: 'localhost:8000'
```

### 4. "Email không được chia sẻ"
```
❌ User không cấp quyền truy cập email

✅ Fix:
1. Click Google button lại
2. Chọn "Xem tất cả tài khoản"
3. Chọn account và cấp quyền email
```

## 📚 Tài liệu đầy đủ

Xem `GOOGLE_LOGIN_SETUP.md` để tìm:
- ✅ 25 bước chi tiết
- ✅ Screenshots hướng dẫn
- ✅ Troubleshooting chuyên sâu
- ✅ Production deployment

## 🚀 Production Deployment

Khi deploy lên production:

```env
# Cập nhật .env trên server

FRONTEND_URL=https://intelishop-frontend.vercel.app
GOOGLE_OAUTH_CLIENT_ID=production-client-id
GOOGLE_OAUTH_CLIENT_SECRET=production-secret

# Google Cloud Console > Authorized URIs
# Thêm:
# - https://intelishop-frontend.vercel.app
# - https://intelishop-backend.onrender.com/accounts/google/login/callback/
```

## ✨ Kết quả

Sau khi hoàn tất:
- ✅ Users có thể đăng nhập bằng Google
- ✅ User mới tự động được tạo
- ✅ SocialAccount được liên kết
- ✅ JWT tokens được cấp
- ✅ Có thể logout và login lại

---

**Cần giúp?** Xem `GOOGLE_LOGIN_SETUP.md` để tìm hướng dẫn chi tiết!

**Last Updated:** March 19, 2026  
**Status:** ✅ Ready to use

