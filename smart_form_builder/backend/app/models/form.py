from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Form(Base):
    __tablename__ = "forms"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    access_mode = Column(String(50), nullable=False, default="public", server_default="public")  # public | invite_only
    allow_resubmission = Column(Boolean, nullable=False, default=True, server_default="true")
    starts_at = Column(DateTime(timezone=True), nullable=True)
    ends_at = Column(DateTime(timezone=True), nullable=True)
    duplicate_check_field_id = Column(Integer, ForeignKey("fields.id", ondelete="SET NULL"), nullable=True)
    duplicate_policy = Column(String(20), nullable=False, default="allow", server_default="allow")  # allow | warn | block
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Establish relationship to the User model
    # backref="forms" dynamically adds the 'forms' attribute to the User class
    owner = relationship("User", backref="forms")

    # Establish relationship to the FormVersion model
    versions = relationship("FormVersion", back_populates="form", cascade="all, delete-orphan")

