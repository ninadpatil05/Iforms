from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.analytics_repository import analytics_repository
from app.repositories.section_repository import section_repository
from app.schemas.analytics import (
    AnalyticsDashboardResponse,
    AnalyticsOverview,
    SectionDropOff,
    ViewsOverTimePoint,
)
from app.services.form_service import form_service
from app.services.form_version_service import form_version_service


class AnalyticsService:
    def get_dashboard(
        self, db: Session, form_version_id: int, current_user: User
    ) -> AnalyticsDashboardResponse:
        version = form_version_service.assert_owns_parent_form(
            db, form_version_id, current_user
        )
        form_id = version.form_id
        return self.get_dashboard_for_form(db=db, form_id=form_id, current_user=current_user, target_version_id=form_version_id)

    def get_dashboard_for_form(
        self, db: Session, form_id: int, current_user: User, target_version_id: Optional[int] = None
    ) -> AnalyticsDashboardResponse:
        form_service.assert_owner(db, form_id, current_user)

        all_versions = form_version_service.get_versions_by_form(db, form_id)
        all_version_ids = [v.id for v in all_versions] if all_versions else ([target_version_id] if target_version_id else [])

        if not all_version_ids:
            return AnalyticsDashboardResponse(
                overview=AnalyticsOverview(
                    total_views=0,
                    total_started=0,
                    total_submitted=0,
                    completion_rate=0.0,
                    average_completion_seconds=None,
                ),
                section_drop_off=[],
                views_over_time=[],
            )

        total_views = analytics_repository.count_views(db, all_version_ids)
        status_counts = analytics_repository.count_submissions_by_status(
            db, all_version_ids
        )
        total_started = sum(status_counts.values())
        total_submitted = status_counts.get("submitted", 0)
        completion_rate = (
            total_submitted / total_started if total_started > 0 else 0.0
        )
        avg_seconds = analytics_repository.average_completion_seconds(
            db, all_version_ids
        )

        # For section drop off evaluation, pick sections from target version or published version or draft
        version_id_for_sections = target_version_id
        if not version_id_for_sections and all_versions:
            pub = next((v for v in all_versions if v.is_published), None)
            version_id_for_sections = pub.id if pub else all_versions[-1].id

        sections = section_repository.get_by_form_version(db, version_id_for_sections) if version_id_for_sections else []
        progress = analytics_repository.get_submission_progress(
            db, all_version_ids
        )

        section_drop_off: List[SectionDropOff] = []

        if sections:
            sec_order_map = {s.id: s.display_order for s in sections}
            max_order = max(s.display_order for s in sections)

            parsed_submissions = []
            for status_str, last_sec_id in progress:
                is_submitted = status_str == "submitted"
                if is_submitted:
                    parsed_submissions.append((max_order, True))
                elif last_sec_id is not None and last_sec_id in sec_order_map:
                    parsed_submissions.append((sec_order_map[last_sec_id], False))
                else:
                    parsed_submissions.append((0, False))

            for section in sections:
                s_order = section.display_order
                reached_count = sum(
                    1 for eff_order, _ in parsed_submissions if eff_order >= s_order
                )
                completed_count = sum(
                    1
                    for eff_order, is_sub in parsed_submissions
                    if eff_order > s_order or is_sub
                )
                drop_off_count = reached_count - completed_count
                drop_off_rate = (
                    drop_off_count / reached_count if reached_count > 0 else 0.0
                )

                section_drop_off.append(
                    SectionDropOff(
                        section_id=section.id,
                        title=section.title,
                        display_order=section.display_order,
                        reached_count=reached_count,
                        completed_count=completed_count,
                        drop_off_count=drop_off_count,
                        drop_off_rate=round(drop_off_rate, 4),
                    )
                )

        raw_views_over_time = analytics_repository.count_views_by_day(
            db, all_version_ids
        )
        views_over_time = [
            ViewsOverTimePoint(date=d, views=v) for d, v in raw_views_over_time
        ]

        overview = AnalyticsOverview(
            total_views=total_views,
            total_started=total_started,
            total_submitted=total_submitted,
            completion_rate=round(completion_rate, 4),
            average_completion_seconds=round(avg_seconds, 2)
            if avg_seconds is not None
            else None,
        )

        return AnalyticsDashboardResponse(
            overview=overview,
            section_drop_off=section_drop_off,
            views_over_time=views_over_time,
        )


analytics_service = AnalyticsService()
