from sqlalchemy import inspect
from app.core.database import engine
from app.models import Base

# 1. Tạo toàn bộ bảng
print("Đang tạo bảng...")
Base.metadata.create_all(bind=engine)

# 2. Quét và in ra danh sách bảng trong Database
inspector = inspect(engine)
tables = inspector.get_table_names()

print("\n--- DANH SÁCH BẢNG HIỆN CÓ TRONG CƠ SỞ DỮ LIỆU ---")
for idx, table in enumerate(tables, start=1):
    print(f"{idx}. {table}")
print("--------------------------------------------------")