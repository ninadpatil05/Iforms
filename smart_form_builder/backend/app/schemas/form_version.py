from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class FormVersionBase(BaseModel):
    is_published: bool = Field(default=False, description="Whether this version is currently active/published")


class FormVersionCreate(FormVersionBase):
    form_id: int = Field(..., description="The ID of the parent form")


class FormVersionUpdate(BaseModel):
    is_published: Optional[bool] = Field(default=None, description="Toggle publication state")


class FormVersionResponse(FormVersionBase):
    id: int
    form_id: int
    version_number: int
    published_at: Optional[datetime] = Field(default=None, description="Timestamp when version was published")
    public_link: Optional[str] = Field(default=None, description="The unique public URL string for this version")

    model_config = ConfigDict(from_attributes=True)


class PublishFormResponse(BaseModel):
    form_version_id: int
    public_link: str
    public_url: str
