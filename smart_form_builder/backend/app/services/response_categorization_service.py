from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.response_categorization import ResponseCategorization
from app.models.user import User
from app.repositories.response_categorization_repository import response_categorization_repository
from app.repositories.submission_repository import submission_repository
from app.services.form_version_service import form_version_service


class ResponseCategorizationService:
    def get_categorizations_for_version(
        self, db: Session, user: User, form_version_id: int
    ) -> List[ResponseCategorization]:
        form_version_service.assert_owns_parent_form(db, form_version_id, user)
        return response_categorization_repository.ensure_rows_for_version(db, form_version_id)

    def update_categorization_for_submission(
        self, db: Session, user: User, submission_id: int, category: str
    ) -> ResponseCategorization:
        sub = submission_repository.get_by_id(db, submission_id)
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Submission with ID {submission_id} not found."
            )
        form_version_service.assert_owns_parent_form(db, sub.form_version_id, user)

        row = response_categorization_repository.get_by_submission(db, submission_id)
        if not row:
            row = ResponseCategorization(
                form_version_id=sub.form_version_id,
                submission_id=sub.id,
                category=category,
                ai_suggested_category=None,
                author_overridden=True,
            )
            db.add(row)
            db.commit()
            db.refresh(row)
            return row
        
        return response_categorization_repository.update_category(db, row, category)

    def reset_categorizations_for_version(
        self, db: Session, user: User, form_version_id: int
    ) -> List[ResponseCategorization]:
        form_version_service.assert_owns_parent_form(db, form_version_id, user)
        return response_categorization_repository.reset_for_version(db, form_version_id)


response_categorization_service = ResponseCategorizationService()
