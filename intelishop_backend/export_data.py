"""
Export dữ liệu từ SQLite local ra JSON fixture (UTF-8) để load vào PostgreSQL.
Chạy: python export_data.py
"""
import os, sys, json, django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
sys.stdout.reconfigure(encoding='utf-8')

django.setup()

from django.core.management import call_command
from io import StringIO

buf = StringIO()
# Export tất cả app core + django.contrib.sites (cần cho allauth)
call_command(
    'dumpdata',
    'core',                        # Tất cả model trong core app
    'sites',                       # django.contrib.sites (SITE_ID)
    '--indent', '2',
    '--natural-foreign',
    '--natural-primary',
    stdout=buf,
)

output_path = os.path.join(os.path.dirname(__file__), 'data_export.json')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(buf.getvalue())

print(f"✅ Exported successfully to: {output_path}")
print(f"   File size: {os.path.getsize(output_path) / 1024:.1f} KB")

