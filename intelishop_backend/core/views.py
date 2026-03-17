import json
import re
import random
import base64
import edge_tts
import numpy as np
import asyncio
import os
import faiss
from dotenv import load_dotenv
from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth import authenticate, login
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.tokens import RefreshToken
import google.generativeai as genai
from .models import Store, Product, Order, OrderItem, Category

load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
FPT_API_KEY = os.getenv("FPT_API_KEY")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-2.5-flash')

try:
    FAISS_INDEX = faiss.read_index("product_vectors.index")
except Exception as e:
    FAISS_INDEX = None

@csrf_exempt
def get_store_data(request):
    try:
        # Lấy danh sách danh mục (Catalog)
        categories = Category.objects.all()
        categories_data = [{'id': c.id, 'name': c.name, 'icon': c.icon} for c in categories]

        stores = Store.objects.prefetch_related('products__category').all()
        store_info, store_products = {}, {}
        hot_deals = []

        for index, store in enumerate(stores):
            colors = [
                'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
                'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 100%)',
                'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
                'linear-gradient(135deg, #000000 0%, #434343 100%)',
                'linear-gradient(135deg, #1428a0 0%, #1e3c72 100%)'
            ]
            bg_color = colors[index % len(colors)]

            # Bảo vệ lỗi file ảnh
            store_icon_url = ''
            if store.icon and hasattr(store.icon, 'url'):
                try: store_icon_url = store.icon.url
                except: pass

            store_info[store.id] = {
                'name': store.name,
                'icon': store_icon_url,
                'desc': store.description,
                'rating': '4.9', 'sold': '1000+', 'reviews': '500',
                'bg_color': bg_color
            }

            store_products[store.id] = []

            for p in store.products.all():
                # Bảo vệ lỗi file ảnh
                prod_image_url = ''
                if p.image and hasattr(p.image, 'url'):
                    try: prod_image_url = p.image.url
                    except: pass

                prod_data = {
                    'id': p.id,
                    'name': p.name,
                    'price': float(p.price),
                    'old_price': float(p.old_price) if p.old_price else None,
                    'image': prod_image_url,
                    # Lấy thông tin từ bảng Category
                    'category': p.category.name if p.category else 'Khác',
                    'category_id': p.category.id if p.category else 'all',
                    'store': store.id
                }
                store_products[store.id].append(prod_data)

                if p.is_hot:
                    hot_deals.append(prod_data)

        return JsonResponse({
            'success': True,
            'storeInfo': store_info,
            'storeProducts': store_products,
            'hotDeals': hot_deals,
            'categories': categories_data # Gửi categories về cho JS
        })
    except Exception as e:
        print("Lỗi API Data:", str(e))
        return JsonResponse({'success': False, 'message': str(e)})


# ==========================================
# RAG VÀ AI AGENT
# ==========================================
def retrieve_relevant_products(user_query, top_k=3):
    if FAISS_INDEX is None: return "Hiện chưa có sản phẩm nào."
    try:
        query_result = genai.embed_content(model="models/gemini-embedding-2-preview", content=user_query, task_type="retrieval_query")
        query_vector = np.array([query_result['embedding']]).astype('float32')
        distances, indices = FAISS_INDEX.search(query_vector, top_k)
        matched_ids = [int(i) for i in indices[0] if i != -1]

        if not matched_ids: return "Không có sản phẩm nào khớp."

        matched_products = Product.objects.filter(id__in=matched_ids)
        product_list_text = "\n".join([f"- [ID: {p.id}] {p.name} (Giá: ${p.price}, Danh mục: {p.category.name if p.category else 'Khác'})" for p in matched_products])
        return product_list_text
    except Exception as e:
        print(f"Lỗi RAG: {e}")
        return "Lỗi truy xuất hệ thống."

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
    if request.method != 'POST': return JsonResponse({'success': False, 'reply': 'Sai phương thức'}, status=405)

    try:
        user_text = request.POST.get('message', '').strip()
        user_name = request.POST.get('user_name', 'Khách hàng')
        cart_items = request.POST.get('cart_items', '[]')

        if not user_text: return JsonResponse({'success': False, 'reply': 'Không nhận được tin nhắn.'})

        relevant_products_context = retrieve_relevant_products(user_text, top_k=3)

        prompt = f"""
        Bạn là chuyên viên tư vấn của Intelishop. 
        [THÔNG TIN KHÁCH]: Tên: {user_name} | Giỏ hàng hiện tại: {cart_items}
        Kho hàng: {relevant_products_context}

        Khách nói: '{user_text}'

        NHIỆM VỤ:
        1. Xưng hô bằng tên khách. Tư vấn tự nhiên dựa vào Kho hàng.
        2. Nếu khách chốt mua, tạo lệnh 'add_to_cart' kèm ID sản phẩm.
        3. Nếu khách muốn thanh toán, tạo lệnh 'checkout'.
        4. Trả lời NGẮN GỌN (dưới 40 chữ).

        BẮT BUỘC TRẢ VỀ CHUẨN JSON:
        {{
            "bot_reply": "Câu trả lời",
            "action": {{"type": "none", "product_id": null}}
        }}
        """

        response = model.generate_content(prompt)
        clean_json = re.sub(r'```json\n|\n```', '', response.text).strip()
        ai_data = json.loads(clean_json)

        bot_reply = ai_data.get('bot_reply', 'Xin lỗi, tôi đang xử lý lỗi.')
        action = ai_data.get('action', {'type': 'none'})

        audio_bytes = generate_audio_safe(clean_text_for_speech(bot_reply))
        audio_data_uri = f"data:audio/mp3;base64,{base64.b64encode(audio_bytes).decode('utf-8')}"

        return JsonResponse({'success': True, 'reply': bot_reply, 'action': action, 'audio_url': audio_data_uri})
    except Exception as e:
        print("Lỗi Backend AI:", str(e))
        return JsonResponse({'success': False, 'reply': "Máy chủ AI đang bận, vui lòng thử lại sau."})


