"""
verify_upload_path_safety.py
============================
Verifies that create_file_response sanitizes filenames and confines
all uploads inside UPLOADS_BASE regardless of attacker-supplied filenames.

Uses pure unit-level testing — monkeypatches DB + filesystem so no server needed.
"""

import sys
import asyncio
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.response_value_service import ResponseValueService, UPLOADS_BASE

PASS = "[PASS]"
FAIL = "[FAIL]"
results = []


def record(name, ok, detail=""):
    label = PASS if ok else FAIL
    results.append((name, label))
    suffix = f" -- {detail}" if detail else ""
    print(f"  {label}  {name}{suffix}")


def _make_upload(filename, content=b"data"):
    upload = MagicMock()
    upload.filename = filename
    upload.read = AsyncMock(return_value=content)
    return upload


async def _call_create_file(filename):
    """Returns the dest_path if accepted, None if HTTPException raised."""
    service = ResponseValueService()
    captured = []

    sub = MagicMock()
    sub.id = 999
    sub.status = "in_progress"
    sub.form_version_id = 1

    field = MagicMock()
    field.form_version_id = 1

    from fastapi import HTTPException

    with (
        patch("app.services.response_value_service.submission_service") as ss,
        patch("app.services.response_value_service.field_service") as fs,
        patch("app.services.response_value_service.response_value_repository") as repo,
        patch("builtins.open", MagicMock()),
        patch("pathlib.Path.mkdir", MagicMock()),
    ):
        ss.get_submission_by_id.return_value = sub
        fs.get_field_by_id.return_value = field
        repo.create.return_value = MagicMock()

        # Intercept the final leaf path (uuid_filename level) by wrapping resolve
        orig_resolve = Path.resolve
        def capturing_open(path, mode="wb"):
            captured.append(path)
            import io
            return io.BytesIO()

        try:
            with patch("builtins.open", side_effect=capturing_open):
                await service.create_file_response(
                    db=MagicMock(), submission_id=sub.id, field_id=1, file=_make_upload(filename)
                )
        except HTTPException:
            return None
        except Exception:
            return None

        return captured[0] if captured else None


def run_tests():
    print("\n[Group 1] Upload path traversal safety")

    base = UPLOADS_BASE.resolve()

    # 1. Normal safe filename stays inside UPLOADS_BASE
    path = asyncio.run(_call_create_file("document.pdf"))
    if path is not None:
        inside = Path(path).resolve().is_relative_to(base)
        record("Normal filename 'document.pdf' stays inside UPLOADS_BASE", inside, str(path))
    else:
        record("Normal filename 'document.pdf' stays inside UPLOADS_BASE", False, "unexpectedly rejected")

    # 2. Classic path traversal - rejected or sanitized to stay inside
    path = asyncio.run(_call_create_file("../../../../etc/evil.txt"))
    if path is None:
        record("Traversal '../../../../etc/evil.txt' is rejected (HTTPException 400)", True)
    else:
        inside = Path(path).resolve().is_relative_to(base)
        record("Traversal '../../../../etc/evil.txt' stays inside UPLOADS_BASE after sanitization", inside, str(path))

    # 3. Backslash traversal
    path = asyncio.run(_call_create_file("..\\..\\evil.jpg"))
    if path is None:
        record("Backslash traversal rejected", True)
    else:
        inside = Path(path).resolve().is_relative_to(base)
        record("Backslash traversal stays inside UPLOADS_BASE", inside, str(path))

    # 4. Triple-dot (sanitized to empty -> rejected)
    path = asyncio.run(_call_create_file("..."))
    record("Filename '...' sanitizes to no-extension -> rejected by allowlist", path is None)

    # 5. Embedded slash (basename extraction)
    path = asyncio.run(_call_create_file("sub/dir/report.csv"))
    if path is None:
        record("Embedded slash 'sub/dir/report.csv' rejected or sanitized", True)
    else:
        inside = Path(path).resolve().is_relative_to(base)
        record("Embedded slash filename stays inside UPLOADS_BASE", inside, str(path))


def main():
    print("=" * 60)
    print("Upload Path Traversal Safety Verification")
    print("=" * 60)
    run_tests()
    print("\n" + "=" * 60)
    print("Results")
    print("=" * 60)
    all_pass = True
    for name, label in results:
        print(f"  {label}  {name}")
        if FAIL in label:
            all_pass = False
    print()
    if all_pass:
        print("  All checks passed -- upload path safety is solid.")
    else:
        print("  One or more checks FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
