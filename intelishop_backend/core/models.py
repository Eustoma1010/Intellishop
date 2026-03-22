from django.db import models, transaction
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone
from django.core.exceptions import ValidationError


# 1. TẠO MANAGER CHO USER (Để Django biết cách tạo user bằng Email thay vì Username)
class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email là trường bắt buộc')
        email = self.normalize_email(email)
        extra_fields.setdefault('role', 'CUSTOMER')
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'ADMIN')
        return self.create_user(email, password, **extra_fields)


# 2. TẠO MODEL USER CHUẨN ENTERPRISE
class User(AbstractBaseUser, PermissionsMixin):
    ROLE_CHOICES = [
        ('CUSTOMER', 'Khách hàng'),
        ('VENDOR',   'Người bán'),
        ('SHIPPER',  'Đơn vị vận chuyển'),
        ('ADMIN',    'Quản trị viên'),
    ]

    # Các trường cốt lõi
    email = models.EmailField(unique=True, max_length=255)  # Email giờ là Khóa chính (Unique)
    username = models.CharField(max_length=150, blank=True)
    full_name = models.CharField(max_length=255, blank=True, default='')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='CUSTOMER', db_index=True)

    # Các trường mở rộng cho E-commerce
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    birthday = models.DateField(null=True, blank=True)
    birth_date = models.DateField(null=True, blank=True)
    ai_personal_notes = models.TextField(blank=True, null=True)
    gender = models.CharField(
        max_length=10,
        choices=[('male', 'Nam'), ('female', 'Nữ'), ('other', 'Khác')],
        blank=True,
        null=True
    )
    intellishop_coin = models.PositiveIntegerField(default=0)


    # Các trường hệ thống bắt buộc của Django
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    # ĐẬP BỎ USERNAME, CHỈ ĐỊNH EMAIL LÀM TRƯỜNG ĐĂNG NHẬP CHÍNH
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []  # Không bắt buộc thêm trường nào khi tạo superuser (ngoài email và pass)

    objects = CustomUserManager()

    @property
    def is_customer(self):
        return self.role == 'CUSTOMER'

    @property
    def is_vendor(self):
        return self.role == 'VENDOR'

    @property
    def is_shipper(self):
        return self.role == 'SHIPPER'

    def __str__(self):
        return f"{self.email} ({self.role})"
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
    owner = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='store', verbose_name="Chủ cửa hàng"
    )
    name = models.CharField(max_length=100, db_index=True, verbose_name="Tên cửa hàng")
    # Tối ưu lưu trữ: Phân loại ảnh theo năm/tháng để tránh quá tải thư mục
    icon = models.ImageField(upload_to='store_icons/%Y/%m/', null=True, blank=True, verbose_name="Logo thương hiệu")
    description = models.TextField(blank=True, verbose_name="Mô tả")
    business_category = models.CharField(max_length=100, blank=True, verbose_name="Ngành hàng kinh doanh")
    business_phone = models.CharField(max_length=20, blank=True, verbose_name="SĐT doanh nghiệp")
    store_address = models.TextField(blank=True, verbose_name="Địa chỉ cửa hàng")
    city = models.CharField(max_length=100, blank=True, db_index=True, verbose_name="Tỉnh / Thành phố")
    business_license = models.FileField(upload_to='business_licenses/%Y/%m/', null=True, blank=True, verbose_name="Giấy phép kinh doanh")
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


