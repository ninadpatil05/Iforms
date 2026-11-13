from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class Field(Base):
    __tablename__ = "fields"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("form_versions.id", ondelete="CASCADE"), nullable=False)
    section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    label = Column(String(255), nullable=False)
    field_type = Column(String(50), nullable=False)  # text|email|number|password|textarea|radio|checkbox|dropdown|date|file
    placeholder = Column(String(255), nullable=True)
    required = Column(Boolean, default=False, nullable=False)
    options_json = Column(Text, nullable=True)      # JSON string for radio/checkbox/dropdown choices
    validation_json = Column(Text, nullable=True)   # JSON string for custom validation rules
    display_order = Column(Integer, default=0, nullable=False)

    # Relationships
    form_version = relationship("FormVersion", back_populates="fields")
    section = relationship("Section", back_populates="fields")
    # Conditional rules where this field is the trigger
    trigger_rules = relationship(
        "ConditionalRule",
        back_populates="trigger_field",
        foreign_keys="ConditionalRule.trigger_field_id",
        cascade="all, delete-orphan",
    )
    # Conditional rules where this field is the target
    target_rules = relationship(
        "ConditionalRule",
        back_populates="target_field",
        foreign_keys="ConditionalRule.target_field_id",
        cascade="all, delete-orphan",
    )
    # Condition rules targeting this field
    target_condition_groups = relationship(
        "ConditionGroup",
        back_populates="target_field",
        foreign_keys="ConditionGroup.target_field_id",
        cascade="all, delete-orphan",
    )
    # Condition group conditions triggering on this field
    trigger_condition_group_conditions = relationship(
        "ConditionGroupCondition",
        back_populates="trigger_field",
        foreign_keys="ConditionGroupCondition.trigger_field_id",
        cascade="all, delete-orphan",
    )
    response_values = relationship("ResponseValue", back_populates="field", cascade="all, delete-orphan")

