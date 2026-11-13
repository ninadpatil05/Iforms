import os
import time
from datetime import datetime, timedelta, timezone
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

def run_verification():
    results = {}
    db = SessionLocal()
    ts = int(time.time())

    try:
        # Create User A (Owner) and User B (Attacker/Other user)
        user_a = User(name="User A", email=f"usera_{ts}@example.com", password_hash="hash", role="editor")
        user_b = User(name="User B", email=f"userb_{ts}@example.com", password_hash="hash", role="editor")
        db.add_all([user_a, user_b])
        db.commit()
        db.refresh(user_a)
        db.refresh(user_b)

        headers_a = {"Authorization": f"Bearer {create_access_token(subject=user_a.id)}"}
        headers_b = {"Authorization": f"Bearer {create_access_token(subject=user_b.id)}"}

        # -------------------------------------------------------------
        # TEST 1: Scheduling (ends_at in past)
        # -------------------------------------------------------------
        print("\n--- TEST 1: Scheduling (Closed Form) ---")
        past_time = datetime.now(timezone.utc) - timedelta(days=2)
        form_closed = Form(
            owner_id=user_a.id,
            title="Closed Form",
            status="published",
            access_mode="public",
            ends_at=past_time
        )
        db.add(form_closed)
        db.commit()
        db.refresh(form_closed)

        ver_closed = FormVersion(
            form_id=form_closed.id,
            version_number=1,
            is_published=True,
            public_link=f"closed-link-{ts}"
        )
        db.add(ver_closed)
        db.commit()
        db.refresh(ver_closed)

        # Respondent trying to access public form -> 403 FORM_CLOSED
        res_pub = client.get(f"/api/public/forms/closed-link-{ts}")
        print(f"Public access to closed form: status={res_pub.status_code}, detail={res_pub.json().get('detail')}")
        assert res_pub.status_code == 403
        assert res_pub.json().get("detail") == "FORM_CLOSED"

        # Owner trying to get/edit form details -> 200 OK (Owner is never blocked)
        res_owner = client.get(f"/api/forms/{form_closed.id}", headers=headers_a)
        print(f"Owner access to closed form: status={res_owner.status_code}")
        assert res_owner.status_code == 200

        results["1. Scheduling (Closed Form)"] = "PASS"

        # -------------------------------------------------------------
        # TEST 2: Duplicate Policy "allow" (default)
        # -------------------------------------------------------------
        print("\n--- TEST 2: Duplicate Policy 'allow' ---")
        form_allow = Form(
            owner_id=user_a.id,
            title="Allow Form",
            status="published",
            access_mode="public",
            duplicate_policy="allow"
        )
        db.add(form_allow)
        db.commit()
        db.refresh(form_allow)

        ver_allow = FormVersion(
            form_id=form_allow.id,
            version_number=1,
            is_published=True,
            public_link=f"allow-link-{ts}"
        )
        db.add(ver_allow)
        db.commit()
        db.refresh(ver_allow)

        field_allow = Field(form_version_id=ver_allow.id, label="Email", field_type="email", required=True, display_order=0)
        db.add(field_allow)
        db.commit()
        db.refresh(field_allow)

        form_allow.duplicate_check_field_id = field_allow.id
        db.commit()

        # Submit 1
        sub_a1 = Submission(form_version_id=ver_allow.id, status="in_progress")
        db.add(sub_a1)
        db.commit()
        db.refresh(sub_a1)
        db.add(ResponseValue(submission_id=sub_a1.id, field_id=field_allow.id, value_text="same@example.com"))
        db.commit()
        r_a1 = client.post(f"/api/submissions/{sub_a1.id}/submit")
        assert r_a1.status_code == 200

        # Submit 2 (Same email)
        sub_a2 = Submission(form_version_id=ver_allow.id, status="in_progress")
        db.add(sub_a2)
        db.commit()
        db.refresh(sub_a2)
        db.add(ResponseValue(submission_id=sub_a2.id, field_id=field_allow.id, value_text="same@example.com"))
        db.commit()
        r_a2 = client.post(f"/api/submissions/{sub_a2.id}/submit")
        print(f"Sub 1: {r_a1.status_code}, Sub 2: {r_a2.status_code}")
        assert r_a2.status_code == 200
        assert r_a2.json().get("duplicate_warning") is None

        results["2. Duplicate Policy 'allow'"] = "PASS"

        # -------------------------------------------------------------
        # TEST 3: Duplicate Policy "warn"
        # -------------------------------------------------------------
        print("\n--- TEST 3: Duplicate Policy 'warn' ---")
        form_warn = Form(
            owner_id=user_a.id,
            title="Warn Form",
            status="published",
            access_mode="public",
            duplicate_policy="warn"
        )
        db.add(form_warn)
        db.commit()
        db.refresh(form_warn)

        ver_warn = FormVersion(
            form_id=form_warn.id,
            version_number=1,
            is_published=True,
            public_link=f"warn-link-{ts}"
        )
        db.add(ver_warn)
        db.commit()
        db.refresh(ver_warn)

        field_warn = Field(form_version_id=ver_warn.id, label="Email", field_type="email", required=True, display_order=0)
        db.add(field_warn)
        db.commit()
        db.refresh(field_warn)

        form_warn.duplicate_check_field_id = field_warn.id
        db.commit()

        # Submit 1
        sub_w1 = Submission(form_version_id=ver_warn.id, status="in_progress")
        db.add(sub_w1)
        db.commit()
        db.refresh(sub_w1)
        db.add(ResponseValue(submission_id=sub_w1.id, field_id=field_warn.id, value_text="warn@example.com"))
        db.commit()
        r_w1 = client.post(f"/api/submissions/{sub_w1.id}/submit")
        assert r_w1.status_code == 200

        # Submit 2 (Same email)
        sub_w2 = Submission(form_version_id=ver_warn.id, status="in_progress")
        db.add(sub_w2)
        db.commit()
        db.refresh(sub_w2)
        db.add(ResponseValue(submission_id=sub_w2.id, field_id=field_warn.id, value_text="warn@example.com"))
        db.commit()
        r_w2 = client.post(f"/api/submissions/{sub_w2.id}/submit")
        print(f"Sub 1: {r_w1.status_code}, Sub 2: {r_w2.status_code}, Warning: {r_w2.json().get('duplicate_warning')}")
        assert r_w2.status_code == 200
        assert r_w2.json().get("duplicate_warning") is True

        results["3. Duplicate Policy 'warn'"] = "PASS"

        # -------------------------------------------------------------
        # TEST 4: Duplicate Policy "block" + Approval and Denial
        # -------------------------------------------------------------
        print("\n--- TEST 4: Duplicate Policy 'block' (Approval & Denial) ---")
        form_block = Form(
            owner_id=user_a.id,
            title="Block Form",
            status="published",
            access_mode="public",
            duplicate_policy="block"
        )
        db.add(form_block)
        db.commit()
        db.refresh(form_block)

        ver_block = FormVersion(
            form_id=form_block.id,
            version_number=1,
            is_published=True,
            public_link=f"block-link-{ts}"
        )
        db.add(ver_block)
        db.commit()
        db.refresh(ver_block)

        field_block = Field(form_version_id=ver_block.id, label="Email", field_type="email", required=True, display_order=0)
        db.add(field_block)
        db.commit()
        db.refresh(field_block)

        form_block.duplicate_check_field_id = field_block.id
        db.commit()

        # Submit 1 (original)
        sub_b1 = Submission(form_version_id=ver_block.id, status="in_progress")
        db.add(sub_b1)
        db.commit()
        db.refresh(sub_b1)
        db.add(ResponseValue(submission_id=sub_b1.id, field_id=field_block.id, value_text="blocked@example.com"))
        db.commit()
        assert client.post(f"/api/submissions/{sub_b1.id}/submit").status_code == 200

        # --- Test 4A: Approve Flow ---
        sub_b2 = Submission(form_version_id=ver_block.id, status="in_progress")
        db.add(sub_b2)
        db.commit()
        db.refresh(sub_b2)
        db.add(ResponseValue(submission_id=sub_b2.id, field_id=field_block.id, value_text="blocked@example.com"))
        db.commit()

        r_b2 = client.post(f"/api/submissions/{sub_b2.id}/submit")
        assert r_b2.status_code == 409

        # Request override
        req_res = client.post(f"/api/submissions/{sub_b2.id}/request-duplicate-override")
        assert req_res.status_code == 201
        req_id = req_res.json()["id"]

        # Check dev_emails directory for email file
        dev_email_files = os.listdir("dev_emails") if os.path.exists("dev_emails") else []
        print(f"Dev emails created: {len(dev_email_files)} files present")

        # Owner approves request
        app_res = client.post(f"/api/duplicate-override-requests/{req_id}/approve", headers=headers_a)
        assert app_res.status_code == 200
        assert app_res.json()["status"] == "approved"

        # Respondent retries submission -> 200 OK
        r_b2_retry = client.post(f"/api/submissions/{sub_b2.id}/submit")
        assert r_b2_retry.status_code == 200

        # --- Test 4B: Deny Flow ---
        sub_b3 = Submission(form_version_id=ver_block.id, status="in_progress")
        db.add(sub_b3)
        db.commit()
        db.refresh(sub_b3)
        db.add(ResponseValue(submission_id=sub_b3.id, field_id=field_block.id, value_text="blocked@example.com"))
        db.commit()

        assert client.post(f"/api/submissions/{sub_b3.id}/submit").status_code == 409

        req_deny_res = client.post(f"/api/submissions/{sub_b3.id}/request-duplicate-override")
        assert req_deny_res.status_code == 201
        req_deny_id = req_deny_res.json()["id"]

        deny_res = client.post(f"/api/duplicate-override-requests/{req_deny_id}/deny", headers=headers_a)
        assert deny_res.status_code == 200
        assert deny_res.json()["status"] == "denied"

        # Respondent retries submission -> still blocked (409)
        r_b3_retry = client.post(f"/api/submissions/{sub_b3.id}/submit")
        assert r_b3_retry.status_code == 409
        print(f"Deny Flow retry status: {r_b3_retry.status_code} (still blocked)")

        results["4. Duplicate Policy 'block' (Approve & Deny)"] = "PASS"

        # -------------------------------------------------------------
        # TEST 5: Ownership Security Checks
        # -------------------------------------------------------------
        print("\n--- TEST 5: Ownership Security Checks ---")

        # User B attempts to list override requests for User A's form
        list_b = client.get(f"/api/forms/{form_block.id}/duplicate-override-requests", headers=headers_b)
        print(f"User B list requests status: {list_b.status_code}")
        assert list_b.status_code in (403, 404)

        # User B attempts to approve User A's request
        approve_b = client.post(f"/api/duplicate-override-requests/{req_id}/approve", headers=headers_b)
        print(f"User B approve request status: {approve_b.status_code}")
        assert approve_b.status_code in (403, 404)

        # User B attempts to deny User A's request
        deny_b = client.post(f"/api/duplicate-override-requests/{req_id}/deny", headers=headers_b)
        print(f"User B deny request status: {deny_b.status_code}")
        assert deny_b.status_code in (403, 404)

        results["5. Ownership Security Checks"] = "PASS"

        # -------------------------------------------------------------
        # TEST 6: Regression Check (Standard Form)
        # -------------------------------------------------------------
        print("\n--- TEST 6: Regression Check ---")
        form_std = Form(
            owner_id=user_a.id,
            title="Standard Form",
            status="published",
            access_mode="public"
        )
        db.add(form_std)
        db.commit()
        db.refresh(form_std)

        ver_std = FormVersion(
            form_id=form_std.id,
            version_number=1,
            is_published=True,
            public_link=f"std-link-{ts}"
        )
        db.add(ver_std)
        db.commit()
        db.refresh(ver_std)

        f_std = Field(form_version_id=ver_std.id, label="Name", field_type="text", required=True, display_order=0)
        db.add(f_std)
        db.commit()
        db.refresh(f_std)

        sub_std = Submission(form_version_id=ver_std.id, status="in_progress")
        db.add(sub_std)
        db.commit()
        db.refresh(sub_std)
        db.add(ResponseValue(submission_id=sub_std.id, field_id=f_std.id, value_text="Alice"))
        db.commit()

        r_std = client.post(f"/api/submissions/{sub_std.id}/submit")
        print(f"Standard submission status: {r_std.status_code}")
        assert r_std.status_code == 200

        results["6. Regression Check"] = "PASS"

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    for test_name, status in results.items():
        print(f"{test_name:<45}: {status}")
    print("=" * 60)

if __name__ == "__main__":
    run_verification()
