# 🎨 FRONTEND UPDATE GUIDE - Auth Flow Integration

**Date:** March 20, 2026  
**Status:** Guide for frontend integration

---

## 📝 API Response Format Changes

Backend has been updated with new response formats. You need to update frontend code to handle them.

### **1. Register Endpoint: POST /api/register/**

#### OLD Response (if different):
```json
{
  "success": true,
  "message": "Đăng ký thành công!",
  "access_token": "...",
  "name": "Nguyễn Văn A",
  "email": "..."
}
```

#### NEW Response:
```json
{
  "success": true,
  "message": "Đăng ký thành công! Bạn đã được tự động đăng nhập.",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

#### What Changed:
- ✅ `refresh_token` now included
- ✅ `user` object with `email`, `name`, `phone`
- ✅ Better error messages

#### Frontend Update Needed:
```javascript
// OLD
let token = response.data.access_token;
App.currentUser = { email: response.data.email, name: response.data.name };

// NEW
let token = response.data.access_token;
let refreshToken = response.data.refresh_token;
localStorage.setItem('access_token', token);
localStorage.setItem('refresh_token', refreshToken);
App.currentUser = response.data.user;  // Complete user object
```

---

### **2. Login Endpoint: POST /api/login/**

#### NEW Response (Success):
```json
{
  "success": true,
  "message": "Đăng nhập thành công!",
  "access_token": "eyJ0eXAi...",
  "refresh_token": "eyJ0eXAi...",
  "user": {
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

#### NEW Error Cases:
```json
// 404 - User not found
{
  "success": false,
  "message": "Tài khoản không tồn tại! Vui lòng Đăng ký trước."
}

// 400 - User only has Google account
{
  "success": false,
  "message": "Tài khoản này được đăng ký qua Google/Facebook. Vui lòng sử dụng nút 'Đăng nhập với Google' hoặc sử dụng tính năng 'Quên mật khẩu' để thiết lập mật khẩu mới."
}

// 401 - Wrong password
{
  "success": false,
  "message": "Sai Email hoặc Mật khẩu!"
}
```

---

### **3. Social Check Endpoint: POST /api/social-check/**

#### NEW Response (New User → Kịch bản 2):
```json
{
  "success": true,
  "action": "requires_info",
  "message": "Vui lòng bổ sung thông tin để hoàn tất đăng ký",
  "temp_token": "eyJ...",
  "email": "user@gmail.com",
  "name": "Nguyễn Văn A",
  "provider": "google"
}
```

#### NEW Response (Existing User → Login):
```json
{
  "success": true,
  "action": "login",
  "message": "Đăng nhập thành công!",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "email": "user@example.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

#### NEW Response (Auto-linked):
```json
{
  "success": true,
  "action": "login",
  "message": "Tài khoản user@example.com đã liên kết với Google. Đăng nhập thành công!",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {...}
}
```

---

### **4. Social Complete Endpoint: POST /api/social-complete/**

#### NEW Response (Success):
```json
{
  "success": true,
  "message": "Đăng ký thành công! Bạn đã được tự động đăng nhập.",
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "email": "user@gmail.com",
    "name": "Nguyễn Văn A",
    "phone": "0123456789"
  }
}
```

#### NEW Error Cases:
```json
// 400 - Token expired
{
  "success": false,
  "message": "Token hết hạn (15 phút). Vui lòng bắt đầu lại từ đầu."
}

// 409 - Email already registered (race condition)
{
  "success": false,
  "message": "Email này đã được đăng ký. Vui lòng Đăng nhập hoặc chọn email khác."
}
```

---

## 🔄 Frontend Handler Updates

### **handleRegisterSubmit()**

```javascript
// OLD
async function handleRegisterSubmit(event) {
  event.preventDefault();
  
  const payload = {
    email: $('reg-email').value,
    password: $('reg-password').value,
    name: $('reg-name').value,
    phone: $('reg-phone').value
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('access_token', data.access_token);
      App.isLoggedIn = true;
      App.currentUser = { email: data.email, name: data.name };
      showNotification('Đăng ký thành công!');
      showHome();
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Lỗi kết nối', 'error');
  }
}

// NEW
async function handleRegisterSubmit(event) {
  event.preventDefault();
  
  const payload = {
    email: $('reg-email').value,
    password: $('reg-password').value,
    name: $('reg-name').value,
    phone: $('reg-phone').value,
    address: $('reg-address').value  // NEW FIELD
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    
    if (data.success) {
      // NEW: Store both tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      // NEW: Use complete user object
      App.isLoggedIn = true;
      App.currentUser = data.user;  // {email, name, phone}
      
      showNotification(data.message);
      $('register-form').reset();
      setTimeout(() => showHome(), 300);
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Lỗi kết nối', 'error');
  }
}
```

---

### **handleLogin()**

```javascript
// OLD
async function handleLogin(event) {
  event.preventDefault();
  
  const payload = {
    email: $('login-email').value,
    password: $('login-password').value
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    
    if (data.success) {
      localStorage.setItem('access_token', data.access_token);
      App.isLoggedIn = true;
      App.currentUser = { email: data.email, name: data.name };
      showHome();
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Lỗi kết nối', 'error');
  }
}

// NEW
async function handleLogin(event) {
  event.preventDefault();
  
  const payload = {
    email: $('login-email').value,
    password: $('login-password').value
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const data = await response.json();
      showNotification(data.message, 'error');
      return;
    }
    
    const data = await response.json();
    
    if (data.success) {
      // NEW: Store both tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      // NEW: Use complete user object
      App.isLoggedIn = true;
      App.currentUser = data.user;
      
      updateAuthUI();
      showNotification(data.message);
      $('login-form').reset();
      setTimeout(() => showHome(), 300);
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Lỗi kết nối', 'error');
  }
}
```

---

### **processSocialPayload() - Handle Social Check**

```javascript
// OLD
async function processSocialPayload(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/social-check/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (data.action === 'login') {
      localStorage.setItem('access_token', data.access_token);
      App.isLoggedIn = true;
      App.currentUser = { email: data.email, name: data.name };
      showHome();
    } else if (data.action === 'requires_info') {
      showCompleteRegistration(data.email, data.name, data.temp_token);
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// NEW
async function processSocialPayload(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/social-check/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      showNotification(data.message, 'error');
      return;
    }

    if (data.action === 'login') {
      // NEW: Store both tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      // NEW: Use complete user object
      App.isLoggedIn = true;
      App.currentUser = data.user;
      
      updateAuthUI();
      showNotification(data.message);
      setTimeout(() => showHome(), 300);
      
    } else if (data.action === 'requires_info') {
      // NEW: Store data for Scenario 2
      sessionStorage.setItem('social_temp_token', data.temp_token);
      sessionStorage.setItem('social_provider', data.provider);
      
      showNotification('Vui lòng bổ sung thông tin', 'info');
      showCompleteRegistration(data.email, data.name, data.temp_token);
    }
  } catch (error) {
    showNotification(error.message || 'Lỗi xác thực', 'error');
  }
}
```

---

### **handleCompleteRegistration() - Scenario 2**

```javascript
// OLD
window.handleCompleteRegisterSubmit = async (event) => {
  event.preventDefault();
  const btn = $('btn-comp-submit');
  const tempToken = sessionStorage.getItem('temp_social_token');

  if (!tempToken) {
    showNotification('Phiên hết hạn', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-spinner fa-spin"></i> Đang xử lý...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/social-complete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temp_token: tempToken,
        password: $('comp-password').value
      })
    });
    const data = await response.json();

    if (data.success) {
      localStorage.setItem('access_token', data.access_token);
      App.isLoggedIn = true;
      App.currentUser = {};
      showHome();
    } else {
      showNotification(data.message, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-check"></i> HOÀN TẤT ĐĂNG KÝ';
  }
};

// NEW
window.handleCompleteRegisterSubmit = async (event) => {
  event.preventDefault();
  const btn = $('btn-comp-submit');
  const tempToken = sessionStorage.getItem('social_temp_token');

  if (!tempToken) {
    showNotification('Token hết hạn. Vui lòng bắt đầu lại từ đầu.', 'error');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-spinner fa-spin"></i> Đang xử lý...';

  try {
    const response = await fetch(`${API_BASE_URL}/api/social-complete/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temp_token: tempToken,
        phone: $('comp-phone').value || '',  // NEW: Phone field
        address: $('comp-address').value || '',  // NEW: Address field
        password: $('comp-password').value || ''  // Optional password
      })
    });

    if (!response.ok) {
      const data = await response.json();
      showNotification(data.message, 'error');
      return;
    }

    const data = await response.json();

    if (data.success) {
      // NEW: Store both tokens
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      
      // NEW: Use complete user object
      App.isLoggedIn = true;
      App.currentUser = data.user;
      
      sessionStorage.removeItem('social_temp_token');
      sessionStorage.removeItem('social_provider');
      
      updateAuthUI();
      showNotification(data.message);
      setTimeout(() => showHome(), 300);
    } else {
      showNotification(data.message, 'error');
    }
  } catch (error) {
    showNotification('Lỗi kết nối', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-check"></i> HOÀN TẤT ĐĂNG KÝ';
  }
};
```

---

## 📋 HTML Form Fields to Update

### **Register Form:**
```html
<input type="email" id="reg-email" placeholder="Email" />
<input type="password" id="reg-password" placeholder="Mật khẩu" />
<input type="text" id="reg-name" placeholder="Họ tên" />
<input type="tel" id="reg-phone" placeholder="Số điện thoại" />
<input type="text" id="reg-address" placeholder="Địa chỉ" /> <!-- NEW -->
```

### **Complete Registration Form (Scenario 2):**
```html
<input type="email" id="comp-email" placeholder="Email" readonly />
<input type="text" id="comp-name" placeholder="Họ tên" readonly />
<input type="tel" id="comp-phone" placeholder="Số điện thoại" /> <!-- NEW -->
<input type="text" id="comp-address" placeholder="Địa chỉ" /> <!-- NEW -->
<input type="password" id="comp-password" placeholder="Mật khẩu (tùy chọn)" /> <!-- OPTIONAL -->
```

---

## 🧪 Testing Checklist

After updating frontend:

- [ ] Register with email/password (1A)
  - [ ] Form fields all required
  - [ ] Success: Redirect to Home, logged in
  - [ ] Error: Show "Email đã tồn tại"
  
- [ ] Login with email/password (2A)
  - [ ] Success: Redirect to Home, logged in
  - [ ] Error (404): "Tài khoản không tồn tại"
  - [ ] Error (400): "Sử dụng Google"
  - [ ] Error (401): "Sai Email hoặc Mật khẩu"
  
- [ ] Register with Google (1B)
  - [ ] Click button → Google popup
  - [ ] Select account → Shows Scenario 2 form
  - [ ] Fill phone, address → Submit
  - [ ] Success: Redirect to Home, logged in
  
- [ ] Login with Google existing (2B)
  - [ ] Click button → Google popup
  - [ ] Instant login if already linked
  - [ ] Auto-link if Local user
  
- [ ] JWT tokens stored correctly
  - [ ] localStorage has access_token
  - [ ] localStorage has refresh_token
  - [ ] Tokens valid for subsequent requests

---

## ✅ Deployment

1. Update all frontend handlers
2. Update HTML form fields
3. Test all 4 flows locally
4. Deploy backend first
5. Deploy frontend
6. Monitor logs for errors
7. Test on production URL

---

**Last Updated:** March 20, 2026  
**Status:** Ready for integration

