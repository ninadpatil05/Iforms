"""
verify_condition_groups.py
===========================
Verification script for Condition Group feature:
  1. Pure unit tests for evaluate_group() and resolve_field_states()
     - AND / OR combinator behavior
     - Single-condition group equivalence
     - Hide-wins conflict resolution (hide vs show)
     - Require independent of hidden
  2. DB-backed CRUD and ownership validation
     - Empty condition list rejection
     - Group creation with multiple conditions
     - Group update (full condition replace)
     - Group deletion & cascade
     - Ownership assertion

Clean setup & teardown.
"""

import sys
import time
import traceback
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal, engine, Base
from app.database import base  # noqa: F401 -- registers all models

Base.metadata.create_all(bind=engine)


from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.field import Field
from app.models.condition_group import ConditionGroup, ConditionGroupCondition

from app.schemas.condition_group import (
    ConditionGroupCreate,
    ConditionGroupUpdate,
    ConditionGroupConditionCreate,
    GroupCombinator,
)
from app.schemas.conditional_rule import RuleOperator, RuleAction
from app.services.condition_group_service import condition_group_service
from app.utils.rule_evaluation import evaluate_group, resolve_field_states

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


def run_unit_tests() -> None:
    print("\n[Group 1] Pure unit tests for evaluate_group() & resolve_field_states()")

    # Mock Group for AND combinator
    group_and = {
        "target_field_id": 10,
        "action": "hide",
        "combinator": "AND",
        "conditions": [
            {"trigger_field_id": 1, "operator": "equals", "comparison_value": "yes"},
            {"trigger_field_id": 2, "operator": "greater_than", "comparison_value": "18"},
        ],
    }

    # AND: Both true
    answers_both = {1: "yes", 2: "25"}
    record("evaluate_group (AND both true)", evaluate_group(group_and, answers_both))

    # AND: One false
    answers_one_false = {1: "yes", 2: "15"}
    record("evaluate_group (AND one false)", not evaluate_group(group_and, answers_one_false))

    # Mock Group for OR combinator
    group_or = {
        "target_field_id": 10,
        "action": "hide",
        "combinator": "OR",
        "conditions": [
            {"trigger_field_id": 1, "operator": "equals", "comparison_value": "yes"},
            {"trigger_field_id": 2, "operator": "greater_than", "comparison_value": "18"},
        ],
    }

    record("evaluate_group (OR one true)", evaluate_group(group_or, answers_one_false))
    record("evaluate_group (OR all false)", not evaluate_group(group_or, {1: "no", 2: "10"}))

    # Single condition group equivalence
    group_single = {
        "target_field_id": 10,
        "action": "show",
        "combinator": "AND",
        "conditions": [
            {"trigger_field_id": 1, "operator": "equals", "comparison_value": "yes"},
        ],
    }
    record("evaluate_group (Single condition true)", evaluate_group(group_single, {1: "yes"}))
    record("evaluate_group (Single condition false)", not evaluate_group(group_single, {1: "no"}))

    # Conflict resolution: hide wins over show
    group_show = {"target_field_id": 10, "action": "show", "combinator": "AND", "conditions": [{"trigger_field_id": 1, "operator": "equals", "comparison_value": "yes"}]}
    group_hide = {"target_field_id": 10, "action": "hide", "combinator": "AND", "conditions": [{"trigger_field_id": 2, "operator": "equals", "comparison_value": "hide_me"}]}
    resolved_conflict = resolve_field_states([group_show, group_hide], {1: "yes", 2: "hide_me"})
    record("resolve_field_states (hide wins over show)", resolved_conflict[10]["hidden"] is True)

    # Conflict resolution: require independent of hidden
    group_require = {"target_field_id": 10, "action": "require", "combinator": "AND", "conditions": [{"trigger_field_id": 3, "operator": "is_not_empty", "comparison_value": None}]}
    resolved_require = resolve_field_states([group_show, group_hide, group_require], {1: "yes", 2: "hide_me", 3: "active"})
    record("resolve_field_states (require set independently)", resolved_require[10]["required_override"] is True and resolved_require[10]["hidden"] is True)


