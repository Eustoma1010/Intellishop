from django.contrib import admin
from django.urls import path, re_path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import JsonResponse, FileResponse
from core import views
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
import os
from pathlib import Path
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / '.env')

# Thư mục gốc của Frontend (nằm song song với intelishop_backend)
FRONTEND_DIR = str(Path(__file__).resolve().parent.parent.parent / 'intelishop_frontend')

# Lấy Frontend URL từ .env, mặc định là localhost
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5500')

class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = f"{FRONTEND_URL}/"
    client_class = OAuth2Client

def health_check(request):
    return JsonResponse({'status': 'ok', 'message': 'Intelishop Server is running!'})

def serve_frontend(request):
    """Phục vụ frontend index.html tại đường dẫn gốc /"""
    index_path = os.path.join(FRONTEND_DIR, 'index.html')
    if os.path.exists(index_path):
        return FileResponse(open(index_path, 'rb'), content_type='text/html; charset=utf-8')
    return JsonResponse({'error': 'Frontend không tìm thấy. Kiểm tra thư mục intelishop_frontend/'}, status=404)

urlpatterns = [
    # Quản trị & Giám sát
    path('admin/', admin.site.urls),
    path('api/health/', health_check),

    # API Xác thực
    path('api/register/', views.register_user),
    path('api/login/', views.login_user),
    path('api/register/verify-otp/', views.verify_register_otp),
    path('api/register/resend-otp/', views.resend_register_otp),
    path('api/forgot-password/send-otp/', views.forgot_password_send_otp),
    path('api/forgot-password/reset/', views.forgot_password_reset),
    path('api/profile/', views.user_profile),
    path('api/addresses/', views.addresses_api),
    path('api/addresses/<int:address_id>/', views.address_detail_api),

    # API Đăng ký trở thành Người bán / Đơn vị vận chuyển
    path('api/apply/vendor/', views.apply_vendor),
    path('api/apply/shipper/', views.apply_shipper),
    path('api/apply/status/', views.my_application_status),
    path('api/vendor/store/', views.vendor_store_profile_api),
    path('api/vendor/products/', views.vendor_products_api),
    path('api/vendor/products/<int:product_id>/', views.vendor_product_detail_api),
    path('api/vendor/vouchers/', views.vendor_vouchers_api),
    path('api/vendor/vouchers/<int:voucher_id>/', views.vendor_voucher_detail_api),
    path('api/vendor/reports/dashboard/', views.vendor_sales_dashboard_api),
    path('api/vendor/orders/<int:order_id>/ready/', views.vendor_mark_order_ready_api),
    path('api/shipper/dashboard/', views.shipper_dashboard_api),
    path('api/shipper/orders/<int:order_id>/accept/', views.shipper_accept_order_api),
    path('api/shipper/orders/<int:order_id>/status/', views.shipper_update_order_status_api),
    path('api/shipper/orders/<int:order_id>/detail/', views.shipper_order_detail_api),
    path('api/admin/users/', views.admin_users_api),
    path('api/admin/approvals/pending/', views.admin_pending_approvals_api),
    path('api/admin/approvals/vendor/action/', views.admin_vendor_approval_action_api),
    path('api/admin/approvals/shipper/action/', views.admin_shipper_approval_action_api),
    path('api/admin/products/moderate/', views.admin_product_moderation_api),
    path('api/admin/reports/dashboard/', views.admin_reports_dashboard_api),
    path('api/support/tickets/', views.support_tickets_api),
    path('api/support/tickets/<int:ticket_id>/reply/', views.support_ticket_reply_api),
    path('api/system/reviews/', views.system_reviews_api),

    # API Data & Chatbot AI
    path('api/data/', views.get_store_data),
    path('api/products/<int:product_id>/', views.product_detail_api),
    path('api/stores/<int:store_id>/reviews/', views.store_reviews_api),
    path('api/chat/', views.chat_with_ai),

    # API Order
    path('api/checkout/calculate/', views.calculate_checkout),
    path('api/order/', views.create_order),
    path('api/user-orders/', views.get_user_orders),
    path('api/wishlist/', views.wishlist_api),
    path('api/wishlist/<int:item_id>/', views.wishlist_detail_api),

    path('accounts/', include('allauth.urls')),

    path('api/social-check/', views.social_auth_check),
    path('api/social-complete/', views.social_auth_complete),
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    # =====================================================
    # PHỤC VỤ FRONTEND tại http://127.0.0.1:8000/
    # =====================================================
    path('', serve_frontend),
    re_path(r'^(?P<path>(?!api/)(?!admin/)(?!media/)(?!accounts/)(?!static/).+)$',
            serve, {'document_root': FRONTEND_DIR}),
]

# Quản lý file Media (Ảnh/Video)
if settings.DEBUG:
    # Môi trường Development (Local)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Môi trường Production (Render/Heroku)
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]