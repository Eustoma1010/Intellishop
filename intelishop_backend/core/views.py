import json
import re
import random
import base64
import threading
from decimal import Decimal, InvalidOperation
import edge_tts
import numpy as np
import asyncio
import os
import faiss
import logging
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv
from django.conf import settings
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.core.mail import send_mail
from django.core.paginator import Paginator
from rest_framework_simplejwt.tokens import RefreshToken
import google.generativeai as genai
from django.utils import timezone
from .models import Store, Product, Voucher, Order, OrderItem, Category, Address, Wishlist, VendorApplication, ShipperApplication, ShipperProfile, EmailOTPChallenge, StoreReview, SupportTicket, SystemReview
from django.core import signing
from allauth.socialaccount.models import SocialAccount
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Sum, Count, F, Avg, Q
# Cấu hình logging doanh nghiệp
logger = logging.getLogger(__name__)
User = get_user_model()
load_dotenv(Path(settings.BASE_DIR) / '.env')
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-3.1-flash-lite-preview')

# FAISS index is now managed by rag_manager (auto-rebuild on Product changes).
from core import rag_manager


def _parse_decimal(value, default='0'):
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _as_text(value):
    if isinstance(value, list):
        value = value[0] if value else ''
    if value is None:
        return ''
    return str(value).strip()


def _get_user_by_email(email):
    email = (email or '').strip().lower()
    if not email:
        return None
    return User.objects.filter(email__iexact=email).first()


def _get_admin_user_by_email(email):
    admin_user = _get_user_by_email(email)
    if not admin_user:
        return None, Response({'success': False, 'message': 'Khong tim thay tai khoan admin.'}, status=404)
    if not (admin_user.is_superuser or admin_user.is_staff or admin_user.role == 'ADMIN'):
        return None, Response({'success': False, 'message': 'Ban khong co quyen quan tri.'}, status=403)
    return admin_user, None


def _serialize_address(address):
    return {
        'id': address.id,
        'receiver_name': address.receiver_name,
        'receiver_phone': address.receiver_phone,
        'full_address': address.full_address,
        'is_default': address.is_default,
    }


def _status_label(status):
    labels = {
        Order.STATUS_PENDING: 'Cho shop xac nhan',
        Order.STATUS_READY_FOR_PICKUP: 'Cho shipper lay hang',
        Order.STATUS_DELIVERING: 'Dang giao',
        Order.STATUS_DELIVERED: 'Da giao',
        Order.STATUS_FAILED: 'Giao that bai',
        'Chờ duyệt': 'Cho xac nhan',
        'Đang giao': 'Dang giao',
        'Hoàn thành': 'Da giao',
        'Hủy': 'That bai',
    }
    return labels.get(status, status)


def _get_shipper_profile_by_email(email, require_active=True):
    user = _get_user_by_email(email)
    if not user:
        return None, None, Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    can_shipper = (
        user.role == 'SHIPPER'
        or ShipperProfile.objects.filter(user=user).exists()
        or ShipperApplication.objects.filter(user=user, status='approved').exists()
    )
    if not can_shipper:
        return user, None, Response({'success': False, 'message': 'Tài khoản chưa có quyền vận chuyển.'}, status=403)

    profile = ShipperProfile.objects.filter(user=user).first()
    if not profile:
        return user, None, Response({'success': False, 'message': 'Chưa có hồ sơ đơn vị vận chuyển.'}, status=404)
    if require_active and not profile.is_active:
        return user, profile, Response({'success': False, 'message': 'Hồ sơ vận chuyển đang chờ Admin duyệt.'}, status=403)
    return user, profile, None


def _get_vendor_store_by_email(email, require_active=True):
    user = _get_user_by_email(email)
    if not user:
        return None, None, Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    can_vendor = (
        user.role == 'VENDOR'
        or Store.objects.filter(owner=user).exists()
        or VendorApplication.objects.filter(user=user, status='approved').exists()
    )
    if not can_vendor:
        return user, None, Response({'success': False, 'message': 'Tài khoản chưa có quyền quản lý cửa hàng.'}, status=403)

    store = Store.objects.filter(owner=user).first()
    if not store:
        return user, None, Response({'success': False, 'message': 'Chưa có cửa hàng liên kết với tài khoản này.'}, status=404)
    if require_active and not store.is_active:
        return user, store, Response({'success': False, 'message': 'Cửa hàng đang chờ Admin phê duyệt.'}, status=403)
    return user, store, None


def _serialize_vendor_product(product):
    image_url = ''
    if product.image and hasattr(product.image, 'url'):
        try:
            image_url = product.image.url
        except Exception:
            image_url = ''

    return {
        'id': product.id,
        'name': product.name,
        'description': product.description,
        'price': float(product.price),
        'stock': product.stock,
        'status': product.status,
        'moderation_status': product.moderation_status,
        'is_deleted': product.is_deleted,
        'category_id': product.category_id,
        'category_name': product.category.name if product.category else '',
        'image': image_url,
    }


def _serialize_voucher(voucher):
    return {
        'id': voucher.id,
        'code': voucher.code,
        'name': voucher.name,
        'discount_type': voucher.discount_type,
        'discount_value': float(voucher.discount_value),
        'start_date': voucher.start_date.isoformat(),
        'end_date': voucher.end_date.isoformat(),
        'scope': voucher.scope,
        'status': voucher.status,
    }


def _serialize_store_review(review):
    return {
        'id': review.id,
        'store_id': review.store_id,
        'user_email': review.user.email,
        'user_name': review.user.full_name or review.user.email,
        'rating': int(review.rating),
        'comment': review.comment,
        'created_at': review.created_at.strftime('%d/%m/%Y %H:%M'),
        'updated_at': review.updated_at.strftime('%d/%m/%Y %H:%M'),
    }


def _serialize_shipper_order(order, current_shipper_user=None):
    item_list = list(order.items.all())
    item_count = sum(max(int(item.quantity or 0), 0) for item in item_list)
    store_names = []
    for item in item_list:
        product = getattr(item, 'product', None)
        store = getattr(product, 'store', None) if product else None
        if store and store.name and store.name not in store_names:
            store_names.append(store.name)

    primary_store_name = store_names[0] if store_names else ''
    if len(store_names) > 1:
        primary_store_name = f"{primary_store_name} +{len(store_names) - 1} shop"

    shipper_company_name = ''
    if order.shipper_id and hasattr(order.shipper, 'shipper_profile') and order.shipper.shipper_profile:
        shipper_company_name = order.shipper.shipper_profile.company_name

    is_assigned_to_me = bool(current_shipper_user and order.shipper_id == current_shipper_user.id)
    return {
        'id': order.id,
        'order_code': order.order_code,
        'customer_name': order.customer_name,
        'customer_phone': order.customer_phone,
        'shipping_address': order.shipping_address,
        'status': order.status,
        'status_label': _status_label(order.status),
        'created_at': order.created_at.strftime('%d/%m/%Y %H:%M'),
        'total_amount': float(order.total_amount or 0),
        'payment_method': order.payment_method,
        'item_count': item_count,
        'store_name': primary_store_name,
        'vendor_name': order.vendor.full_name if order.vendor else '',
        'shipper_company_name': shipper_company_name,
        'is_assigned_to_me': is_assigned_to_me,
        'can_accept': order.status == Order.STATUS_READY_FOR_PICKUP and order.shipper_id is None,
        'can_mark_delivered': is_assigned_to_me and order.status == Order.STATUS_DELIVERING,
        'can_mark_failed': is_assigned_to_me and order.status == Order.STATUS_DELIVERING,
        'is_active_delivery': order.status in [Order.STATUS_READY_FOR_PICKUP, Order.STATUS_DELIVERING],
    }


def _serialize_shipping_provider(profile, index=0):
    templates = [
        {'service_label': 'Tiet kiem', 'fee': 18000, 'eta': '3-5 ngay', 'description': 'Phu hop don hang thong thuong', 'accent': 'amber'},
        {'service_label': 'Nhanh', 'fee': 28000, 'eta': '1-2 ngay', 'description': 'Uu tien giao nhanh cho don can som', 'accent': 'blue'},
        {'service_label': 'Hoa toc', 'fee': 45000, 'eta': 'Trong ngay', 'description': 'Dich vu uu tien giao trong ngay noi thanh', 'accent': 'purple'},
    ]
    template = templates[index % len(templates)]
    company_name = profile.company_name or f'Shipper #{profile.id}'
    return {
        'id': profile.id,
        'code': f'shipper-{profile.id}',
        'company_name': company_name,
        'service_label': template['service_label'],
        'fee': template['fee'],
        'eta': template['eta'],
        'description': template['description'],
        'accent': template['accent'],
        'contact_email': profile.contact_email,
        'phone_number': profile.phone_number,
        'is_active': bool(profile.is_active),
    }


def _get_shipping_provider_payload():
    active_profiles = list(ShipperProfile.objects.filter(is_active=True).order_by('-updated_at', 'company_name'))
    if active_profiles:
        return [_serialize_shipping_provider(profile, index) for index, profile in enumerate(active_profiles)]
    return [{
        'id': 0,
        'code': 'default-shipping',
        'company_name': 'Intellishop Delivery',
        'service_label': 'Tiet kiem',
        'fee': 18000,
        'eta': '3-5 ngay',
        'description': 'Don vi giao hang mac dinh cua he thong',
        'accent': 'pink',
        'contact_email': '',
        'phone_number': '',
        'is_active': True,
    }]


def _extract_preferred_shipping_provider(note):
    note = _as_text(note)
    marker = 'Đơn vị giao hàng ưu tiên:'
    if marker in note:
        return note.split(marker, 1)[1].strip().splitlines()[0].strip()
    return ''


def _normalize_cart_items(cart_items, lock_for_update=False):
    product_ids = []
    for item in cart_items:
        try:
            product_ids.append(int(item.get('id')))
        except (TypeError, ValueError):
            continue

    queryset = Product.objects.select_related('store')
    if lock_for_update:
        queryset = queryset.select_for_update()
    products_by_id = queryset.filter(id__in=product_ids).in_bulk()

    normalized_items = []
    errors = []
    for item in cart_items:
        try:
            product_id = int(item.get('id'))
        except (TypeError, ValueError):
            errors.append('San pham khong hop le.')
            continue

        product = products_by_id.get(product_id)
        if not product:
            errors.append(f'San pham ID {product_id} khong ton tai.')
            continue

        qty = max(int(item.get('qty', item.get('quantity', 1)) or 1), 1)
        in_stock = (
            not product.is_deleted
            and product.moderation_status == Product.MOD_ACTIVE
            and product.status != Product.STATUS_HIDDEN
            and product.stock > 0
        )
        if not in_stock:
            errors.append(f'{product.name} hien da het hang hoac tam an.')
            continue
        if qty > product.stock:
            errors.append(f'{product.name} chi con {product.stock} san pham trong kho.')
            continue

        normalized_items.append({
            'product': product,
            'qty': qty,
            'variant': _as_text(item.get('variant')),
            'unit_price': _parse_decimal(product.price),
            'name': product.name,
        })

    return normalized_items, errors


def _otp_expires_at():
    ttl_minutes = int(getattr(settings, 'OTP_EXPIRE_MINUTES', 10) or 10)
    return timezone.now() + timezone.timedelta(minutes=ttl_minutes)


def _generate_otp_code():
    return f"{random.randint(0, 999999):06d}"


def _issue_email_otp(user, email, purpose):
    EmailOTPChallenge.objects.filter(email=email, purpose=purpose, is_used=False).update(is_used=True)
    otp_code = _generate_otp_code()
    challenge = EmailOTPChallenge.objects.create(
        user=user,
        email=email,
        purpose=purpose,
        otp_code=otp_code,
        expires_at=_otp_expires_at(),
    )
    return challenge, otp_code


def _build_otp_debug_payload(otp_code):
    if not getattr(settings, 'OTP_DEBUG_RETURN_CODE', False):
        return {}

    backend = getattr(settings, 'EMAIL_BACKEND', '')
    non_inbox_backends = {
        'django.core.mail.backends.console.EmailBackend',
        'django.core.mail.backends.filebased.EmailBackend',
        'django.core.mail.backends.locmem.EmailBackend',
        'django.core.mail.backends.dummy.EmailBackend',
    }

    if backend in non_inbox_backends:
        debug_message = 'OTP không được gửi tới inbox thật trong môi trường hiện tại.'
        if backend == 'django.core.mail.backends.console.EmailBackend':
            debug_message = 'OTP đang được in trong terminal backend vì EMAIL_BACKEND đang là console.'
        elif backend == 'django.core.mail.backends.filebased.EmailBackend':
            debug_message = f"OTP đang được lưu vào thư mục email local: {getattr(settings, 'EMAIL_FILE_PATH', '')}"
    else:
        debug_message = 'OTP debug đang bật (OTP_DEBUG_RETURN_CODE=True). Email thật cũng đã được gửi.'

    logger.warning(f"OTP debug fallback enabled for backend={backend}: {otp_code}")
    return {
        'dev_otp': otp_code,
        'otp_debug_message': debug_message,
        'otp_delivery_backend': backend,
    }


