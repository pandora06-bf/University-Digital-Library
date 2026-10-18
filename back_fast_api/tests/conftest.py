import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

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
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


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
