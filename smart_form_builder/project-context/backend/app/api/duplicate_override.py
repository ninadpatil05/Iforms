from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.duplicate_override_request import DuplicateOverrideRequestResponse
from app.services.duplicate_override_service import duplicate_override_service

router = APIRouter(tags=["duplicate-override-requests"])


@router.get(
    "/forms/{form_id}/duplicate-override-requests",
    response_model=List[DuplicateOverrideRequestResponse],
    status_code=status.HTTP_200_OK,
)
def list_pending_duplicate_override_requests(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[DuplicateOverrideRequestResponse]:
    """List all pending duplicate override requests for a form. Owner-only."""
    return duplicate_override_service.list_pending_for_form(db=db, user=current_user, form_id=form_id)


@router.post(
    "/duplicate-override-requests/{request_id}/approve",
    response_model=DuplicateOverrideRequestResponse,
    status_code=status.HTTP_200_OK,
)
def approve_duplicate_override_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DuplicateOverrideRequestResponse:
    """Approve a duplicate override request. Owner-only."""
    return duplicate_override_service.approve(db=db, user=current_user, request_id=request_id)


@router.post(
    "/duplicate-override-requests/{request_id}/deny",
    response_model=DuplicateOverrideRequestResponse,
    status_code=status.HTTP_200_OK,
)
def deny_duplicate_override_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DuplicateOverrideRequestResponse:
    """Deny a duplicate override request. Owner-only."""
    return duplicate_override_service.deny(db=db, user=current_user, request_id=request_id)
