from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from django.db.models.signals import post_save, post_delete
        from core.models import Product
        from core import rag_manager

        # Khởi tạo FAISS index khi server start
        rag_manager.initialize()

        # Auto-rebuild khi Product thay đổi (debounced)
        def _on_product_change(sender, instance, **kwargs):
            rag_manager.mark_dirty()

        post_save.connect(_on_product_change, sender=Product)
        post_delete.connect(_on_product_change, sender=Product)

