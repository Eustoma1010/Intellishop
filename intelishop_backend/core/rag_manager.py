"""
RAG Manager — Quản lý FAISS vector index realtime.

Tự động cập nhật FAISS index khi sản phẩm thay đổi (tạo/sửa/xoá)
thay vì yêu cầu chạy thủ công `python setup_rag.py`.

Cách hoạt động:
  1. Khi server khởi động → load index từ file (nếu có) hoặc rebuild.
  2. Django signal post_save / post_delete trên Product → đánh dấu dirty.
  3. Rebuild chạy trong background thread với debounce (tránh spam API).
  4. views.py gọi get_faiss_index() để lấy index mới nhất (thread-safe).
"""

import logging
import threading
import time
from pathlib import Path

import faiss
import numpy as np

logger = logging.getLogger(__name__)

# ── Cấu hình ──
_REBUILD_DEBOUNCE_SECONDS = 5        # Đợi 5s sau thay đổi cuối cùng rồi mới rebuild
_EMBED_SLEEP_SECONDS = 0.3           # Khoảng cách giữa các lần gọi Gemini Embedding API
_INDEX_FILENAME = 'product_vectors.index'

# ── State nội bộ (thread-safe qua Lock) ──
_lock = threading.Lock()
_faiss_index = None                   # FAISS IndexIDMap hiện tại
_dirty = False                        # Có cần rebuild không?
_rebuild_timer = None                 # Timer debounce
_is_rebuilding = False                # Đang rebuild?


def _get_index_path():
    """Đường dẫn tuyệt đối tới file FAISS index."""
    return str(Path(__file__).resolve().parent.parent / _INDEX_FILENAME)


def _load_index_from_disk():
    """Load FAISS index từ file nếu tồn tại."""
    global _faiss_index
    index_path = _get_index_path()
    try:
        if Path(index_path).exists():
            _faiss_index = faiss.read_index(index_path)
            logger.info(f"✅ RAG: Đã load FAISS index từ {index_path} ({_faiss_index.ntotal} vectors)")
        else:
            logger.warning(f"RAG: Không tìm thấy {index_path} — sẽ tự động rebuild.")
            _faiss_index = None
    except Exception as e:
        logger.error(f"RAG: Lỗi load FAISS index: {e}")
        _faiss_index = None


def get_faiss_index():
    """Lấy FAISS index hiện tại (thread-safe). Dùng trong views.py."""
    with _lock:
        return _faiss_index


def mark_dirty():
    """
    Đánh dấu index cần rebuild.
    Gọi hàm này mỗi khi Product thay đổi (signal hoặc thủ công).
    Sử dụng debounce: chờ _REBUILD_DEBOUNCE_SECONDS giây sau thay đổi cuối.
    """
    global _dirty, _rebuild_timer
    _dirty = True

    # Cancel timer cũ nếu có (debounce)
    if _rebuild_timer is not None:
        _rebuild_timer.cancel()

    _rebuild_timer = threading.Timer(_REBUILD_DEBOUNCE_SECONDS, _trigger_rebuild)
    _rebuild_timer.daemon = True
    _rebuild_timer.start()


def _trigger_rebuild():
    """Kích hoạt rebuild trong background thread."""
    global _dirty
    if not _dirty:
        return
    _dirty = False
    thread = threading.Thread(target=rebuild_index, daemon=True)
    thread.start()


def rebuild_index():
    """
    Rebuild toàn bộ FAISS index từ database.
    Chạy trong background thread — KHÔNG block request.
    """
    global _faiss_index, _is_rebuilding

    with _lock:
        if _is_rebuilding:
            logger.info("RAG: Đang rebuild, bỏ qua yêu cầu trùng.")
            return
        _is_rebuilding = True

    try:
        logger.info("🔄 RAG: Bắt đầu rebuild FAISS index...")

        # Import ở đây để tránh circular import
        from core.models import Product
        import google.generativeai as genai

        products = list(
            Product.objects.select_related('category')
            .filter(is_deleted=False)
            .exclude(status=Product.STATUS_HIDDEN)
        )

        if not products:
            logger.warning("RAG: Không có sản phẩm nào để index.")
            with _lock:
                _faiss_index = None
                _is_rebuilding = False
            return

        embeddings = []
        product_ids = []

        for p in products:
            category_name = p.category.name if p.category else 'Khác'
            description_snippet = (p.description or '')[:200]
            text = (
                f"Tên sản phẩm: {p.name}. "
                f"Danh mục: {category_name}. "
                f"Giá: {p.price}₫. "
                f"Tồn kho: {p.stock}. "
                f"{f'Mô tả: {description_snippet}. ' if description_snippet else ''}"
            )
            try:
                result = genai.embed_content(
                    model="models/gemini-embedding-2-preview",
                    content=text,
                    task_type="retrieval_document",
                )
                embeddings.append(result['embedding'])
                product_ids.append(p.id)
                time.sleep(_EMBED_SLEEP_SECONDS)
            except Exception as e:
                logger.error(f"RAG: Lỗi embed sản phẩm '{p.name}' (ID={p.id}): {e}")

        if not embeddings:
            logger.warning("RAG: Không tạo được vector nào.")
            with _lock:
                _is_rebuilding = False
            return

        # Build FAISS index mới
        dimension = len(embeddings[0])
        base_index = faiss.IndexFlatL2(dimension)
        new_index = faiss.IndexIDMap(base_index)
        new_index.add_with_ids(
            np.array(embeddings).astype('float32'),
            np.array(product_ids).astype('int64'),
        )

        # Ghi file + swap vào bộ nhớ (atomic swap)
        index_path = _get_index_path()
        faiss.write_index(new_index, index_path)

        with _lock:
            _faiss_index = new_index

        logger.info(f"✅ RAG: Rebuild hoàn tất — {len(product_ids)} sản phẩm, lưu tại {index_path}")

    except Exception as e:
        logger.error(f"RAG: Lỗi rebuild index: {e}")
    finally:
        with _lock:
            _is_rebuilding = False


def initialize():
    """
    Gọi một lần khi server khởi động.
    Load index từ file, nếu không có thì rebuild ngay.
    """
    _load_index_from_disk()
    if _faiss_index is None:
        # Rebuild trong background để không block server startup
        threading.Thread(target=rebuild_index, daemon=True).start()

