"""Giới hạn số lượt chat, lưu trong bộ nhớ (đúng khi API chạy một tiến trình, như cấu hình hiện tại)."""
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

from app.core.config import settings

MINUTE = 60
DAY = 24 * 60 * 60
_hits = defaultdict(deque)
_lock = Lock()


def reset() -> None:
    with _lock:
        _hits.clear()


def _count(queue: deque, now: float, window: int) -> int:
    return sum(1 for t in queue if now - t < window)


def check(key: str, signed_in: bool, now: float | None = None) -> None:
    """Ghi nhận một lượt; vượt giới hạn thì trả 429 và không ghi."""
    now = time.monotonic() if now is None else now
    per_day = settings.CHAT_DAILY_LIMIT_USER if signed_in else settings.CHAT_DAILY_LIMIT_GUEST
    with _lock:
        for name in (key, "*"):
            queue = _hits[name]
            while queue and now - queue[0] >= DAY:
                queue.popleft()
        if _count(_hits[key], now, MINUTE) >= settings.CHAT_RATE_PER_MINUTE:
            raise HTTPException(429, "Bạn đang hỏi quá nhanh, vui lòng chờ một phút")
        if len(_hits[key]) >= per_day:
            raise HTTPException(429, "Bạn đã hết lượt hỏi trợ lý trong hôm nay")
        if len(_hits["*"]) >= settings.CHAT_DAILY_LIMIT_TOTAL:
            raise HTTPException(429, "Trợ lý đã hết lượt trong hôm nay, vui lòng quay lại sau")
        _hits[key].append(now)
        _hits["*"].append(now)
