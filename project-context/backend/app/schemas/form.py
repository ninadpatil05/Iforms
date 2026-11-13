from datetime import datetime
from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator


class FormStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    TRASHED = "trashed"


class FormBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="The title of the form")
    description: Optional[str] = Field(default=None, description="Detailed description of the form")
    status: FormStatus = Field(default=FormStatus.DRAFT, description="Current workflow status of the form")
    access_mode: str = Field(default="public", description="public or invite_only")
    allow_resubmission: bool = Field(default=True, description="Whether respondents can submit multiple times")
    starts_at: Optional[datetime] = Field(default=None, description="Window start time (UTC)")
    ends_at: Optional[datetime] = Field(default=None, description="Window end time (UTC)")
    duplicate_check_field_id: Optional[int] = Field(default=None, description="Field ID to check for duplicates")
    duplicate_policy: Literal["allow", "warn", "block"] = Field(default="allow", description="allow | warn | block")


class FormCreate(FormBase):
    owner_id: Optional[int] = Field(default=None, description="The ID of the user who owns this form (set from token)")


class FormUpdate(BaseModel):
    """
    Schema for client-initiated form updates.
    """
    title: Optional[str] = Field(default=None, min_length=1, max_length=255, description="Updated title")
    description: Optional[str] = Field(default=None, description="Updated description")
    access_mode: Optional[str] = Field(default=None, description="Updated access mode (public or invite_only)")
    allow_resubmission: Optional[bool] = Field(default=None, description="Updated resubmission preference")
    starts_at: Optional[datetime] = Field(default=None, description="Window start time (UTC)")
    ends_at: Optional[datetime] = Field(default=None, description="Window end time (UTC)")
    duplicate_check_field_id: Optional[int] = Field(default=None, description="Field ID to check for duplicates")
    duplicate_policy: Optional[Literal["allow", "warn", "block"]] = Field(default=None, description="allow | warn | block")

    @model_validator(mode="after")
    def validate_schedule_window(self) -> "FormUpdate":
        if self.starts_at is not None and self.ends_at is not None:
            if self.ends_at <= self.starts_at:
                raise ValueError("ends_at must be after starts_at.")
        return self


class FormResponse(FormBase):
    id: int
    owner_id: int
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    duplicate_check_field_id: Optional[int] = None
    duplicate_policy: Literal["allow", "warn", "block"] = "allow"
    submission_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
