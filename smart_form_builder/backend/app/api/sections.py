from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.branch_rule import NextPageResponse, PreviewNextPageRequest
from app.schemas.section import SectionCreate, SectionReorder, SectionResponse, SectionUpdate
from app.services.branch_evaluation_service import branch_evaluation_service
from app.services.form_version_service import form_version_service
from app.services.section_service import section_service

router = APIRouter(prefix="/sections", tags=["sections"])


@router.post("/", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
def create_section(
    section_in: SectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionResponse:
    form_version_service.assert_owns_parent_form(db, section_in.form_version_id, current_user)
    return section_service.create_section(db, section_in)


@router.get("/form-version/{form_version_id}", response_model=List[SectionResponse])
def get_sections_by_version(
    form_version_id: int,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SectionResponse]:
    form_version_service.assert_owns_parent_form(db, form_version_id, current_user)
    return section_service.get_sections_by_version(db, form_version_id, skip, limit)


@router.patch("/form-version/{form_version_id}/reorder", response_model=List[SectionResponse])
def reorder_sections(
    form_version_id: int,
    payload: SectionReorder,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[SectionResponse]:
    form_version_service.assert_owns_parent_form(db, form_version_id, current_user)
    return section_service.reorder_sections(db, form_version_id, payload.section_ids)


@router.get("/{section_id}", response_model=SectionResponse)
def get_section(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionResponse:
    return section_service.assert_owns_parent_form(db, section_id, current_user)


@router.put("/{section_id}", response_model=SectionResponse)
def update_section(
    section_id: int,
    section_in: SectionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionResponse:
    section_service.assert_owns_parent_form(db, section_id, current_user)
    return section_service.update_section(db, section_id, section_in)


@router.delete("/{section_id}", response_model=SectionResponse)
def delete_section(
    section_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SectionResponse:
    section_service.assert_owns_parent_form(db, section_id, current_user)
    return section_service.delete_section(db, section_id)


@router.post("/{section_id}/preview-next-page", response_model=NextPageResponse)
def preview_next_page(
    section_id: int,
    payload: PreviewNextPageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NextPageResponse:
    section_service.assert_owns_parent_form(db, section_id, current_user)
    result = branch_evaluation_service.evaluate_for_preview(
        db=db, section_id=section_id, answers=payload.answers
    )
    return NextPageResponse(**result)
