# 🔐 REDESIGNED AUTH FLOW - INTELISHOP

**Date:** March 20, 2026  
**Status:** ✅ Updated & Implemented

---

## 📊 SYSTEM OVERVIEW

Hệ thống đăng ký/đăng nhập được thiết kế lại theo 4 luồng chính:

```
┌─────────────────────────────────────────┐
│  NGƯỜI DÙNG TRUY CẬP INTELISHOP        │
└─────────────────────┬───────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
    [ĐĂNG KÝ]               [ĐĂNG NHẬP]
    (Registration)          (Login)
        │                       │
    ┌───┴───┐              ┌────┴────┐
    │       │              │         │
   1A      1B            2A        2B
  Local   Google        Local     Google
```

---

## 🔄 LUỒNG CHI TIẾT

### **LUỒNG 1A: Đăng ký bằng Local (Form)**

```
Người dùng → Click "Đăng Ký"
           → Điền Form: Email, Mật khẩu, Họ tên, Số điện thoại
           → Click "Submit"
               ↓
Backend: POST /api/register/
    1. Kiểm tra Email đã tồn tại? 
       - YES ❌ → "Email đã được sử dụng"
       - NO ✅ → Tiếp
    
    2. Tạo bản ghi User mới
       - Email (normalized, lowercase)
       - Password (hash bằng Django)
       - Username = Email
       - Phone, Address
       - First_name = Họ tên
    
    3. Cấp JWT Tokens
       - access_token (1 day)
       - refresh_token (7 days)
    
    4. Auto login ✅
       → Redirect Home
```

**Response:**
```json
{
  "success": true,
  "message": "Đăng ký thành công! Bạn đã được tự động đăng nhập.",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@email.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

---

### **LUỒNG 1B: Đăng ký bằng Google**

```
Người dùng → Click "Đăng Ký với Google"
           → Google popup
           → Chọn Gmail account
           → Xác nhận permissions
               ↓
Frontend: handleGoogleCallback(response)
    → Extract: email, name, sub (uid)
    → POST /api/social-check/
               ↓
Backend: Kiểm tra Email Google tồn tại?

    CASE 1: Email KHÔNG tồn tại (NEW USER)
    ✅ Kích hoạt "KỊCH BẢN 2"
       - Tạo temp_token (15 phút expiry)
       - Redirect đến form "Hoàn tất Đăng Ký"
       - Hiển thị Email, Tên (prefill)
       - User bổ sung: Số điện thoại, Địa chỉ, Mật khẩu (optional)
       - Submit → POST /api/social-complete/
           ↓
           Tạo User + SocialAccount
           Cấp JWT tokens
           Auto login ✅
    
    CASE 2: Email ĐÃ tồn tại (EXISTING USER)
    Xem LUỒNG 2B
```

**Response (CASE 1 - Requires Info):**
```json
{
  "success": true,
  "action": "requires_info",
  "message": "Vui lòng bổ sung thông tin để hoàn tất đăng ký",
  "temp_token": "eyJ0eXAi...",
  "email": "user@gmail.com",
  "name": "Nguyễn Văn A",
  "provider": "google"
}
```

---

### **LUỒNG 2A: Đăng nhập bằng Local**

```
Người dùng → Click "Đăng Nhập"
           → Điền Email + Mật khẩu
           → Click "Đăng Nhập"
               ↓
Backend: POST /api/login/
    1. Kiểm tra Email tồn tại?
       - NO ❌ → "Tài khoản không tồn tại!"
       - YES ✅ → Tiếp
    
    2. Kiểm tra User có Mật khẩu không?
       - NO (chỉ dùng Google) ❌ → "Sử dụng Google hoặc Quên mật khẩu"
       - YES ✅ → Tiếp
    
    3. Verify mật khẩu (Django authenticate)
       - Sai ❌ → "Sai Email hoặc Mật khẩu!"
       - Đúng ✅ → Tiếp
    
    4. Cấp JWT tokens
       - access_token
       - refresh_token
    
    5. Auto login ✅
       → Redirect Home
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Đăng nhập thành công!",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@email.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

**Response (Error - User created via Google):**
```json
{
  "success": false,
  "message": "Tài khoản này được đăng ký qua Google/Facebook. Vui lòng sử dụng nút 'Đăng nhập với Google' hoặc sử dụng tính năng 'Quên mật khẩu' để thiết lập mật khẩu mới."
}
```

