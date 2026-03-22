🔄 RESTORE DATABASE FROM BACKUP & DEPLOY TO POSTGRESQL

Date: March 20, 2026
Status: Backup found & restoration plan prepared

═══════════════════════════════════════════════════════════

📋 SITUATION ANALYSIS

Current State:
  ✅ Backup file exists: backup_intelishop.json
  ✅ Contains: 2 users + 9 stores + 85 products + 2 orders
  ⚠️  Backup uses old auth.User model
  ✅ Current system uses custom core.User model

Database Status:
  ✅ SQLite: Fresh & clean (current database)
  ❌ PostgreSQL: Corrupted on Render (needs reset)

═══════════════════════════════════════════════════════════

🛠️ SOLUTION: 2-STEP PROCESS

STEP 1: FIX BACKUP DATA (Local)
  - Modify backup JSON to use core.User instead of auth.User
  - Load corrected backup into SQLite
  - Verify all data loaded

STEP 2: MIGRATE TO POSTGRESQL (Production)
  - Update .env to use PostgreSQL on Render
  - Dump data from SQLite
  - Load into fresh PostgreSQL database
  - Verify & deploy

═══════════════════════════════════════════════════════════

📝 STEP 1: FIX & LOAD BACKUP (LOCAL)

Backup contains:
  ✅ 2 Users (VCT, thienphan370@gmail.com)
  ✅ 9 Stores (Uniqlo, Nike, Adidas, etc.)
  ✅ 85 Products (clothing, shoes, accessories)
  ✅ 2 Orders with order items

Problem:
  ❌ Backup uses "auth.user" model
  ✅ Our system uses "core.user" custom model

Solution:
  The backup data is still usable! Just different format.
  Since backup contains same data structure, 
  we can manually recreate users and proceed.

═══════════════════════════════════════════════════════════

✅ STEP 1A: Create Users from Backup

Users in backup:
  1. Email: tuongvck24411@st.uel.edu.vn
     Password: pbkdf2_sha256$1200000$Fywc7HScZcJEHvrsLdUl2l$...
     is_superuser: True
     is_staff: True

  2. Email: thienphan370@gmail.com
     Password: pbkdf2_sha256$1200000$LS3KDv7Eja5ceZIc7hs0Df$...
     is_superuser: False
     is_staff: False
     name: Phan Phước Quốc Thiện

Run these commands:

  cd intelishop_backend
  python manage.py shell

  from django.contrib.auth import get_user_model
  User = get_user_model()

  # Create admin user
  User.objects.create_user(
      email='tuongvck24411@st.uel.edu.vn',
      password='your-password-here',  # Change to real password
      first_name='VCT',
      is_staff=True,
      is_superuser=True
  )

  # Create regular user
  User.objects.create_user(
      email='thienphan370@gmail.com',
      password='your-password-here',  # Change to real password
      first_name='Phan Phước Quốc Thiện'
  )

  print("✅ Users created!")
  exit()

═══════════════════════════════════════════════════════════

✅ STEP 1B: Load Stores & Products from Backup

After creating users, load fixture:

  python manage.py loaddata backup_intelishop.json

However, this may fail due to model mismatch.
Alternative solution: Manually add stores & products

But easier: Use Django shell to create them

  python manage.py shell

  from core.models import Store, Category, Product

  # 1. Create Categories
  categories = [
      ('Jacket', 4),
      ('T-Shirts, Sweatshirts, and Cardigans', 5),
      ('Pants', 6),
      ('Accessories', 7),
  ]

  for name, pk in categories:
      Category.objects.get_or_create(id=pk, defaults={'name': name})

  # 2. Create Stores (simplified - IDs from backup)
  stores_data = [
      ('Uniqlo', 1),
      ('ICONDENIM', 2),
      ('Nike', 3),
      ('Adidas', 4),
      ('PUMA', 5),
      ('COOLMATE', 6),
      ("Biti's", 7),
      ('GUCCI®', 8),
      ('PRADA', 9),
  ]

  for name, pk in stores_data:
      Store.objects.get_or_create(id=pk, defaults={'name': name})

  print("✅ Stores & Categories created!")

Note: For products, due to image URL differences,
      we'll need to manually recreate key products
      or use a more complex data migration script.

═══════════════════════════════════════════════════════════

📊 STEP 2: MIGRATE TO POSTGRESQL (PRODUCTION)

When ready to deploy to Render:

1️⃣  Export current SQLite data:

  python manage.py dumpdata --indent 2 > intelishop_dump.json

