from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.conditional_rule import RuleOperator


class BranchRuleBase(BaseModel):
    to_section_id: Optional[int] = Field(
        default=None, description="Target section ID, or None for end of form"
    )
    trigger_field_id: int = Field(..., description="Field whose answer triggers this rule")
    operator: RuleOperator
    comparison_value: Optional[str] = Field(
        default=None, description="Value to compare against (not required for is_empty)"
    )
    priority: int = Field(default=0, ge=0, description="Evaluation priority (lower numbers evaluated first)")


class BranchRuleCreate(BranchRuleBase):
    from_section_id: int = Field(..., description="ID of the source section")


class BranchRuleUpdate(BaseModel):
    to_section_id: Optional[int] = None
    trigger_field_id: Optional[int] = None
    operator: Optional[RuleOperator] = None
    comparison_value: Optional[str] = None
    priority: Optional[int] = Field(default=None, ge=0)


class BranchRuleResponse(BranchRuleBase):
    id: int
    from_section_id: int

    model_config = ConfigDict(from_attributes=True)


class BranchRuleReorder(BaseModel):
    """Payload for atomically reassigning priorities to branch rules."""
    rule_ids: List[int] = Field(
        ...,
        description="Ordered list of rule IDs. Each rule gets priority = its index in this list.",
        min_length=1,
    )


class NextPageRequest(BaseModel):
    submission_id: int
    current_section_id: int


class PreviewNextPageRequest(BaseModel):
    answers: Dict[int, Optional[str]]


class NextPageResponse(BaseModel):
    next_section_id: Optional[int] = None
    is_last_section: bool
