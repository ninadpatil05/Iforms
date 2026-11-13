from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.branch_rule import SectionBranchRule
from app.schemas.branch_rule import BranchRuleCreate, BranchRuleUpdate


class BranchRuleRepository:
    def get_by_id(self, db: Session, rule_id: int) -> Optional[SectionBranchRule]:
        statement = select(SectionBranchRule).where(SectionBranchRule.id == rule_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_from_section(
        self, db: Session, from_section_id: int
    ) -> List[SectionBranchRule]:
        statement = (
            select(SectionBranchRule)
            .where(SectionBranchRule.from_section_id == from_section_id)
            .order_by(SectionBranchRule.priority.asc(), SectionBranchRule.id.asc())
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, rule_in: BranchRuleCreate) -> SectionBranchRule:
        db_obj = SectionBranchRule(
            from_section_id=rule_in.from_section_id,
            to_section_id=rule_in.to_section_id,
            trigger_field_id=rule_in.trigger_field_id,
            operator=rule_in.operator.value if hasattr(rule_in.operator, "value") else str(rule_in.operator),
            comparison_value=rule_in.comparison_value,
            priority=rule_in.priority,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: SectionBranchRule,
        obj_in: Union[BranchRuleUpdate, Dict[str, Any]],
    ) -> SectionBranchRule:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None and hasattr(value, "value"):
                value = value.value
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, rule_id: int) -> Optional[SectionBranchRule]:
        db_obj = self.get_by_id(db, rule_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


branch_rule_repository = BranchRuleRepository()
