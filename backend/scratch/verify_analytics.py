"""
verify_analytics.py
===================
Verification script for Analytics Dashboard feature.

Checks:
  a) Funnel math & section drop-off calculation (3 sections, 5 hand-picked submissions).
  b) FormView logging & daily view grouping (FormView rows across 2 distinct days).
  c) average_completion_seconds handling for zero submitted submissions -> returns None.
  d) Backward-compatibility for form versions with zero sections -> section_drop_off = [].
  e) Refactored build_form_submissions_response method output verification.

Clean seed & teardown.
"""

import sys
import time
import traceback
from datetime import datetime, timezone, timedelta

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database import base  # noqa: F401

from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.form_view import FormView
from app.models.submission import Submission
from app.models.response_value import ResponseValue

from app.repositories.analytics_repository import analytics_repository
from app.services.analytics_service import analytics_service
from app.services.submission_service import submission_service

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


def run_analytics_checks() -> None:
    print("\n[Analytics Checks a-e]")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Analytics Tester", email=f"analytics_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Analytics Test Form", status="published")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=f"analytics_link_{ts}")
        db.add(ver); db.flush()

        # ── CHECK c: average_completion_seconds with 0 submitted submissions ──
        avg_0 = analytics_repository.average_completion_seconds(db, ver.id)
        record("average_completion_seconds returns None when 0 submitted submissions",
               avg_0 is None,
               f"returned={avg_0}")

        # Create 3 sections: S1 (display_order 0), S2 (display_order 1), S3 (display_order 2)
        s1 = Section(form_version_id=ver.id, title="Section 1", display_order=0)
        s2 = Section(form_version_id=ver.id, title="Section 2", display_order=1)
        s3 = Section(form_version_id=ver.id, title="Section 3", display_order=2)
        db.add_all([s1, s2, s3]); db.flush()

        f1 = Field(form_version_id=ver.id, section_id=s1.id, label="Name", field_type="text", required=False, display_order=0)
        db.add(f1); db.flush()

        # ── CHECK a: Simulate 5 submissions ────────────────────────────────
        now = datetime.now(timezone.utc)
        sub1 = Submission(form_version_id=ver.id, status="submitted", started_at=now - timedelta(minutes=10), submitted_at=now, last_section_id=s3.id)
        sub2 = Submission(form_version_id=ver.id, status="submitted", started_at=now - timedelta(minutes=5), submitted_at=now, last_section_id=s2.id)
        sub3 = Submission(form_version_id=ver.id, status="in_progress", started_at=now - timedelta(minutes=2), last_section_id=s2.id)
        sub4 = Submission(form_version_id=ver.id, status="in_progress", started_at=now - timedelta(minutes=1), last_section_id=s1.id)
        sub5 = Submission(form_version_id=ver.id, status="in_progress", started_at=now, last_section_id=None)
        db.add_all([sub1, sub2, sub3, sub4, sub5]); db.flush()

        rv1 = ResponseValue(submission_id=sub1.id, field_id=f1.id, value_text="Alice")
        db.add(rv1); db.commit()

        # ── CHECK b: Insert FormView rows across 2 distinct days ────────────
        d1 = now - timedelta(days=1)
        d2 = now
        v1 = FormView(form_version_id=ver.id, viewed_at=d1)
        v2 = FormView(form_version_id=ver.id, viewed_at=d1)
        v3 = FormView(form_version_id=ver.id, viewed_at=d2)
        db.add_all([v1, v2, v3]); db.commit()

        # Call analytics service get_dashboard
        dashboard = analytics_service.get_dashboard(db, ver.id, owner)

        record("Total views count", dashboard.overview.total_views == 3, f"views={dashboard.overview.total_views}")
        record("Total started count", dashboard.overview.total_started == 5, f"started={dashboard.overview.total_started}")
        record("Total submitted count", dashboard.overview.total_submitted == 2, f"submitted={dashboard.overview.total_submitted}")
        record("Completion rate (2/5 = 0.4)", dashboard.overview.completion_rate == 0.4, f"rate={dashboard.overview.completion_rate}")
        record("Average completion seconds > 0", dashboard.overview.average_completion_seconds is not None and dashboard.overview.average_completion_seconds > 0,
               f"avg_seconds={dashboard.overview.average_completion_seconds}")

        # Check views_over_time grouping
        record("Views over time returned 2 daily data points", len(dashboard.views_over_time) == 2, f"points={len(dashboard.views_over_time)}")

        # Check section drop off hand-computed math
        do = dashboard.section_drop_off
        record("Section drop off returned 3 sections", len(do) == 3)

        if len(do) == 3:
            s1_do, s2_do, s3_do = do[0], do[1], do[2]
            record("S1 reached=5, completed=3, drop_off=2",
                   s1_do.reached_count == 5 and s1_do.completed_count == 3 and s1_do.drop_off_count == 2,
                   f"reached={s1_do.reached_count} completed={s1_do.completed_count} drop_off={s1_do.drop_off_count}")
            record("S2 reached=3, completed=2, drop_off=1",
                   s2_do.reached_count == 3 and s2_do.completed_count == 2 and s2_do.drop_off_count == 1,
                   f"reached={s2_do.reached_count} completed={s2_do.completed_count} drop_off={s2_do.drop_off_count}")
            record("S3 reached=2, completed=2, drop_off=0",
                   s3_do.reached_count == 2 and s3_do.completed_count == 2 and s3_do.drop_off_count == 0,
                   f"reached={s3_do.reached_count} completed={s3_do.completed_count} drop_off={s3_do.drop_off_count}")

        # ── CHECK e: build_form_submissions_response refactor output ────────
        sub_resp = submission_service.build_form_submissions_response(db, form.id)
        record("build_form_submissions_response returns submitted submissions (2)", len(sub_resp) == 2, f"count={len(sub_resp)}")
        sub1_item = next((s for s in sub_resp if s.id == sub1.id), None)
        record("build_form_submissions_response correctly populates answers",
               sub1_item is not None and len(sub1_item.answers) == 1 and sub1_item.answers[0].value_text == "Alice",
               f"answers={sub1_item.answers if sub1_item else None}")

    except Exception as e:
        record("analytics checks execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def run_backward_compat_analytics_check() -> None:
    print("\n[Analytics Check d] Backward-compat for form version with zero sections")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Analytics Compat Tester", email=f"an_compat_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Flat Analytics Form", status="published")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=f"flat_link_{ts}")
        db.add(ver); db.flush()

        sub = Submission(form_version_id=ver.id, status="submitted", last_section_id=None)
        db.add(sub); db.commit()

        dashboard = analytics_service.get_dashboard(db, ver.id, owner)
        record("Zero sections form returns valid dashboard with section_drop_off=[]",
               dashboard.section_drop_off == [],
               f"section_drop_off={dashboard.section_drop_off}")
        record("Zero sections form overview correctly counts submission",
               dashboard.overview.total_submitted == 1)

    except Exception as e:
        record("backward-compat analytics check execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def main() -> None:
    print("=" * 65)
    print("Analytics Dashboard & Metrics Verification")
    print("=" * 65)

    run_analytics_checks()
    run_backward_compat_analytics_check()

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
        print("  All checks passed -- Analytics feature is fully working.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
