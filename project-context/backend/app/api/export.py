import re
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.export import ExportFilters, ExportFormat
from app.schemas.submission import SubmissionStatus
from app.services.export_service import export_service
from app.services.form_service import form_service
from app.services.submission_service import submission_service

router = APIRouter(prefix="/export", tags=["export"])


def _slugify(text_val: str) -> str:
    slug = text_val.lower()
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"[^a-z0-9\-]", "", slug)
    return slug.strip("-") or "form"


@router.get("/{form_id}/submissions", status_code=status.HTTP_200_OK)
def export_submissions(
    form_id: int,
    format: ExportFormat = ExportFormat.CSV,
    status_filter: Optional[SubmissionStatus] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    form = form_service.assert_owner(db, form_id, current_user)

    filters = ExportFilters(
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    has_filters = any([
        filters.status is not None,
        filters.date_from is not None,
        filters.date_to is not None,
        filters.search is not None and filters.search.strip() != "",
    ])

    if has_filters:
        submissions = submission_service.build_filtered_form_submissions_response(
            db, form_id=form_id, filters=filters, limit=None
        )
    else:
        submissions = submission_service.build_form_submissions_response(
            db, form_id=form_id, limit=None
        )

    title_slug = _slugify(form.title)

    if format == ExportFormat.CSV:
        content = export_service.generate_csv(submissions)
        media_type = "text/csv"
        filename = f"{title_slug}-submissions.csv"
    elif format == ExportFormat.XLSX:
        content = export_service.generate_xlsx(submissions)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{title_slug}-submissions.xlsx"
    elif format == ExportFormat.PDF:
        content = export_service.generate_pdf(submissions, form_title=form.title)
        media_type = "application/pdf"
        filename = f"{title_slug}-submissions.pdf"
    else:
        content = export_service.generate_csv(submissions)
        media_type = "text/csv"
        filename = f"{title_slug}-submissions.csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
