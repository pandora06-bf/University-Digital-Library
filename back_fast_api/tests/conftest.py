import sys
from pathlib import Path

# Đảm bảo thư mục gốc của backend luôn nằm trong sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.expression import BinaryExpression


@compiles(TSVECTOR, "sqlite")
def _compile_tsvector_sqlite(element, compiler, **kw):
    return "TEXT"


@compiles(BinaryExpression, "sqlite")
def _compile_binary_sqlite(binary, compiler, **kw):
    if getattr(binary.operator, "opstring", None) == "@@":
        return "1 = 1"
    return compiler.visit_binary(binary, **kw)


from app.main import app
from app.core.database import get_db
from app.core.security import hash_password, create_access_token
from app.models import Account, Base, User

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(engine, "connect")
def _set_sqlite_custom_functions(dbapi_connection, connection_record):
    dbapi_connection.create_function("to_tsvector", -1, lambda *args: "")
    dbapi_connection.create_function("plainto_tsquery", -1, lambda *args: "")
    dbapi_connection.create_function("to_tsquery", -1, lambda *args: "")
    dbapi_connection.create_function("ts_rank_cd", -1, lambda *args: 1.0)


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def _local_pdf_storage(monkeypatch):
    """Không test nào được chạm vào kho Cloudflare R2 thật, kể cả khi máy chạy test có STORAGE_BACKEND=r2.
    Test R2 (test_r2_storage.py) tự bật lại r2 với client giả trong bộ nhớ."""
    monkeypatch.setenv("STORAGE_BACKEND", "local")


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def test_account(db_session):
    account = Account(
        username="testuser",
        password=hash_password("Password123@"),
        role="STUDENT",
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    user = User(
        account_id=account.id,
        user_code="SV2026001",
        full_name="Nguyễn Văn Test",
        email="testuser@library.local",
        department="Khoa Công nghệ thông tin",
        user_type="STUDENT",
        max_borrow_limit=3,
        max_borrow_days=14,
        is_borrowing_blocked=False,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    return account


@pytest.fixture
def auth_headers(test_account):
    token = create_access_token(
        {"sub": str(test_account.id), "role": test_account.role.strip().upper()}
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_account(db_session):
    account = Account(
        username="admin_test",
        password=hash_password("Admin@123"),
        role="ADMIN",
        is_active=True,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    user = User(
        account_id=account.id,
        user_code="ADMIN-TEST",
        full_name="Quản trị Test",
        email="admintest@library.local",
        department="Thư viện",
        user_type="ADMIN",
        max_borrow_limit=0,
        max_borrow_days=0,
    )
    db_session.add(user)
    db_session.commit()
    return account


@pytest.fixture
def admin_headers(admin_account):
    token = create_access_token(
        {"sub": str(admin_account.id), "role": "ADMIN"}
    )
    return {"Authorization": f"Bearer {token}"}