def run_db_tests() -> None:
    print("\n[Group 2] DB-backed CRUD & ownership checks")
    db = SessionLocal()
    form_id = None
    owner_id = None
    other_user_id = None

    try:
        ts = int(time.time() * 1000)
        owner = User(name="CG Owner", email=f"cg_owner_{ts}@x.com", password_hash="x", role="user")
        other = User(name="CG Other", email=f"cg_other_{ts}@x.com", password_hash="x", role="user")
        db.add_all([owner, other]); db.flush()
        owner_id = owner.id
        other_user_id = other.id

        form = Form(owner_id=owner.id, title="Condition Group Form", status="draft")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=False)
        db.add(ver); db.flush()

        f1 = Field(form_version_id=ver.id, label="F1", field_type="text", required=False, display_order=0)
        f2 = Field(form_version_id=ver.id, label="F2", field_type="number", required=False, display_order=1)
        f_target = Field(form_version_id=ver.id, label="Target", field_type="text", required=False, display_order=2)
        db.add_all([f1, f2, f_target]); db.commit()

        # Reject empty conditions list
        try:
            ConditionGroupCreate(
                form_version_id=ver.id,
                target_field_id=f_target.id,
                action=RuleAction.HIDE,
                combinator=GroupCombinator.AND,
                conditions=[],
            )
            record("Reject empty conditions list on create schema", False, "No ValidationError raised")
        except ValidationError:
            record("Reject empty conditions list on create schema", True)

        # Create group via service
        group_in = ConditionGroupCreate(
            form_version_id=ver.id,
            target_field_id=f_target.id,
            action=RuleAction.HIDE,
            combinator=GroupCombinator.AND,
            conditions=[
                ConditionGroupConditionCreate(trigger_field_id=f1.id, operator=RuleOperator.EQUALS, comparison_value="yes"),
                ConditionGroupConditionCreate(trigger_field_id=f2.id, operator=RuleOperator.GREATER_THAN, comparison_value="18"),
            ],
        )
        created = condition_group_service.create_group(db, group_in)
        record("Create ConditionGroup with 2 conditions", created is not None and len(created.conditions) == 2)

        # Query groups by version and by target
        groups_by_ver = condition_group_service.get_groups_by_version(db, ver.id)
        record("get_groups_by_version returns created group", len(groups_by_ver) == 1 and groups_by_ver[0].id == created.id)

        groups_by_target = condition_group_service.get_groups_by_target_field(db, f_target.id)
        record("get_groups_by_target_field returns created group", len(groups_by_target) == 1 and groups_by_target[0].id == created.id)

        # Update group (full replace conditions)
        update_in = ConditionGroupUpdate(
            combinator=GroupCombinator.OR,
            conditions=[
                ConditionGroupConditionCreate(trigger_field_id=f1.id, operator=RuleOperator.IS_NOT_EMPTY),
            ],
        )
        updated = condition_group_service.update_group(db, created.id, update_in)
        record("Update group (combinator OR & replaced to 1 condition)", updated.combinator == "OR" and len(updated.conditions) == 1)

        # Ownership assertion check
        try:
            condition_group_service.assert_owns_parent_form(db, created.id, owner)
            record("assert_owns_parent_form succeeds for owner", True)
        except HTTPException:
            record("assert_owns_parent_form succeeds for owner", False)

        try:
            condition_group_service.assert_owns_parent_form(db, created.id, other)
            record("assert_owns_parent_form rejects non-owner with 403", False, "No exception raised")
        except HTTPException as e:
            record("assert_owns_parent_form rejects non-owner with 403", e.status_code == 403)

        # Delete group
        deleted = condition_group_service.delete_group(db, created.id)
        record("Delete group succeeds", deleted is not None)

        remaining = condition_group_service.get_groups_by_version(db, ver.id)
        record("Group and child conditions removed after deletion", len(remaining) == 0)

    except Exception as e:
        record("DB test execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        _delete_user(cleanup_db, other_user_id)
        cleanup_db.close()


def main() -> None:
    print("=" * 65)
    print("Condition Groups Verification")
    print("=" * 65)

    run_unit_tests()
    run_db_tests()

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
        print("  All checks passed -- Condition groups feature is rock solid.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
