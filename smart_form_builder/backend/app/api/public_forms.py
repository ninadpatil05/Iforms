import json
from collections import deque
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.form_view import FormView
from app.models.form import Form
from app.models.section import Section
from app.models.user import User
from app.repositories.response_value_repository import response_value_repository
from app.schemas.branch_rule import NextPageRequest, NextPageResponse
from app.services.branch_evaluation_service import branch_evaluation_service
from app.services.form_service import form_service
from app.services.form_version_service import form_version_service
from app.services.section_service import section_service
from app.services.submission_service import submission_service
from app.utils.form_schedule import check_form_schedule

router = APIRouter(prefix="/public/forms", tags=["public-forms"])


# ---------------------------------------------------------------------------
# Shared Pydantic models (public contract)
# ---------------------------------------------------------------------------

class PublicFieldResponse(BaseModel):
    id: int
    label: str
    field_type: str
    required: bool
    options: Optional[Any] = None
    placeholder: Optional[str] = None
    validation_config: Optional[Any] = None
    section_id: Optional[int] = None


class PublicSectionResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    display_order: int
    default_next_section_id: Optional[int] = None


class PublicConditionGroupConditionResponse(BaseModel):
    trigger_field_id: int
    operator: str
    comparison_value: Optional[str] = None


class PublicConditionGroupResponse(BaseModel):
    id: int
    target_field_id: int
    action: str
    combinator: str
    conditions: List[PublicConditionGroupConditionResponse]


class PublicFormResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    form_version_id: int
    fields: List[PublicFieldResponse]
    sections: List[PublicSectionResponse]
    condition_groups: List[PublicConditionGroupResponse] = []


class PreviousPageResponse(BaseModel):
    previous_section_id: int


class UnreachableSectionItem(BaseModel):
    id: int
    title: str
    display_order: int


class GraphCheckResponse(BaseModel):
    unreachable_sections: List[UnreachableSectionItem]


class SavedAnswerResponse(BaseModel):
    field_id: int
    value_text: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/{public_link}", response_model=PublicFormResponse)
def get_public_form(
    public_link: str,
    invite: Optional[str] = None,
    db: Session = Depends(get_db),
) -> PublicFormResponse:
    version = form_version_service.get_public_version(db, public_link)
    form = version.form

    check_form_schedule(form)

    if form.access_mode == "invite_only":
        if not invite:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invite token is required for this form.",
            )
        from app.repositories.form_invite_repository import form_invite_repository
        invite_obj = form_invite_repository.get_by_token(db, invite)
        if not invite_obj or invite_obj.form_id != form.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid invite token.",
            )
        if invite_obj.use_count >= invite_obj.max_uses and not form.allow_resubmission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This invite link has already been used.",
            )

    db.add(FormView(form_version_id=version.id))
    db.commit()

    return PublicFormResponse(
        id=version.form.id,
        title=version.form.title,
        description=version.form.description,
        form_version_id=version.id,
        fields=[
            PublicFieldResponse(
                id=field.id,
                label=field.label,
                field_type=field.field_type,
                required=field.required,
                options=json.loads(field.options_json) if field.options_json else None,
                placeholder=field.placeholder,
                validation_config=json.loads(field.validation_json) if field.validation_json else None,
                section_id=field.section_id,
            )
            for field in sorted(version.fields, key=lambda item: item.display_order)
        ],
        sections=[
            PublicSectionResponse(
                id=section.id,
                title=section.title,
                description=section.description,
                display_order=section.display_order,
                default_next_section_id=section.default_next_section_id,
            )
            for section in sorted(version.sections, key=lambda item: item.display_order)
        ],
        condition_groups=[
            PublicConditionGroupResponse(
                id=group.id,
                target_field_id=group.target_field_id,
                action=group.action,
                combinator=group.combinator,
                conditions=[
                    PublicConditionGroupConditionResponse(
                        trigger_field_id=cond.trigger_field_id,
                        operator=cond.operator,
                        comparison_value=cond.comparison_value,
                    )
                    for cond in sorted(group.conditions, key=lambda c: c.display_order)
                ],
            )
            for group in sorted(version.condition_groups, key=lambda g: g.id)
        ],
    )


@router.post("/{public_link}/next-page", response_model=NextPageResponse)
def get_next_page(
    public_link: str,
    payload: NextPageRequest,
    access_token: Optional[str] = None,
    db: Session = Depends(get_db),
) -> NextPageResponse:
    version = form_version_service.get_public_version(db, public_link)
    submission = submission_service.get_submission_by_id(db, payload.submission_id)
    if submission.form_version_id != version.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Submission does not belong to this published form.",
        )
    if not access_token or submission.access_token != access_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid access_token is required.",
        )

    result = branch_evaluation_service.evaluate_for_submission(
        db=db,
        submission_id=payload.submission_id,
        current_section_id=payload.current_section_id,
    )
    return NextPageResponse(**result)


