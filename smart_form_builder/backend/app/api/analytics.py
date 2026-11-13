from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.analytics import AnalyticsDashboardResponse
from app.services.analytics_service import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/form/{form_id}/dashboard",
    response_model=AnalyticsDashboardResponse,
    status_code=status.HTTP_200_OK,
)
def get_form_analytics_dashboard(
    form_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsDashboardResponse:
    """Retrieve aggregated analytics dashboard for a specific form across all its version lifecycles."""
    return analytics_service.get_dashboard_for_form(
        db=db, form_id=form_id, current_user=current_user
    )


@router.get(
    "/{form_version_id}/dashboard",
    response_model=AnalyticsDashboardResponse,
    status_code=status.HTTP_200_OK,
)
def get_analytics_dashboard(
    form_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnalyticsDashboardResponse:
    """Retrieve analytics dashboard for a specific form version."""
    return analytics_service.get_dashboard(
        db=db, form_version_id=form_version_id, current_user=current_user
    )
