from app.routers.waitlist_router import router as waitlist_router
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import auth, books, loans, users
from app.routers.admin_book_router import router as admin_book_router
from app.routers.admin_category_router import router as admin_category_router
from app.routers.admin_inventory_router import router as admin_inventory_router
from app.services.upload_service import COVERS_DIR, EBOOKS_DIR
from app.routers.admin_counter_router import router as admin_counter_router
from app.routers.waitlist_router import router as waitlist_router
from app.routers.wallet_router import router as wallet_router
from app.routers.webhook_router import router as webhook_router
from app.routers.admin_user_import_router import router as admin_user_import_router
from app.routers.room_booking_router import router as room_booking_router
from app.routers.fine_wallet_router import router as fine_wallet_router
from app.routers.admin_incident_router import router as admin_incident_router
from app.core.exception_handlers import register_exception_handlers

app = FastAPI(
    title="Library Management API",
    description="Backend API for Library Management System",
    version="1.0.0",
)

register_exception_handlers(app)

# Có thể cấu hình từ biến môi trường FRONTEND_ORIGINS (phân tách bằng dấu phẩy).
# Giá trị mặc định hỗ trợ cả Vite 5173 và cổng riêng 5174 của bản Nhất.
def _frontend_origins() -> list[str]:
    raw = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Phục vụ ảnh bìa và PDF eBook qua URL tĩnh.
app.mount("/static/covers", StaticFiles(directory=COVERS_DIR), name="covers")
# Private ebooks are only served through authenticated stream routes, never mounted publicly.

app.include_router(auth.router)
app.include_router(books.router)
app.include_router(users.router)
app.include_router(loans.router)
app.include_router(admin_book_router)
app.include_router(admin_category_router)
app.include_router(admin_inventory_router)
app.include_router(admin_counter_router)
app.include_router(waitlist_router)
app.include_router(wallet_router)
app.include_router(webhook_router)
<<<<<<< HEAD
=======
app.include_router(fines_router)
app.include_router(admin_user_import_router)
app.include_router(room_booking_router)
app.include_router(fine_wallet_router)
app.include_router(admin_incident_router)
>>>>>>> origin/main


@app.get("/")
def root():
    return {
        "message": "Library Management Backend API is running",
        "docs": "/docs",
    }


@app.get("/health")
def health_check():
    return {"status": "ok"}
<<<<<<< HEAD

from app.routers.admin_user_import_router import router as admin_user_import_router
from app.routers.room_booking_router import router as room_booking_router
from app.routers.fine_wallet_router import router as fine_wallet_router
from app.routers.admin_incident_router import router as admin_incident_router
app.include_router(admin_user_import_router)
app.include_router(room_booking_router)
app.include_router(fine_wallet_router)
app.include_router(admin_incident_router)

from app.routers.admin_user_router import router as admin_user_router
app.include_router(admin_user_router)
=======
>>>>>>> origin/main
