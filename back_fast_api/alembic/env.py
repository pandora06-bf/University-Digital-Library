import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# 1. Thêm đường dẫn gốc của project vào sys.path để Alembic import được package app
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..")))

# 2. Import Base chứa metadata của toàn bộ các bảng trong app/models
from app.models import Base

# 3. Import chuỗi kết nối Database từ cấu hình core (nếu có)
try:
    from app.core.database import DATABASE_URL
except ImportError:
    DATABASE_URL = "postgresql://neondb_owner:npg_hZw7X9qJxyaQ@ep-lively-dust-az52zyiq-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Ghi đè URL trong alembic.ini bằng biến môi trường DATABASE_URL (nếu có)
if DATABASE_URL:
    config.set_main_option("sqlalchemy.url", DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 4. Gán metadata của các Model vào target_metadata
target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
