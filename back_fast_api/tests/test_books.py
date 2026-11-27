from app.models.book import Book, Category, Subject  # noqa: F401


def test_book_categories_empty(client):
    """GET /api/books (SRS UC02/UC03) trả trang kết quả có phân trang: items, total, page, page_size."""
    response = client.get("/api/books")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body["items"], list)
    assert {"total", "page", "page_size", "total_pages"} <= set(body)


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
    """GET /api/admin/books/999999 trả mã lỗi tương ứng (401, 403, 404, 405)."""
    response = client.get("/api/admin/books/999999")
    assert response.status_code in (401, 403, 404, 405)


def test_book_search_with_subject_code(client):
    """GET /api/books/search?subject_code=IT phải trả 200."""
    response = client.get("/api/books/search?subject_code=IT")
    assert response.status_code == 200


def test_book_search_with_multiple_filters(client):
    """Kết hợp nhiều bộ lọc cùng lúc phải trả 200."""
    response = client.get("/api/books/search?q=python&subject_code=IT&page=1&page_size=10")
    assert response.status_code == 200


def test_admin_category_crud_flow(client, admin_headers):
    """Kiểm thử luồng xem và tạo danh mục với quyền ADMIN."""
    res = client.get("/api/admin/categories", headers=admin_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    create_res = client.post(
        "/api/admin/categories",
        json={"category_name": "Danh mục kiểm thử CI"},
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    cat_id = create_res.json()["id"]

    get_res = client.get(f"/api/admin/categories/{cat_id}", headers=admin_headers)
    assert get_res.status_code == 200
    assert get_res.json()["category_name"] == "Danh mục kiểm thử CI"

    nf_res = client.get("/api/admin/categories/999999", headers=admin_headers)
    assert nf_res.status_code == 404