# ==========================================
# CÁC API CƠ BẢN
# ==========================================
@csrf_exempt
def register_user(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Sai phương thức'}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')
        name = data.get('name', 'Người dùng mới')

        # Sẽ bổ sung lấy phone, gender, dob từ giao diện mới ở đây sau

        if User.objects.filter(username=email).exists():
            return JsonResponse({'success': False, 'message': 'Email đã được sử dụng!'})

        # Tạo user với username là email để hàm authenticate hoạt động đúng
        User.objects.create_user(username=email, email=email, password=password, first_name=name)
        return JsonResponse({'success': True, 'message': 'Đăng ký thành công!'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})


@csrf_exempt
def login_user(request):
    if request.method != 'POST':
        return JsonResponse({'success': False, 'message': 'Sai phương thức'}, status=405)
    try:
        data = json.loads(request.body)
        email = data.get('email')
        password = data.get('password')

        # Django mặc định authenticate bằng username, do lúc nãy ta gán username=email nên dùng email ở đây
        user = authenticate(request, username=email, password=password)

        if user:
            # Tạo JWT Token thay vì dùng session
            refresh = RefreshToken.for_user(user)
            return JsonResponse({
                'success': True,
                'message': 'Đăng nhập thành công!',
                'name': user.first_name,
                'email': user.email,
                'access_token': str(refresh.access_token),  # Trả về token
                'refresh_token': str(refresh)
            })

        return JsonResponse({'success': False, 'message': 'Sai email hoặc mật khẩu!'})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)})

@csrf_exempt
def create_order(request):
    try:
        data = json.loads(request.body)
        cart, customer, total = data.get('cart', []), data.get('customer', {}), data.get('total', 0)
        order_code = f"#ORD{random.randint(100000, 999999)}"
        order = Order.objects.create(
            order_code=order_code, customer_name=f"{customer.get('firstName')} {customer.get('lastName')}",
            customer_email=customer.get('email'), customer_phone=customer.get('phone'),
            shipping_address=f"{customer.get('address')}, {customer.get('district')}, {customer.get('city')}",
            total_amount=total
        )
        OrderItem.objects.bulk_create([OrderItem(order=order, product_name=item['name'], price=item['price'], quantity=item['qty']) for item in cart])
        return JsonResponse({'success': True, 'order_code': order_code})
    except Exception as e: return JsonResponse({'success': False, 'message': str(e)})

@csrf_exempt
def get_user_orders(request):
    try:
        email = json.loads(request.body).get('email')
        if not email: return JsonResponse({'success': False})
        orders = Order.objects.filter(customer_email=email).order_by('-created_at')
        orders_data = [{'order_code': o.order_code, 'total_amount': str(o.total_amount), 'status': o.status, 'created_at': o.created_at.strftime("%d/%m/%Y %H:%M")} for o in orders]
        return JsonResponse({'success': True, 'orders': orders_data})
    except Exception as e: return JsonResponse({'success': False, 'message': str(e)})