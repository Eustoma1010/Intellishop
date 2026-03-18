from django.db import models

# 1. BẢNG DANH MỤC (CATALOG)
class Category(models.Model):
    # Thêm db_index để truy xuất danh mục nhanh hơn
    name = models.CharField(max_length=100, db_index=True, verbose_name="Tên danh mục")
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name="Mã Icon FontAwesome")

    class Meta:
        verbose_name_plural = "Categories" # Sửa lỗi hiển thị "Categorys" trong Admin

    def __str__(self):
        return self.name


# 2. BẢNG CỬA HÀNG
class Store(models.Model):
    name = models.CharField(max_length=100, db_index=True, verbose_name="Tên cửa hàng")
    # Tối ưu lưu trữ: Phân loại ảnh theo năm/tháng để tránh quá tải thư mục
    icon = models.ImageField(upload_to='store_icons/%Y/%m/', null=True, blank=True, verbose_name="Logo thương hiệu")
    description = models.TextField(blank=True, verbose_name="Mô tả")

    def __str__(self):
        return self.name


# 3. BẢNG SẢN PHẨM
class Product(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='products', verbose_name="Cửa hàng")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products', verbose_name="Danh mục")

    name = models.CharField(max_length=200, db_index=True, verbose_name="Tên sản phẩm")
    # Tăng max_digits cho doanh nghiệp lớn và đánh index cho giá để filter nhanh
    price = models.DecimalField(max_digits=12, decimal_places=2, db_index=True, verbose_name="Giá hiện tại ($)")
    old_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Giá cũ ($)")
    is_hot = models.BooleanField(default=False, db_index=True, verbose_name="Là Deal Hot")
    # Tối ưu lưu trữ ảnh theo năm/tháng
    image = models.ImageField(upload_to='product_images/%Y/%m/', null=True, blank=True, verbose_name="Ảnh sản phẩm")

    def __str__(self):
        return f"{self.name} - ${self.price}"


# 4. BẢNG ĐƠN HÀNG
class Order(models.Model):
    # Đã có unique=True, tự động tạo index cực nhanh
    order_code = models.CharField(max_length=20, unique=True, verbose_name="Mã đơn hàng")
    customer_name = models.CharField(max_length=100, verbose_name="Tên khách hàng")
    # Tối ưu: Dùng EmailField thay cho CharField để tự động validate chuẩn Email
    customer_email = models.EmailField(max_length=100, db_index=True, verbose_name="Email")
    customer_phone = models.CharField(max_length=20, verbose_name="Số điện thoại")
    shipping_address = models.TextField(verbose_name="Địa chỉ giao hàng")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Tổng tiền ($)")
    status = models.CharField(max_length=50, default='Đã xác nhận', db_index=True, verbose_name="Tình trạng")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Ngày đặt")

    def __str__(self):
        return f"{self.order_code} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product_name = models.CharField(max_length=200, verbose_name="Tên sản phẩm")
    price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Giá")
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"