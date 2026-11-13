from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class SectionBranchRule(Base):
    __tablename__ = "section_branch_rules"

    id = Column(Integer, primary_key=True, index=True)
    from_section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    to_section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    trigger_field_id = Column(
        Integer,
        ForeignKey("fields.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operator = Column(String(50), nullable=False)
    comparison_value = Column(String(500), nullable=True)
    priority = Column(Integer, default=0, nullable=False)

    # Relationships
    from_section = relationship(
        "Section",
        foreign_keys=[from_section_id],
        back_populates="outgoing_rules",
    )
    to_section = relationship(
        "Section",
        foreign_keys=[to_section_id],
        back_populates="incoming_rules",
    )
    trigger_field = relationship(
        "Field",
        foreign_keys=[trigger_field_id],
    )
