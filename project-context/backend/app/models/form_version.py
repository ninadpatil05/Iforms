from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class FormVersion(Base):
    __tablename__ = "form_versions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    is_published = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    public_link = Column(String(255), unique=True, nullable=True)

    # Establish relationship to the parent Form model
    form = relationship("Form", back_populates="versions")
    # Child relationships
    sections = relationship("Section", back_populates="form_version", cascade="all, delete-orphan")
    fields = relationship("Field", back_populates="form_version", cascade="all, delete-orphan")
    conditional_rules = relationship("ConditionalRule", back_populates="form_version", cascade="all, delete-orphan")
    condition_groups = relationship("ConditionGroup", back_populates="form_version", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="form_version", cascade="all, delete-orphan")


