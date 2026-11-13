from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from app.models.response_categorization import ResponseCategorization
from app.models.submission import Submission


class ResponseCategorizationRepository:
    def get_by_version(self, db: Session, form_version_id: int) -> List[ResponseCategorization]:
        return (
            db.query(ResponseCategorization)
            .filter(ResponseCategorization.form_version_id == form_version_id)
            .order_by(ResponseCategorization.submission_id.asc())
            .all()
        )

    def get_by_submission(self, db: Session, submission_id: int) -> Optional[ResponseCategorization]:
        return (
            db.query(ResponseCategorization)
            .filter(ResponseCategorization.submission_id == submission_id)
            .first()
        )

    def ensure_rows_for_version(self, db: Session, form_version_id: int) -> List[ResponseCategorization]:
        # 1. Fetch all submissions for version
        submissions = (
            db.query(Submission)
            .filter(Submission.form_version_id == form_version_id)
            .all()
        )

        # 2. Fetch existing categorizations
        existing = {
            c.submission_id: c
            for c in db.query(ResponseCategorization)
            .filter(ResponseCategorization.form_version_id == form_version_id)
            .all()
        }

        # 3. Create missing rows
        new_rows = []
        for sub in submissions:
            if sub.id not in existing:
                row = ResponseCategorization(
                    form_version_id=form_version_id,
                    submission_id=sub.id,
                    category="uncategorized",
                    ai_suggested_category=None,
                    author_overridden=False,
                )
                db.add(row)
                new_rows.append(row)

        if new_rows:
            db.commit()

        return (
            db.query(ResponseCategorization)
            .filter(ResponseCategorization.form_version_id == form_version_id)
            .order_by(ResponseCategorization.submission_id.asc())
            .all()
        )

    def update_category(
        self, db: Session, row: ResponseCategorization, category: str
    ) -> ResponseCategorization:
        row.category = category
        row.author_overridden = True
        row.updated_at = func.now()
        db.commit()
        db.refresh(row)
        return row

    def reset_for_version(self, db: Session, form_version_id: int) -> List[ResponseCategorization]:
        rows = (
            db.query(ResponseCategorization)
            .filter(ResponseCategorization.form_version_id == form_version_id)
            .all()
        )
        for row in rows:
            row.category = row.ai_suggested_category if row.ai_suggested_category is not None else "uncategorized"
            row.author_overridden = False
            row.updated_at = func.now()
        
        db.commit()
        return (
            db.query(ResponseCategorization)
            .filter(ResponseCategorization.form_version_id == form_version_id)
            .order_by(ResponseCategorization.submission_id.asc())
            .all()
        )


response_categorization_repository = ResponseCategorizationRepository()
