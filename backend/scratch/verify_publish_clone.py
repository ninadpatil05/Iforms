"""
verify_publish_clone.py
=======================
Checks that form_version_service.publish_draft correctly:
  - Clones sections into the new draft with preserved title/display_order
  - Issues brand-new section IDs (not reusing the originals)
  - Remaps each cloned field's section_id to the NEW section, not the old one
  - Leaves ungrouped (section_id=NULL) fields with section_id=NULL in the clone
  - Leaves the original draft's sections and fields completely untouched

Session strategy
----------------
publish_draft calls db.commit() internally, so we CANNOT wrap it in a savepoint
and roll it back cleanly.  Instead we commit real rows and then delete them in a
finally block using their primary keys.

Follows the same PASS/FAIL reporting pattern as verify_sections.py.
"""

import sys
import time
import traceback

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database import base  # noqa: F401 -- registers all models

from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field

from app.services.form_version_service import form_version_service

PASS = "[PASS]"
FAIL = "[FAIL]"
results: list[tuple[str, str]] = []


def record(name: str, ok: bool, detail: str = "") -> None:
    label = PASS if ok else FAIL
    results.append((name, label))
    suffix = f" -- {detail}" if detail else ""
    print(f"  {label}  {name}{suffix}")


# ---------------------------------------------------------------------------
# Cleanup helpers (used in finally to delete committed rows by PK)
# ---------------------------------------------------------------------------

def _delete_form_cascade(db: Session, form_id: int | None) -> None:
    """Delete the form and let CASCADE handle versions/sections/fields/rules."""
    if form_id is None:
        return
    db.execute(text("DELETE FROM forms WHERE id = :id"), {"id": form_id})
    db.commit()


def _delete_user(db: Session, user_id: int | None) -> None:
    if user_id is None:
        return
    db.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    db.commit()


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _seed(db: Session) -> dict:
    """
    Inserts and commits all seed data.  Returns a dict of all relevant ids.

    Seed layout
    -----------
    draft_version (is_published=False, version_number=1)
      sec_1  (title="Sec 1", display_order=0)
        field_1  (label="Field 1", section_id=sec_1.id)
      sec_2  (title="Sec 2", display_order=1)
        field_2  (label="Field 2", section_id=sec_2.id)
      (ungrouped)
        field_3  (label="Field 3", section_id=None)
    """
    ts = int(time.time() * 1000)
    owner = User(name="Clone Tester", email=f"clone_test_{ts}@x.com",
                 password_hash="x", role="user")
    db.add(owner); db.flush()

    form = Form(owner_id=owner.id, title="Clone Test Form", status="draft")
    db.add(form); db.flush()

    draft = FormVersion(form_id=form.id, version_number=1, is_published=False)
    db.add(draft); db.flush()

    sec_1 = Section(form_version_id=draft.id, title="Sec 1", display_order=0)
    sec_2 = Section(form_version_id=draft.id, title="Sec 2", display_order=1)
    db.add_all([sec_1, sec_2]); db.flush()

    field_1 = Field(form_version_id=draft.id, section_id=sec_1.id,
                    label="Field 1", field_type="text", required=False, display_order=0)
    field_2 = Field(form_version_id=draft.id, section_id=sec_2.id,
                    label="Field 2", field_type="email", required=False, display_order=1)
    field_3 = Field(form_version_id=draft.id, section_id=None,
                    label="Field 3", field_type="number", required=False, display_order=2)
    db.add_all([field_1, field_2, field_3]); db.flush()

    import json
    field_4 = Field(
        form_version_id=draft.id,
        section_id=None,
        label="Field 4",
        field_type="computed",
        required=False,
        validation_json=json.dumps({"terms": [{"field_id": field_3.id}, {"op": "multiply"}, {"field_id": field_3.id}]}),
        display_order=3,
    )
    db.add(field_4); db.flush()


    from app.models.condition_group import ConditionGroup, ConditionGroupCondition
    from app.models.conditional_rule import ConditionalRule

    cg = ConditionGroup(form_version_id=draft.id, target_field_id=field_2.id, action="hide", combinator="AND")
    db.add(cg); db.flush()
    cgc1 = ConditionGroupCondition(group_id=cg.id, trigger_field_id=field_1.id, operator="equals", comparison_value="val", display_order=0)
    cgc2 = ConditionGroupCondition(group_id=cg.id, trigger_field_id=field_3.id, operator="is_not_empty", comparison_value=None, display_order=1)
    db.add_all([cgc1, cgc2]); db.flush()

    cr = ConditionalRule(form_version_id=draft.id, trigger_field_id=field_1.id, operator="equals", comparison_value="legacy", target_field_id=field_2.id, action="show")
    db.add(cr); db.commit()

    return {
        "owner_id": owner.id,
        "form_id": form.id,
        "draft_id": draft.id,
        "sec_1_id": sec_1.id,
        "sec_2_id": sec_2.id,
        "field_1_id": field_1.id,
        "field_2_id": field_2.id,
        "field_3_id": field_3.id,
        "field_4_id": field_4.id,
    }


