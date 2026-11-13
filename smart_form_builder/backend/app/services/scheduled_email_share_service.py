import json
import logging
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.scheduled_email_share import ScheduledEmailShare
from app.repositories.scheduled_email_share_repository import scheduled_email_share_repository
from app.schemas.scheduled_email_share import ScheduledEmailShareResponse
from app.services.email_service import email_service

logger = logging.getLogger(__name__)


class ScheduledEmailShareService:
    def list_scheduled(self, db: Session, form_id: int) -> List[ScheduledEmailShare]:
        """Return all scheduled-email rows for a form (newest first)."""
        return scheduled_email_share_repository.get_by_form(db, form_id)

    def cancel_scheduled(
        self, db: Session, schedule_id: int, form_id: int
    ) -> ScheduledEmailShare:
        """
        Cancel a pending scheduled send. Raises:
          404 if not found or not belonging to this form.
          409 if already sent/failed/cancelled (not cancellable).
        """
        row = scheduled_email_share_repository.get_by_id(db, schedule_id)
        if not row or row.form_id != form_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scheduled email with ID {schedule_id} not found for this form.",
            )
        if row.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot cancel a scheduled email that is already '{row.status}'.",
            )
        return scheduled_email_share_repository.cancel(db, row)

    async def send_due_emails(self, db: Session) -> None:
        """
        Polls for all pending rows due for delivery and sends them.

        Per-row partial-failure logic:
          - If SOME recipients succeed → status=sent, failed subset stored in
            error_message as JSON {"partial_failures": [...]}
          - If ALL recipients fail    → status=failed, error_message = JSON string
          - If row has no payloads    → mark as failed immediately

        Commits once per row so a crash mid-batch doesn't lose progress.
        """
        due_rows = scheduled_email_share_repository.get_pending_due(db)
        if not due_rows:
            return

        logger.info(f"[Scheduler] Processing {len(due_rows)} due scheduled email(s).")

        for row in due_rows:
            payloads: list = row.recipient_payloads or []

            if not payloads:
                scheduled_email_share_repository.mark_failed(
                    db, row, error="No recipient payloads found — row may have been corrupted."
                )
                continue

            sent_count = 0
            failed_recipients: list = []

            for payload in payloads:
                email = payload.get("email", "")
                body = payload.get("body", "")
                try:
                    success = await email_service.send_email(
                        to=email,
                        subject=row.subject,
                        body=body,
                    )
                except Exception as exc:
                    logger.error(
                        f"[Scheduler] Unexpected error sending to {email} (row {row.id}): {exc}",
                        exc_info=True,
                    )
                    success = False

                if success:
                    sent_count += 1
                else:
                    failed_recipients.append({"email": email, "reason": "SMTP delivery failed"})

            if sent_count == 0:
                # Every recipient failed
                scheduled_email_share_repository.mark_failed(
                    db,
                    row,
                    error=json.dumps({"all_failed": failed_recipients}),
                )
                logger.warning(
                    f"[Scheduler] Row {row.id}: ALL {len(payloads)} recipients failed."
                )
            else:
                # At least one succeeded — mark sent, capture partial failures if any
                scheduled_email_share_repository.mark_sent(
                    db,
                    row,
                    failed_recipients=failed_recipients if failed_recipients else None,
                )
                if failed_recipients:
                    logger.warning(
                        f"[Scheduler] Row {row.id}: sent={sent_count}, "
                        f"failed={len(failed_recipients)} (partial)."
                    )
                else:
                    logger.info(
                        f"[Scheduler] Row {row.id}: sent={sent_count} recipients successfully."
                    )


scheduled_email_share_service = ScheduledEmailShareService()
