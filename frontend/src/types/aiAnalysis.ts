export interface AiInsightEvidence {
  field_ids: number[];
  response_count: number;
  supporting_value?: string | null;
}

export interface AiInsight {
  text: string;
  type: 'trend' | 'quantitative' | 'anomaly' | 'theme';
  confidence: 'high' | 'medium' | 'low';
  evidence: AiInsightEvidence;
}

export interface AiOpenTextTheme {
  theme: string;
  approx_share: number;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
}

export interface AiFieldThemes {
  field_id: number;
  field_label: string;
  sample_size: number;
  themes: AiOpenTextTheme[];
}

export interface AiAnomaly {
  description: string;
  field_ids: number[];
  evidence: string;
}

export interface AiFormImprovement {
  field_id: number;
  suggestion: string;
}

export interface AiGeneratedAnalysis {
  executive_summary: string;
  insights: AiInsight[];
  open_text_themes: AiFieldThemes[];
  anomalies: AiAnomaly[];
  suggested_actions: string[];
  form_improvement_suggestions: AiFormImprovement[];
  limitations: string[];
}

export interface FieldResponseCount {
  field_id: number;
  field_label: string;
  response_count: number;
}

export interface AiComputedFacts {
  total_views: number;
  total_started: number;
  total_submitted: number;
  completion_rate: number;
  average_completion_seconds?: number | null;
  per_field_response_counts: FieldResponseCount[];
}

export interface AiAnalysisReport {
  id: number;
  form_version_id: number;
  submission_count_at_run: number;
  computed_facts: AiComputedFacts;
  generated: AiGeneratedAnalysis;
  created_at: string;
}

export interface AiAnalysisReportSummary {
  id: number;
  submission_count_at_run: number;
  created_at: string;
}

export interface ResponseCategorizationItem {
  id: number;
  form_version_id: number;
  submission_id: number;
  category: 'useful' | 'not_useful' | 'uncategorized';
  ai_suggested_category?: 'useful' | 'not_useful' | null;
  author_overridden: boolean;
  updated_at: string;
}
