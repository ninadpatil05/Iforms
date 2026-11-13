from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.form_invite import FormInvite


class FormInviteRepository:
    def get_by_id(self, db: Session, invite_id: int) -> Optional[FormInvite]:
        return db.execute(
            select(FormInvite).where(FormInvite.id == invite_id)
        ).scalar_one_or_none()

    def get_by_token(self, db: Session, token: str) -> Optional[FormInvite]:
        return db.execute(
            select(FormInvite).where(FormInvite.token == token)
        ).scalar_one_or_none()

    def get_by_form(self, db: Session, form_id: int) -> List[FormInvite]:
        return list(
            db.execute(
                select(FormInvite)
                .where(FormInvite.form_id == form_id)
                .order_by(FormInvite.created_at.desc())
            )
            .scalars()
            .all()
        )

    def get_by_form_and_email(self, db: Session, form_id: int, email: str) -> List[FormInvite]:
        return list(
            db.execute(
                select(FormInvite)
                .where(FormInvite.form_id == form_id, FormInvite.email == email)
                .order_by(FormInvite.created_at.desc())
            )
            .scalars()
            .all()
        )

    def get_reusable_invite(self, db: Session, form_id: int, email: str) -> Optional[FormInvite]:
        invites = self.get_by_form_and_email(db, form_id, email)
        for inv in invites:
            status_val = getattr(inv, "status", "pending") or "pending"
            if inv.use_count < inv.max_uses and status_val not in ("submitted", "revoked"):
                return inv
        return None

    def create(
        self,
        db: Session,
        *,
        form_id: int,
        email: str,
        token: str,
        max_uses: int = 1,
        source: str = "invite_ui",
        status: str = "pending",
    ) -> FormInvite:
        db_obj = FormInvite(
            form_id=form_id,
            email=email,
            token=token,
            max_uses=max_uses,
            source=source,
            status=status,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, invite_id: int) -> Optional[FormInvite]:
        db_obj = self.get_by_id(db, invite_id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
        return db_obj


form_invite_repository = FormInviteRepository()
