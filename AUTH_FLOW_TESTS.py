#!/usr/bin/env python
"""
AUTH_FLOW_TESTS.py - Kiểm tra các API endpoints theo từng luồng

Chạy: python manage.py shell
Sau đó: exec(open('AUTH_FLOW_TESTS.py').read())
"""

import requests
import json
from django.contrib.auth import get_user_model

User = get_user_model()
BASE_URL = "http://127.0.0.1:8000"

print("=" * 80)
print("🧪 TESTING REDESIGNED AUTH FLOW")
print("=" * 80)

# ============================================================================
# LUỒNG 1A: ĐĂNG KÝ BẰNG LOCAL (FORM)
# ============================================================================

print("\n" + "=" * 80)
print("LUỒNG 1A: Đăng ký bằng Local (Email + Mật khẩu)")
print("=" * 80)

test_user_1a = {
    "email": "local_user@example.com",
    "password": "TestPass123!",
    "name": "Nguyễn Văn A",
    "phone": "0123456789",
    "address": "123 Đường Nguyễn Huệ"
}

print("\n[TEST 1A.1] Đăng ký user mới")
print(f"Request: POST /api/register/")
print(f"Data: {json.dumps(test_user_1a, indent=2)}")

response = requests.post(
    f"{BASE_URL}/api/register/",
    json=test_user_1a
)