---

### **LUỒNG 2B: Đăng nhập bằng Google**

```
Người dùng → Click "Đăng Nhập với Google"
           → Google popup
           → Chọn Gmail
               ↓
Frontend: handleGoogleCallback(response)
    → POST /api/social-check/
               ↓
Backend: Kiểm tra Email Google tồn tại?

    CASE 1: Email KHÔNG tồn tại (NEW USER)
    ❌ User bấm nhầm "Đăng Nhập" thay "Đăng Ký"
       → Tự động chuyển sang KỊCH BẢN 2
       → Redirect form "Hoàn tất Đăng Ký"
       Response: action = "requires_info" + temp_token
    
    CASE 2: Email ĐÃ tồn tại (EXISTING USER)
    Kiểm tra SocialAccount liên kết?
    
        2.1: ĐÃ LÍN KỆT (từng đăng ký Google cùng ID)
             → Đăng nhập ngay ✅
             Response: action = "login" + JWT tokens
        
        2.2: CHƯA LIÊN KỆT (từng đăng ký Local, nay lười pass)
             → HỢP NHẤT: Tạo SocialAccount link với User cũ
             → Đăng nhập ngay ✅
             Response: action = "login" + JWT tokens
                    Message: "Tài khoản đã liên kết với Google..."
```

**Response (CASE 2.1 - Already linked):**
```json
{
  "success": true,
  "action": "login",
  "message": "Đăng nhập thành công!",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@email.com",
    "name": "Nguyễn Văn A"
  }
}
```

**Response (CASE 2.2 - Auto merged):**
```json
{
  "success": true,
  "action": "login",
  "message": "Tài khoản user@email.com đã liên kết với Google. Đăng nhập thành công!",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@email.com",
    "name": "Nguyễn Văn A"
  }
}
```

---

## 📋 DATABASE SCHEMA

### User Model
```python
User:
  - email (unique, PK)
  - username (= email)
  - password (hash, NULL if Google-only)
  - first_name
  - phone_number
  - address
  - is_active (default: True)
  - date_joined
```

### SocialAccount Model (from django-allauth)
```python
SocialAccount:
  - user (FK → User)
  - provider ('google', 'facebook', etc)
  - uid (Google ID)
  - unique_together: (user, provider)
```

---

## 🔄 KEY FEATURES

### ✅ Email Normalization
- Lowercase transformation
- Trim whitespace
- Case-insensitive lookup (`__iexact`)

### ✅ Password Security
- Auto hash via Django `create_user()`
- Check `user.has_usable_password()`
- Social-only accounts have NULL password

### ✅ Social Account Linking
- **New Google user** → Create User + SocialAccount
- **Existing Local user** → Auto-link SocialAccount (no conflict)
- **Existing Google user** → Login immediately

### ✅ Smart Account Merging
If user originally registered with email+password, later uses Google:
- System automatically links Google to existing Local account
- User can use either method going forward
- Same cart, orders, history preserved

### ✅ Temp Token Security
- Signed Django tokens
- 15-minute expiration
- Regenerates on each request

### ✅ JWT Token Management
- Access token: 1 day expiry
- Refresh token: 7 days expiry
- Stored in localStorage (frontend)
- Cookies available (CSRF protection ready)

---

## 🔍 API ENDPOINTS

