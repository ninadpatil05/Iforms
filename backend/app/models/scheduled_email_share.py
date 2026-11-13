from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class ScheduledEmailShare(Base):
    """
    Persists a deferred email-share request. FormInvite rows (with links) are
    created immediately at schedule time; only SMTP delivery is deferred.

    status lifecycle: pending → sent | failed | cancelled
    If some recipients succeed and others fail, status is set to 'sent' and
    the failed subset is recorded in error_message as JSON.
    Only when every recipient fails is status set to 'failed'.
    """

    __tablename__ = "scheduled_email_shares"

    id = Column(Integer, primary_key=True, index=True)

    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    subject = Column(String(255), nullable=False)

    # JSON array of {email, body} objects — already personalised per-recipient
    # (invite links substituted at schedule time, not send time).
    # Example: [{"email": "a@b.com", "body": "Hi, your link is https://..."}]
    recipient_payloads = Column(JSON, nullable=False)

    # Plain list of recipient email strings (for listing / cancellation UX).
    recipient_emails = Column(JSON, nullable=False)

    scheduled_at = Column(DateTime(timezone=True), nullable=False)

    # pending | sent | failed | cancelled
    status = Column(String(20), nullable=False, default="pending", server_default="pending")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Stores per-recipient failure details as JSON when status='sent' but some
    # recipients failed, or the full error string when status='failed'.
    error_message = Column(Text, nullable=True)

    # Relationships
    form = relationship("Form", backref="scheduled_email_shares")
