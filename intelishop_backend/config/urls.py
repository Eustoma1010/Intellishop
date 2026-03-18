from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import JsonResponse
from core import views

# API Health Check để theo dõi trạng thái máy chủ (Dùng cho Ping/Uptime Robot)
def health_check(request):
    return JsonResponse({'status': 'ok', 'message': 'Intelishop Server is running!'})

urlpatterns = [
    # Quản trị & Giám sát
    path('admin/', admin.site.urls),
    path('api/health/', health_check),

    # API Xác thực
    path('api/register/', views.register_user),
    path('api/login/', views.login_user),

    # API Data & Chatbot AI
    path('api/data/', views.get_store_data),
    path('api/chat/', views.chat_with_ai),

    # API Order
    path('api/order/', views.create_order),
    path('api/user-orders/', views.get_user_orders),
]

# Quản lý file Media (Ảnh/Video)
if settings.DEBUG:
    # Môi trường Development (Local)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Môi trường Production (Render/Heroku)
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {
            'document_root': settings.MEDIA_ROOT,
        }),
    ]