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

client = TestClient(app)

def test_duplicate_override_flow():
    print("=" * 60)
    print("TESTING DUPLICATE OVERRIDE FLOW")
    print("=" * 60)

    db = SessionLocal()
    try:
        ts = int(time.time())
        owner = User(name="Override Owner", email=f"override_owner_{ts}@example.com", password_hash="hash", role="editor")
        db.add(owner)
        db.commit()
        db.refresh(owner)

        token = create_access_token(subject=owner.id)
        headers = {"Authorization": f"Bearer {token}"}

        # Create published form with BLOCK duplicate policy
        form = Form(
            owner_id=owner.id,
            title="Override Form",
            status="published",
            access_mode="public",
            duplicate_policy="block"
        )
        db.add(form)
        db.commit()
        db.refresh(form)

        version = FormVersion(
            form_id=form.id,
            version_number=1,
            is_published=True,
            public_link=f"override-link-{ts}"
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        email_field = Field(
            form_version_id=version.id,
            label="Email Address",
            field_type="email",
            required=True,
            display_order=0
        )
        db.add(email_field)
        db.commit()
        db.refresh(email_field)

        form.duplicate_check_field_id = email_field.id
        db.commit()

        # Step 1: First submission (user@example.com)
        sub1 = Submission(form_version_id=version.id, status="in_progress")
        db.add(sub1)
        db.commit()
        db.refresh(sub1)
        rv1 = ResponseValue(submission_id=sub1.id, field_id=email_field.id, value_text="user@example.com")
        db.add(rv1)
        db.commit()

        res1 = client.post(f"/api/submissions/{sub1.id}/submit")
        print(f"Sub 1 Status: {res1.status_code} (expected 200)")
        assert res1.status_code == 200

        # Step 2: Second submission (user@example.com) -> Blocked (409)
        sub2 = Submission(form_version_id=version.id, status="in_progress")
        db.add(sub2)
        db.commit()
        db.refresh(sub2)
        rv2 = ResponseValue(submission_id=sub2.id, field_id=email_field.id, value_text="user@example.com")
        db.add(rv2)
        db.commit()

        res2 = client.post(f"/api/submissions/{sub2.id}/submit")
        print(f"Sub 2 Status: {res2.status_code} (expected 409)")
        assert res2.status_code == 409

        # Step 3: Respondent requests duplicate override
        req_res = client.post(f"/api/submissions/{sub2.id}/request-duplicate-override")
        print(f"Request override status: {req_res.status_code} (expected 201)")
        print(f"Request body: {req_res.json()}")
        assert req_res.status_code == 201
        req_data = req_res.json()
        assert req_data["status"] == "pending"

        # Step 4: Respondent polls status -> pending
        status_res = client.get(f"/api/submissions/{sub2.id}/duplicate-override-status")
        print(f"Poll status: {status_res.json()} (expected status: pending)")
        assert status_res.json()["status"] == "pending"

        # Step 5: Owner lists pending requests for form
        list_res = client.get(f"/api/forms/{form.id}/duplicate-override-requests", headers=headers)
        print(f"Owner list requests status: {list_res.status_code}, count: {len(list_res.json())}")
        assert list_res.status_code == 200
        assert len(list_res.json()) == 1

        # Step 6: Owner approves request
        req_id = req_data["id"]
        approve_res = client.post(f"/api/duplicate-override-requests/{req_id}/approve", headers=headers)
        print(f"Owner approve status: {approve_res.status_code}, new status: {approve_res.json().get('status')}")
        assert approve_res.status_code == 200
        assert approve_res.json()["status"] == "approved"

        # Step 7: Respondent polls status -> approved
        status_res2 = client.get(f"/api/submissions/{sub2.id}/duplicate-override-status")
        print(f"Poll status after approval: {status_res2.json()} (expected status: approved)")
        assert status_res2.json()["status"] == "approved"

        # Step 8: Respondent re-submits second submission -> succeeds (200 OK)!
        res2_retry = client.post(f"/api/submissions/{sub2.id}/submit")
        print(f"Sub 2 Retry Status after approval: {res2_retry.status_code} (expected 200)")
        assert res2_retry.status_code == 200
        print("PASS: Approved override allowed duplicate submission to complete successfully!")

        print("\n" + "=" * 60)
        print("ALL DUPLICATE OVERRIDE FLOW TESTS PASSED PERFECTLY!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    test_duplicate_override_flow()
