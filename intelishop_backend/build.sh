#!/usr/bin/env bash
# ============================================================
# Build script cho Render deployment (Free plan — no Shell)
# Mọi thứ chạy tự động: install → migrate → load data → superuser
# ============================================================
set -o errexit  # Dừng nếu có lỗi

echo "📦 Installing dependencies..."
pip install -r requirements.txt

echo "📁 Collecting static files..."
python manage.py collectstatic --no-input

echo "🗄️ Running database migrations..."
python manage.py migrate --no-input

echo "📊 Loading initial data (skip if already exists)..."
python manage.py load_exported_data

echo "👤 Creating superuser (skip if already exists)..."
python manage.py auto_createsuperuser

echo "✅ Build completed successfully!"