def _send_otp_email(email, otp_code, purpose):
    app_name = 'Intellishop'
    if purpose == EmailOTPChallenge.PURPOSE_REGISTER:
        subject = f'[{app_name}] Ma OTP kich hoat tai khoan'
        body = f'Ma OTP kich hoat tai khoan cua ban la: {otp_code}. Ma co hieu luc trong 10 phut.'
    else:
        subject = f'[{app_name}] Ma OTP dat lai mat khau'
        body = f'Ma OTP dat lai mat khau cua ban la: {otp_code}. Ma co hieu luc trong 10 phut.'

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@intellishop.local')
    logger.info(f"Sending OTP email via backend={getattr(settings, 'EMAIL_BACKEND', '')} to {email}")
    send_mail(subject, body, from_email, [email], fail_silently=False)


@csrf_exempt
def get_store_data(request):
    if request.method != 'GET':
        return JsonResponse({'success': False, 'message': 'Method not allowed'}, status=405)

    try:
        categories = Category.objects.all()
        categories_data = [{'id': c.id, 'name': c.name, 'icon': c.icon} for c in categories]

        # Tối ưu N+1 Query vẫn được giữ nguyên
        stores = Store.objects.prefetch_related('products__category').filter(is_active=True)
        store_ids = list(stores.values_list('id', flat=True))

        rating_map = {
            row['store_id']: {
                'avg_rating': float(row['avg_rating'] or 0),
                'total_reviews': int(row['total_reviews'] or 0)
            }
            for row in StoreReview.objects.filter(store_id__in=store_ids)
            .values('store_id')
            .annotate(avg_rating=Avg('rating'), total_reviews=Count('id'))
        }

        delivered_statuses = [Order.STATUS_DELIVERED, 'Hoàn thành']
        sold_map = {
            row['product__store']: int(row['sold_qty'] or 0)
            for row in OrderItem.objects.filter(order__status__in=delivered_statuses, product__store_id__in=store_ids)
            .values('product__store')
            .annotate(sold_qty=Sum('quantity'))
        }
        store_info, store_products = {}, {}
        hot_deals = []
        shipping_providers = _get_shipping_provider_payload()

        colors = [
            'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
            'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
            'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
            'linear-gradient(135deg, #000000 0%, #434343 100%)',
            'linear-gradient(135deg, #1428a0 0%, #1e3c72 100%)'
        ]

        for index, store in enumerate(stores):
            bg_color = colors[index % len(colors)]
            store_icon_url = store.icon.url if store.icon and hasattr(store.icon, 'url') else ''

            store_info[store.id] = {
                'name': store.name,
                'icon': store_icon_url,
                'desc': store.description,
                'rating': round(rating_map.get(store.id, {}).get('avg_rating', 0), 1),
                'sold': str(sold_map.get(store.id, 0)),
                'reviews': rating_map.get(store.id, {}).get('total_reviews', 0),
                'bg_color': bg_color
            }

            store_products[store.id] = []

            for p in store.products.filter(
                is_deleted=False,
                moderation_status=Product.MOD_ACTIVE,
            ).exclude(status=Product.STATUS_HIDDEN):
                # Giữ nguyên bản vá lỗi đường dẫn ảnh của bạn
                prod_image_url = ''
                if p.image and hasattr(p.image, 'url'):
                    try:
                        url = p.image.url
                        if '/media/media/' in url:
                            url = url.replace('/media/media/', '/media/')
                        prod_image_url = url
                    except Exception as e:
                        logger.error(f"Lỗi parse URL ảnh sản phẩm {p.id}: {e}")

                prod_data = {
                    'id': p.id,
                    'name': p.name,
                    'price': float(p.price),
                    'old_price': float(p.old_price) if p.old_price else None,
                    'image': prod_image_url,
                    'category': p.category.name if p.category else 'Khác',
                    'category_id': p.category.id if p.category else 'all',
                    'store': store.id,
                    'store_name': store.name,
                    'description': p.description or '',
                    'stock': int(p.stock or 0),
                    'status': p.status,
                    'in_stock': bool(p.stock > 0 and p.status == Product.STATUS_AVAILABLE),
                }
                store_products[store.id].append(prod_data)

                if p.is_hot:
                    hot_deals.append(prod_data)

        return JsonResponse({
            'success': True,
            'storeInfo': store_info,
            'storeProducts': store_products,
            'hotDeals': hot_deals,
            'categories': categories_data,
            'shippingProviders': shipping_providers,
        })
    except Exception as e:
        logger.error(f"Lỗi API get_store_data: {str(e)}")
        return JsonResponse({'success': False, 'message': "Lỗi máy chủ nội bộ."}, status=500)


# ==========================================
# RAG VÀ AI AGENT
# ==========================================
def _build_product_image_url(product):
    """Xây dựng URL ảnh sản phẩm, sửa lỗi đường dẫn /media/media/."""
    if not product.image or not hasattr(product.image, 'url'):
        return ''
    try:
        url = product.image.url
        if '/media/media/' in url:
            url = url.replace('/media/media/', '/media/')
        return url
    except Exception:
        return ''


def _serialize_product(product):
    """Chuyển Product model thành dict chuẩn (giống get_store_data)."""
    store = product.store if hasattr(product, 'store') else None
    return {
        'id': product.id,
        'name': product.name,
        'price': float(product.price),
        'old_price': float(product.old_price) if product.old_price else None,
        'image': _build_product_image_url(product),
        'category': product.category.name if product.category else 'Khác',
        'category_id': product.category.id if product.category else 'all',
        'store': store.id if store else 0,
        'store_name': store.name if store else 'Intellishop',
        'description': (product.description or '')[:300],
        'stock': int(product.stock or 0),
        'status': product.status,
        'in_stock': bool(product.stock > 0 and product.status == Product.STATUS_AVAILABLE),
    }


def retrieve_relevant_products(user_query, top_k=5):
    """
    RAG retrieval: tìm sản phẩm phù hợp qua FAISS vector search.
    Returns:
        tuple(context_text: str, product_dicts: list[dict])
        - context_text: chuỗi mô tả sản phẩm cho Gemini prompt
        - product_dicts: danh sách dict sản phẩm chuẩn cho frontend
    """
    current_index = rag_manager.get_faiss_index()
    if current_index is None:
        return "Hiện chưa có sản phẩm nào trong kho.", []

    try:
        query_result = genai.embed_content(
            model="models/gemini-embedding-2-preview",
            content=user_query,
            task_type="retrieval_query",
        )
        query_vector = np.array([query_result['embedding']]).astype('float32')
        distances, indices = current_index.search(query_vector, top_k)
        matched_ids = [int(i) for i in indices[0] if i != -1]

        if not matched_ids:
            return "Không tìm thấy sản phẩm phù hợp trong kho.", []

        matched_products = (
            Product.objects
            .select_related('category', 'store')
            .filter(id__in=matched_ids, is_deleted=False)
            .exclude(status=Product.STATUS_HIDDEN)
        )
        # Giữ thứ tự FAISS ranking
        id_order = {pid: idx for idx, pid in enumerate(matched_ids)}
        sorted_products = sorted(matched_products, key=lambda p: id_order.get(p.id, 999))

        product_dicts = [_serialize_product(p) for p in sorted_products]

        context_lines = []
        for idx, p in enumerate(sorted_products, 1):
            desc_snippet = (p.description or '')[:150].strip()
            old_price_text = f" (giá cũ: {p.old_price:,.0f}₫)" if p.old_price else ""
            stock_text = f"Còn {p.stock} sản phẩm" if p.stock > 0 else "Hết hàng"
            context_lines.append(
                f"{idx}. [ID:{p.id}] {p.name}\n"
                f"   Giá: {p.price:,.0f}₫{old_price_text} | Danh mục: {p.category.name if p.category else 'Khác'} | {stock_text}\n"
                f"   Cửa hàng: {p.store.name if p.store else 'N/A'}"
                + (f"\n   Mô tả: {desc_snippet}" if desc_snippet else "")
            )
        context_text = "\n".join(context_lines)

        return context_text, product_dicts

    except Exception as e:
        logger.error(f"Lỗi RAG retrieval: {e}")
        return "Lỗi truy xuất hệ thống kho hàng.", []


def clean_text_for_speech(text):
    return re.sub(r'[*#_]', '', text).strip()


async def get_audio_bytes(text, voice='vi-VN-HoaiMyNeural', rate='+20%'):
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    audio_data = b""
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_data += chunk["data"]
    return audio_data


def generate_audio_safe(text):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(get_audio_bytes(text))
    finally:
        loop.close()


@csrf_exempt
def chat_with_ai(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'reply': 'Sai phương thức'}, status=405)

    try:
        user_text = request.POST.get('message', '').strip()
        user_name = request.POST.get('user_name', 'Khách hàng')
        cart_items = request.POST.get('cart_items', '[]')

        if not user_text:
            return JsonResponse({'success': False, 'reply': 'Không nhận được tin nhắn.'})

        # ── RAG: tìm sản phẩm liên quan ──
        product_context, product_dicts = retrieve_relevant_products(user_text, top_k=5)

        # ── Xây dựng prompt chuyên nghiệp ──
        prompt = f"""You are "Intellishop AI" — the senior shopping consultant for the Intellishop e-commerce platform.
Your personality: friendly, knowledgeable, concise. You speak Vietnamese naturally, address the customer by name, and use a warm yet professional tone.

═══ CUSTOMER CONTEXT ═══
• Name: {user_name}
• Current cart: {cart_items}
• Customer message: "{user_text}"

═══ PRODUCT INVENTORY (from semantic search — these are the most relevant products) ═══
{product_context}

═══ RESPONSE RULES ═══
1. ALWAYS reply in Vietnamese, address customer by name (e.g., "Chào {user_name}!", "Dạ {user_name} ơi,")
2. ONLY recommend products that exist in the PRODUCT INVENTORY above. NEVER fabricate products.
3. When recommending products, explain WHY each product fits the customer's needs (price range, category, features from description).
4. If the customer asks about products NOT in the inventory, politely say you don't have that exact item and suggest the closest alternatives from inventory.
5. If the customer wants to ADD a product to cart, set action type to "add_to_cart" with the exact product ID from inventory.
6. If the customer wants to CHECKOUT/pay, set action type to "checkout".
7. If the customer's message is a greeting, general question, or not product-related, reply helpfully without forcing product recommendations — set recommended_product_ids to empty array.
8. Keep reply under 80 words. Be helpful, not pushy.
9. Use the field "recommended_product_ids" to list the IDs of products you mention or recommend (in order of relevance). Only include IDs from the inventory above.

═══ STRICT JSON OUTPUT FORMAT ═══
Return ONLY valid JSON (no markdown, no extra text):
{{
    "bot_reply": "Your Vietnamese reply here",
    "action": {{"type": "none|add_to_cart|checkout", "product_id": null_or_integer}},
    "recommended_product_ids": [list of integer product IDs you recommend, max 5]
}}
"""

        response = model.generate_content(prompt)
        clean_json = re.sub(r'```json\s*|\s*```', '', response.text).strip()
        ai_data = json.loads(clean_json)

        bot_reply = ai_data.get('bot_reply', 'Xin lỗi, tôi đang gặp sự cố.')
        action = ai_data.get('action', {'type': 'none'})
        recommended_ids = ai_data.get('recommended_product_ids', [])

        # ── Lọc sản phẩm gợi ý theo thứ tự Gemini khuyến nghị ──
        if recommended_ids and product_dicts:
            id_to_product = {p['id']: p for p in product_dicts}
            suggested_products = [id_to_product[pid] for pid in recommended_ids if pid in id_to_product]
            # Nếu Gemini trả ID không hợp lệ, fallback về toàn bộ RAG results
            if not suggested_products:
                suggested_products = product_dicts
        else:
            # Nếu Gemini không trả recommended_ids hoặc không có sản phẩm → dùng RAG results
            suggested_products = product_dicts

        # ── Tạo audio phản hồi ──
        audio_bytes = generate_audio_safe(clean_text_for_speech(bot_reply))
        audio_data_uri = f"data:audio/mp3;base64,{base64.b64encode(audio_bytes).decode('utf-8')}"

        return JsonResponse({
            'success': True,
            'reply': bot_reply,
            'action': action,
            'audio_url': audio_data_uri,
            'suggested_products': suggested_products,
        })

    except json.JSONDecodeError as jde:
        logger.error(f"AI trả về sai định dạng JSON: {jde}")
        return JsonResponse({
            'success': False,
            'reply': "Hệ thống AI trả về dữ liệu không hợp lệ. Vui lòng thử lại.",
        })
    except Exception as e:
        logger.error(f"Lỗi Backend AI: {str(e)}")
        return JsonResponse({
            'success': False,
            'reply': "Máy chủ AI đang bận, vui lòng thử lại sau.",
        })


