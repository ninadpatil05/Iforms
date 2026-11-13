"""
verify_required_at_submit.py
=============================
Tests for required-field validation at submit_submission():
  (a) required + empty  -> 422
  (b) required only via unmet require-group -> succeeds (group not triggered)
  (c) required but hidden via show/hide group -> succeeds (hidden skips required check)
  (d) fully filled -> succeeds
"""

import sys
import time
import traceback
import json
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal, engine, Base
from app.database import base  # noqa: F401 -- registers all models
Base.metadata.create_all(bind=engine)

from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.field import Field
from app.models.submission import Submission
from app.models.response_value import ResponseValue
from app.models.condition_group import ConditionGroup
from app.models.condition_group import ConditionGroupCondition

from app.schemas.submission import SubmissionCreate
from app.services.submission_service import submission_service

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def record(name, ok, detail=""):
    label = PASS if ok else FAIL
    results.append((name, label))
    suffix = f" -- {detail}" if detail else ""
    print(f"  {label}  {name}{suffix}")


def _make_env(db):
    """Create a minimal owner / form / published version."""
    ts = int(time.time() * 1000)
    owner = User(name="Submit Test Owner", email=f"submit_req_{ts}@x.com", password_hash="x", role="user")
    db.add(owner); db.flush()

    form = Form(owner_id=owner.id, title="Required Submit Test", status="published")
    db.add(form); db.flush()

    ver = FormVersion(form_id=form.id, version_number=1, is_published=True)
    db.add(ver); db.flush()

    return owner, form, ver


def _create_submission(db, ver_id):
    sub = Submission(form_version_id=ver_id, status="in_progress")
    db.add(sub); db.commit(); db.refresh(sub)
    return sub


def _cleanup(db, form_id, owner_id):
    db.execute(text("DELETE FROM forms WHERE id = :id"), {"id": form_id})
    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": owner_id})
    db.commit()


def test_a_required_empty_rejects():
    print("\n[Test A] required+empty -> 422")
    db = SessionLocal(); form_id = owner_id = None
    try:
        owner, form, ver = _make_env(db)
        form_id, owner_id = form.id, owner.id

        f_req = Field(form_version_id=ver.id, label="Name", field_type="text", required=True, display_order=0)
        db.add(f_req); db.commit()

        sub = _create_submission(db, ver.id)
        # No response value added -- field is required and empty
        try:
            submission_service.submit_submission(db, sub.id)
            record("required+empty field -> 422", False, "No exception raised")
        except HTTPException as e:
            ok = e.status_code == 422 and "Name" in e.detail
            record("required+empty field -> 422", ok, e.detail)
    except Exception as e:
        record("Test A execution", False, str(e)); traceback.print_exc()
    finally:
        db.close()
        cdb = SessionLocal(); _cleanup(cdb, form_id, owner_id); cdb.close()


def test_b_unmet_require_group_succeeds():
    print("\n[Test B] require group with unmet condition -> succeeds (field not required)")
    db = SessionLocal(); form_id = owner_id = None
    try:
        owner, form, ver = _make_env(db)
        form_id, owner_id = form.id, owner.id

        # trigger field: dropdown
        f_trigger = Field(form_version_id=ver.id, label="Type", field_type="dropdown", required=False, display_order=0)
        # target field: conditionally required
        f_target = Field(form_version_id=ver.id, label="Details", field_type="text", required=False, display_order=1)
        db.add_all([f_trigger, f_target]); db.flush()

        # ConditionGroup: require Details when Type == "special"
        cg = ConditionGroup(form_version_id=ver.id, target_field_id=f_target.id, action="require", combinator="AND")
        db.add(cg); db.flush()
        cond = ConditionGroupCondition(group_id=cg.id, trigger_field_id=f_trigger.id, operator="equals", comparison_value="special", display_order=0)
        db.add(cond); db.commit()

        sub = _create_submission(db, ver.id)
        # Answer trigger with something other than "special" -> require group not triggered
        rv = ResponseValue(submission_id=sub.id, field_id=f_trigger.id, value_text="normal")
        db.add(rv); db.commit()

        try:
            result = submission_service.submit_submission(db, sub.id)
            record("unmet require group -> succeeds", result.status == "submitted")
        except HTTPException as e:
            record("unmet require group -> succeeds", False, e.detail)
    except Exception as e:
        record("Test B execution", False, str(e)); traceback.print_exc()
    finally:
        db.close()
        cdb = SessionLocal(); _cleanup(cdb, form_id, owner_id); cdb.close()


