# Intelishop AGENTS.md
AI coding agents working in this codebase should understand these essential patterns and workflows.
## Architecture Overview
**Intelishop** is a multi-store e-commerce platform with AI-powered product recommendations. It follows a decoupled architecture:
- **Backend**: Django REST API (Python) � handles data, authentication, orders, and AI chatbot
- **Frontend**: Vanilla JavaScript (HTML/CSS) � Glassmorphism UI with real-time cart management
- **Data Layer**: SQLite (local) + PostgreSQL (production via `dj_database_url`)
- **AI Integration**: Google Gemini API for personalized product recommendations + edge-tts for speech synthesis
- **Storage**: Cloudinary CDN for images (models: User, Store, Product, Order, OrderItem, Category, Address, Wishlist)
**Critical Insight**: The system uses RAG (Retrieval-Augmented Generation) with FAISS vector indexing (`product_vectors.index`) to retrieve contextually relevant products before feeding them to Gemini. This prevents hallucination and ensures product recommendations match actual inventory.
## Specific Patterns & Conventions
### 1. Authentication (Multi-Path Model)
**Email-based authentication** replaces username (configured in `core/models.py`):
```python
# User model uses CustomUserManager with email as USERNAME_FIELD
User.objects.create_user(email='user@example.com', password='pass')
# Social auth (Google/Facebook) via allauth:
# - If user exists: auto-login via JWT
# - If new user: trigger social_auth_complete to collect additional info
# - Unused passwords set via set_unusable_password() for social-only accounts
```
**Role model** (added in `core/models.py`):
- `User.role` values: `CUSTOMER` (default), `VENDOR`, `SHIPPER`, `ADMIN`
- `POST /api/register/` always creates `CUSTOMER` (only needs `name`, `email`, `password`)
- Never expose admin signup in frontend; create admins with `python manage.py createsuperuser`

**Partner onboarding flow**:
- Customer submits seller form → `POST /api/apply/vendor/` → creates `VendorApplication(status='pending')`
- Customer submits shipper form → `POST /api/apply/shipper/` → creates `ShipperApplication(status='pending')`
- Admin reviews in Django Admin and approves:
  - Vendor approve: set `User.role='VENDOR'` and `Store.objects.update_or_create(owner=user, ...)`
  - Shipper approve: set `User.role='SHIPPER'`
- Client can poll `GET /api/apply/status/?email=` for latest application status

