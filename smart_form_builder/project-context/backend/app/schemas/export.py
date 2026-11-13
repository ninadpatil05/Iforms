from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.submission import SubmissionStatus


class ExportFormat(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    PDF = "pdf"


class ExportFilters(BaseModel):
    status: Optional[SubmissionStatus] = Field(
        default=None, description="Filter by submission status"
    )
    date_from: Optional[datetime] = Field(
        default=None, description="Filter submissions started at or after date_from"
    )
    date_to: Optional[datetime] = Field(
        default=None, description="Filter submissions started at or before date_to"
    )
    search: Optional[str] = Field(
        default=None, description="Case-insensitive substring search on respondent_identifier"
    )
