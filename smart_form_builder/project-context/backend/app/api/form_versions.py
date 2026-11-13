from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.form_version import FormVersionCreate, FormVersionUpdate, FormVersionResponse
from app.services.form_service import form_service
from app.services.form_version_service import form_version_service

router = APIRouter(prefix="/form-versions", tags=["form-versions"])


@router.post("/", response_model=FormVersionResponse, status_code=status.HTTP_201_CREATED)
def create_version(
    version_in: FormVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormVersionResponse:
    """Create a new form version."""
    form_service.assert_owner(db, version_in.form_id, current_user)
    return form_version_service.create_version(db=db, version_in=version_in)


@router.get("/{version_id}", response_model=FormVersionResponse, status_code=status.HTTP_200_OK)
def get_version(version_id: int, db: Session = Depends(get_db)) -> FormVersionResponse:
    """Retrieve a specific form version by ID."""
    return form_version_service.get_version_by_id(db=db, version_id=version_id)


@router.get("/form/{form_id}", response_model=List[FormVersionResponse], status_code=status.HTTP_200_OK)
def get_versions_by_form(
    form_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)
) -> List[FormVersionResponse]:
    """Retrieve all versions of a specific form (paginated)."""
    return form_version_service.get_versions_by_form(db=db, form_id=form_id, skip=skip, limit=limit)


@router.put("/{version_id}", response_model=FormVersionResponse, status_code=status.HTTP_200_OK)
def update_version(
    version_id: int,
    version_in: FormVersionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormVersionResponse:
    """Update publication state of a form version."""
    form_version_service.assert_owns_parent_form(db, version_id, current_user)
    return form_version_service.update_version(db=db, version_id=version_id, version_in=version_in)


@router.delete("/{version_id}", response_model=FormVersionResponse, status_code=status.HTTP_200_OK)
def delete_version(
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormVersionResponse:
    """Delete a form version by ID (fails if currently published)."""
    form_version_service.assert_owns_parent_form(db, version_id, current_user)
    return form_version_service.delete_version(db=db, version_id=version_id)