# 3. BẢNG SẢN PHẨM
class Product(models.Model):
    STATUS_AVAILABLE = 'in_stock'
    STATUS_OUT_OF_STOCK = 'out_of_stock'
    STATUS_HIDDEN = 'hidden'
    STATUS_CHOICES = [
        (STATUS_AVAILABLE, 'Con hang'),
        (STATUS_OUT_OF_STOCK, 'Het hang'),
        (STATUS_HIDDEN, 'Bi an'),
    ]

    MOD_PENDING = 'PENDING'
    MOD_ACTIVE = 'ACTIVE'
    MOD_REJECTED = 'REJECTED'
    MODERATION_CHOICES = [
        (MOD_PENDING, 'Cho duyet'),
        (MOD_ACTIVE, 'Da duyet'),
        (MOD_REJECTED, 'Tu choi'),
    ]

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='products', verbose_name="Cửa hàng")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, related_name='products', verbose_name="Danh mục")

    name = models.CharField(max_length=200, db_index=True, verbose_name="Tên sản phẩm")
    description = models.TextField(blank=True, default='', verbose_name="Mô tả chi tiết")
    # Tăng max_digits cho doanh nghiệp lớn và đánh index cho giá để filter nhanh
    price = models.DecimalField(max_digits=12, decimal_places=2, db_index=True, verbose_name="Giá hiện tại ($)")
    stock = models.PositiveIntegerField(default=0, db_index=True, verbose_name="Tồn kho")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_AVAILABLE, db_index=True)
    moderation_status = models.CharField(max_length=20, choices=MODERATION_CHOICES, default=MOD_ACTIVE, db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    old_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="Giá cũ ($)")
    is_hot = models.BooleanField(default=False, db_index=True, verbose_name="Là Deal Hot")
    # Tối ưu lưu trữ ảnh theo năm/tháng
    image = models.ImageField(upload_to='product_images/%Y/%m/', max_length=500, null=True, blank=True, verbose_name="Ảnh sản phẩm")

    def __str__(self):
        return f"{self.name} - ${self.price}"


class Voucher(models.Model):
    DISCOUNT_PERCENT = 'percent'
    DISCOUNT_FIXED = 'fixed'
    DISCOUNT_CHOICES = [
        (DISCOUNT_PERCENT, 'Phan tram'),
        (DISCOUNT_FIXED, 'So tien co dinh'),
    ]

    SCOPE_STORE = 'store'
    SCOPE_SELECTED = 'selected_products'
    SCOPE_CHOICES = [
        (SCOPE_STORE, 'Toan shop'),
        (SCOPE_SELECTED, 'San pham cu the'),
    ]

    STATUS_UPCOMING = 'upcoming'
    STATUS_RUNNING = 'running'
    STATUS_ENDED = 'ended'
    STATUS_CHOICES = [
        (STATUS_UPCOMING, 'Sap dien ra'),
        (STATUS_RUNNING, 'Dang chay'),
        (STATUS_ENDED, 'Da ket thuc'),
    ]

    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='vouchers')
    code = models.CharField(max_length=30)
    name = models.CharField(max_length=150)
    discount_type = models.CharField(max_length=10, choices=DISCOUNT_CHOICES, default=DISCOUNT_PERCENT)
    discount_value = models.DecimalField(max_digits=12, decimal_places=2)
    start_date = models.DateField()
    end_date = models.DateField()
    scope = models.CharField(max_length=30, choices=SCOPE_CHOICES, default=SCOPE_STORE)
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'code'], name='unique_voucher_code_per_store')
        ]
        ordering = ['-created_at']

    def clean(self):
        if self.end_date < self.start_date:
            raise ValidationError({'end_date': 'Ngay ket thuc phai lon hon hoac bang ngay bat dau.'})

    @property
    def status(self):
        today = timezone.localdate()
        if today < self.start_date:
            return self.STATUS_UPCOMING
        if today > self.end_date:
            return self.STATUS_ENDED
        return self.STATUS_RUNNING


