from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    DATE = "date"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    FILE_UPLOAD = "file_upload"
    RATING = "rating"
    COMPUTED = "computed"
    # Retained for current database/test compatibility.
    PASSWORD = "password"
    TEXTAREA = "textarea"
    RADIO = "radio"
    FILE = "file"


class FieldOption(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    value: str = Field(..., min_length=1, max_length=255)


COMMON_KEYS = {"default_value", "read_only"}

VALIDATION_KEYS = {
    FieldType.TEXT: {"min_length", "max_length", "pattern"} | COMMON_KEYS,
    FieldType.EMAIL: {"min_length", "max_length", "pattern"} | COMMON_KEYS,
    FieldType.TEXTAREA: {"min_length", "max_length", "pattern"} | COMMON_KEYS,
    FieldType.PASSWORD: {"min_length", "max_length", "pattern"} | COMMON_KEYS,
    FieldType.NUMBER: {"min", "max", "step"} | COMMON_KEYS,
    FieldType.RATING: {"min", "max", "step"} | COMMON_KEYS,
    FieldType.DATE: {"min_date", "max_date"} | COMMON_KEYS,
    FieldType.FILE_UPLOAD: {"max_size_mb", "allowed_extensions"} | COMMON_KEYS,
    FieldType.FILE: {"max_size_mb", "allowed_extensions"} | COMMON_KEYS,
    FieldType.DROPDOWN: COMMON_KEYS,
    FieldType.CHECKBOX: COMMON_KEYS,
    FieldType.RADIO: COMMON_KEYS,
    FieldType.COMPUTED: {"terms", "decimal_places"} | COMMON_KEYS,
}
CHOICE_TYPES = {FieldType.DROPDOWN, FieldType.CHECKBOX, FieldType.RADIO}


class FieldBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    field_type: FieldType
    placeholder: Optional[str] = Field(default=None, max_length=255)
    required: bool = False
    options: Optional[List[FieldOption]] = Field(default=None, validation_alias=AliasChoices("options", "options_json"))
    validation_config: Optional[Dict[str, Any]] = Field(default=None, validation_alias=AliasChoices("validation_config", "validation_json"))
    display_order: int = Field(default=0, ge=0)
    section_id: Optional[int] = Field(default=None)

    @field_validator("options", "validation_config", mode="before")
    @classmethod
    def parse_json_columns(cls, value: Any) -> Any:
        if isinstance(value, str):
            import json
            try:
                return json.loads(value)
            except json.JSONDecodeError as exc:
                raise ValueError("Must contain valid JSON.") from exc
        return value

    @model_validator(mode="after")
    def validate_type_configuration(self) -> "FieldBase":
        config = self.validation_config or {}
        unsupported = set(config) - VALIDATION_KEYS[self.field_type]
        if unsupported:
            raise ValueError(f"Validation keys not valid for {self.field_type.value}: {', '.join(sorted(unsupported))}.")
        if self.field_type in CHOICE_TYPES and not self.options:
            raise ValueError(f"{self.field_type.value} fields require at least one option.")
        if self.field_type not in CHOICE_TYPES and self.options:
            raise ValueError("Options are only valid for dropdown or checkbox fields.")
        if "allowed_extensions" in config and (not isinstance(config["allowed_extensions"], list) or not all(isinstance(item, str) and item for item in config["allowed_extensions"])):
            raise ValueError("allowed_extensions must be a list of non-empty strings.")
        if self.field_type == FieldType.COMPUTED:
            if self.required:
                raise ValueError("Computed fields are derived and cannot be required.")
            if "terms" not in config:
                raise ValueError("Computed fields require a terms list in validation_config.")
            terms = config["terms"]
            if not isinstance(terms, list) or len(terms) == 0 or len(terms) % 2 != 1:
                raise ValueError("Computed field terms must be a non-empty list of odd length.")
            valid_ops = {"add", "subtract", "multiply", "divide"}
            for i, term in enumerate(terms):
                if not isinstance(term, dict):
                    raise ValueError(f"Term at index {i} must be a dictionary object.")
                if i % 2 == 0:
                    has_field = "field_id" in term and isinstance(term["field_id"], int) and not isinstance(term["field_id"], bool)
                    has_const = ("constant_value" in term and isinstance(term["constant_value"], (int, float)) and not isinstance(term["constant_value"], bool)) or ("value" in term and isinstance(term["value"], (int, float)) and not isinstance(term["value"], bool))
                    if not (has_field or has_const):
                        raise ValueError(f"Term at index {i} must specify an integer field_id or numeric constant_value.")
                else:
                    if "op" not in term or term["op"] not in valid_ops:
                        raise ValueError(f"Term at index {i} must specify an op in {sorted(valid_ops)}.")
            if "decimal_places" in config:
                dec = config["decimal_places"]
                if not isinstance(dec, int) or isinstance(dec, bool) or dec < 0 or dec > 10:
                    raise ValueError("decimal_places must be an integer between 0 and 10.")
        return self


class FieldCreate(FieldBase):
    form_version_id: int


class FieldUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=255)
    field_type: Optional[FieldType] = None
    placeholder: Optional[str] = Field(default=None, max_length=255)
    required: Optional[bool] = None
    options: Optional[List[FieldOption]] = None
    validation_config: Optional[Dict[str, Any]] = None
    display_order: Optional[int] = Field(default=None, ge=0)
    section_id: Optional[int] = Field(default=None)


class FieldReorder(BaseModel):
    field_ids: List[int] = Field(..., min_length=1)

    @model_validator(mode="after")
    def ids_must_be_unique(self) -> "FieldReorder":
        if len(set(self.field_ids)) != len(self.field_ids):
            raise ValueError("field_ids must not contain duplicates.")
        return self


class FieldResponse(FieldBase):
    id: int
    form_version_id: int
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
