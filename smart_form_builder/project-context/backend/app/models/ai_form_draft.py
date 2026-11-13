from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func

from app.database.database import Base


class AiFormDraft(Base):
    __tablename__ = "ai_form_drafts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    prompt = Column(Text, nullable=False)
    generated_json = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | accepted | discarded
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    accepted_at = Column(DateTime(timezone=True), nullable=True)
