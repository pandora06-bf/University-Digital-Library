#!/bin/sh
set -eu

echo "[startup] Waiting for PostgreSQL..."
python - <<'PY'
import time
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from app.core.database import engine

last_error = None
for attempt in range(1, 31):
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        print("[startup] PostgreSQL is ready")
        break
    except SQLAlchemyError as exc:
        last_error = exc
        print(f"[startup] DB not ready ({attempt}/30), retrying in 2s...")
        time.sleep(2)
else:
    raise SystemExit(f"Database is not ready after 60s: {last_error}")
PY

echo "[startup] Applying Alembic migrations..."
python -m alembic upgrade head

echo "[startup] Ensuring ADMIN account..."
python -m app.bootstrap_admin

# Cloud: đặt RUN_SEEDER=true để nạp sách/tài khoản mẫu (chạy lại nhiều lần vẫn an toàn)
if [ "${RUN_SEEDER:-false}" = "true" ]; then
  echo "[startup] Seeding catalogue..."
  python database_seeder.py
fi

# Render cấp cổng qua $PORT; máy local giữ 8000 và --reload như cũ (UVICORN_RELOAD=false trên cloud)
PORT="${PORT:-8000}"
RELOAD_FLAG="--reload"
if [ "${UVICORN_RELOAD:-true}" = "false" ]; then
  RELOAD_FLAG=""
fi
echo "[startup] Starting FastAPI on container port ${PORT}..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" ${RELOAD_FLAG} --proxy-headers --forwarded-allow-ips="*"
