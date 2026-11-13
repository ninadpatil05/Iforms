from typing import Any, Dict, List, Optional, Union

from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.models.section import Section
from app.schemas.section import SectionCreate, SectionUpdate


class SectionRepository:
    def get_by_id(self, db: Session, section_id: int) -> Optional[Section]:
        statement = select(Section).where(Section.id == section_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_form_version(
        self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200
    ) -> List[Section]:
        statement = (
            select(Section)
            .where(Section.form_version_id == form_version_id)
            .order_by(Section.display_order.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, section_in: SectionCreate) -> Section:
        db_obj = Section(**section_in.model_dump())
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: Section,
        obj_in: Union[SectionUpdate, Dict[str, Any]],
    ) -> Section:
        update_data = (
            obj_in
            if isinstance(obj_in, dict)
            else obj_in.model_dump(exclude_unset=True)
        )
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def bulk_reorder(
        self, db: Session, form_version_id: int, ordered_ids: List[int]
    ) -> List[Section]:
        order_case = case(
            {section_id: index for index, section_id in enumerate(ordered_ids)},
            value=Section.id,
        )
        db.query(Section).filter(
            Section.form_version_id == form_version_id,
            Section.id.in_(ordered_ids),
        ).update({Section.display_order: order_case}, synchronize_session=False)
        db.commit()
        return self.get_by_form_version(db, form_version_id, limit=len(ordered_ids))

    def delete(self, db: Session, section_id: int) -> Optional[Section]:
        db_obj = self.get_by_id(db, section_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


section_repository = SectionRepository()
