from typing import List
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.form import Form
from app.models.user import User
from app.repositories.form_repository import form_repository
from app.schemas.form import FormCreate, FormUpdate, FormStatus


class FormService:
    def _validate_owner_exists(self, db: Session, owner_id: int) -> None:
        """Verify that the owner user exists in the database."""
        statement = select(User).where(User.id == owner_id)
        user = db.execute(statement).scalar_one_or_none()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Owner user with ID {owner_id} does not exist.",
            )

    def create_form(self, db: Session, form_in: FormCreate) -> Form:
        """Create a new form after validating that the owner exists."""
        self._validate_owner_exists(db, form_in.owner_id)
        return form_repository.create(db, form_in)

    def get_form_by_id(self, db: Session, form_id: int) -> Form:
        """Retrieve a form by ID, raising a 404 error if it does not exist."""
        form = form_repository.get_by_id(db, form_id)
        if not form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Form with ID {form_id} not found.",
            )
        return form

    def get_forms(self, db: Session, skip: int = 0, limit: int = 100) -> List[Form]:
        """Retrieve all forms with pagination."""
        return form_repository.get_all(db, skip=skip, limit=limit)

    def get_forms_by_owner(self, db: Session, owner_id: int, skip: int = 0, limit: int = 100) -> List[Form]:
        """Retrieve forms belonging to a specific owner, after validating their existence."""
        self._validate_owner_exists(db, owner_id)
        return form_repository.get_by_owner(db, owner_id=owner_id, skip=skip, limit=limit)

    def get_my_forms(
        self,
        db: Session,
        owner_id: int,
        include_archived: bool = False,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Form]:
        """
        Retrieve forms belonging to the authenticated user, ordered newest-first.
        Archived forms are excluded by default; pass include_archived=True to include them.
        owner_id is always sourced from the JWT token — never from client input.
        """
        return form_repository.get_by_owner_ordered(
            db,
            owner_id=owner_id,
            include_archived=include_archived,
            skip=skip,
            limit=limit,
        )

    def update_form(self, db: Session, form_id: int, form_in: FormUpdate) -> Form:
        """
        Update an existing form's title and/or description.
        owner_id and status are stripped defensively even though they are no longer
        present in FormUpdate, guarding against future schema drift.
        """
        db_obj = self.get_form_by_id(db, form_id)
        # Build a clean update dict — exclude immutable fields as a safety net
        update_data = form_in.model_dump(exclude_unset=True)
        update_data.pop("owner_id", None)
        update_data.pop("status", None)
        update_data.pop("created_at", None)
        return form_repository.update(db, db_obj=db_obj, obj_in=update_data)

    def archive_form(self, db: Session, form_id: int) -> Form:
        """
        Soft-archive a form by setting its status to 'archived'.
        """
        db_obj = self.get_form_by_id(db, form_id)
        return form_repository.update(
            db,
            db_obj=db_obj,
            obj_in={"status": FormStatus.ARCHIVED.value},
        )

    def unarchive_form(self, db: Session, form_id: int) -> Form:
        """
        Restore an archived form back to 'draft'.
        """
        db_obj = self.get_form_by_id(db, form_id)
        return form_repository.update(
            db,
            db_obj=db_obj,
            obj_in={"status": FormStatus.DRAFT.value},
        )

    def trash_form(self, db: Session, form_id: int) -> Form:
        """
        Move a form to trash (7-day retention before permanent deletion).
        """
        db_obj = self.get_form_by_id(db, form_id)
        return form_repository.update(
            db,
            db_obj=db_obj,
            obj_in={"status": FormStatus.TRASHED.value},
        )

    def restore_form(self, db: Session, form_id: int) -> Form:
        """
        Restore a trashed form back to active 'draft' status.
        """
        db_obj = self.get_form_by_id(db, form_id)
        return form_repository.update(
            db,
            db_obj=db_obj,
            obj_in={"status": FormStatus.DRAFT.value},
        )

    def delete_form(self, db: Session, form_id: int) -> Form:
        """Move an existing form to trash."""
        return self.trash_form(db, form_id)

    def permanent_delete_form(self, db: Session, form_id: int) -> Form:
        """Permanently destroy a form and all associated data."""
        db_obj = self.get_form_by_id(db, form_id)
        return form_repository.delete(db, form_id=form_id)

    def assert_owner(self, db: Session, form_id: int, current_user: User) -> Form:
        """
        Verify the authenticated user owns the form.
        Raises 404 first (if form not found), then 403 (if not the owner).
        """
        form = self.get_form_by_id(db, form_id)
        if form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this form.",
            )
        return form

    def get_or_create_draft_version(self, db: Session, form_id: int):
        """Return the form's active draft, creating version 1 when needed."""
        from app.repositories.form_version_repository import form_version_repository
        from app.schemas.form_version import FormVersionCreate
        from app.services.form_version_service import form_version_service

        self.get_form_by_id(db, form_id)
        draft = form_version_repository.get_draft_by_form(db, form_id)
        return draft or form_version_service.create_version(db, FormVersionCreate(form_id=form_id))


    def get_submission_count(self, db: Session, form_id: int) -> int:
        from app.models.form_version import FormVersion
        from app.models.submission import Submission
        from sqlalchemy import func
        stmt = (
            select(func.count(Submission.id))
            .join(FormVersion, Submission.form_version_id == FormVersion.id)
            .where(FormVersion.form_id == form_id, Submission.status == "submitted")
        )
        return db.execute(stmt).scalar() or 0

    def to_form_response(self, db: Session, form: Form):
        from app.schemas.form import FormResponse
        sub_count = self.get_submission_count(db, form.id)
        return FormResponse(
            id=form.id,
            owner_id=form.owner_id,
            title=form.title,
            description=form.description,
            status=form.status,
            access_mode=form.access_mode,
            allow_resubmission=form.allow_resubmission,
            starts_at=form.starts_at,
            ends_at=form.ends_at,
            duplicate_check_field_id=form.duplicate_check_field_id,
            duplicate_policy=form.duplicate_policy,
            submission_count=sub_count,
            created_at=form.created_at,
            updated_at=form.updated_at,
        )


form_service = FormService()
