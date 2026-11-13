from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database.database import Base


class FormView(Base):
    __tablename__ = "form_views"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer,
        ForeignKey("form_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    viewed_at = Column(DateTime(timezone=True), server_default=func.now())
