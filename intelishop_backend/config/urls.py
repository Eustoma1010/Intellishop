"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from core import views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/register/', views.register_user), # Đường dẫn đăng ký
    path('api/login/', views.login_user),       # Đường dẫn đăng nhập
    path('api/data/', views.get_store_data),
    path('api/chat/', views.chat_with_ai),
    path('api/order/', views.create_order),
    path('api/user-orders/', views.get_user_orders),
    path('api/chat/', views.chat_with_ai, name='chat_with_ai'),
    path('api/tts/', views.get_audio_bytes, name='get_audio_bytes'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)