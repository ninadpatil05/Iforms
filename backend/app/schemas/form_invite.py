from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict


class FormInviteCreate(BaseModel):
    email: str = Field(..., description="Email address for the invite")
    max_uses: int = Field(default=1, ge=1, description="Maximum number of times this invite can be used")


class FormInviteBatchCreate(BaseModel):
    emails: List[str] = Field(..., min_length=1, description="List of email addresses to generate invites for")
    max_uses: int = Field(default=1, ge=1, description="Maximum number of times each invite can be used")


class FormInviteResponse(BaseModel):
    id: int
    form_id: int
    email: str
    token: str
    max_uses: int
    use_count: int
    created_at: datetime
    used_at: Optional[datetime] = None
    invite_link: str = Field(..., description="The fully qualified public invite link")

    model_config = ConfigDict(from_attributes=True)
