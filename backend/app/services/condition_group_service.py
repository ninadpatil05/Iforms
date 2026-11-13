from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.condition_group import ConditionGroup
from app.models.user import User
from app.repositories.condition_group_repository import condition_group_repository
from app.services.form_version_service import form_version_service
from app.services.field_service import field_service
from app.schemas.condition_group import ConditionGroupCreate, ConditionGroupUpdate


class ConditionGroupService:
    def _validate_fields_belong_to_version(
        self, db: Session, form_version_id: int, target_field_id: int, trigger_field_ids: List[int]
    ) -> None:
        target = field_service.get_field_by_id(db, target_field_id)
        if target.form_version_id != form_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target field {target_field_id} does not belong to form version {form_version_id}.",
            )
        for trig_id in trigger_field_ids:
            trig = field_service.get_field_by_id(db, trig_id)
            if trig.form_version_id != form_version_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Trigger field {trig_id} does not belong to form version {form_version_id}.",
                )

    def create_group(self, db: Session, group_in: ConditionGroupCreate) -> ConditionGroup:
        form_version_service.get_version_by_id(db, group_in.form_version_id)
        trigger_ids = [c.trigger_field_id for c in group_in.conditions]
        self._validate_fields_belong_to_version(
            db, group_in.form_version_id, group_in.target_field_id, trigger_ids
        )
        return condition_group_repository.create(db, group_in)

    def get_group_by_id(self, db: Session, group_id: int) -> ConditionGroup:
        db_obj = condition_group_repository.get_by_id(db, group_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Condition group with ID {group_id} not found.",
            )
        return db_obj

    def get_groups_by_version(self, db: Session, form_version_id: int) -> List[ConditionGroup]:
        form_version_service.get_version_by_id(db, form_version_id)
        return condition_group_repository.get_by_form_version(db, form_version_id)

    def get_groups_by_target_field(self, db: Session, target_field_id: int) -> List[ConditionGroup]:
        return condition_group_repository.get_by_target_field(db, target_field_id)

    def update_group(self, db: Session, group_id: int, group_in: ConditionGroupUpdate) -> ConditionGroup:
        db_obj = self.get_group_by_id(db, group_id)
        if group_in.conditions is not None:
            trigger_ids = [c.trigger_field_id for c in group_in.conditions]
            self._validate_fields_belong_to_version(
                db, db_obj.form_version_id, db_obj.target_field_id, trigger_ids
            )
        return condition_group_repository.update(db, db_obj=db_obj, obj_in=group_in)

    def delete_group(self, db: Session, group_id: int) -> ConditionGroup:
        db_obj = self.get_group_by_id(db, group_id)
        return condition_group_repository.delete(db, group_id=group_id)

    def assert_owns_parent_form(self, db: Session, group_id: int, current_user: User) -> ConditionGroup:
        group = self.get_group_by_id(db, group_id)
        if group.form_version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this condition group.",
            )
        return group


condition_group_service = ConditionGroupService()
