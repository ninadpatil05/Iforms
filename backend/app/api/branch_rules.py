from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.branch_rule import (
    BranchRuleCreate,
    BranchRuleReorder,
    BranchRuleResponse,
    BranchRuleUpdate,
)
from app.services.branch_rule_service import branch_rule_service
from app.services.section_service import section_service

router = APIRouter(prefix="/branch-rules", tags=["branch-rules"])


@router.post("/", response_model=BranchRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    rule_in: BranchRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BranchRuleResponse:
    """Create a new section branch rule."""
    section_service.assert_owns_parent_form(db, rule_in.from_section_id, current_user)
    return branch_rule_service.create_rule(db=db, rule_in=rule_in)


@router.get("/{rule_id}", response_model=BranchRuleResponse, status_code=status.HTTP_200_OK)
def get_rule(rule_id: int, db: Session = Depends(get_db)) -> BranchRuleResponse:
    """Retrieve a specific branch rule by ID."""
    return branch_rule_service.get_rule_by_id(db=db, rule_id=rule_id)


@router.get(
    "/section/{from_section_id}",
    response_model=List[BranchRuleResponse],
    status_code=status.HTTP_200_OK,
)
def get_rules_by_section(
    from_section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[BranchRuleResponse]:
    """Retrieve all branch rules for a source section."""
    section_service.assert_owns_parent_form(db, from_section_id, current_user)
    return branch_rule_service.get_rules_by_section(db=db, from_section_id=from_section_id)


@router.patch(
    "/section/{from_section_id}/reorder",
    response_model=List[BranchRuleResponse],
    status_code=status.HTTP_200_OK,
)
def reorder_rules(
    from_section_id: int,
    payload: BranchRuleReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[BranchRuleResponse]:
    """Atomically reassign priorities to branch rules for a section.

    The ``rule_ids`` list must contain every branch rule for this section exactly once.
    Each rule is assigned priority = its position index (0-based) in the list.
    """
    section_service.assert_owns_parent_form(db, from_section_id, current_user)
    return branch_rule_service.reorder_rules(
        db=db, from_section_id=from_section_id, ordered_rule_ids=payload.rule_ids
    )


@router.put("/{rule_id}", response_model=BranchRuleResponse, status_code=status.HTTP_200_OK)
def update_rule(
    rule_id: int,
    rule_in: BranchRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BranchRuleResponse:
    """Update an existing branch rule."""
    branch_rule_service.assert_owns_parent_form(db, rule_id, current_user)
    return branch_rule_service.update_rule(db=db, rule_id=rule_id, rule_in=rule_in)


@router.delete("/{rule_id}", response_model=BranchRuleResponse, status_code=status.HTTP_200_OK)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BranchRuleResponse:
    """Delete a branch rule by ID."""
    branch_rule_service.assert_owns_parent_form(db, rule_id, current_user)
    return branch_rule_service.delete_rule(db=db, rule_id=rule_id)
