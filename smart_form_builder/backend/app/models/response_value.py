from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.database.database import Base


class ResponseValue(Base):
    __tablename__ = "response_values"

    id = Column(Integer, primary_key=True, index=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    value_text = Column(Text, nullable=True)
    file_url = Column(String(500), nullable=True)

    # Relationships
    submission = relationship("Submission", back_populates="response_values")
    field = relationship("Field", back_populates="response_values")
