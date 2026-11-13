from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ai_form import (
    AcceptDraftRequest,
    AiFormDraftResponse,
    GenerateFormRequest,
    RegenerateFormRequest,
)
from app.schemas.form import FormResponse
from app.services.ai.provider_base import AiProviderError
from app.services.ai_form_service import ai_form_service
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/ai/forms", tags=["ai-forms"])

_ai_generate_rate_limit_store = defaultdict(list)


@router.post("/generate", response_model=AiFormDraftResponse, status_code=status.HTTP_201_CREATED)
async def generate_form_draft(
    payload: GenerateFormRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiFormDraftResponse:
    check_rate_limit(
        store=_ai_generate_rate_limit_store,
        key=str(current_user.id),
        max_requests=30,
        window_seconds=3600,
    )
    try:
        draft = await ai_form_service.generate_draft(
            db=db, user=current_user, prompt=payload.prompt
        )
        return draft
    except AiProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is temporarily unavailable, please try again.",
        ) from exc


@router.post("/{draft_id}/regenerate", response_model=AiFormDraftResponse, status_code=status.HTTP_200_OK)
async def regenerate_form_draft(
    draft_id: int,
    payload: Optional[RegenerateFormRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiFormDraftResponse:
    check_rate_limit(
        store=_ai_generate_rate_limit_store,
        key=str(current_user.id),
        max_requests=30,
        window_seconds=3600,
    )
    new_prompt = payload.prompt if payload else None
    try:
        draft = await ai_form_service.regenerate_draft(
            db=db, user=current_user, draft_id=draft_id, new_prompt=new_prompt
        )
        return draft
    except AiProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is temporarily unavailable, please try again.",
        ) from exc


@router.post("/{draft_id}/accept", response_model=FormResponse, status_code=status.HTTP_201_CREATED)
def accept_form_draft(
    draft_id: int,
    payload: AcceptDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FormResponse:
    return ai_form_service.accept_draft(
        db=db, user=current_user, draft_id=draft_id, edited_draft=payload.edited_draft
    )


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
def discard_form_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    ai_form_service.discard_draft(db=db, user=current_user, draft_id=draft_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