@router.get("/{public_link}/previous-page", response_model=PreviousPageResponse)
def get_previous_page(
    public_link: str,
    submission_id: int,
    access_token: Optional[str] = None,
    db: Session = Depends(get_db),
) -> PreviousPageResponse:
    """Pop the last section from visited_section_ids and return it.

    Used by the respondent's 'Back' button to navigate to the previously seen section.
    Returns 403 if there is no history (already on the first section) or if the
    access_token is missing or incorrect.
    """
    version = form_version_service.get_public_version(db, public_link)
    submission = submission_service.get_submission_by_id(db, submission_id)
    if submission.form_version_id != version.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Submission does not belong to this published form.",
        )
    if not access_token or submission.access_token != access_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid access_token is required.",
        )

    try:
        visited: list = json.loads(submission.visited_section_ids or "[]")
    except (ValueError, TypeError):
        visited = []

    # visited contains sections we've *navigated away from*, so pop the last one
    # to return to it. The current section is NOT in visited yet (it gets added on Next).
    if not visited:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No previous section in history.",
        )

    previous_section_id = visited.pop()
    from app.repositories.submission_repository import submission_repository
    submission_repository.update(
        db,
        db_obj=submission,
        obj_in={"visited_section_ids": json.dumps(visited)},
    )
    return PreviousPageResponse(previous_section_id=previous_section_id)


@router.get("/{public_link}/response-values/{submission_id}", response_model=List[SavedAnswerResponse])
def get_saved_answers(
    public_link: str,
    submission_id: int,
    access_token: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[SavedAnswerResponse]:
    """Return saved response values for a submission (used when navigating back).

    ``access_token`` is required and must match the token issued when the submission
    was created. Both missing and wrong tokens produce 403.
    """
    version = form_version_service.get_public_version(db, public_link)
    submission = submission_service.get_submission_by_id(db, submission_id)
    if submission.form_version_id != version.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Submission does not belong to this published form.",
        )
    if not access_token or submission.access_token != access_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Valid access_token is required.",
        )
    rvs = response_value_repository.get_by_submission(db, submission_id)
    return [SavedAnswerResponse(field_id=rv.field_id, value_text=rv.value_text) for rv in rvs]


@router.get("/graph-check/form/{form_id}", response_model=GraphCheckResponse)
def graph_check(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GraphCheckResponse:
    """Return sections unreachable from the first section in the draft.

    Only the form owner can call this. Uses the *draft* form version so builders
    can see warnings before publishing.
    """
    form = form_service.assert_owner(db, form_id, current_user)
    from app.repositories.form_version_repository import form_version_repository
    draft = form_version_repository.get_draft_by_form(db, form_id)
    if not draft:
        return GraphCheckResponse(unreachable_sections=[])

    sections = db.execute(
        select(Section)
        .where(Section.form_version_id == draft.id)
        .order_by(Section.display_order.asc())
    ).scalars().all()

    if not sections:
        return GraphCheckResponse(unreachable_sections=[])

    from app.models.branch_rule import SectionBranchRule
    section_ids = {s.id for s in sections}
    rules = db.execute(
        select(SectionBranchRule).where(
            SectionBranchRule.from_section_id.in_(section_ids)
        )
    ).scalars().all()

    # Build adjacency list
    adj: Dict[int, List[int]] = {s.id: [] for s in sections}
    for rule in rules:
        if rule.to_section_id is not None:
            adj[rule.from_section_id].append(rule.to_section_id)
    for sec in sections:
        if sec.default_next_section_id is not None:
            if sec.default_next_section_id not in adj[sec.id]:
                adj[sec.id].append(sec.default_next_section_id)
        else:
            # Implicit sequential fallback: next by display_order
            next_secs = [s for s in sections if s.display_order > sec.display_order]
            if next_secs:
                next_sec = min(next_secs, key=lambda s: s.display_order)
                if next_sec.id not in adj[sec.id]:
                    adj[sec.id].append(next_sec.id)

    # BFS from the first section
    first_section_id = sections[0].id
    visited_set: set = set()
    queue = deque([first_section_id])
    while queue:
        curr = queue.popleft()
        if curr in visited_set:
            continue
        visited_set.add(curr)
        for nxt in adj.get(curr, []):
            if nxt not in visited_set:
                queue.append(nxt)

    unreachable = [
        UnreachableSectionItem(id=s.id, title=s.title, display_order=s.display_order)
        for s in sections
        if s.id not in visited_set
    ]
    return GraphCheckResponse(unreachable_sections=unreachable)
