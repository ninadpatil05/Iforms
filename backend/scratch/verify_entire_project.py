import os
import sys
import time
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient

# Use an isolated test database file so running tests NEVER touches sql_app.db
os.environ["DATABASE_URL"] = "sqlite:///./test_runner.db"

from app.main import app
from app.database.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.submission import Submission
from app.models.response_value import ResponseValue
from app.utils.security import create_access_token

client = TestClient(app)

def run_master_verification():
    print("=" * 70)
    print("MASTER SYSTEM VERIFICATION SUITE — IFORMS PLATFORM")
    print("=" * 70)

    results = {}
    db = SessionLocal()
    ts = int(time.time())

    try:
        # -------------------------------------------------------------
        # 1. Database Schema & Tables Check
        # -------------------------------------------------------------
        print("\n[1/13] Testing Database Schema & Metadata...")
        Base.metadata.create_all(bind=engine)
        table_names = list(Base.metadata.tables.keys())
        expected_tables = [
            "users", "forms", "form_versions", "sections", "fields",
            "conditional_rules", "section_branch_rules", "submissions", "response_values",
            "form_views", "condition_groups", "form_invites", "scheduled_email_shares",
            "ai_form_drafts", "ai_analysis_reports", "duplicate_override_requests"
        ]
        missing = [t for t in expected_tables if t not in table_names]
        assert not missing, f"Missing tables: {missing}"
        results["1. Database Schema & Metadata"] = "PASS"

        # -------------------------------------------------------------
        # 2. Authentication & User Management
        # -------------------------------------------------------------
        print("[2/13] Testing Authentication & User Sign-up/Login...")
        reg_res = client.post("/api/auth/signup", json={
            "name": "Master Tester",
            "email": f"tester_{ts}@example.com",
            "password": "Password123!"
        })
        assert reg_res.status_code == 201, f"Register failed: {reg_res.text}"

        login_res = client.post("/api/auth/login", data={
            "username": f"tester_{ts}@example.com",
            "password": "Password123!"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token_a = login_res.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        user_me = client.get("/api/auth/me", headers=headers_a)
        assert user_me.status_code == 200
        user_a_id = user_me.json()["id"]

        # Create Attacker User B
        user_b = User(name="User B", email=f"user_b_{ts}@example.com", password_hash="hash", role="editor")
        db.add(user_b)
        db.commit()
        db.refresh(user_b)
        headers_b = {"Authorization": f"Bearer {create_access_token(subject=user_b.id)}"}

        results["2. Auth & User Token Management"] = "PASS"

        # -------------------------------------------------------------
        # 3. Form CRUD & Publishing Lifecycle
        # -------------------------------------------------------------
        print("[3/13] Testing Form CRUD & Publishing...")
        form_create_res = client.post("/api/forms/", json={
            "title": "Master Test Form",
            "description": "Form for verifying full platform integrity",
            "access_mode": "public"
        }, headers=headers_a)
        assert form_create_res.status_code == 201
        form_id = form_create_res.json()["id"]

        # Update title
        form_up = client.put(f"/api/forms/{form_id}", json={"title": "Master Test Form (Updated)"}, headers=headers_a)
        assert form_up.status_code == 200
        assert form_up.json()["title"] == "Master Test Form (Updated)"

        # Get initial draft version
        draft_ver = client.get(f"/api/forms/{form_id}/current-version", headers=headers_a).json()
        version_id = draft_ver["id"]

        # Add section and fields to draft
        sec_res = client.post("/api/sections/", json={
            "form_version_id": version_id,
            "title": "Personal Details",
            "display_order": 0
        }, headers=headers_a)
        assert sec_res.status_code == 201
        sec_id = sec_res.json()["id"]

        field_name = client.post("/api/fields/", json={
            "form_version_id": version_id,
            "section_id": sec_id,
            "label": "Full Name",
            "field_type": "text",
            "required": True,
            "display_order": 0
        }, headers=headers_a)
        assert field_name.status_code == 201
        name_field_id = field_name.json()["id"]

        field_email = client.post("/api/fields/", json={
            "form_version_id": version_id,
            "section_id": sec_id,
            "label": "Email Address",
            "field_type": "email",
            "required": True,
            "display_order": 1
        }, headers=headers_a)
        assert field_email.status_code == 201
        email_field_id = field_email.json()["id"]

        # Now publish Form
        pub_res = client.post(f"/api/forms/{form_id}/publish", headers=headers_a)
        assert pub_res.status_code == 200
        pub_data = pub_res.json()
        version_id = pub_data["form_version_id"]
        public_link = pub_data["public_link"]

        results["3. Form CRUD & Publishing Lifecycle"] = "PASS"
        results["4. Form Builder Engine"] = "PASS"

        # -------------------------------------------------------------
        # 5. Public Respondent Submission Flow
        # -------------------------------------------------------------
        print("[5/13] Testing Public Respondent Submission Flow...")
        get_pub = client.get(f"/api/public/forms/{public_link}")
        assert get_pub.status_code == 200

        sub_create = client.post("/api/submissions/", json={"form_version_id": version_id})
        assert sub_create.status_code == 201
        sub_id = sub_create.json()["id"]
        sub_token = sub_create.json()["access_token"]

        client.post("/api/response-values/", json={
            "submission_id": sub_id,
            "field_id": name_field_id,
            "value_text": "Alice"
        })
        save_val = client.post("/api/response-values/", json={
            "submission_id": sub_id,
            "field_id": email_field_id,
            "value_text": "respondent@example.com"
        })
        assert save_val.status_code == 201

        sub_comp = client.post(f"/api/submissions/{sub_id}/submit")
        if sub_comp.status_code != 200:
            print(f"sub_comp error status: {sub_comp.status_code}, text: {sub_comp.text}")
        assert sub_comp.status_code == 200

        results["5. Public Respondent Submission Flow"] = "PASS"

        # -------------------------------------------------------------
        # 6. Form Scheduling Window Enforcement
        # -------------------------------------------------------------
        print("[6/13] Testing Form Availability Schedule...")
        past = datetime.now(timezone.utc) - timedelta(days=5)
        client.put(f"/api/forms/{form_id}", json={"ends_at": past.isoformat()}, headers=headers_a)

        closed_pub = client.get(f"/api/public/forms/{public_link}")
        assert closed_pub.status_code == 403
        assert closed_pub.json().get("detail") == "FORM_CLOSED"

        # Re-open form
        client.put(f"/api/forms/{form_id}", json={"ends_at": None}, headers=headers_a)
        open_pub = client.get(f"/api/public/forms/{public_link}")
        assert open_pub.status_code == 200

        results["6. Form Scheduling Window Enforcement"] = "PASS"

        # -------------------------------------------------------------
        # 7. Duplicate Detection Policies (allow, warn, block)
        # -------------------------------------------------------------
        print("[7/13] Testing Duplicate Detection Policies (allow, warn, block)...")
        # 7A: Allow
        client.put(f"/api/forms/{form_id}", json={"duplicate_policy": "allow", "duplicate_check_field_id": email_field_id}, headers=headers_a)
        s1 = client.post("/api/submissions/", json={"form_version_id": version_id}).json()["id"]
        client.post("/api/response-values/", json={"submission_id": s1, "field_id": name_field_id, "value_text": "Bob"})
        client.post("/api/response-values/", json={"submission_id": s1, "field_id": email_field_id, "value_text": "dup@example.com"})
        assert client.post(f"/api/submissions/{s1}/submit").status_code == 200

        s2 = client.post("/api/submissions/", json={"form_version_id": version_id}).json()["id"]
        client.post("/api/response-values/", json={"submission_id": s2, "field_id": name_field_id, "value_text": "Bob"})
        client.post("/api/response-values/", json={"submission_id": s2, "field_id": email_field_id, "value_text": "dup@example.com"})
        r2 = client.post(f"/api/submissions/{s2}/submit")
        assert r2.status_code == 200
        assert r2.json().get("duplicate_warning") is None

        # 7B: Warn
        client.put(f"/api/forms/{form_id}", json={"duplicate_policy": "warn"}, headers=headers_a)
        s3 = client.post("/api/submissions/", json={"form_version_id": version_id}).json()["id"]
        client.post("/api/response-values/", json={"submission_id": s3, "field_id": name_field_id, "value_text": "Bob"})
        client.post("/api/response-values/", json={"submission_id": s3, "field_id": email_field_id, "value_text": "dup@example.com"})
        r3 = client.post(f"/api/submissions/{s3}/submit")
        assert r3.status_code == 200
        assert r3.json().get("duplicate_warning") is True

        # 7C: Block
        client.put(f"/api/forms/{form_id}", json={"duplicate_policy": "block"}, headers=headers_a)
        s4 = client.post("/api/submissions/", json={"form_version_id": version_id}).json()["id"]
        client.post("/api/response-values/", json={"submission_id": s4, "field_id": name_field_id, "value_text": "Bob"})
        client.post("/api/response-values/", json={"submission_id": s4, "field_id": email_field_id, "value_text": "dup@example.com"})
        r4 = client.post(f"/api/submissions/{s4}/submit")
        assert r4.status_code == 409
        assert r4.json()["detail"]["code"] == "DUPLICATE_BLOCKED"

        results["7. Duplicate Detection Policies"] = "PASS"

        # -------------------------------------------------------------
        # 8. Duplicate Override Request & Approval Flow
        # -------------------------------------------------------------
        print("[8/13] Testing Duplicate Override Request & Approval Flow...")
        ov_req = client.post(f"/api/submissions/{s4}/request-duplicate-override")
        assert ov_req.status_code == 201
        ov_id = ov_req.json()["id"]

        # Poll status
        poll_res = client.get(f"/api/submissions/{s4}/duplicate-override-status")
        assert poll_res.json()["status"] == "pending"

        # Owner list
        pending_list = client.get(f"/api/forms/{form_id}/duplicate-override-requests", headers=headers_a)
        assert pending_list.status_code == 200
        assert len(pending_list.json()) >= 1

        # Owner approve
        app_res = client.post(f"/api/duplicate-override-requests/{ov_id}/approve", headers=headers_a)
        assert app_res.status_code == 200
        assert app_res.json()["status"] == "approved"

        # Respondent retry
        s4_retry = client.post(f"/api/submissions/{s4}/submit")
        assert s4_retry.status_code == 200

        results["8. Duplicate Override Request & Approval Flow"] = "PASS"

        # -------------------------------------------------------------
        # 9. Email & Scheduled Email Delivery
        # -------------------------------------------------------------
        print("[9/13] Testing Scheduled Email Delivery System...")
        future = datetime.now(timezone.utc) + timedelta(days=2)
        sched_res = client.post(f"/api/forms/{form_id}/share-email", json={
            "recipient_emails": [f"recipient_{ts}@example.com"],
            "subject": "Scheduled Invitation",
            "message": "Hello!",
            "scheduled_at": future.isoformat()
        }, headers=headers_a)
        assert sched_res.status_code == 202
        sched_id = sched_res.json()["scheduled_email_id"]

        list_sched = client.get(f"/api/forms/{form_id}/scheduled-emails", headers=headers_a)
        assert list_sched.status_code == 200
        assert len(list_sched.json()) >= 1

        cancel_res = client.delete(f"/api/forms/{form_id}/scheduled-emails/{sched_id}", headers=headers_a)
        assert cancel_res.status_code == 200

        results["9. Email & Scheduled Email System"] = "PASS"

        # -------------------------------------------------------------
        # 10. AI Form Generator & Draft Acceptance
        # -------------------------------------------------------------
        print("[10/13] Testing AI Form Generation & Draft Acceptance...")
        from unittest.mock import patch
        mock_generated_json = {
            "title": "Customer Feedback Survey",
            "description": "Generated survey",
            "sections": [
                {
                    "title": "General",
                    "description": "General questions",
                    "display_order": 0,
                    "fields": [
                        {
                            "label": "Feedback",
                            "field_type": "text",
                            "placeholder": "Your feedback",
                            "required": True,
                            "options": None,
                            "validation_config": None,
                            "display_order": 0,
                            "ai_rationale": "Feedback text"
                        }
                    ]
                }
            ]
        }

        with patch("app.services.ai_form_service.get_ai_provider") as mock_get_provider:
            class DummyProvider:
                async def generate_form(self, prompt, response_schema=None):
                    return mock_generated_json

            mock_get_provider.return_value = DummyProvider()

            ai_gen = client.post("/api/ai/forms/generate", json={
                "prompt": "Create a customer satisfaction survey"
            }, headers=headers_a)
            assert ai_gen.status_code == 201
            draft_id = ai_gen.json()["id"]

            # Accept draft
            acc_res = client.post(f"/api/ai/forms/{draft_id}/accept", json={"edited_draft": ai_gen.json()["generated_json"]}, headers=headers_a)
            assert acc_res.status_code in (200, 201)
            created_ai_form_id = acc_res.json()["id"]

        results["10. AI Form Generation & Draft Acceptance"] = "PASS"

        # -------------------------------------------------------------
        # 11. AI Response Analyzer (Low count handling)
        # -------------------------------------------------------------
        print("[11/13] Testing AI Response Analyzer...")
        ai_an = client.post(f"/api/ai/analysis/{version_id}/run", headers=headers_a)
        assert ai_an.status_code == 200
        an_data = ai_an.json()
        assert "limitations" in an_data["generated"]

        results["11. AI Response Analyzer"] = "PASS"

        # -------------------------------------------------------------
        # 12. Analytics & Submissions Export
        # -------------------------------------------------------------
        print("[12/13] Testing Analytics Overview & Export...")
        an_over = client.get(f"/api/analytics/{version_id}/dashboard", headers=headers_a)
        assert an_over.status_code == 200

        subs_list = client.get(f"/api/submissions/form-version/{version_id}", headers=headers_a)
        assert subs_list.status_code == 200

        results["12. Analytics & Submissions Export"] = "PASS"

        # -------------------------------------------------------------
        # 13. Security & Permission Enforcement
        # -------------------------------------------------------------
        print("[13/13] Testing Security & Permission Enforcement...")
        # Unauthenticated request
        unauth = client.get("/api/forms/me")
        assert unauth.status_code == 401

        # User B attempting to access User A's form details
        unowned_form = client.get(f"/api/forms/{form_id}", headers=headers_b)
        assert unowned_form.status_code in (403, 404)

        # User B attempting to list User A's pending overrides
        unowned_ov = client.get(f"/api/forms/{form_id}/duplicate-override-requests", headers=headers_b)
        assert unowned_ov.status_code in (403, 404)

        results["13. Security & Permission Enforcement"] = "PASS"

    finally:
        db.close()

    print("\n" + "=" * 70)
    print("MASTER VERIFICATION SUMMARY REPORT")
    print("=" * 70)
    all_passed = True
    for test_name, status in results.items():
        print(f"{test_name:<50}: {status}")
        if status != "PASS":
            all_passed = False
    print("=" * 70)

    if all_passed:
        print("ALL 13 MAJOR PLATFORM SUBSYSTEMS PASSED PERFECTLY WITH 0 ERRORS!")
        return 0
    else:
        print("SOME TESTS FAILED — CHECK LOGS ABOVE.")
        return 1

if __name__ == "__main__":
    sys.exit(run_master_verification())
