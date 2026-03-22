"""
Tự động tạo superuser từ biến môi trường.
Dùng trong build.sh trên Render (không có Shell).

Env vars cần set trên Render:
    DJANGO_SUPERUSER_EMAIL=admin@example.com
    DJANGO_SUPERUSER_PASSWORD=your-secure-password
"""
import os
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create superuser from environment variables (non-interactive)'

    def handle(self, *args, **options):
        from django.contrib.auth import get_user_model
        User = get_user_model()

        email = os.environ.get('DJANGO_SUPERUSER_EMAIL')
        password = os.environ.get('DJANGO_SUPERUSER_PASSWORD')

        if not email or not password:
            self.stdout.write(self.style.WARNING(
                '⏭️  Skipped: DJANGO_SUPERUSER_EMAIL or DJANGO_SUPERUSER_PASSWORD not set.'
            ))
            return

        if User.objects.filter(email=email).exists():
            self.stdout.write(self.style.SUCCESS(
                f'✅ Superuser "{email}" already exists — skipped.'
            ))
            return

        User.objects.create_superuser(email=email, password=password)
        self.stdout.write(self.style.SUCCESS(
            f'✅ Superuser "{email}" created successfully!'
        ))

