import api from './axios';
import type { AnalyticsDashboardResponse } from '@/types/analytics';

export const getDashboard = async (formVersionId: number) =>
  (await api.get<AnalyticsDashboardResponse>(`/analytics/${formVersionId}/dashboard`)).data;

export const getFormDashboard = async (formId: number) =>
  (await api.get<AnalyticsDashboardResponse>(`/analytics/form/${formId}/dashboard`)).data;
