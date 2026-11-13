from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from pydantic import BaseModel, EmailStr, Field, model_validator


_MIN_ADVANCE = timedelta(minutes=5)
_MAX_ADVANCE = timedelta(days=90)


class ShareEmailRequest(BaseModel):
    recipient_emails: List[EmailStr] = Field(..., min_length=1, max_length=50)
    subject: str = Field(..., max_length=255)
    message: str
    # Optional scheduled send time. Must be 5 min–90 days from now (UTC).
    # If absent, the email is sent immediately (unchanged behaviour).
    scheduled_at: Optional[datetime] = None

    @model_validator(mode="after")
    def validate_scheduled_at(self) -> "ShareEmailRequest":
        if self.scheduled_at is None:
            return self
        # Normalise to UTC-aware
        dt = self.scheduled_at
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)

        now = datetime.now(timezone.utc)
        if dt < now + _MIN_ADVANCE:
            raise ValueError(
                "scheduled_at must be at least 5 minutes in the future."
            )
        if dt > now + _MAX_ADVANCE:
            raise ValueError(
                "scheduled_at must be within 90 days from now."
            )
        # Store back as UTC-aware
        self.scheduled_at = dt
        return self


class ShareEmailResponse(BaseModel):
    sent_count: int
    failed: List[Dict[str, Any]]  # e.g. [{"email": "bad@email.com", "reason": "..."}]
    # Scheduling metadata — only populated when request included scheduled_at
    scheduled: bool = False
    scheduled_email_id: Optional[int] = None
