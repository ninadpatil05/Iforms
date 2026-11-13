from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.condition_group import (
    ConditionGroupCreate,
    ConditionGroupUpdate,
    ConditionGroupResponse,
)
from app.services.condition_group_service import condition_group_service
from app.services.form_version_service import form_version_service

router = APIRouter(prefix="/condition-groups", tags=["condition-groups"])


@router.post("/", response_model=ConditionGroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    group_in: ConditionGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionGroupResponse:
    """Create a new condition group for a form version."""
    form_version_service.assert_owns_parent_form(db, group_in.form_version_id, current_user)
    return condition_group_service.create_group(db=db, group_in=group_in)


@router.get("/{group_id}", response_model=ConditionGroupResponse, status_code=status.HTTP_200_OK)
def get_group(group_id: int, db: Session = Depends(get_db)) -> ConditionGroupResponse:
    """Retrieve a specific condition group by ID."""
    return condition_group_service.get_group_by_id(db=db, group_id=group_id)


@router.get("/form-version/{form_version_id}", response_model=List[ConditionGroupResponse], status_code=status.HTTP_200_OK)
def get_groups_by_version(
    form_version_id: int, db: Session = Depends(get_db)
) -> List[ConditionGroupResponse]:
    """Retrieve all condition groups for a form version."""
    return condition_group_service.get_groups_by_version(db=db, form_version_id=form_version_id)


@router.put("/{group_id}", response_model=ConditionGroupResponse, status_code=status.HTTP_200_OK)
def update_group(
    group_id: int,
    group_in: ConditionGroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionGroupResponse:
    """Update an existing condition group."""
    condition_group_service.assert_owns_parent_form(db, group_id, current_user)
    return condition_group_service.update_group(db=db, group_id=group_id, group_in=group_in)


@router.delete("/{group_id}", response_model=ConditionGroupResponse, status_code=status.HTTP_200_OK)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConditionGroupResponse:
    """Delete a condition group by ID."""
    condition_group_service.assert_owns_parent_form(db, group_id, current_user)
    return condition_group_service.delete_group(db=db, group_id=group_id)
