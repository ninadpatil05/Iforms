import secrets
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.form_invite import FormInvite
from app.repositories.form_invite_repository import form_invite_repository
from app.repositories.form_repository import form_repository
from app.schemas.form_invite import FormInviteBatchCreate


class FormInviteService:
    def get_invite_link(self, public_link: str, token: str) -> str:
        base_url = settings.PUBLIC_APP_URL.rstrip("/")
        return f"{base_url}/f/{public_link}?invite={token}"

    def create_batch_invites(
        self, db: Session, form_id: int, batch_in: FormInviteBatchCreate
    ) -> List[FormInvite]:
        form = form_repository.get_by_id(db, form_id)
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Form with ID {form_id} not found.",
            )

        published_version = next((v for v in form.versions if v.is_published), None)
        public_link = published_version.public_link if published_version else "not-published"

        invites = []
        for email in batch_in.emails:
            token = secrets.token_urlsafe(16)
            invite = form_invite_repository.create(
                db,
                form_id=form_id,
                email=email,
                token=token,
                max_uses=batch_in.max_uses,
            )
            # Attach temporary helper attribute for schema serialization
            invite.invite_link = self.get_invite_link(public_link, token)
            invites.append(invite)

        return invites

    def get_invites_for_form(self, db: Session, form_id: int) -> List[FormInvite]:
        form = form_repository.get_by_id(db, form_id)
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Form with ID {form_id} not found.",
            )

        published_version = next((v for v in form.versions if v.is_published), None)
        public_link = published_version.public_link if published_version else "not-published"

        invites = form_invite_repository.get_by_form(db, form_id)
        for invite in invites:
            invite.invite_link = self.get_invite_link(public_link, invite.token)

        return invites

    def delete_invite(self, db: Session, form_id: int, invite_id: int) -> FormInvite:
        invite = form_invite_repository.get_by_id(db, invite_id)
        if not invite or invite.form_id != form_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Invite with ID {invite_id} not found for this form.",
            )
        form = invite.form
        published_version = next((v for v in form.versions if v.is_published), None)
        public_link = published_version.public_link if published_version else "not-published"
        invite.invite_link = self.get_invite_link(public_link, invite.token)

        return form_invite_repository.delete(db, invite_id)


form_invite_service = FormInviteService()
