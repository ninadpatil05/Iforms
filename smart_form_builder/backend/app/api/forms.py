from typing import List
from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.schemas.form import FormCreate, FormUpdate, FormResponse
from app.schemas.form_version import FormVersionResponse, PublishFormResponse
from app.schemas.submission import FormSubmissionResponse
from app.schemas.form_invite import FormInviteResponse, FormInviteBatchCreate
from app.services.form_service import form_service
from app.services.form_version_service import form_version_service
from app.services.submission_service import submission_service
from app.services.form_invite_service import form_invite_service
from app.config.settings import settings

router = APIRouter(prefix="/forms", tags=["forms"])


@router.post("/", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
def create_form(
    form_in: FormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_in.owner_id = current_user.id
    return form_service.create_form(db=db, form_in=form_in)


@router.get("/me", response_model=List[FormResponse], status_code=status.HTTP_200_OK)
def get_my_forms(
    include_archived: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[FormResponse]:
    forms = form_service.get_my_forms(
        db=db,
        owner_id=current_user.id,
        include_archived=include_archived,
        skip=skip,
        limit=limit,
    )
    return [form_service.to_form_response(db, f) for f in forms]


@router.get("/{form_id}/current-version", response_model=FormVersionResponse, status_code=status.HTTP_200_OK)
def get_current_version(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormVersionResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.get_or_create_draft_version(db, form_id)


@router.get("/{form_id}/submissions", response_model=List[FormSubmissionResponse])
def get_form_submissions(
    form_id: int,
    category: str | None = Query(None),
    status_filter: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: str | None = Query("submitted_at"),
    sort_order: str | None = Query("desc"),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[FormSubmissionResponse]:
    form_service.assert_owner(db, form_id, current_user)
    effective_status = status_filter or status
    return submission_service.build_server_filtered_submissions_response(
        db=db,
        form_id=form_id,
        category=category,
        status=effective_status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )


@router.post("/{form_id}/publish", response_model=PublishFormResponse)
def publish_form(
    form_id: int,
    force_new_link: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PublishFormResponse:
    form_service.assert_owner(db, form_id, current_user)
    version = form_version_service.publish_draft(db, form_id, force_new_link=force_new_link)
    return PublishFormResponse(
        form_version_id=version.id,
        public_link=version.public_link,
        public_url=f"{settings.PUBLIC_APP_URL.rstrip('/')}/f/{version.public_link}",
    )


@router.post("/{form_id}/unpublish", status_code=status.HTTP_204_NO_CONTENT)
def unpublish_form(form_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> None:
    form_service.assert_owner(db, form_id, current_user)
    form_version_service.unpublish_form(db, form_id)


@router.get("/{form_id}/public-link", response_model=PublishFormResponse)
def get_public_link(form_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> PublishFormResponse:
    form_service.assert_owner(db, form_id, current_user)
    version = form_version_service.get_public_version_for_form(db, form_id)
    return PublishFormResponse(
        form_version_id=version.id,
        public_link=version.public_link,
        public_url=f"{settings.PUBLIC_APP_URL.rstrip('/')}/f/{version.public_link}",
    )


@router.get("/{form_id}", response_model=FormResponse, status_code=status.HTTP_200_OK)
def get_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    return form_service.assert_owner(db, form_id, current_user)


@router.put("/{form_id}", response_model=FormResponse, status_code=status.HTTP_200_OK)
def update_form(
    form_id: int,
    form_in: FormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.update_form(db=db, form_id=form_id, form_in=form_in)


@router.post("/{form_id}/archive", response_model=FormResponse, status_code=status.HTTP_200_OK)
def archive_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.archive_form(db=db, form_id=form_id)


@router.post("/{form_id}/unarchive", response_model=FormResponse, status_code=status.HTTP_200_OK)
def unarchive_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.unarchive_form(db=db, form_id=form_id)


@router.post("/{form_id}/restore", response_model=FormResponse, status_code=status.HTTP_200_OK)
def restore_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.restore_form(db=db, form_id=form_id)


@router.delete("/{form_id}", response_model=FormResponse, status_code=status.HTTP_200_OK)
def delete_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.delete_form(db=db, form_id=form_id)


@router.delete("/{form_id}/permanent", response_model=FormResponse, status_code=status.HTTP_200_OK)
def permanent_delete_form(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    form_service.assert_owner(db, form_id, current_user)
    return form_service.permanent_delete_form(db=db, form_id=form_id)


@router.get("/", response_model=List[FormResponse], status_code=status.HTTP_200_OK)
def get_forms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
) -> List[FormResponse]:
    return form_service.get_forms(db=db, skip=skip, limit=limit)


@router.post("/{form_id}/invites", response_model=List[FormInviteResponse], status_code=status.HTTP_201_CREATED)
def create_invites(
    form_id: int,
    batch_in: FormInviteBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[FormInviteResponse]:
    """Batch generate invites for a form. Only the owner can call this."""
    form_service.assert_owner(db, form_id, current_user)
    return form_invite_service.create_batch_invites(db=db, form_id=form_id, batch_in=batch_in)


@router.get("/{form_id}/invites", response_model=List[FormInviteResponse], status_code=status.HTTP_200_OK)
def get_invites(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[FormInviteResponse]:
    """Retrieve all invites for a form. Only the owner can call this."""
    form_service.assert_owner(db, form_id, current_user)
    return form_invite_service.get_invites_for_form(db=db, form_id=form_id)


@router.delete("/{form_id}/invites/{invite_id}", response_model=FormInviteResponse, status_code=status.HTTP_200_OK)
def delete_invite(
    form_id: int,
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormInviteResponse:
    """Revoke/delete a specific invite. Only the owner can call this."""
    form_service.assert_owner(db, form_id, current_user)
    return form_invite_service.delete_invite(db=db, invite_id=invite_id)


import time
from collections import defaultdict
from typing import List
from fastapi import status as http_status
from app.schemas.share_email import ShareEmailRequest, ShareEmailResponse
from app.schemas.scheduled_email_share import ScheduledEmailShareResponse
from app.services.share_email_service import share_email_service
from app.services.scheduled_email_share_service import scheduled_email_share_service
from app.services.email_service import EmailNotConfiguredError
from app.repositories.form_repository import form_repository
from fastapi.responses import JSONResponse

_share_email_rate_limit_store = defaultdict(list)


def _check_share_email_rate_limit(user_id: int, max_requests: int = 10, window_seconds: int = 60):
    now = time.time()
    user_requests = _share_email_rate_limit_store[user_id]
    _share_email_rate_limit_store[user_id] = [t for t in user_requests if now - t < window_seconds]
    if len(_share_email_rate_limit_store[user_id]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded for email sharing. Please wait a minute before trying again.",
        )
    _share_email_rate_limit_store[user_id].append(now)


@router.post("/{form_id}/share-email", response_model=ShareEmailResponse)
async def share_form_email(
    form_id: int,
    request: ShareEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ShareEmailResponse:
    """
    Share a published form via email. Auth required, owner-only.
    - Without scheduled_at: sends immediately, returns 200.
    - With scheduled_at (5min–90days out): creates FormInvite rows now,
      defers SMTP delivery, returns 202 with {scheduled: true, ...}.
    """
    # 1. Owner-only check (returns 404 to avoid leaking existence of unowned forms)
    form = form_repository.get_by_id(db, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form with ID {form_id} not found.",
        )

    # 2. Rate limiting check
    _check_share_email_rate_limit(current_user.id)

    # 3a. Scheduled path — no SMTP check here; credentials only needed at delivery time
    if request.scheduled_at is not None:
        row = share_email_service.schedule_form_email(
            db=db,
            form=form,
            request=request,
            current_user=current_user,
        )
        response_body = ShareEmailResponse(
            sent_count=0,
            failed=[],
            scheduled=True,
            scheduled_email_id=row.id,
        )
        return JSONResponse(
            content=response_body.model_dump(mode="json"),
            status_code=202,
        )

    # 3b. Immediate path (unchanged)
    try:
        return await share_email_service.share_form_via_email(
            db=db,
            form=form,
            request=request,
            current_user=current_user,
        )
    except EmailNotConfiguredError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.message,
        )


@router.get(
    "/{form_id}/scheduled-emails",
    response_model=List[ScheduledEmailShareResponse],
    status_code=status.HTTP_200_OK,
)
def list_scheduled_emails(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ScheduledEmailShareResponse]:
    """List all scheduled email sends for a form. Owner-only."""
    form = form_repository.get_by_id(db, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form with ID {form_id} not found.",
        )
    return scheduled_email_share_service.list_scheduled(db, form_id)


@router.delete(
    "/{form_id}/scheduled-emails/{schedule_id}",
    response_model=ScheduledEmailShareResponse,
    status_code=status.HTTP_200_OK,
)
def cancel_scheduled_email(
    form_id: int,
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScheduledEmailShareResponse:
    """Cancel a pending scheduled email. Owner-only. 409 if not pending."""
    form = form_repository.get_by_id(db, form_id)
    if not form or form.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Form with ID {form_id} not found.",
        )
    return scheduled_email_share_service.cancel_scheduled(db, schedule_id, form_id)
