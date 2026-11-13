from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class Section(Base):
    """A logical grouping of fields within a single form version.

    Sections allow form authors to split a version into ordered pages/groups.
    Fields reference a section via the nullable ``section_id`` FK; fields with
    ``section_id = NULL`` are treated as "ungrouped" by the UI and API.
    """

    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(
        Integer,
        ForeignKey("form_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    default_next_section_id = Column(
        Integer,
        ForeignKey("sections.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    form_version = relationship("FormVersion", back_populates="sections")
    fields = relationship("Field", back_populates="section")

    default_next_section = relationship(
        "Section",
        remote_side=[id],
        foreign_keys=[default_next_section_id],
    )
    outgoing_rules = relationship(
        "SectionBranchRule",
        foreign_keys="SectionBranchRule.from_section_id",
        back_populates="from_section",
        cascade="all, delete-orphan",
    )
    incoming_rules = relationship(
        "SectionBranchRule",
        foreign_keys="SectionBranchRule.to_section_id",
        back_populates="to_section",
    )
