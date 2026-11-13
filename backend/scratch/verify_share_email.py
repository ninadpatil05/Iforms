import asyncio
import os
import secrets
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.orm import Session
from app.database.database import Base, engine, SessionLocal, run_auto_migrations
from app.models.user import User
from app.models.form import Form
from app.models.form_version import FormVersion
from app.models.form_invite import FormInvite
from app.repositories.user_repository import user_repository
from app.repositories.form_repository import form_repository
from app.repositories.form_version_repository import form_version_repository
from app.repositories.form_invite_repository import form_invite_repository
from app.schemas.form import FormCreate
from app.schemas.share_email import ShareEmailRequest
from app.services.email_service import email_service
from app.services.share_email_service import share_email_service
from app.config.settings import settings
from fastapi import HTTPException


def run_tests():
    print("--- Verifying Share Email Endpoint Logic ---")
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()
    db: Session = SessionLocal()

    try:
        # Create test users
        owner = user_repository.get_by_email(db, "owner_test@example.com")
        if not owner:
            owner = user_repository.create(
                db, name="Form Owner", email="owner_test@example.com", password_hash="hashed_pw", role="creator"
            )

        other_user = user_repository.get_by_email(db, "other_test@example.com")
        if not other_user:
            other_user = user_repository.create(
                db, name="Other User", email="other_test@example.com", password_hash="hashed_pw", role="creator"
            )

        # 1. Test unpublished form rejected with 422
        draft_form = form_repository.create(
            db, FormCreate(owner_id=owner.id, title="Draft Form", status="draft", access_mode="public")
        )
        req = ShareEmailRequest(
            recipient_emails=["user1@example.com"],
            subject="Test Subject",
            message="Hi,\n\nPlease complete: {Form Public Link}\n\nRegards,\nOwner",
        )

        try:
            asyncio.run(share_email_service.share_form_via_email(db, draft_form, req, owner))
            print("[FAIL] Expected 422 for draft form, but succeeded.")
            sys.exit(1)
        except HTTPException as exc:
            if exc.status_code == 422:
                print(f"[PASS] Unpublished form correctly rejected with 422: '{exc.detail}'")
            else:
                print(f"[FAIL] Expected 422 status code, got {exc.status_code}")
                sys.exit(1)

        # Create published public form
        pub_form = form_repository.create(
            db, FormCreate(owner_id=owner.id, title="Public Published Form", status="published", access_mode="public")
        )
        pub_version = form_version_repository.create(
            db, form_id=pub_form.id, version_number=1, is_published=True, public_link=f"pub_link_{secrets.token_urlsafe(8)}"
        )

        # Mock email_service.send_email to simulate successful delivery
        from unittest.mock import AsyncMock, patch
        email_service.send_email = AsyncMock(return_value=True)

        # 2. Test Public form send creates history FormInvite record
        res_public = asyncio.run(share_email_service.share_form_via_email(db, pub_form, req, owner))
        invites = form_invite_repository.get_by_form_and_email(db, pub_form.id, "user1@example.com")
        if len(invites) > 0 and invites[0].source == "share_email":
            print(f"[PASS] Public form send created history FormInvite record with source='share_email'")
        else:
            print("[FAIL] Public form send failed to create FormInvite history record")
            sys.exit(1)

        # 3. Create published invite-only form
        inv_form = form_repository.create(
            db, FormCreate(owner_id=owner.id, title="Invite Only Form", status="published", access_mode="invite_only", allow_resubmission=True)
        )
        inv_version = form_version_repository.create(
            db, form_id=inv_form.id, version_number=1, is_published=True, public_link=f"inv_link_{secrets.token_urlsafe(8)}"
        )

        # 4. Test invite-only form send creates tokenized invite and reuses active invite
        req_inv = ShareEmailRequest(
            recipient_emails=["invitee@example.com"],
            subject="Invitation to complete: Invite Only Form",
            message="Hi,\n\nPlease use this link to access the form:\n{Form Public Link}\n\nRegards,\nOwner",
        )
        asyncio.run(share_email_service.share_form_via_email(db, inv_form, req_inv, owner))
        inv_record1 = form_invite_repository.get_reusable_invite(db, inv_form.id, "invitee@example.com")
        if inv_record1 and inv_record1.token:
            print(f"[PASS] Invite-only form send generated tokenized invite token: {inv_record1.token} (ID: {inv_record1.id})")
        else:
            print("[FAIL] Invite-only form failed to create tokenized invite")
            sys.exit(1)

        # Re-send to same email -> should reuse inv_record1 token
        asyncio.run(share_email_service.share_form_via_email(db, inv_form, req_inv, owner))
        inv_record2 = form_invite_repository.get_reusable_invite(db, inv_form.id, "invitee@example.com")
        if inv_record2 and inv_record2.id == inv_record1.id:
            print(f"[PASS] Active unsubmitted invite was successfully reused for recipient")
        else:
            print("[FAIL] Active invite was not reused")
            sys.exit(1)

        # 5. Test Revoked invites are NOT reused
        inv_record1.status = "revoked"
        db.commit()
        asyncio.run(share_email_service.share_form_via_email(db, inv_form, req_inv, owner))
        inv_record3 = form_invite_repository.get_reusable_invite(db, inv_form.id, "invitee@example.com")
        if inv_record3 and inv_record3.id != inv_record1.id:
            print(f"[PASS] Revoked invite was correctly excluded from reuse; new invite created")
        else:
            print("[FAIL] Revoked invite was improperly reused")
            sys.exit(1)

        # 6. Test resubmission prevention when allow_resubmission = False
        no_resub_form = form_repository.create(
            db, FormCreate(owner_id=owner.id, title="No Resubmission Form", status="published", access_mode="invite_only", allow_resubmission=False)
        )
        no_resub_version = form_version_repository.create(
            db, form_id=no_resub_form.id, version_number=1, is_published=True, public_link=f"no_resub_{secrets.token_urlsafe(8)}"
        )

        # Create submitted invite
        submitted_inv = form_invite_repository.create(
            db, form_id=no_resub_form.id, email="submitted_user@example.com", token=f"sub_token_{secrets.token_urlsafe(8)}", max_uses=1, source="invite_ui", status="submitted"
        )
        submitted_inv.use_count = 1
        db.commit()

        req_no_resub = ShareEmailRequest(
            recipient_emails=["submitted_user@example.com"],
            subject="Test",
            message="Hi, {Form Public Link}",
        )
        res_no_resub = asyncio.run(share_email_service.share_form_via_email(db, no_resub_form, req_no_resub, owner))
        if len(res_no_resub.failed) == 1 and "Already submitted" in res_no_resub.failed[0]["reason"]:
            print(f"[PASS] Resubmission prevented for submitted user when allow_resubmission=False: '{res_no_resub.failed[0]['reason']}'")
        else:
            print(f"[FAIL] Expected failed entry for submitted user when allow_resubmission=False, got: {res_no_resub.failed}")
            sys.exit(1)

        # 7. Test 50 recipient limit
        fifty_one_emails = [f"user{i}@example.com" for i in range(51)]
        try:
            ShareEmailRequest(recipient_emails=fifty_one_emails, subject="Cap test", message="Test")
            print("[FAIL] Expected Pydantic validation error for >50 recipients")
            sys.exit(1)
        except Exception:
            print("[PASS] Recipient cap (50 max) correctly enforced by request schema")

        print("--- Share Email Logic Verification Completed Successfully ---")

    finally:
        db.close()


if __name__ == "__main__":
    run_tests()
