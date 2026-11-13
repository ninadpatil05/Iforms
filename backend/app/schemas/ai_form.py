from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.field import CHOICE_TYPES, VALIDATION_KEYS, FieldType


class AiFieldTypeForGeneration(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    DATE = "date"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    FILE_UPLOAD = "file_upload"
    RATING = "rating"


class AiFieldOption(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    value: str = Field(..., min_length=1, max_length=255)


class AiGeneratedField(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    field_type: AiFieldTypeForGeneration
    placeholder: Optional[str] = Field(default=None, max_length=255)
    required: bool = False
    options: Optional[List[AiFieldOption]] = None
    validation_config: Optional[Dict[str, Any]] = None
    display_order: int = Field(default=0, ge=0)
    ai_rationale: Optional[str] = None

    @model_validator(mode="after")
    def validate_type_configuration(self) -> "AiGeneratedField":
        target_ft = FieldType(self.field_type.value)
        config = self.validation_config or {}
        valid_keys = VALIDATION_KEYS.get(target_ft, set())
        unsupported = set(config) - valid_keys
        if unsupported:
            raise ValueError(
                f"Validation keys not valid for {self.field_type.value}: {', '.join(sorted(unsupported))}."
            )
        if target_ft in CHOICE_TYPES and not self.options:
            raise ValueError(f"{self.field_type.value} fields require at least one option.")
        if target_ft not in CHOICE_TYPES and self.options:
            raise ValueError("Options are only valid for dropdown or checkbox fields.")
        if "allowed_extensions" in config and (
            not isinstance(config["allowed_extensions"], list)
            or not all(isinstance(item, str) and item for item in config["allowed_extensions"])
        ):
            raise ValueError("allowed_extensions must be a list of non-empty strings.")
        return self


class AiGeneratedSection(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    display_order: int = Field(default=0, ge=0)
    fields: List[AiGeneratedField] = Field(default_factory=list)


class AiFormGenerationResult(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    sections: List[AiGeneratedSection] = Field(default_factory=list)


class AiFormDraftResponse(BaseModel):
    id: int
    prompt: str
    generated_json: AiFormGenerationResult
    status: str
    form_id: Optional[int] = None
    created_at: datetime
    accepted_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class GenerateFormRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)


class RegenerateFormRequest(BaseModel):
    prompt: Optional[str] = Field(default=None, max_length=2000)


class AcceptDraftRequest(BaseModel):
    edited_draft: AiFormGenerationResult
