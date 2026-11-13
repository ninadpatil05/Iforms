from datetime import date
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AnalyticsOverview(BaseModel):
    total_views: int
    total_started: int
    total_submitted: int
    completion_rate: float
    average_completion_seconds: Optional[float] = None


class SectionDropOff(BaseModel):
    section_id: int
    title: str
    display_order: int
    reached_count: int
    completed_count: int
    drop_off_count: int
    drop_off_rate: float


class ViewsOverTimePoint(BaseModel):
    date: date
    views: int


class AnalyticsDashboardResponse(BaseModel):
    overview: AnalyticsOverview
    section_drop_off: List[SectionDropOff]
    views_over_time: List[ViewsOverTimePoint]

    model_config = ConfigDict(from_attributes=True)
