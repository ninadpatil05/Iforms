from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class RuleOperator(str, Enum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"
    GREATER_THAN_OR_EQUAL = "greater_than_or_equal"
    LESS_THAN_OR_EQUAL = "less_than_or_equal"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"



class RuleAction(str, Enum):
    SHOW = "show"
    HIDE = "hide"
    REQUIRE = "require"


class ConditionalRuleBase(BaseModel):
    trigger_field_id: int = Field(..., description="Field whose value triggers this rule")
    operator: RuleOperator
    comparison_value: Optional[str] = Field(default=None, description="Value to compare against (not required for is_empty)")
    target_field_id: int = Field(..., description="Field that is affected by this rule")
    action: RuleAction


class ConditionalRuleCreate(ConditionalRuleBase):
    form_version_id: int = Field(..., description="ID of the parent form version")


class ConditionalRuleUpdate(BaseModel):
    operator: Optional[RuleOperator] = None
    comparison_value: Optional[str] = None
    action: Optional[RuleAction] = None


class ConditionalRuleResponse(ConditionalRuleBase):
    id: int
    form_version_id: int

    model_config = ConfigDict(from_attributes=True)
