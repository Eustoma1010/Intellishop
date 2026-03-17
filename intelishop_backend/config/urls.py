# urls.py
from django.contrib import admin
from django.urls import path
from core import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),

    # API Xác thực mới
    path('api/register/', views.register_user),
    path('api/login/', views.login_user),

    # API Data & Chat
    path('api/data/', views.get_store_data),
    path('api/chat/', views.chat_with_ai), # Đã xóa dòng trùng lặp và bỏ api/tts/

    # API Order
    path('api/order/', views.create_order),
    path('api/user-orders/', views.get_user_orders),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)