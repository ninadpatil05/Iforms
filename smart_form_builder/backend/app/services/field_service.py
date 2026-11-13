import json
from typing import Any, List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.field import Field
from app.models.user import User
from app.repositories.field_repository import field_repository
from app.services.form_version_service import form_version_service
from app.schemas.field import FieldBase, FieldCreate, FieldUpdate


class FieldService:
    def _validate_computed_field_formula(
        self,
        db: Session,
        form_version_id: int,
        field_id_being_edited: Optional[int],
        field_type: Any,
        validation_config: Optional[dict],
    ) -> None:
        ft_str = field_type.value if hasattr(field_type, "value") else str(field_type)
        if ft_str != "computed" or not validation_config:
            return

        terms = validation_config.get("terms", [])
        if not terms:
            return

        operand_ids = [t["field_id"] for i, t in enumerate(terms) if i % 2 == 0 and "field_id" in t]

        # 1. Validate operands exist, belong to same form version, and are numeric/computed
        for op_id in operand_ids:
            if field_id_being_edited is not None and op_id == field_id_being_edited:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A computed field cannot reference itself as an operand.",
                )
            op_field = field_repository.get_by_id(db, op_id)
            if op_field is None or op_field.form_version_id != form_version_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Operand field {op_id} does not belong to form version {form_version_id}.",
                )
            if op_field.field_type not in {"number", "rating", "computed"}:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Computed fields can only reference numeric or computed fields. Field '{op_field.label}' has type '{op_field.field_type}'.",
                )

        # 2. Cycle detection via has_path
        from app.utils.cycle_detection import has_path
        all_fields = field_repository.get_by_form_version(db, form_version_id, limit=10000)

        # Use sentinel -1 as the self-node when creating a new field (no real ID yet).
        # This lets us run the identical cycle check on both create and edit paths.
        SENTINEL = -1
        self_id = field_id_being_edited if field_id_being_edited is not None else SENTINEL

        # Build edges from all other computed fields in the version
        edges: List[tuple[int, int]] = []
        for f in all_fields:
            if f.id == field_id_being_edited:
                # Skip the existing row for the field being edited (its new formula
                # is represented by the edges we add below).
                continue
            if f.field_type == "computed" and f.validation_json:
                try:
                    cfg = json.loads(f.validation_json)
                    f_terms = cfg.get("terms", [])
                    for i, t in enumerate(f_terms):
                        if i % 2 == 0 and "field_id" in t:
                            edges.append((f.id, t["field_id"]))
                except Exception:
                    pass

        # Add edges representing the formula being validated (self -> operand for each operand)
        for op_id in operand_ids:
            edges.append((self_id, op_id))

        # Cycle exists if any operand can reach self_id through the dependency graph
        for op_id in operand_ids:
            if has_path(edges, op_id, self_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Dependency cycle detected in computed field formula.",
                )

    def create_field(self, db: Session, field_in: FieldCreate) -> Field:
        """Create a field after validating the parent form version exists."""
        version = form_version_service.get_version_by_id(db, field_in.form_version_id)
        if version.is_published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published versions are immutable.")
        if field_in.section_id is not None:
            from app.repositories.section_repository import section_repository
            section = section_repository.get_by_id(db, field_in.section_id)
            if section is None or section.form_version_id != field_in.form_version_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Section does not belong to this form version.",
                )
        self._validate_computed_field_formula(
            db, field_in.form_version_id, None, field_in.field_type, field_in.validation_config
        )
        return field_repository.create(db, field_in)

    def get_field_by_id(self, db: Session, field_id: int) -> Field:
        db_obj = field_repository.get_by_id(db, field_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Field with ID {field_id} not found.",
            )
        return db_obj

    def get_fields_by_version(self, db: Session, form_version_id: int, skip: int = 0, limit: int = 200) -> List[Field]:
        """List all fields for a version, validating the version exists first."""
        form_version_service.get_version_by_id(db, form_version_id)
        return field_repository.get_by_form_version(db, form_version_id=form_version_id, skip=skip, limit=limit)

    def update_field(self, db: Session, field_id: int, field_in: FieldUpdate) -> Field:
        db_obj = self.get_field_by_id(db, field_id)
        if db_obj.form_version.is_published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published versions are immutable.")
        if field_in.section_id is not None:
            from app.repositories.section_repository import section_repository
            section = section_repository.get_by_id(db, field_in.section_id)
            if section is None or section.form_version_id != db_obj.form_version_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Section does not belong to this form version.",
                )
        current = {
            "label": db_obj.label, "field_type": db_obj.field_type, "placeholder": db_obj.placeholder,
            "required": db_obj.required, "options": json.loads(db_obj.options_json) if db_obj.options_json else None,
            "validation_config": json.loads(db_obj.validation_json) if db_obj.validation_json else None,
            "display_order": db_obj.display_order,
        }
        current.update(field_in.model_dump(exclude_unset=True))
        FieldBase.model_validate(current)
        self._validate_computed_field_formula(
            db, db_obj.form_version_id, field_id, current["field_type"], current["validation_config"]
        )
        return field_repository.update(db, db_obj=db_obj, obj_in=field_in)


    def reorder_fields(self, db: Session, form_version_id: int, ordered_ids: List[int]) -> List[Field]:
        fields = field_repository.get_by_form_version(db, form_version_id, limit=10000)
        if set(ordered_ids) != {field.id for field in fields} or len(ordered_ids) != len(fields):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="field_ids must contain every field in this form version exactly once.")
        return field_repository.bulk_reorder(db, form_version_id, ordered_ids)

    def delete_field(self, db: Session, field_id: int) -> Field:
        db_obj = self.get_field_by_id(db, field_id)
        if db_obj.form_version.is_published:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Published versions are immutable.")

        all_fields = field_repository.get_by_form_version(db, db_obj.form_version_id, limit=10000)
        for f in all_fields:
            if f.id != field_id and f.field_type == "computed" and f.validation_json:
                try:
                    cfg = json.loads(f.validation_json)
                    terms = cfg.get("terms", [])
                    for i, t in enumerate(terms):
                        if i % 2 == 0 and t.get("field_id") == field_id:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail=f"Cannot delete field '{db_obj.label}' because computed field '{f.label}' depends on it.",
                            )
                except HTTPException:
                    raise
                except Exception:
                    pass

        return field_repository.delete(db, field_id=field_id)

    def assert_owns_parent_form(self, db: Session, field_id: int, current_user: User) -> Field:
        """Verify the authenticated user owns the form containing this field."""
        field = self.get_field_by_id(db, field_id)
        if field.form_version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this field.",
            )
        return field


field_service = FieldService()
