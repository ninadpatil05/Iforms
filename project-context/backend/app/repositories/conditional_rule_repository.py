from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conditional_rule import ConditionalRule
from app.schemas.conditional_rule import ConditionalRuleCreate, ConditionalRuleUpdate


class ConditionalRuleRepository:
    def get_by_id(self, db: Session, rule_id: int) -> Optional[ConditionalRule]:
        statement = select(ConditionalRule).where(ConditionalRule.id == rule_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_form_version(self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200) -> List[ConditionalRule]:
        statement = (
            select(ConditionalRule)
            .where(ConditionalRule.form_version_id == form_version_id)
            .offset(skip)
            .limit(limit)
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, rule_in: ConditionalRuleCreate) -> ConditionalRule:
        db_obj = ConditionalRule(
            form_version_id=rule_in.form_version_id,
            trigger_field_id=rule_in.trigger_field_id,
            operator=rule_in.operator.value,
            comparison_value=rule_in.comparison_value,
            target_field_id=rule_in.target_field_id,
            action=rule_in.action.value,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ConditionalRule, obj_in: Union[ConditionalRuleUpdate, Dict[str, Any]]) -> ConditionalRule:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(value, "value"):
                value = value.value
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, rule_id: int) -> Optional[ConditionalRule]:
        db_obj = self.get_by_id(db, rule_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


conditional_rule_repository = ConditionalRuleRepository()
