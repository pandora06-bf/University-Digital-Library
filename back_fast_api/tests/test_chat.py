"""Chatbot: công cụ, quyền riêng tư, câu cố định, giới hạn lượt. Mô hình được thay bằng bản giả."""
import json
from datetime import datetime, timedelta
from types import SimpleNamespace

import httpx
import pytest

from app.core.config import settings
from app.models import Book, Loan, Waitlist
from app.services.chat import gemini_client, llm_client, rate_limit, service, tools
from tests.test_physical_loan import _make_book, _make_reader

APOLOGY = "Xin lỗi, hệ thống chưa có loại sách bạn muốn tìm."


def _text(value):
    return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text=value)])


def _call(name, **args):
    block = SimpleNamespace(type="tool_use", id=f"id-{name}", name=name, input=args)
    return SimpleNamespace(stop_reason="tool_use", content=[block])


@pytest.fixture(autouse=True)
def _chat_enabled(monkeypatch):
    monkeypatch.setattr(settings, "CHATBOT_ENABLED", True)
    monkeypatch.setattr(settings, "CHATBOT_PROVIDER", "claude")
    rate_limit.reset()
    yield
    rate_limit.reset()


@pytest.fixture
def model(monkeypatch):
    """Đặt sẵn các câu trả lời của mô hình; ghi lại mọi thứ server gửi đi."""
    state = SimpleNamespace(replies=[], requests=[])

    def fake(**kwargs):
        state.requests.append({**kwargs, "messages": list(kwargs["messages"])})
        return state.replies.pop(0)

    monkeypatch.setattr(llm_client, "create_message", fake)
    return state


def _ask(client, question="Gợi ý sách giúp tôi", headers=None, **extra):
    body = {"messages": [{"role": "user", "content": question}], **extra}
    return client.post("/api/chat", json=body, headers=headers or {})


def _tool_output(model):
    return json.loads(model.requests[-1]["messages"][-1]["content"][0]["content"])


def _loan(db, user, book, status="BORROWED", days=7):
    now = datetime.utcnow()
    loan = Loan(user_code=user.user_code, book_id=book.id, loan_type="PHYSICAL", loan_status=status,
                borrow_date=now, due_date=now + timedelta(days=days))
    db.add(loan)
    db.commit()
    return loan


def test_status_and_disabled_flag(client, model, monkeypatch):
    assert client.get("/api/chat/status").json() == {"enabled": True}
    monkeypatch.setattr(settings, "CHATBOT_ENABLED", False)
    assert client.get("/api/chat/status").json() == {"enabled": False}
    assert _ask(client).status_code == 404
    assert model.requests == []


def test_guest_gets_cards_built_from_database(client, db_session, model):
    book = _make_book(db_session, available_stock=2, title="Clean Code")
    model.replies = [_call("check_availability", book_ids=[book.id, 999]), _text("Đây là cuốn phù hợp.")]

    data = _ask(client).json()

    assert data["reply"] == "Đây là cuốn phù hợp."
    assert [card["title"] for card in data["books"]] == ["Clean Code"]
    assert data["books"][0]["copies_available"] == 2
    assert _tool_output(model)["not_in_library"] == [999]
    assert "Clean Code" in model.requests[0]["system"][0]["text"]


def test_availability_counts_holds_and_hides_borrower(client, db_session, model):
    borrower, _ = _make_reader(db_session, user_code="CB0001")
    holder, _ = _make_reader(db_session, user_code="CB0002")
    book = _make_book(db_session, available_stock=1)
    _loan(db_session, borrower, book)
    db_session.add(Waitlist(user_code=holder.user_code, book_id=book.id, queue_position=1,
                            status="HELD", hold_expires_at=datetime.utcnow() + timedelta(hours=5)))
    db_session.commit()
    model.replies = [_call("check_availability", book_ids=[book.id]), _text("Đang hết bản.")]

    _ask(client, "Cuốn này có ai mượn không?")

    output = _tool_output(model)
    assert output["books"][0]["is_borrowed_by_someone"] is True
    assert output["books"][0]["copies_available"] == 0
    sent = json.dumps(output) + model.requests[0]["system"][0]["text"]
    for secret in ("CB0001", "CB0002", "Physical Loan Tester", "@library.local"):
        assert secret not in sent


