from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class RequestOverrideResponse(BaseModel):
    id: int
    status: str
    requested_at: datetime


class DuplicateOverrideRequestResponse(BaseModel):
    id: int
    form_id: int
    submission_id: int
    duplicate_value: Optional[str] = None
    status: str
    requested_at: datetime
    decided_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OverrideStatusResponse(BaseModel):
    status: str
