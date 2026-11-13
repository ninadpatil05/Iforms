from datetime import date
from typing import Dict, List, Optional, Tuple
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form_view import FormView
from app.models.submission import Submission


class AnalyticsRepository:
    def count_views(self, db: Session, form_version_id: int) -> int:
        statement = select(func.count(FormView.id)).where(
            FormView.form_version_id == form_version_id
        )
        return db.execute(statement).scalar() or 0

    def count_views_by_day(
        self, db: Session, form_version_id: int
    ) -> List[Tuple[date, int]]:
        day_col = func.date(FormView.viewed_at)
        statement = (
            select(day_col.label("view_date"), func.count(FormView.id))
            .where(FormView.form_version_id == form_version_id)
            .group_by(day_col)
            .order_by(day_col.asc())
        )
        results = db.execute(statement).all()
        return [(r[0], r[1]) for r in results if r[0] is not None]

    def count_submissions_by_status(
        self, db: Session, form_version_id: int
    ) -> Dict[str, int]:
        statement = (
            select(Submission.status, func.count(Submission.id))
            .where(Submission.form_version_id == form_version_id)
            .group_by(Submission.status)
        )
        results = db.execute(statement).all()
        return {r[0]: r[1] for r in results}

    def average_completion_seconds(
        self, db: Session, form_version_id: int
    ) -> Optional[float]:
        statement = select(
            func.avg(
                func.extract(
                    "epoch", Submission.submitted_at - Submission.started_at
                )
            )
        ).where(
            Submission.form_version_id == form_version_id,
            Submission.status == "submitted",
            Submission.submitted_at.isnot(None),
        )
        res = db.execute(statement).scalar()
        return float(res) if res is not None else None

    def get_submission_progress(
        self, db: Session, form_version_id: int
    ) -> List[Tuple[str, Optional[int]]]:
        statement = select(Submission.status, Submission.last_section_id).where(
            Submission.form_version_id == form_version_id
        )
        results = db.execute(statement).all()
        return [(r[0], r[1]) for r in results]


analytics_repository = AnalyticsRepository()
