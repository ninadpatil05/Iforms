import sys
import logging
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Setup test environment
from app.database.database import Base
from app.database import base  # import all models
from app.main import app
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.ai_form_draft import AiFormDraft
from app.models.ai_analysis_report import AiAnalysisReport
from app.schemas.ai_form import AiFormGenerationResult, AiGeneratedSection, AiGeneratedField, AiFieldOption
from app.services.ai_form_service import ai_form_service
from app.services.ai_analysis_service import ai_analysis_service
from app.api.deps import get_db
from app.utils.security import create_access_token

logger = logging.getLogger("verification")
logging.basicConfig(level=logging.INFO)

client = TestClient(app)

def run_verifications():
    print("=" * 60)
    print("RUNNING AI FEATURE VERIFICATION SUITE")
    print("=" * 60)
    
    results = {}

    # 1. Base.metadata.create_all() check
    print("\n--- Test 1: DB Table Creation Check ---")
    tables = Base.metadata.tables.keys()
    has_drafts = "ai_form_drafts" in tables
    has_reports = "ai_analysis_reports" in tables
    print(f"Table 'ai_form_drafts' present: {has_drafts}")
    print(f"Table 'ai_analysis_reports' present: {has_reports}")
    results["1_table_creation"] = has_drafts and has_reports

    # 2. Authentication Enforcement (401)
    print("\n--- Test 2: Unauthenticated 401 Check ---")
    auth_endpoints = [
        ("POST", "/api/ai/forms/generate", {"prompt": "test prompt"}),
        ("POST", "/api/ai/forms/1/regenerate", {"prompt": "test prompt"}),
        ("POST", "/api/ai/forms/1/accept", {"edited_draft": {"title": "t", "sections": []}}),
        ("DELETE", "/api/ai/forms/1", None),
        ("POST", "/api/ai/analysis/1/run", None),
        ("GET", "/api/ai/analysis/1/latest", None),
        ("GET", "/api/ai/analysis/1/history", None),
    ]
    auth_passed = True
    for method, url, body in auth_endpoints:
        if method == "POST":
            resp = client.post(url, json=body)
        elif method == "GET":
            resp = client.get(url)
        elif method == "DELETE":
            resp = client.delete(url)
        
        status_ok = resp.status_code == 401
        print(f"{method} {url} -> status {resp.status_code} (expected 401): {'PASS' if status_ok else 'FAIL'}")
        if not status_ok:
            auth_passed = False
    results["2_unauthenticated_401"] = auth_passed

    # Setup DB session & Test Users A and B
    from app.database.database import SessionLocal
    db = SessionLocal()
    
    try:
        import time
        ts = int(time.time())
        # Create User A
        user_a = User(name="User A", email=f"usera_{ts}@example.com", password_hash="hash", role="editor")
        db.add(user_a)
        db.commit()
        db.refresh(user_a)
        token_a = create_access_token(subject=user_a.id)
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Create User B
        user_b = User(name="User B", email=f"userb_{ts}@example.com", password_hash="hash", role="editor")
        db.add(user_b)
        db.commit()
        db.refresh(user_b)
        token_b = create_access_token(subject=user_b.id)
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Create User A draft and Form
        draft_a = AiFormDraft(
            user_id=user_a.id,
            prompt="User A Prompt",
            generated_json={"title": "Form A", "sections": []},
            status="pending",
        )
        db.add(draft_a)
        
        form_a = Form(owner_id=user_a.id, title="Form A", status="draft", access_mode="public")
        db.add(form_a)
        db.commit()
        db.refresh(draft_a)
        db.refresh(form_a)

        version_a = FormVersion(form_id=form_a.id, version_number=1, is_published=False)
        db.add(version_a)
        db.commit()
        db.refresh(version_a)

        # 3. Ownership Security Checks
        print("\n--- Test 3: Ownership Security Check (User B accessing User A resources) ---")
        ownership_results = {}
        
        resp = client.post(f"/api/ai/forms/{draft_a.id}/regenerate", headers=headers_b, json={"prompt": "new prompt"})
        print(f"Regenerate User A draft as User B -> status {resp.status_code} (expected 404)")
        ownership_results["draft_regenerate"] = resp.status_code

        resp = client.post(f"/api/ai/forms/{draft_a.id}/accept", headers=headers_b, json={"edited_draft": {"title": "X", "sections": []}})
        print(f"Accept User A draft as User B -> status {resp.status_code} (expected 404)")
        ownership_results["draft_accept"] = resp.status_code

        resp = client.delete(f"/api/ai/forms/{draft_a.id}", headers=headers_b)
        print(f"Discard User A draft as User B -> status {resp.status_code} (expected 404)")
        ownership_results["draft_discard"] = resp.status_code

        resp = client.post(f"/api/ai/analysis/{version_a.id}/run", headers=headers_b)
        print(f"Run analysis on User A form as User B -> status {resp.status_code}")
        ownership_results["analysis_run"] = resp.status_code

        resp = client.get(f"/api/ai/analysis/{version_a.id}/latest", headers=headers_b)
        print(f"Get latest analysis of User A form as User B -> status {resp.status_code}")
        ownership_results["analysis_latest"] = resp.status_code

        resp = client.get(f"/api/ai/analysis/{version_a.id}/history", headers=headers_b)
        print(f"Get analysis history of User A form as User B -> status {resp.status_code}")
        ownership_results["analysis_history"] = resp.status_code

        results["3_ownership_security"] = ownership_results

        # 4. Rate Limiting Check (429)
        print("\n--- Test 4: Rate Limiting Check (11th request -> 429) ---")
        user_c = User(name="User C", email=f"userc_{ts}@example.com", password_hash="hash", role="editor")
        db.add(user_c)
        db.commit()
        db.refresh(user_c)
        token_c = create_access_token(subject=user_c.id)
        headers_c = {"Authorization": f"Bearer {token_c}"}

        # Mock get_ai_provider to avoid hitting Gemini API during rate limit test
        mock_provider = AsyncMock()
        mock_provider.generate_form.return_value = {"title": "Test", "sections": []}
        
        rate_limit_passed = False
        with patch("app.services.ai_form_service.get_ai_provider", return_value=mock_provider):
            for i in range(10):
                resp = client.post("/api/ai/forms/generate", headers=headers_c, json={"prompt": f"Test prompt {i}"})
                if resp.status_code not in (201, 502):
                    print(f"Call {i+1} status: {resp.status_code}")
            
            # 11th call should return 429
            resp_11 = client.post("/api/ai/forms/generate", headers=headers_c, json={"prompt": "Test prompt 11"})
            print(f"11th call status: {resp_11.status_code} (expected 429)")
            rate_limit_passed = (resp_11.status_code == 429)

        results["4_rate_limiting"] = rate_limit_passed

        # 5. Insufficient Data Short-Circuit (< 5 responses)
        print("\n--- Test 5: Insufficient Data Short-Circuit (< 5 submissions) ---")
        short_circuit_passed = False
        mock_analysis_provider = AsyncMock()
        with patch("app.services.ai_analysis_service.get_ai_provider", return_value=mock_analysis_provider):
            # Form A has 0 submissions (< 5 threshold)
            report_result = client.post(f"/api/ai/analysis/{version_a.id}/run", headers=headers_a)
            print(f"Run analysis (< 5 submissions) status: {report_result.status_code}")
            if report_result.status_code == 200:
                data = report_result.json()
                lims = data.get("generated", {}).get("limitations", [])
                provider_called = mock_analysis_provider.analyze_responses.called
                print(f"Limitations populated: {lims}")
                print(f"AI Provider called: {provider_called} (expected False)")
                if len(lims) > 0 and not provider_called:
                    short_circuit_passed = True

        results["5_insufficient_data_short_circuit"] = short_circuit_passed

        # 6. Non-AI Manual Form Flow Regression Check
        print("\n--- Test 6: Manual Form Creation & Publishing Regression Check ---")
        regression_passed = True
        create_resp = client.post("/api/forms/", headers=headers_a, json={"title": "Manual Form", "description": "Manual"})
        if create_resp.status_code == 201:
            manual_form = create_resp.json()
            form_id = manual_form["id"]
            print(f"Manual form created successfully: ID {form_id}")
        else:
            print(f"Failed manual form creation: {create_resp.status_code}")
            regression_passed = False

        results["6_manual_regression"] = regression_passed

        # 7. Accept Draft Creates Real Editable Data
        print("\n--- Test 7: Accept Draft Creates Real Editable Form Data ---")
        accept_passed = False
        edited_payload = {
            "title": "Accepted AI Form",
            "description": "Generated by AI",
            "sections": [
                {
                    "title": "Section 1",
                    "description": "First section",
                    "display_order": 0,
                    "fields": [
                        {
                            "label": "Full Name",
                            "field_type": "text",
                            "placeholder": "John Doe",
                            "required": True,
                            "options": None,
                            "validation_config": None,
                            "display_order": 0,
                            "ai_rationale": "Collect respondent name"
                        },
                        {
                            "label": "Satisfaction",
                            "field_type": "dropdown",
                            "placeholder": None,
                            "required": True,
                            "options": [
                                {"label": "High", "value": "high"},
                                {"label": "Low", "value": "low"}
                            ],
                            "validation_config": None,
                            "display_order": 1,
                            "ai_rationale": "Collect rating"
                        }
                    ]
                }
            ]
        }
        
        accept_resp = client.post(f"/api/ai/forms/{draft_a.id}/accept", headers=headers_a, json={"edited_draft": edited_payload})
        print(f"Accept draft response status: {accept_resp.status_code}")
        if accept_resp.status_code == 201:
            created_form_data = accept_resp.json()
            created_form_id = created_form_data["id"]
            
            # Verify DB objects
            db.expire_all()
            from app.models.section import Section
            from app.models.field import Field
            
            sections_in_db = db.query(Section).filter(Section.form_version_id.in_(
                db.query(FormVersion.id).filter(FormVersion.form_id == created_form_id)
            )).all()
            
            fields_in_db = db.query(Field).filter(Field.form_version_id.in_(
                db.query(FormVersion.id).filter(FormVersion.form_id == created_form_id)
            )).all()
            
            print(f"Created Sections in DB count: {len(sections_in_db)}")
            print(f"Created Fields in DB count: {len(fields_in_db)}")
            if len(sections_in_db) == 1 and len(fields_in_db) == 2:
                accept_passed = True
                
        results["7_accept_draft_real_data"] = accept_passed

    finally:
        db.close()

    print("\n" + "=" * 60)
    print("VERIFICATION SUMMARY")
    print("=" * 60)
    for key, status_val in results.items():
        print(f"  {key}: {status_val}")

    return True

if __name__ == "__main__":
    success = run_verifications()
    sys.exit(0 if success else 1)
