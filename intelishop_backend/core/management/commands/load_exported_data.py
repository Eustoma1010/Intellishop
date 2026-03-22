"""
Management command: Load dữ liệu từ data_export.json vào database.
Tự động skip nếu DB đã có dữ liệu (an toàn khi redeploy).

Chạy tự động trong build.sh:
    python manage.py load_exported_data
"""
import os
from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Load data from data_export.json into current database (skip if data exists)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file', type=str, default='data_export.json',
            help='Path to the JSON fixture file (default: data_export.json)',
        )
        parser.add_argument(
            '--force', action='store_true',
            help='Force load even if data already exists',
        )

    def handle(self, *args, **options):
        from core.models import Product

        # Skip nếu DB đã có products (tức là data đã load rồi)
        if not options['force'] and Product.objects.exists():
            self.stdout.write(self.style.SUCCESS(
                '✅ Database already has data — skipped loading fixture.\n'
                '   Use --force to reload anyway.'
            ))
            return

        fixture_path = options['file']
        if not os.path.isabs(fixture_path):
            from django.conf import settings
            fixture_path = os.path.join(settings.BASE_DIR, fixture_path)

        if not os.path.exists(fixture_path):
            self.stderr.write(self.style.WARNING(
                f'⏭️  Fixture not found: {fixture_path} — skipped.'
            ))
            return

        self.stdout.write(self.style.WARNING('🔄 Loading data from fixture...'))

        try:
            call_command('loaddata', fixture_path, verbosity=1)
            self.stdout.write(self.style.SUCCESS('✅ Data loaded successfully!'))
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'❌ Error loading data: {e}'))
            raise