print(f"\nResponse Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 201 or response.status_code == 200:
    print("✅ PASS: User đã được tạo và tự động đăng nhập")
    access_token_1a = response.json().get('access_token')
else:
    print("❌ FAIL: Đăng ký thất bại")
    access_token_1a = None

# ============================================================================
# LUỒNG 1A: TEST LỖI - EMAIL ĐÃ TỒN TẠI
# ============================================================================

print("\n[TEST 1A.2] Đăng ký với email đã tồn tại (expected: 400)")

test_user_duplicate = {
    "email": "local_user@example.com",
    "password": "AnotherPass123!",
    "name": "Nguyễn Văn B",
    "phone": "0987654321"
}

response = requests.post(
    f"{BASE_URL}/api/register/",
    json=test_user_duplicate
)

print(f"Response Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 400:
    if "Email đã được sử dụng" in response.json().get('message', ''):
        print("✅ PASS: Hệ thống chặn email trùng lặp")
    else:
        print("❌ FAIL: Message không chính xác")
else:
    print("❌ FAIL: Should return 400")

# ============================================================================
# LUỒNG 2A: ĐĂNG NHẬP BẰNG LOCAL
# ============================================================================

print("\n" + "=" * 80)
print("LUỒNG 2A: Đăng nhập bằng Local (Email + Mật khẩu)")
print("=" * 80)

print("\n[TEST 2A.1] Đăng nhập thành công")

login_data_2a = {
    "email": "local_user@example.com",
    "password": "TestPass123!"
}

print(f"Request: POST /api/login/")
print(f"Data: {json.dumps(login_data_2a, indent=2)}")

response = requests.post(
    f"{BASE_URL}/api/login/",
    json=login_data_2a
)

print(f"\nResponse Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 200:
    if response.json().get('success') and response.json().get('access_token'):
        print("✅ PASS: Đăng nhập thành công, JWT tokens được cấp")
    else:
        print("❌ FAIL: Response format không đúng")
else:
    print("❌ FAIL: Đăng nhập thất bại")

# ============================================================================
# LUỒNG 2A: TEST LỖI - SAI MẬT KHẨU
# ============================================================================

print("\n[TEST 2A.2] Đăng nhập với mật khẩu sai (expected: 401)")

login_data_wrong_pass = {
    "email": "local_user@example.com",
    "password": "WrongPassword123!"
}

response = requests.post(
    f"{BASE_URL}/api/login/",
    json=login_data_wrong_pass
)

print(f"Response Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 401:
    if "Sai" in response.json().get('message', ''):
        print("✅ PASS: Hệ thống chặn mật khẩu sai")
    else:
        print("❌ FAIL: Message không đúng")
else:
    print("❌ FAIL: Should return 401")

# ============================================================================
# LUỒNG 2A: TEST LỖI - EMAIL KHÔNG TỒN TẠI
# ============================================================================

print("\n[TEST 2A.3] Đăng nhập với email không tồn tại (expected: 404)")

login_data_no_user = {
    "email": "nonexistent@example.com",
    "password": "TestPass123!"
}

response = requests.post(
    f"{BASE_URL}/api/login/",
    json=login_data_no_user
)

print(f"Response Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 404:
    if "không tồn tại" in response.json().get('message', '').lower():
        print("✅ PASS: Hệ thống báo user không tồn tại")
    else:
        print("❌ FAIL: Message không đúng")
else:
    print("❌ FAIL: Should return 404")

# ============================================================================
# LUỒNG 1B: ĐĂNG KÝ BẰNG GOOGLE (NEW USER)
# ============================================================================

print("\n" + "=" * 80)
print("LUỒNG 1B: Đăng ký bằng Google (Email chưa tồn tại)")
print("=" * 80)

print("\n[TEST 1B.1] Google email chưa tồn tại → requires_info")

social_check_data_new = {
    "email": "google_new@gmail.com",
    "name": "Nguyễn Văn C",
    "provider": "google",
    "uid": "1234567890"
}

print(f"Request: POST /api/social-check/")
print(f"Data: {json.dumps(social_check_data_new, indent=2)}")

response = requests.post(
    f"{BASE_URL}/api/social-check/",
    json=social_check_data_new
)

print(f"\nResponse Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 200:
    resp_json = response.json()
    if resp_json.get('action') == 'requires_info' and resp_json.get('temp_token'):
        print("✅ PASS: Hệ thống yêu cầu bổ sung thông tin (Kịch bản 2)")
        temp_token_1b = resp_json.get('temp_token')
    else:
        print("❌ FAIL: Response action không đúng")
        temp_token_1b = None
else:
    print("❌ FAIL: social-check failed")
    temp_token_1b = None

# ============================================================================
# KỊCH BẢN 2: HOÀN TẤT ĐĂNG KÝ GOOGLE
# ============================================================================

if temp_token_1b:
    print("\n[TEST 2] Hoàn tất đăng ký Google (Kịch bản 2)")
    
    social_complete_data = {
        "temp_token": temp_token_1b,
        "phone": "0123456789",
        "address": "456 Đường Trần Hưng Đạo",
        "password": ""  # Optional
    }
    
    print(f"Request: POST /api/social-complete/")
    print(f"Data: temp_token=..., phone=0123456789, address=456...")
    
    response = requests.post(
        f"{BASE_URL}/api/social-complete/",
        json=social_complete_data
    )
    
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    
    if response.status_code == 201 or response.status_code == 200:
        resp_json = response.json()
        if resp_json.get('success') and resp_json.get('access_token'):
            print("✅ PASS: User Google tạo thành công + JWT tokens")
            # Verify SocialAccount created
            from allauth.socialaccount.models import SocialAccount
            try:
                social = SocialAccount.objects.get(uid="1234567890", provider="google")
                print("✅ PASS: SocialAccount đã được liên kết")
            except:
                print("❌ FAIL: SocialAccount không được tạo")
        else:
            print("❌ FAIL: Response format không đúng")
    else:
        print("❌ FAIL: social-complete failed")

# ============================================================================
# LUỒNG 2B: ĐĂNG NHẬP BẰNG GOOGLE (EXISTING LOCAL USER)
# ============================================================================

print("\n" + "=" * 80)
print("LUỒNG 2B: Đăng nhập Google (Existing Local User)")
print("=" * 80)

print("\n[TEST 2B.1] Google email = Local user → Auto-link")

social_check_data_existing = {
    "email": "local_user@example.com",  # Email từ Luồng 1A
    "name": "Nguyễn Văn A",
    "provider": "google",
    "uid": "9876543210"
}

print(f"Request: POST /api/social-check/")
print(f"Data: {json.dumps(social_check_data_existing, indent=2)}")

response = requests.post(
    f"{BASE_URL}/api/social-check/",
    json=social_check_data_existing
)

print(f"\nResponse Status: {response.status_code}")
print(f"Response: {json.dumps(response.json(), indent=2)}")

if response.status_code == 200:
    resp_json = response.json()
    if resp_json.get('action') == 'login' and resp_json.get('access_token'):
        print("✅ PASS: Hệ thống auto-link Google → Đăng nhập")
        # Verify SocialAccount created
        from allauth.socialaccount.models import SocialAccount
        try:
            social = SocialAccount.objects.get(uid="9876543210", provider="google")
            print("✅ PASS: SocialAccount đã được tạo tự động")
        except:
            print("❌ FAIL: SocialAccount không được tạo")
    else:
        print("❌ FAIL: Response action không đúng")
else:
    print("❌ FAIL: social-check failed")

# ============================================================================
# SUMMARY
# ============================================================================

print("\n" + "=" * 80)
print("✅ ALL TESTS COMPLETED")
print("=" * 80)
print("\nTo run these tests:")
print("1. python manage.py shell")
print("2. exec(open('AUTH_FLOW_TESTS.py').read())")
print("\nNote: Backend must be running on http://127.0.0.1:8000")

