import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath('.'))

from app.database.database import Base
from app.database import base

from app.models.user import User
from app.models.form import Form
from app.schemas.form import FormCreate
from app.services.form_service import form_service
from app.services.form_version_service import form_version_service
from app.services.field_service import field_service
from app.services.section_service import section_service

# Setup in-memory SQLite database
engine = create_engine("sqlite:///:memory:", echo=False)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)

def main():
    db = TestingSessionLocal()
    try:
        # 1. Create a user
        user = User(
            name="Test User",
            email="testuser@example.com",
            password_hash="hashed_pw_here",
            role="author",
        )


        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"[PASS] User created with ID: {user.id}")

        # 2. Create a new form
        form_in = FormCreate(title="Brand New Form", description="Testing form creation", owner_id=user.id)
        form = form_service.create_form(db, form_in)
        print(f"[PASS] Form created with ID: {form.id}, status: {form.status}")

        # 3. Get or create draft version (simulating GET /api/forms/{form_id}/current-version)
        version = form_service.get_or_create_draft_version(db, form.id)
        print(f"[PASS] Current version fetched/created with ID: {version.id}, version_number: {version.version_number}")

        # 4. List fields and sections for version
        fields = field_service.get_fields_by_version(db, version.id)
        sections = section_service.get_sections_by_version(db, version.id)
        print(f"[PASS] Fields list retrieved ({len(fields)} fields)")
        print(f"[PASS] Sections list retrieved ({len(sections)} sections)")

        print("\nSUCCESS: All new form builder endpoints executed cleanly without errors!")

    except Exception as e:
        print(f"[FAIL] Exception occurred: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    main()
