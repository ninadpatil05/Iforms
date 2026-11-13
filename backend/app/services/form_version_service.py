import secrets
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.form_version import FormVersion
from app.models.field import Field
from app.models.user import User
from app.repositories.form_version_repository import form_version_repository
from app.services.form_service import form_service
from app.schemas.form_version import FormVersionCreate, FormVersionUpdate


class FormVersionService:
    def _generate_public_link(self, db: Session) -> str:
        for _ in range(10):
            public_link = secrets.token_urlsafe(8)
            if not form_version_repository.get_published_by_link(db, public_link):
                return public_link
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not generate a public link.")

    def publish_draft(self, db: Session, form_id: int, force_new_link: bool = False) -> FormVersion:
        """Publish the active draft snapshot and immediately clone a new editable draft."""
        form = form_service.get_form_by_id(db, form_id)
        draft = form_version_repository.get_draft_by_form(db, form_id)
        if not draft:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No draft version is available to publish.")

        current_published = form_version_repository.get_published_by_form(db, form_id)
        if force_new_link or not current_published or not current_published.public_link:
            public_link = self._generate_public_link(db)
        else:
            public_link = current_published.public_link

        if current_published:
            current_published.is_published = False
            current_published.public_link = None
            db.flush()

        draft.is_published = True
        draft.published_at = datetime.now(timezone.utc)
        draft.public_link = public_link
        form.status = "published"
        db.flush()

        next_version_number = form_version_repository.get_latest_version_number(db, form_id) + 1
        next_draft = FormVersion(form_id=form_id, version_number=next_version_number, is_published=False)
        db.add(next_draft)
        db.flush()

        # Clone sections first, building a mapping old_section_id → new_section object and ID
        from app.models.section import Section
        from app.models.branch_rule import SectionBranchRule
        section_id_map: dict[int, int] = {}
        section_obj_map: dict[int, Section] = {}
        for section in draft.sections:
            new_section = Section(
                form_version_id=next_draft.id,
                title=section.title,
                description=section.description,
                display_order=section.display_order,
            )
            db.add(new_section)
            db.flush()
            section_id_map[section.id] = new_section.id
            section_obj_map[section.id] = new_section

        # Clone fields, preserving section assignments via the id map and building field_id_map
        field_id_map: dict[int, int] = {}
        for field in draft.fields:
            new_field = Field(
                form_version_id=next_draft.id,
                section_id=section_id_map.get(field.section_id) if field.section_id is not None else None,
                label=field.label,
                field_type=field.field_type,
                placeholder=field.placeholder,
                required=field.required,
                options_json=field.options_json,
                validation_json=field.validation_json,
                display_order=field.display_order,
            )
            db.add(new_field)
            db.flush()
            field_id_map[field.id] = new_field.id

        # Second pass: remap default_next_section_id and clone branch rules
        for section in draft.sections:
            if section.default_next_section_id is not None:
                new_sec = section_obj_map[section.id]
                new_sec.default_next_section_id = section_id_map.get(section.default_next_section_id)

            for rule in section.outgoing_rules:
                db.add(SectionBranchRule(
                    from_section_id=section_id_map[rule.from_section_id],
                    to_section_id=section_id_map.get(rule.to_section_id) if rule.to_section_id is not None else None,
                    trigger_field_id=field_id_map[rule.trigger_field_id],
                    operator=rule.operator,
                    comparison_value=rule.comparison_value,
                    priority=rule.priority,
                ))

        # Clone condition groups
        from app.models.condition_group import ConditionGroup, ConditionGroupCondition
        from app.models.conditional_rule import ConditionalRule

        for group in draft.condition_groups:
            new_group = ConditionGroup(
                form_version_id=next_draft.id,
                target_field_id=field_id_map[group.target_field_id],
                action=group.action,
                combinator=group.combinator,
            )
            db.add(new_group)
            db.flush()
            for cond in group.conditions:
                db.add(ConditionGroupCondition(
                    group_id=new_group.id,
                    trigger_field_id=field_id_map[cond.trigger_field_id],
                    operator=cond.operator,
                    comparison_value=cond.comparison_value,
                    display_order=cond.display_order,
                ))

        # Clone legacy conditional rules
        for rule in draft.conditional_rules:
            db.add(ConditionalRule(
                form_version_id=next_draft.id,
                trigger_field_id=field_id_map[rule.trigger_field_id],
                operator=rule.operator,
                comparison_value=rule.comparison_value,
                target_field_id=field_id_map[rule.target_field_id],
                action=rule.action,
            ))

        # Remap computed field formula terms in the cloned draft
        import json
        for new_field in next_draft.fields:
            if new_field.field_type == "computed" and new_field.validation_json:
                try:
                    cfg = json.loads(new_field.validation_json)
                    if "terms" in cfg and isinstance(cfg["terms"], list):
                        for i, t in enumerate(cfg["terms"]):
                            if i % 2 == 0 and "field_id" in t and t["field_id"] in field_id_map:
                                t["field_id"] = field_id_map[t["field_id"]]
                        new_field.validation_json = json.dumps(cfg)
                except Exception:
                    pass

        db.commit()


        db.refresh(draft)
        return draft

    def unpublish_form(self, db: Session, form_id: int) -> None:
        form = form_service.get_form_by_id(db, form_id)
        published = form_version_repository.get_published_by_form(db, form_id)
        if not published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This form is not published.")
        published.is_published = False
        published.public_link = None
        form.status = "draft"
        db.commit()

    def get_public_version(self, db: Session, public_link: str) -> FormVersion:
        version = form_version_repository.get_published_by_link(db, public_link)
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Published form not found.")
        return version

    def get_public_version_for_form(self, db: Session, form_id: int) -> FormVersion:
        version = form_version_repository.get_published_by_form(db, form_id)
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This form is not published.")
        return version

    def create_version(self, db: Session, version_in: FormVersionCreate) -> FormVersion:
        form_service.get_form_by_id(db, version_in.form_id)
        latest_version = form_version_repository.get_latest_version_number(db, version_in.form_id)
        next_version = latest_version + 1

        published_at = None
        public_link = None

        if version_in.is_published:
            form_version_repository.unpublish_all_versions(db, version_in.form_id)
            published_at = datetime.now(timezone.utc)
            public_link = self._generate_public_link(db)

        version = form_version_repository.create(
            db,
            form_id=version_in.form_id,
            version_number=next_version,
            is_published=version_in.is_published,
            published_at=published_at,
            public_link=public_link,
        )
        return version


    def get_version_by_id(self, db: Session, version_id: int) -> FormVersion:
        version = form_version_repository.get_by_id(db, version_id)
        if not version:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Form version with ID {version_id} not found.")
        return version

    def get_versions_by_form(self, db: Session, form_id: int) -> List[FormVersion]:
        form_service.get_form_by_id(db, form_id)
        return form_version_repository.get_by_form(db, form_id)

    def update_version(self, db: Session, version_id: int, version_in: FormVersionUpdate) -> FormVersion:
        version = self.get_version_by_id(db, version_id)

        update_data = version_in.model_dump(exclude_unset=True)

        if "is_published" in update_data and update_data["is_published"]:
            if not version.is_published:
                form_version_repository.unpublish_all_versions(db, version.form_id)
                update_data["published_at"] = datetime.now(timezone.utc)
                if not version.public_link:
                    update_data["public_link"] = self._generate_public_link(db)
        elif "is_published" in update_data and not update_data["is_published"]:
            update_data["public_link"] = None

        return form_version_repository.update(db, db_obj=version, obj_in=update_data)

    def delete_version(self, db: Session, version_id: int) -> FormVersion:
        version = self.get_version_by_id(db, version_id)
        if version.is_published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete a published version.")
        return form_version_repository.delete(db, version_id)

    def assert_owns_parent_form(self, db: Session, form_version_id: int, current_user: User) -> FormVersion:
        version = self.get_version_by_id(db, form_version_id)
        if version.form.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to access this form version.")
        return version


form_version_service = FormVersionService()