def test_inactive_book_is_never_shown(client, db_session, model):
    book = _make_book(db_session)
    book.is_active = False
    db_session.commit()
    model.replies = [_call("check_availability", book_ids=[book.id]), _text("Không có.")]

    assert _ask(client).json()["books"] == []


@pytest.mark.parametrize("language,expected", [
    ("vi", APOLOGY),
    ("en", "Sorry, the library does not have the type of book you are looking for."),
])
def test_no_match_returns_fixed_sentence(client, model, language, expected):
    model.replies = [_call("report_no_match", language=language)]

    data = _ask(client, "Có sách dạy nấu phở không?").json()

    assert data["reply"] == expected
    assert data["books"] == []
    assert len(model.requests) == 1


def test_guest_cannot_read_personal_info(client, model):
    model.replies = [_call("get_my_info")]

    data = _ask(client, "Tôi đang mượn gì?").json()

    assert data["needs_login"] is True
    assert data["actions"][0]["to"] == "/login"
    assert len(model.requests) == 1


def test_personal_info_needs_consent(client, db_session, model):
    _, headers = _make_reader(db_session, user_code="CB0003")
    model.replies = [_call("get_my_info")]

    data = _ask(client, "Tôi còn nợ không?", headers).json()

    assert data["needs_consent"] is True
    assert len(model.requests) == 1  # chưa có dữ liệu cá nhân nào được gửi đi


def test_personal_info_is_own_and_anonymous(client, db_session, model):
    me, headers = _make_reader(db_session, user_code="CB0004")
    other, _ = _make_reader(db_session, user_code="CB0005")
    mine = _make_book(db_session, title="Sách của tôi")
    theirs = _make_book(db_session, title="Sách của người khác")
    _loan(db_session, me, mine)
    _loan(db_session, other, theirs)
    model.replies = [_call("get_my_info"), _text("Bạn đang mượn 1 cuốn.")]

    _ask(client, "Tôi đang mượn gì?", headers, share_personal=True)

    output = _tool_output(model)
    assert [loan["title"] for loan in output["loans"]] == ["Sách của tôi"]
    sent = json.dumps(output, ensure_ascii=False)
    for secret in ("CB0004", "CB0005", "Physical Loan Tester", "@library.local", "người khác"):
        assert secret not in sent


def test_recommendations_skip_borrowed_books(client, db_session):
    me, _ = _make_reader(db_session, user_code="CB0006")
    read = _make_book(db_session, title="Đã đọc")
    similar = _make_book(db_session, title="Cùng tác giả")
    cancelled = _make_book(db_session, title="Đặt rồi hủy")
    _loan(db_session, me, read, status="RETURNED")
    _loan(db_session, me, cancelled, status="CANCELLED")

    result = tools.reading_recommendations(db_session, me.user_code)

    ids = [c["id"] for c in result["candidates"]]
    assert result["has_history"] is True
    assert read.id not in ids
    assert similar.id in ids and cancelled.id in ids
    assert result["previously_borrowed"] == [{"title": "Đã đọc", "subject_code": None}]


def test_recommendations_without_history_fall_back(db_session):
    me, _ = _make_reader(db_session, user_code="CB0007")
    _make_book(db_session)

    result = tools.reading_recommendations(db_session, me.user_code)

    assert result["has_history"] is False
    assert result["popular"]["books"]


def test_popular_books_orders_by_loans_without_counts(db_session):
    me, _ = _make_reader(db_session, user_code="CB0008")
    quiet = _make_book(db_session, title="Ít mượn")
    busy = _make_book(db_session, title="Nhiều mượn")
    for book in (quiet, busy):
        book.subject_code = "IT"
    db_session.commit()
    for _ in range(3):
        _loan(db_session, me, busy, status="RETURNED")

    result = tools.popular_books(db_session, "it")

    assert [b["id"] for b in result["books"]] == [busy.id, quiet.id]
    assert result["enough_borrowing_data_to_call_them_popular"] is False
    assert set(result["books"][0]) == {"id", "title"}
    assert tools.popular_books(db_session, "ECO")["books"] == []


def test_handoff_and_page_buttons(client, model):
    model.replies = [_call("suggest_librarian", summary="Tôi nạp tiền chưa được cộng"),
                     _call("open_page", page="topup"), _text("Bạn gửi cho thủ thư nhé.")]

    data = _ask(client, "Nạp tiền mà chưa thấy").json()

    assert data["handoff_summary"] == "Tôi nạp tiền chưa được cộng"
    assert data["actions"] == [{"to": "/account?topup=1", "label": "Nạp tiền"}]


