import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv()
# ==============================================================================
# BẢO MẬT & MÔI TRƯỜNG (ENTERPRISE STANDARD)
# ==============================================================================
# Đọc Secret Key từ biến môi trường, có fallback cho môi trường Dev
SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-e=b)=m01ivdnt0sqbjef2$3^o5u+r8zt&)ul%s4x7*)15rc=qw')
print(SECRET_KEY)
# Bật/Tắt DEBUG dựa trên biến môi trường (Mặc định là False để an toàn)
DEBUG = True #os.environ.get('DEBUG', 'False') == 'True'
print(DEBUG)
# Lấy danh sách domain được phép truy cập từ biến môi trường (cách nhau bởi dấu phẩy)
allowed_hosts_env = os.environ.get('ALLOWED_HOSTS', '*')
ALLOWED_HOSTS = allowed_hosts_env.split(',') if allowed_hosts_env != '*' else ['*']
print(allowed_hosts_env)
print(ALLOWED_HOSTS)
# ==============================================================================
# ỨNG DỤNG & MIDDLEWARE
# ==============================================================================
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Ứng dụng bên thứ 3
    'corsheaders',
    'import_export',
    'rest_framework',
    'rest_framework_simplejwt',

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
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
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

# Sử dụng chuẩn lưu trữ tĩnh mới của Django 4.2+ (Whitenoise nén và cache)
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ==============================================================================
# CẤU HÌNH CORS (Bảo mật tên miền)
# ==============================================================================
# Trong môi trường dev, cho phép tất cả. Trên production, nên chỉ cho phép tên miền FE.
CORS_ALLOW_ALL_ORIGINS = os.environ.get('CORS_ALLOW_ALL', 'True') == 'True'

# Nếu CORS_ALLOW_ALL_ORIGINS = False, Django sẽ đọc mảng dưới đây:
frontend_url = os.environ.get('FRONTEND_URL', 'https://intelishop-frontend.vercel.app')
CORS_ALLOWED_ORIGINS = [frontend_url]