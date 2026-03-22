from django.contrib import admin
from django.db import transaction
from django.utils import timezone
from import_export.admin import ImportExportModelAdmin
from .models import (
    User, Store, Product, Order, OrderItem, Category,
    Address, Wishlist, VendorApplication, ShipperApplication, Voucher, StoreReview, ShipperProfile,
    SupportTicket, SystemReview
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'full_name', 'role', 'phone_number', 'is_staff', 'is_active', 'date_joined')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'full_name', 'phone_number')
    ordering = ('-date_joined',)


@admin.register(VendorApplication)
class VendorApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'store_name', 'business_category', 'business_phone', 'city', 'status', 'created_at', 'reviewed_by', 'reviewed_at')
    list_filter = ('status',)
    search_fields = ('user__email', 'store_name')
    readonly_fields = ('created_at', 'reviewed_at', 'reviewed_by')
    actions = ['approve_applications', 'reject_applications']

    @admin.action(description='✅ Duyệt đơn → Cấp quyền VENDOR + tạo Store')
    def approve_applications(self, request, queryset):
        approved = 0
        for app in queryset.filter(status='pending'):
            with transaction.atomic():
                # 1. Cấp quyền VENDOR
                if app.user.role not in ('ADMIN', 'SHIPPER'):
                    app.user.role = 'VENDOR'
                    app.user.save(update_fields=['role'])
                # 2. Tạo hoặc cập nhật Store liên kết
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
                # 3. Đánh dấu đơn đã duyệt
                app.status = 'approved'
                app.reviewed_by = request.user
                app.reviewed_at = timezone.now()
                app.save()
                approved += 1
        self.message_user(request, f'✅ Đã duyệt {approved} đơn đăng ký Người bán.')

    @admin.action(description='❌ Từ chối đơn đăng ký Người bán')
    def reject_applications(self, request, queryset):
        updated = queryset.filter(status='pending').update(
            status='rejected',
            reviewed_by=request.user,
            reviewed_at=timezone.now()
        )
        self.message_user(request, f'❌ Đã từ chối {updated} đơn đăng ký.')


@admin.register(ShipperApplication)
class ShipperApplicationAdmin(admin.ModelAdmin):
    list_display = ('user', 'company_name', 'vehicle_type', 'status', 'created_at', 'reviewed_by')
    list_filter = ('status',)
    search_fields = ('user__email', 'company_name')
    readonly_fields = ('created_at', 'reviewed_at', 'reviewed_by')
    actions = ['approve_applications', 'reject_applications']

    @admin.action(description='✅ Duyệt đơn → Cấp quyền SHIPPER')
    def approve_applications(self, request, queryset):
        approved = 0
        for app in queryset.filter(status='pending'):
            with transaction.atomic():
                existing_profile = ShipperProfile.objects.filter(user=app.user).first()
                ShipperProfile.objects.update_or_create(
                    user=app.user,
                    defaults={
                        'company_name': app.company_name,
                        'contact_email': (existing_profile.contact_email if existing_profile else '') or app.user.email,
                        'phone_number': (existing_profile.phone_number if existing_profile else '') or app.user.phone_number or '',
                        'is_active': True,
                    }
                )
                if app.user.role not in ('ADMIN', 'VENDOR'):
                    app.user.role = 'SHIPPER'
                    app.user.save(update_fields=['role'])
                app.status = 'approved'
                app.reviewed_by = request.user
                app.reviewed_at = timezone.now()
                app.save()
                approved += 1
        self.message_user(request, f'✅ Đã duyệt {approved} đơn đăng ký Đơn vị vận chuyển.')

    @admin.action(description='❌ Từ chối đơn đăng ký Shipper')
    def reject_applications(self, request, queryset):
        updated = queryset.filter(status='pending').update(
            status='rejected',
            reviewed_by=request.user,
            reviewed_at=timezone.now()
        )
        self.message_user(request, f'❌ Đã từ chối {updated} đơn đăng ký.')


@admin.register(Product)
class ProductAdmin(ImportExportModelAdmin):
    list_display = ('id', 'name', 'store', 'price', 'stock', 'status', 'moderation_status', 'is_deleted', 'is_hot', 'category')
    list_filter = ('store', 'category', 'status', 'moderation_status', 'is_deleted', 'is_hot')
    search_fields = ('name', 'category__name')
    actions = ['rebuild_ai_index']

    @admin.action(description='🔄 Rebuild AI Index (FAISS) ngay lập tức')
    def rebuild_ai_index(self, request, queryset):
        import threading
        from core import rag_manager
        threading.Thread(target=rag_manager.rebuild_index, daemon=True).start()
        self.message_user(request, '🔄 Đang rebuild AI Index trong nền. Kiểm tra log server để theo dõi tiến trình.')


@admin.register(Voucher)
class VoucherAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'store', 'discount_type', 'discount_value', 'start_date', 'end_date', 'scope', 'is_deleted')
    list_filter = ('store', 'discount_type', 'scope', 'is_deleted')
    search_fields = ('code', 'name', 'store__name')


admin.site.register(Store)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(Category)
admin.site.register(Address)
admin.site.register(Wishlist)
admin.site.register(StoreReview)
admin.site.register(ShipperProfile)
admin.site.register(SupportTicket)
admin.site.register(SystemReview)
