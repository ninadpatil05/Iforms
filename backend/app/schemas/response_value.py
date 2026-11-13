from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class ResponseValueCreate(BaseModel):
    submission_id: int = Field(..., description="ID of the parent submission")
    field_id: int = Field(..., description="ID of the field being answered")
    value_text: Optional[str] = Field(default=None, description="Text answer for non-file fields")


class ResponseValueUpdate(BaseModel):
    value_text: Optional[str] = None
    file_url: Optional[str] = None


class ResponseValueResponse(BaseModel):
    id: int
    submission_id: int
    field_id: int
    value_text: Optional[str] = None
    file_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SubmissionAnswerResponse(ResponseValueResponse):
    field_label: str
    field_type: str
    display_order: int
    file_download_url: Optional[str] = None