2️⃣  Switch to PostgreSQL in .env:

  # Uncomment/update in .env:
  DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[dbname]

  Example:
  DATABASE_URL=postgresql://intelishop_db_user:OrXzSZ44iPHDJaZgucYAHeH0zx9W80p0@dpg-d6t3emfgi27c73de98t0-a.singapore-postgres.render.com/intelishop_db

3️⃣  Run migrations on Render server:

  heroku run python manage.py migrate --app intelishop-backend

  Or via Render console:

  python manage.py migrate

4️⃣  Load data into PostgreSQL:

  python manage.py loaddata intelishop_dump.json

  Or import via Render:

  heroku run python manage.py loaddata intelishop_dump.json --app intelishop-backend

5️⃣  Verify on production:

  Check admin panel at:
  https://intelishop-backend.onrender.com/admin/

═══════════════════════════════════════════════════════════

🔐 IMPORTANT: PostgreSQL ON RENDER

Your current PostgreSQL connection:
  Host: dpg-d6t3emfgi27c73de98t0-a.singapore-postgres.render.com
  Port: 5432
  Database: intelishop_db
  User: intelishop_db_user
  Password: OrXzSZ44iPHDJaZgucYAHeH0zx9W80p0

⚠️  Issues with current PostgreSQL:
  ❌ Database tables corrupted
  ❌ Migration records missing
  ✅ Solution: Start fresh

Steps to reset PostgreSQL on Render:

  1. Go to Render dashboard
  2. Select PostgreSQL instance
  3. Click "Reset Database" or "Drop & Recreate"
  4. Then run migrations & load data

═══════════════════════════════════════════════════════════

🚀 QUICK MIGRATION SCRIPT

Create file: migrate_to_production.py

```python
#!/usr/bin/env python
import os
import sys
import django
from django.core.management import call_command

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

print("=" * 60)
print("🔄 MIGRATING TO POSTGRESQL")
print("=" * 60)

# Step 1: Run migrations
print("\n1️⃣  Running migrations...")
call_command('migrate')
print("✅ Migrations complete")

# Step 2: Create superuser
print("\n2️⃣  Creating superuser...")
from django.contrib.auth import get_user_model
User = get_user_model()

if not User.objects.filter(email='admin@intelishop.com').exists():
    User.objects.create_superuser(
        email='admin@intelishop.com',
        password='your-secure-password'
    )
    print("✅ Superuser created")
else:
    print("⚠️  Superuser already exists")

# Step 3: Load backup data (if available)
print("\n3️⃣  Loading backup data...")
try:
    call_command('loaddata', 'backup_intelishop.json')
    print("✅ Backup data loaded")
except Exception as e:
    print(f"⚠️  Could not load backup: {e}")
    print("   Continuing anyway...")

print("\n" + "=" * 60)
print("✅ MIGRATION COMPLETE!")
print("=" * 60)
```

Run on Render:
  heroku run python migrate_to_production.py --app intelishop-backend

═══════════════════════════════════════════════════════════

✅ CHECKLIST FOR PRODUCTION DEPLOYMENT

Local (Before pushing):
  ☐ Verified SQLite has all data
  ☐ Exported data: python manage.py dumpdata > export.json
  ☐ Tested auth flows locally
  ☐ Tested API endpoints locally

On Render (Deployment):
  ☐ Updated .env with PostgreSQL URL
  ☐ Ran migrations: heroku run python manage.py migrate
  ☐ Created superuser: heroku run python manage.py createsuperuser
  ☐ Loaded data: heroku run python manage.py loaddata
  ☐ Verified admin panel accessible
  ☐ Tested API endpoints on production
  ☐ Checked logs for errors

═══════════════════════════════════════════════════════════

📞 TROUBLESHOOTING

If PostgreSQL still corrupted:

  1. Go to Render dashboard
  2. Find your PostgreSQL database
  3. Click "Reset Database" (⚠️  This deletes all data!)
  4. Confirm reset
  5. Run migrations again

If data won't load:

  1. Check fixture format: python manage.py dumpdata --help
  2. Export small subset first
  3. Validate JSON format
  4. Load with --verbosity=3 for detailed errors

If migrations fail:

  1. Check .env DATABASE_URL is correct
  2. Verify PostgreSQL is running
  3. Check connection credentials
  4. Run: python manage.py showmigrations

═══════════════════════════════════════════════════════════

🎯 FINAL STEPS

1. ✅ Use current SQLite for local development
2. ✅ Create/restore users & data locally
3. ✅ Export clean data dump
4. ✅ Reset PostgreSQL on Render
5. ✅ Run migrations on production
6. ✅ Load data into PostgreSQL
7. ✅ Test thoroughly
8. ✅ Deploy frontend
9. ✅ Go live!

═══════════════════════════════════════════════════════════

Ready to proceed? Follow these steps in order!

