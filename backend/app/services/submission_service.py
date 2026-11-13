import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.submission import Submission
from app.models.user import User
from app.repositories.section_repository import section_repository
from app.repositories.submission_repository import submission_repository
from app.services.form_version_service import form_version_service
from app.services.form_service import form_service
from app.schemas.submission import SubmissionCreate, SubmissionUpdate, FormSubmissionResponse
from app.schemas.export import ExportFilters
from app.utils.form_schedule import check_form_schedule


class SubmissionService:
    def _to_form_submission_response(self, submission: Submission) -> FormSubmissionResponse:
        return FormSubmissionResponse(
            id=submission.id,
            form_version_id=submission.form_version_id,
            respondent_identifier=submission.respondent_identifier,
            status=submission.status,
            started_at=submission.started_at,
            submitted_at=submission.submitted_at,
            version_number=submission.form_version.version_number,
            answers=[{
                "id": answer.id,
                "submission_id": answer.submission_id,
                "field_id": answer.field_id,
                "value_text": answer.value_text,
                "file_url": answer.file_url,
                "field_label": answer.field.label,
                "field_type": answer.field.field_type,
                "display_order": answer.field.display_order,
                "file_download_url": f"/api/response-values/{answer.id}/file" if answer.file_url else None,
            } for answer in sorted(submission.response_values, key=lambda item: item.field.display_order)],
        )

    def create_submission(self, db: Session, submission_in: SubmissionCreate) -> Submission:
        from app.repositories.form_invite_repository import form_invite_repository
        version = form_version_service.get_version_by_id(db, submission_in.form_version_id)
        if not version.is_published:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Submissions can only be created for published form versions.",
            )

        form = version.form
        check_form_schedule(form)
        invite_obj = None

        if form.access_mode == "invite_only":
            if not submission_in.invite_token:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invite token is required for this form.",
                )
            invite_obj = form_invite_repository.get_by_token(db, submission_in.invite_token)
            if not invite_obj:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid invite token.",
                )
            if invite_obj.form_id != form.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invite token is not valid for this form.",
                )

            # Check if used up AND resubmission is disabled
            if invite_obj.use_count >= invite_obj.max_uses and not form.allow_resubmission:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="This invite link has already been used.",
                )

            # Pre-populate respondent identifier with the invite email
            submission_in.respondent_identifier = invite_obj.email

        sub = submission_repository.create(db, submission_in)

        # Attach a cryptographic access token so respondents can retrieve their own
        # in-progress answers without needing auth (prevents sequential-ID enumeration).
        sub.access_token = secrets.token_urlsafe(32)
        db.add(sub)
        db.commit()
        db.refresh(sub)

        # Increment use count and record used_at
        if invite_obj is not None:
            invite_obj.use_count += 1
            invite_obj.used_at = datetime.now(timezone.utc)
            db.add(invite_obj)
            db.commit()

        sections = section_repository.get_by_form_version(db, version.id)
        if sections:
            first_sec = min(sections, key=lambda s: s.display_order)
            sub = submission_repository.update(db, db_obj=sub, obj_in={"last_section_id": first_sec.id})

        return sub


    def get_submission_by_id(self, db: Session, submission_id: int) -> Submission:
        db_obj = submission_repository.get_by_id(db, submission_id)
        if not db_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Submission with ID {submission_id} not found.",
            )
        return db_obj

    def get_submissions_by_version(
        self, db: Session, form_version_id: int, skip: int = 0, limit: Optional[int] = None
    ) -> List[Submission]:
        form_version_service.get_version_by_id(db, form_version_id)
        return submission_repository.get_by_form_version(db, form_version_id=form_version_id, skip=skip, limit=limit)

    def get_submissions_by_form(
        self, db: Session, form_id: int, skip: int = 0, limit: Optional[int] = None
    ) -> List[Submission]:
        form_service.get_form_by_id(db, form_id)
        return submission_repository.get_by_form(db, form_id=form_id, skip=skip, limit=limit)

    def build_form_submissions_response(
        self, db: Session, form_id: int, skip: int = 0, limit: Optional[int] = None
    ) -> List[FormSubmissionResponse]:
        form_service.get_form_by_id(db, form_id)
        submissions = self.get_submissions_by_form(db, form_id, skip, limit)
        return [self._to_form_submission_response(sub) for sub in submissions]

    def build_filtered_form_submissions_response(
        self, db: Session, form_id: int, filters: ExportFilters, skip: int = 0, limit: Optional[int] = None
    ) -> List[FormSubmissionResponse]:
        form_service.get_form_by_id(db, form_id)
        status_val = filters.status.value if filters.status is not None else None
        submissions = submission_repository.get_filtered_by_form(
            db=db,
            form_id=form_id,
            status=status_val,
            date_from=filters.date_from,
            date_to=filters.date_to,
            search=filters.search,
            skip=skip,
            limit=limit,
        )
        return [self._to_form_submission_response(sub) for sub in submissions]

    def _evaluate_and_store_computed_fields(self, db: Session, submission: Submission) -> None:
        import json
        from app.repositories.field_repository import field_repository
        from app.models.response_value import ResponseValue
        from app.utils.formula_evaluation import evaluate_formula

        all_fields = field_repository.get_by_form_version(db, submission.form_version_id, limit=10000)
        computed_fields = [f for f in all_fields if f.field_type == "computed"]
        if not computed_fields:
            return

        # Topological sort of computed fields
        cf_map = {f.id: f for f in computed_fields}
        adj: dict[int, set[int]] = {f.id: set() for f in computed_fields}
        in_degree: dict[int, int] = {f.id: 0 for f in computed_fields}

        for f in computed_fields:
            if not f.validation_json:
                continue
            try:
                cfg = json.loads(f.validation_json)
                terms = cfg.get("terms", [])
                for i, t in enumerate(terms):
                    if i % 2 == 0 and "field_id" in t:
                        op_id = t["field_id"]
                        if op_id in cf_map:
                            adj[op_id].add(f.id)
            except Exception:
                pass

        for u in adj:
            for v in adj[u]:
                in_degree[v] += 1

        queue = [fid for fid in cf_map if in_degree[fid] == 0]
        sorted_fields = []

        while queue:
            curr = queue.pop(0)
            sorted_fields.append(cf_map[curr])
            for nxt in adj[curr]:
                in_degree[nxt] -= 1
                if in_degree[nxt] == 0:
                    queue.append(nxt)

        remaining = [f for f in computed_fields if f not in sorted_fields]
        ordered_computed = sorted_fields + remaining

        from app.repositories.response_value_repository import response_value_repository
        existing_rvs = response_value_repository.get_by_submission(db, submission.id)

        # Build answers dictionary from current response values
        answers_dict: dict[int, Optional[str]] = {
            rv.field_id: rv.value_text for rv in existing_rvs
        }

        # Map existing response_value objects by field_id
        rv_map = {rv.field_id: rv for rv in existing_rvs}

        for cf in ordered_computed:
            if not cf.validation_json:
                continue
            try:
                cfg = json.loads(cf.validation_json)
                terms = cfg.get("terms", [])
                dec_places = cfg.get("decimal_places", 2)
                res = evaluate_formula(terms, answers_dict, decimal_places=dec_places)
                res_str = str(res) if res is not None else ""

                answers_dict[cf.id] = res_str

                if cf.id in rv_map:
                    rv_map[cf.id].value_text = res_str
                else:
                    new_rv = ResponseValue(
                        submission_id=submission.id,
                        field_id=cf.id,
                        value_text=res_str,
                    )
                    db.add(new_rv)
                    rv_map[cf.id] = new_rv
            except Exception:
                pass

        db.flush()

    def check_duplicate(self, db: Session, submission: Submission) -> Optional[dict]:
        form = submission.form_version.form
        if not form or form.duplicate_policy == "allow" or form.duplicate_check_field_id is None:
            return None

        field_id = form.duplicate_check_field_id
        matching_rv = next((rv for rv in submission.response_values if rv.field_id == field_id), None)
        if not matching_rv or not matching_rv.value_text or not matching_rv.value_text.strip():
            return None

        from app.repositories.response_value_repository import response_value_repository
        match = response_value_repository.find_matching_submission(
            db,
            form_version_id=submission.form_version_id,
            field_id=field_id,
            value_text=matching_rv.value_text,
            exclude_submission_id=submission.id,
        )

        if match:
            return {
                "policy": form.duplicate_policy,
                "duplicate_field_id": field_id,
                "matched_submission_id": match.id,
            }
        return None

    def submit_submission(self, db: Session, submission_id: int) -> Submission:
        from app.repositories.field_repository import field_repository
        from app.utils.rule_evaluation import resolve_field_states

        db_obj = self.get_submission_by_id(db, submission_id)
        check_form_schedule(db_obj.form_version.form)
        if db_obj.status == "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submission has already been submitted.",
            )

        # --- First compute and store derived fields ---
        self._evaluate_and_store_computed_fields(db, db_obj)

        # --- Check Duplicate Policy BEFORE marking as submitted ---
        dup = self.check_duplicate(db, db_obj)
        if dup and dup["policy"] == "block":
            from app.repositories.duplicate_override_request_repository import duplicate_override_request_repository
            override_req = duplicate_override_request_repository.get_by_submission_id(db, db_obj.id)
            if not override_req or override_req.status != "approved":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "code": "DUPLICATE_BLOCKED",
                        "message": "It looks like you've already submitted this form.",
                        "duplicate_field_id": dup["duplicate_field_id"],
                    },
                )

        # --- Build answers dict from current response values ---
        answers: dict[int, Optional[str]] = {
            rv.field_id: rv.value_text for rv in db_obj.response_values
        }
        # Also include file_url presence in a parallel map for file fields
        file_answers: dict[int, Optional[str]] = {
            rv.field_id: rv.file_url for rv in db_obj.response_values
        }

        # --- Load condition groups and resolve visibility / requiredness ---
        groups = db_obj.form_version.condition_groups
        resolved = resolve_field_states(groups, answers)

        # --- Validate required fields ---
        all_fields = field_repository.get_by_form_version(db, db_obj.form_version_id, limit=10000)
        missing_labels: list[str] = []

        for field in all_fields:
            field_resolved = resolved.get(field.id, {})
            is_hidden = field_resolved.get("hidden", False)
            if is_hidden:
                continue  # hidden fields are never required

            is_required = field.required or field_resolved.get("required_override", False)
            if not is_required:
                continue

            # Check value: either non-empty value_text or a file_url is sufficient
            value = answers.get(field.id)
            has_file = bool(file_answers.get(field.id))
            if not has_file and (value is None or str(value).strip() == ""):
                missing_labels.append(field.label)

        if missing_labels:
            labels_str = ", ".join(f'"{lbl}"' for lbl in missing_labels)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Required field(s) not filled: {labels_str}",
            )

        # --- Validation passed: mark submitted ---
        update_data = {"status": "submitted", "submitted_at": datetime.now(timezone.utc)}
        submitted_obj = submission_repository.update(db, db_obj=db_obj, obj_in=update_data)

        if dup and dup["policy"] == "warn":
            setattr(submitted_obj, "duplicate_warning", True)

        return submitted_obj


    def update_submission(self, db: Session, submission_id: int, submission_in: SubmissionUpdate) -> Submission:
        db_obj = self.get_submission_by_id(db, submission_id)
        return submission_repository.update(db, db_obj=db_obj, obj_in=submission_in)

    def delete_submission(self, db: Session, submission_id: int) -> Optional[Submission]:
        db_obj = self.get_submission_by_id(db, submission_id)
        return submission_repository.delete(db, submission_id=submission_id)

    def assert_owns_parent_form(self, db: Session, submission_id: int, current_user: User) -> Submission:
        db_obj = self.get_submission_by_id(db, submission_id)
        version = form_version_service.get_version_by_id(db, db_obj.form_version_id)
        if version.form.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this submission.",
            )
        return db_obj

    def seed_demo_submissions(self, db: Session, form_version_id: int, count: int = 5) -> List[Submission]:
        import random
        version = form_version_service.get_version_by_id(db, form_version_id)
        fields = version.fields

        sample_names = ["Aarav Sharma", "Ananya Roy", "Rohan Gupta", "Priya Patel", "Vikram Singh"]
        sample_colleges = ["IIT Bombay", "BITS Pilani", "Delhi University", "VIT Vellore", "NIT Surathkal"]
        feedbacks = [
          "The fest was amazingly well organized! Loved the tech workshops and musical night.",
          "Great experience overall. Food stalls were slightly crowded, but events were fantastic.",
          "Very smooth registration process. Looking forward to attending again next year!",
          "Decent event structure. Registration desk was very helpful.",
          "Outstanding organization and great venue arrangements. Highly recommended!"
        ]

        created_submissions = []
        now = datetime.now(timezone.utc)

        for i in range(count):
            name = sample_names[i % len(sample_names)]
            sub = Submission(
                form_version_id=form_version_id,
                status="submitted",
                started_at=now,
                submitted_at=now,
                respondent_identifier=f"demo_user_{i+1}@example.com"
            )
            db.add(sub)
            db.commit()
            db.refresh(sub)

            from app.models.response_value import ResponseValue
            for f in fields:
                ft = (f.field_type or "text").lower()
                label_lower = (f.label or "").lower()
                val = "Demo Response"

                if "email" in ft or "email" in label_lower:
                    val = f"demo_{i+1}@example.com"
                elif "name" in label_lower:
                    val = name
                elif "college" in label_lower or "org" in label_lower:
                    val = sample_colleges[i % len(sample_colleges)]
                elif "rating" in ft or "rate" in label_lower or "satisfaction" in label_lower:
                    val = str(random.choice([4, 5, 5, 4, 5]))
                elif "know" in label_lower or "feedback" in label_lower or "experience" in label_lower or "textarea" in ft:
                    val = feedbacks[i % len(feedbacks)]
                elif "mode" in label_lower or "radio" in ft or "select" in ft or "dropdown" in ft:
                    val = "Offline" if i % 2 == 0 else "Online"
                elif "food" in label_lower:
                    val = "Vegetarian" if i % 2 == 0 else "Non-Vegetarian"
                elif "number" in ft or "seat" in label_lower or "quantity" in label_lower:
                    val = str(random.choice([1, 2, 3]))
                elif "total" in label_lower or "price" in label_lower:
                    val = "$50"
                elif "recommend" in label_lower:
                    val = "Yes, absolutely!"

                rv = ResponseValue(
                    submission_id=sub.id,
                    field_id=f.id,
                    value_text=val
                )
                db.add(rv)
            db.commit()
            created_submissions.append(sub)

        return created_submissions


    def build_server_filtered_submissions_response(
        self,
        db: Session,
        form_id: int,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: Optional[str] = "submitted_at",
        sort_order: Optional[str] = "desc",
        skip: int = 0,
        limit: Optional[int] = None,
    ) -> List[FormSubmissionResponse]:
        form_service.get_form_by_id(db, form_id)
        results = submission_repository.get_server_filtered_submissions(
            db=db,
            form_id=form_id,
            category=category,
            status=status,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            skip=skip,
            limit=limit,
        )
        res = []
        for sub, cat_row in results:
            res_obj = self._to_form_submission_response(sub)
            res_obj.category = cat_row.category if cat_row else "uncategorized"
            res_obj.ai_suggested_category = cat_row.ai_suggested_category if cat_row else None
            res_obj.author_overridden = cat_row.author_overridden if cat_row else False
            res.append(res_obj)
        return res


submission_service = SubmissionService()
