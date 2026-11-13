from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ScheduledEmailShareResponse(BaseModel):
    id: int
    form_id: int
    user_id: Optional[int]
    subject: str
    recipient_emails: List[str]
    scheduled_at: datetime
    status: str                   # pending | sent | failed | cancelled
    created_at: datetime
    sent_at: Optional[datetime] = None
    # JSON string with partial_failures list when status='sent' but some failed,
    # or plain error text when status='failed'.
    error_message: Optional[str] = None

    model_config = {"from_attributes": True}
