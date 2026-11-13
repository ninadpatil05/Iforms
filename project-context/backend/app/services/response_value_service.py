import os
import uuid
from pathlib import Path
from typing import List
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.response_value import ResponseValue
from app.repositories.response_value_repository import response_value_repository
from app.services.submission_service import submission_service
from app.services.field_service import field_service
from app.schemas.response_value import ResponseValueCreate, ResponseValueUpdate

# Maximum allowed file upload size: 10 MB
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

# TODO: Implement virus scanning and MIME-type verification before moving to production.
# Currently only a basic extension allowlist is applied; content sniffing is not performed.
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".csv", ".txt", ".zip",
}

UPLOADS_BASE = Path(__file__).resolve().parents[2] / "uploads"


class ResponseValueService:
    def create_text_response(self, db: Session, rv_in: ResponseValueCreate) -> ResponseValue:
        """Create a text response value. Part of the anonymous submission flow — no auth required."""
        submission = submission_service.get_submission_by_id(db, rv_in.submission_id)
        field = field_service.get_field_by_id(db, rv_in.field_id)
        if submission.status != "in_progress" or field.form_version_id != submission.form_version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Response field does not belong to this active submission.")
        return response_value_repository.create(
            db,
            submission_id=rv_in.submission_id,
            field_id=rv_in.field_id,
            value_text=rv_in.value_text,
        )

    async def create_file_response(self, db: Session, submission_id: int, field_id: int, file: UploadFile) -> ResponseValue:
        """
        Upload a file and create a ResponseValue pointing to the saved path.
        Rejects files over 10 MB and files with disallowed extensions.
        Part of the anonymous submission flow — no auth required.
        """
        submission = submission_service.get_submission_by_id(db, submission_id)
        field = field_service.get_field_by_id(db, field_id)
        if submission.status != "in_progress" or field.form_version_id != submission.form_version_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Response field does not belong to this active submission.")

        # --- Filename sanitization ---
        # 1. Take only the basename (strips directory traversal like ../../etc)
        raw_filename = file.filename or "upload"
        safe_name = Path(raw_filename).name
        # 2. Remove any remaining dangerous characters (extra dots sequences, slashes, backslashes)
        safe_name = safe_name.replace("..", "").replace("/", "").replace("\\", "").strip()
        if not safe_name:
            safe_name = "upload"

        # Extension validation (against sanitized name)
        extension = Path(safe_name).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{extension}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )

        # Read file and enforce size limit
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="File size exceeds the 10 MB limit.",
            )

        # Persist file to disk under uploads/{submission_id}/{uuid}_{safe_name}
        dest_dir = UPLOADS_BASE / str(submission_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        unique_name = f"{uuid.uuid4()}_{safe_name}"
        dest_path = dest_dir / unique_name

        # 3. Path confinement assertion — ensure resolved path stays within UPLOADS_BASE
        resolved_dest = dest_path.resolve()
        resolved_base = UPLOADS_BASE.resolve()
        if not resolved_dest.is_relative_to(resolved_base):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file path.",
            )

        with open(dest_path, "wb") as f:
            f.write(contents)

        relative_path = str(dest_path.relative_to(UPLOADS_BASE.parent)).replace("\\", "/")

        return response_value_repository.create(
            db,
            submission_id=submission_id,
            field_id=field_id,
            file_url=relative_path,
        )

    def get_response_value_by_id(self, db: Session, rv_id: int) -> ResponseValue:
        db_obj = response_value_repository.get_by_id(db, rv_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Response value with ID {rv_id} not found.",
            )
        return db_obj

    def get_responses_by_submission(self, db: Session, submission_id: int) -> List[ResponseValue]:
        """Admin-side: list all answers for a submission — requires auth in router."""
        submission_service.get_submission_by_id(db, submission_id)
        return response_value_repository.get_by_submission(db, submission_id=submission_id)

    def update_response_value(self, db: Session, rv_id: int, rv_in: ResponseValueUpdate) -> ResponseValue:
        db_obj = self.get_response_value_by_id(db, rv_id)
        return response_value_repository.update(db, db_obj=db_obj, obj_in=rv_in)

    def delete_response_value(self, db: Session, rv_id: int) -> ResponseValue:
        db_obj = self.get_response_value_by_id(db, rv_id)
        return response_value_repository.delete(db, rv_id=rv_id)


response_value_service = ResponseValueService()
