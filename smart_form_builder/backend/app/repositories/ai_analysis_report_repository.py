from typing import Any, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_analysis_report import AiAnalysisReport


class AiAnalysisReportRepository:
    def get_by_id(self, db: Session, report_id: int) -> Optional[AiAnalysisReport]:
        """Fetch a single AI analysis report by ID."""
        statement = select(AiAnalysisReport).where(AiAnalysisReport.id == report_id)
        return db.execute(statement).scalar_one_or_none()

    def get_latest_by_version(self, db: Session, form_version_id: int) -> Optional[AiAnalysisReport]:
        """Fetch the most recent AI analysis report for a form version."""
        statement = (
            select(AiAnalysisReport)
            .where(AiAnalysisReport.form_version_id == form_version_id)
            .order_by(AiAnalysisReport.created_at.desc(), AiAnalysisReport.id.desc())
        )
        return db.execute(statement).scalars().first()

    def get_history_by_version(
        self, db: Session, form_version_id: int, limit: int = 50
    ) -> List[AiAnalysisReport]:
        """Fetch analysis report history for a form version (newest first)."""
        statement = (
            select(AiAnalysisReport)
            .where(AiAnalysisReport.form_version_id == form_version_id)
            .order_by(AiAnalysisReport.created_at.desc(), AiAnalysisReport.id.desc())
            .limit(limit)
        )
        return list(db.execute(statement).scalars().all())

    def create(self, db: Session, obj_in: Dict[str, Any]) -> AiAnalysisReport:
        """Create and persist a new AiAnalysisReport record."""
        db_obj = AiAnalysisReport(
            form_version_id=obj_in["form_version_id"],
            user_id=obj_in["user_id"],
            submission_count_at_run=obj_in["submission_count_at_run"],
            report_json=obj_in["report_json"],
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


ai_analysis_report_repository = AiAnalysisReportRepository()
