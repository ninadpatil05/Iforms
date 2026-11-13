from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    respondent_identifier = Column(String(255), nullable=True)  # e.g. email or anonymous token
    status = Column(String(50), nullable=False, default="in_progress")  # in_progress | submitted
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    last_section_id = Column(Integer, ForeignKey("sections.id", ondelete="SET NULL"), nullable=True)
    # JSON-encoded list of visited section IDs for back-navigation, e.g. "[1, 2, 3]"
    visited_section_ids = Column(Text, nullable=True)
    # Opaque token issued at submission-create time; required to read back saved answers
    # or navigate pages on this in-progress submission (prevents sequential-ID enumeration).
    access_token = Column(String(64), unique=True, nullable=True, index=True)

    # Relationships
    form_version = relationship("FormVersion", back_populates="submissions")
    response_values = relationship("ResponseValue", back_populates="submission", cascade="all, delete-orphan")
    categorization = relationship("ResponseCategorization", backref="submission", cascade="all, delete-orphan", uselist=False)
    duplicate_override_request = relationship("DuplicateOverrideRequest", backref="submission", cascade="all, delete-orphan", uselist=False)


