import os
import sys
from pathlib import Path

# Add project root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import io
import time
import uuid
import threading
import requests
import uvicorn
from app.main import app

BASE_URL = "http://127.0.0.1:8000"


def start_server():
    """Start uvicorn server in a daemon thread if not already running."""
    try:
        r = requests.get(f"{BASE_URL}/", timeout=1)
        if r.status_code == 200:
            print("Server is already running at", BASE_URL)
            return
    except requests.exceptions.ConnectionError:
        pass

    print("Starting background test server at", BASE_URL)
    config = uvicorn.Config(app, host="127.0.0.1", port=8000, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    time.sleep(2)  # Wait for server startup


def run_verification():
    start_server()

    results = {}
    print("\n===========================================================")
    print("      RUNNING END-TO-END SYSTEM VERIFICATION SUITE         ")
    print("===========================================================\n")

    # Generate unique test user data
    unique_suffix = str(uuid.uuid4())[:8]
    user1_email = f"owner_{unique_suffix}@example.com"
    user1_password = "SecretPassword123!"
    user2_email = f"stranger_{unique_suffix}@example.com"
    user2_password = "SecretPassword456!"

    headers1 = None
    headers2 = None
    form_id = None
    version_id = None
    field1_id = None
    field2_id = None
    submission_id = None

    # 1. Auth Module
    try:
        # Signup User 1
        signup_res = requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"email": user1_email, "name": "Form Owner", "password": user1_password, "role": "admin"},
        )
        assert signup_res.status_code == 201, f"Signup failed: {signup_res.text}"
        user1_data = signup_res.json()

        # Login User 1
        login_res = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": user1_email, "password": user1_password},
        )
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token1 = login_res.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}

        # Get /me
        me_res = requests.get(f"{BASE_URL}/api/auth/me", headers=headers1)
        assert me_res.status_code == 200 and me_res.json()["email"] == user1_email

        # Signup & Login User 2 (for authorization tests)
        requests.post(
            f"{BASE_URL}/api/auth/signup",
            json={"email": user2_email, "name": "Stranger User", "password": user2_password, "role": "user"},
        )
        login_res2 = requests.post(
            f"{BASE_URL}/api/auth/login",
            data={"username": user2_email, "password": user2_password},
        )
        token2 = login_res2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}

        results["Auth Module"] = "PASSED [PASS]"
    except Exception as e:
        results["Auth Module"] = f"FAILED [FAIL] ({e})"
        print(f"Auth Module Error: {e}")

    # 2. Forms & Form Versions Module
    if headers1:
        try:
            # Create Form
            form_res = requests.post(
                f"{BASE_URL}/api/forms/",
                json={"title": f"Survey Form {unique_suffix}", "description": "Customer Feedback"},
                headers=headers1,
            )
            assert form_res.status_code == 201, f"Form creation failed: {form_res.text}"
            form_id = form_res.json()["id"]

            # Create Version (Draft)
            version_res = requests.post(
                f"{BASE_URL}/api/form-versions/",
                json={"form_id": form_id, "is_published": False},
                headers=headers1,
            )
            assert version_res.status_code == 201, f"Version creation failed: {version_res.text}"
            version_id = version_res.json()["id"]

            results["Forms & Versions Module"] = "PASSED [PASS]"
        except Exception as e:
            results["Forms & Versions Module"] = f"FAILED [FAIL] ({e})"
            print(f"Forms & Versions Module Error: {e}")
    else:
        results["Forms & Versions Module"] = "SKIPPED (Auth failed)"

    # 3. Fields & Conditional Rules Module
    if headers1 and version_id:
        try:
            # Field 1: Text
            f1_res = requests.post(
                f"{BASE_URL}/api/fields/",
                json={
                    "form_version_id": version_id,
                    "label": "Full Name",
                    "field_type": "text",
                    "required": True,
                    "display_order": 1,
                },
                headers=headers1,
            )
            assert f1_res.status_code == 201, f"Field 1 creation failed: {f1_res.text}"
            field1_id = f1_res.json()["id"]

            # Field 2: File Upload
            f2_res = requests.post(
                f"{BASE_URL}/api/fields/",
                json={
                    "form_version_id": version_id,
                    "label": "Attachment",
                    "field_type": "file",
                    "required": False,
                    "display_order": 2,
                },
                headers=headers1,
            )
            assert f2_res.status_code == 201, f"Field 2 creation failed: {f2_res.text}"
            field2_id = f2_res.json()["id"]

            # Conditional Rule
            rule_res = requests.post(
                f"{BASE_URL}/api/conditional-rules/",
                json={
                    "form_version_id": version_id,
                    "trigger_field_id": field1_id,
                    "operator": "equals",
                    "comparison_value": "John",
                    "target_field_id": field2_id,
                    "action": "show",
                },
                headers=headers1,
            )
            assert rule_res.status_code == 201, f"Rule creation failed: {rule_res.text}"

            # Now Publish the version
            pub_res = requests.put(
                f"{BASE_URL}/api/form-versions/{version_id}",
                json={"is_published": True},
                headers=headers1,
            )
            assert pub_res.status_code == 200 and pub_res.json()["is_published"] is True

            results["Fields & Conditional Rules Module"] = "PASSED [PASS]"
        except Exception as e:
            results["Fields & Conditional Rules Module"] = f"FAILED [FAIL] ({e})"
            print(f"Fields & Rules Module Error: {e}")
    else:
        results["Fields & Conditional Rules Module"] = "SKIPPED (Form/Version creation failed)"

    # 4. Anonymous Submission & Response Values Module
    if version_id and field1_id and field2_id:
        try:
            # Anonymous create submission
            sub_res = requests.post(
                f"{BASE_URL}/api/submissions/",
                json={"form_version_id": version_id, "respondent_identifier": "anon_user@example.com"},
            )
            assert sub_res.status_code == 201, f"Submission creation failed: {sub_res.text}"
            submission_id = sub_res.json()["id"]

            # Text response value (Public)
            rv1_res = requests.post(
                f"{BASE_URL}/api/response-values/",
                json={"submission_id": submission_id, "field_id": field1_id, "value_text": "John Doe"},
            )
            assert rv1_res.status_code == 201, f"Text response failed: {rv1_res.text}"

            # File response value (Public multipart upload)
            dummy_file_content = b"Hello, this is a sample attachment file content."
            file_tuple = ("test_sample.txt", io.BytesIO(dummy_file_content), "text/plain")
            rv2_res = requests.post(
                f"{BASE_URL}/api/response-values/upload",
                data={"submission_id": str(submission_id), "field_id": str(field2_id)},
                files={"file": file_tuple},
            )
            assert rv2_res.status_code == 201, f"File response upload failed: {rv2_res.text}"

            # Submit submission
            submit_res = requests.post(f"{BASE_URL}/api/submissions/{submission_id}/submit")
            assert submit_res.status_code == 200 and submit_res.json()["status"] == "submitted"

            results["Submissions & Response Values Module"] = "PASSED [PASS]"
        except Exception as e:
            results["Submissions & Response Values Module"] = f"FAILED [FAIL] ({e})"
            print(f"Submissions & Response Values Error: {e}")
    else:
        results["Submissions & Response Values Module"] = "SKIPPED (Fields creation failed)"

    # 5. Authorization & Ownership Gate Security Module
    if headers1 and headers2 and submission_id:
        try:
            # Owner should access submission
            owner_sub_get = requests.get(f"{BASE_URL}/api/submissions/{submission_id}", headers=headers1)
            assert owner_sub_get.status_code == 200, f"Owner submission get failed: {owner_sub_get.text}"

            # Owner should access submission response values
            owner_rvs_get = requests.get(f"{BASE_URL}/api/response-values/submission/{submission_id}", headers=headers1)
            assert owner_rvs_get.status_code == 200 and len(owner_rvs_get.json()) >= 2

            # Non-owner (User 2) accessing submission should return 403
            stranger_sub_get = requests.get(f"{BASE_URL}/api/submissions/{submission_id}", headers=headers2)
            assert stranger_sub_get.status_code == 403, f"Expected 403, got {stranger_sub_get.status_code}"

            # Unauthenticated request accessing submission should return 401
            anon_sub_get = requests.get(f"{BASE_URL}/api/submissions/{submission_id}")
            assert anon_sub_get.status_code == 401, f"Expected 401, got {anon_sub_get.status_code}"

            results["Ownership Security & Authorization Gate"] = "PASSED [PASS]"
        except Exception as e:
            results["Ownership Security & Authorization Gate"] = f"FAILED [FAIL] ({e})"
            print(f"Ownership Security Error: {e}")
    else:
        results["Ownership Security & Authorization Gate"] = "SKIPPED (Submission creation failed)"

    print("\n-----------------------------------------------------------")
    print("                  VERIFICATION SUMMARY                      ")
    print("-----------------------------------------------------------")
    all_passed = True
    for module, status_str in results.items():
        print(f" {module:<45}: {status_str}")
        if "FAILED" in status_str or "SKIPPED" in status_str:
            all_passed = False
    print("-----------------------------------------------------------\n")

    if not all_passed:
        sys.exit(1)


if __name__ == "__main__":
    run_verification()
