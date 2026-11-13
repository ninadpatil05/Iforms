from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.response_value import ResponseValue
from app.schemas.response_value import ResponseValueCreate, ResponseValueUpdate


class ResponseValueRepository:
    def get_by_id(self, db: Session, rv_id: int) -> Optional[ResponseValue]:
        statement = select(ResponseValue).where(ResponseValue.id == rv_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_submission(self, db: Session, submission_id: int) -> List[ResponseValue]:
        statement = select(ResponseValue).where(ResponseValue.submission_id == submission_id)
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, submission_id: int, field_id: int, value_text: Optional[str] = None, file_url: Optional[str] = None) -> ResponseValue:
        db_obj = ResponseValue(
            submission_id=submission_id,
            field_id=field_id,
            value_text=value_text,
            file_url=file_url,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ResponseValue, obj_in: Union[ResponseValueUpdate, Dict[str, Any]]) -> ResponseValue:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, rv_id: int) -> Optional[ResponseValue]:
        db_obj = self.get_by_id(db, rv_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj

    def get_open_text_by_field(
        self,
        db: Session,
        form_version_id: int,
        exclude_field_types: Optional[List[str]] = None,
        max_per_field: int = 500,
    ) -> Dict[int, Dict[str, Any]]:
        """
        Returns a dict mapping field_id -> {"field_id": int, "label": str, "field_type": str, "values": List[str]}
        across all submitted submissions of form_version_id.
        Excludes field_types in exclude_field_types (default: ["email"]).
        Caps each field's values list at max_per_field (most recent first).
        """
        if exclude_field_types is None:
            exclude_field_types = ["email"]

        from app.models.field import Field
        from app.models.submission import Submission

        statement = (
            select(
                ResponseValue.field_id,
                Field.label,
                Field.field_type,
                ResponseValue.value_text,
            )
            .join(Submission, ResponseValue.submission_id == Submission.id)
            .join(Field, ResponseValue.field_id == Field.id)
            .where(
                Field.form_version_id == form_version_id,
                Submission.status == "submitted",
                ResponseValue.value_text.isnot(None),
                ResponseValue.value_text != "",
            )
            .order_by(Submission.submitted_at.desc())
        )

        if exclude_field_types:
            statement = statement.where(Field.field_type.notin_(exclude_field_types))

        results = db.execute(statement).all()

        field_map: Dict[int, Dict[str, Any]] = {}
        for f_id, label, f_type, val_text in results:
            ft_str = f_type.value if hasattr(f_type, "value") else str(f_type)
            if f_id not in field_map:
                field_map[f_id] = {
                    "field_id": f_id,
                    "label": label,
                    "field_type": ft_str,
                    "values": [],
                }
            if len(field_map[f_id]["values"]) < max_per_field:
                field_map[f_id]["values"].append(val_text)

        return field_map

    def count_responses_per_field(self, db: Session, form_version_id: int) -> Dict[int, int]:
        """
        Returns a dict mapping field_id -> count of non-null response_values
        across all submitted submissions of form_version_id.
        """
        from sqlalchemy import func
        from app.models.field import Field
        from app.models.submission import Submission

        statement = (
            select(ResponseValue.field_id, func.count(ResponseValue.id))
            .join(Submission, ResponseValue.submission_id == Submission.id)
            .join(Field, ResponseValue.field_id == Field.id)
            .where(
                Field.form_version_id == form_version_id,
                Submission.status == "submitted",
                ResponseValue.value_text.isnot(None),
                ResponseValue.value_text != "",
            )
            .group_by(ResponseValue.field_id)
        )
        rows = db.execute(statement).all()
        return {field_id: count for field_id, count in rows}

    def find_matching_submission(
        self,
        db: Session,
        form_version_id: int,
        field_id: int,
        value_text: str,
        exclude_submission_id: Optional[int] = None,
    ) -> Optional[Any]:
        """
        Finds the first submitted submission (status="submitted") in form_version_id
        whose ResponseValue for field_id matches value_text (case-insensitive trim),
        excluding exclude_submission_id.
        """
        from sqlalchemy import func
        from app.models.submission import Submission

        if not value_text:
            return None

        clean_val = value_text.strip().lower()

        statement = (
            select(Submission)
            .join(ResponseValue, ResponseValue.submission_id == Submission.id)
            .where(
                Submission.form_version_id == form_version_id,
                Submission.status == "submitted",
                ResponseValue.field_id == field_id,
                ResponseValue.value_text.isnot(None),
                func.lower(func.trim(ResponseValue.value_text)) == clean_val,
            )
        )

        if exclude_submission_id is not None:
            statement = statement.where(Submission.id != exclude_submission_id)

        return db.execute(statement).scalars().first()


response_value_repository = ResponseValueRepository()


