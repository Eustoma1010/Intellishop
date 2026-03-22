# 🔐 Hướng dẫn Kết nối Google Account - Intelishop

Hướng dẫn chi tiết để thiết lập đăng nhập qua Google cho Intelishop.

## 📋 Yêu cầu

- ✅ Django backend đã được cấu hình với `django-allauth`
- ✅ Frontend đã có button Google login
- ✅ Backend đã có endpoints `/api/social-check/` và `/api/social-complete/`

## 🚀 Các bước thiết lập

### Bước 1: Tạo Google OAuth Project trên Google Cloud Console

1. Truy cập: https://console.cloud.google.com/
2. **Tạo Project mới:**
   - Click "Select a Project" → "NEW PROJECT"
   - Đặt tên: `Intelishop`
   - Click "CREATE"

3. **Tạo OAuth Consent Screen:**
   - Click "Consent Screen" trên sidebar trái
   - Chọn "External" → "CREATE"
   - Điền thông tin:
     - **App name:** Intelishop
     - **User support email:** Nhập email của bạn
     - **Developer contact:** Nhập email của bạn
   - Click "SAVE AND CONTINUE" ➜ "SAVE AND CONTINUE" ➜ "BACK TO DASHBOARD"

4. **Tạo OAuth Credentials:**
   - Click "Credentials" trên sidebar
   - Click "CREATE CREDENTIALS" → "OAuth 2.0 Client IDs"
   - Chọn "Web application"
   - Điền thông tin:
     - **Name:** Intelishop Web Client
     - **Authorized JavaScript origins:** 
       - `http://localhost:3000`
       - `http://localhost:5500`
       - `http://127.0.0.1:3000`
       - `http://127.0.0.1:5500`
       - `https://intelishop-frontend.vercel.app` (khi deploy)
     - **Authorized redirect URIs:**
       - `http://localhost:8000/accounts/google/login/callback/`
       - `http://127.0.0.1:8000/accounts/google/login/callback/`
       - `https://intelishop-backend.onrender.com/accounts/google/login/callback/` (khi deploy)

5. **Lấy Client ID:**
   - Copy **Client ID** (sẽ có dạng: `xxxx-xxxx.apps.googleusercontent.com`)
   - Copy **Client Secret**

### Bước 2: Cấu hình Backend Django

1. **Cập nhật `.env` file:**
   ```env
   # Thêm vào D:\Self\WorkSpace\Web\Intelishop\intelishop_backend\.env

   # Google OAuth
   GOOGLE_OAUTH_CLIENT_ID=YOUR_CLIENT_ID_HERE
   GOOGLE_OAUTH_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
   ```

2. **Thêm Google vào Django Admin:**
   ```bash
   cd intelishop_backend
   python manage.py runserver
   ```
   
   - Truy cập: http://127.0.0.1:8000/admin/
   - Login với superuser account
   - Vào **Django > Sites** → Chọn `example.com` → Sửa:
     - **Domain name:** `localhost:8000` (hoặc domain production)
     - **Display name:** `Intelishop`
     - Click SAVE

   - Vào **Social applications** → **ADD SOCIAL APPLICATION**
     - **Provider:** Chọn "Google"
     - **Name:** Google OAuth
     - **Client id:** Paste Client ID từ Google Cloud
     - **Secret key:** Paste Client Secret từ Google Cloud
     - **Sites:** Chọn "localhost:8000" (hoặc domain của bạn)
     - Click SAVE

### Bước 3: Cập nhật Frontend HTML

1. **Mở file:** `D:\Self\WorkSpace\Web\Intelishop\intelishop_frontend\index.html`

