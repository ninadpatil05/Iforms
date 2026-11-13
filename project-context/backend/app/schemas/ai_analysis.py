from datetime import datetime
from typing import Any, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AiInsightEvidence(BaseModel):
    field_ids: List[int] = Field(default_factory=list)
    response_count: int = 0
    supporting_value: Optional[str] = None


class AiInsight(BaseModel):
    text: str
    type: Literal["trend", "quantitative", "anomaly", "theme"]
    confidence: Literal["high", "medium", "low"]
    evidence: AiInsightEvidence


class AiOpenTextTheme(BaseModel):
    theme: str
    approx_share: float
    sentiment: Literal["positive", "neutral", "negative", "mixed"]


class AiFieldThemes(BaseModel):
    field_id: int
    field_label: str
    sample_size: int
    themes: List[AiOpenTextTheme] = Field(default_factory=list)


class AiAnomaly(BaseModel):
    description: str
    field_ids: List[int] = Field(default_factory=list)
    evidence: str


class AiFormImprovement(BaseModel):
    field_id: int
    suggestion: str


class AiGeneratedAnalysis(BaseModel):
    executive_summary: str
    insights: List[AiInsight] = Field(default_factory=list)
    open_text_themes: List[AiFieldThemes] = Field(default_factory=list)
    anomalies: List[AiAnomaly] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    form_improvement_suggestions: List[AiFormImprovement] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)


class FieldResponseCount(BaseModel):
    field_id: int
    field_label: str
    response_count: int


class AiComputedFacts(BaseModel):
    total_views: int
    total_started: int
    total_submitted: int
    completion_rate: float
    average_completion_seconds: Optional[float] = None
    per_field_response_counts: List[FieldResponseCount] = Field(default_factory=list)


class AiAnalysisReportResponse(BaseModel):
    id: int
    form_version_id: int
    submission_count_at_run: int
    computed_facts: AiComputedFacts
    generated: AiGeneratedAnalysis
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def parse_report_json(cls, data: Any) -> Any:
        if hasattr(data, "report_json") and isinstance(data.report_json, dict):
            report_dict = data.report_json
            return {
                "id": getattr(data, "id", None),
                "form_version_id": getattr(data, "form_version_id", None),
                "submission_count_at_run": getattr(data, "submission_count_at_run", None),
                "computed_facts": report_dict.get("computed_facts", {}),
                "generated": report_dict.get("generated", {}),
                "created_at": getattr(data, "created_at", None),
            }
        return data


class AiAnalysisReportSummary(BaseModel):
    id: int
    submission_count_at_run: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