def test_c_hidden_required_field_succeeds():
    print("\n[Test C] required field that is hidden -> succeeds (hidden skips check)")
    db = SessionLocal(); form_id = owner_id = None
    try:
        owner, form, ver = _make_env(db)
        form_id, owner_id = form.id, owner.id

        f_trigger = Field(form_version_id=ver.id, label="Show?", field_type="dropdown", required=False, display_order=0)
        f_target = Field(form_version_id=ver.id, label="Hidden Required", field_type="text", required=True, display_order=1)
        db.add_all([f_trigger, f_target]); db.flush()

        # ConditionGroup: show Hidden Required only when Show? == "yes"
        # (When condition is not met AND there is a show group -> field is hidden)
        cg = ConditionGroup(form_version_id=ver.id, target_field_id=f_target.id, action="show", combinator="AND")
        db.add(cg); db.flush()
        cond = ConditionGroupCondition(group_id=cg.id, trigger_field_id=f_trigger.id, operator="equals", comparison_value="yes", display_order=0)
        db.add(cond); db.commit()

        sub = _create_submission(db, ver.id)
        # Trigger == "no" -> show group not met -> field is hidden -> required check skipped
        rv = ResponseValue(submission_id=sub.id, field_id=f_trigger.id, value_text="no")
        db.add(rv); db.commit()

        try:
            result = submission_service.submit_submission(db, sub.id)
            record("hidden required field -> succeeds", result.status == "submitted")
        except HTTPException as e:
            record("hidden required field -> succeeds", False, e.detail)
    except Exception as e:
        record("Test C execution", False, str(e)); traceback.print_exc()
    finally:
        db.close()
        cdb = SessionLocal(); _cleanup(cdb, form_id, owner_id); cdb.close()


def test_d_fully_filled_succeeds():
    print("\n[Test D] all required fields filled -> succeeds")
    db = SessionLocal(); form_id = owner_id = None
    try:
        owner, form, ver = _make_env(db)
        form_id, owner_id = form.id, owner.id

        f1 = Field(form_version_id=ver.id, label="First Name", field_type="text", required=True, display_order=0)
        f2 = Field(form_version_id=ver.id, label="Email", field_type="email", required=True, display_order=1)
        db.add_all([f1, f2]); db.commit()

        sub = _create_submission(db, ver.id)
        db.add_all([
            ResponseValue(submission_id=sub.id, field_id=f1.id, value_text="Alice"),
            ResponseValue(submission_id=sub.id, field_id=f2.id, value_text="alice@example.com"),
        ])
        db.commit()

        try:
            result = submission_service.submit_submission(db, sub.id)
            record("fully filled -> succeeds", result.status == "submitted")
        except HTTPException as e:
            record("fully filled -> succeeds", False, e.detail)
    except Exception as e:
        record("Test D execution", False, str(e)); traceback.print_exc()
    finally:
        db.close()
        cdb = SessionLocal(); _cleanup(cdb, form_id, owner_id); cdb.close()


def main():
    print("=" * 65)
    print("Required-field Validation at Submit Verification")
    print("=" * 65)

    test_a_required_empty_rejects()
    test_b_unmet_require_group_succeeds()
    test_c_hidden_required_field_succeeds()
    test_d_fully_filled_succeeds()

    print("\n" + "=" * 65)
    print("Results")
    print("=" * 65)
    all_pass = True
    for name, label in results:
        print(f"  {label}  {name}")
        if FAIL in label:
            all_pass = False
    print()
    if all_pass:
        print("  All checks passed -- required-field validation is solid.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
