from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.field import FieldCreate, FieldReorder, FieldResponse, FieldUpdate
from app.services.field_service import field_service
from app.services.form_version_service import form_version_service

router = APIRouter(prefix="/fields", tags=["fields"])


@router.post("/", response_model=FieldResponse, status_code=status.HTTP_201_CREATED)
def create_field(field_in: FieldCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FieldResponse:
    form_version_service.assert_owns_parent_form(db, field_in.form_version_id, current_user)
    return field_service.create_field(db, field_in)


@router.get("/form-version/{form_version_id}", response_model=List[FieldResponse])
def get_fields_by_version(form_version_id: int, skip: int = 0, limit: int = 200, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[FieldResponse]:
    form_version_service.assert_owns_parent_form(db, form_version_id, current_user)
    return field_service.get_fields_by_version(db, form_version_id, skip, limit)


@router.patch("/form-version/{form_version_id}/reorder", response_model=List[FieldResponse])
def reorder_fields(form_version_id: int, payload: FieldReorder, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> List[FieldResponse]:
    form_version_service.assert_owns_parent_form(db, form_version_id, current_user)
    return field_service.reorder_fields(db, form_version_id, payload.field_ids)


@router.get("/{field_id}", response_model=FieldResponse)
def get_field(field_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FieldResponse:
    return field_service.assert_owns_parent_form(db, field_id, current_user)


@router.put("/{field_id}", response_model=FieldResponse)
def update_field(field_id: int, field_in: FieldUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FieldResponse:
    field_service.assert_owns_parent_form(db, field_id, current_user)
    return field_service.update_field(db, field_id, field_in)


@router.delete("/{field_id}", response_model=FieldResponse)
def delete_field(field_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> FieldResponse:
    field_service.assert_owns_parent_form(db, field_id, current_user)
    return field_service.delete_field(db, field_id)
