from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, func

from app.database.database import Base


class AiAnalysisReport(Base):
    __tablename__ = "ai_analysis_reports"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    submission_count_at_run = Column(Integer, nullable=False)
    report_json = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