# ---------------------------------------------------------------------------
# Main check function
# ---------------------------------------------------------------------------

def run_checks(db: Session, seed: dict) -> None:
    form_id   = seed["form_id"]
    draft_id  = seed["draft_id"]
    sec_1_id  = seed["sec_1_id"]
    sec_2_id  = seed["sec_2_id"]
    field_1_id = seed["field_1_id"]
    field_2_id = seed["field_2_id"]
    field_3_id = seed["field_3_id"]
    field_4_id = seed["field_4_id"]

    # ── ACTION: publish the draft ──────────────────────────────────────────
    # Returns the now-published version (former draft).
    # A brand-new is_published=False "next_draft" is created as a side-effect.
    published = form_version_service.publish_draft(db, form_id)

    # Reload via fresh SELECT so ORM cache doesn't lie to us
    db.expire_all()

    # Fetch the new draft (the cloned one that publish_draft created)
    new_draft_stmt = (
        select(FormVersion)
        .where(FormVersion.form_id == form_id, FormVersion.is_published.is_(False))
        .order_by(FormVersion.version_number.desc())
    )
    new_draft = db.execute(new_draft_stmt).scalars().first()

    # ── CHECK 1: A NEW form_version was created ────────────────────────────
    print("\n[Check 1] A new (cloned) form_version was created")
    new_draft_id = new_draft.id if new_draft else None
    record("new form_version row exists",
           new_draft is not None and new_draft_id != draft_id,
           f"draft_id={draft_id} new_draft_id={new_draft_id}")

    if new_draft is None:
        record("(remaining checks skipped — no new draft found)", False)
        return

    # ── CHECK 2: 2 sections with correct titles/orders ────────────────────
    print("\n[Check 2] Cloned version has exactly 2 sections, titles and orders preserved")
    new_secs_stmt = (
        select(Section)
        .where(Section.form_version_id == new_draft_id)
        .order_by(Section.display_order.asc())
    )
    new_secs = db.execute(new_secs_stmt).scalars().all()
    titles = [s.title for s in new_secs]
    orders = [s.display_order for s in new_secs]
    record("cloned version has exactly 2 sections",
           len(new_secs) == 2,
           f"count={len(new_secs)}")
    record('section titles preserved ["Sec 1", "Sec 2"]',
           titles == ["Sec 1", "Sec 2"],
           f"titles={titles}")
    record("section display_orders preserved [0, 1]",
           orders == [0, 1],
           f"orders={orders}")

    # ── CHECK 3: New section IDs are distinct from original ───────────────
    print("\n[Check 3] Cloned section IDs are brand-new (not the original draft's IDs)")
    new_sec_ids = {s.id for s in new_secs}
    original_sec_ids = {sec_1_id, sec_2_id}
    record("cloned section IDs != original section IDs",
           new_sec_ids.isdisjoint(original_sec_ids),
           f"new={sorted(new_sec_ids)}  original={sorted(original_sec_ids)}")

    # Build title → new_section mapping for CHECK 4
    new_sec_by_title = {s.title: s for s in new_secs}
    new_sec_1 = new_sec_by_title.get("Sec 1")
    new_sec_2 = new_sec_by_title.get("Sec 2")

    # ── CHECK 4: Cloned fields' section_ids point at NEW sections ─────────
    print("\n[Check 4] Cloned fields' section_id remapped to new section IDs")
    new_fields_stmt = (
        select(Field)
        .where(Field.form_version_id == new_draft_id)
        .order_by(Field.display_order.asc())
    )
    new_fields = db.execute(new_fields_stmt).scalars().all()
    new_field_by_label = {f.label: f for f in new_fields}

    clone_f1 = new_field_by_label.get("Field 1")
    clone_f2 = new_field_by_label.get("Field 2")
    clone_f3 = new_field_by_label.get("Field 3")

    record("cloned version has exactly 4 fields",
           len(new_fields) == 4,
           f"count={len(new_fields)}")

    if new_sec_1 and clone_f1:
        ok = clone_f1.section_id == new_sec_1.id
        record('clone of "Field 1" points at new "Sec 1" clone (not old sec_1_id)',
               ok,
               f"clone_f1.section_id={clone_f1.section_id}  new_sec_1.id={new_sec_1.id}  old_sec_1_id={sec_1_id}")
    else:
        record('clone of "Field 1" found and new "Sec 1" exists', False,
               f"clone_f1={clone_f1}  new_sec_1={new_sec_1}")

    if new_sec_2 and clone_f2:
        ok = clone_f2.section_id == new_sec_2.id
        record('clone of "Field 2" points at new "Sec 2" clone (not old sec_2_id)',
               ok,
               f"clone_f2.section_id={clone_f2.section_id}  new_sec_2.id={new_sec_2.id}  old_sec_2_id={sec_2_id}")
    else:
        record('clone of "Field 2" found and new "Sec 2" exists', False,
               f"clone_f2={clone_f2}  new_sec_2={new_sec_2}")

    # ── CHECK 5: Original draft untouched ─────────────────────────────────
    print("\n[Check 5] Original draft sections and fields are untouched")
    orig_secs_stmt = (
        select(Section)
        .where(Section.form_version_id == draft_id)
        .order_by(Section.display_order.asc())
    )
    orig_secs = db.execute(orig_secs_stmt).scalars().all()
    orig_fields_stmt = (
        select(Field)
        .where(Field.form_version_id == draft_id)
        .order_by(Field.display_order.asc())
    )
    orig_fields = db.execute(orig_fields_stmt).scalars().all()

    record("original draft still has exactly 2 sections",
           len(orig_secs) == 2,
           f"count={len(orig_secs)}")
    record("original draft still has exactly 4 fields",
           len(orig_fields) == 4,
           f"count={len(orig_fields)}")

    orig_f_by_id = {f.id: f for f in orig_fields}
    orig_f1 = orig_f_by_id.get(field_1_id)
    orig_f2 = orig_f_by_id.get(field_2_id)
    record("original field_1 still points at original sec_1",
           orig_f1 is not None and orig_f1.section_id == sec_1_id,
           f"orig_f1.section_id={orig_f1.section_id if orig_f1 else None}  sec_1_id={sec_1_id}")
    record("original field_2 still points at original sec_2",
           orig_f2 is not None and orig_f2.section_id == sec_2_id,
           f"orig_f2.section_id={orig_f2.section_id if orig_f2 else None}  sec_2_id={sec_2_id}")

    # ── CHECK 6: Ungrouped field clone has section_id = NULL ──────────────
    print("\n[Check 6] Ungrouped field (section_id=NULL) clone also has section_id=NULL")
    if clone_f3:
        ok = clone_f3.section_id is None
        record('clone of "Field 3" (ungrouped) has section_id=NULL',
               ok,
               f"clone_f3.section_id={clone_f3.section_id}")
    else:
        record('clone of "Field 3" (ungrouped) found in new draft', False,
               "Field 3 not found in cloned fields")

    # ── CHECK 7: ConditionGroup cloned with remapped field IDs ─────────────
    print("\n[Check 7] Cloned ConditionGroup exists with remapped field IDs")
    from app.models.condition_group import ConditionGroup
    from app.models.conditional_rule import ConditionalRule

    cloned_groups = db.execute(select(ConditionGroup).where(ConditionGroup.form_version_id == new_draft_id)).scalars().all()
    record("cloned version has exactly 1 ConditionGroup", len(cloned_groups) == 1)
    if len(cloned_groups) == 1:
        cg_clone = cloned_groups[0]
        record("cloned ConditionGroup target_field_id remapped to new Field 2 clone",
               clone_f2 is not None and cg_clone.target_field_id == clone_f2.id)
        record("cloned ConditionGroup has 2 condition rows", len(cg_clone.conditions) == 2)
        if len(cg_clone.conditions) == 2:
            trig_ids = {c.trigger_field_id for c in cg_clone.conditions}
            expected_trig_ids = {clone_f1.id, clone_f3.id} if (clone_f1 and clone_f3) else set()
            record("cloned conditions trigger_field_ids remapped to new Field 1 and Field 3 clones",
                   trig_ids == expected_trig_ids)

    # ── CHECK 8: Legacy ConditionalRule cloned with remapped field IDs ──────
    print("\n[Check 8] Cloned legacy ConditionalRule exists with remapped field IDs")
    cloned_rules = db.execute(select(ConditionalRule).where(ConditionalRule.form_version_id == new_draft_id)).scalars().all()
    record("cloned version has exactly 1 ConditionalRule", len(cloned_rules) == 1)
    if len(cloned_rules) == 1:
        cr_clone = cloned_rules[0]
        record("cloned ConditionalRule trigger_field_id remapped to new Field 1 clone",
               clone_f1 is not None and cr_clone.trigger_field_id == clone_f1.id)
        record("cloned ConditionalRule target_field_id remapped to new Field 2 clone",
               clone_f2 is not None and cr_clone.target_field_id == clone_f2.id)

    # ── CHECK 9: Computed field terms remapped to new cloned field IDs ──────
    print("\n[Check 9] Cloned computed field terms remapped to new cloned field IDs")
    clone_f4 = new_field_by_label.get("Field 4")
    if clone_f4 and clone_f4.validation_json and clone_f3:
        import json
        cfg = json.loads(clone_f4.validation_json)
        terms = cfg.get("terms", [])
        remapped_ids = [t["field_id"] for i, t in enumerate(terms) if i % 2 == 0]
        record("computed field_4 terms remapped to new clone_f3.id",
               remapped_ids == [clone_f3.id, clone_f3.id],
               f"remapped_ids={remapped_ids} clone_f3.id={clone_f3.id}")
    else:
        record("computed field_4 terms remapped to new clone_f3.id", False, f"clone_f4={clone_f4}")




# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 65)
    print("publish_draft clone verification")
    print("=" * 65)

    seed: dict = {}
    db: Session = SessionLocal()

    try:
        seed = _seed(db)
        print(f"\nSeed committed: form_id={seed['form_id']} draft_id={seed['draft_id']}")
        print(f"  sec_1_id={seed['sec_1_id']} sec_2_id={seed['sec_2_id']}")
        print(f"  field_1_id={seed['field_1_id']} (in sec_1)")
        print(f"  field_2_id={seed['field_2_id']} (in sec_2)")
        print(f"  field_3_id={seed['field_3_id']} (ungrouped)")
        run_checks(db, seed)
    except Exception as exc:
        print(f"\n  Unexpected error: {exc}")
        traceback.print_exc()
    finally:
        # Cleanup: delete the form (CASCADE removes versions/sections/fields)
        # then delete the user.  Using a fresh session so we're not fighting
        # a potentially half-committed state.
        try:
            db.close()
        except Exception:
            pass
        cleanup_db: Session = SessionLocal()
        try:
            if seed.get("form_id"):
                print(f"\nCleanup: deleting form_id={seed['form_id']} and all children")
                _delete_form_cascade(cleanup_db, seed["form_id"])
            if seed.get("owner_id"):
                print(f"Cleanup: deleting user_id={seed['owner_id']}")
                _delete_user(cleanup_db, seed["owner_id"])
        except Exception as ce:
            print(f"  Cleanup error (non-fatal): {ce}")
            traceback.print_exc()
        finally:
            cleanup_db.close()

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
        print("  All checks passed -- publish_draft clone is correct.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
