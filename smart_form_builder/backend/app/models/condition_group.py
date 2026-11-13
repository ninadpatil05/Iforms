from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class ConditionGroup(Base):
    __tablename__ = "condition_groups"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    target_field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)      # show|hide|require
    combinator = Column(String(10), nullable=False)   # AND|OR

    form_version = relationship("FormVersion", back_populates="condition_groups")
    target_field = relationship(
        "Field",
        back_populates="target_condition_groups",
        foreign_keys=[target_field_id],
    )
    conditions = relationship(
        "ConditionGroupCondition",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="ConditionGroupCondition.display_order",
    )


class ConditionGroupCondition(Base):
    __tablename__ = "condition_group_conditions"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("condition_groups.id", ondelete="CASCADE"), nullable=False)
    trigger_field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    operator = Column(String(50), nullable=False)
    comparison_value = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    group = relationship("ConditionGroup", back_populates="conditions")
    trigger_field = relationship(
        "Field",
        back_populates="trigger_condition_group_conditions",
        foreign_keys=[trigger_field_id],
    )
