from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.response_categorization import (
    ResponseCategorizationResponse,
    ResponseCategorizationUpdate,
)
from app.services.response_categorization_service import response_categorization_service

router = APIRouter(prefix="/ai/categorization", tags=["ai-categorization"])


@router.get("/{form_version_id}", response_model=List[ResponseCategorizationResponse], status_code=status.HTTP_200_OK)
def get_version_categorizations(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ResponseCategorizationResponse]:
    """Get all response categorizations for a form version (Protected - owner only).
    Auto-creates 'uncategorized' rows for any submission that doesn't have one yet.
    """
    return response_categorization_service.get_categorizations_for_version(
        db=db, user=current_user, form_version_id=form_version_id
    )


@router.patch("/{submission_id}", response_model=ResponseCategorizationResponse, status_code=status.HTTP_200_OK)
def update_submission_categorization(
    submission_id: int,
    payload: ResponseCategorizationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResponseCategorizationResponse:
    """Update category for a submission. Sets author_overridden=True. Does NOT touch ai_suggested_category."""
    return response_categorization_service.update_categorization_for_submission(
        db=db, user=current_user, submission_id=submission_id, category=payload.category
    )


@router.post("/{form_version_id}/reset", response_model=List[ResponseCategorizationResponse], status_code=status.HTTP_200_OK)
def reset_version_categorizations(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ResponseCategorizationResponse]:
    """Bulk reset categorizations to ai_suggested_category (or 'uncategorized' if null) and author_overridden=False."""
    return response_categorization_service.reset_categorizations_for_version(
        db=db, user=current_user, form_version_id=form_version_id
    )
