from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Library Management System"
    DATABASE_URL: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/library_db"
    SECRET_KEY: str = "change-this-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120

    # Bật API giả lập nạp tiền (/api/dev/topups/{pay_code}/simulate). Mặc định tắt.
    ENABLE_DEV_SIMULATE: bool = False
    # Tài khoản dịch vụ / VietQR (3-09.a)
    BANK_BIN: str = "970422"  # MB Bank
    BANK_ACCOUNT_NO: str = "VQRQANOHG3714"
    BANK_ACCOUNT_NAME: str = "NGUYEN THI DIEU HIEN"
    VIETQR_TEMPLATE: str = "compact2"
    BANK_WEBHOOK_KEY: str = "whsec_nwcTZOSG4xA1mtao8ByoJWiRt5dFtrT9"
    TOPUP_MIN_AMOUNT: int = 10_000
    TOPUP_MAX_AMOUNT: int = 500_000
    TOPUP_EXPIRE_MINUTES: int = 15
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_SSL: bool = False
    SMTP_STARTTLS: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
