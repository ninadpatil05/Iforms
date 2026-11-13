import json
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.scheduled_email_share import ScheduledEmailShare


class ScheduledEmailShareRepository:
    def create(
        self,
        db: Session,
        *,
        form_id: int,
        user_id: Optional[int],
        subject: str,
        recipient_payloads: List[dict],
        recipient_emails: List[str],
        scheduled_at: datetime,
    ) -> ScheduledEmailShare:
        db_obj = ScheduledEmailShare(
            form_id=form_id,
            user_id=user_id,
            subject=subject,
            recipient_payloads=recipient_payloads,
            recipient_emails=recipient_emails,
            scheduled_at=scheduled_at,
            status="pending",
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def get_by_id(self, db: Session, schedule_id: int) -> Optional[ScheduledEmailShare]:
        return db.execute(
            select(ScheduledEmailShare).where(ScheduledEmailShare.id == schedule_id)
        ).scalar_one_or_none()

    def get_by_form(self, db: Session, form_id: int) -> List[ScheduledEmailShare]:
        return list(
            db.execute(
                select(ScheduledEmailShare)
                .where(ScheduledEmailShare.form_id == form_id)
                .order_by(ScheduledEmailShare.scheduled_at.desc())
            )
            .scalars()
            .all()
        )

    def get_pending_due(self, db: Session) -> List[ScheduledEmailShare]:
        """Return all pending rows whose scheduled_at is <= now (UTC)."""
        now_utc = datetime.now(timezone.utc)
        return list(
            db.execute(
                select(ScheduledEmailShare).where(
                    ScheduledEmailShare.status == "pending",
                    ScheduledEmailShare.scheduled_at <= now_utc,
                )
            )
            .scalars()
            .all()
        )

    def mark_sent(
        self,
        db: Session,
        row: ScheduledEmailShare,
        *,
        failed_recipients: Optional[List[dict]] = None,
    ) -> ScheduledEmailShare:
        """
        Mark the row as sent. If some recipients failed, record them in
        error_message as JSON but keep status='sent' (partial success).
        """
        row.status = "sent"
        row.sent_at = datetime.now(timezone.utc)
        if failed_recipients:
            row.error_message = json.dumps({"partial_failures": failed_recipients})
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def mark_failed(
        self,
        db: Session,
        row: ScheduledEmailShare,
        error: str,
    ) -> ScheduledEmailShare:
        """Mark the row as fully failed (every recipient failed)."""
        row.status = "failed"
        row.sent_at = datetime.now(timezone.utc)
        row.error_message = error
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def cancel(self, db: Session, row: ScheduledEmailShare) -> ScheduledEmailShare:
        row.status = "cancelled"
        db.add(row)
        db.commit()
        db.refresh(row)
        return row


scheduled_email_share_repository = ScheduledEmailShareRepository()