2. **Tìm đoạn code Google SDK (vào cuối file):**
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   <div id="g_id_onload"
        data-client_id="717682002366-8ivvapiplm9m674j4c67ti5sbt9245rl.apps.googleusercontent.com"
        data-callback="handleGoogleCallback">
   </div>
   ```

3. **Thay thế Client ID của bạn:**
   ```html
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   <div id="g_id_onload"
        data-client_id="YOUR_GOOGLE_CLIENT_ID_HERE"
        data-callback="handleGoogleCallback">
   </div>
   <script src="https://accounts.google.com/gsi/client" async defer></script>
   ```

4. **Cập nhật Facebook App ID (nếu muốn dùng Facebook):**
   ```html
   <script>
     window.fbAsyncInit = function() {
       FB.init({
         appId      : 'YOUR_FACEBOOK_APP_ID', // Thay bằng Facebook App ID của bạn
         cookie     : true,
         xfbml      : true,
         version    : 'v19.0'
       });
     };
   </script>
   ```

### Bước 4: Kiểm tra kết nối Google Button

1. **Tìm phần button Google trong HTML:**
   ```html
   <div class="flex-1 relative overflow-hidden group">
       <button type="button" class="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-pink-100 rounded-full text-gray-700 font-semibold hover:bg-pink-50 transition pointer-events-none">
           <i class="fa-brands fa-google text-red-500"></i> Google
       </button>
       <div class="g_id_signin absolute inset-0 opacity-0 z-20 cursor-pointer" data-type="standard"></div>
   </div>
   ```

2. **Xóa `pointer-events-none` từ button để cho phép click:**
   ```html
   <button type="button" class="w-full flex items-center justify-center gap-2 py-3 bg-white border-2 border-pink-100 rounded-full text-gray-700 font-semibold hover:bg-pink-50 transition">
   ```

3. **Sửa `opacity-0` thành `opacity-100` để Google button hiển thị đúng:**
   ```html
   <div class="g_id_signin absolute inset-0 opacity-100 z-20 cursor-pointer" data-type="standard"></div>
   ```

## 🧪 Kiểm tra hoạt động

### Frontend Test:

1. **Mở trình duyệt:**
   ```
   http://localhost:5500/  (hoặc URL frontend của bạn)
   ```

2. **Click "Đăng Nhập"** → Bạn sẽ thấy button Google login

3. **Click button Google:**
   - Cửa sổ popup Google sẽ xuất hiện
   - Chọn Gmail account của bạn
   - Sau khi xác nhận, bạn sẽ được đăng nhập

### Backend Check (Django Admin):

1. **Truy cập:** http://127.0.0.1:8000/admin/
2. **Vào Social Applications:**
   - Kiểm tra Google OAuth đã được thêm
3. **Vào Users:**
   - Kiểm tra user mới được tạo từ Google

## 🔧 Troubleshooting

### ❌ "Lỗi xử lý mạng xã hội" khi click Google

**Nguyên nhân:** Client ID sai hoặc chưa cấu hình đúng

**Giải pháp:**
```bash
# 1. Kiểm tra console trình duyệt (F12)
# 2. Xem error message
# 3. Đảm bảo Client ID trong HTML trùng với Google Cloud
# 4. Kiểm tra "Authorized JavaScript origins" trong Google Cloud Console
```

### ❌ "Callback URL không hợp lệ"

**Nguyên nhân:** Callback URL trong Google Cloud không trùng khớp

**Giải pháp:**
```
Google Cloud Console > Credentials > OAuth 2.0 Client IDs
Cập nhật "Authorized redirect URIs" để khớp với backend URL:
- http://localhost:8000/accounts/google/login/callback/
- http://127.0.0.1:8000/accounts/google/login/callback/
```

### ❌ "Đang tải Facebook SDK" khi click Facebook

**Nguyên nhân:** Facebook App ID chưa được cập nhật hoặc Facebook SDK không được tải

**Giải pháp:**
```javascript
// Trong index.html, tìm phần Facebook SDK và cập nhật:
window.fbAsyncInit = function() {
  FB.init({
    appId      : 'YOUR_FACEBOOK_APP_ID',  // ← Thay bằng ID thực của bạn
    cookie     : true,
    xfbml      : true,
    version    : 'v19.0'
  });
};
```

### ❌ User được tạo nhưng không có email

**Nguyên nhân:** Google account không được chia sẻ email

**Giải pháp:** Yêu cầu user cấp quyền truy cập email trong popup Google

## 📱 Hàm xử lý Backend

Backend đã có sẵn 2 hàm xử lý:

```python
# File: intelishop_backend/core/views.py

@api_view(['POST'])
@permission_classes([AllowAny])
def social_auth_check(request):
    """
    Kiểm tra email từ Google/Facebook:
    - Nếu user tồn tại → trả về JWT tokens (đăng nhập)
    - Nếu user mới → trả về temp_token (yêu cầu bổ sung info)
    """
    # ...

@api_view(['POST'])
@permission_classes([AllowAny])
def social_auth_complete(request):
    """
    Hoàn tất đăng ký social:
    - Nhận temp_token từ frontend
    - Tạo user mới, liên kết SocialAccount
    - Trả về JWT tokens
    """
    # ...
```

## 🎯 Các bước tiếp theo

1. **Deploy Production:**
   - Cập nhật authorized URLs trong Google Cloud Console
   - Sử dụng domain production thay vì localhost
   - Cập nhật .env trên server

2. **Tối ưu trải nghiệm:**
   - Cấu hình redirect URL sau login
   - Thêm error handling hoàn chỉnh
   - Test trên đa trình duyệt

3. **Bảo mật:**
   - Không hardcode secrets trong code
   - Sử dụng environment variables
   - Định kỳ rotate secrets

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
- ✅ Google OAuth credentials
- ✅ Authorized redirect URIs trùng khớp
- ✅ Django Social Application cấu hình đúng
- ✅ Frontend Client ID cập nhật đúng
- ✅ Browser console không có lỗi JavaScript

---

**Ngày cập nhật:** March 19, 2026  
**Phiên bản:** 1.0

