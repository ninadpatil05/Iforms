from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict, field_validator

from app.schemas.conditional_rule import RuleOperator, RuleAction


class GroupCombinator(str, Enum):
    AND = "AND"
    OR = "OR"


class ConditionGroupConditionCreate(BaseModel):
    trigger_field_id: int = Field(..., description="Field whose value triggers this condition")
    operator: RuleOperator
    comparison_value: Optional[str] = Field(default=None, description="Value to compare against")


class ConditionGroupConditionResponse(ConditionGroupConditionCreate):
    id: int
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class ConditionGroupCreate(BaseModel):
    form_version_id: int = Field(..., description="ID of the parent form version")
    target_field_id: int = Field(..., description="Field that is affected by this condition group")
    action: RuleAction
    combinator: GroupCombinator
    conditions: List[ConditionGroupConditionCreate] = Field(..., description="List of conditions to combine")

    @field_validator("conditions")
    @classmethod
    def validate_conditions_not_empty(cls, v: List[ConditionGroupConditionCreate]) -> List[ConditionGroupConditionCreate]:
        if not v or len(v) == 0:
            raise ValueError("Condition group must contain at least one condition.")
        return v


class ConditionGroupUpdate(BaseModel):
    action: Optional[RuleAction] = None
    combinator: Optional[GroupCombinator] = None
    conditions: Optional[List[ConditionGroupConditionCreate]] = None

    @field_validator("conditions")
    @classmethod
    def validate_conditions_not_empty(cls, v: Optional[List[ConditionGroupConditionCreate]]) -> Optional[List[ConditionGroupConditionCreate]]:
        if v is not None and len(v) == 0:
            raise ValueError("Condition group must contain at least one condition.")
        return v


class ConditionGroupResponse(BaseModel):
    id: int
    form_version_id: int
    target_field_id: int
    action: RuleAction
    combinator: GroupCombinator
    conditions: List[ConditionGroupConditionResponse]

    model_config = ConfigDict(from_attributes=True)
