from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.branch_rule import SectionBranchRule
from app.models.section import Section
from app.models.user import User
from app.repositories.branch_rule_repository import branch_rule_repository
from app.repositories.field_repository import field_repository
from app.repositories.section_repository import section_repository
from app.schemas.branch_rule import BranchRuleCreate, BranchRuleUpdate
from app.services.section_service import section_service
from app.utils.cycle_detection import would_create_cycle_with_path


class BranchRuleService:
    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _validate_rule_belongs_to_version(
        self,
        db: Session,
        from_section: Section,
        trigger_field_id: int,
        to_section_id: Optional[int],
    ) -> None:
        trigger_field = field_repository.get_by_id(db, trigger_field_id)
        if not trigger_field:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trigger field with ID {trigger_field_id} not found.",
            )

        if trigger_field.form_version_id != from_section.form_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trigger field does not belong to the same form version as the section.",
            )

        if to_section_id is not None:
            if to_section_id == from_section.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A section cannot branch to itself.",
                )

            to_section = section_repository.get_by_id(db, to_section_id)
            if not to_section:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Target section with ID {to_section_id} not found.",
                )

            if to_section.form_version_id != from_section.form_version_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target section does not belong to the same form version as the source section.",
                )

    def _check_priority_conflict(
        self,
        db: Session,
        from_section_id: int,
        priority: int,
        exclude_rule_id: Optional[int] = None,
    ) -> None:
        """Raise 409 if another rule in the same from_section already uses this priority."""
        stmt = select(SectionBranchRule).where(
            SectionBranchRule.from_section_id == from_section_id,
            SectionBranchRule.priority == priority,
        )
        if exclude_rule_id is not None:
            stmt = stmt.where(SectionBranchRule.id != exclude_rule_id)
        existing = db.execute(stmt).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Priority {priority} is already used by rule {existing.id} "
                    f"for this section. Choose a different priority or use the "
                    f"reorder endpoint to reassign priorities atomically."
                ),
            )

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------

    def create_rule(
        self, db: Session, rule_in: BranchRuleCreate
    ) -> SectionBranchRule:
        from_section = section_service.get_section_by_id(db, rule_in.from_section_id)
        if from_section.form_version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )

        self._validate_rule_belongs_to_version(
            db,
            from_section=from_section,
            trigger_field_id=rule_in.trigger_field_id,
            to_section_id=rule_in.to_section_id,
        )

        # Enforce unique priority per from_section_id
        self._check_priority_conflict(db, rule_in.from_section_id, rule_in.priority)

        if rule_in.to_section_id is not None:
            is_cycle, cycle_path = would_create_cycle_with_path(
                db, rule_in.from_section_id, rule_in.to_section_id
            )
            if is_cycle:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"This rule would create a routing cycle: {cycle_path}",
                )

        return branch_rule_repository.create(db, rule_in)

    def get_rule_by_id(self, db: Session, rule_id: int) -> SectionBranchRule:
        db_obj = branch_rule_repository.get_by_id(db, rule_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch rule with ID {rule_id} not found.",
            )
        return db_obj

    def get_rules_by_section(
        self, db: Session, from_section_id: int
    ) -> List[SectionBranchRule]:
        section_service.get_section_by_id(db, from_section_id)
        return branch_rule_repository.get_by_from_section(
            db, from_section_id=from_section_id
        )

    def update_rule(
        self, db: Session, rule_id: int, rule_in: BranchRuleUpdate
    ) -> SectionBranchRule:
        db_obj = self.get_rule_by_id(db, rule_id)
        if db_obj.from_section.form_version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )

        target_trigger = (
            rule_in.trigger_field_id
            if rule_in.trigger_field_id is not None
            else db_obj.trigger_field_id
        )
        target_to_section = (
            rule_in.to_section_id
            if rule_in.to_section_id is not None
            else db_obj.to_section_id
        )

        self._validate_rule_belongs_to_version(
            db,
            from_section=db_obj.from_section,
            trigger_field_id=target_trigger,
            to_section_id=target_to_section,
        )

        # Enforce unique priority per from_section_id (only when priority is being updated)
        if rule_in.priority is not None:
            self._check_priority_conflict(
                db, db_obj.from_section_id, rule_in.priority, exclude_rule_id=rule_id
            )

        if target_to_section is not None:
            is_cycle, cycle_path = would_create_cycle_with_path(
                db,
                db_obj.from_section_id,
                target_to_section,
                ignore_rule_id=rule_id,
            )
            if is_cycle:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"This rule would create a routing cycle: {cycle_path}",
                )

        return branch_rule_repository.update(db, db_obj=db_obj, obj_in=rule_in)

    def delete_rule(self, db: Session, rule_id: int) -> SectionBranchRule:
        db_obj = self.get_rule_by_id(db, rule_id)
        if db_obj.from_section.form_version.is_published:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Published versions are immutable.",
            )
        return branch_rule_repository.delete(db, rule_id=rule_id)

    def assert_owns_parent_form(
        self, db: Session, rule_id: int, current_user: User
    ) -> SectionBranchRule:
        rule = self.get_rule_by_id(db, rule_id)
        if rule.from_section.form_version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this branch rule.",
            )
        return rule

    # ------------------------------------------------------------------
    # Reorder
    # ------------------------------------------------------------------

    def reorder_rules(
        self, db: Session, from_section_id: int, ordered_rule_ids: List[int]
    ) -> List[SectionBranchRule]:
        """Atomically reassign priorities 0, 1, 2... to rules in the given order.

        All rule IDs must belong to from_section_id and the list must cover
        every rule in that section exactly once.
        """
        existing_rules = branch_rule_repository.get_by_from_section(db, from_section_id)
        existing_ids = {r.id for r in existing_rules}

        if set(ordered_rule_ids) != existing_ids or len(ordered_rule_ids) != len(existing_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "rule_ids must contain every branch rule for this section exactly once. "
                    f"Expected IDs: {sorted(existing_ids)}"
                ),
            )

        rule_map = {r.id: r for r in existing_rules}
        updated: List[SectionBranchRule] = []
        for new_priority, rule_id in enumerate(ordered_rule_ids):
            rule = rule_map[rule_id]
            rule.priority = new_priority
            db.add(rule)
            updated.append(rule)

        db.commit()
        for r in updated:
            db.refresh(r)
        return updated


branch_rule_service = BranchRuleService()
