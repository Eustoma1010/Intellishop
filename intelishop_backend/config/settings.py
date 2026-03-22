import os
import dj_database_url
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_csv(name, default=''):
    raw = os.environ.get(name, default)
    return [item.strip() for item in str(raw).split(',') if item.strip()]

# ==============================================================================
# BẢO MẬT & MÔI TRƯỜNG (ENTERPRISE STANDARD)
# ==============================================================================
# Đọc Secret Key từ biến môi trường, có fallback cho môi trường Dev
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-e=b)=m01ivdnt0sqbjef2$3^o5u+r8zt&)ul%s4x7*)15rc=qw')

# Bật/Tắt DEBUG dựa trên biến môi trường (Mặc định là False để an toàn)
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# Lấy danh sách domain được phép truy cập từ biến môi trường (cách nhau bởi dấu phẩy)
allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = allowed_hosts_env.split(',') if allowed_hosts_env != '*' else ['*']

# ==============================================================================
# ỨNG DỤNG & MIDDLEWARE
# ==============================================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',

    # Cloudinary Storage phải nằm trước staticfiles
    'cloudinary_storage',
    'django.contrib.staticfiles',
    'cloudinary',

    # Ứng dụng bên thứ 3
    'corsheaders',
    'import_export',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'rest_framework.authtoken',
    'django.contrib.sites',
    'dj_rest_auth',
    'dj_rest_auth.registration',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',

    # Ứng dụng nội bộ
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # Phải ở trên cùng để xử lý request đa miền
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Tối ưu phục vụ file tĩnh (CSS/JS)
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ==============================================================================
# CƠ SỞ DỮ LIỆU & XÁC THỰC
# ==============================================================================
# Sử dụng dj_database_url để tự động đọc DATABASE_URL từ .env hoặc Render.
# Nếu không có biến môi trường, hệ thống tự động fallback về db.sqlite3 ở Local.
DATABASES = {
    'default': dj_database_url.config(
        default=os.environ.get('DATABASE_URL', f"sqlite:///{BASE_DIR / 'db.sqlite3'}")
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Cấu hình JWT
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ==============================================================================
# NGÔN NGỮ, THỜI GIAN & TÀI NGUYÊN TĨNH
# ==============================================================================
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# ==============================================================================
# CẤU HÌNH LƯU TRỮ (STORAGES) - XỬ LÝ STATIC VÀ MEDIA (CLOUDINARY)
# ==============================================================================

STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage",
    },
    "staticfiles": {
        # Đưa về bộ lưu trữ mặc định của Django để bỏ qua quá trình nén gây lỗi
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}

# Thông tin xác thực Cloudinary đọc từ file .env
CLOUDINARY_STORAGE = {
    'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME'),
    'API_KEY': os.environ.get('CLOUDINARY_API_KEY'),
    'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET')
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# CẤU HÌNH CORS (Bảo mật tên miền)
# ==============================================================================
frontend_url = os.environ.get('FRONTEND_URL', 'https://intelishop-frontend.vercel.app')
default_cors_origins = [
    'http://127.0.0.1:8000',
    'http://localhost:8000',
    'http://127.0.0.1:63342',
    'http://localhost:63342',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    frontend_url,
]

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = env_csv('CORS_ALLOWED_ORIGINS', ','.join(default_cors_origins))
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = env_csv('CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS))

STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"

SITE_ID = 1

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'dj_rest_auth.jwt_auth.JWTCookieAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    )
}

REST_AUTH = {
    'USE_JWT': True,
    'JWT_AUTH_COOKIE': 'intelishop-auth',
    'JWT_AUTH_REFRESH_COOKIE': 'intelishop-refresh-token',
}

AUTH_USER_MODEL = 'core.User'
# Tắt xác thực email mặc định của allauth để không bị lỗi gửi mail
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_AUTHENTICATION_METHOD = 'email'

# OTP / Email
OTP_EXPIRE_MINUTES = int(os.environ.get('OTP_EXPIRE_MINUTES', '10'))
OTP_MAX_ATTEMPTS = int(os.environ.get('OTP_MAX_ATTEMPTS', '5'))
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'no-reply@intellishop.local')
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)
EMAIL_TIMEOUT = int(os.environ.get('EMAIL_TIMEOUT', '30'))
EMAIL_FILE_PATH = os.environ.get('EMAIL_FILE_PATH', str(BASE_DIR / 'sent_emails'))
EMAIL_BACKEND = os.environ.get('EMAIL_BACKEND') or (
    'django.core.mail.backends.smtp.EmailBackend'
    if EMAIL_HOST else 'django.core.mail.backends.console.EmailBackend'
)
OTP_DEBUG_RETURN_CODE = env_bool('OTP_DEBUG_RETURN_CODE', DEBUG)
