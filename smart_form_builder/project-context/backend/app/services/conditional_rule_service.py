from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.conditional_rule import ConditionalRule
from app.models.user import User
from app.repositories.conditional_rule_repository import conditional_rule_repository
from app.services.form_version_service import form_version_service
from app.services.field_service import field_service
from app.schemas.conditional_rule import ConditionalRuleCreate, ConditionalRuleUpdate


class ConditionalRuleService:
    def _validate_fields_belong_to_version(
        self, db: Session, form_version_id: int, trigger_field_id: int, target_field_id: int
    ) -> None:
        """Ensure both referenced fields exist and belong to the given form version."""
        trigger = field_service.get_field_by_id(db, trigger_field_id)
        if trigger.form_version_id != form_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trigger field {trigger_field_id} does not belong to form version {form_version_id}.",
            )
        target = field_service.get_field_by_id(db, target_field_id)
        if target.form_version_id != form_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Target field {target_field_id} does not belong to form version {form_version_id}.",
            )
        if trigger_field_id == target_field_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trigger field and target field must be different.",
            )

    def create_rule(self, db: Session, rule_in: ConditionalRuleCreate) -> ConditionalRule:
        form_version_service.get_version_by_id(db, rule_in.form_version_id)
        self._validate_fields_belong_to_version(
            db, rule_in.form_version_id, rule_in.trigger_field_id, rule_in.target_field_id
        )
        return conditional_rule_repository.create(db, rule_in)

    def get_rule_by_id(self, db: Session, rule_id: int) -> ConditionalRule:
        db_obj = conditional_rule_repository.get_by_id(db, rule_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Conditional rule with ID {rule_id} not found.",
            )
        return db_obj

    def get_rules_by_version(self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200) -> List[ConditionalRule]:
        form_version_service.get_version_by_id(db, form_version_id)
        return conditional_rule_repository.get_by_form_version(db, form_version_id=form_version_id, skip=skip, limit=limit)

    def update_rule(self, db: Session, rule_id: int, rule_in: ConditionalRuleUpdate) -> ConditionalRule:
        db_obj = self.get_rule_by_id(db, rule_id)
        return conditional_rule_repository.update(db, db_obj=db_obj, obj_in=rule_in)

    def delete_rule(self, db: Session, rule_id: int) -> ConditionalRule:
        db_obj = self.get_rule_by_id(db, rule_id)
        return conditional_rule_repository.delete(db, rule_id=rule_id)

    def assert_owns_parent_form(self, db: Session, rule_id: int, current_user: User) -> ConditionalRule:
        """Verify the authenticated user owns the form containing this conditional rule."""
        rule = self.get_rule_by_id(db, rule_id)
        if rule.form_version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this conditional rule.",
            )
        return rule


conditional_rule_service = ConditionalRuleService()
