"""Phiếu hỗ trợ: gửi, giới hạn, quyền xem, trả lời."""
from app.routers import support_router
from app.services.email_notifier import context_base, render_template
from tests.test_physical_loan import _make_reader

QUESTION = {"summary": "Tôi nạp tiền nhưng chưa được cộng vào ví."}


def _send(client, headers, body=QUESTION):
    return client.post("/api/support/tickets", json=body, headers=headers)


def test_guest_cannot_send(client):
    assert _send(client, {}).status_code == 401


def test_reader_sees_only_own_tickets(client, db_session):
    _, mine = _make_reader(db_session, user_code="SP0001")
    _, other = _make_reader(db_session, user_code="SP0002")
    assert _send(client, mine).status_code == 201
    assert _send(client, other, {"summary": "Câu hỏi của người khác nhé"}).status_code == 201

    data = client.get("/api/support/tickets/my", headers=mine).json()["data"]

    assert [t["summary"] for t in data] == [QUESTION["summary"]]
    assert "user_code" not in data[0]


def test_summary_length_and_daily_limit(client, db_session):
    _, headers = _make_reader(db_session, user_code="SP0003")
    assert _send(client, headers, {"summary": "   ngắn   "}).status_code == 422
    codes = [_send(client, headers).status_code for _ in range(4)]
    assert codes == [201, 201, 201, 429]


def test_reader_cannot_use_admin_routes(client, db_session):
    _, headers = _make_reader(db_session, user_code="SP0004")
    ticket = _send(client, headers).json()

    assert client.get("/api/admin/support/tickets", headers=headers).status_code == 403
    reply = client.post(f"/api/admin/support/tickets/{ticket['id']}/reply",
                        json={"reply": "x"}, headers=headers)
    assert reply.status_code == 403


def test_librarian_replies_once_and_reader_sees_it(client, db_session, admin_headers, monkeypatch):
    sent = []
    monkeypatch.setattr(support_router, "send_support_reply", lambda *args: sent.append(args))
    _, headers = _make_reader(db_session, user_code="SP0005")
    ticket = _send(client, headers).json()

    listed = client.get("/api/admin/support/tickets", headers=admin_headers).json()
    assert listed["total"] == 1 and listed["data"][0]["user_code"] == "SP0005"

    url = f"/api/admin/support/tickets/{ticket['id']}/reply"
    response = client.post(url, json={"reply": "Đã cộng tiền cho bạn."}, headers=admin_headers)
    assert response.status_code == 200 and response.json()["status"] == "ANSWERED"
    assert client.post(url, json={"reply": "Lần hai"}, headers=admin_headers).status_code == 409
    assert len(sent) == 1

    mine = client.get("/api/support/tickets/my", headers=headers).json()["data"][0]
    assert mine["reply"] == "Đã cộng tiền cho bạn."
    assert client.get("/api/admin/support/tickets", headers=admin_headers).json()["total"] == 0


def test_reply_missing_ticket_is_404(client, admin_headers):
    response = client.post("/api/admin/support/tickets/999/reply", json={"reply": "x"}, headers=admin_headers)
    assert response.status_code == 404


def test_reply_email_escapes_content():
    html = render_template("support_reply.html", **context_base("An"), ticket_id=1,
                           summary="<script>alert(1)</script>", reply="Chào bạn",
                           account_url="http://localhost:5173/account")
    assert "<script>" not in html and "Chào bạn" in html
