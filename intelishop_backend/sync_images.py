import os
from django.conf import settings
from django.core.files import File
from core.models import Product


def sync_to_cloudinary():
    products = Product.objects.all()
    success_count = 0
    error_count = 0

    print("Bắt đầu đồng bộ ảnh lên Cloudinary...")

    for p in products:
        if p.image:
            # Lấy đường dẫn file local
            local_path = os.path.join(settings.BASE_DIR, 'media', str(p.image.name))

            # Chỉ xử lý nếu file thực sự tồn tại trên máy
            if os.path.exists(local_path):
                try:
                    with open(local_path, 'rb') as f:
                        # Upload và lưu lại đường dẫn mới
                        p.image.save(os.path.basename(local_path), File(f), save=True)
                    print(f"[OK] Đã upload: {p.name}")
                    success_count += 1
                except Exception as e:
                    print(f"[LỖI] Xử lý '{p.name}' thất bại. Chi tiết: {str(e)}")
                    error_count += 1
            else:
                print(f"[BỎ QUA] Không tìm thấy file gốc: {local_path}")

    print("\n" + "=" * 40)
    print(f"HOÀN TẤT ĐỒNG BỘ!")
    print(f"Thành công: {success_count} ảnh")
    print(f"Lỗi: {error_count} ảnh")
    print("=" * 40 + "\n")


# Thực thi hàm
sync_to_cloudinary()