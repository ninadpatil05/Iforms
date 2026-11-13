from typing import Dict, List, Optional
from collections import defaultdict

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.section import Section
from app.repositories.branch_rule_repository import branch_rule_repository
from app.repositories.response_value_repository import response_value_repository
from app.repositories.submission_repository import submission_repository
from app.services.section_service import section_service
from app.services.submission_service import submission_service
from app.utils.rule_evaluation import evaluate_condition


class BranchEvaluationService:
    def get_next_section_id(
        self, db: Session, current_section: Section, answers: Dict[int, Optional[str]]
    ) -> Optional[int]:
        rules = branch_rule_repository.get_by_from_section(db, current_section.id)

        # Group rules by (priority, to_section_id)
        # Maintaining insertion / priority order
        paths: Dict[tuple[int, Optional[int]], List] = defaultdict(list)
        for rule in rules:
            paths[(rule.priority, rule.to_section_id)].append(rule)

        # Sort candidate paths by priority asc
        sorted_path_keys = sorted(paths.keys(), key=lambda k: k[0])

        for key in sorted_path_keys:
            priority, to_section_id = key
            group_rules = paths[key]

            # Path passes if ALL rules in this group evaluate to True (ANDed together)
            all_passed = True
            for rule in group_rules:
                actual_value = answers.get(rule.trigger_field_id)
                if not evaluate_condition(rule.operator, actual_value, rule.comparison_value):
                    all_passed = False
                    break

            if all_passed:
                return to_section_id

        # If no rule path matched, try default_next_section_id
        if current_section.default_next_section_id is not None:
            return current_section.default_next_section_id

        # Fallback to the next section by display_order
        statement = (
            select(Section)
            .where(
                Section.form_version_id == current_section.form_version_id,
                Section.display_order > current_section.display_order,
            )
            .order_by(Section.display_order.asc())
        )
        next_sec = db.execute(statement).scalars().first()
        if next_sec:
            return next_sec.id

        return None

    def evaluate_for_submission(
        self, db: Session, submission_id: int, current_section_id: int
    ) -> dict:
        import json
        submission = submission_service.get_submission_by_id(db, submission_id)
        current_section = section_service.get_section_by_id(db, current_section_id)

        if current_section.form_version_id != submission.form_version_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Section does not belong to this submission's form version.",
            )

        # Append current_section_id to visited history
        try:
            visited: list = json.loads(submission.visited_section_ids or "[]")
        except (ValueError, TypeError):
            visited = []
        if not visited or visited[-1] != current_section_id:
            visited.append(current_section_id)

        # Record that respondent reached current_section and update history
        submission_repository.update(
            db,
            db_obj=submission,
            obj_in={
                "last_section_id": current_section.id,
                "visited_section_ids": json.dumps(visited),
            },
        )

        response_values = response_value_repository.get_by_submission(
            db, submission_id
        )
        answers: Dict[int, Optional[str]] = {
            rv.field_id: rv.value_text for rv in response_values
        }

        next_id = self.get_next_section_id(db, current_section, answers)
        return {
            "next_section_id": next_id,
            "is_last_section": next_id is None,
        }


    def evaluate_for_preview(
        self, db: Session, section_id: int, answers: Dict[int, Optional[str]]
    ) -> dict:
        section = section_service.get_section_by_id(db, section_id)
        next_id = self.get_next_section_id(db, section, answers)
        return {
            "next_section_id": next_id,
            "is_last_section": next_id is None,
        }


branch_evaluation_service = BranchEvaluationService()
