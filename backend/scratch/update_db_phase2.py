"""update_db_phase2.py
Updates DB schema for Phase 2.
"""

from app.database.database import engine, Base
import app.models
from sqlalchemy import text

# Create new tables (like form_invites)
Base.metadata.create_all(bind=engine)

# Add new columns to existing forms table if they do not exist
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE forms ADD COLUMN IF NOT EXISTS access_mode VARCHAR(50) NOT NULL DEFAULT 'public';"))
    conn.execute(text("ALTER TABLE forms ADD COLUMN IF NOT EXISTS allow_resubmission BOOLEAN NOT NULL DEFAULT TRUE;"))
    conn.commit()

print("DB schema updated successfully for Phase 2!")
