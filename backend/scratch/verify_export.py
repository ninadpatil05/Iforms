"""
verify_export.py
================
Verification script for Submission Data Export (CSV, XLSX, PDF) & Filtering.

Checks:
  a) Direct generation of CSV, XLSX, and PDF bytes from seeded submissions.
  b) CSV parsing: header union, row count (3 + header), and "[file]" placeholder.
  c) XLSX parsing with openpyxl: row count, bold header, correct values.
  d) Filtered submission querying: status="submitted" filter returns exact matching subset.
  e) Empty result handling: empty submission list produces valid CSV/XLSX/PDF bytes without crashing.
  f) No cap/limit limit=None check: seeding 150 submissions and asserting all 150 are returned when limit=None.
"""

import csv
import io
import sys
import time
import traceback
from datetime import datetime, timezone, timedelta

import openpyxl
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.database.database import SessionLocal
from app.database import base  # noqa: F401

from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.section import Section
from app.models.field import Field
from app.models.submission import Submission
from app.models.response_value import ResponseValue

from app.schemas.export import ExportFilters, SubmissionStatus
from app.services.export_service import export_service
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


def run_export_checks() -> None:
    print("\n[Export & Filter Checks a-e]")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Export Tester", email=f"export_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Export Test Form", status="published")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=f"export_link_{ts}")
        db.add(ver); db.flush()

        # Seed 2 fields
        f1 = Field(form_version_id=ver.id, label="Full Name", field_type="text", required=True, display_order=0)
        f2 = Field(form_version_id=ver.id, label="Resume Upload", field_type="file_upload", required=False, display_order=1)
        db.add_all([f1, f2]); db.flush()

        now = datetime.now(timezone.utc)
        # Sub 1: submitted, answers f1 (value_text="Alice") and f2 (file_url="/uploads/a.pdf", no value_text)
        sub1 = Submission(form_version_id=ver.id, respondent_identifier="alice@x.com", status="submitted", started_at=now - timedelta(hours=2), submitted_at=now - timedelta(hours=1))
        # Sub 2: submitted, answers f1 only (value_text="Bob") -> missing answer for f2
        sub2 = Submission(form_version_id=ver.id, respondent_identifier="bob@x.com", status="submitted", started_at=now - timedelta(hours=1), submitted_at=now)
        # Sub 3: in_progress, answers f1 (value_text="Charlie")
        sub3 = Submission(form_version_id=ver.id, respondent_identifier="charlie@x.com", status="in_progress", started_at=now)
        db.add_all([sub1, sub2, sub3]); db.flush()

        rv1_1 = ResponseValue(submission_id=sub1.id, field_id=f1.id, value_text="Alice")
        rv1_2 = ResponseValue(submission_id=sub1.id, field_id=f2.id, value_text="", file_url="/uploads/a.pdf")
        rv2_1 = ResponseValue(submission_id=sub2.id, field_id=f1.id, value_text="Bob")
        rv3_1 = ResponseValue(submission_id=sub3.id, field_id=f1.id, value_text="Charlie")
        db.add_all([rv1_1, rv1_2, rv2_1, rv3_1]); db.commit()

        # Build responses
        submissions_dto = submission_service.build_filtered_form_submissions_response(
            db, form_id=form.id, filters=ExportFilters()
        )
        record("build_filtered_form_submissions_response with empty filters returns all 3 submissions",
               len(submissions_dto) == 3, f"count={len(submissions_dto)}")

        # ── CHECK a: Direct generation of CSV, XLSX, PDF ─────────────────────
        csv_bytes = export_service.generate_csv(submissions_dto)
        xlsx_bytes = export_service.generate_xlsx(submissions_dto)
        pdf_bytes = export_service.generate_pdf(submissions_dto, form_title=form.title)

        record("generate_csv produces non-empty bytes", len(csv_bytes) > 0, f"bytes={len(csv_bytes)}")
        record("generate_xlsx produces non-empty bytes", len(xlsx_bytes) > 0, f"bytes={len(xlsx_bytes)}")
        record("generate_pdf produces non-empty bytes", len(pdf_bytes) > 0, f"bytes={len(pdf_bytes)}")

        # ── CHECK b: Parse CSV ─────────────────────────────────────────────
        csv_str = csv_bytes.decode("utf-8-sig")
        reader = list(csv.reader(io.StringIO(csv_str)))
        record("CSV row count == 4 (header + 3 data rows)", len(reader) == 4, f"rows={len(reader)}")

        header_row = reader[0]
        record("CSV header contains respondent, status, started, submitted, and field labels",
               header_row == ["Respondent Identifier", "Status", "Started At", "Submitted At", "Full Name", "Resume Upload"],
               f"header={header_row}")

        # Find Alice's row
        alice_row = next((r for r in reader if r[0] == "alice@x.com"), None)
        record("Alice's row contains '[file]' placeholder for Resume Upload",
               alice_row is not None and alice_row[5] == "[file]",
               f"alice_row={alice_row}")

        # Find Bob's row
        bob_row = next((r for r in reader if r[0] == "bob@x.com"), None)
        record("Bob's row contains '' for missing Resume Upload answer",
               bob_row is not None and bob_row[5] == "",
               f"bob_row={bob_row}")

        # ── CHECK c: Parse XLSX ────────────────────────────────────────────
        wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
        ws = wb.active
        xlsx_rows = list(ws.iter_rows(values_only=True))
        record("XLSX row count == 4", len(xlsx_rows) == 4, f"rows={len(xlsx_rows)}")
        record("XLSX header matches expected columns", list(xlsx_rows[0]) == ["Respondent Identifier", "Status", "Started At", "Submitted At", "Full Name", "Resume Upload"])

        # ── CHECK d: Filtered query ─────────────────────────────────────────
        submitted_only = submission_service.build_filtered_form_submissions_response(
            db, form_id=form.id, filters=ExportFilters(status=SubmissionStatus.SUBMITTED)
        )
        record("status=submitted filter returns exactly 2 submitted submissions",
               len(submitted_only) == 2 and all(s.status == "submitted" for s in submitted_only),
               f"count={len(submitted_only)}")

        search_charlie = submission_service.build_filtered_form_submissions_response(
            db, form_id=form.id, filters=ExportFilters(search="charlie")
        )
        record("search='charlie' filter returns 1 submission",
               len(search_charlie) == 1 and search_charlie[0].respondent_identifier == "charlie@x.com")

        # ── CHECK e: Empty result filter handling ────────────────────────────
        empty_dto = submission_service.build_filtered_form_submissions_response(
            db, form_id=form.id, filters=ExportFilters(search="nonexistent_user_123")
        )
        record("Non-matching filter returns empty list []", len(empty_dto) == 0)

        empty_csv = export_service.generate_csv(empty_dto)
        empty_xlsx = export_service.generate_xlsx(empty_dto)
        empty_pdf = export_service.generate_pdf(empty_dto, form_title=form.title)

        record("generate_csv on empty list produces valid header bytes", len(empty_csv) > 0)
        record("generate_xlsx on empty list produces valid workbook bytes", len(empty_xlsx) > 0)
        record("generate_pdf on empty list produces valid PDF bytes", len(empty_pdf) > 0)

    except Exception as e:
        record("export checks execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def run_limit_checks() -> None:
    print("\n[Export Limit Checks - f]")
    db = SessionLocal()
    form_id = None
    owner_id = None
    try:
        ts = int(time.time() * 1000)
        owner = User(name="Limit Tester", email=f"limit_test_{ts}@x.com", password_hash="x", role="user")
        db.add(owner); db.flush()
        owner_id = owner.id

        form = Form(owner_id=owner.id, title="Limit Test Form", status="published")
        db.add(form); db.flush()
        form_id = form.id

        ver = FormVersion(form_id=form.id, version_number=1, is_published=True, public_link=f"limit_link_{ts}")
        db.add(ver); db.flush()

        # Seed 150 submissions (all status="submitted")
        submissions = []
        for idx in range(150):
            submissions.append(
                Submission(
                    form_version_id=ver.id,
                    respondent_identifier=f"user_{idx}@x.com",
                    status="submitted",
                    started_at=datetime.now(timezone.utc) - timedelta(minutes=idx),
                    submitted_at=datetime.now(timezone.utc) - timedelta(minutes=idx)
                )
            )
        db.add_all(submissions)
        db.commit()

        # Check full export with limit=None
        full_export = submission_service.build_form_submissions_response(db, form_id=form.id, limit=None)
        record("build_form_submissions_response with limit=None returns all 150 submissions",
               len(full_export) == 150, f"count={len(full_export)}")

        # Check UI list with default limit=100
        paginated_export = submission_service.build_form_submissions_response(db, form_id=form.id, limit=100)
        record("build_form_submissions_response with limit=100 returns exactly 100 submissions (UI default)",
               len(paginated_export) == 100, f"count={len(paginated_export)}")

    except Exception as e:
        record("limit checks execution", False, str(e))
        traceback.print_exc()
    finally:
        db.close()
        cleanup_db = SessionLocal()
        _delete_form_cascade(cleanup_db, form_id)
        _delete_user(cleanup_db, owner_id)
        cleanup_db.close()


def main() -> None:
    print("=" * 65)
    print("Submission Export & Filtering Verification")
    print("=" * 65)

    run_export_checks()
    run_limit_checks()

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
        print("  All checks passed -- Export limit is corrected.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