### **POST /api/register/** (Luồng 1A)
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Nguyễn Văn A",
  "phone": "0123456789",
  "address": "123 Nguyễn Huệ, Quận 1"
}
```

**Success (201):**
```json
{ "success": true, "message": "...", "access_token": "...", "user": {...} }
```

**Errors:**
- 400: Email trống / Email đã tồn tại
- 500: Database error

---

### **POST /api/login/** (Luồng 2A)
**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success (200):**
```json
{ "success": true, "message": "...", "access_token": "...", "user": {...} }
```

**Errors:**
- 404: Tài khoản không tồn tại
- 400: Tài khoản chỉ dùng Google
- 401: Sai Email hoặc Mật khẩu

---

### **POST /api/social-check/** (Luồng 1B & 2B)
**Request:**
```json
{
  "email": "user@gmail.com",
  "name": "Nguyễn Văn A",
  "provider": "google",
  "uid": "1234567890"
}
```

**Response (Login - CASE 2.1/2.2):**
```json
{ "success": true, "action": "login", "access_token": "...", "user": {...} }
```

**Response (Requires Info - CASE 1):**
```json
{
  "success": true,
  "action": "requires_info",
  "temp_token": "...",
  "email": "user@gmail.com",
  "name": "Nguyễn Văn A",
  "provider": "google"
}
```

---

### **POST /api/social-complete/** (KỊCH BẢN 2)
**Request:**
```json
{
  "temp_token": "...",
  "phone": "0123456789",
  "address": "123 Đường Nguyễn Huệ",
  "password": ""  // Optional
}
```

**Success (201):**
```json
{ "success": true, "message": "...", "access_token": "...", "user": {...} }
```

**Errors:**
- 400: Token hết hạn
- 409: Email đã được đăng ký (race condition)

---

## 🧪 TEST SCENARIOS

### Scenario 1: Local Register → Local Login
```
1. POST /api/register/ {email, password, name, phone}
   ✅ User created, JWT tokens returned
2. POST /api/login/ {email, password}
   ✅ JWT tokens returned
```

### Scenario 2: Google Register (New User)
```
1. handleGoogleCallback(response)
2. POST /api/social-check/ {email, name, provider, uid}
   ✅ action: "requires_info", temp_token
3. User fills form (phone, address)
4. POST /api/social-complete/ {temp_token, phone, address}
   ✅ User + SocialAccount created, JWT tokens
```

### Scenario 3: Google Login (New User - Wrong Button)
```
1. handleGoogleCallback(response)
2. POST /api/social-check/ {email, ...}
   ✅ action: "requires_info" (redirects to register form)
3. [Same as Scenario 2]
```

### Scenario 4: Google Login (Existing Local User)
```
1. User registered via form: user@email.com + password
2. Later clicks "Đăng Nhập với Google"
3. POST /api/social-check/ {email: user@email.com, ...}
   ✅ action: "login" (auto-links Google)
   ✅ SocialAccount created
   ✅ User can now use both methods
```

### Scenario 5: Google Login (Existing Google User)
```
1. User registered via Google, has SocialAccount
2. Click "Đăng Nhập với Google"
3. POST /api/social-check/ {email, ...}
   ✅ action: "login" (instant login)
   ✅ JWT tokens returned
```

---

## 🔒 SECURITY CHECKLIST

- ✅ Password hashed (Django default)
- ✅ Email case-insensitive (prevent duplicates)
- ✅ Temp tokens signed & time-limited
- ✅ JWT tokens in localStorage (frontend)
- ✅ CORS configured
- ✅ `@csrf_exempt` on POST endpoints (JSON)
- ✅ Error messages don't leak user existence (partially)
- ✅ No hardcoded secrets (env variables)

---

## 📝 LOGGING

Backend logs for debugging:

```
✅ Đăng ký thành công: {email}
✅ Đăng nhập thành công: {email}
✅ SocialAccount đã tồn tại: {provider} - {email}
🔗 Liên kết {provider} cho {email}
📝 Email chưa tồn tại, bắt đầu Kịch bản 2: {email}
❌ Đăng ký thất bại: Email không hợp lệ
❌ Đăng nhập thất bại: Mật khẩu sai
❌ Temp token không hợp lệ: ...
```

---

## 🚀 DEPLOYMENT NOTES

1. **Environment Variables:**
   - `SECRET_KEY` (Django)
   - `GEMINI_API_KEY` (Google AI)
   - `GOOGLE_OAUTH_CLIENT_ID` (Google OAuth)
   - `GOOGLE_OAUTH_CLIENT_SECRET` (Google OAuth)

2. **Database:**
   - Run migrations: `python manage.py migrate`
   - Ensure `django-allauth` tables exist

3. **Frontend:**
   - Update Google SDK Client ID in `index.html`
   - Test all 4 luồng locally first

4. **Production:**
   - Use HTTPS
   - Update Google Cloud authorized URIs
   - Monitor login errors in logs

---

**Last Updated:** March 20, 2026  
**Status:** ✅ IMPLEMENTED & TESTED

