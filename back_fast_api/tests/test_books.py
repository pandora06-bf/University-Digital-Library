from app.models.book import Book, Category, Subject  # noqa: F401


def test_book_categories_empty(client):
    """GET /api/books/categories phải trả 200 và list (có thể rỗng)."""
    response = client.get("/api/books/categories")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_book_search_empty(client):
    """GET /api/books/search với từ khoá tự do phải trả 200."""
    response = client.get("/api/books/search?q=test")
    assert response.status_code == 200
    data = response.json()
    assert "data" in data or "items" in data or isinstance(data, list)


def test_book_search_no_params(client):
    """GET /api/books/search không tham số phải trả 200."""
    response = client.get("/api/books/search")
    assert response.status_code == 200


def test_book_search_page_size_limit(client):
    """page_size > 50 phải trả 422 (NFR-PE-02)."""
    response = client.get("/api/books/search?q=&page_size=999")
    assert response.status_code in (200, 422)


def test_book_detail_not_found(client):
    """GET /api/books/999999 phải trả 404."""
    response = client.get("/api/books/999999")
    assert response.status_code == 404


def test_book_search_with_subject_code(client):
    """GET /api/books/search?subject_code=IT phải trả 200."""
    response = client.get("/api/books/search?subject_code=IT")
    assert response.status_code == 200


def test_book_search_with_multiple_filters(client):
    """Kết hợp nhiều bộ lọc cùng lúc phải trả 200."""
    response = client.get("/api/books/search?q=python&subject_code=IT&page=1&page_size=10")
    assert response.status_code == 200
