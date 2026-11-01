
import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger(__name__)


def register_exception_handlers(app):

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        translations = {
            400: "Yêu cầu không hợp lệ",
            401: "Không thể xác thực thông tin đăng nhập",
            403: "Bạn không có quyền thực hiện thao tác này",
            404: "Không tìm thấy tài nguyên yêu cầu",
            405: "Phương thức HTTP không được hỗ trợ",
            409: "Dữ liệu bị trùng hoặc xung đột",
            422: "Dữ liệu không hợp lệ, vui lòng kiểm tra lại",
            429: "Bạn đã gửi quá nhiều yêu cầu",
        }

        detail = exc.detail

        english_messages = {
            "Not Found",
            "Could not validate credentials",
            "Not authenticated",
            "Forbidden",
            "Method Not Allowed",
            "Unauthorized",
        }

        if (
            isinstance(detail, str)
            and detail.strip()
            and detail not in english_messages
        ):
            message = detail
        else:
            message = translations.get(
                exc.status_code,
                "Yêu cầu không thể thực hiện"
            )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error_code": f"HTTP_{exc.status_code}",
                "message": message,
                "detail": message,
            },
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        message = "Dữ liệu không hợp lệ, vui lòng kiểm tra lại"

        return JSONResponse(
            status_code=422,
            content={
                "error_code": "VALIDATION_ERROR",
                "message": message,
                "detail": message,
            },
        )

    @app.exception_handler(IntegrityError)
    async def integrity_error(request: Request, exc: IntegrityError):
        log.warning("Database integrity violation: %s", exc)

        message = "Dữ liệu bị trùng hoặc xung đột"

        return JSONResponse(
            status_code=409,
            content={
                "error_code": "DATA_CONFLICT",
                "message": message,
                "detail": message,
            },
        )

    @app.exception_handler(Exception)
    async def internal_error(request: Request, exc: Exception):
        log.exception(
            "Unhandled error path=%s",
            request.url.path,
        )

        message = "Hệ thống gặp sự cố, vui lòng thử lại sau"

        return JSONResponse(
            status_code=500,
            content={
                "error_code": "INTERNAL_ERROR",
                "message": message,
                "detail": message,
            },
        )
