"""Gọi mô hình ngôn ngữ (Claude hoặc Gemini). Test thay hàm create_message bằng bản giả."""
import logging
from functools import lru_cache

from app.core.config import settings
from app.services.chat import gemini_client

log = logging.getLogger(__name__)

MAX_TOKENS = 4000
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class LLMUnavailable(Exception):
    """Không gọi được mô hình: thiếu khóa, thiếu thư viện, quá tải hoặc lỗi mạng."""


@lru_cache(maxsize=1)
def _client():
    import anthropic

    # Khóa trống thì để SDK tự tìm trong biến môi trường
    key = settings.ANTHROPIC_API_KEY.strip() or None
    return anthropic.Anthropic(api_key=key, timeout=60.0, max_retries=1)


def sends_personal_data() -> bool:
    """Gói miễn phí của Gemini cấm gửi dữ liệu cá nhân, nên server tự trả lời phần đó."""
    return settings.CHATBOT_PROVIDER != "gemini"


def create_message(*, system: list, tools: list, messages: list):
    try:
        if settings.CHATBOT_PROVIDER == "gemini":
            return gemini_client.create_message(system=system, tools=tools, messages=messages,
                                                max_tokens=MAX_TOKENS)
        return _client().beta.messages.create(
            model=settings.CHATBOT_MODEL,
            max_tokens=MAX_TOKENS,
            system=system,
            tools=tools,
            messages=messages,
            output_config={"effort": "low"},
            # Mô hình từ chối thì API tự chạy lại bằng mô hình dự phòng
            betas=[FALLBACK_BETA],
            fallbacks="default",
        )
    except Exception as exc:  # thiếu khóa/thư viện hoặc mọi lỗi của SDK
        log.exception("Chatbot không gọi được mô hình")
        raise LLMUnavailable() from exc
