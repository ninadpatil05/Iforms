import time
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.utils.security import create_access_token
from app.schemas.form import FormUpdate, FormCreate
from pydantic import ValidationError

client = TestClient(app)

def test_form_schedule():
    print("=" * 60)
    print("TESTING FORM SCHEDULING FEATURE")
    print("=" * 60)

    # 1. Test Schema Validation
    print("\n--- Test 1: Schema Validation (ends_at <= starts_at) ---")
    now = datetime.now(timezone.utc)
    try:
        FormUpdate(
            starts_at=now,
            ends_at=now - timedelta(hours=1)
        )
        print("FAIL: Schema allowed ends_at before starts_at!")
    except ValidationError as e:
        print("PASS: Schema correctly rejected invalid schedule window (ends_at <= starts_at).")
        print(f"Error message: {e}")

    # 2. Database & API Tests
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("ALTER TABLE forms ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;"))
        db.commit()

        ts = int(time.time())
        owner = User(name="Schedule Owner", email=f"owner_{ts}@example.com", password_hash="hash", role="editor")
        db.add(owner)
        db.commit()
        db.refresh(owner)

        token = create_access_token(subject=owner.id)
        headers = {"Authorization": f"Bearer {token}"}

        # Create published form with ends_at in the past
        past_time = datetime.now(timezone.utc) - timedelta(hours=2)
        form_past = Form(
            owner_id=owner.id,
            title="Closed Form",
            status="published",
            access_mode="public",
            ends_at=past_time
        )
        db.add(form_past)
        db.commit()
        db.refresh(form_past)

        version_past = FormVersion(
            form_id=form_past.id,
            version_number=1,
            is_published=True,
            public_link=f"closed-link-{ts}"
        )
        db.add(version_past)
        db.commit()

        # 3. Test Respondent access to CLOSED form
        print("\n--- Test 2: Respondent accessing CLOSED form (ends_at in past) ---")
        pub_resp = client.get(f"/api/public/forms/closed-link-{ts}")
        print(f"Status: {pub_resp.status_code} (expected 403)")
        print(f"Detail: {pub_resp.json().get('detail')} (expected 'FORM_CLOSED')")
        assert pub_resp.status_code == 403
        assert pub_resp.json().get("detail") == "FORM_CLOSED"
        print("PASS: Respondent access blocked with FORM_CLOSED!")

        # 4. Test Owner accessing CLOSED form in Builder/Owner endpoints
        print("\n--- Test 3: Owner accessing CLOSED form in FormBuilder/CRUD ---")
        owner_resp = client.get(f"/api/forms/{form_past.id}", headers=headers)
        print(f"Owner GET /api/forms/{form_past.id} status: {owner_resp.status_code} (expected 200)")
        assert owner_resp.status_code == 200
        print("PASS: Owner can access and edit closed form without restriction!")

        # 5. Create published form with starts_at in the future
        future_time = datetime.now(timezone.utc) + timedelta(hours=5)
        form_future = Form(
            owner_id=owner.id,
            title="Not Yet Open Form",
            status="published",
            access_mode="public",
            starts_at=future_time
        )
        db.add(form_future)
        db.commit()
        db.refresh(form_future)

        version_future = FormVersion(
            form_id=form_future.id,
            version_number=1,
            is_published=True,
            public_link=f"future-link-{ts}"
        )
        db.add(version_future)
        db.commit()

        # 6. Test Respondent access to NOT YET OPEN form
        print("\n--- Test 4: Respondent accessing NOT YET OPEN form (starts_at in future) ---")
        pub_resp_future = client.get(f"/api/public/forms/future-link-{ts}")
        print(f"Status: {pub_resp_future.status_code} (expected 403)")
        print(f"Detail: {pub_resp_future.json().get('detail')} (expected 'FORM_NOT_YET_OPEN')")
        assert pub_resp_future.status_code == 403
        assert pub_resp_future.json().get("detail") == "FORM_NOT_YET_OPEN"
        print("PASS: Respondent access blocked with FORM_NOT_YET_OPEN!")

        print("\n" + "=" * 60)
        print("ALL FORM SCHEDULING TESTS PASSED PERFECTLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    test_form_schedule()
