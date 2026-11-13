from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class ConditionalRule(Base):
    __tablename__ = "conditional_rules"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    trigger_field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    operator = Column(String(50), nullable=False)        # equals|not_equals|contains|greater_than|less_than|is_empty
    comparison_value = Column(String(500), nullable=True)
    target_field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)          # show|hide|require

    # Parent form version relationship
    form_version = relationship("FormVersion", back_populates="conditional_rules")

    # Explicit foreign_keys avoids SQLAlchemy ambiguity since two FKs reference fields.id
    trigger_field = relationship(
        "Field",
        back_populates="trigger_rules",
        foreign_keys=[trigger_field_id],
    )
    target_field = relationship(
        "Field",
        back_populates="target_rules",
        foreign_keys=[target_field_id],
    )
