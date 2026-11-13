from typing import Any, Optional

from fastapi import HTTPException, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models.ai_analysis_report import AiAnalysisReport
from app.models.user import User
from app.repositories.ai_analysis_report_repository import ai_analysis_report_repository
from app.repositories.response_value_repository import response_value_repository
from app.schemas.ai_analysis import (
    AiAnalysisReportResponse,
    AiComputedFacts,
    AiGeneratedAnalysis,
    FieldResponseCount,
)
from app.services.ai.factory import get_ai_provider
from app.services.analytics_service import analytics_service
from app.services.field_service import field_service
from app.services.form_version_service import form_version_service

MIN_RESPONSES_FOR_ANALYSIS = 5


class AiAnalysisService:
    async def run_analysis(
        self, db: Session, user: User, form_version_id: int
    ) -> AiAnalysisReport:
        form_version_service.assert_owns_parent_form(db, form_version_id, user)

        # 1. Compute facts from AnalyticsService and ResponseValueRepository
        dashboard = analytics_service.get_dashboard(db, form_version_id, user)
        overview = dashboard.overview

        fields = field_service.get_fields_by_version(db, form_version_id)
        counts_map = response_value_repository.count_responses_per_field(db, form_version_id)
        per_field_counts = [
            FieldResponseCount(
                field_id=f.id,
                field_label=f.label,
                response_count=counts_map.get(f.id, 0),
            )
            for f in fields
        ]

        computed_facts = AiComputedFacts(
            total_views=overview.total_views,
            total_started=overview.total_started,
            total_submitted=overview.total_submitted,
            completion_rate=overview.completion_rate,
            average_completion_seconds=overview.average_completion_seconds,
            per_field_response_counts=per_field_counts,
        )

        total_submitted = overview.total_submitted

        # 2. Check threshold for AI provider call
        if total_submitted < MIN_RESPONSES_FOR_ANALYSIS:
            generated = AiGeneratedAnalysis(
                executive_summary="Insufficient response volume for AI analysis.",
                insights=[],
                open_text_themes=[],
                anomalies=[],
                suggested_actions=[],
                form_improvement_suggestions=[],
                limitations=[
                    f"Not enough responses yet ({total_submitted} of a recommended {MIN_RESPONSES_FOR_ANALYSIS}+) — "
                    "analysis will be more reliable once you have a few more."
                ],
            )
        else:
            open_text_data = response_value_repository.get_open_text_by_field(
                db, form_version_id, exclude_field_types=["email"], max_per_field=500
            )

            ai_payload = {
                "computed_facts": computed_facts.model_dump(mode="json"),
                "open_text_responses": open_text_data,
            }

            provider = get_ai_provider()
            raw_dict = await provider.analyze_responses(
                payload=ai_payload, response_schema=AiGeneratedAnalysis
            )

            try:
                generated = AiGeneratedAnalysis.model_validate(raw_dict)
            except ValidationError as val_err:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="AI response couldn't be understood, please try again.",
                ) from val_err

        report_json = {
            "computed_facts": computed_facts.model_dump(mode="json"),
            "generated": generated.model_dump(mode="json"),
        }

        obj_in = {
            "form_version_id": form_version_id,
            "user_id": user.id,
            "submission_count_at_run": total_submitted,
            "report_json": report_json,
        }

        return ai_analysis_report_repository.create(db, obj_in)

    def get_latest_report(
        self, db: Session, user: User, form_version_id: int
    ) -> Optional[AiAnalysisReport]:
        form_version_service.assert_owns_parent_form(db, form_version_id, user)
        return ai_analysis_report_repository.get_latest_by_version(db, form_version_id)

    def get_report_history(
        self, db: Session, user: User, form_version_id: int
    ) -> list[AiAnalysisReport]:
        form_version_service.assert_owns_parent_form(db, form_version_id, user)
        return ai_analysis_report_repository.get_history_by_version(db, form_version_id)


ai_analysis_service = AiAnalysisService()