**JWT Token Flow**: 
- `ACCESS_TOKEN_LIFETIME: 1 day` | `REFRESH_TOKEN_LIFETIME: 7 days`
- Stored in cookies (`intelishop-auth`, `intelishop-refresh-token`)
- Always use `RefreshToken.for_user(user)` in auth endpoints
### 2. RAG + AI Chatbot Architecture
The `chat_with_ai` view implements a specific pattern:
```
User Query → retrieve_relevant_products() (FAISS search + Gemini embeddings)
           → Inject product context into Gemini prompt
           → Parse JSON action (none|add_to_cart|checkout)
           → Generate speech audio via edge-tts (Vietnamese Neural Voice)
           → Return: {bot_reply, action, audio_url (base64 MP3)}
```
**Critical Requirements**:
- FAISS index is managed by `core/rag_manager.py` — **auto-rebuilds** when products change via Django signals (`post_save`/`post_delete` on Product model, debounced 5s)
- On server startup, `rag_manager.initialize()` loads existing `product_vectors.index` from disk or triggers background rebuild
- `views.py` calls `rag_manager.get_faiss_index()` (thread-safe) instead of a static global
- `setup_rag.py` still works as standalone script for initial data migration or manual rebuild
- Django Admin has "🔄 Rebuild AI Index" action on Products for manual trigger
- Gemini chat model: `gemini-3.1-flash-lite-preview` (configured in `model = genai.GenerativeModel()`)
- Embedding model: `models/gemini-embedding-2-preview` (used in both `retrieve_relevant_products()` and `rag_manager.py`)
- Gemini prompt must enforce JSON response format — wrap in `json.loads()` after removing markdown backticks with regex: `re.sub(r'```json\n|\n```', '', response.text)`
- Speech synthesis uses `edge-tts` with Vietnamese neural voice (`vi-VN-HoaiMyNeural`) at `+20%` rate via async: `asyncio.new_event_loop()` in `generate_audio_safe()`
- Always call `clean_text_for_speech()` to strip markdown before audio generation (regex: `re.sub(r'[*#_]', '', text)`)
- Audio returned as base64-encoded data URI: `data:audio/mp3;base64,{encoded_bytes}`
### 3. Database Indexing & Query Optimization
**Performance conventions** baked into models:
- `db_index=True` on frequently filtered fields: `Category.name`, `Product.name`, `Product.price`, `Order.status`, `Order.created_at`
- Use `prefetch_related()` to avoid N+1 queries: `Store.objects.prefetch_related('products__category')`
- Use `select_related()` for foreign keys: `Product.objects.select_related('category')`
- Bulk operations: `OrderItem.objects.bulk_create([...])` instead of loop-save
**Image URL Patching**: Products stored via Cloudinary may have double-path (`/media/media/`). The `get_store_data` view corrects this automatically.
### 4. Order Management Flow
Orders follow this structure (migration `0002`):
```
Order (order_code #IS1xxx, user FK, shipping_address snapshot, total_amount, status, payment_method,
       shipping_fee, shop_voucher_discount, intellishop_voucher_discount, coin_used, insurance_fee, note)
  +- OrderItem[] (product FK nullable, product_name, variant, price, quantity)
```
**Checkout calculation** is always done server-side via `POST /api/checkout/calculate/` before calling `POST /api/order/`. Frontend passes `user_email`, `items`, discount fields; backend returns `{checkout: {subtotal, total_amount, coin_used, ...}}`.
**Status values**: `'Chờ duyệt'` (default), `'Đang giao'`, `'Hoàn thành'`, `'Hủy'`.
**Address snapshot**: `shipping_address` on Order is copied at order-time from `Address.full_address` to prevent data loss if user later edits addresses.
**Customer Address book** (`Address` model): `receiver_name`, `receiver_phone`, `full_address`, `is_default`. Saving with `is_default=True` automatically clears the flag from all other addresses for that user (handled in `Address.save()`).
**Wishlist** (`Wishlist` model): unique constraint on `(user, product)`. CRUD via `/api/wishlist/` and `/api/wishlist/<id>/`.
### 5. Frontend-Backend Communication
**API Endpoints** (all prefixed `/api/`):
- `POST /api/register/` → `DRF @api_view` returns JWT tokens + user info
- `POST /api/login/` → `@csrf_exempt` because frontend sends JSON (not form-data)
- `POST /api/apply/vendor/` → Submit vendor application (`pending` approval)
- `POST /api/apply/shipper/` → Submit shipper application (`pending` approval)
- `GET /api/apply/status/?email=` → Check latest vendor/shipper application status
- `POST /api/chat/` → Expects `message`, `user_name`, `cart_items` (form-data, not JSON)
- `POST /api/checkout/calculate/` → Expects `{user_email, items[], shop_voucher_discount, intellishop_voucher_discount, coin_used, shipping_fee, add_fashion_insurance}`. Returns `{checkout: {subtotal, total_amount, coin_used, ...}}`
- `POST /api/order/` → Expects JSON `{cart[], customer{}, user_email, total, payment_method, note, shipping_fee, ...discounts}`
- `GET /api/data/` → Returns `{storeInfo, storeProducts, hotDeals, categories}`
- `GET|PUT /api/profile/?email=` → Get/update user profile (`full_name`, `phone_number`, `gender`, `birth_date`, `intellishop_coin`)
- `GET /api/addresses/?email=` → List addresses for user
- `POST /api/addresses/` → Create address `{email, receiver_name, receiver_phone, full_address, is_default}`
- `PUT|DELETE /api/addresses/<id>/` → Update or delete address
- `GET /api/wishlist/?email=` → List wishlist items
- `POST /api/wishlist/` → Add to wishlist `{email, product_id}`
- `DELETE /api/wishlist/<id>/` → Remove wishlist item
- `POST /api/social-check/` → Expects `{email, name, provider, uid}` (JSON). Returns: if user exists `{action: 'login', tokens}`, else `{action: 'requires_info', temp_token}`
- `POST /api/social-complete/` → Expects `{temp_token, password}` (JSON). Completes social signup flow, returns JWT tokens
- `POST /api/user-orders/` → Expects `{email}` (JSON). Returns user's order history

**Social Auth Flow** (Google/Facebook via allauth):
1. Frontend calls `/api/social-check/` with social provider data
2. Backend checks if user exists:
   - **If exists**: Auto-login, return JWT tokens, set `SocialAccount` link
   - **If new**: Return `temp_token` (signed data, 15 min expiry) + redirect to info collection form
3. Frontend collects additional user info (password optional for social-only)
4. Frontend calls `/api/social-complete/` with `temp_token` + optional password
5. Backend creates user, links `SocialAccount`, returns JWT tokens

**Key Detail**: Frontend maintains `App.currentCategory` and `App.currentStore` as local state; server doesn't persist view state.

### 7. Frontend Architecture & Patterns
**JavaScript Module Structure** (ES6 Modules, `type="module"` in HTML):
```javascript
// config.js: Central configuration hub
export const API_BASE_URL = isLocalhost ? 'http://127.0.0.1:8000' : 'https://intelishop-backend.onrender.com';
export const App = { storeProducts, storeInfo, cart, isLoggedIn, ... }; // Global state
// Other modules: auth.js, cart.js, chatbot.js, store.js, ui.js
// Each module imports from config.js and exports functions that modify App state
```

