from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Library Management System"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/library_db"
    SECRET_KEY: str = "change-this-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # Môi trường chạy: "dev" bật API giả lập nạp tiền.
    APP_ENV: str = "dev"
    # Tài khoản dịch vụ / VietQR (3-09.a)
    BANK_BIN: str = "970422"  # MB Bank
    BANK_ACCOUNT_NO: str = "0000000000"
    BANK_ACCOUNT_NAME: str = "THU VIEN DAI HOC"
    VIETQR_TEMPLATE: str = "compact2"
    BANK_WEBHOOK_KEY: str = "change-this-webhook-key"
    TOPUP_MIN_AMOUNT: int = 10_000
    TOPUP_MAX_AMOUNT: int = 500_000
    TOPUP_EXPIRE_MINUTES: int = 15

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
