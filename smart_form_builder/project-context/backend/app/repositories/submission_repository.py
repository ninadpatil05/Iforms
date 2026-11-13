from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.submission import Submission
from app.models.response_value import ResponseValue
from app.schemas.submission import SubmissionCreate, SubmissionUpdate


class SubmissionRepository:
    def get_by_id(self, db: Session, submission_id: int) -> Optional[Submission]:
        statement = select(Submission).where(Submission.id == submission_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_form_version(self, db: Session, form_version_id: int, skip: int = 0, limit: Optional[int] = None) -> List[Submission]:
        statement = (
            select(Submission)
            .where(Submission.form_version_id == form_version_id)
            .order_by(Submission.started_at.desc())
        )
        if skip > 0:
            statement = statement.offset(skip)
        if limit is not None:
            statement = statement.limit(limit)
        return list(db.execute(statement).scalars().all())

    def get_by_form(self, db: Session, form_id: int, skip: int = 0, limit: Optional[int] = None) -> List[Submission]:
        statement = (
            select(Submission)
            .join(Submission.form_version)
            .where(Submission.form_version.has(form_id=form_id), Submission.status == "submitted")
            .options(selectinload(Submission.form_version), selectinload(Submission.response_values).selectinload(ResponseValue.field))
            .order_by(Submission.submitted_at.desc())
        )
        if skip > 0:
            statement = statement.offset(skip)
        if limit is not None:
            statement = statement.limit(limit)
        return list(db.execute(statement).scalars().all())

    def get_filtered_by_form(
        self,
        db: Session,
        form_id: int,
        status: Optional[str] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> List[Submission]:
        statement = (
            select(Submission)
            .join(Submission.form_version)
            .where(Submission.form_version.has(form_id=form_id))
            .options(
                selectinload(Submission.form_version),
                selectinload(Submission.response_values).selectinload(ResponseValue.field),
            )
            .order_by(Submission.started_at.desc())
        )
        if status is not None:
            statement = statement.where(Submission.status == status)
        if date_from is not None:
            statement = statement.where(Submission.started_at >= date_from)
        if date_to is not None:
            statement = statement.where(Submission.started_at <= date_to)
        if search:
            statement = statement.where(Submission.respondent_identifier.ilike(f"%{search}%"))

        if skip > 0:
            statement = statement.offset(skip)
        if limit is not None:
            statement = statement.limit(limit)

        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, submission_in: SubmissionCreate) -> Submission:
        db_obj = Submission(
            form_version_id=submission_in.form_version_id,
            respondent_identifier=submission_in.respondent_identifier,
            status="in_progress",
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Submission, obj_in: Union[SubmissionUpdate, Dict[str, Any]]) -> Submission:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(value, "value"):
                value = value.value
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, submission_id: int) -> Optional[Submission]:
        db_obj = self.get_by_id(db, submission_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


submission_repository = SubmissionRepository()
