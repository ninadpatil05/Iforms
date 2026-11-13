import json
from typing import Any, Dict, List, Optional, Union
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from app.models.field import Field
from app.schemas.field import FieldCreate, FieldUpdate


class FieldRepository:
    @staticmethod
    def _storage_data(data: Dict[str, Any]) -> Dict[str, Any]:
        data = data.copy()
        if "options" in data:
            options = data.pop("options")
            data["options_json"] = json.dumps(options) if options is not None else None
        if "validation_config" in data:
            validation_config = data.pop("validation_config")
            data["validation_json"] = json.dumps(validation_config) if validation_config is not None else None
        return data

    def get_by_id(self, db: Session, field_id: int) -> Optional[Field]:
        statement = select(Field).where(Field.id == field_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_form_version(self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200) -> List[Field]:
        statement = (
            select(Field)
            .where(Field.form_version_id == form_version_id)
            .order_by(Field.display_order.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, field_in: FieldCreate) -> Field:
        data = self._storage_data(field_in.model_dump())
        data["field_type"] = field_in.field_type.value
        db_obj = Field(**data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: Field, obj_in: Union[FieldUpdate, Dict[str, Any]]) -> Field:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        update_data = self._storage_data(update_data)
        for field, value in update_data.items():
            if field == "field_type" and value is not None and hasattr(value, "value"):
                value = value.value
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def bulk_reorder(self, db: Session, form_version_id: int, ordered_ids: List[int]) -> List[Field]:
        order_case = case({field_id: index for index, field_id in enumerate(ordered_ids)}, value=Field.id)
        db.query(Field).filter(Field.form_version_id == form_version_id, Field.id.in_(ordered_ids)).update(
            {Field.display_order: order_case}, synchronize_session=False
        )
        db.commit()
        return self.get_by_form_version(db, form_version_id, limit=len(ordered_ids))

    def delete(self, db: Session, field_id: int) -> Optional[Field]:
        db_obj = self.get_by_id(db, field_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


field_repository = FieldRepository()
