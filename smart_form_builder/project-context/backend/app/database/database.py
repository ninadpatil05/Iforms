from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config.settings import settings

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
        print(f"[AutoMigration Warning] Failed to run schema auto-migrations: {exc}")