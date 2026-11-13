from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_form_draft import AiFormDraft


class AiFormDraftRepository:
    def get_by_id(self, db: Session, draft_id: int) -> Optional[AiFormDraft]:
        """Fetch a single AI form draft by its primary key ID."""
        statement = select(AiFormDraft).where(AiFormDraft.id == draft_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_id_for_user(self, db: Session, draft_id: int, user_id: int) -> Optional[AiFormDraft]:
        """Fetch an AI form draft by ID only if owned by the specified user."""
        statement = select(AiFormDraft).where(
            AiFormDraft.id == draft_id,
            AiFormDraft.user_id == user_id,
        )
        return db.execute(statement).scalar_one_or_none()

    def create(self, db: Session, obj_in: Dict[str, Any]) -> AiFormDraft:
        """Create and persist a new AiFormDraft record."""
        db_obj = AiFormDraft(
            user_id=obj_in["user_id"],
            prompt=obj_in["prompt"],
            generated_json=obj_in["generated_json"],
            status=obj_in.get("status", "pending"),
            form_id=obj_in.get("form_id"),
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: AiFormDraft, obj_in: Dict[str, Any]) -> AiFormDraft:
        """Update an existing AiFormDraft record with new data."""
        for field, value in obj_in.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, draft_id: int) -> Optional[AiFormDraft]:
        """Delete an AiFormDraft record by ID if it exists."""
        db_obj = self.get_by_id(db, draft_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


ai_form_draft_repository = AiFormDraftRepository()
