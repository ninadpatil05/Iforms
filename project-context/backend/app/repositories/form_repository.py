from typing import List, Optional, Union, Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.form import Form
from app.schemas.form import FormCreate, FormUpdate, FormStatus


class FormRepository:
    def get_by_id(self, db: Session, form_id: int) -> Optional[Form]:
        """Fetch a single form by its primary key ID."""
        statement = select(Form).where(Form.id == form_id)
        return db.execute(statement).scalar_one_or_none()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[Form]:
        """Fetch a paginated list of all forms."""
        statement = select(Form).offset(skip).limit(limit)
        return list(db.execute(statement).scalars().all())

    def get_by_owner(self, db: Session, owner_id: int, skip: int = 0, limit: int = 100) -> List[Form]:
        """Fetch a paginated list of forms owned by a specific user."""
        statement = select(Form).where(Form.owner_id == owner_id).offset(skip).limit(limit)
        return list(db.execute(statement).scalars().all())

    def get_by_owner_ordered(
        self,
        db: Session,
        owner_id: int,
        include_archived: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Form]:
        """
        Fetch a paginated list of forms owned by a specific user, ordered by
        created_at descending (newest first).  By default archived forms are
        excluded; pass include_archived=True to include them.
        """
        statement = select(Form).where(Form.owner_id == owner_id)
        if not include_archived:
            statement = statement.where(Form.status != FormStatus.ARCHIVED.value)
        statement = statement.order_by(Form.created_at.desc()).offset(skip).limit(limit)
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, form_in: FormCreate) -> Form:
        """Create and persist a new Form record."""
        db_obj = Form(
            owner_id=form_in.owner_id,
            title=form_in.title,
            description=form_in.description,
            status=form_in.status.value if hasattr(form_in.status, "value") else form_in.status,
            access_mode=form_in.access_mode,
            allow_resubmission=form_in.allow_resubmission,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Form, obj_in: Union[FormUpdate, Dict[str, Any]]) -> Form:
        """Update an existing Form record with new data."""
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field == "status" and value is not None and hasattr(value, "value"):
                value = value.value
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, form_id: int) -> Optional[Form]:
        """Delete a Form record by its ID if it exists."""
        db_obj = self.get_by_id(db, form_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


form_repository = FormRepository()
