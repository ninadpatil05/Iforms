from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.duplicate_override_request import DuplicateOverrideRequest
from app.models.user import User
from app.repositories.duplicate_override_request_repository import duplicate_override_request_repository
from app.services.form_service import form_service
from app.services.email_service import email_service


class DuplicateOverrideService:
    async def request_override(self, db: Session, submission_id: int) -> DuplicateOverrideRequest:
        from app.services.submission_service import submission_service
        sub = submission_service.get_submission_by_id(db, submission_id)
        form = sub.form_version.form

        existing = duplicate_override_request_repository.get_by_submission_id(db, submission_id)
        if existing:
            return existing

        # Extract duplicate value from submission's answer for duplicate_check_field_id
        duplicate_val: Optional[str] = None
        if form.duplicate_check_field_id:
            matching_rv = next((rv for rv in sub.response_values if rv.field_id == form.duplicate_check_field_id), None)
            if matching_rv:
                duplicate_val = matching_rv.value_text

        req = duplicate_override_request_repository.create(
            db,
            form_id=form.id,
            submission_id=submission_id,
            duplicate_value=duplicate_val,
            status="pending",
        )

        # Notify form owner via email
        owner_email = form.owner.email if form.owner else None
        if owner_email:
            val_display = f'"{duplicate_val}"' if duplicate_val else "(No value provided)"
            subject = f"Duplicate submission needs your approval — {form.title}"
            body = (
                f"Hello,\n\n"
                f"A respondent submitted a duplicate entry for your form \"{form.title}\" "
                f"with value {val_display}.\n\n"
                f"The submission is currently blocked pending your approval.\n"
                f"Please log into the IForms dashboard to review and approve or deny this request.\n\n"
                f"Best,\nIForms Platform"
            )
            await email_service.send_email(to=owner_email, subject=subject, body=body)

        return req

    def get_status(self, db: Session, submission_id: int) -> str:
        req = duplicate_override_request_repository.get_by_submission_id(db, submission_id)
        if not req:
            return "none"
        return req.status

    def list_pending_for_form(self, db: Session, user: User, form_id: int) -> List[DuplicateOverrideRequest]:
        form_service.assert_owner(db, form_id, user)
        return duplicate_override_request_repository.get_pending_for_form(db, form_id)

    def approve(self, db: Session, user: User, request_id: int) -> DuplicateOverrideRequest:
        req = duplicate_override_request_repository.get_by_id(db, request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override request not found.")
        form_service.assert_owner(db, req.form_id, user)

        update_data = {"status": "approved", "decided_at": datetime.now(timezone.utc)}
        return duplicate_override_request_repository.update(db, req, update_data)

    def deny(self, db: Session, user: User, request_id: int) -> DuplicateOverrideRequest:
        req = duplicate_override_request_repository.get_by_id(db, request_id)
        if not req:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Override request not found.")
        form_service.assert_owner(db, req.form_id, user)

        update_data = {"status": "denied", "decided_at": datetime.now(timezone.utc)}
        return duplicate_override_request_repository.update(db, req, update_data)


duplicate_override_service = DuplicateOverrideService()
