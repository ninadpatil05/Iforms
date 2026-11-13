from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.condition_group import ConditionGroup, ConditionGroupCondition
from app.schemas.condition_group import ConditionGroupCreate, ConditionGroupUpdate


class ConditionGroupRepository:
    def get_by_id(self, db: Session, group_id: int) -> Optional[ConditionGroup]:
        statement = select(ConditionGroup).where(ConditionGroup.id == group_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_form_version(self, db: Session, form_version_id: int) -> List[ConditionGroup]:
        statement = (
            select(ConditionGroup)
            .where(ConditionGroup.form_version_id == form_version_id)
            .order_by(ConditionGroup.id.asc())
        )
        return list(db.execute(statement).scalars().all())

    def get_by_target_field(self, db: Session, target_field_id: int) -> List[ConditionGroup]:
        statement = (
            select(ConditionGroup)
            .where(ConditionGroup.target_field_id == target_field_id)
            .order_by(ConditionGroup.id.asc())
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, group_in: ConditionGroupCreate) -> ConditionGroup:
        action_val = group_in.action.value if hasattr(group_in.action, "value") else str(group_in.action)
        combinator_val = group_in.combinator.value if hasattr(group_in.combinator, "value") else str(group_in.combinator)

        db_obj = ConditionGroup(
            form_version_id=group_in.form_version_id,
            target_field_id=group_in.target_field_id,
            action=action_val,
            combinator=combinator_val,
        )
        db.add(db_obj)
        db.flush()

        for idx, cond_in in enumerate(group_in.conditions):
            op_val = cond_in.operator.value if hasattr(cond_in.operator, "value") else str(cond_in.operator)
            cond_obj = ConditionGroupCondition(
                group_id=db_obj.id,
                trigger_field_id=cond_in.trigger_field_id,
                operator=op_val,
                comparison_value=cond_in.comparison_value,
                display_order=idx,
            )
            db.add(cond_obj)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: ConditionGroup,
        obj_in: Union[ConditionGroupUpdate, Dict[str, Any]],
    ) -> ConditionGroup:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)

        if "action" in update_data and update_data["action"] is not None:
            val = update_data["action"]
            db_obj.action = val.value if hasattr(val, "value") else str(val)

        if "combinator" in update_data and update_data["combinator"] is not None:
            val = update_data["combinator"]
            db_obj.combinator = val.value if hasattr(val, "value") else str(val)

        if "conditions" in update_data and update_data["conditions"] is not None:
            # Full replace of group conditions
            db_obj.conditions.clear()
            db.flush()

            raw_conditions = update_data["conditions"]
            for idx, cond_item in enumerate(raw_conditions):
                trigger_id = cond_item["trigger_field_id"] if isinstance(cond_item, dict) else cond_item.trigger_field_id
                op = cond_item["operator"] if isinstance(cond_item, dict) else cond_item.operator
                op_val = op.value if hasattr(op, "value") else str(op)
                cmp_val = cond_item.get("comparison_value") if isinstance(cond_item, dict) else cond_item.comparison_value

                cond_obj = ConditionGroupCondition(
                    group_id=db_obj.id,
                    trigger_field_id=trigger_id,
                    operator=op_val,
                    comparison_value=cmp_val,
                    display_order=idx,
                )
                db.add(cond_obj)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, group_id: int) -> Optional[ConditionGroup]:
        db_obj = self.get_by_id(db, group_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


condition_group_repository = ConditionGroupRepository()