**Frontend State Management**:
- Global `App` object in `config.js` holds all application state (cart, user, store data, etc.)
- New fields added: `App.addresses[]`, `App.wishlist[]`, `App.checkout{shopVoucherDiscount, intellishopVoucherDiscount, coinUsed, insuranceFee}`
- `App.currentUser` includes `intellishop_coin` field synced from `/api/profile/` on login
- All modules import `App` and modify it directly (no reducer pattern)
- UI updates via `element.innerHTML`, `classList` manipulation
- LocalStorage used for JWT tokens: `localStorage.setItem('access_token', token)`

**Auto-switching API Endpoints**:
- Detects localhost → uses `http://127.0.0.1:8000` (dev)
- Other hostnames → uses production URL `https://intelishop-backend.onrender.com`
- Configure in `config.js` or update `FRONTEND_URL` in backend `.env`

**Speech Recognition** (Web API):
- Uses `SpeechRecognition` (Chrome/Edge) + fallback to `webkitSpeechRecognition` (Safari)
- Language set to `vi-VN` for Vietnamese
- Handles interim results + continuous listening with silence timeout
- Sends recognized text to `/api/chat/` endpoint
### 6. Environment Configuration
**Required .env variables** (stored in `intelishop_backend/.env`, checked in `config/settings.py`):
```
SECRET_KEY (fallback: django-insecure-...)
DEBUG (default: True locally, False in production)
DATABASE_URL (default: SQLite, Render uses PostgreSQL)
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
GEMINI_API_KEY (Required for AI chatbot/RAG, no fallback)
FRONTEND_URL (for CORS, defaults to Vercel deployment)
ALLOWED_HOSTS (comma-separated domains, defaults to '*')
```
**Critical local dev note**: `DATABASE_URL` in `intelishop_backend/.env` must be an **absolute path** to avoid pointing at different SQLite files depending on working directory:
```
DATABASE_URL=sqlite:///D:/Self/WorkSpace/Web/Intelishop/intelishop_backend/db.sqlite3
```
**CORS**: `CORS_ALLOW_ALL_ORIGINS = True` globally (not restricted by domain in current config).
## Critical Workflows
### Development Server Startup
```bash
cd intelishop_backend
python -m venv venv
# Windows PowerShell:
venv\Scripts\Activate.ps1
# Windows CMD / macOS/Linux:
source venv/bin/activate  # or venv\Scripts\activate on Windows CMD
pip install -r requirements.txt
python manage.py migrate
# FAISS index auto-builds on server startup (via rag_manager.initialize())
# Optional manual rebuild: python setup_rag.py
python manage.py runserver
```
### Admin Panel Access
```bash
python manage.py createsuperuser  # Create admin account
# Navigate to http://127.0.0.1:8000/admin/
# Key admin feature: ProductAdmin supports Excel import/export (ImportExportModelAdmin)
```
### Adding New Products at Scale
Use Django Admin's **import/export** feature for bulk uploads via Excel. Product model supports: `store`, `category`, `name`, `price`, `old_price`, `is_hot`, `image`.
### Image Synchronization
`sync_images.py` utility (in project root) handles Cloudinary image sync. Reference when implementing image management features.
## Integration Points & External Dependencies
| Dependency | Purpose | Key Config |
|---|---|---|
| `google-generativeai` | Gemini API for AI chatbot + embeddings | `GEMINI_API_KEY` env var; models: `gemini-3.1-flash-lite-preview` (chat), `models/gemini-embedding-2-preview` (RAG) |
| `faiss-cpu` | Vector search for product retrieval | Auto-managed by `core/rag_manager.py`; index file at `product_vectors.index`; auto-rebuilds via Django signals on Product changes |
| `edge-tts` | Vietnamese speech synthesis | Hardcoded voice: `vi-VN-HoaiMyNeural` at `+20%` rate; uses async event loop in `generate_audio_safe()` |
| `cloudinary` + `django-cloudinary-storage` | CDN for media files | Cloudinary credentials in .env |
| `django-allauth` | Social auth (Google/Facebook) | Callback URL hardcoded to localhost in `config/urls.py` (needs update for production) |
| `djangorestframework-simplejwt` | JWT token generation | Token lifetime: 1 day access, 7 days refresh; stored in cookies: `intelishop-auth`, `intelishop-refresh-token` |
| `django-import-export` | Excel import/export for products | ProductAdmin in `core/admin.py` extends `ImportExportModelAdmin` |
## Error Handling Patterns
- All views log errors via Python's `logging` module ? check terminal output
- AI-related failures gracefully degrade: if FAISS unavailable, chatbot returns "Hi?n chua c� s?n ph?m n�o"
- JSON parse errors from Gemini are caught and logged separately
- Order creation wrapped in `transaction.atomic()` to prevent partial data
## Testing & Validation
- **No automated tests** found in codebase (not a blocker for agents)
- Validate changes by:
  1. Running `python manage.py makemigrations && migrate` after model changes
  2. Testing auth flow manually via `/admin/` login
  3. Verifying chatbot via `/api/chat/` POST with sample message
  4. Checking Cloudinary image URLs in browser inspector (look for `/media/` paths)
---
**Last Updated**: March 2026 | **Version**: Django 5.0, Python 3.10+
