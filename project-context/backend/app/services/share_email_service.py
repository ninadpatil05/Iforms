import secrets
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.form import Form
from app.models.scheduled_email_share import ScheduledEmailShare
from app.models.user import User
from app.repositories.form_invite_repository import form_invite_repository
from app.repositories.scheduled_email_share_repository import scheduled_email_share_repository
from app.schemas.share_email import ShareEmailRequest, ShareEmailResponse
from app.services.email_service import email_service
from app.services.form_invite_service import form_invite_service


class ShareEmailService:
    # ------------------------------------------------------------------
    # Shared helper: validate form, deduplicate emails, create FormInvite
    # rows, and build per-recipient bodies — used by both the immediate
    # and scheduled send paths.
    # Returns (recipient_payloads, deduped_emails, base_public_url)
    # where recipient_payloads is a list of {email, body} dicts.
    # ------------------------------------------------------------------

    def _prepare_recipients(
        self,
        db: Session,
        form: Form,
        request: ShareEmailRequest,
        current_user: User,
    ) -> Tuple[List[Dict[str, Any]], List[str], str]:
        """
        Validate the form is published, deduplicate recipient emails, create
        FormInvite rows (so invite links exist now), and build the
        per-recipient message body.

        Returns:
            payloads: list of {"email": str, "body": str} dicts
            deduped_emails: ordered deduplicated email list
            base_public_url: the base URL for the public form
        """
        # 1. Reject if form is not published
        if form.status != "published":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Form is not published. Only published forms can be shared via email.",
            )

        published_version = next((v for v in form.versions if v.is_published), None)
        if not published_version or not published_version.public_link:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Form does not have a published version or public link.",
            )

        public_link = published_version.public_link

        # 2. Server-side deduplication of recipient emails (preserving order)
        deduped_emails: List[str] = list(dict.fromkeys([str(e) for e in request.recipient_emails]))

        # Enforce 50 recipient limit
        if len(deduped_emails) > 50:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Maximum of 50 recipients allowed per email share request.",
            )

        base_public_url = f"{settings.PUBLIC_APP_URL.rstrip('/')}/f/{public_link}"
        payloads: List[Dict[str, Any]] = []

        for email in deduped_emails:
            # Determine link and invite management based on access_mode
            if form.access_mode == "public":
                # For public forms, create FormInvite row with source="share_email"
                # purely as a history record
                token = secrets.token_urlsafe(16)
                form_invite_repository.create(
                    db,
                    form_id=form.id,
                    email=email,
                    token=token,
                    max_uses=1,
                    source="share_email",
                    status="pending",
                )
                recipient_link = base_public_url

            else:  # invite_only
                # Loophole fix: if resubmission is NOT allowed, skip already-submitted recipients
                if not form.allow_resubmission:
                    existing_invites = form_invite_repository.get_by_form_and_email(db, form.id, email)
                    already_submitted = any(
                        inv.use_count >= inv.max_uses or getattr(inv, "status", None) == "submitted"
                        for inv in existing_invites
                    )
                    if already_submitted:
                        # Skip this recipient; caller handles partial failures for immediate sends;
                        # for scheduled sends we simply omit them from payloads.
                        continue

                # Reuse existing valid invite or create a new one
                reusable_invite = form_invite_repository.get_reusable_invite(db, form.id, email)
                if reusable_invite:
                    invite_token = reusable_invite.token
                else:
                    token = secrets.token_urlsafe(16)
                    new_invite = form_invite_repository.create(
                        db,
                        form_id=form.id,
                        email=email,
                        token=token,
                        max_uses=1,
                        source="share_email",
                        status="pending",
                    )
                    invite_token = new_invite.token

                recipient_link = form_invite_service.get_invite_link(public_link, invite_token)

            # Build per-recipient body with link substituted in or appended
            per_recipient_body = request.message
            if "{Form Public Link}" in per_recipient_body:
                per_recipient_body = per_recipient_body.replace("{Form Public Link}", recipient_link)
            elif base_public_url in per_recipient_body:
                per_recipient_body = per_recipient_body.replace(base_public_url, recipient_link)
            elif recipient_link not in per_recipient_body:
                per_recipient_body = f"{per_recipient_body.rstrip()}\n\nForm Link: {recipient_link}"

            payloads.append({"email": email, "body": per_recipient_body})

        return payloads, deduped_emails, base_public_url

    # ------------------------------------------------------------------
    # Immediate send (existing path — unchanged behaviour)
    # ------------------------------------------------------------------

    async def share_form_via_email(
        self,
        db: Session,
        form: Form,
        request: ShareEmailRequest,
        current_user: User,
    ) -> ShareEmailResponse:
        payloads, deduped_emails, _ = self._prepare_recipients(db, form, request, current_user)

        # Track recipients that were skipped (e.g. already submitted invite_only)
        skipped = set(e for e in deduped_emails) - set(p["email"] for p in payloads)
        sent_count = 0
        failed: List[Dict[str, Any]] = [
            {"email": e, "reason": "Already submitted and form does not allow resubmission."}
            for e in skipped
        ]

        for payload in payloads:
            success = await email_service.send_email(
                to=payload["email"],
                subject=request.subject,
                body=payload["body"],
                reply_to=current_user.email,
            )
            if success:
                sent_count += 1
            else:
                failed.append({
                    "email": payload["email"],
                    "reason": "SMTP delivery failed",
                })

        return ShareEmailResponse(
            sent_count=sent_count,
            failed=failed,
            scheduled=False,
        )

    # ------------------------------------------------------------------
    # Scheduled send: persist a pending row, return it.
    # Links are generated NOW; only SMTP delivery is deferred.
    # ------------------------------------------------------------------

    def schedule_form_email(
        self,
        db: Session,
        form: Form,
        request: ShareEmailRequest,
        current_user: User,
    ) -> ScheduledEmailShare:
        """
        Generate all FormInvite rows immediately (links at schedule time),
        persist a ScheduledEmailShare row, and return it.
        The scheduler will deliver the emails when scheduled_at is reached.
        """
        assert request.scheduled_at is not None  # caller guards this

        payloads, deduped_emails, _ = self._prepare_recipients(db, form, request, current_user)

        row = scheduled_email_share_repository.create(
            db,
            form_id=form.id,
            user_id=current_user.id,
            subject=request.subject,
            recipient_payloads=payloads,
            recipient_emails=[p["email"] for p in payloads],
            scheduled_at=request.scheduled_at,
        )
        return row


share_email_service = ShareEmailService()