# ==========================================
# CÁC API CƠ BẢN
# ==========================================
@api_view(['POST'])
@permission_classes([AllowAny])
def register_user(request):
    """
    LUỒNG 1A: Đăng ký tài khoản Khách hàng (CUSTOMER)
    Chỉ cần: Tên, Email, Mật khẩu, Số điện thoại. Role mặc định = CUSTOMER.
    """
    try:
        data = request.data
        email    = _as_text(data.get('email', '')).lower()
        password = _as_text(data.get('password', ''))
        name     = _as_text(data.get('name', ''))
        phone    = _as_text(data.get('phone', ''))

        if not email or not password or not name or not phone:
            return Response({'success': False, 'message': 'Tên, Email, Mật khẩu và Số điện thoại không được để trống!'}, status=400)

        existing_user = User.objects.filter(email__iexact=email).first()
        if existing_user:
            if existing_user.is_active:
                return Response({'success': False, 'message': 'Email đã được sử dụng.'}, status=400)
            # Inactive unverified account — purge stale data so user can re-register.
            EmailOTPChallenge.objects.filter(email=email).delete()
            existing_user.delete()
            logger.info(f"♻️ Đã xoá tài khoản chưa kích hoạt để cho phép đăng ký lại: {email}")

        with transaction.atomic():
            user = User.objects.create_user(
                email=email,
                password=password,
                username=email,
                full_name=name,
                phone_number=phone,
                role='CUSTOMER',
                is_active=False,
            )
            _challenge, otp_code = _issue_email_otp(user, email, EmailOTPChallenge.PURPOSE_REGISTER)

        # Send OTP email in background thread to avoid blocking the HTTP response
        # (SMTP can take 5-30s, causing frontend timeout / "Broken pipe").
        def _bg_send():
            try:
                _send_otp_email(email, otp_code, EmailOTPChallenge.PURPOSE_REGISTER)
                logger.info(f"✅ OTP email sent to {email}")
            except Exception as mail_err:
                logger.error(f"❌ Lỗi gửi OTP đăng ký (background): {mail_err}")
        threading.Thread(target=_bg_send, daemon=True).start()

        logger.info(f"✅ Đăng ký mới chờ xác thực OTP: {email}")
        response_data = {
            'success': True,
            'requires_verification': True,
            'message': 'Vui lòng nhập OTP đã gửi về email để kích hoạt tài khoản.',
            'email': email,
        }
        response_data.update(_build_otp_debug_payload(otp_code))
        return Response(response_data, status=201)

    except Exception as e:
        logger.error(f"Lỗi đăng ký: {e}")
        return Response({'success': False, 'message': str(e)}, status=400)

