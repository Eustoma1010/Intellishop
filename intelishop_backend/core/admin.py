from django.contrib import admin
from import_export.admin import ImportExportModelAdmin
from .models import Store, Product, Order, OrderItem, Category

# Biến bảng Product thành bảng có hỗ trợ Import/Export bằng file Excel
@admin.register(Product)
class ProductAdmin(ImportExportModelAdmin):
    # Tiện thể cấu hình luôn các cột hiển thị cho đẹp
    list_display = ('id', 'name', 'store', 'price', 'is_hot', 'category')
    list_filter = ('store', 'category', 'is_hot')
    search_fields = ('name', 'category')

# Đăng ký các bảng khác bình thường
admin.site.register(Store)
admin.site.register(Order)
admin.site.register(OrderItem)
admin.site.register(Category)