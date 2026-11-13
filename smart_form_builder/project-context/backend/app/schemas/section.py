from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SectionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    default_next_section_id: Optional[int] = None


class SectionCreate(SectionBase):
    form_version_id: int


class SectionUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    default_next_section_id: Optional[int] = None


class SectionReorder(BaseModel):
    section_ids: List[int] = Field(..., min_length=1)

    @model_validator(mode="after")
    def ids_must_be_unique(self) -> "SectionReorder":
        if len(set(self.section_ids)) != len(self.section_ids):
            raise ValueError("section_ids must not contain duplicates.")
        return self


class SectionResponse(SectionBase):
    id: int
    form_version_id: int

    model_config = ConfigDict(from_attributes=True)