@csrf_exempt
def login_user(request):
    """
    LUỒNG 2A: Đăng nhập bằng tài khoản Local (Email + Mật khẩu)
    
    Thao tác: User nhập Email, Mật khẩu và nhấn Đăng nhập
    
    Logic Backend:
    1. Tìm bản ghi Email trong User? Nếu không → Báo lỗi "Tài khoản không tồn tại"
    2. Nếu có, kiểm tra trường Mật khẩu rỗng không?
       - Rỗng (đăng ký bằng Google) → Báo lỗi "Sử dụng Google hoặc Quên mật khẩu"
       - Có mật khẩu → So khớp (verify hash): Đúng → Cấp JWT, Sai → Báo lỗi
    """
    if request.method != 'POST':
        return JsonResponse({
            'success': False,
            'message': 'Phương thức không được hỗ trợ'
        }, status=405)
    
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        if not email or not password:
            return JsonResponse({
                'success': False,
                'message': 'Email và Mật khẩu không được để trống!'
            }, status=400)
        
        # 1. TÌM NGƯỜI DÙNG THEO EMAIL
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            logger.warning(f"❌ Đăng nhập thất bại: Email '{email}' không tồn tại")
            return JsonResponse({
                'success': False,
                'message': 'Tài khoản không tồn tại! Vui lòng Đăng ký trước.'
            }, status=404)
        
        # 2. KIỂM TRA CÓ MẬT KHẨU KHÔNG (hay chỉ dùng Google)
        if not user.has_usable_password():
            logger.warning(f"❌ Đăng nhập thất bại: User '{email}' chỉ dùng Google")
            return JsonResponse({
                'success': False,
                'message': 'Tài khoản này được đăng ký qua Google. Vui lòng sử dụng nút "Đăng nhập với Google" hoặc sử dụng tính năng "Quên mật khẩu" để thiết lập lại.'
            }, status=400)

        if not user.is_active:
            return JsonResponse({
                'success': False,
                'message': 'Tài khoản chưa được kích hoạt. Vui lòng xác thực OTP trong email đăng ký.'
            }, status=403)
        
        # 3. XÁC THỰC NGƯỜI DÙNG (Django authenticate)
        authenticated_user = authenticate(request, username=email, password=password)
        
        if not authenticated_user:
            logger.warning(f"❌ Đăng nhập thất bại: Mật khẩu sai cho '{email}'")
            return JsonResponse({
                'success': False,
                'message': 'Sai mật khẩu.'
            }, status=401)
        
        # 4. CẤP JWT TOKENS
        refresh = RefreshToken.for_user(authenticated_user)
        
        logger.info(f"✅ Đăng nhập thành công: {email}")
        
        return JsonResponse({
            'success': True,
            'message': 'Đăng nhập thành công!',
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'user': {
                'email': authenticated_user.email,
                'name': authenticated_user.full_name or authenticated_user.username or authenticated_user.email,
                'phone': authenticated_user.phone_number,
                'role': authenticated_user.role,
            }
        })
        
    except json.JSONDecodeError:
        return JsonResponse({
            'success': False,
            'message': 'Dữ liệu gửi lên không hợp lệ'
        }, status=400)
    except Exception as e:
        logger.error(f"Lỗi đăng nhập: {str(e)}")
        return JsonResponse({
            'success': False,
            'message': f'Lỗi đăng nhập: {str(e)}'
        }, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_register_otp(request):
    email = _as_text(request.data.get('email', '')).lower()
    otp = _as_text(request.data.get('otp', ''))

    if not email or not otp:
        return Response({'success': False, 'message': 'Email và OTP là bắt buộc.'}, status=400)

    challenge = EmailOTPChallenge.objects.filter(
        email=email,
        purpose=EmailOTPChallenge.PURPOSE_REGISTER,
        is_used=False,
    ).order_by('-created_at').first()

    if not challenge or challenge.is_expired:
        return Response({'success': False, 'message': 'OTP đã hết hạn. Vui lòng yêu cầu gửi lại OTP.'}, status=400)

    max_attempts = int(getattr(settings, 'OTP_MAX_ATTEMPTS', 5) or 5)
    if challenge.otp_code != otp:
        challenge.attempts += 1
        if challenge.attempts >= max_attempts:
            challenge.is_used = True
        challenge.save(update_fields=['attempts', 'is_used'])
        return Response({'success': False, 'message': 'OTP không đúng.'}, status=400)

    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    user.is_active = True
    user.save(update_fields=['is_active'])
    challenge.is_used = True
    challenge.save(update_fields=['is_used'])

    refresh = RefreshToken.for_user(user)
    return Response({
        'success': True,
        'message': 'Xác thực OTP thành công. Tài khoản đã được kích hoạt.',
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
        'user': {
            'email': user.email,
            'name': user.full_name or user.username or user.email,
            'phone': user.phone_number,
            'role': user.role,
        }
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_register_otp(request):
    email = _as_text(request.data.get('email', '')).lower()
    if not email:
        return Response({'success': False, 'message': 'Email là bắt buộc.'}, status=400)

    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)
    if user.is_active:
        return Response({'success': False, 'message': 'Tài khoản đã được kích hoạt.'}, status=400)

    _challenge, otp_code = _issue_email_otp(user, email, EmailOTPChallenge.PURPOSE_REGISTER)
    def _bg_send():
        try:
            _send_otp_email(email, otp_code, EmailOTPChallenge.PURPOSE_REGISTER)
        except Exception as mail_err:
            logger.error(f"Lỗi gửi lại OTP đăng ký (background): {mail_err}")
    threading.Thread(target=_bg_send, daemon=True).start()

    response_data = {'success': True, 'message': 'Đã gửi lại OTP kích hoạt tài khoản.'}
    response_data.update(_build_otp_debug_payload(otp_code))
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_send_otp(request):
    email = _as_text(request.data.get('email', '')).lower()
    if not email:
        return Response({'success': False, 'message': 'Email là bắt buộc.'}, status=400)

    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Tài khoản không tồn tại.'}, status=404)

    if not user.has_usable_password():
        return Response({
            'success': False,
            'message': 'Tài khoản này đăng nhập bằng Google, vui lòng dùng nút Google.'
        }, status=400)

    _challenge, otp_code = _issue_email_otp(user, email, EmailOTPChallenge.PURPOSE_RESET_PASSWORD)
    def _bg_send():
        try:
            _send_otp_email(email, otp_code, EmailOTPChallenge.PURPOSE_RESET_PASSWORD)
        except Exception as mail_err:
            logger.error(f"Lỗi gửi OTP quên mật khẩu (background): {mail_err}")
    threading.Thread(target=_bg_send, daemon=True).start()

    response_data = {'success': True, 'message': 'Đã gửi OTP đặt lại mật khẩu qua email.'}
    response_data.update(_build_otp_debug_payload(otp_code))
    return Response(response_data)


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password_reset(request):
    email = _as_text(request.data.get('email', '')).lower()
    otp = _as_text(request.data.get('otp', ''))
    new_password = _as_text(request.data.get('new_password', ''))

    if not email or not otp or not new_password:
        return Response({'success': False, 'message': 'Email, OTP và mật khẩu mới là bắt buộc.'}, status=400)

    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Tài khoản không tồn tại.'}, status=404)

    if not user.has_usable_password():
        return Response({
            'success': False,
            'message': 'Tài khoản này đăng nhập bằng Google, vui lòng dùng nút Google.'
        }, status=400)

    challenge = EmailOTPChallenge.objects.filter(
        email=email,
        purpose=EmailOTPChallenge.PURPOSE_RESET_PASSWORD,
        is_used=False,
    ).order_by('-created_at').first()

    if not challenge or challenge.is_expired:
        return Response({'success': False, 'message': 'OTP đã hết hạn. Vui lòng yêu cầu OTP mới.'}, status=400)

    max_attempts = int(getattr(settings, 'OTP_MAX_ATTEMPTS', 5) or 5)
    if challenge.otp_code != otp:
        challenge.attempts += 1
        if challenge.attempts >= max_attempts:
            challenge.is_used = True
        challenge.save(update_fields=['attempts', 'is_used'])
        return Response({'success': False, 'message': 'OTP không đúng.'}, status=400)

    user.set_password(new_password)
    user.save(update_fields=['password'])
    challenge.is_used = True
    challenge.save(update_fields=['is_used'])

    return Response({'success': True, 'message': 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.'})


@csrf_exempt
def create_order(request):
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=405)
    try:
        data = json.loads(request.body)
        cart_items = data.get('cart', data.get('items', []))
        customer = data.get('customer', {})
        user = _get_user_by_email(data.get('user_email') or customer.get('email'))
        address = None

        address_id = data.get('address_id')
        if user and address_id:
            address = Address.objects.filter(id=address_id, user=user).first()

        if address:
            shipping_address = address.full_address
            customer_name = address.receiver_name
            customer_phone = address.receiver_phone
            customer_email = user.email
        else:
            customer_name = (customer.get('full_name') or f"{customer.get('firstName', '')} {customer.get('lastName', '')}").strip()
            customer_phone = customer.get('phone', '')
            customer_email = customer.get('email', '')
            shipping_address = customer.get('full_address') or ", ".join(
                [p for p in [customer.get('address'), customer.get('district'), customer.get('city')] if p]
            )

        if not cart_items or not customer_email:
            return JsonResponse({'success': False, 'message': 'Thiếu thông tin đơn hàng hoặc email khách hàng.'}, status=400)

        order_code = f"#IS{random.randint(1000, 9999)}"

        with transaction.atomic():
            normalized_items, item_errors = _normalize_cart_items(cart_items, lock_for_update=True)
            if item_errors:
                return JsonResponse({'success': False, 'message': ' | '.join(item_errors)}, status=400)

            subtotal = sum(item['unit_price'] * item['qty'] for item in normalized_items)
            shop_discount = _parse_decimal(data.get('shop_voucher_discount', 0))
            intelishop_discount = _parse_decimal(data.get('intellishop_voucher_discount', 0))
            shipping_fee = _parse_decimal(data.get('shipping_fee', 0))
            insurance_fee = _parse_decimal(data.get('insurance_fee', 0))
            coin_used = int(data.get('coin_used', 0) or 0)
            final_total = subtotal - shop_discount - intelishop_discount - Decimal(coin_used) + shipping_fee + insurance_fee
            if final_total < 0:
                final_total = Decimal('0')

            order = Order.objects.create(
                order_code=order_code,
                user=user,
                customer_name=customer_name or (user.full_name if user else ''),
                customer_email=customer_email,
                customer_phone=customer_phone or (user.phone_number if user else ''),
                shipping_address=shipping_address,
                total_amount=final_total,
                payment_method=data.get('payment_method', 'COD'),
                note=data.get('note', ''),
                shipping_fee=shipping_fee,
                shop_voucher_discount=shop_discount,
                intellishop_voucher_discount=intelishop_discount,
                coin_used=max(coin_used, 0),
                insurance_fee=insurance_fee,
                status=data.get('status', Order.STATUS_PENDING)
            )

            order_items = []
            for item in normalized_items:
                product = item['product']
                qty = item['qty']
                order_items.append(OrderItem(
                    order=order,
                    product=product,
                    product_name=item['name'],
                    variant=item['variant'],
                    price=item['unit_price'],
                    quantity=max(qty, 1)
                ))
                product.stock = max(product.stock - qty, 0)
                if product.stock == 0:
                    product.status = Product.STATUS_OUT_OF_STOCK
                product.save(update_fields=['stock', 'status'])
            OrderItem.objects.bulk_create(order_items)

            if user and coin_used > 0:
                user.intellishop_coin = max(user.intellishop_coin - coin_used, 0)
                user.save(update_fields=['intellishop_coin'])

        return JsonResponse({
            'success': True,
            'order_code': order_code,
            'total_amount': str(final_total),
            'breakdown': {
                'subtotal': str(subtotal),
                'shop_voucher_discount': str(shop_discount),
                'intellishop_voucher_discount': str(intelishop_discount),
                'coin_used': coin_used,
                'shipping_fee': str(shipping_fee),
                'insurance_fee': str(insurance_fee),
            }
        })
    except Exception as e:
        logger.error(f"Lỗi tạo đơn hàng: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@api_view(['POST'])
@permission_classes([AllowAny])
def calculate_checkout(request):
    data = request.data
    items = data.get('items', [])
    user = _get_user_by_email(data.get('user_email'))

    normalized_items, item_errors = _normalize_cart_items(items)
    if item_errors:
        return Response({'success': False, 'message': ' | '.join(item_errors)}, status=400)

    subtotal = sum(item['unit_price'] * item['qty'] for item in normalized_items)

    shop_discount = _parse_decimal(data.get('shop_voucher_discount', 0))
    intelishop_discount = _parse_decimal(data.get('intellishop_voucher_discount', 0))
    requested_coin = int(data.get('coin_used', 0) or 0)
    available_coin = user.intellishop_coin if user else 0
    coin_used = min(max(requested_coin, 0), available_coin)
    shipping_fee = _parse_decimal(data.get('shipping_fee', 0))
    insurance_fee = _parse_decimal(data.get('insurance_fee', 0))
    if data.get('add_fashion_insurance') and insurance_fee == 0:
        insurance_fee = Decimal('15000')

    total = subtotal - shop_discount - intelishop_discount - Decimal(coin_used) + shipping_fee + insurance_fee
    total = max(total, Decimal('0'))

    return Response({
        'success': True,
        'checkout': {
            'subtotal': str(subtotal),
            'shop_voucher_discount': str(shop_discount),
            'intellishop_voucher_discount': str(intelishop_discount),
            'coin_used': coin_used,
            'shipping_fee': str(shipping_fee),
            'insurance_fee': str(insurance_fee),
            'total_amount': str(total),
            'available_coin': available_coin,
        }
    })


@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def user_profile(request):
    email = request.query_params.get('email') if request.method == 'GET' else request.data.get('email')
    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy người dùng.'}, status=404)

    if request.method == 'PUT':
        user.full_name = request.data.get('full_name', user.full_name)
        user.phone_number = request.data.get('phone_number', user.phone_number)
        user.gender = request.data.get('gender', user.gender)
        user.intellishop_coin = int(request.data.get('intellishop_coin', user.intellishop_coin) or user.intellishop_coin)
        birth_date = request.data.get('birth_date')
        if birth_date:
            user.birth_date = birth_date
        if request.data.get('avatar'):
            user.avatar = request.data.get('avatar')
        user.save()

    return Response({
        'success': True,
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'gender': user.gender,
            'birth_date': user.birth_date,
            'avatar': user.avatar.url if user.avatar and hasattr(user.avatar, 'url') else None,
            'intellishop_coin': user.intellishop_coin,
        }
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def addresses_api(request):
    email = request.query_params.get('email') if request.method == 'GET' else request.data.get('email')
    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy người dùng.'}, status=404)

    if request.method == 'GET':
        addresses = Address.objects.filter(user=user)
        return Response({'success': True, 'addresses': [_serialize_address(addr) for addr in addresses]})

    addr = Address.objects.create(
        user=user,
        receiver_name=request.data.get('receiver_name', user.full_name or user.email),
        receiver_phone=request.data.get('receiver_phone', user.phone_number or ''),
        full_address=request.data.get('full_address', '').strip(),
        is_default=bool(request.data.get('is_default', False))
    )
    return Response({'success': True, 'address': _serialize_address(addr)}, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
def address_detail_api(request, address_id):
    address = Address.objects.filter(id=address_id).first()
    if not address:
        return Response({'success': False, 'message': 'Không tìm thấy địa chỉ.'}, status=404)

    if request.method == 'DELETE':
        address.delete()
        return Response({'success': True, 'message': 'Đã xóa địa chỉ.'})

    address.receiver_name = request.data.get('receiver_name', address.receiver_name)
    address.receiver_phone = request.data.get('receiver_phone', address.receiver_phone)
    address.full_address = request.data.get('full_address', address.full_address)
    address.is_default = bool(request.data.get('is_default', address.is_default))
    address.save()
    return Response({'success': True, 'address': _serialize_address(address)})


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def wishlist_api(request):
    email = request.query_params.get('email') if request.method == 'GET' else request.data.get('email')
    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy người dùng.'}, status=404)

    if request.method == 'GET':
        wishlist = Wishlist.objects.select_related('product').filter(user=user)
        data = [
            {
                'id': item.id,
                'product_id': item.product_id,
                'product_name': item.product.name,
                'price': str(item.product.price),
                'image': item.product.image.url if item.product.image and hasattr(item.product.image, 'url') else None,
            }
            for item in wishlist
        ]
        return Response({'success': True, 'wishlist': data})

    product = Product.objects.filter(id=request.data.get('product_id')).first()
    if not product:
        return Response({'success': False, 'message': 'Không tìm thấy sản phẩm.'}, status=404)
    item, _ = Wishlist.objects.get_or_create(user=user, product=product)
    return Response({'success': True, 'wishlist_item_id': item.id}, status=201)


@api_view(['DELETE'])
@permission_classes([AllowAny])
def wishlist_detail_api(request, item_id):
    item = Wishlist.objects.filter(id=item_id).first()
    if not item:
        return Response({'success': False, 'message': 'Không tìm thấy mục yêu thích.'}, status=404)
    item.delete()
    return Response({'success': True, 'message': 'Đã xóa khỏi yêu thích.'})




# ============================================================
# API: ĐĂNG KÝ TRỞ THÀNH NGƯỜI BÁN (VENDOR APPLICATION)
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def apply_vendor(request):
    """Khách hàng nộp đơn đăng ký cửa hàng. Trạng thái ban đầu = 'pending'."""
    email = _as_text(request.data.get('email', '')).lower()
    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    if Store.objects.filter(owner=user).exists():
        return Response({'success': False, 'message': 'Tài khoản này đã là Người bán.'}, status=400)

    if VendorApplication.objects.filter(user=user, status='pending').exists():
        return Response({'success': False, 'message': 'Bạn đã có đơn đang chờ duyệt.'}, status=400)

    store_name = _as_text(request.data.get('store_name', ''))
    business_category = _as_text(request.data.get('business_category', ''))
    store_address = _as_text(request.data.get('store_address', ''))
    description = _as_text(request.data.get('description', ''))
    business_phone = _as_text(request.data.get('business_phone', ''))
    city = _as_text(request.data.get('city', ''))
    business_license = request.FILES.get('business_license')

    if not store_name or not business_category or not store_address:
        return Response({'success': False, 'message': 'Tên cửa hàng, Ngành hàng và Địa chỉ là bắt buộc.'}, status=400)

    try:
        with transaction.atomic():
            app = VendorApplication.objects.create(
                user=user,
                store_name=store_name,
                business_category=business_category,
                business_phone=business_phone,
                store_address=store_address,
                city=city,
                description=description,
                business_license=business_license,
            )

            # Tránh upload cùng một file object 2 lần trong cùng request.
            store_defaults = {
                'name': store_name,
                'business_category': business_category,
                'description': description,
                'business_phone': business_phone,
                'store_address': store_address,
                'city': city,
                'is_active': False,
            }
            if app.business_license:
                store_defaults['business_license'] = app.business_license.name

            Store.objects.update_or_create(owner=user, defaults=store_defaults)
    except Exception as ex:
        logger.exception(f"Lỗi tạo đơn vendor: {ex}")
        return Response({
            'success': False,
            'message': 'Không thể tải file giấy phép. Vui lòng dùng ảnh/PDF hợp lệ và thử lại (ưu tiên file <= 10MB).'
        }, status=400)

    logger.info(f"📝 Đơn Vendor mới: {user.email} → {store_name}")
    return Response({
        'success': True,
        'message': 'Đơn đăng ký đã được gửi, vui lòng chờ Admin xét duyệt.',
        'application_id': app.id,
        'status': app.status,
    }, status=201)


# ============================================================
# API: ĐĂNG KÝ TRỞ THÀNH ĐƠN VỊ VẬN CHUYỂN (SHIPPER APPLICATION)
# ============================================================
@api_view(['POST'])
@permission_classes([AllowAny])
def apply_shipper(request):
    """Khách hàng nộp đơn đăng ký đơn vị vận chuyển. Trạng thái = 'pending'."""
    email = request.data.get('email', '').strip().lower()
    user  = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    if ShipperApplication.objects.filter(user=user, status='approved').exists() or user.role == 'SHIPPER':
        return Response({'success': False, 'message': 'Tài khoản này đã là Đơn vị vận chuyển.'}, status=400)

    if ShipperApplication.objects.filter(user=user, status='pending').exists():
        return Response({'success': False, 'message': 'Bạn đã có đơn đang chờ duyệt.'}, status=400)

    company_name = _as_text(request.data.get('company_name', ''))
    vehicle_type = _as_text(request.data.get('vehicle_type', ''))
    service_area = _as_text(request.data.get('service_area', ''))
    description = _as_text(request.data.get('description', ''))
    contact_email = _as_text(request.data.get('contact_email', '')) or user.email
    phone_number = _as_text(request.data.get('phone_number', '')) or _as_text(user.phone_number)
    representative_name = _as_text(request.data.get('representative_name', ''))
    company_address = _as_text(request.data.get('company_address', ''))
    service_type = _as_text(request.data.get('service_type', ''))
    business_license = request.FILES.get('business_license')

    if not company_name or not vehicle_type or not service_area:
        return Response({'success': False, 'message': 'Tên công ty, Phương tiện và Khu vực là bắt buộc.'}, status=400)

    app = ShipperApplication.objects.create(
        user=user,
        company_name=company_name,
        vehicle_type=vehicle_type,
        service_area=service_area,
        business_license=business_license,
        description=' | '.join([p for p in [description, representative_name, company_address, service_type] if p]),
    )

    ShipperProfile.objects.update_or_create(
        user=user,
        defaults={
            'company_name': company_name,
            'contact_email': contact_email,
            'phone_number': phone_number,
            'is_active': False,
        }
    )
    logger.info(f"📝 Đơn Shipper mới: {user.email} → {company_name}")
    return Response({
        'success': True,
        'message': 'Đơn đăng ký đã được gửi, vui lòng chờ Admin xét duyệt.',
        'application_id': app.id,
        'status': app.status,
    }, status=201)


@api_view(['GET'])
@permission_classes([AllowAny])
def my_application_status(request):
    """Trả về trạng thái đơn đăng ký Vendor / Shipper mới nhất của user."""
    email = request.query_params.get('email', '').strip().lower()
    user  = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Không tìm thấy tài khoản.'}, status=404)

    vendor_app  = VendorApplication.objects.filter(user=user).first()
    shipper_app = ShipperApplication.objects.filter(user=user).first()
    store = Store.objects.filter(owner=user).first()
    can_vendor = bool(store or user.role == 'VENDOR' or VendorApplication.objects.filter(user=user, status='approved').exists())
    shipper_profile = ShipperProfile.objects.filter(user=user).first()
    can_shipper = bool((shipper_profile and shipper_profile.is_active) or user.role == 'SHIPPER' or ShipperApplication.objects.filter(user=user, status='approved').exists())

    roles = []
    if can_vendor:
        roles.append('VENDOR')
    if can_shipper:
        roles.append('SHIPPER')
    if not roles:
        roles.append(user.role or 'CUSTOMER')

    return Response({
        'success': True,
        'role': user.role,
        'roles': roles,
        'can_vendor': can_vendor,
        'can_shipper': can_shipper,
        'vendor_application':  {
            'id': vendor_app.id, 'status': vendor_app.status,
            'store_name': vendor_app.store_name,
            'reject_reason': vendor_app.reject_reason,
            'created_at': vendor_app.created_at,
        } if vendor_app else None,
        'shipper_application': {
            'id': shipper_app.id, 'status': shipper_app.status,
            'company_name': shipper_app.company_name,
            'reject_reason': shipper_app.reject_reason,
            'created_at': shipper_app.created_at,
        } if shipper_app else None,
        'shipper_profile': {
            'id': shipper_profile.id,
            'company_name': shipper_profile.company_name,
            'contact_email': shipper_profile.contact_email,
            'phone_number': shipper_profile.phone_number,
            'is_active': shipper_profile.is_active,
        } if shipper_profile else None,
        'store': {
            'id': store.id,
            'name': store.name,
            'is_active': store.is_active,
            'city': store.city,
        } if store else None,
    })


@api_view(['GET', 'PUT'])
@permission_classes([AllowAny])
def vendor_store_profile_api(request):
    if request.method == 'GET':
        email = _as_text(request.query_params.get('email', '')).lower()
    else:
        email = _as_text(request.data.get('email', '')).lower()

    user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    if request.method == 'PUT':
        name = _as_text(request.data.get('name', store.name))
        business_category = _as_text(request.data.get('business_category', store.business_category))
        description = _as_text(request.data.get('description', store.description))
        business_phone = _as_text(request.data.get('business_phone', store.business_phone))
        store_address = _as_text(request.data.get('store_address', store.store_address))
        city = _as_text(request.data.get('city', store.city))
        icon = request.FILES.get('icon')

        if not name:
            return Response({'success': False, 'message': 'Tên cửa hàng không được để trống.'}, status=400)

        store.name = name
        store.business_category = business_category
        store.description = description
        store.business_phone = business_phone
        store.store_address = store_address
        store.city = city
        update_fields = ['name', 'business_category', 'description', 'business_phone', 'store_address', 'city']
        if icon:
            store.icon = icon
            update_fields.append('icon')
        store.save(update_fields=update_fields)

    icon_url = ''
    if store.icon and hasattr(store.icon, 'url'):
        try:
            icon_url = store.icon.url
        except Exception:
            icon_url = ''

    pending_app = VendorApplication.objects.filter(user=user, status='pending').first()
    return Response({
        'success': True,
        'message': 'Đã cập nhật thông tin cửa hàng.' if request.method == 'PUT' else None,
        'store': {
            'id': store.id,
            'name': store.name,
            'icon': icon_url,
            'business_category': store.business_category,
            'description': store.description,
            'business_phone': store.business_phone,
            'store_address': store.store_address,
            'city': store.city,
            'is_active': store.is_active,
        },
        'is_pending_approval': bool(pending_app or not store.is_active),
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def vendor_products_api(request):
    if request.method == 'GET':
        email = _as_text(request.query_params.get('email', '')).lower()
    else:
        email = _as_text(request.data.get('email', '')).lower()

    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    if request.method == 'GET':
        products = Product.objects.filter(store=store, is_deleted=False).select_related('category').order_by('-id')
        return Response({'success': True, 'products': [_serialize_vendor_product(p) for p in products]})

    name = _as_text(request.data.get('name', ''))
    description = _as_text(request.data.get('description', ''))
    price = _parse_decimal(request.data.get('price', 0))
    stock = int(request.data.get('stock', 0) or 0)
    status = _as_text(request.data.get('status', Product.STATUS_AVAILABLE)) or Product.STATUS_AVAILABLE
    category_id = request.data.get('category_id')
    image = request.FILES.get('image')

    if not name:
        return Response({'success': False, 'message': 'Tên sản phẩm là bắt buộc.'}, status=400)
    if price < 0 or stock < 0:
        return Response({'success': False, 'message': 'Giá và tồn kho phải >= 0.'}, status=400)
    if status not in dict(Product.STATUS_CHOICES):
        status = Product.STATUS_AVAILABLE

    category = Category.objects.filter(id=category_id).first() if category_id else None
    # Auto-approve products from active stores (store already admin-approved during onboarding).
    mod_status = Product.MOD_ACTIVE if store.is_active else Product.MOD_PENDING
    product = Product.objects.create(
        store=store,
        category=category,
        name=name,
        description=description,
        price=price,
        stock=stock,
        status=status,
        moderation_status=mod_status,
        image=image,
    )
    return Response({'success': True, 'product': _serialize_vendor_product(product)}, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
def vendor_product_detail_api(request, product_id):
    if request.method == 'DELETE':
        email = _as_text(request.query_params.get('email', '')).lower()
    else:
        email = _as_text(request.data.get('email', '')).lower()

    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    product = Product.objects.filter(id=product_id, store=store).select_related('category').first()
    if not product:
        return Response({'success': False, 'message': 'Không tìm thấy sản phẩm.'}, status=404)

    if request.method == 'DELETE':
        product.is_deleted = True
        product.status = Product.STATUS_HIDDEN
        product.save(update_fields=['is_deleted', 'status'])
        return Response({'success': True, 'message': 'Đã ẩn sản phẩm (soft delete).'})

    product.name = _as_text(request.data.get('name', product.name))
    product.description = _as_text(request.data.get('description', product.description))
    product.price = _parse_decimal(request.data.get('price', product.price))
    product.stock = int(request.data.get('stock', product.stock) or product.stock)
    status = _as_text(request.data.get('status', product.status))
    if status in dict(Product.STATUS_CHOICES):
        product.status = status
    category_id = request.data.get('category_id')
    if category_id:
        product.category = Category.objects.filter(id=category_id).first()
    if request.FILES.get('image'):
        product.image = request.FILES.get('image')

    product.is_deleted = False
    # Keep MOD_ACTIVE for active stores; inactive stores require admin re-approval.
    if not store.is_active:
        product.moderation_status = Product.MOD_PENDING
    product.save()
    return Response({'success': True, 'product': _serialize_vendor_product(product)})


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def vendor_vouchers_api(request):
    if request.method == 'GET':
        email = _as_text(request.query_params.get('email', '')).lower()
    else:
        email = _as_text(request.data.get('email', '')).lower()

    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    if request.method == 'GET':
        vouchers = Voucher.objects.filter(store=store, is_deleted=False).order_by('-id')
        return Response({'success': True, 'vouchers': [_serialize_voucher(v) for v in vouchers]})

    code = _as_text(request.data.get('code', '')).upper()
    name = _as_text(request.data.get('name', ''))
    discount_type = _as_text(request.data.get('discount_type', Voucher.DISCOUNT_PERCENT))
    discount_value = _parse_decimal(request.data.get('discount_value', 0))
    start_date = _as_text(request.data.get('start_date', ''))
    end_date = _as_text(request.data.get('end_date', ''))
    scope = _as_text(request.data.get('scope', Voucher.SCOPE_STORE))

    if not code or not name or not start_date or not end_date:
        return Response({'success': False, 'message': 'Thiếu thông tin bắt buộc của voucher.'}, status=400)
    if Voucher.objects.filter(store=store, code__iexact=code, is_deleted=False).exists():
        return Response({'success': False, 'message': 'Mã voucher đã tồn tại trong cửa hàng.'}, status=400)
    if discount_type not in dict(Voucher.DISCOUNT_CHOICES):
        return Response({'success': False, 'message': 'Loại giảm giá không hợp lệ.'}, status=400)
    if scope not in dict(Voucher.SCOPE_CHOICES):
        return Response({'success': False, 'message': 'Phạm vi voucher không hợp lệ.'}, status=400)

    try:
        start_date_obj = timezone.datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = timezone.datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return Response({'success': False, 'message': 'Định dạng ngày không hợp lệ (YYYY-MM-DD).'}, status=400)

    if end_date_obj < start_date_obj:
        return Response({'success': False, 'message': 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'}, status=400)

    voucher = Voucher.objects.create(
        store=store,
        code=code,
        name=name,
        discount_type=discount_type,
        discount_value=discount_value,
        start_date=start_date_obj,
        end_date=end_date_obj,
        scope=scope,
    )
    return Response({'success': True, 'voucher': _serialize_voucher(voucher)}, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([AllowAny])
def vendor_voucher_detail_api(request, voucher_id):
    if request.method == 'DELETE':
        email = _as_text(request.query_params.get('email', '')).lower()
    else:
        email = _as_text(request.data.get('email', '')).lower()

    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    voucher = Voucher.objects.filter(id=voucher_id, store=store, is_deleted=False).first()
    if not voucher:
        return Response({'success': False, 'message': 'Không tìm thấy voucher.'}, status=404)

    if request.method == 'DELETE':
        voucher.is_deleted = True
        voucher.save(update_fields=['is_deleted'])
        return Response({'success': True, 'message': 'Đã xóa voucher.'})

    code = _as_text(request.data.get('code', voucher.code)).upper()
    name = _as_text(request.data.get('name', voucher.name))
    discount_type = _as_text(request.data.get('discount_type', voucher.discount_type))
    discount_value = _parse_decimal(request.data.get('discount_value', voucher.discount_value))
    scope = _as_text(request.data.get('scope', voucher.scope))
    start_date = _as_text(request.data.get('start_date', voucher.start_date.isoformat()))
    end_date = _as_text(request.data.get('end_date', voucher.end_date.isoformat()))

    if Voucher.objects.filter(store=store, code__iexact=code, is_deleted=False).exclude(id=voucher.id).exists():
        return Response({'success': False, 'message': 'Mã voucher đã tồn tại trong cửa hàng.'}, status=400)
    if discount_type not in dict(Voucher.DISCOUNT_CHOICES):
        return Response({'success': False, 'message': 'Loại giảm giá không hợp lệ.'}, status=400)
    if scope not in dict(Voucher.SCOPE_CHOICES):
        return Response({'success': False, 'message': 'Phạm vi voucher không hợp lệ.'}, status=400)

    try:
        start_date_obj = timezone.datetime.strptime(start_date, '%Y-%m-%d').date()
        end_date_obj = timezone.datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        return Response({'success': False, 'message': 'Định dạng ngày không hợp lệ (YYYY-MM-DD).'}, status=400)

    if end_date_obj < start_date_obj:
        return Response({'success': False, 'message': 'Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.'}, status=400)

    voucher.code = code
    voucher.name = name
    voucher.discount_type = discount_type
    voucher.discount_value = discount_value
    voucher.scope = scope
    voucher.start_date = start_date_obj
    voucher.end_date = end_date_obj
    voucher.save()

    return Response({'success': True, 'voucher': _serialize_voucher(voucher)})


@api_view(['GET'])
@permission_classes([AllowAny])
def vendor_sales_dashboard_api(request):
    email = _as_text(request.query_params.get('email', '')).lower()
    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    delivered_statuses = [Order.STATUS_DELIVERED, 'Hoàn thành']
    order_items = OrderItem.objects.filter(order__status__in=delivered_statuses, product__store=store)
    summary = order_items.aggregate(
        total_revenue=Sum(F('price') * F('quantity')),
        total_items=Sum('quantity'),
        total_order_lines=Count('id')
    )

    orders = Order.objects.filter(items__product__store=store).distinct()
    status_counts = orders.values('status').annotate(count=Count('id')).order_by('status')

    top_products = (
        order_items.values('product_name')
        .annotate(total_qty=Sum('quantity'), total_revenue=Sum(F('price') * F('quantity')))
        .order_by('-total_revenue')[:5]
    )

    recent_orders = (
        orders.order_by('-created_at')[:20]
        .values('id', 'order_code', 'created_at', 'status', 'payment_method', 'total_amount')
    )

    total_orders = orders.count()
    failed_statuses = [Order.STATUS_FAILED, 'Hủy']
    canceled_orders = orders.filter(status__in=failed_statuses).count()
    cancel_rate = (canceled_orders / total_orders * 100) if total_orders else 0

    return Response({
        'success': True,
        'overview': {
            'total_revenue': float(summary.get('total_revenue') or 0),
            'total_items_sold': int(summary.get('total_items') or 0),
            'total_orders': total_orders,
            'cancel_rate': round(cancel_rate, 2),
        },
        'status_breakdown': list(status_counts),
        'top_products': [
            {
                'product_name': row['product_name'],
                'total_qty': int(row['total_qty'] or 0),
                'total_revenue': float(row['total_revenue'] or 0),
            }
            for row in top_products
        ],
        'recent_orders': [
            {
                'id': row['id'],
                'order_code': row['order_code'],
                'created_at': row['created_at'].strftime('%d/%m/%Y %H:%M'),
                'status': row['status'],
                'status_label': _status_label(row['status']),
                'payment_method': row['payment_method'],
                'amount': float(row['total_amount'] or 0),
                'can_mark_ready': row['status'] in [Order.STATUS_PENDING, 'Chờ duyệt'],
            }
            for row in recent_orders
        ]
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def vendor_mark_order_ready_api(request, order_id):
    email = _as_text(request.data.get('email', '')).lower()
    _user, store, error = _get_vendor_store_by_email(email, require_active=False)
    if error:
        return error

    order = Order.objects.filter(id=order_id, items__product__store=store).distinct().first()
    if not order:
        return Response({'success': False, 'message': 'Không tìm thấy đơn hàng thuộc cửa hàng này.'}, status=404)
    if order.status not in [Order.STATUS_PENDING, 'Chờ duyệt']:
        return Response({'success': False, 'message': 'Đơn hàng không ở trạng thái chờ xác nhận.'}, status=400)

    order.vendor = store.owner
    order.status = Order.STATUS_READY_FOR_PICKUP
    order.save(update_fields=['vendor', 'status'])
    return Response({'success': True, 'message': 'Đơn hàng đã sẵn sàng để Shipper nhận.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def shipper_dashboard_api(request):
    email = _as_text(request.query_params.get('email', '')).lower()
    user, profile, error = _get_shipper_profile_by_email(email)
    if error:
        return error

    available_orders_qs = Order.objects.filter(status=Order.STATUS_READY_FOR_PICKUP, shipper__isnull=True)
    my_orders_qs = Order.objects.filter(shipper=user)

    related_orders = (
        Order.objects.filter(
            Q(status=Order.STATUS_READY_FOR_PICKUP, shipper__isnull=True)
            | Q(shipper=user)
        )
        .select_related('vendor', 'shipper__shipper_profile')
        .prefetch_related('items__product__store')
        .distinct()
        .order_by('-created_at')
    )

    active_my_orders_qs = my_orders_qs.exclude(status__in=[Order.STATUS_DELIVERED, Order.STATUS_FAILED])
    ready_for_pickup_count = available_orders_qs.count()

    stats = {
        'ready_for_pickup': ready_for_pickup_count,
        'assigned_active': active_my_orders_qs.count(),
        'pending_delivery': ready_for_pickup_count + active_my_orders_qs.count(),
        'delivering': my_orders_qs.filter(status=Order.STATUS_DELIVERING).count(),
        'delivered': my_orders_qs.filter(status=Order.STATUS_DELIVERED).count(),
        'failed': my_orders_qs.filter(status=Order.STATUS_FAILED).count(),
    }

    return Response({
        'success': True,
        'shipper': {
            'user_email': user.email,
            'company_name': profile.company_name,
            'contact_email': profile.contact_email,
            'phone_number': profile.phone_number,
            'is_active': profile.is_active,
        },
        'stats': stats,
        'orders': [_serialize_shipper_order(order, user) for order in related_orders],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def shipper_accept_order_api(request, order_id):
    email = _as_text(request.data.get('email', '')).lower()
    user, _profile, error = _get_shipper_profile_by_email(email)
    if error:
        return error

    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id).first()
        if not order:
            return Response({'success': False, 'message': 'Không tìm thấy đơn hàng.'}, status=404)
        if order.shipper_id == user.id and order.status == Order.STATUS_DELIVERING:
            return Response({'success': True, 'message': 'Bạn đã nhận đơn này trước đó.'})
        if order.shipper_id and order.shipper_id != user.id:
            return Response({'success': False, 'message': 'Đơn hàng đã được shipper khác nhận.'}, status=400)
        if order.status != Order.STATUS_READY_FOR_PICKUP:
            return Response({'success': False, 'message': 'Đơn hàng chưa ở trạng thái chờ lấy hàng.'}, status=400)

        order.shipper = user
        order.status = Order.STATUS_DELIVERING
        order.save(update_fields=['shipper', 'status'])

    return Response({'success': True, 'message': 'Đã nhận đơn và chuyển trạng thái Đang giao.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def shipper_update_order_status_api(request, order_id):
    email = _as_text(request.data.get('email', '')).lower()
    user, _profile, error = _get_shipper_profile_by_email(email)
    if error:
        return error

    next_status = _as_text(request.data.get('status', ''))
    if next_status not in [Order.STATUS_DELIVERED, Order.STATUS_FAILED]:
        return Response({'success': False, 'message': 'Trạng thái cập nhật không hợp lệ.'}, status=400)

    with transaction.atomic():
        order = Order.objects.select_for_update().filter(id=order_id, shipper=user).first()
        if not order:
            return Response({'success': False, 'message': 'Không tìm thấy đơn hàng thuộc shipper này.'}, status=404)

        if order.status != Order.STATUS_DELIVERING:
            return Response({'success': False, 'message': 'Chỉ có thể cập nhật đơn đang giao.'}, status=400)

        order.status = next_status
        order.save(update_fields=['status'])

    return Response({'success': True, 'message': 'Đã cập nhật trạng thái đơn hàng.'})


@api_view(['GET'])
@permission_classes([AllowAny])
def shipper_order_detail_api(request, order_id):
    email = _as_text(request.query_params.get('email', '')).lower()
    user, _profile, error = _get_shipper_profile_by_email(email)
    if error:
        return error

    order = (
        Order.objects.filter(id=order_id)
        .select_related('vendor', 'shipper__shipper_profile')
        .prefetch_related('items__product__store')
        .first()
    )
    if not order:
        return Response({'success': False, 'message': 'Không tìm thấy đơn hàng.'}, status=404)
    can_view_unassigned = order.shipper_id is None and order.status == Order.STATUS_READY_FOR_PICKUP
    if not can_view_unassigned and order.shipper_id != user.id:
        return Response({'success': False, 'message': 'Bạn không có quyền xem đơn hàng này.'}, status=403)

    store_names = []
    for item in order.items.all():
        product = getattr(item, 'product', None)
        store = getattr(product, 'store', None) if product else None
        if store and store.name and store.name not in store_names:
            store_names.append(store.name)

    shipper_company_name = ''
    if order.shipper_id and hasattr(order.shipper, 'shipper_profile') and order.shipper.shipper_profile:
        shipper_company_name = order.shipper.shipper_profile.company_name

    return Response({
        'success': True,
        'order': {
            'id': order.id,
            'order_code': order.order_code,
            'customer_name': order.customer_name,
            'customer_phone': order.customer_phone,
            'customer_email': order.customer_email,
            'shipping_address': order.shipping_address,
            'status': order.status,
            'status_label': _status_label(order.status),
            'payment_method': order.payment_method,
            'total_amount': float(order.total_amount),
            'note': order.note,
            'vendor_name': order.vendor.full_name if order.vendor else '',
            'store_names': store_names,
            'shipper_company_name': shipper_company_name,
            'created_at': order.created_at.strftime('%d/%m/%Y %H:%M'),
            'items': [
                {
                    'product_name': it.product_name,
                    'variant': it.variant,
                    'price': float(it.price),
                    'quantity': it.quantity,
                }
                for it in order.items.all()
            ]
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def product_detail_api(request, product_id):
    product = Product.objects.select_related('store', 'category').filter(
        id=product_id,
        is_deleted=False,
        moderation_status=Product.MOD_ACTIVE,
    ).first()
    if not product:
        return Response({'success': False, 'message': 'Không tìm thấy sản phẩm.'}, status=404)

    image_url = ''
    if product.image and hasattr(product.image, 'url'):
        try:
            image_url = product.image.url
        except Exception:
            image_url = ''

    return Response({
        'success': True,
        'product': {
            'id': product.id,
            'name': product.name,
            'description': product.description,
            'price': float(product.price),
            'old_price': float(product.old_price) if product.old_price else None,
            'stock': product.stock,
            'status': product.status,
            'image': image_url,
            'category': product.category.name if product.category else '',
            'store_id': product.store_id,
            'store_name': product.store.name if product.store else '',
        }
    })


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def store_reviews_api(request, store_id):
    store = Store.objects.filter(id=store_id, is_active=True).first()
    if not store:
        return Response({'success': False, 'message': 'Không tìm thấy cửa hàng.'}, status=404)

    if request.method == 'GET':
        reviews = StoreReview.objects.select_related('user').filter(store=store).order_by('-created_at')
        stats = reviews.aggregate(avg_rating=Avg('rating'), total_reviews=Count('id'))
        return Response({
            'success': True,
            'store_id': store.id,
            'stats': {
                'avg_rating': round(float(stats.get('avg_rating') or 0), 1),
                'total_reviews': int(stats.get('total_reviews') or 0),
            },
            'reviews': [_serialize_store_review(r) for r in reviews]
        })

    email = _as_text(request.data.get('email', '')).lower()
    rating = int(request.data.get('rating', 0) or 0)
    comment = _as_text(request.data.get('comment', ''))
    user = _get_user_by_email(email)
    if not user:
        return Response({'success': False, 'message': 'Vui lòng đăng nhập để đánh giá.'}, status=401)
    if rating < 1 or rating > 5:
        return Response({'success': False, 'message': 'Số sao phải từ 1 đến 5.'}, status=400)

    review, created = StoreReview.objects.update_or_create(
        store=store,
        user=user,
        defaults={'rating': rating, 'comment': comment}
    )

    return Response({
        'success': True,
        'message': 'Đã gửi đánh giá.' if created else 'Đã cập nhật đánh giá.',
        'review': _serialize_store_review(review),
    }, status=201 if created else 200)


@api_view(['GET', 'PATCH'])
@permission_classes([AllowAny])
def admin_users_api(request):
    admin_email = _as_text(request.query_params.get('email') if request.method == 'GET' else request.data.get('email')).lower()
    _admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    if request.method == 'PATCH':
        target_user_id = request.data.get('user_id')
        is_active = request.data.get('is_active')
        user = User.objects.filter(id=target_user_id).first()
        if not user:
            return Response({'success': False, 'message': 'Khong tim thay tai khoan can cap nhat.'}, status=404)
        if is_active is None:
            return Response({'success': False, 'message': 'Thieu truong is_active.'}, status=400)
        user.is_active = bool(is_active)
        user.save(update_fields=['is_active'])
        return Response({'success': True, 'message': 'Da cap nhat trang thai tai khoan.'})

    role = _as_text(request.query_params.get('role', '')).upper()
    q = _as_text(request.query_params.get('q', '')).lower()
    page = int(request.query_params.get('page', 1) or 1)
    page_size = min(int(request.query_params.get('page_size', 20) or 20), 100)

    users_qs = User.objects.all().order_by('-date_joined')
    if role:
        users_qs = users_qs.filter(role=role)
    if q:
        users_qs = users_qs.filter(Q(email__icontains=q) | Q(full_name__icontains=q) | Q(phone_number__icontains=q))

    paginator = Paginator(users_qs, page_size)
    page_obj = paginator.get_page(page)

    return Response({
        'success': True,
        'users': [
            {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'phone_number': user.phone_number,
                'role': user.role,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined.strftime('%d/%m/%Y %H:%M'),
            }
            for user in page_obj.object_list
        ],
        'pagination': {
            'page': page_obj.number,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
            'total_items': paginator.count,
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_pending_approvals_api(request):
    admin_email = _as_text(request.query_params.get('email', '')).lower()
    _admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    vendor_apps = VendorApplication.objects.filter(status='pending').select_related('user').order_by('-created_at')
    shipper_apps = ShipperApplication.objects.filter(status='pending').select_related('user').order_by('-created_at')
    pending_products = Product.objects.filter(moderation_status=Product.MOD_PENDING, is_deleted=False).select_related('store', 'category').order_by('-id')

    return Response({
        'success': True,
        'vendor_applications': [
            {
                'id': app.id,
                'user_id': app.user_id,
                'user_email': app.user.email,
                'user_name': app.user.full_name,
                'store_name': app.store_name,
                'business_category': app.business_category,
                'store_address': app.store_address,
                'status': app.status,
                'created_at': app.created_at.strftime('%d/%m/%Y %H:%M'),
            }
            for app in vendor_apps
        ],
        'shipper_applications': [
            {
                'id': app.id,
                'user_id': app.user_id,
                'user_email': app.user.email,
                'user_name': app.user.full_name,
                'company_name': app.company_name,
                'vehicle_type': app.vehicle_type,
                'service_area': app.service_area,
                'status': app.status,
                'created_at': app.created_at.strftime('%d/%m/%Y %H:%M'),
            }
            for app in shipper_apps
        ],
        'pending_products': [
            {
                'id': product.id,
                'name': product.name,
                'store_name': product.store.name if product.store else '',
                'category_name': product.category.name if product.category else '',
                'price': float(product.price),
                'stock': int(product.stock),
                'moderation_status': product.moderation_status,
            }
            for product in pending_products
        ],
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_vendor_approval_action_api(request):
    admin_email = _as_text(request.data.get('email', '')).lower()
    admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    app_id = request.data.get('application_id')
    action = _as_text(request.data.get('action', '')).lower()
    reject_reason = _as_text(request.data.get('reject_reason', ''))
    app = VendorApplication.objects.select_related('user').filter(id=app_id).first()
    if not app:
        return Response({'success': False, 'message': 'Khong tim thay don vendor.'}, status=404)
    if app.status != 'pending':
        return Response({'success': False, 'message': 'Don nay da duoc xu ly truoc do.'}, status=400)

    if action not in {'approve', 'reject'}:
        return Response({'success': False, 'message': 'Action khong hop le.'}, status=400)

    with transaction.atomic():
        if action == 'approve':
            Store.objects.update_or_create(
                owner=app.user,
                defaults={
                    'name': app.store_name,
                    'business_category': app.business_category,
                    'business_phone': app.business_phone,
                    'store_address': app.store_address,
                    'city': app.city,
                    'description': app.description,
                    'business_license': app.business_license,
                    'is_active': True,
                }
            )
            if app.user.role not in ('ADMIN', 'SHIPPER'):
                app.user.role = 'VENDOR'
                app.user.save(update_fields=['role'])
            app.status = 'approved'
        else:
            app.status = 'rejected'
            app.reject_reason = reject_reason

        app.reviewed_by = admin_user
        app.reviewed_at = timezone.now()
        app.save(update_fields=['status', 'reject_reason', 'reviewed_by', 'reviewed_at'])

    return Response({'success': True, 'message': 'Da xu ly don vendor.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_shipper_approval_action_api(request):
    admin_email = _as_text(request.data.get('email', '')).lower()
    admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    app_id = request.data.get('application_id')
    action = _as_text(request.data.get('action', '')).lower()
    reject_reason = _as_text(request.data.get('reject_reason', ''))
    app = ShipperApplication.objects.select_related('user').filter(id=app_id).first()
    if not app:
        return Response({'success': False, 'message': 'Khong tim thay don shipper.'}, status=404)
    if app.status != 'pending':
        return Response({'success': False, 'message': 'Don nay da duoc xu ly truoc do.'}, status=400)
    if action not in {'approve', 'reject'}:
        return Response({'success': False, 'message': 'Action khong hop le.'}, status=400)

    with transaction.atomic():
        if action == 'approve':
            ShipperProfile.objects.update_or_create(
                user=app.user,
                defaults={
                    'company_name': app.company_name,
                    'contact_email': app.user.email,
                    'phone_number': app.user.phone_number or '',
                    'is_active': True,
                }
            )
            if app.user.role not in ('ADMIN', 'VENDOR'):
                app.user.role = 'SHIPPER'
                app.user.save(update_fields=['role'])
            app.status = 'approved'
        else:
            app.status = 'rejected'
            app.reject_reason = reject_reason

        app.reviewed_by = admin_user
        app.reviewed_at = timezone.now()
        app.save(update_fields=['status', 'reject_reason', 'reviewed_by', 'reviewed_at'])

    return Response({'success': True, 'message': 'Da xu ly don shipper.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def admin_product_moderation_api(request):
    admin_email = _as_text(request.data.get('email', '')).lower()
    _admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    product_id = request.data.get('product_id')
    action = _as_text(request.data.get('action', '')).lower()
    product = Product.objects.filter(id=product_id, is_deleted=False).first()
    if not product:
        return Response({'success': False, 'message': 'Khong tim thay san pham.'}, status=404)

    if action == 'approve':
        product.moderation_status = Product.MOD_ACTIVE
    elif action == 'reject':
        product.moderation_status = Product.MOD_REJECTED
        product.status = Product.STATUS_HIDDEN
    else:
        return Response({'success': False, 'message': 'Action khong hop le.'}, status=400)

    product.save(update_fields=['moderation_status', 'status'])
    return Response({'success': True, 'message': 'Da cap nhat kiem duyet san pham.'})


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def support_tickets_api(request):
    if request.method == 'POST':
        sender_email = _as_text(request.data.get('email', '')).lower()
        sender = _get_user_by_email(sender_email)
        if not sender:
            return Response({'success': False, 'message': 'Khong tim thay nguoi gui.'}, status=404)

        ticket_type = _as_text(request.data.get('ticket_type', SupportTicket.TYPE_SUPPORT)).upper()
        content = _as_text(request.data.get('content', ''))
        related_order_id = request.data.get('related_order_id')
        if ticket_type not in dict(SupportTicket.TYPE_CHOICES):
            return Response({'success': False, 'message': 'Loai ticket khong hop le.'}, status=400)
        if not content:
            return Response({'success': False, 'message': 'Noi dung khong duoc de trong.'}, status=400)

        related_order = Order.objects.filter(id=related_order_id).first() if related_order_id else None
        ticket = SupportTicket.objects.create(
            sender=sender,
            ticket_type=ticket_type,
            content=content,
            related_order=related_order,
        )
        return Response({
            'success': True,
            'ticket': {
                'id': ticket.id,
                'ticket_code': ticket.ticket_code,
                'status': ticket.status,
            }
        }, status=201)

    admin_email = _as_text(request.query_params.get('email', '')).lower()
    _admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    status = _as_text(request.query_params.get('status', '')).upper()
    ticket_type = _as_text(request.query_params.get('ticket_type', '')).upper()
    sender_role = _as_text(request.query_params.get('sender_role', '')).upper()
    page = int(request.query_params.get('page', 1) or 1)
    page_size = min(int(request.query_params.get('page_size', 20) or 20), 100)

    tickets_qs = SupportTicket.objects.select_related('sender', 'related_order', 'handled_by').all().order_by('-created_at')
    if status:
        tickets_qs = tickets_qs.filter(status=status)
    if ticket_type:
        tickets_qs = tickets_qs.filter(ticket_type=ticket_type)
    if sender_role:
        tickets_qs = tickets_qs.filter(sender__role=sender_role)

    paginator = Paginator(tickets_qs, page_size)
    page_obj = paginator.get_page(page)
    return Response({
        'success': True,
        'tickets': [
            {
                'id': ticket.id,
                'ticket_code': ticket.ticket_code,
                'ticket_type': ticket.ticket_type,
                'content': ticket.content,
                'status': ticket.status,
                'sender': {
                    'id': ticket.sender_id,
                    'email': ticket.sender.email,
                    'full_name': ticket.sender.full_name,
                    'role': ticket.sender.role,
                },
                'related_order_code': ticket.related_order.order_code if ticket.related_order else '',
                'admin_response': ticket.admin_response,
                'handled_by_email': ticket.handled_by.email if ticket.handled_by else '',
                'created_at': ticket.created_at.strftime('%d/%m/%Y %H:%M'),
                'updated_at': ticket.updated_at.strftime('%d/%m/%Y %H:%M'),
            }
            for ticket in page_obj.object_list
        ],
        'pagination': {
            'page': page_obj.number,
            'page_size': page_size,
            'total_pages': paginator.num_pages,
            'total_items': paginator.count,
        }
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def support_ticket_reply_api(request, ticket_id):
    admin_email = _as_text(request.data.get('email', '')).lower()
    admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    ticket = SupportTicket.objects.select_related('sender').filter(id=ticket_id).first()
    if not ticket:
        return Response({'success': False, 'message': 'Khong tim thay ticket.'}, status=404)

    response_text = _as_text(request.data.get('response', ''))
    next_status = _as_text(request.data.get('status', SupportTicket.STATUS_IN_PROGRESS)).upper()
    send_email_notice = bool(request.data.get('send_email', False))

    if next_status not in dict(SupportTicket.STATUS_CHOICES):
        return Response({'success': False, 'message': 'Trang thai ticket khong hop le.'}, status=400)

    ticket.admin_response = response_text
    ticket.status = next_status
    ticket.handled_by = admin_user
    ticket.save(update_fields=['admin_response', 'status', 'handled_by', 'updated_at'])

    email_sent = False
    if send_email_notice and ticket.sender and ticket.sender.email:
        try:
            subject = f"[Intellishop] Cap nhat ticket {ticket.ticket_code}"
            body = response_text or f"Ticket {ticket.ticket_code} da duoc cap nhat trang thai: {ticket.status}."
            send_mail(subject, body, getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@intellishop.local'), [ticket.sender.email], fail_silently=False)
            email_sent = True
        except Exception as ex:
            logger.error(f"Loi gui email ticket {ticket.ticket_code}: {ex}")

    return Response({'success': True, 'message': 'Da phan hoi ticket.', 'email_sent': email_sent})


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def system_reviews_api(request):
    if request.method == 'POST':
        email = _as_text(request.data.get('email', '')).lower()
        user = _get_user_by_email(email)
        if not user:
            return Response({'success': False, 'message': 'Khong tim thay nguoi dung.'}, status=404)
        rating = int(request.data.get('rating', 0) or 0)
        comment = _as_text(request.data.get('comment', ''))
        if rating < 1 or rating > 5:
            return Response({'success': False, 'message': 'So sao phai tu 1 den 5.'}, status=400)
        review = SystemReview.objects.create(user=user, rating=rating, comment=comment)
        return Response({'success': True, 'review_id': review.id}, status=201)

    reviews = SystemReview.objects.select_related('user').all()[:100]
    stats = SystemReview.objects.aggregate(avg_rating=Avg('rating'), total=Count('id'))
    return Response({
        'success': True,
        'stats': {
            'avg_rating': round(float(stats.get('avg_rating') or 0), 1),
            'total_reviews': int(stats.get('total') or 0),
        },
        'reviews': [
            {
                'id': review.id,
                'user_email': review.user.email,
                'user_name': review.user.full_name or review.user.email,
                'rating': review.rating,
                'comment': review.comment,
                'created_at': review.created_at.strftime('%d/%m/%Y %H:%M'),
            }
            for review in reviews
        ]
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def admin_reports_dashboard_api(request):
    admin_email = _as_text(request.query_params.get('email', '')).lower()
    _admin_user, error = _get_admin_user_by_email(admin_email)
    if error:
        return error

    today = timezone.localdate()
    start_date = today - timedelta(days=6)
    labels = [(start_date + timedelta(days=offset)).strftime('%d/%m') for offset in range(7)]

    order_counts_map = {
        row['created_at__date']: int(row['count'])
        for row in Order.objects.filter(created_at__date__gte=start_date)
        .values('created_at__date')
        .annotate(count=Count('id'))
    }
    support_counts_map = {
        row['created_at__date']: int(row['count'])
        for row in SupportTicket.objects.filter(created_at__date__gte=start_date)
        .values('created_at__date')
        .annotate(count=Count('id'))
    }

    order_series = []
    support_series = []
    for offset in range(7):
        day = start_date + timedelta(days=offset)
        order_series.append(order_counts_map.get(day, 0))
        support_series.append(support_counts_map.get(day, 0))

    review_stats = SystemReview.objects.aggregate(avg_rating=Avg('rating'), total=Count('id'))

    return Response({
        'success': True,
        'overview': {
            'total_orders': Order.objects.count(),
            'support_request_count': SupportTicket.objects.filter(ticket_type=SupportTicket.TYPE_SUPPORT).count(),
            'complaint_count': SupportTicket.objects.filter(ticket_type=SupportTicket.TYPE_COMPLAINT).count(),
            'open_ticket_count': SupportTicket.objects.exclude(status=SupportTicket.STATUS_RESOLVED).count(),
            'avg_system_rating': round(float(review_stats.get('avg_rating') or 0), 1),
            'system_review_count': int(review_stats.get('total') or 0),
        },
        'line_chart': {
            'labels': labels,
            'orders': order_series,
            'support_tickets': support_series,
        }
    })


@csrf_exempt
def get_user_orders(request):
    if request.method != 'POST':
        return JsonResponse({'success': False}, status=405)
    try:
        payload = json.loads(request.body)
        email = payload.get('email') or payload.get('user_email')
        if not email:
            return JsonResponse({'success': False, 'message': 'Thiếu email'})

        user = _get_user_by_email(email)
        base_queryset = Order.objects.select_related('shipper__shipper_profile', 'vendor').prefetch_related('items').order_by('-created_at')
        orders = base_queryset.filter(user=user) if user else base_queryset.filter(customer_email=email)
        orders_data = [
            {
                'preferred_shipping_provider': _extract_preferred_shipping_provider(o.note),
                'order_code': o.order_code,
                'total_amount': str(o.total_amount),
                'status': o.status,
                'status_label': _status_label(o.status),
                'payment_method': o.payment_method,
                'shipper_company_name': o.shipper.shipper_profile.company_name if o.shipper_id and hasattr(o.shipper, 'shipper_profile') and o.shipper.shipper_profile else _extract_preferred_shipping_provider(o.note),
                'vendor_name': o.vendor.full_name if o.vendor else '',
                'created_at': o.created_at.strftime("%d/%m/%Y %H:%M"),
                'items': [
                    {
                        'product_name': item.product_name,
                        'variant': item.variant,
                        'price': str(item.price),
                        'quantity': item.quantity,
                    }
                    for item in o.items.all()
                ],
            }
            for o in orders
        ]
        return JsonResponse({'success': True, 'orders': orders_data})
    except Exception as e:
        logger.error(f"Lỗi lấy đơn hàng: {e}")
        return JsonResponse({'success': False, 'message': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def social_auth_check(request):
    """
    LUỒNG 1B & 2B: Xử lý Google login
    
    LUỒNG 1B (Đăng ký bằng Google):
    - Người dùng click "Đăng ký với Google"
    - Email CHƯA tồn tại → Kích hoạt "Kịch bản 2" (bổ sung thông tin)
    
    LUỒNG 2B (Đăng nhập bằng Google):
    - Người dùng click "Đăng nhập với Google"
    
    Case 1: Email KHÔNG tồn tại
    → Người dùng click nhầm nút Đăng nhập (nên click Đăng ký)
    → Hệ thống tự động chuyển sang Kịch bản 2 để tạo tài khoản
    
    Case 2: Email ĐÃ tồn tại
    → Kiểm tra SocialAccount:
        - Đã liên kết Google → Đăng nhập ngay
        - Chưa liên kết (từng đăng ký Local) → Tạo SocialAccount + Đăng nhập
    """
    email = request.data.get('email', '').strip().lower()
    name = request.data.get('name', '').strip()
    provider = (request.data.get('provider') or 'google').strip().lower()
    auth_intent = (request.data.get('auth_intent') or 'login').strip().lower()
    uid = request.data.get('uid', '').strip()

    if auth_intent not in {'login', 'register'}:
        auth_intent = 'login'

    if provider != 'google':
        return Response({
            'success': False,
            'message': 'Chỉ hỗ trợ đăng nhập/đăng ký bằng Google.'
        }, status=400)

    if not email or not uid:
        return Response({
            'success': False,
            'message': 'Email và UID từ Google là bắt buộc'
        }, status=400)

    try:
        # TRY: Tìm user với email này
        user = User.objects.get(email__iexact=email)
        
        # EMAIL ĐÃ TỒN TẠI
        logger.info(f"🔍 Người dùng đã tồn tại: {email}")
        
        # KIỂM TRA: Đã liên kết SocialAccount chưa?
        social_account = SocialAccount.objects.filter(
            user=user,
            provider='google',
            uid=uid
        ).first()
        
        # KIỂM TRA TÀI KHOẢN BỊ KHOÁ
        if not user.is_active:
            # Tài khoản chưa xác thực OTP nhưng đăng nhập bằng Google → Google đã xác minh email
            # → Kích hoạt tài khoản và huỷ tất cả OTP challenge đang chờ
            logger.info(f"🔑 Kích hoạt tài khoản chưa xác thực OTP qua Google: {email}")
            user.is_active = True
            user.save(update_fields=['is_active'])
            EmailOTPChallenge.objects.filter(
                email=email,
                purpose=EmailOTPChallenge.PURPOSE_REGISTER,
                is_used=False,
            ).update(is_used=True)

        if social_account:
            # CASE 2.1: ĐÃ LIÊN KẾT → Đăng nhập ngay
            logger.info(f"✅ SocialAccount đã tồn tại: google - {email}")
            refresh = RefreshToken.for_user(user)
            success_message = 'Đăng nhập với Google thành công!'
            if auth_intent == 'register':
                success_message = 'Email đã tồn tại. Tự động đăng nhập với Google.'
            return Response({
                'success': True,
                'action': 'login',
                'message': success_message,
                'intent_hint': 'login',
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': {
                    'email': user.email,
                    'name': user.full_name or user.username or user.email,
                    'phone': user.phone_number,
                    'role': user.role,
                }
            })
        else:
            # CASE 2.2: CHƯA LIÊN KẾT (User từng đăng ký Local, nay lười gõ pass nên click Google)
            # → Tạo SocialAccount tự động + Đăng nhập
            existing_google_link = SocialAccount.objects.filter(user=user, provider='google').first()
            if existing_google_link and existing_google_link.uid != uid:
                return Response({
                    'success': False,
                    'message': 'Google account không khớp với tài khoản đã liên kết trước đó.'
                }, status=409)

            uid_conflict = SocialAccount.objects.filter(provider='google', uid=uid).exclude(user=user).exists()
            if uid_conflict:
                return Response({
                    'success': False,
                    'message': 'Google account này đã được liên kết với tài khoản khác.'
                }, status=409)

            if not existing_google_link:
                logger.info(f"🔗 Liên kết google cho {email}")
                SocialAccount.objects.create(
                    user=user,
                    provider='google',
                    uid=uid
                )

            refresh = RefreshToken.for_user(user)
            success_message = f'Tài khoản {email} đã liên kết với Google. Đăng nhập thành công!'
            if auth_intent == 'register':
                success_message = f'Email {email} đã tồn tại. Hệ thống tự động liên kết Google và đăng nhập.'
            return Response({
                'success': True,
                'action': 'login',
                'message': success_message,
                'intent_hint': 'login',
                'access_token': str(refresh.access_token),
                'refresh_token': str(refresh),
                'user': {
                    'email': user.email,
                    'name': user.full_name or user.username or user.email,
                    'phone': user.phone_number,
                    'role': user.role,
                }
            })
    
    except User.DoesNotExist:
        # EMAIL KHÔNG TỒN TẠI
        # → Kích hoạt "Kịch bản 2": Chuyển sang trang bổ sung thông tin
        logger.info(f"📝 Email chưa tồn tại, bắt đầu Kịch bản 2: {email}")
        
        temp_data = {
            'email': email,
            'name': name,
            'provider': 'google',
            'uid': uid
        }
        temp_token = signing.dumps(temp_data)
        request.session['social_signup_pending'] = temp_data
        request.session.modified = True
        
        return Response({
            'success': True,
            'action': 'requires_info',  # Kích hoạt "Kịch bản 2"
            'message': 'Chưa có tài khoản.' if auth_intent == 'login' else 'Vui lòng bổ sung thông tin để hoàn tất đăng ký bằng Google.',
            'intent_hint': 'register',
            'temp_token': temp_token,
            'email': email,
            'name': name,
            'provider': 'google'
        })
    
    except Exception as e:
        logger.error(f"Lỗi social_auth_check: {str(e)}")
        return Response({
            'success': False,
            'message': f'Lỗi xác thực: {str(e)}'
        }, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def social_auth_complete(request):
    """
    KỊCH BẢN 2: Hoàn tất đăng ký bằng Google
    
    Thao tác: User bổ sung thông tin (Số điện thoại, Mật khẩu web) và nhấn Submit
    
    Logic Backend:
    1. Xác thực temp_token (kiểm tra thời gian hết hạn 15 phút)
    2. Tạo bản ghi mới trong User (Email, Tên từ Google, có Mật khẩu web)
    3. Tạo liên kết SocialAccount
    4. Cấp JWT tokens
    """
    temp_token = request.data.get('temp_token', '').strip()
    phone = request.data.get('phone', '').strip()
    password = request.data.get('password', '').strip()

    try:
        # 1. LẤY DỮ LIỆU TẠM TỪ TOKEN HOẶC SESSION
        data = None
        if temp_token:
            try:
                data = signing.loads(temp_token, max_age=900)  # 15 phút
            except Exception as e:
                logger.warning(f"❌ Temp token không hợp lệ: {str(e)}")

        if not data:
            data = request.session.get('social_signup_pending')

        if not data:
            return Response({
                'success': False,
                'message': 'Phiên xác thực đã hết hạn. Vui lòng bắt đầu lại từ Google.'
            }, status=400)

        email = data.get('email')
        name = data.get('name')
        provider = (data.get('provider') or '').strip().lower()
        uid = data.get('uid')

        if provider != 'google':
            return Response({
                'success': False,
                'message': 'Phiên đăng ký mạng xã hội không hợp lệ.'
            }, status=400)

        if not phone or not password:
            return Response({
                'success': False,
                'message': 'Vui lòng bổ sung Số điện thoại và Mật khẩu để hoàn tất đăng ký.'
            }, status=400)

        # 2. KIỂM TRA EMAIL ĐẶC BIỆT: Khi nhấn Kịch bản 2, email này MỤC ĐÍCH không tồn tại
        # Nhưng nếu có user khác thêm vào DB giữa lúc user điền form, phải thông báo
        if User.objects.filter(email__iexact=email).exists():
            logger.warning(f"❌ Email '{email}' đã tồn tại (ai đó đã đăng ký trong lúc điền form)")
            return Response({
                'success': False,
                'message': 'Email này đã được đăng ký. Vui lòng Đăng nhập hoặc chọn email khác.'
            }, status=409)

        # 3. TẠO NGƯỜI DÙNG MỚI + SOCIALACCOUNT (Atomic transaction)
        with transaction.atomic():
            # Tạo User
            user = User.objects.create_user(
                email=email,
                password=password,
                username=email,  # Sử dụng email làm username
                full_name=name,
                phone_number=phone,
                role='CUSTOMER',
                gender=request.data.get('gender', 'other')
            )
            
            # Tạo liên kết SocialAccount
            SocialAccount.objects.create(
                user=user,
                provider='google',
                uid=uid
            )

        # 4. CẤP JWT TOKENS
        refresh = RefreshToken.for_user(user)
        request.session.pop('social_signup_pending', None)
        
        logger.info(f"✅ Kịch bản 2 hoàn tất: User mới tạo {email} với google")
        
        return Response({
            'success': True,
            'message': 'Đăng ký thành công! Bạn đã được tự động đăng nhập.',
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'user': {
                'email': user.email,
                'name': user.full_name or user.username or user.email,
                'phone': user.phone_number,
                'role': user.role,
            }
        }, status=201)
        
    except User.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Người dùng không tồn tại. Vui lòng thử lại.'
        }, status=404)
    except Exception as e:
        logger.error(f"Lỗi hoàn tất đăng ký: {str(e)}")
        return Response({
            'success': False,
            'message': f'Lỗi hoàn tất đăng ký: {str(e)}'
        }, status=500)
