from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.section import Section
from app.models.user import User
from app.repositories.section_repository import section_repository
from app.services.form_version_service import form_version_service
from app.schemas.section import SectionCreate, SectionUpdate
from app.utils.cycle_detection import would_create_cycle_with_path


class SectionService:
    def create_section(self, db: Session, section_in: SectionCreate) -> Section:
        """Create a section after validating the parent form version exists."""
        version = form_version_service.get_version_by_id(db, section_in.form_version_id)
        if version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )
        return section_repository.create(db, section_in)

    def get_section_by_id(self, db: Session, section_id: int) -> Section:
        db_obj = section_repository.get_by_id(db, section_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Section with ID {section_id} not found.",
            )
        return db_obj

    def get_sections_by_version(
        self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200
    ) -> List[Section]:
        """List all sections for a version, validating the version exists first."""
        form_version_service.get_version_by_id(db, form_version_id)
        return section_repository.get_by_form_version(
            db, form_version_id=form_version_id, skip=skip, limit=limit
        )

    def update_section(
        self, db: Session, section_id: int, section_in: SectionUpdate
    ) -> Section:
        db_obj = self.get_section_by_id(db, section_id)
        if db_obj.form_version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )

        if section_in.default_next_section_id is not None:
            is_cycle, cycle_path = would_create_cycle_with_path(
                db,
                from_section_id=section_id,
                proposed_to_section_id=section_in.default_next_section_id,
                is_updating_default_next=True,
            )
            if is_cycle:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"This default next section would create a routing cycle: {cycle_path}",
                )

        return section_repository.update(db, db_obj=db_obj, obj_in=section_in)

    def delete_section(self, db: Session, section_id: int) -> Section:
        db_obj = self.get_section_by_id(db, section_id)
        if db_obj.form_version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )
        return section_repository.delete(db, section_id=section_id)

    def reorder_sections(
        self, db: Session, form_version_id: int, ordered_ids: List[int]
    ) -> List[Section]:
        sections = section_repository.get_by_form_version(
            db, form_version_id, limit=10000
        )
        if set(ordered_ids) != {s.id for s in sections} or len(ordered_ids) != len(
            sections
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="section_ids must contain every section in this form version exactly once.",
            )
        return section_repository.bulk_reorder(db, form_version_id, ordered_ids)

    def assert_owns_parent_form(
        self, db: Session, section_id: int, current_user: User
    ) -> Section:
        """Verify the authenticated user owns the form containing this section."""
        section = self.get_section_by_id(db, section_id)
        if section.form_version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this section.",
            )
        return section


section_service = SectionService()
