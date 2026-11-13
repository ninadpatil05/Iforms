import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config.settings import settings

logger = logging.getLogger(__name__)

engine = create_engine(settings.DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def run_auto_migrations():
    """Ensure missing columns on existing tables are added cleanly across dialects."""
    from sqlalchemy import inspect, text
    try:
        inspector = inspect(engine)
        if "users" in inspector.get_table_names():
            user_columns = [c["name"] for c in inspector.get_columns("users")]
            with engine.connect() as conn:
                if "google_id" not in user_columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
                    try:
                        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"))
                    except Exception:
                        pass
                    conn.commit()
                # Ensure password_hash is nullable in Postgres if table was created with NOT NULL
                try:
                    conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
                    conn.commit()
                except Exception:
                    pass

        if "form_invites" in inspector.get_table_names():
            columns = [c["name"] for c in inspector.get_columns("form_invites")]
            with engine.connect() as conn:
                if "source" not in columns:
                    conn.execute(text("ALTER TABLE form_invites ADD COLUMN source VARCHAR(50) DEFAULT 'invite_ui'"))
                    conn.commit()
                if "status" not in columns:
                    conn.execute(text("ALTER TABLE form_invites ADD COLUMN status VARCHAR(50) DEFAULT 'pending'"))
                    conn.commit()
    except Exception as exc:
        logger.error(f"[AutoMigration Warning] Failed to run schema auto-migrations: {exc}", exc_info=True)