def test_unknown_tool_does_not_crash(client, model):
    model.replies = [_call("drop_database"), _text("Tôi không làm được.")]

    assert _ask(client).status_code == 200
    assert model.requests[-1]["messages"][-1]["content"][0]["is_error"] is True


def test_refusal_and_endless_tool_loop(client, model):
    model.replies = [SimpleNamespace(stop_reason="refusal", content=[])]
    assert _ask(client).json()["reply"] == service.TEXT["refusal"]["vi"]

    model.replies = [_call("open_page", page="rooms") for _ in range(service.MAX_ROUNDS)]
    assert _ask(client).json()["reply"] == service.TEXT["failed"]["vi"]


def test_model_failure_returns_503(client, monkeypatch):
    def broken(**kwargs):
        raise llm_client.LLMUnavailable()

    monkeypatch.setattr(llm_client, "create_message", broken)
    response = _ask(client)
    assert response.status_code == 503
    assert "tạm nghỉ" in response.json()["detail"]


@pytest.mark.parametrize("messages", [
    [],
    [{"role": "assistant", "content": "x"}],
    [{"role": "user", "content": "   "}],
    [{"role": "user", "content": "x" * 1001}],
    [{"role": "system", "content": "x"}],
    [{"role": "user", "content": "x"}] * 13,
])
def test_invalid_conversations_are_rejected(client, model, messages):
    assert client.post("/api/chat", json={"messages": messages}).status_code == 422
    assert model.requests == []


def test_bad_token_is_401(client, model):
    assert _ask(client, headers={"Authorization": "Bearer abc"}).status_code == 401


def test_rate_limit_per_minute(client, model, monkeypatch):
    monkeypatch.setattr(settings, "CHAT_RATE_PER_MINUTE", 2)
    model.replies = [_text("1"), _text("2")]

    codes = [_ask(client).status_code for _ in range(3)]

    assert codes == [200, 200, 429]


def test_daily_limits(monkeypatch):
    monkeypatch.setattr(settings, "CHAT_DAILY_LIMIT_GUEST", 2)
    monkeypatch.setattr(settings, "CHAT_DAILY_LIMIT_TOTAL", 3)
    rate_limit.check("ip:a", False, now=0)
    rate_limit.check("ip:a", False, now=100)
    with pytest.raises(Exception, match="hết lượt hỏi"):
        rate_limit.check("ip:a", False, now=200)
    rate_limit.check("ip:b", False, now=200)
    with pytest.raises(Exception, match="Trợ lý đã hết lượt"):
        rate_limit.check("ip:c", False, now=300)
    rate_limit.check("ip:a", False, now=rate_limit.DAY + 200)


def test_llm_client_request_shape(monkeypatch):
    sent = {}
    fake = SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(
        create=lambda **kwargs: sent.update(kwargs) or "ok")))
    monkeypatch.setattr(llm_client, "_client", lambda: fake)

    assert llm_client.create_message(system=[], tools=[], messages=[]) == "ok"
    assert sent["model"] == settings.CHATBOT_MODEL
    assert sent["fallbacks"] == "default"
    assert "tool_choice" not in sent and "thinking" not in sent


def test_llm_client_wraps_errors(monkeypatch):
    def broken():
        raise RuntimeError("no key")

    monkeypatch.setattr(llm_client, "_client", broken)
    with pytest.raises(llm_client.LLMUnavailable):
        llm_client.create_message(system=[], tools=[], messages=[])


def test_tool_schemas_are_strict():
    for tool in tools.TOOLS:
        schema = tool["input_schema"]
        assert tool["strict"] and schema["additionalProperties"] is False
        assert schema["required"] == list(schema["properties"])


def test_guide_mentions_every_topic():
    guide = service.GUIDE_PATH.read_text(encoding="utf-8")
    for topic in ("Nạp tiền", "Mượn sách in", "eBook", "Đặt phòng", "Gia hạn", "Đặt trước", "Nợ phạt"):
        assert topic in guide
    assert "Admin@123" not in guide and "User@123" not in guide
    assert Book  # sách được đọc từ DB, không từ file hướng dẫn


