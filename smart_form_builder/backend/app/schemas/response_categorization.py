from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict


class ResponseCategorizationUpdate(BaseModel):
    category: Literal["useful", "not_useful", "uncategorized"]


class ResponseCategorizationResponse(BaseModel):
    id: int
    form_version_id: int
    submission_id: int
    category: str
    ai_suggested_category: Optional[str] = None
    author_overridden: bool
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
