"""Gọi Gemini generateContent, nhận và trả cùng dạng dữ liệu với Claude để service.py dùng chung."""
from types import SimpleNamespace

import httpx

from app.core.config import settings

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
BLOCKED = {"SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"}


class _Content(list):
    """Khối nội dung dạng Claude, kèm parts gốc của Gemini (có thoughtSignature phải gửi lại)."""

    def __init__(self, blocks, parts, call_ids):
        super().__init__(blocks)
        self.parts = parts
        self.call_ids = call_ids  # id nội bộ -> (tên công cụ, id của Gemini hoặc None)


def _declaration(tool: dict) -> dict:
    result = {"name": tool["name"], "description": tool["description"]}
    schema = tool["input_schema"]
    if schema["properties"]:  # Gemini không nhận object rỗng và không có additionalProperties
        result["parameters"] = {k: v for k, v in schema.items() if k != "additionalProperties"}
    return result


def _contents(messages: list) -> list:
    contents, call_ids = [], {}
    for message in messages:
        content = message["content"]
        if isinstance(content, _Content):
            call_ids = content.call_ids
            contents.append({"role": "model", "parts": content.parts})
        elif isinstance(content, str):
            role = "model" if message["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": content}]})
        else:  # kết quả công cụ, giữ đúng thứ tự mô hình đã gọi
            parts = []
            for item in content:
                name, gemini_id = call_ids[item["tool_use_id"]]
                key = "error" if item.get("is_error") else "result"
                response = {"name": name, "response": {key: item["content"]}}
                if gemini_id:
                    response["id"] = gemini_id
                parts.append({"functionResponse": response})
            contents.append({"role": "user", "parts": parts})
    return contents


def _parse(data: dict):
    candidates = data.get("candidates") or []
    if not candidates:
        if (data.get("promptFeedback") or {}).get("blockReason"):
            return SimpleNamespace(stop_reason="refusal", content=[])
        raise ValueError("Gemini không trả về câu trả lời")
    candidate = candidates[0]
    if candidate.get("finishReason") in BLOCKED:
        return SimpleNamespace(stop_reason="refusal", content=[])
    parts = (candidate.get("content") or {}).get("parts") or []
    blocks, call_ids = [], {}
    for part in parts:
        call = part.get("functionCall")
        if call:
            block_id = call.get("id") or f"call-{len(call_ids)}"
            call_ids[block_id] = (call["name"], call.get("id"))
            blocks.append(SimpleNamespace(type="tool_use", id=block_id, name=call["name"],
                                          input=call.get("args") or {}))
        elif part.get("text") and not part.get("thought"):
            blocks.append(SimpleNamespace(type="text", text=part["text"]))
    return SimpleNamespace(stop_reason="tool_use" if call_ids else "end_turn",
                           content=_Content(blocks, parts, call_ids))


def create_message(*, system: list, tools: list, messages: list, max_tokens: int):
    key = settings.GEMINI_API_KEY.strip()
    if not key:
        raise ValueError("Chưa điền GEMINI_API_KEY")
    response = httpx.post(
        URL.format(model=settings.GEMINI_MODEL),
        headers={"x-goog-api-key": key},  # khóa để trong header, không để trên URL
        json={
            "systemInstruction": {"parts": [{"text": block["text"]} for block in system]},
            "contents": _contents(messages),
            "tools": [{"functionDeclarations": [_declaration(t) for t in tools]}],
            "generationConfig": {"maxOutputTokens": max_tokens},
        },
        timeout=60.0,
    )
    response.raise_for_status()
    return _parse(response.json())
