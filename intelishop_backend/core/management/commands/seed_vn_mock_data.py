from __future__ import annotations

from decimal import Decimal
from typing import Dict, List, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import (
    Address,
    Category,
    Order,
    OrderItem,
    Product,
    ShipperProfile,
    Store,
    StoreReview,
    SupportTicket,
    SystemReview,
    User,
    Voucher,
    Wishlist,
)

try:
    from allauth.socialaccount.models import SocialAccount
except Exception:  # pragma: no cover - allauth may be unavailable in some envs
    SocialAccount = None


class Command(BaseCommand):
    help = "Nạp dữ liệu mock tiếng Việt độ chân thực cao cho Intelishop."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dataset-tag",
            default="vn2026",
            help="Tag hậu tố dùng cho email và mã đơn hàng được sinh.",
        )
        parser.add_argument(
            "--clear-first",
            action="store_true",
            help="Xóa dữ liệu mock cũ trùng dataset-tag trước khi nạp lại.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        tag = str(options["dataset_tag"]).strip().lower().replace(" ", "")
        if not tag:
            raise ValueError("dataset-tag không được để trống")

        if options["clear_first"]:
            self._clear_dataset(tag)

        self.stdout.write(self.style.NOTICE(f"Đang nạp dataset mock VN: {tag}"))

        categories = self._seed_categories()
        users = self._seed_users(tag)
        stores = self._seed_stores(users)
        products = self._seed_products(stores, categories)
        self._seed_vouchers(stores)
        self._seed_addresses(users)
        orders = self._seed_orders(users, stores, products, tag)
        self._seed_wishlist(users, products)
        self._seed_reviews(users, stores)
        self._seed_support(users, orders)
        self._seed_system_reviews(users)
        self._seed_social_accounts(users)

        summary = {
            "users": User.objects.filter(email__endswith=f"@{tag}.mock.intelishop.vn").count(),
            "stores": Store.objects.filter(name__startswith="[MOCK]").count(),
            "products": Product.objects.filter(store__name__startswith="[MOCK]").count(),
            "orders": Order.objects.filter(order_code__startswith=f"IS{tag.upper()}").count(),
            "wishlists": Wishlist.objects.filter(user__email__endswith=f"@{tag}.mock.intelishop.vn").count(),
        }

        self.stdout.write(self.style.SUCCESS("Nạp dữ liệu mock thành công."))
        for key, value in summary.items():
            self.stdout.write(f"- {key}: {value}")

    def _clear_dataset(self, tag: str):
        order_prefix = f"IS{tag.upper()}"
        emails_suffix = f"@{tag}.mock.intelishop.vn"

        # Remove dependent records first where needed.
        Order.objects.filter(order_code__startswith=order_prefix).delete()
        Store.objects.filter(name__startswith="[MOCK]").delete()
        User.objects.filter(email__endswith=emails_suffix).delete()

    def _seed_categories(self) -> Dict[str, Category]:
        names = [
            "Điện thoại",
            "Laptop",
            "Tai nghe",
            "Đồng hồ thông minh",
            "Phụ kiện",
            "Thời trang nam",
            "Thời trang nữ",
        ]
        result = {}
        for name in names:
            obj, _ = Category.objects.get_or_create(name=name)
            result[name] = obj
        return result

    def _seed_users(self, tag: str) -> Dict[str, User]:
        long_name = "Nguyễn Thị Minh Châu Trần Lê Quỳnh Như Phạm Hoàng Gia Bảo " * 3
        long_name = long_name.strip()[:240]

        base_users = [
            {
                "key": "admin",
                "email": f"admin.{tag}@{tag}.mock.intelishop.vn",
                "password": "Admin@123456",
                "full_name": "Quản trị viên mock dữ liệu",
                "role": "ADMIN",
                "phone_number": "0909123456",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "key": "vendor_1",
                "email": f"tran.hai.long@{tag}.mock.intelishop.vn",
                "password": "Vendor@123456",
                "full_name": "Trần Hải Long",
                "role": "VENDOR",
                "phone_number": "0981234567",
            },
            {
                "key": "vendor_2",
                "email": f"pham.ngoc.lan@{tag}.mock.intelishop.vn",
                "password": "Vendor@123456",
                "full_name": "Phạm Ngọc Lan",
                "role": "VENDOR",
                "phone_number": "0869123456",
            },
            {
                "key": "vendor_3",
                "email": f"le.duc.minh@{tag}.mock.intelishop.vn",
                "password": "Vendor@123456",
                "full_name": "Lê Đức Minh",
                "role": "VENDOR",
                "phone_number": "0388123456",
            },
            {
                "key": "shipper_1",
                "email": f"nguyen.huu.thinh@{tag}.mock.intelishop.vn",
                "password": "Shipper@123456",
                "full_name": "Nguyễn Hữu Thịnh",
                "role": "SHIPPER",
                "phone_number": "0399123456",
            },
            {
                "key": "cust_1",
                "email": f"doan.truc.my@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": "Đoàn Trúc My",
                "role": "CUSTOMER",
                "phone_number": "0913456789",
            },
            {
                "key": "cust_2",
                "email": f"hoang.viet.anh@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": "Hoàng Việt Anh",
                "role": "CUSTOMER",
                "phone_number": "0323456789",
            },
            {
                "key": "cust_3",
                "email": f"vo.ngoc.bich@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": "Võ Ngọc Bích",
                "role": "CUSTOMER",
                "phone_number": "0887123456",
            },
            {
                "key": "cust_4",
                "email": f"phan.thanh.dat@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": "Phan Thành Đạt",
                "role": "CUSTOMER",
                "phone_number": "0976123456",
            },
            {
                "key": "cust_5",
                "email": f"dang.long.name@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": long_name,
                "role": "CUSTOMER",
                "phone_number": "0358123456",
            },
            {
                "key": "cust_no_order",
                "email": f"khach.chua.mua@{tag}.mock.intelishop.vn",
                "password": "Customer@123456",
                "full_name": "Lê Thị Chưa Mua",
                "role": "CUSTOMER",
                "phone_number": "0833456789",
            },
        ]

        users = {}
        for row in base_users:
            user, created = User.objects.get_or_create(
                email=row["email"],
                defaults={
                    "full_name": row["full_name"],
                    "role": row["role"],
                    "phone_number": row.get("phone_number", ""),
                    "is_active": True,
                    "is_staff": row.get("is_staff", False),
                    "is_superuser": row.get("is_superuser", False),
                },
            )

            # Keep data deterministic even on re-run.
            user.full_name = row["full_name"]
            user.role = row["role"]
            user.phone_number = row.get("phone_number", "")
            user.is_active = True
            user.is_staff = row.get("is_staff", False)
            user.is_superuser = row.get("is_superuser", False)
            user.intellishop_coin = 50000 if row["role"] == "CUSTOMER" else user.intellishop_coin
            if created or not user.has_usable_password():
                user.set_password(row["password"])
            user.save()
            users[row["key"]] = user

        # One customer registered via Google only (no local password).
        google_only_email = f"google.only@{tag}.mock.intelishop.vn"
        google_user, _ = User.objects.get_or_create(
            email=google_only_email,
            defaults={
                "full_name": "Nguyễn Google Only",
                "role": "CUSTOMER",
                "phone_number": "0347123456",
                "is_active": True,
            },
        )
        google_user.role = "CUSTOMER"
        google_user.full_name = "Nguyễn Google Only"
        google_user.phone_number = "0347123456"
        google_user.set_unusable_password()
        google_user.save()
        users["cust_google_only"] = google_user

        return users

    def _seed_stores(self, users: Dict[str, User]) -> Dict[str, Store]:
        rows = [
            {
                "key": "store_1",
                "owner": users["vendor_1"],
                "name": "[MOCK] Sài Gòn Mobile",
                "business_category": "Điện tử",
                "business_phone": "0908111222",
                "city": "TP Hồ Chí Minh",
                "store_address": "92 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP Hồ Chí Minh",
                "description": "Chuyên điện thoại chính hãng, bảo hành rõ ràng, giao nhanh nội thành.",
            },
            {
                "key": "store_2",
                "owner": users["vendor_2"],
                "name": "[MOCK] Ha Noi Tech Hub",
                "business_category": "Công nghệ",
                "business_phone": "0911223344",
                "city": "Hà Nội",
                "store_address": "120 Thái Hà, Phường Trung Liệt, Quận Đống Đa, Hà Nội",
                "description": "Laptop, tai nghe, phụ kiện công nghệ cho sinh viên và dân văn phòng.",
            },
            {
                "key": "store_3",
                "owner": users["vendor_3"],
                "name": "[MOCK] Nắng Fashion",
                "business_category": "Thời trang",
                "business_phone": "0988334455",
                "city": "Đà Nẵng",
                "store_address": "45 Lê Duẩn, Phường Hải Châu 1, Quận Hải Châu, Đà Nẵng",
                "description": "Thời trang unisex, phong cách trẻ trung, chất liệu mềm mại dễ mặc hằng ngày.",
            },
        ]

        stores = {}
        for row in rows:
            obj, _ = Store.objects.get_or_create(name=row["name"], defaults={"owner": row["owner"]})
            obj.owner = row["owner"]
            obj.business_category = row["business_category"]
            obj.business_phone = row["business_phone"]
            obj.city = row["city"]
            obj.store_address = row["store_address"]
            obj.description = row["description"]
            obj.is_active = True
            obj.save()
            stores[row["key"]] = obj

        ShipperProfile.objects.update_or_create(
            user=users["shipper_1"],
            defaults={
                "company_name": "FastShip VN",
                "contact_email": users["shipper_1"].email,
                "phone_number": users["shipper_1"].phone_number or "0399123456",
                "is_active": True,
            },
        )

        return stores

    def _seed_products(self, stores: Dict[str, Store], categories: Dict[str, Category]) -> Dict[str, Product]:
        rows = [
            (
                "p1",
                stores["store_1"],
                categories["Điện thoại"],
                "Điện thoại Samsung Galaxy S23 Ultra 256GB",
                19990000,
                23990000,
                14,
                "in_stock",
                True,
                "Flagship màn hình 2K, camera 200MP, pin 5000mAh. Image URL: https://images.unsplash.com/photo-1610945265064-0e34e5519bbf",
            ),
            (
                "p2",
                stores["store_1"],
                categories["Điện thoại"],
                "iPhone 15 Pro Max 256GB Titan Tự Nhiên",
                29990000,
                32990000,
                9,
                "in_stock",
                True,
                "Chip A17 Pro, quay video ProRes, phù hợp content creator. Image URL: https://images.unsplash.com/photo-1695048133142-1a20484bce71",
            ),
            (
                "p3",
                stores["store_1"],
                categories["Phụ kiện"],
                "Sạc nhanh GaN 65W 2 cổng USB-C",
                550000,
                790000,
                35,
                "in_stock",
                False,
                "Sạc nhanh cho iPhone, Samsung, MacBook Air. Image URL: https://images.unsplash.com/photo-1583863788434-e58a36330cf0",
            ),
            (
                "p4",
                stores["store_2"],
                categories["Laptop"],
                "Laptop ASUS VivoBook 15 OLED i5 16GB 512GB",
                15990000,
                17990000,
                11,
                "in_stock",
                True,
                "Màn OLED đẹp, pin bền, phù hợp học tập và văn phòng. Image URL: https://images.unsplash.com/photo-1496181133206-80ce9b88a853",
            ),
            (
                "p5",
                stores["store_2"],
                categories["Laptop"],
                "MacBook Air M2 13 inch 16GB 256GB",
                25990000,
                27990000,
                6,
                "in_stock",
                True,
                "Máy nhẹ, pin dài, hiệu năng ổn định cho dân sáng tạo. Image URL: https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
            ),
            (
                "p6",
                stores["store_2"],
                categories["Tai nghe"],
                "Tai nghe Sony WH-1000XM5 chống ồn chủ động",
                7490000,
                8990000,
                0,
                "out_of_stock",
                False,
                "Chống ồn tốt, chất âm cân bằng, pin đến 30 giờ. Image URL: https://images.unsplash.com/photo-1505740420928-5e560c06d30e",
            ),
            (
                "p7",
                stores["store_2"],
                categories["Đồng hồ thông minh"],
                "Apple Watch Series 9 GPS 45mm",
                10990000,
                11990000,
                12,
                "in_stock",
                False,
                "Theo dõi sức khỏe, thông báo nhanh, độ bền cao. Image URL: https://images.unsplash.com/photo-1523275335684-37898b6baf30",
            ),
            (
                "p8",
                stores["store_3"],
                categories["Thời trang nam"],
                "Áo thun cotton unisex form rộng màu đen",
                199000,
                299000,
                70,
                "in_stock",
                False,
                "Chất liệu cotton 2 chiều, mặc mát, phối đồ dễ. Image URL: https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
            ),
            (
                "p9",
                stores["store_3"],
                categories["Thời trang nữ"],
                "Váy họa tiết vintage tay phồng màu kem",
                459000,
                599000,
                24,
                "in_stock",
                True,
                "Dáng váy nữ tính, phù hợp đi làm và đi chơi cuối tuần. Image URL: https://images.unsplash.com/photo-1529139574466-a303027c1d8b",
            ),
            (
                "p10",
                stores["store_3"],
                categories["Thời trang nam"],
                "Quần jean nam slimfit xanh đậm",
                399000,
                520000,
                0,
                "out_of_stock",
                False,
                "Vải jean có độ co giãn nhẹ, tôn dáng. Image URL: https://images.unsplash.com/photo-1542272604-787c3835535d",
            ),
            (
                "p11",
                stores["store_1"],
                categories["Điện thoại"],
                "Điện thoại Xiaomi 13T Pro 12GB 512GB",
                12990000,
                14990000,
                17,
                "in_stock",
                False,
                "Cấu hình mạnh, camera Leica, giá hợp lý cho game thủ. Image URL: https://images.unsplash.com/photo-1511707171634-5f897ff02aa9",
            ),
            (
                "p12",
                stores["store_2"],
                categories["Phụ kiện"],
                "Bàn phím cơ Bluetooth layout 75% hot-swap RGB",
                1290000,
                1690000,
                22,
                "in_stock",
                False,
                "Gõ êm tay, kết nối đa thiết bị, pin 4000mAh. Image URL: https://images.unsplash.com/photo-1517336714739-489689fd1ca8",
            ),
            (
                "p13",
                stores["store_3"],
                categories["Thời trang nữ"],
                "Áo blazer nữ công sở form regular màu beige",
                890000,
                1190000,
                13,
                "in_stock",
                False,
                "Đường may chắc chắn, vải đứng form, dễ phối quần âu. Image URL: https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc",
            ),
            (
                "p14",
                stores["store_3"],
                categories["Thời trang nam"],
                "Áo khoác gió nam chống nước nhẹ",
                650000,
                850000,
                19,
                "hidden",
                False,
                "Áo khoác đi mưa nhẹ, gọn nhẹ, dễ gấp mang theo. Image URL: https://images.unsplash.com/photo-1548883354-94bcfe321cbb",
            ),
            (
                "p15",
                stores["store_1"],
                categories["Phụ kiện"],
                "Cáp sạc USB-C to C 100W độ bền cao chiều dài 1.5m",
                189000,
                250000,
                120,
                "in_stock",
                False,
                "Cáp bọc dù nylon, hỗ trợ PD 100W, truyền dữ liệu nhanh. Image URL: https://images.unsplash.com/photo-1583863788434-e58a36330cf0",
            ),
        ]

        products: Dict[str, Product] = {}
        for (
            key,
            store,
            category,
            name,
            price,
            old_price,
            stock,
            status,
            is_hot,
            description,
        ) in rows:
            obj, _ = Product.objects.update_or_create(
                store=store,
                name=name,
                defaults={
                    "category": category,
                    "description": description,
                    "price": Decimal(price),
                    "old_price": Decimal(old_price),
                    "stock": stock,
                    "status": status,
                    "is_hot": is_hot,
                    "moderation_status": Product.MOD_ACTIVE,
                    "is_deleted": False,
                },
            )
            products[key] = obj

        return products

    def _seed_vouchers(self, stores: Dict[str, Store]):
        today = timezone.localdate()
        rows = [
            (stores["store_1"], "SGM10", "Giảm 10% điện thoại cao cấp", "percent", 10, today.replace(day=1), today.replace(day=28), "store"),
            (stores["store_2"], "HNTECH300", "Giảm 300K laptop", "fixed", 300000, today.replace(day=1), today.replace(day=28), "store"),
            (stores["store_3"], "NANG15", "Giảm 15% thời trang mùa hè", "percent", 15, today.replace(day=1), today.replace(day=28), "store"),
        ]
        for store, code, name, discount_type, value, start, end, scope in rows:
            Voucher.objects.update_or_create(
                store=store,
                code=code,
                defaults={
                    "name": name,
                    "discount_type": discount_type,
                    "discount_value": Decimal(value),
                    "start_date": start,
                    "end_date": end,
                    "scope": scope,
                    "is_deleted": False,
                },
            )

    def _seed_addresses(self, users: Dict[str, User]):
        data = {
            "cust_1": [
                ("Đoàn Trúc My", "0913456789", "12 Đường số 8, Phường Linh Chiểu, TP Thủ Đức, TP Hồ Chí Minh", True),
                ("Đoàn Trúc My", "0913456789", "KTX Khu B ĐHQG, Phường Đông Hòa, TP Dĩ An, Bình Dương", False),
            ],
            "cust_2": [
                ("Hoàng Việt Anh", "0323456789", "45 Hoàng Quốc Việt, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội", True),
            ],
            "cust_3": [
                ("Võ Ngọc Bích", "0887123456", "18 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, Đà Nẵng", True),
            ],
            "cust_4": [
                ("Phan Thành Đạt", "0976123456", "301 Cách Mạng Tháng 8, Phường 12, Quận 10, TP Hồ Chí Minh", True),
            ],
            "cust_5": [
                ("Đặng Long Name", "0358123456", "72 Lê Hồng Phong, Phường 4, Quận 5, TP Hồ Chí Minh", True),
            ],
            "cust_no_order": [
                ("Lê Thị Chưa Mua", "0833456789", "25 Trần Phú, Phường Điện Biên, Quận Ba Đình, Hà Nội", True),
            ],
            "cust_google_only": [
                ("Nguyễn Google Only", "0347123456", "99 Phạm Văn Đồng, Phường Cổ Nhuế 1, Quận Bắc Từ Liêm, Hà Nội", True),
            ],
        }

        for user_key, addresses in data.items():
            user = users[user_key]
            for receiver_name, phone, full_address, is_default in addresses:
                Address.objects.update_or_create(
                    user=user,
                    full_address=full_address,
                    defaults={
                        "receiver_name": receiver_name,
                        "receiver_phone": phone,
                        "is_default": is_default,
                    },
                )

    def _seed_orders(
        self,
        users: Dict[str, User],
        stores: Dict[str, Store],
        products: Dict[str, Product],
        tag: str,
    ) -> Dict[str, Order]:
        order_rows = [
            {
                "key": "o1",
                "suffix": "0001",
                "user": users["cust_1"],
                "vendor": users["vendor_1"],
                "shipper": users["shipper_1"],
                "status": Order.STATUS_DELIVERED,
                "payment_method": "COD",
                "shipping_address": "12 Đường số 8, Phường Linh Chiểu, TP Thủ Đức, TP Hồ Chí Minh",
                "customer_name": "Đoàn Trúc My",
                "customer_email": users["cust_1"].email,
                "customer_phone": "0913456789",
                "shipping_fee": 30000,
                "shop_voucher_discount": 120000,
                "intellishop_voucher_discount": 50000,
                "coin_used": 10000,
                "insurance_fee": 0,
                "note": "Giao giờ hành chính",
                "items": [(products["p1"], 1, "Xanh, 256GB"), (products["p3"], 1, "65W")],
            },
            {
                "key": "o2",
                "suffix": "0002",
                "user": users["cust_2"],
                "vendor": users["vendor_2"],
                "shipper": users["shipper_1"],
                "status": Order.STATUS_DELIVERING,
                "payment_method": "ONLINE",
                "shipping_address": "45 Hoàng Quốc Việt, Phường Nghĩa Đô, Quận Cầu Giấy, Hà Nội",
                "customer_name": "Hoàng Việt Anh",
                "customer_email": users["cust_2"].email,
                "customer_phone": "0323456789",
                "shipping_fee": 25000,
                "shop_voucher_discount": 300000,
                "intellishop_voucher_discount": 0,
                "coin_used": 5000,
                "insurance_fee": 15000,
                "note": "Liên hệ trước khi giao",
                "items": [(products["p4"], 1, "16GB/512GB")],
            },
            {
                "key": "o3",
                "suffix": "0003",
                "user": users["cust_3"],
                "vendor": users["vendor_3"],
                "shipper": None,
                "status": Order.STATUS_PENDING,
                "payment_method": "COD",
                "shipping_address": "18 Nguyễn Văn Linh, Phường Nam Dương, Quận Hải Châu, Đà Nẵng",
                "customer_name": "Võ Ngọc Bích",
                "customer_email": users["cust_3"].email,
                "customer_phone": "0887123456",
                "shipping_fee": 20000,
                "shop_voucher_discount": 0,
                "intellishop_voucher_discount": 30000,
                "coin_used": 0,
                "insurance_fee": 0,
                "note": "Khách muốn kiểm tra hàng",
                "items": [(products["p9"], 1, "Màu kem, size M"), (products["p8"], 2, "Đen, L")],
            },
            {
                "key": "o4",
                "suffix": "0004",
                "user": users["cust_4"],
                "vendor": users["vendor_2"],
                "shipper": users["shipper_1"],
                "status": Order.STATUS_FAILED,
                "payment_method": "COD",
                "shipping_address": "301 Cách Mạng Tháng 8, Phường 12, Quận 10, TP Hồ Chí Minh",
                "customer_name": "Phan Thành Đạt",
                "customer_email": users["cust_4"].email,
                "customer_phone": "0976123456",
                "shipping_fee": 30000,
                "shop_voucher_discount": 0,
                "intellishop_voucher_discount": 0,
                "coin_used": 0,
                "insurance_fee": 0,
                "note": "Failed: giao không thành công do sai số điện thoại",
                "items": [(products["p6"], 1, "Đen")],
            },
            {
                "key": "o5",
                "suffix": "0005",
                "user": users["cust_5"],
                "vendor": users["vendor_1"],
                "shipper": users["shipper_1"],
                "status": Order.STATUS_FAILED,
                "payment_method": "COD",
                "shipping_address": "72 Lê Hồng Phong, Phường 4, Quận 5, TP Hồ Chí Minh",
                "customer_name": users["cust_5"].full_name,
                "customer_email": users["cust_5"].email,
                "customer_phone": "0358123456",
                "shipping_fee": 30000,
                "shop_voucher_discount": 50000,
                "intellishop_voucher_discount": 0,
                "coin_used": 0,
                "insurance_fee": 0,
                "note": "Failed: khách hủy đơn sau khi đặt",
                "items": [(products["p11"], 1, "Xanh, 512GB")],
            },
            {
                "key": "o6",
                "suffix": "0006",
                "user": users["cust_google_only"],
                "vendor": users["vendor_3"],
                "shipper": users["shipper_1"],
                "status": Order.STATUS_READY_FOR_PICKUP,
                "payment_method": "ONLINE",
                "shipping_address": "99 Phạm Văn Đồng, Phường Cổ Nhuế 1, Quận Bắc Từ Liêm, Hà Nội",
                "customer_name": "Nguyễn Google Only",
                "customer_email": users["cust_google_only"].email,
                "customer_phone": "0347123456",
                "shipping_fee": 25000,
                "shop_voucher_discount": 0,
                "intellishop_voucher_discount": 20000,
                "coin_used": 3000,
                "insurance_fee": 0,
                "note": "Đơn đang chờ shipper nhận",
                "items": [(products["p13"], 1, "Beige, M")],
            },
        ]

        result = {}
        for row in order_rows:
            order_code = f"IS{tag.upper()}{row['suffix']}"
            subtotal = Decimal("0")
            for product, qty, _variant in row["items"]:
                subtotal += Decimal(product.price) * Decimal(qty)

            total = (
                subtotal
                - Decimal(row["shop_voucher_discount"])
                - Decimal(row["intellishop_voucher_discount"])
                - Decimal(row["coin_used"])
                + Decimal(row["shipping_fee"])
                + Decimal(row["insurance_fee"])
            )
            if total < 0:
                total = Decimal("0")

            order, _ = Order.objects.update_or_create(
                order_code=order_code,
                defaults={
                    "user": row["user"],
                    "vendor": row["vendor"],
                    "shipper": row["shipper"],
                    "customer_name": row["customer_name"][:100],
                    "customer_email": row["customer_email"],
                    "customer_phone": row["customer_phone"],
                    "shipping_address": row["shipping_address"],
                    "total_amount": total,
                    "status": row["status"],
                    "payment_method": row["payment_method"],
                    "note": row["note"],
                    "shipping_fee": Decimal(row["shipping_fee"]),
                    "shop_voucher_discount": Decimal(row["shop_voucher_discount"]),
                    "intellishop_voucher_discount": Decimal(row["intellishop_voucher_discount"]),
                    "coin_used": int(row["coin_used"]),
                    "insurance_fee": Decimal(row["insurance_fee"]),
                },
            )

            order.items.all().delete()
            item_rows = []
            for product, qty, variant in row["items"]:
                item_rows.append(
                    OrderItem(
                        order=order,
                        product=product,
                        product_name=product.name,
                        variant=variant,
                        price=Decimal(product.price),
                        quantity=qty,
                    )
                )
            OrderItem.objects.bulk_create(item_rows)
            result[row["key"]] = order

        return result

    def _seed_wishlist(self, users: Dict[str, User], products: Dict[str, Product]):
        rows = [
            (users["cust_1"], products["p5"]),
            (users["cust_1"], products["p9"]),
            (users["cust_2"], products["p1"]),
            (users["cust_3"], products["p4"]),
            (users["cust_google_only"], products["p13"]),
        ]
        for user, product in rows:
            Wishlist.objects.get_or_create(user=user, product=product)

    def _seed_reviews(self, users: Dict[str, User], stores: Dict[str, Store]):
        rows = [
            (stores["store_1"], users["cust_1"], 5, "Shop tư vấn nhanh, hàng đúng mô tả."),
            (stores["store_1"], users["cust_2"], 4, "Giá tốt, đóng gói cẩn thận."),
            (stores["store_2"], users["cust_2"], 5, "Laptop mới, máy chạy êm."),
            (stores["store_3"], users["cust_3"], 4, "Áo đẹp, chất vải ổn."),
            (stores["store_3"], users["cust_4"], 3, "Giao hàng hơi chậm nhưng sản phẩm đẹp."),
        ]
        for store, user, rating, comment in rows:
            StoreReview.objects.update_or_create(
                store=store,
                user=user,
                defaults={"rating": rating, "comment": comment},
            )

    def _seed_support(self, users: Dict[str, User], orders: Dict[str, Order]):
        rows = [
            (
                users["cust_4"],
                SupportTicket.TYPE_COMPLAINT,
                "Đơn hàng giao thất bại, khách cần được gọi lại để hẹn giao.",
                orders["o4"],
                SupportTicket.STATUS_IN_PROGRESS,
                "Đã liên hệ shipper và cập nhật số điện thoại.",
                users["admin"],
            ),
            (
                users["vendor_2"],
                SupportTicket.TYPE_SUPPORT,
                "Cần hỗ trợ bổ sung thông tin báo cáo doanh thu theo ngày.",
                None,
                SupportTicket.STATUS_PENDING,
                "",
                None,
            ),
        ]

        for sender, ticket_type, content, related_order, status, admin_response, handled_by in rows:
            ticket, _ = SupportTicket.objects.get_or_create(
                sender=sender,
                ticket_type=ticket_type,
                content=content,
                related_order=related_order,
            )
            ticket.status = status
            ticket.admin_response = admin_response
            ticket.handled_by = handled_by
            ticket.save()

    def _seed_system_reviews(self, users: Dict[str, User]):
        rows = [
            (users["cust_1"], 5, "Giao diện dễ dùng, đặt hàng nhanh."),
            (users["cust_2"], 4, "Cần thêm bộ lọc nâng cao cho laptop."),
            (users["vendor_1"], 4, "Trang quản lý ổn định, dễ theo dõi đơn."),
            (users["shipper_1"], 5, "Dashboard giao hàng rõ ràng, cập nhật nhanh."),
        ]
        for user, rating, comment in rows:
            SystemReview.objects.update_or_create(
                user=user,
                comment=comment,
                defaults={"rating": rating},
            )

    def _seed_social_accounts(self, users: Dict[str, User]):
        if SocialAccount is None:
            return

        rows = [
            (users["cust_google_only"], "google", "google_uid_mock_001"),
            (users["cust_2"], "google", "google_uid_mock_002"),
        ]
        for user, provider, uid in rows:
            SocialAccount.objects.update_or_create(
                provider=provider,
                uid=uid,
                defaults={
                    "user": user,
                    "extra_data": {
                        "email": user.email,
                        "name": user.full_name,
                    },
                },
            )

