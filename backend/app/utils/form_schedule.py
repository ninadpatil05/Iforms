from datetime import datetime, timezone
from typing import Any
from fastapi import HTTPException, status


def check_form_schedule(form: Any) -> None:
    """
    Checks if a form's schedule window (starts_at / ends_at) permits respondent access.
    If now < starts_at: raises HTTP 403 detail="FORM_NOT_YET_OPEN".
    If now > ends_at: raises HTTP 403 detail="FORM_CLOSED".
    """
    if not form:
        return
    now = datetime.now(timezone.utc)
    starts_at = getattr(form, "starts_at", None)
    if starts_at is not None:
        if starts_at.tzinfo is None:
            starts_at = starts_at.replace(tzinfo=timezone.utc)
        if now < starts_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORM_NOT_YET_OPEN",
            )
    ends_at = getattr(form, "ends_at", None)
    if ends_at is not None:
        if ends_at.tzinfo is None:
            ends_at = ends_at.replace(tzinfo=timezone.utc)
        if now > ends_at:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="FORM_CLOSED",
            )
