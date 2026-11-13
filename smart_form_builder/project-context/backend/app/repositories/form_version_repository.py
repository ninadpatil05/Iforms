from datetime import datetime
from typing import List, Optional, Union, Dict, Any
from sqlalchemy import select, func, update
from sqlalchemy.orm import Session

from app.models.form_version import FormVersion
from app.schemas.form_version import FormVersionCreate, FormVersionUpdate


class FormVersionRepository:
    def get_by_id(self, db: Session, version_id: int) -> Optional[FormVersion]:
        """Fetch a single form version by its primary key ID."""
        statement = select(FormVersion).where(FormVersion.id == version_id)
        return db.execute(statement).scalar_one_or_none()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[FormVersion]:
        """Fetch a paginated list of all form versions."""
        statement = select(FormVersion).offset(skip).limit(limit)
        return list(db.execute(statement).scalars().all())

    def get_by_form(self, db: Session, form_id: int, skip: int = 0, limit: int = 100) -> List[FormVersion]:
        """Fetch a paginated list of versions belonging to a specific form."""
        statement = (
            select(FormVersion)
            .where(FormVersion.form_id == form_id)
            .order_by(FormVersion.version_number.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.execute(statement).scalars().all())

    def get_latest_version_number(self, db: Session, form_id: int) -> int:
        """Retrieve the maximum version number assigned to a specific form (returns 0 if none exist)."""
        statement = select(func.max(FormVersion.version_number)).where(FormVersion.form_id == form_id)
        result = db.execute(statement).scalar()
        return result if result is not None else 0

    def get_draft_by_form(self, db: Session, form_id: int) -> Optional[FormVersion]:
        statement = select(FormVersion).where(
            FormVersion.form_id == form_id, FormVersion.is_published.is_(False)
        ).order_by(FormVersion.version_number.desc())
        return db.execute(statement).scalars().first()

    def get_published_by_link(self, db: Session, public_link: str) -> Optional[FormVersion]:
        statement = select(FormVersion).where(
            FormVersion.public_link == public_link,
            FormVersion.is_published.is_(True),
        )
        return db.execute(statement).scalar_one_or_none()

    def get_published_by_form(self, db: Session, form_id: int) -> Optional[FormVersion]:
        statement = select(FormVersion).where(
            FormVersion.form_id == form_id,
            FormVersion.is_published.is_(True),
        )
        return db.execute(statement).scalar_one_or_none()

    def unpublish_all_versions(self, db: Session, form_id: int) -> None:
        """
        Unpublish all versions of a specific form.
        Keeps published_at unchanged, only sets is_published = False and public_link = None.
        """
        statement = (
            update(FormVersion)
            .where(FormVersion.form_id == form_id)
            .values(is_published=False, public_link=None)
        )
        db.execute(statement)
        db.commit()

    def create(
        self,
        db: Session,
        form_id: int,
        version_number: int,
        is_published: bool = False,
        published_at: Optional[datetime] = None,
        public_link: Optional[str] = None
    ) -> FormVersion:
        """Create and persist a new FormVersion record."""
        db_obj = FormVersion(
            form_id=form_id,
            version_number=version_number,
            is_published=is_published,
            published_at=published_at,
            public_link=public_link,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: FormVersion,
        obj_in: Union[FormVersionUpdate, Dict[str, Any]]
    ) -> FormVersion:
        """Update an existing FormVersion record."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, version_id: int) -> Optional[FormVersion]:
        """Delete a FormVersion record by its ID."""
        db_obj = self.get_by_id(db, version_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


form_version_repository = FormVersionRepository()
