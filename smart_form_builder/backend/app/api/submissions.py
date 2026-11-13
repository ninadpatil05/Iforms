from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.submission import SubmissionCreate, SubmissionCreateResponse, SubmissionUpdate, SubmissionResponse
from app.services.submission_service import submission_service
from app.services.form_version_service import form_version_service

router = APIRouter(prefix="/submissions", tags=["submissions"])


from app.schemas.duplicate_override_request import RequestOverrideResponse, OverrideStatusResponse
from app.services.duplicate_override_service import duplicate_override_service


@router.post("/", response_model=SubmissionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_submission(
    submission_in: SubmissionCreate,
    db: Session = Depends(get_db),
) -> SubmissionCreateResponse:
    """Create a new submission for a published form version (Public).

    Returns the submission plus a one-time ``access_token``. The caller must
    store this token and supply it as a query parameter to any subsequent
    public endpoint that reads or navigates this in-progress submission.
    """
    return submission_service.create_submission(db=db, submission_in=submission_in)


@router.post("/{submission_id}/submit", response_model=SubmissionResponse, status_code=status.HTTP_200_OK)
def submit_submission(
    submission_id: int,
    db: Session = Depends(get_db),
) -> SubmissionResponse:
    """Mark an existing submission as completed/submitted (Public)."""
    return submission_service.submit_submission(db=db, submission_id=submission_id)


@router.post("/{submission_id}/request-duplicate-override", response_model=RequestOverrideResponse, status_code=status.HTTP_201_CREATED)
async def request_duplicate_override(
    submission_id: int,
    db: Session = Depends(get_db),
) -> RequestOverrideResponse:
    """Request an owner override when submission is blocked by duplicate policy (Public)."""
    return await duplicate_override_service.request_override(db=db, submission_id=submission_id)


@router.get("/{submission_id}/duplicate-override-status", response_model=OverrideStatusResponse, status_code=status.HTTP_200_OK)
def get_duplicate_override_status(
    submission_id: int,
    db: Session = Depends(get_db),
) -> OverrideStatusResponse:
    """Poll status of a duplicate override request (Public)."""
    status_str = duplicate_override_service.get_status(db=db, submission_id=submission_id)
    return OverrideStatusResponse(status=status_str)


@router.get("/{submission_id}", response_model=SubmissionResponse, status_code=status.HTTP_200_OK)
def get_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Retrieve details of a specific submission (Protected - form owner only)."""
    return submission_service.assert_owns_parent_form(db=db, submission_id=submission_id, current_user=current_user)


@router.get("/form-version/{form_version_id}", response_model=List[SubmissionResponse], status_code=status.HTTP_200_OK)
def get_submissions_by_version(
    form_version_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SubmissionResponse]:
    """List all submissions for a form version (Protected - form owner only)."""
    form_version_service.assert_owns_parent_form(db=db, form_version_id=form_version_id, current_user=current_user)
    return submission_service.get_submissions_by_version(
        db=db, form_version_id=form_version_id, skip=skip, limit=limit
    )


@router.post("/form-version/{form_version_id}/seed-demo", status_code=status.HTTP_201_CREATED)
def seed_demo_submissions(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Seed 5 sample responses to unlock full AI analysis (Protected - form owner only)."""
    form_version_service.assert_owns_parent_form(db=db, form_version_id=form_version_id, current_user=current_user)
    created = submission_service.seed_demo_submissions(db=db, form_version_id=form_version_id, count=5)
    return {"message": f"Successfully created {len(created)} sample submissions for AI analysis!", "count": len(created)}


@router.put("/{submission_id}", response_model=SubmissionResponse, status_code=status.HTTP_200_OK)
def update_submission(
    submission_id: int,
    submission_in: SubmissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Update a submission (Protected - form owner only)."""
    submission_service.assert_owns_parent_form(db=db, submission_id=submission_id, current_user=current_user)
    return submission_service.update_submission(db=db, submission_id=submission_id, submission_in=submission_in)


@router.delete("/{submission_id}", response_model=SubmissionResponse, status_code=status.HTTP_200_OK)
def delete_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubmissionResponse:
    """Delete a submission (Protected - form owner only)."""
    submission_service.assert_owns_parent_form(db=db, submission_id=submission_id, current_user=current_user)
    return submission_service.delete_submission(db=db, submission_id=submission_id)
