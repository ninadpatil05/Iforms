from collections import defaultdict
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ai_analysis import (
    AiAnalysisReportResponse,
    AiAnalysisReportSummary,
)
from app.services.ai.provider_base import AiProviderError
from app.services.ai_analysis_service import ai_analysis_service
from app.utils.rate_limit import check_rate_limit

router = APIRouter(prefix="/ai/analysis", tags=["ai-analysis"])

_ai_analysis_rate_limit_store = defaultdict(list)


@router.post("/{form_version_id}/run", response_model=AiAnalysisReportResponse, status_code=status.HTTP_200_OK)
async def run_form_analysis(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAnalysisReportResponse:
    check_rate_limit(
        store=_ai_analysis_rate_limit_store,
        key=str(current_user.id),
        max_requests=30,
        window_seconds=3600,
    )
    try:
        report = await ai_analysis_service.run_analysis(
            db=db, user=current_user, form_version_id=form_version_id
        )
        return report
    except AiProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI is temporarily unavailable, please try again.",
        ) from exc


@router.get("/{form_version_id}/latest", response_model=AiAnalysisReportResponse, status_code=status.HTTP_200_OK)
def get_latest_analysis(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAnalysisReportResponse:
    report = ai_analysis_service.get_latest_report(
        db=db, user=current_user, form_version_id=form_version_id
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No analysis report found for this form version.",
        )
    return report


@router.get("/{form_version_id}/history", response_model=List[AiAnalysisReportSummary], status_code=status.HTTP_200_OK)
def get_analysis_history(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[AiAnalysisReportSummary]:
    return ai_analysis_service.get_report_history(
        db=db, user=current_user, form_version_id=form_version_id
    )
