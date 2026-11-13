from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Boolean, UniqueConstraint, func
from app.database.database import Base


class ResponseCategorization(Base):
    __tablename__ = "response_categorizations"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submission_id = Column(
        Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category = Column(String(50), nullable=False, default="uncategorized")
    ai_suggested_category = Column(String(50), nullable=True)
    author_overridden = Column(Boolean, nullable=False, default=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("form_version_id", "submission_id", name="uq_form_version_submission_categorization"),
    )
