from typing import Any, Dict, List, Optional, Union
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.duplicate_override_request import DuplicateOverrideRequest


class DuplicateOverrideRequestRepository:
    def get_by_id(self, db: Session, req_id: int) -> Optional[DuplicateOverrideRequest]:
        statement = select(DuplicateOverrideRequest).where(DuplicateOverrideRequest.id == req_id)
        return db.execute(statement).scalar_one_or_none()

    def get_by_submission_id(self, db: Session, submission_id: int) -> Optional[DuplicateOverrideRequest]:
        statement = select(DuplicateOverrideRequest).where(DuplicateOverrideRequest.submission_id == submission_id)
        return db.execute(statement).scalar_one_or_none()

    def get_pending_for_form(self, db: Session, form_id: int) -> List[DuplicateOverrideRequest]:
        statement = (
            select(DuplicateOverrideRequest)
            .where(
                DuplicateOverrideRequest.form_id == form_id,
                DuplicateOverrideRequest.status == "pending",
            )
            .order_by(DuplicateOverrideRequest.requested_at.desc())
        )
        return list(db.execute(statement).scalars().all())

    def create(
        self,
        db: Session,
        form_id: int,
        submission_id: int,
        duplicate_value: Optional[str] = None,
        status: str = "pending",
    ) -> DuplicateOverrideRequest:
        db_obj = DuplicateOverrideRequest(
            form_id=form_id,
            submission_id=submission_id,
            duplicate_value=duplicate_value,
            status=status,
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        db_obj: DuplicateOverrideRequest,
        obj_in: Union[Dict[str, Any], Any],
    ) -> DuplicateOverrideRequest:
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj


duplicate_override_request_repository = DuplicateOverrideRequestRepository()
