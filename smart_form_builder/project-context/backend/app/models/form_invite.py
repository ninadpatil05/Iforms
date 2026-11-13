from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class FormInvite(Base):
    __tablename__ = "form_invites"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("forms.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    token = Column(String(255), nullable=False, unique=True, index=True)
    max_uses = Column(Integer, nullable=False, default=1, server_default="1")
    use_count = Column(Integer, nullable=False, default=0, server_default="0")
    source = Column(String(50), nullable=True, default="invite_ui", server_default="invite_ui")  # invite_ui | share_email
    status = Column(String(50), nullable=False, default="pending", server_default="pending")    # pending | opened | submitted | revoked
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    used_at = Column(DateTime(timezone=True), nullable=True)

    # Relationship to Form
    form = relationship("Form", backref="invites")
