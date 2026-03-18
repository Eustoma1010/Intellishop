import os
import django
import faiss
import numpy as np
import google.generativeai as genai
import time

# 1. Cài đặt môi trường Django để lấy dữ liệu từ DB
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Nhớ thay chữ 'core' bằng tên app thực tế của bạn nếu khác
from core.models import Product

# 2. Cấu hình API Key (Lấy đúng key bạn đang dùng trong views.py)
genai.configure(api_key="AIzaSyB0De4DFz4bdo6npbpZVk5uiePnfGOqCbI")


def setup_rag():
    products = Product.objects.all()
    if not products:
        print("Cảnh báo: Không có sản phẩm nào trong Database!")
        return

    embeddings = []
    product_ids = []

    print(f"🚀 Bắt đầu tạo Vector RAG cho {len(products)} sản phẩm...")
    print("-" * 50)

    for p in products:
        # Lấy tên danh mục (đã xử lý lỗi nếu không có danh mục)
        category_name = p.category.name if p.category else 'Khác'

        # Tạo chuỗi ngữ nghĩa để AI học
        text_to_embed = f"Tên sản phẩm: {p.name}. Danh mục: {category_name}. Giá: ${p.price}. Đặc điểm: Phù hợp mặc đi chơi, đi làm."

        try:
            # Gọi API nhúng vector của Gemini
            result = genai.embed_content(
                model="models/gemini-embedding-2-preview",
                content=text_to_embed,
                task_type="retrieval_document"
            )

            embeddings.append(result['embedding'])
            product_ids.append(p.id)

            print(f"✅ Đã học xong: {p.name}")

            # CỰC KỲ QUAN TRỌNG: Nghỉ 1.5 giây để không bị Google khóa API vì spam
            time.sleep(1.5)

        except Exception as e:
            print(f"❌ Lỗi ở sản phẩm '{p.name}': {str(e)}")

    if not embeddings:
        print("Không tạo được vector nào. Quá trình thất bại.")
        return

    # 3. Lưu vào Database Vector (FAISS)
    print("-" * 50)
    print("Đang đóng gói dữ liệu vào file...")
    dimension = len(embeddings[0])
    index = faiss.IndexFlatL2(dimension)

    # Ép kiểu ID sang int64 theo chuẩn của FAISS
    index_with_ids = faiss.IndexIDMap(index)
    index_with_ids.add_with_ids(
        np.array(embeddings).astype('float32'),
        np.array(product_ids).astype('int64')
    )

    faiss.write_index(index_with_ids, "product_vectors.index")
    print("🎉 HOÀN TẤT! Đã lưu thành công vào file 'product_vectors.index'")


if __name__ == "__main__":
    setup_rag()