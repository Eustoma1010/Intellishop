import os
import dj_database_url
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from whitenoise.storage import CompressedManifestStaticFilesStorage
# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv()

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
# Cho phép tất cả trên cả dev và production như yêu cầu của bạn
CORS_ALLOW_ALL_ORIGINS = True

# Nếu CORS_ALLOW_ALL_ORIGINS = False, Django sẽ đọc mảng dưới đây:
frontend_url = os.environ.get('FRONTEND_URL', 'https://intelishop-frontend.vercel.app')
CORS_ALLOWED_ORIGINS = [frontend_url]

STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage"