# Intelishop AGENTS.md

AI coding agents working in this codebase should understand these essential patterns and workflows.

## Architecture Overview

**Intelishop** is a multi-store e-commerce platform with AI-powered product recommendations. It follows a decoupled architecture:

- **Backend**: Django REST API (Python) — handles data, authentication, orders, and AI chatbot
- **Frontend**: Vanilla JavaScript (HTML/CSS) — Glassmorphism UI with real-time cart management
- **Data Layer**: SQLite (local) + PostgreSQL (production via `dj_database_url`)
- **AI Integration**: Google Gemini API for personalized product recommendations + edge-tts for speech synthesis
- **Storage**: Cloudinary CDN for images (models: User, Store, Product, Order, OrderItem, Category)

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
- FAISS index must exist at `intelishop_backend/product_vectors.index` (created via `setup_rag.py`)
- Gemini prompt must enforce JSON response format — wrap in `json.loads()` after removing markdown backticks
- Speech synthesis uses `edge-tts` with Vietnamese neural voice (`vi-VN-HoaiMyNeural`) at `+20%` rate
- Always call `clean_text_for_speech()` to strip markdown before audio generation

### 3. Database Indexing & Query Optimization

**Performance conventions** baked into models:
- `db_index=True` on frequently filtered fields: `Category.name`, `Product.name`, `Product.price`, `Order.status`, `Order.created_at`
- Use `prefetch_related()` to avoid N+1 queries: `Store.objects.prefetch_related('products__category')`
- Use `select_related()` for foreign keys: `Product.objects.select_related('category')`
- Bulk operations: `OrderItem.objects.bulk_create([...])` instead of loop-save

**Image URL Patching**: Products stored via Cloudinary may have double-path (`/media/media/`). The `get_store_data` view corrects this automatically.

### 4. Order Management Flow

Orders always follow this structure:
```
Order (master record: order_code, customer_name/email/phone, shipping_address, total_amount, status)
  └─ OrderItem[] (product_name, price, quantity per line item)
```

**Status values** (from frontend conventions): 'Đã xác nhận' (default), and custom statuses. Admin panel manages status updates directly.

### 5. Frontend-Backend Communication

**API Endpoints** (all prefixed `/api/`):
- `POST /api/register/` → `DRF @api_view` returns JWT tokens + user info
- `POST /api/login/` → `@csrf_exempt` because frontend sends JSON (not form-data)
- `POST /api/chat/` → Expects `message`, `user_name`, `cart_items` (form-data, not JSON)
- `POST /api/order/` → Expects JSON `{cart[], customer{}, total}`
- `GET /api/data/` → Returns `{storeInfo, storeProducts, hotDeals, categories}`

**Key Detail**: Frontend maintains `App.currentCategory` and `App.currentStore` as local state; server doesn't persist view state.

### 6. Environment Configuration

**Required .env variables** (checked in `config/settings.py`):
```
SECRET_KEY (fallback: django-insecure-...)
DEBUG (default: True locally, False in production)
DATABASE_URL (default: SQLite, Render uses PostgreSQL)
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
GEMINI_API_KEY
FRONTEND_URL (for CORS, defaults to Vercel deployment)
ALLOWED_HOSTS
```

**CORS**: `CORS_ALLOW_ALL_ORIGINS = True` globally (not restricted by domain in current config).

## Critical Workflows

### Development Server Startup
```bash
cd intelishop_backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py setup_rag.py  # Initialize FAISS index (optional, chatbot disabled without it)
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
| `google-generativeai` | Gemini API for AI chatbot | `GEMINI_API_KEY` env var |
| `faiss-cpu` | Vector search for product retrieval | Index file at `product_vectors.index` |
| `edge-tts` | Vietnamese speech synthesis | Hardcoded voice: `vi-VN-HoaiMyNeural` |
| `cloudinary` + `django-cloudinary-storage` | CDN for media files | Cloudinary credentials in .env |
| `django-allauth` | Social auth (Google/Facebook) | Callback URL hardcoded to localhost (needs update for production) |
| `djangorestframework-simplejwt` | JWT token generation | Token lifetime: 1 day access, 7 days refresh |

## Error Handling Patterns

- All views log errors via Python's `logging` module → check terminal output
- AI-related failures gracefully degrade: if FAISS unavailable, chatbot returns "Hiện chưa có sản phẩm nào"
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

