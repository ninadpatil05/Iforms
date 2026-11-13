from datetime import datetime
from enum import Enum
from typing import List, Optional
from app.schemas.response_value import SubmissionAnswerResponse
from pydantic import BaseModel, Field, ConfigDict


class SubmissionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"


class SubmissionCreate(BaseModel):
    form_version_id: int = Field(..., description="ID of the published form version being responded to")
    respondent_identifier: Optional[str] = Field(default=None, max_length=255, description="Email or anonymous token")
    invite_token: Optional[str] = Field(default=None, description="Optional invite token for validation")



class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatus] = None
    respondent_identifier: Optional[str] = Field(default=None, max_length=255)
    submitted_at: Optional[datetime] = None


class SubmissionResponse(BaseModel):
    id: int
    form_version_id: int
    respondent_identifier: Optional[str] = None
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    duplicate_warning: Optional[bool] = Field(default=None, description="True if submission matched duplicate policy 'warn'")

    model_config = ConfigDict(from_attributes=True)


class SubmissionCreateResponse(SubmissionResponse):
    """Returned only by POST /submissions/ — carries the one-time access token.

    This schema must never be used for admin list/export endpoints so that
    access_token is not exposed in logs, exports, or support-staff views.
    """
    access_token: str


class FormSubmissionResponse(SubmissionResponse):
    version_number: int
    answers: List[SubmissionAnswerResponse] = []

