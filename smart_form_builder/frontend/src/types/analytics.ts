export interface AnalyticsOverview {
  total_views: number;
  total_started: number;
  total_submitted: number;
  completion_rate: number;
  average_completion_seconds: number | null;
}

export interface SectionDropOff {
  section_id: number;
  title: string;
  display_order: number;
  reached_count: number;
  completed_count: number;
  drop_off_count: number;
  drop_off_rate: number;
}

export interface ViewsOverTimePoint {
  date: string;
  views: number;
}

export interface AnalyticsDashboardResponse {
  overview: AnalyticsOverview;
  section_drop_off: SectionDropOff[];
  views_over_time: ViewsOverTimePoint[];
}