# 4. BẢNG ĐƠN HÀNG
class Order(models.Model):
    STATUS_PENDING = 'PENDING'
    STATUS_READY_FOR_PICKUP = 'READY_FOR_PICKUP'
    STATUS_DELIVERING = 'DELIVERING'
    STATUS_DELIVERED = 'DELIVERED'
    STATUS_FAILED = 'FAILED'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Cho vendor xac nhan'),
        (STATUS_READY_FOR_PICKUP, 'Cho shipper nhan don'),
        (STATUS_DELIVERING, 'Dang giao'),
        (STATUS_DELIVERED, 'Da giao'),
        (STATUS_FAILED, 'Giao that bai'),
    ]

    # Đã có unique=True, tự động tạo index cực nhanh
    order_code = models.CharField(max_length=20, unique=True, verbose_name="Mã đơn hàng")
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='orders')
    vendor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='vendor_orders')
    shipper = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='shipper_orders')
    customer_name = models.CharField(max_length=100, verbose_name="Tên khách hàng")
    # Tối ưu: Dùng EmailField thay cho CharField để tự động validate chuẩn Email
    customer_email = models.EmailField(max_length=100, db_index=True, verbose_name="Email")
    customer_phone = models.CharField(max_length=20, verbose_name="Số điện thoại")
    shipping_address = models.TextField(verbose_name="Địa chỉ giao hàng")
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Tổng tiền ($)")
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True, verbose_name="Tình trạng")
    payment_method = models.CharField(max_length=20, default='COD', db_index=True)
    note = models.TextField(blank=True, null=True)
    shipping_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    shop_voucher_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    intellishop_voucher_discount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    coin_used = models.PositiveIntegerField(default=0)
    insurance_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name="Ngày đặt")

    def __str__(self):
        return f"{self.order_code} - {self.customer_name}"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, related_name='order_items')
    product_name = models.CharField(max_length=200, verbose_name="Tên sản phẩm")
    variant = models.CharField(max_length=100, blank=True, default='')
    price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Giá")
    quantity = models.IntegerField(default=1, verbose_name="Số lượng")

    def __str__(self):
        return f"{self.quantity} x {self.product_name}"


class Address(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='addresses')
    receiver_name = models.CharField(max_length=255)
    receiver_phone = models.CharField(max_length=20)
    full_address = models.TextField()
    is_default = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_default', '-updated_at']

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if self.is_default:
                Address.objects.filter(user=self.user, is_default=True).exclude(pk=self.pk).update(is_default=False)
            elif not self.pk and not Address.objects.filter(user=self.user).exists():
                # Auto-default for first address of a user.
                self.is_default = True
            super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.receiver_name} - {self.full_address[:40]}"


class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wishlist_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='wishlisted_by')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'product'], name='unique_user_product_wishlist')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id} - {self.product_id}"


class StoreReview(models.Model):
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name='reviews')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='store_reviews')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['store', 'user'], name='unique_store_review_per_user')
        ]
        ordering = ['-created_at']

    def clean(self):
        if self.rating < 1 or self.rating > 5:
            raise ValidationError({'rating': 'So sao phai nam trong khoang 1-5.'})

    def __str__(self):
        return f"{self.store.name} - {self.user.email} ({self.rating})"


class EmailOTPChallenge(models.Model):
    PURPOSE_REGISTER = 'register_activation'
    PURPOSE_RESET_PASSWORD = 'reset_password'
    PURPOSE_CHOICES = [
        (PURPOSE_REGISTER, 'Kich hoat tai khoan'),
        (PURPOSE_RESET_PASSWORD, 'Dat lai mat khau'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='otp_challenges')
    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES, db_index=True)
    otp_code = models.CharField(max_length=10)
    expires_at = models.DateTimeField(db_index=True)
    is_used = models.BooleanField(default=False, db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'purpose', 'is_used']),
        ]

    def __str__(self):
        return f"{self.email} - {self.purpose}"

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at


