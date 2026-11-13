from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.database import Base


class DuplicateOverrideRequest(Base):
    __tablename__ = "duplicate_override_requests"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, unique=True)
    duplicate_value = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending | approved | denied
    requested_at = Column(DateTime(timezone=True), server_default=func.now())
    decided_at = Column(DateTime(timezone=True), nullable=True)
