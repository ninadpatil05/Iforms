"""
verify_cycle_and_fallback.py
==============================
Verification script for:
  1. Routing cycle detection (direct & transitive, via rule & default_next_section_id)
  2. Valid non-cycle chains
  3. Self-loop prevention
  4. Backward compatibility for legacy published forms with zero sections (section_id = NULL)
"""

import sys
import time
import json
import traceback

from fastapi import HTTPException
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

from app.schemas.branch_rule import BranchRuleCreate, RuleOperator
from app.schemas.section import SectionUpdate
from app.api.public_forms import PublicFormResponse, PublicFieldResponse, PublicSectionResponse
from app.services.branch_rule_service import branch_rule_service
from app.services.section_service import section_service
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


def run_cycle_checks() -> None:
    print("\n[Cycle Checks a-e] Routing cycle detection & validation")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Cycle Tester", email=f"cycle_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Cycle Test Form", status="draft")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=False)
        db.add(ver); db.flush()

        # Create sections A, B, C
        sec_a = Section(form_version_id=ver.id, title="A", display_order=0)
        sec_b = Section(form_version_id=ver.id, title="B", display_order=1)
        sec_c = Section(form_version_id=ver.id, title="C", display_order=2)
        db.add_all([sec_a, sec_b, sec_c]); db.flush()

        f_a = Field(form_version_id=ver.id, section_id=sec_a.id, label="F_A", field_type="text", required=False, display_order=0)
        f_b = Field(form_version_id=ver.id, section_id=sec_b.id, label="F_B", field_type="text", required=False, display_order=0)
        f_c = Field(form_version_id=ver.id, section_id=sec_c.id, label="F_C", field_type="text", required=False, display_order=0)
        db.add_all([f_a, f_b, f_c]); db.commit()

        # ── CHECK a: Direct cycle via branch rule ───────────────────────────
        # A -> B (rule)
        r1 = branch_rule_service.create_rule(db, BranchRuleCreate(
            from_section_id=sec_a.id, to_section_id=sec_b.id,
            trigger_field_id=f_a.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
        ))
        # Attempt B -> A (rule) -> should 400 cycle
        try:
            branch_rule_service.create_rule(db, BranchRuleCreate(
                from_section_id=sec_b.id, to_section_id=sec_a.id,
                trigger_field_id=f_b.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
            ))
            record("Direct cycle via branch rule (A->B, attempt B->A)", False, "no exception raised")
        except HTTPException as e:
            ok = e.status_code == 400 and "cycle" in e.detail.lower()
            record("Direct cycle via branch rule (A->B, attempt B->A)", ok, f"detail={e.detail!r}")

        # ── CHECK b: Direct cycle via default_next_section_id ───────────────
        # Clear r1 for clean test of default_next_section_id
        branch_rule_service.delete_rule(db, r1.id)

        # Set sec_a.default_next_section_id = sec_b.id
        section_service.update_section(db, sec_a.id, SectionUpdate(default_next_section_id=sec_b.id))

        # Attempt sec_b.default_next_section_id = sec_a.id -> should 400 cycle
        try:
            section_service.update_section(db, sec_b.id, SectionUpdate(default_next_section_id=sec_a.id))
            record("Direct cycle via default_next_section_id (A->B, attempt B->A)", False, "no exception raised")
        except HTTPException as e:
            ok = e.status_code == 400 and "cycle" in e.detail.lower()
            record("Direct cycle via default_next_section_id (A->B, attempt B->A)", ok, f"detail={e.detail!r}")

        # ── CHECK c: Transitive cycle: A -> B (rule), B -> C (default), attempt C -> A (rule) ──
        # Clear sec_a.default_next_section_id
        section_service.update_section(db, sec_a.id, SectionUpdate(default_next_section_id=None))

        # A -> B via rule
        branch_rule_service.create_rule(db, BranchRuleCreate(
            from_section_id=sec_a.id, to_section_id=sec_b.id,
            trigger_field_id=f_a.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
        ))
        # B -> C via default_next_section_id
        section_service.update_section(db, sec_b.id, SectionUpdate(default_next_section_id=sec_c.id))

        # Attempt C -> A via rule -> should 400 cycle
        try:
            branch_rule_service.create_rule(db, BranchRuleCreate(
                from_section_id=sec_c.id, to_section_id=sec_a.id,
                trigger_field_id=f_c.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
            ))
            record("Transitive cycle (A->B rule, B->C default, attempt C->A rule)", False, "no exception raised")
        except HTTPException as e:
            ok = e.status_code == 400 and "cycle" in e.detail.lower()
            record("Transitive cycle (A->B rule, B->C default, attempt C->A rule)", ok, f"detail={e.detail!r}")

        # ── CHECK d: Valid non-cycle chain (A -> B -> C) ───────────────────
        # Create B -> C via rule (A -> B rule already exists)
        try:
            r_bc = branch_rule_service.create_rule(db, BranchRuleCreate(
                from_section_id=sec_b.id, to_section_id=sec_c.id,
                trigger_field_id=f_b.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
            ))
            record("Valid non-cycle chain A -> B -> C succeeds", r_bc is not None and r_bc.id > 0)
        except Exception as e:
            record("Valid non-cycle chain A -> B -> C succeeds", False, str(e))

        # ── CHECK e: Self-loop prevention (A -> A) ──────────────────────────
        try:
            branch_rule_service.create_rule(db, BranchRuleCreate(
                from_section_id=sec_a.id, to_section_id=sec_a.id,
                trigger_field_id=f_a.id, operator=RuleOperator.EQUALS, comparison_value="val", priority=0
            ))
            record("Self-loop prevention (A -> A)", False, "no exception raised")
        except HTTPException as e:
            ok = e.status_code == 400
            record("Self-loop prevention (A -> A)", ok, f"detail={e.detail!r}")

    except Exception as e:
        record("cycle checks execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def run_backward_compat_check() -> None:
    print("\n[Backward-Compat Check f] Published form with zero sections")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Compat Tester", email=f"compat_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Legacy Form No Sections", status="published")
        db.add(form); db.flush()
        form_id = form.id

        link = f"legacy_link_{ts}"
        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=link)
        db.add(ver); db.flush()

        # Add two fields with section_id = NULL
        f1 = Field(form_version_id=ver.id, section_id=None, label="Name", field_type="text", required=True, display_order=0)
        f2 = Field(form_version_id=ver.id, section_id=None, label="Email", field_type="email", required=True, display_order=1)
        db.add_all([f1, f2]); db.commit()

        # Query public version and construct PublicFormResponse matching GET /api/public/forms/{public_link}
        pub_version = form_version_service.get_public_version(db, link)
        pub_resp = PublicFormResponse(
            id=pub_version.form.id,
            title=pub_version.form.title,
            description=pub_version.form.description,
            form_version_id=pub_version.id,
            fields=[
                PublicFieldResponse(
                    id=field.id,
                    label=field.label,
                    field_type=field.field_type,
                    required=field.required,
                    options=json.loads(field.options_json) if field.options_json else None,
                    placeholder=field.placeholder,
                    validation_config=json.loads(field.validation_json) if field.validation_json else None,
                    section_id=field.section_id,
                )
                for field in sorted(pub_version.fields, key=lambda item: item.display_order)
            ],
            sections=[
                PublicSectionResponse(
                    id=section.id,
                    title=section.title,
                    description=section.description,
                    display_order=section.display_order,
                    default_next_section_id=section.default_next_section_id,
                )
                for section in sorted(pub_version.sections, key=lambda item: item.display_order)
            ],
        )

        record("Legacy public form response has sections=[]",
               len(pub_resp.sections) == 0,
               f"sections={pub_resp.sections}")
        record("Legacy public form response lists all fields flat",
               len(pub_resp.fields) == 2 and [f.label for f in pub_resp.fields] == ["Name", "Email"],
               f"fields={[f.label for f in pub_resp.fields]}")

    except Exception as e:
        record("backward-compat check execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def main() -> None:
    print("=" * 65)
    print("Routing Cycle & Backward-Compat Verification")
    print("=" * 65)

    run_cycle_checks()
    run_backward_compat_check()

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
        print("  All checks passed -- Cycle detection & backward-compat are solid.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
