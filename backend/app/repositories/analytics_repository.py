from datetime import date
from typing import Dict, List, Optional, Tuple, Union
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.form_view import FormView
from app.models.submission import Submission


class AnalyticsRepository:
    def count_views(self, db: Session, form_version_ids: Union[int, List[int]]) -> int:
        ids = [form_version_ids] if isinstance(form_version_ids, int) else form_version_ids
        statement = select(func.count(FormView.id)).where(
            FormView.form_version_id.in_(ids)
        )
        return db.execute(statement).scalar() or 0

    def count_views_by_day(
        self, db: Session, form_version_ids: Union[int, List[int]]
    ) -> List[Tuple[Union[date, str], int]]:
        ids = [form_version_ids] if isinstance(form_version_ids, int) else form_version_ids
        day_col = func.date(FormView.viewed_at)
        statement = (
            select(day_col.label("view_date"), func.count(FormView.id))
            .where(FormView.form_version_id.in_(ids))
            .group_by(day_col)
            .order_by(day_col.asc())
        )
        results = db.execute(statement).all()
        parsed_results = []
        for r in results:
            if r[0] is not None:
                d_val = r[0]
                if isinstance(d_val, str):
                    try:
                        d_val = date.fromisoformat(d_val)
                    except ValueError:
                        pass
                parsed_results.append((d_val, r[1]))
        return parsed_results

    def count_submissions_by_status(
        self, db: Session, form_version_ids: Union[int, List[int]]
    ) -> Dict[str, int]:
        ids = [form_version_ids] if isinstance(form_version_ids, int) else form_version_ids
        statement = (
            select(Submission.status, func.count(Submission.id))
            .where(Submission.form_version_id.in_(ids))
            .group_by(Submission.status)
        )
        results = db.execute(statement).all()
        return {r[0]: r[1] for r in results}

    def average_completion_seconds(
        self, db: Session, form_version_ids: Union[int, List[int]]
    ) -> Optional[float]:
        ids = [form_version_ids] if isinstance(form_version_ids, int) else form_version_ids
        statement = select(Submission.started_at, Submission.submitted_at).where(
            Submission.form_version_id.in_(ids),
            Submission.status == "submitted",
            Submission.submitted_at.isnot(None),
            Submission.started_at.isnot(None),
        )
        results = db.execute(statement).all()
        if not results:
            return None
        durations = []
        for started_at, submitted_at in results:
            if started_at and submitted_at:
                diff = (submitted_at - started_at).total_seconds()
                if diff >= 0:
                    durations.append(diff)
        return sum(durations) / len(durations) if durations else None

    def get_submission_progress(
        self, db: Session, form_version_ids: Union[int, List[int]]
    ) -> List[Tuple[str, Optional[int]]]:
        ids = [form_version_ids] if isinstance(form_version_ids, int) else form_version_ids
        statement = select(Submission.status, Submission.last_section_id).where(
            Submission.form_version_id.in_(ids)
        )
        results = db.execute(statement).all()
        return [(r[0], r[1]) for r in results]


analytics_repository = AnalyticsRepository()
