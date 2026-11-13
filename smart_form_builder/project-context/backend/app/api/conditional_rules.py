from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.conditional_rule import ConditionalRuleCreate, ConditionalRuleUpdate, ConditionalRuleResponse
from app.services.conditional_rule_service import conditional_rule_service
from app.services.form_version_service import form_version_service

router = APIRouter(prefix="/conditional-rules", tags=["conditional-rules"])


@router.post("/", response_model=ConditionalRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(
    rule_in: ConditionalRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionalRuleResponse:
    """Create a new conditional visibility/behaviour rule for a form version."""
    form_version_service.assert_owns_parent_form(db, rule_in.form_version_id, current_user)
    return conditional_rule_service.create_rule(db=db, rule_in=rule_in)


@router.get("/{rule_id}", response_model=ConditionalRuleResponse, status_code=status.HTTP_200_OK)
def get_rule(rule_id: int, db: Session = Depends(get_db)) -> ConditionalRuleResponse:
    """Retrieve a specific conditional rule by ID."""
    return conditional_rule_service.get_rule_by_id(db=db, rule_id=rule_id)


@router.get("/form-version/{form_version_id}", response_model=List[ConditionalRuleResponse], status_code=status.HTTP_200_OK)
def get_rules_by_version(
    form_version_id: int, skip: int = 0, limit: int = 200, db: Session = Depends(get_db)
) -> List[ConditionalRuleResponse]:
    """Retrieve all conditional rules for a form version."""
    return conditional_rule_service.get_rules_by_version(db=db, form_version_id=form_version_id, skip=skip, limit=limit)


@router.put("/{rule_id}", response_model=ConditionalRuleResponse, status_code=status.HTTP_200_OK)
def update_rule(
    rule_id: int,
    rule_in: ConditionalRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionalRuleResponse:
    """Update an existing conditional rule."""
    conditional_rule_service.assert_owns_parent_form(db, rule_id, current_user)
    return conditional_rule_service.update_rule(db=db, rule_id=rule_id, rule_in=rule_in)


@router.delete("/{rule_id}", response_model=ConditionalRuleResponse, status_code=status.HTTP_200_OK)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionalRuleResponse:
    """Delete a conditional rule by ID."""
    conditional_rule_service.assert_owns_parent_form(db, rule_id, current_user)
    return conditional_rule_service.delete_rule(db=db, rule_id=rule_id)