# ============================================================
# ĐƠN XIN TRỞ THÀNH NGƯỜI BÁN (VENDOR APPLICATION)
# ============================================================
class VendorApplication(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Chờ duyệt'),
        ('approved', 'Đã duyệt'),
        ('rejected', 'Từ chối'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vendor_applications')
    store_name = models.CharField(max_length=100, verbose_name="Tên cửa hàng")
    business_category = models.CharField(max_length=100, verbose_name="Ngành hàng kinh doanh")
    business_phone = models.CharField(max_length=20, blank=True, verbose_name="SĐT doanh nghiệp")
    store_address = models.TextField(verbose_name="Địa chỉ cửa hàng")
    city = models.CharField(max_length=100, blank=True, verbose_name="Tỉnh / Thành phố")
    description = models.TextField(blank=True, verbose_name="Mô tả cửa hàng")
    business_license = models.FileField(upload_to='vendor_applications/%Y/%m/', null=True, blank=True, verbose_name="Giấy phép kinh doanh")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_vendor_apps', verbose_name="Admin duyệt"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True, verbose_name="Lý do từ chối")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Đơn đăng ký Người bán"
        verbose_name_plural = "Đơn đăng ký Người bán"

    def __str__(self):
        return f"{self.user.email} → {self.store_name} [{self.status}]"


# ============================================================
# ĐƠN XIN TRỞ THÀNH ĐƠN VỊ VẬN CHUYỂN (SHIPPER APPLICATION)
# ============================================================
class ShipperApplication(models.Model):
    STATUS_CHOICES = [
        ('pending',  'Chờ duyệt'),
        ('approved', 'Đã duyệt'),
        ('rejected', 'Từ chối'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='shipper_applications')
    company_name = models.CharField(max_length=150, verbose_name="Tên công ty / Đơn vị")
    vehicle_type = models.CharField(max_length=100, verbose_name="Loại phương tiện")
    service_area = models.TextField(verbose_name="Khu vực phục vụ")
    business_license = models.FileField(upload_to='shipper_applications/%Y/%m/', null=True, blank=True, verbose_name="Giấy phép kinh doanh")
    description = models.TextField(blank=True, verbose_name="Mô tả")
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_shipper_apps', verbose_name="Admin duyệt"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.TextField(blank=True, verbose_name="Lý do từ chối")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Đơn đăng ký Đơn vị vận chuyển"
        verbose_name_plural = "Đơn đăng ký Đơn vị vận chuyển"

    def __str__(self):
        return f"{self.user.email} → {self.company_name} [{self.status}]"


class ShipperProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='shipper_profile')
    company_name = models.CharField(max_length=150)
    contact_email = models.EmailField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.company_name} ({self.user.email})"


class SupportTicket(models.Model):
    TYPE_COMPLAINT = 'COMPLAINT'
    TYPE_SUPPORT = 'SUPPORT'
    TYPE_CHOICES = [
        (TYPE_COMPLAINT, 'Khieu nai'),
        (TYPE_SUPPORT, 'Ho tro ky thuat'),
    ]

    STATUS_PENDING = 'PENDING'
    STATUS_IN_PROGRESS = 'IN_PROGRESS'
    STATUS_RESOLVED = 'RESOLVED'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Cho xu ly'),
        (STATUS_IN_PROGRESS, 'Dang xu ly'),
        (STATUS_RESOLVED, 'Da giai quyet'),
    ]

    ticket_code = models.CharField(max_length=20, unique=True, db_index=True, blank=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='support_tickets')
    ticket_type = models.CharField(max_length=20, choices=TYPE_CHOICES, db_index=True)
    content = models.TextField()
    related_order = models.ForeignKey(Order, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    admin_response = models.TextField(blank=True, default='')
    handled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handled_support_tickets')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.ticket_code or self.id} - {self.ticket_type}"

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new and not self.ticket_code:
            prefix = 'C' if self.ticket_type == self.TYPE_COMPLAINT else 'S'
            self.ticket_code = f"{prefix}{1000 + self.pk}"
            super().save(update_fields=['ticket_code'])


class SystemReview(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='system_reviews')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        if self.rating < 1 or self.rating > 5:
            raise ValidationError({'rating': 'So sao phai nam trong khoang 1-5.'})

    def __str__(self):
        return f"{self.user.email} ({self.rating})"


