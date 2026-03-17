from django.db import models


# 1. BẢNG DANH MỤC (CATALOG) - MỚI
class Category(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên danh mục")
    icon = models.CharField(max_length=50, blank=True, null=True, verbose_name="Mã Icon FontAwesome")

    def __str__(self):
        return self.name


# 2. BẢNG CỬA HÀNG
class Store(models.Model):
    name = models.CharField(max_length=100, verbose_name="Tên cửa hàng")
    # Sửa thành upload_to để hỗ trợ upload ảnh thật
    icon = models.ImageField(upload_to='store_icons/', null=True, blank=True, verbose_name="Logo thương hiệu")
    description = models.TextField(blank=True, verbose_name="Mô tả")

    def __str__(self):
        return self.name


# 3. BẢNG SẢN PHẨM
class Product(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='products', verbose_name="Cửa hàng")
    # Thêm khóa ngoại liên kết với bảng Category
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products',
                                 verbose_name="Danh mục")

    name = models.CharField(max_length=200, verbose_name="Tên sản phẩm")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Giá hiện tại ($)")
    old_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Giá cũ ($)")
    is_hot = models.BooleanField(default=False, verbose_name="Là Deal Hot")
    # Sửa thành upload_to để hỗ trợ upload ảnh thật
    image = models.ImageField(upload_to='product_images/', null=True, blank=True, verbose_name="Ảnh sản phẩm")

    def __str__(self):
        return f"{self.name} - ${self.price}"


# 4. BẢNG ĐƠN HÀNG (Giữ nguyên)
class Order(models.Model):
    order_code = models.CharField(max_length=20, unique=True, verbose_name="Mã đơn hàng")
    customer_name = models.CharField(max_length=100, verbose_name="Tên khách hàng")
    customer_email = models.CharField(max_length=100, verbose_name="Email")
    customer_phone = models.CharField(max_length=20, verbose_name="Số điện thoại")
    shipping_address = models.TextField(verbose_name="Địa chỉ giao hàng")
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Tổng tiền ($)")
    status = models.CharField(max_length=50, default='Đã xác nhận', verbose_name="Tình trạng")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Ngày đặt")

    def __str__(self):
        return f"{self.order_code} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product_name = models.CharField(max_length=200, verbose_name="Tên sản phẩm")
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Giá")
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"