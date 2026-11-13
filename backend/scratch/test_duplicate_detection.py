import time
from fastapi.testclient import TestClient
from app.main import app
from app.database.database import SessionLocal
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.field import Field
from app.models.submission import Submission
from app.models.response_value import ResponseValue
from app.utils.security import create_access_token
from sqlalchemy import text

client = TestClient(app)

def test_duplicate_detection():
    print("=" * 60)
    print("TESTING DUPLICATE RESPONSE DETECTION FEATURE")
    print("=" * 60)

    db = SessionLocal()
    try:
        # Run DB migration for existing Postgres DB
        db.execute(text("ALTER TABLE forms ADD COLUMN IF NOT EXISTS duplicate_check_field_id INTEGER REFERENCES fields(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS duplicate_policy VARCHAR(20) NOT NULL DEFAULT 'allow';"))
        db.commit()

        ts = int(time.time())
        owner = User(name="Dup Owner", email=f"dupowner_{ts}@example.com", password_hash="hash", role="editor")
        db.add(owner)
        db.commit()
        db.refresh(owner)

        # 1. Form with BLOCK policy
        form_block = Form(
            owner_id=owner.id,
            title="Block Dup Form",
            status="published",
            access_mode="public",
            duplicate_policy="block"
        )
        db.add(form_block)
        db.commit()
        db.refresh(form_block)

        version_block = FormVersion(
            form_id=form_block.id,
            version_number=1,
            is_published=True,
            public_link=f"block-link-{ts}"
        )
        db.add(version_block)
        db.commit()
        db.refresh(version_block)

        email_field = Field(
            form_version_id=version_block.id,
            label="Email Address",
            field_type="email",
            required=True,
            display_order=0
        )
        db.add(email_field)
        db.commit()
        db.refresh(email_field)

        # Link duplicate_check_field_id on form
        form_block.duplicate_check_field_id = email_field.id
        db.commit()

        # --- Test 1: First Submission (should succeed 200) ---
        print("\n--- Test 1: First Submission on BLOCK policy form ---")
        sub1 = Submission(form_version_id=version_block.id, status="in_progress")
        db.add(sub1)
        db.commit()
        db.refresh(sub1)

        rv1 = ResponseValue(submission_id=sub1.id, field_id=email_field.id, value_text="user@example.com")
        db.add(rv1)
        db.commit()

        res1 = client.post(f"/api/submissions/{sub1.id}/submit")
        print(f"Sub 1 Status: {res1.status_code} (expected 200)")
        assert res1.status_code == 200
        print("PASS: First submission succeeded!")

        # --- Test 2: Second Submission with same email (should return 409 DUPLICATE_BLOCKED) ---
        print("\n--- Test 2: Second Submission with same email on BLOCK policy form ---")
        sub2 = Submission(form_version_id=version_block.id, status="in_progress")
        db.add(sub2)
        db.commit()
        db.refresh(sub2)

        rv2 = ResponseValue(submission_id=sub2.id, field_id=email_field.id, value_text="  USER@EXAMPLE.COM  ")
        db.add(rv2)
        db.commit()

        res2 = client.post(f"/api/submissions/{sub2.id}/submit")
        print(f"Sub 2 Status: {res2.status_code} (expected 409)")
        print(f"Sub 2 Detail: {res2.json().get('detail')}")
        assert res2.status_code == 409
        detail = res2.json().get("detail")
        assert detail.get("code") == "DUPLICATE_BLOCKED"
        assert detail.get("duplicate_field_id") == email_field.id
        print("PASS: Second submission correctly BLOCKED with 409 DUPLICATE_BLOCKED!")

        # --- Test 3: WARN policy form ---
        print("\n--- Test 3: Submission on WARN policy form ---")
        form_warn = Form(
            owner_id=owner.id,
            title="Warn Dup Form",
            status="published",
            access_mode="public",
            duplicate_policy="warn"
        )
        db.add(form_warn)
        db.commit()
        db.refresh(form_warn)

        version_warn = FormVersion(
            form_id=form_warn.id,
            version_number=1,
            is_published=True,
            public_link=f"warn-link-{ts}"
        )
        db.add(version_warn)
        db.commit()
        db.refresh(version_warn)

        field_warn = Field(
            form_version_id=version_warn.id,
            label="Email Address",
            field_type="email",
            required=True,
            display_order=0
        )
        db.add(field_warn)
        db.commit()
        db.refresh(field_warn)

        form_warn.duplicate_check_field_id = field_warn.id
        db.commit()

        # First sub on warn form
        sub_w1 = Submission(form_version_id=version_warn.id, status="in_progress")
        db.add(sub_w1)
        db.commit()
        db.refresh(sub_w1)
        rv_w1 = ResponseValue(submission_id=sub_w1.id, field_id=field_warn.id, value_text="warn@example.com")
        db.add(rv_w1)
        db.commit()

        res_w1 = client.post(f"/api/submissions/{sub_w1.id}/submit")
        print(f"Warn Sub 1 Status: {res_w1.status_code}, duplicate_warning: {res_w1.json().get('duplicate_warning')}")
        assert res_w1.status_code == 200
        assert res_w1.json().get("duplicate_warning") is None

        # Second sub on warn form (duplicate email)
        sub_w2 = Submission(form_version_id=version_warn.id, status="in_progress")
        db.add(sub_w2)
        db.commit()
        db.refresh(sub_w2)
        rv_w2 = ResponseValue(submission_id=sub_w2.id, field_id=field_warn.id, value_text="warn@example.com")
        db.add(rv_w2)
        db.commit()

        res_w2 = client.post(f"/api/submissions/{sub_w2.id}/submit")
        print(f"Warn Sub 2 Status: {res_w2.status_code}, duplicate_warning: {res_w2.json().get('duplicate_warning')}")
        assert res_w2.status_code == 200
        assert res_w2.json().get("duplicate_warning") is True
        print("PASS: Second submission on WARN form succeeded with duplicate_warning: True!")

        print("\n" + "=" * 60)
        print("ALL DUPLICATE RESPONSE DETECTION TESTS PASSED PERFECTLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    test_duplicate_detection()