def _gemini(monkeypatch, *replies):
    """Giả lập máy chủ Gemini; trả về danh sách yêu cầu đã gửi."""
    sent, queue = [], list(replies)

    def post(url, **kwargs):
        sent.append({"url": url, **json.loads(json.dumps(kwargs))})
        body = dict(queue.pop(0))
        return httpx.Response(body.pop("status", 200), json=body, request=httpx.Request("POST", url))

    monkeypatch.setattr(settings, "CHATBOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(gemini_client.httpx, "post", post)
    return sent


def _candidate(*parts, finish="STOP"):
    return {"candidates": [{"content": {"role": "model", "parts": list(parts)}, "finishReason": finish}]}


def test_gemini_tool_round_trip(client, db_session, monkeypatch):
    book = _make_book(db_session, title="Clean Code")
    call = {"functionCall": {"id": "g1", "name": "check_availability", "args": {"book_ids": [book.id]}},
            "thoughtSignature": "sig-1"}
    sent = _gemini(monkeypatch, _candidate(call), _candidate({"text": "Cuốn này phù hợp."}))

    data = _ask(client).json()

    assert data["reply"] == "Cuốn này phù hợp."
    assert [card["title"] for card in data["books"]] == ["Clean Code"]
    assert "test-key" not in sent[0]["url"] and sent[0]["headers"]["x-goog-api-key"] == "test-key"
    declarations = sent[0]["json"]["tools"][0]["functionDeclarations"]
    assert "additionalProperties" not in json.dumps(declarations)
    assert "parameters" not in next(d for d in declarations if d["name"] == "get_my_info")
    model_turn, result_turn = sent[1]["json"]["contents"][-2:]
    assert model_turn == {"role": "model", "parts": [call]}  # chữ ký được gửi lại nguyên vẹn
    response = result_turn["parts"][0]["functionResponse"]
    assert response["id"] == "g1" and "Clean Code" in response["response"]["result"]


@pytest.mark.parametrize("tool", ["get_my_info", "reading_recommendations"])
def test_gemini_never_receives_personal_data(client, db_session, monkeypatch, tool):
    me, headers = _make_reader(db_session, user_code="CB0009")
    read = _make_book(db_session, title="Đã mượn rồi")
    _make_book(db_session, title="Cùng tác giả")
    _loan(db_session, me, read)
    sent = _gemini(monkeypatch, _candidate({"functionCall": {"name": tool, "args": {}}}))

    data = _ask(client, "Thông tin của tôi", headers).json()

    assert len(sent) == 1  # không có lượt thứ hai mang dữ liệu cá nhân đi
    assert data["private"] is True and data["needs_consent"] is False
    if tool == "get_my_info":
        assert "Đã mượn rồi" in data["reply"] and "Số dư ví" in data["reply"]
    else:
        assert [card["title"] for card in data["books"]] == ["Cùng tác giả"]


@pytest.mark.parametrize("body", [
    {"promptFeedback": {"blockReason": "SAFETY"}},
    {"candidates": [{"finishReason": "SAFETY"}]},
])
def test_gemini_blocked_answer(client, monkeypatch, body):
    _gemini(monkeypatch, body)
    assert _ask(client).json()["reply"] == service.TEXT["refusal"]["vi"]


@pytest.mark.parametrize("body", [{"status": 429, "error": {}}, {}])
def test_gemini_errors_return_503(client, monkeypatch, body):
    _gemini(monkeypatch, body)
    assert _ask(client).status_code == 503


def test_gemini_without_key_returns_503(client, monkeypatch):
    monkeypatch.setattr(settings, "CHATBOT_PROVIDER", "gemini")
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert _ask(client).status_code == 503


def test_button_added_when_model_only_names_the_page(client, model):
    model.replies = [_text('Vào "Đặt phòng", chọn ngày rồi xác nhận.')]
    assert _ask(client, "Đặt phòng thế nào?").json()["actions"] == [{"to": "/rooms", "label": "Đặt phòng"}]


def test_english_question_asks_for_english_answer(client, model):
    model.replies = [_text("Open My books."), _text("Vâng.")]
    _ask(client, "How do I renew a book?")
    _ask(client, "Gia hạn sách thế nào?")
    assert model.requests[0]["system"][-1]["text"] == service.ENGLISH_NOTE
    assert len(model.requests[1]["system"]) == 1
