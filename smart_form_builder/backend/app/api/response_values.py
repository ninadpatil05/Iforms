from typing import List
from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from fastapi.responses import FileResponse
from pathlib import Path
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.schemas.response_value import (
    ResponseValueCreate,
    ResponseValueUpdate,
    ResponseValueResponse,
)
from app.services.response_value_service import response_value_service
from app.services.submission_service import submission_service

router = APIRouter(prefix="/response-values", tags=["response-values"])


@router.post("/", response_model=ResponseValueResponse, status_code=status.HTTP_201_CREATED)
def create_text_response(
    rv_in: ResponseValueCreate,
    db: Session = Depends(get_db),
) -> ResponseValueResponse:
    """Create a text response value (Public)."""
    return response_value_service.create_text_response(db=db, rv_in=rv_in)


@router.post("/upload", response_model=ResponseValueResponse, status_code=status.HTTP_201_CREATED)
async def create_file_response(
    submission_id: int = Form(...),
    field_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> ResponseValueResponse:
    """Upload a file response value (Public)."""
    return await response_value_service.create_file_response(
        db=db, submission_id=submission_id, field_id=field_id, file=file
    )


@router.get("/{rv_id}/file")
def download_response_file(rv_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FileResponse:
    rv = response_value_service.get_response_value_by_id(db, rv_id)
    submission_service.assert_owns_parent_form(db=db, submission_id=rv.submission_id, current_user=current_user)
    if not rv.file_url:
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No file is attached to this response.")
    file_path = Path(__file__).resolve().parents[2] / rv.file_url
    if not file_path.is_file():
        from fastapi import HTTPException
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file not found.")
    return FileResponse(file_path, filename=file_path.name.split("_", 1)[-1])


@router.get("/{rv_id}", response_model=ResponseValueResponse, status_code=status.HTTP_200_OK)
def get_response_value(
    rv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResponseValueResponse:
    """Retrieve details of a specific response value (Protected - form owner only)."""
    rv = response_value_service.get_response_value_by_id(db=db, rv_id=rv_id)
    submission_service.assert_owns_parent_form(db=db, submission_id=rv.submission_id, current_user=current_user)
    return rv


@router.get("/submission/{submission_id}", response_model=List[ResponseValueResponse], status_code=status.HTTP_200_OK)
def get_responses_by_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ResponseValueResponse]:
    """Retrieve all response values for a submission (Protected - form owner only)."""
    submission_service.assert_owns_parent_form(db=db, submission_id=submission_id, current_user=current_user)
    return response_value_service.get_responses_by_submission(db=db, submission_id=submission_id)


@router.put("/{rv_id}", response_model=ResponseValueResponse, status_code=status.HTTP_200_OK)
def update_response_value(
    rv_id: int,
    rv_in: ResponseValueUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResponseValueResponse:
    """Update a response value (Protected - form owner only)."""
    rv = response_value_service.get_response_value_by_id(db=db, rv_id=rv_id)
    submission_service.assert_owns_parent_form(db=db, submission_id=rv.submission_id, current_user=current_user)
    return response_value_service.update_response_value(db=db, rv_id=rv_id, rv_in=rv_in)


@router.delete("/{rv_id}", response_model=ResponseValueResponse, status_code=status.HTTP_200_OK)
def delete_response_value(
    rv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResponseValueResponse:
    """Delete a response value (Protected - form owner only)."""
    rv = response_value_service.get_response_value_by_id(db=db, rv_id=rv_id)
    submission_service.assert_owns_parent_form(db=db, submission_id=rv.submission_id, current_user=current_user)
    return response_value_service.delete_response_value(db=db, rv_id=rv_id)
