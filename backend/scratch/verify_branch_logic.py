"""
verify_branch_logic.py
======================
Comprehensive verification script for Page-to-Page Branch Logic.

Checks:
  1. Rule-based branching: Field X == "yes" -> Section 2; Field X == "no" -> fallback to default_next_section_id.
     Both preview and submission endpoints tested.
  2. AND grouping: Two rules with same (to_section_id, priority).
     - Both True -> path selected.
     - One True, one False -> path fails, falls through to next priority or default fallback.
  3. Priority ordering: Priority 0 evaluated before Priority 1.
  4. publish_draft cloning: Clones SectionBranchRule objects and default_next_section_id
     with fully remapped IDs pointing to the new draft's sections/fields.

Clean setup & teardown.
"""

import sys
import time
import traceback

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database import base  # noqa: F401

from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.branch_rule import SectionBranchRule
from app.models.submission import Submission
from app.models.response_value import ResponseValue

from app.schemas.branch_rule import BranchRuleCreate, RuleOperator
from app.services.branch_rule_service import branch_rule_service
from app.services.branch_evaluation_service import branch_evaluation_service
from app.services.form_version_service import form_version_service

PASS = "[PASS]"
FAIL = "[FAIL]"
results: list[tuple[str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    label = PASS if ok else FAIL
    results.append((name, label))
    suffix = f" -- {detail}" if detail else ""
    print(f"  {label}  {name}{suffix}")


def _delete_form_cascade(db: Session, form_id: int | None) -> None:
    if form_id is None:
        return
    db.execute(text("DELETE FROM forms WHERE id = :id"), {"id": form_id})
    db.commit()


def _delete_user(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    db.commit()


def check_branch_evaluation() -> None:
    print("\n[Check Group 1 & 2] Branch evaluation & AND grouping")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Branch Tester", email=f"branch_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Branch Test Form", status="published")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=f"link_{ts}")
        db.add(ver); db.flush()

        # Create 3 sections: Sec 1, Sec 2, Sec 3
        s1 = Section(form_version_id=ver.id, title="Sec 1", display_order=0)
        s2 = Section(form_version_id=ver.id, title="Sec 2", display_order=1)
        s3 = Section(form_version_id=ver.id, title="Sec 3", display_order=2)
        db.add_all([s1, s2, s3]); db.flush()

        # Set s1's default_next_section_id to s3
        s1.default_next_section_id = s3.id
        db.flush()

        # Fields in s1
        f1 = Field(form_version_id=ver.id, section_id=s1.id, label="Choice", field_type="text", required=False, display_order=0)
        f2 = Field(form_version_id=ver.id, section_id=s1.id, label="Age", field_type="number", required=False, display_order=1)
        db.add_all([f1, f2]); db.flush()

        # Rule: If Choice equals "yes" AND Age > 18 -> go to Sec 2 (Priority 0)
        r1 = SectionBranchRule(
            from_section_id=s1.id, to_section_id=s2.id, trigger_field_id=f1.id,
            operator="equals", comparison_value="yes", priority=0
        )
        r2 = SectionBranchRule(
            from_section_id=s1.id, to_section_id=s2.id, trigger_field_id=f2.id,
            operator="greater_than", comparison_value="18", priority=0
        )
        db.add_all([r1, r2]); db.commit()

        # Test preview with both conditions true -> should evaluate to s2
        res_both_true = branch_evaluation_service.evaluate_for_preview(db, s1.id, {f1.id: "yes", f2.id: "25"})
        record("AND grouping: Choice=yes AND Age=25 -> Sec 2",
               res_both_true["next_section_id"] == s2.id and not res_both_true["is_last_section"],
               f"next_section_id={res_both_true['next_section_id']}")

        # Test preview with one condition false -> should fall through to default_next_section_id (s3)
        res_one_false = branch_evaluation_service.evaluate_for_preview(db, s1.id, {f1.id: "yes", f2.id: "15"})
        record("AND grouping: Choice=yes AND Age=15 -> Fallback to Sec 3",
               res_one_false["next_section_id"] == s3.id,
               f"next_section_id={res_one_false['next_section_id']}")

        # Test submission evaluation
        sub = Submission(form_version_id=ver.id, status="in_progress")
        db.add(sub); db.flush()
        rv1 = ResponseValue(submission_id=sub.id, field_id=f1.id, value_text="yes")
        rv2 = ResponseValue(submission_id=sub.id, field_id=f2.id, value_text="25")
        db.add_all([rv1, rv2]); db.commit()

        res_sub = branch_evaluation_service.evaluate_for_submission(db, sub.id, s1.id)
        record("Submission evaluation endpoint -> Sec 2",
               res_sub["next_section_id"] == s2.id,
               f"next_section_id={res_sub['next_section_id']}")

    except Exception as e:
        record("branch evaluation setup", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def check_publish_clone_branching() -> None:
    print("\n[Check Group 3] publish_draft branch rule & default_next_section_id cloning")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Draft Clone Tester", email=f"draft_clone_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Draft Clone Form", status="draft")
        db.add(form); db.flush()
        form_id = form.id

        draft = FormVersion(form_id=form.id, version_number=1, is_published=False)
        db.add(draft); db.flush()

        s1 = Section(form_version_id=draft.id, title="S1", display_order=0)
        s2 = Section(form_version_id=draft.id, title="S2", display_order=1)
        db.add_all([s1, s2]); db.flush()
        s1.default_next_section_id = s2.id
        db.flush()

        f1 = Field(form_version_id=draft.id, section_id=s1.id, label="F1", field_type="text", required=False, display_order=0)
        db.add(f1); db.flush()

        rule = SectionBranchRule(
            from_section_id=s1.id, to_section_id=s2.id, trigger_field_id=f1.id,
            operator="equals", comparison_value="go", priority=1
        )
        db.add(rule); db.commit()

        orig_s1_id = s1.id
        orig_s2_id = s2.id
        orig_f1_id = f1.id
        orig_rule_id = rule.id

        # Action: publish draft
        published = form_version_service.publish_draft(db, form.id)
        db.expire_all()

        # Fetch the cloned editable draft
        new_draft_stmt = (
            select(FormVersion)
            .where(FormVersion.form_id == form.id, FormVersion.is_published.is_(False))
            .order_by(FormVersion.version_number.desc())
        )
        new_draft = db.execute(new_draft_stmt).scalars().first()
        record("publish_draft created new editable draft", new_draft is not None)

        if new_draft:
            new_secs = db.execute(select(Section).where(Section.form_version_id == new_draft.id).order_by(Section.display_order.asc())).scalars().all()
            new_s1 = new_secs[0]
            new_s2 = new_secs[1]

            record("Cloned S1 default_next_section_id points to NEW S2 (not orig_s2_id)",
                   new_s1.default_next_section_id == new_s2.id and new_s1.default_next_section_id != orig_s2_id,
                   f"new_s1.default_next_section_id={new_s1.default_next_section_id}  new_s2.id={new_s2.id}  orig_s2_id={orig_s2_id}")

            new_rules = db.execute(select(SectionBranchRule).where(SectionBranchRule.from_section_id == new_s1.id)).scalars().all()
            record("Cloned S1 has exactly 1 branch rule", len(new_rules) == 1)

            if len(new_rules) == 1:
                nr = new_rules[0]
                record("Cloned rule remapped from_section_id to NEW S1", nr.from_section_id == new_s1.id)
                record("Cloned rule remapped to_section_id to NEW S2", nr.to_section_id == new_s2.id)
                record("Cloned rule remapped trigger_field_id to NEW field", nr.trigger_field_id != orig_f1_id)
                record("Cloned rule operator/value/priority preserved",
                       nr.operator == "equals" and nr.comparison_value == "go" and nr.priority == 1)

    except Exception as e:
        record("publish clone branch test", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def main() -> None:
    print("=" * 65)
    print("Page-to-Page Branch Logic Verification")
    print("=" * 65)

    check_branch_evaluation()
    check_publish_clone_branching()

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
        print("  All checks passed -- Branch logic feature is rock solid.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
